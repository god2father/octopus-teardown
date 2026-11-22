"""Inspect the saved head's actual evaluated geometry; does not score likeness.

Run with Blender --background <model.blend> --python scripts/blender/review_head.py.
"""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

out=Path(__file__).resolve().parents[2]/'assets'/'freedom-head'
deps=bpy.context.evaluated_depsgraph_get()
root=bpy.data.objects.get('Freedom_Head')
if root is None:
    raise RuntimeError('Missing head root')

def inspect(obj):
    evaluated=obj.evaluated_get(deps)
    data=evaluated.to_mesh()
    if not data.vertices:
        raise RuntimeError('Empty geometry: '+obj.name)
    points=[evaluated.matrix_world@v.co for v in data.vertices]
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    bm=bmesh.new();bm.from_mesh(data)
    record={'name':obj.name,'vertices':len(data.vertices),'faces':len(data.polygons),
            'boundsMin':lo,'boundsMax':hi,'dimensions':[hi[i]-lo[i] for i in range(3)],
            'nonManifoldEdges':sum(not edge.is_manifold for edge in bm.edges),
            'volume':abs(bm.calc_volume(signed=True))}
    bm.free();evaluated.to_mesh_clear()
    return record

records=[inspect(obj) for obj in root.children if obj.type=='MESH']
constraints=json.loads((out/'reference'/'part-constraints.json').read_text())
projection=constraints['projection']
scale=projection['pixelsPerWorldUnit']/400
translation=[projection['imageOriginU']-500*scale,projection['imageOriginV']-500*scale]
projection_checks=[]
anchors=[('R amber optical lens',index,pixel) for index,pixel in enumerate(constraints['orbitalAssembly']['lens'])]
anchors += [('R tapered diagonal louver %d'%index,0,points[0][:2])
            for index,points in enumerate(constraints['cheekVent']['vanes'])]
for name,index,pixel in anchors:
    obj=bpy.data.objects[name]
    point=obj.matrix_world@obj.data.vertices[index].co
    ndc=world_to_camera_view(bpy.context.scene,bpy.context.scene.camera,point)
    actual=Vector((ndc.x*1000*scale+translation[0],(1-ndc.y)*1000*scale+translation[1]))
    error=(actual-Vector((pixel[0]*.512,pixel[1]*.512))).length
    projection_checks.append({'name':name,'vertex':index,'nativePixelError':error})
    if error>.05:
        raise RuntimeError('Blender camera and source constraint disagree: '+str(projection_checks[-1]))
for record in records:
    if not all(math.isfinite(v) for v in record['dimensions']):
        raise RuntimeError('Nonfinite geometry: '+record['name'])
core_names=['Face mask | closed tapered armor','L volumetric visor and temple',
            'R volumetric visor and temple','L louver armored frame','R louver armored frame',
            'L lower cheek to skull volume','R lower cheek to skull volume',
            'L vent upper shoulder','R vent upper shoulder',
            'L temple-to-intake shell','R temple-to-intake shell',
            'L volumetric visor rear closure','R volumetric visor rear closure',
            'Sensor hood | upper beam','L sensor hood | short leg','R sensor hood | short leg',
            'Optical pod | deep body',
            'L cheek pod to helmet junction','R cheek pod to helmet junction',
            'L faceted temporal armor','R faceted temporal armor',
            'L louver cavity liner','R louver cavity liner',
            'Crown swept spine tile 00','Crown swept spine tile 01','Crown swept spine tile 02']
core=[next(r for r in records if r['name']==name) for name in core_names]
core += [r for r in records if 'intake front cheek wall' in r['name'] or 'tapered diagonal louver' in r['name']]
for record in core:
    if record['volume']<=0 or record['nonManifoldEdges']:
        raise RuntimeError('Core armor must be a closed volume: '+record['name'])

def collision_tree(obj):
    evaluated=obj.evaluated_get(deps)
    data=evaluated.to_mesh()
    points=[evaluated.matrix_world@v.co for v in data.vertices]
    tree=BVHTree.FromPolygons(points,[tuple(face.vertices) for face in data.polygons])
    evaluated.to_mesh_clear()
    return tree

