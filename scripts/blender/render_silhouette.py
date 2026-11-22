"""Render a saved model's front/side body silhouettes, excluding the V-fin.

Blender --background model.blend --python this.py -- <output-directory>
"""
import bpy
import sys
from pathlib import Path
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1:
    raise RuntimeError('Supply one output directory after --')
out=Path(args[0]);out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;camera=scene.camera
if camera is None:
    raise RuntimeError('Saved model has no review camera')
for obj in bpy.data.objects:
    if 'V-fin' in obj.name or 'fin central arris' in obj.name:
        obj.hide_render=True
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=scene.render.resolution_y=1000
scene.render.resolution_percentage=100
camera.data.type='ORTHO';camera.data.ortho_scale=2.5
for name,position in {'front':(0,-8,1.04),'side':(8,0,1.04)}.items():
    camera.location=position
    camera.rotation_euler=(Vector((0,0,1.04))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/('silhouette-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
print('SILHOUETTE_RENDER_OK',out)
