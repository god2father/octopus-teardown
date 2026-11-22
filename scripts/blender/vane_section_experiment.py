"""Render a deeper louver-root experiment without replacing the current model."""
import bpy
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[2]
out=root/'teardown-out'/'vane-section-experiment'
out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
for side,sign in (('L',-1),('R',1)):
    ray=Vector((sign*3,-8,1.16)).normalized()
    normal=Vector((sign*.823,-.568,0)).normalized()
    root_shift=ray*(-.150/ray.dot(normal))
    for index in range(3):
        obj=bpy.data.objects[side+' tapered diagonal louver %d'%index]
        for vertex in obj.data.vertices:
            if vertex.index in (1,5):
                vertex.co+=root_shift
            if vertex.index>=5:
                vertex.co.z-=.013
        obj.data.update()
    obj=bpy.data.objects[side+' louver cavity backing']
    shift=ray*(-.130/ray.dot(normal))
    for vertex in obj.data.vertices:
        vertex.co+=shift
    obj.data.update()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'deeper-roots.blend'))
camera=scene.camera
for name,position in (('side',(8,0,1.04)),('three-quarter',(3,-8,2.2))):
    camera.location=position
    camera.rotation_euler=(Vector((0,0,1.04))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
print('VANE_SECTION_EXPERIMENT_OK',out)