vent_connections=[]
for side in ('L','R'):
    frame_obj=bpy.data.objects[side+' louver armored frame']
    frame=collision_tree(frame_obj)
    normal=Vector((.823 if side=='R' else -.823,-.568,0))
    # Side names follow construction order: L is the negative-X half.
    if (frame_obj.matrix_world@frame_obj.data.vertices[0].co).x*normal.x<0:
        normal.x=-normal.x
    origin=frame_obj.matrix_world@frame_obj.data.vertices[0].co
    for index in range(3):
        vane=bpy.data.objects[side+' tapered diagonal louver %d'%index]
        intersects=bool(frame.overlap(collision_tree(vane)))
        tip=vane.matrix_world@vane.data.vertices[0].co
        protrusion=(tip-origin).dot(normal.normalized())
        vent_connections.append({'name':vane.name,'intersectsFrame':intersects,
                                 'tipDistanceOutsideFramePlane':protrusion})
        if not intersects:
            raise RuntimeError('Vane root does not intersect frame: '+vane.name)
        if protrusion<=0:
            raise RuntimeError('Vane tip must project outside frame plane: '+vane.name)
for index in range(3):
    left=bpy.data.objects['L tapered diagonal louver %d'%index]
    right=bpy.data.objects['R tapered diagonal louver %d'%index]
    for a,b in zip(left.data.vertices,right.data.vertices):
        pa=left.matrix_world@a.co;pb=right.matrix_world@b.co
        if (Vector((-pa.x,pa.y,pa.z))-pb).length>1e-6:
            raise RuntimeError('Asymmetric vent vane: %d'%index)
duct_visibility=[]
for side,sign in (('L',-1),('R',1)):
    for u,v in ((320,650),(340,640)):
        origin=Vector((sign*8,(u-500)/400,1.04+(500-v)/400))
        hit=bpy.context.scene.ray_cast(deps,origin,Vector((-sign,0,0)))
        name=hit[4].name if hit[0] else None
        duct_visibility.append({'side':side,'sideRenderPixel':[u,v],'visibleObject':name})
        if name not in (side+' louver cavity backing',side+' louver cavity liner'):
            raise RuntimeError('White armor obstructs duct probe: '+str(duct_visibility[-1]))
view_ray=Vector((3,-8,1.16)).normalized()
view_right=Vector((8,3,0)).normalized()
view_up=view_ray.cross(view_right)
temple_visibility=[]
for u,v in ((700,525),(710,540),(720,515)):
    origin=Vector((0,0,1.04))+view_right*((u-500)/400)+view_up*((500-v)/400)+view_ray*8
    hit=bpy.context.scene.ray_cast(deps,origin,-view_ray)
    name=hit[4].name if hit[0] else None
    temple_visibility.append({'renderPixel':[u,v],'visibleObject':name})
    if name!='R volumetric visor rear closure':
        raise RuntimeError('Open temple connection: '+str(temple_visibility[-1]))
chin=constraints['chinAssembly']
chin_target=Vector((0,-.810+chin['depthOffset'],.460+chin['verticalOffset']))
chin_probe=bpy.context.scene.ray_cast(deps,chin_target+view_ray*5,-view_ray)
chin_visible=chin_probe[4].name if chin_probe[0] else None
if chin_visible not in ('Red chin keel','Chin highlight ridge'):
    raise RuntimeError('Mask obscures the upper chin armor: '+str(chin_visible))
body=[r for r in records if 'V-fin' not in r['name'] and 'fin central' not in r['name']]
lo=[min(r['boundsMin'][i] for r in body) for i in range(3)]
hi=[max(r['boundsMax'][i] for r in body) for i in range(3)]
report={'source':bpy.data.filepath,'meshObjects':len(records),'coreArmorClosed':True,
        'ventRootConnections':vent_connections,
        'ductVisibilityProbes':duct_visibility,
        'upperChinVisibleObject':chin_visible,
        'templeVisibilityProbes':temple_visibility,
        'primaryProjectionChecks':projection_checks,
        'bodyDimensionsXYZ':[hi[i]-lo[i] for i in range(3)],'coreArmor':core,
        'scope':'Geometry integrity and depth evidence only; not an image-fidelity score.',
        'likenessReview':{'status':'incomplete','remaining':[
            'Crown front hood remains taller than the side reference; generated views disagree on its height.',
            'Cheek pod junction has been closed; compare its profile and louver shape against the reference.',
            'Face-mask planes and small armor divisions need closer reference matching.',
            'Live webpage still uses the original procedural head.']}}
(out/'geometry-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('HEAD_GEOMETRY_REVIEW_OK',len(records),'meshes; body XYZ',report['bodyDimensionsXYZ'])
