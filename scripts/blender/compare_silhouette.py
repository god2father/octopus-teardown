"""Overlay actual rendered body contours on traced source front/side views.

The projection is fixed in model units and image coordinates; unlike the color
contact sheet, it does not fit the model to red anchors for each new revision.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

root=Path(__file__).resolve().parents[2];out=root/'assets'/'freedom-head'
source=Image.open(out/'reference'/'head-six-views.png').convert('RGB')
traces=json.loads((out/'reference'/'body-contours.json').read_text())
revision=json.loads((out/'manifest.json').read_text())['revision']
current='V'+str(revision)
font=ImageFont.load_default(size=17)
figure=Image.new('RGB',(1024,1000),(235,235,235));draw=ImageDraw.Draw(figure)
report={'scope':traces['scope'],'projection':'200 source pixels/unit, eye reference Z=.8; fixed mapping, no per-revision fit',
        'legend':{'reference':'cyan','V5':'orange',current:'magenta'},'views':{}}


def projected_mask(path,shift_x):
    alpha=Image.open(path).convert('RGBA').getchannel('A')
    # sourceX=.5*renderX+shiftX; sourceY=.5*renderY-23
    result=alpha.transform((512,450),Image.Transform.AFFINE,
        (2,0,-2*shift_x,0,2,46),Image.Resampling.BILINEAR,fillcolor=0)
    return result.point(lambda x:255 if x>=128 else 0)


def outline(mask):
    return Image.fromarray(np.asarray(mask.filter(ImageFilter.MaxFilter(3)))-np.asarray(mask.filter(ImageFilter.MinFilter(3))))


for col,name in enumerate(('front','side')):
    tile=source.crop((col*512,0,(col+1)*512,450))
    reference_mask=Image.new('L',(512,450),0)
    polygon=[(x*.512,y*.512) for x,y in traces[name]]
    ImageDraw.Draw(reference_mask).polygon(polygon,fill=255)
    before=projected_mask(root/'teardown-out'/'head-blender-v5'/('silhouette-'+name+'.png'),13 if name=='front' else 37)
    after=projected_mask(out/'renders'/('silhouette-'+name+'.png'),13 if name=='front' else 37)
    for row,(mask,color,title) in enumerate(((before,(255,157,35),'V5 outline: orange'),(after,(245,45,190),current+' outline: magenta'))):
        panel=tile.copy()
        panel.paste((0,235,235),mask=outline(reference_mask))
        panel.paste(color,mask=outline(mask))
        figure.paste(panel,(col*512,row*500+40))
        draw.text((col*512+8,row*500+9),name+' / '+title+' / source: cyan',font=font,fill=(20,20,20))
    ref=np.asarray(reference_mask)>0
    scores={}
    for version,mask in (('V5',before),(current,after)):
        model=np.asarray(mask)>0
        scores[version]={'manualTraceIoU':float(np.count_nonzero(ref&model)/np.count_nonzero(ref|model)),
                         'modelBodyPixels':int(np.count_nonzero(model)),
                         'referenceTracePixels':int(np.count_nonzero(ref))}
    report['views'][name]=scores
figure.save(out/('silhouette-comparison-v5-v%d.png'%revision))
(out/'silhouette-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report['views'],indent=2))
