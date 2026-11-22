"""Create a source/render contact sheet and report observable color landmarks.

Requires Pillow and NumPy. Alignment uses crest/chin anchors, only translation
and uniform scale. It does not deform images or claim a global likeness score.
"""
import json
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets'/'freedom-head'
sheet=Image.open(OUT/'reference'/'head-six-views.png').convert('RGB')
manifest=json.loads((OUT/'manifest.json').read_text())


def components(mask):
    visited=np.zeros(mask.shape,dtype=bool)
    groups=[]
    for y,x in zip(*np.where(mask)):
        if visited[y,x]:continue
        queue=deque([(int(y),int(x))]);visited[y,x]=True;points=[]
        while queue:
            yy,xx=queue.popleft();points.append((xx,yy))
            for ny,nx in ((yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)):
                if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and not visited[ny,nx]:
                    visited[ny,nx]=True;queue.append((ny,nx))
        if len(points)>=8:
            p=np.array(points)
            groups.append({'pixels':len(points),'center':p.mean(axis=0).tolist(),
                           'bounds':[int(p[:,0].min()),int(p[:,1].min()),int(p[:,0].max()),int(p[:,1].max())]})
    return sorted(groups,key=lambda item:item['pixels'],reverse=True)


def landmarks(image):
    pixels=np.asarray(image,dtype=float);h,w=pixels.shape[:2]
    r,g,b=np.moveaxis(pixels,2,0)
    red=(r>g*1.55)&(r>b*1.5)&(r>65)
    yy,xx=np.indices((h,w))
    top=components(red&(yy<h*.65));bottom=components(red&(yy>=h*.65))
    if not top or not bottom:
        raise RuntimeError('Cannot locate red crest/chin anchors in review image')
    crest=top[0];chin=bottom[0]
    yellow=(r>g*1.04)&(g>b*1.5)&(r>90)&(yy<crest['center'][1])
    ys,xs=np.where(yellow)
    tips={'left':[float(xs.min()),float(ys[xs.argmin()])],
          'right':[float(xs.max()),float(ys[xs.argmax()])],
          'upper':[float(xs[ys.argmin()]),float(ys.min())]} if len(xs) else {}
    blue=(b>r*1.15)&(g>r*1.10)&(b>70)&(yy<crest['center'][1])
    blue&=(abs(xx-crest['center'][0])<w*.14)
    cameras=components(blue)
    return {'crest':crest,'chin':chin,'finTips':tips,'camera':cameras[0] if cameras else None}


def point_transform(point,scale,shift):
    return [point[0]*scale+shift[0],point[1]*scale+shift[1]]


font=ImageFont.load_default(size=20)
canvas=Image.new('RGB',(1536,1000),(235,235,235))
draw=ImageDraw.Draw(canvas)
report={'revision':manifest['revision'],'scope':'Color landmarks and aligned visual review only; no global fidelity score.',
        'alignment':'Primary view uses locked constraint projection; auxiliary views use crest/chin registration. Uniform scale and translation only.',
        'views':{}}
for col,(name,tile) in enumerate((('front',0),('side',1),('three-quarter',3))):
    x=tile%3*512;y=tile//3*512
    reference=sheet.crop((x,y,x+512,y+450))
    rendered=Image.open(OUT/'renders'/(name+'.png')).convert('RGB')
    ref=landmarks(reference);model=landmarks(rendered)
    scale=(ref['chin']['center'][1]-ref['crest']['center'][1])/(model['chin']['center'][1]-model['crest']['center'][1])
    reference_center=np.mean([ref['crest']['center'],ref['chin']['center']],axis=0)
    model_center=np.mean([model['crest']['center'],model['chin']['center']],axis=0)
    shift=(reference_center-model_center*scale).tolist()
    if name=='three-quarter':
        projection=json.loads((OUT/'reference'/'part-constraints.json').read_text())['projection']
        scale=projection['pixelsPerWorldUnit']/400
        shift=[projection['imageOriginU']-500*scale,projection['imageOriginV']-500*scale]
    aligned=rendered.transform(reference.size,Image.Transform.AFFINE,
        (1/scale,0,-shift[0]/scale,0,1/scale,-shift[1]/scale),
        resample=Image.Resampling.BICUBIC,fillcolor=(94,94,94))
    if name=='three-quarter':
        clay=Image.open(OUT/'renders'/'clay-three-quarter.png').convert('RGB')
        clay=clay.transform(reference.size,Image.Transform.AFFINE,
            (1/scale,0,-shift[0]/scale,0,1/scale,-shift[1]/scale),
            resample=Image.Resampling.BICUBIC,fillcolor=(94,94,94))
        actual=Image.new('RGB',(1024,530),(235,235,235))
        actual.paste(reference,(0,40));actual.paste(clay,(512,40))
        labels=ImageDraw.Draw(actual)
        labels.text((12,10),'REFERENCE IMAGE',font=font,fill=(20,20,20))
        labels.text((524,10),'ACTUAL BLENDER V%d CLAY'%manifest['revision'],font=font,fill=(20,20,20))
        labels.text((12,503),'Locked primary scale + translation. Model panel contains no source pixels.',font=ImageFont.load_default(size=15),fill=(20,20,20))
        actual.save(OUT/'actual-clay-vs-reference.png')
    canvas.paste(reference,(col*512,40));canvas.paste(aligned,(col*512,540))
    draw.text((col*512+12,10),'REFERENCE / '+name,font=font,fill=(25,25,25))
    draw.text((col*512+12,510),'BLENDER V%d / '%manifest['revision']+name,font=font,fill=(25,25,25))
    errors={}
    if ref['camera'] and model['camera']:
        transformed=point_transform(model['camera']['center'],scale,shift)
        errors['cameraCenterPixels']=(np.array(transformed)-np.array(ref['camera']['center'])).tolist()
    if name=='front':
        for tip in ('left','right','upper'):
            if tip in ref['finTips'] and tip in model['finTips']:
                transformed=point_transform(model['finTips'][tip],scale,shift)
                errors['fin_'+tip+'_pixels']=(np.array(transformed)-np.array(ref['finTips'][tip])).tolist()
    report['views'][name]={'reference':ref,'render':model,'scale':scale,'translation':shift,
                           'independentLandmarkDeltas':errors}
canvas.save(OUT/'reference-comparison.png')
(OUT/'landmark-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('HEAD_REFERENCE_COMPARISON_OK revision',manifest['revision'])
for name,record in report['views'].items():
    print(name,record['independentLandmarkDeltas'])
