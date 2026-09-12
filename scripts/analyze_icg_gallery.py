"""Inspect the supplied Iris archive and import its reference scene in Blender."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(r'C:\Personal_Projects\Framers')
SOURCE = Path(r'C:\Users\Sachin\Downloads\icggallery.irisceramicagroup.com\icggallery.irisceramicagroup.com')
OUT = ROOT / 'gallery_v04' / 'analysis'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'webgl/models/ff_pov-mobile.glb'))
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'webgl/models/camera_paths.glb'))
scene = bpy.context.scene
scene.view_layers.update()
data = {'objects': [], 'actions': [], 'camera_samples': [], 'images': []}
for obj in scene.objects:
    record = {'name': obj.name, 'type': obj.type, 'position': list(obj.matrix_world.translation)}
    if obj.type == 'MESH':
        bounds = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
        record.update(min=[min(p[i] for p in bounds) for i in range(3)], max=[max(p[i] for p in bounds) for i in range(3)], triangles=sum(len(p.vertices)-2 for p in obj.data.polygons), materials=[m.name if m else None for m in obj.data.materials])
    if obj.animation_data:
        record['action'] = obj.animation_data.action.name if obj.animation_data.action else None
        record['nla'] = [[t.name, [[s.name, list(s.action.frame_range)] for s in t.strips]] for t in obj.animation_data.nla_tracks]
    data['objects'].append(record)
for action in bpy.data.actions:
    data['actions'].append({'name': action.name, 'range': list(action.frame_range)})
for img in bpy.data.images:
    data['images'].append({'name': img.name, 'size': list(img.size)})
cam = bpy.data.objects['ff_camera']
scene.camera = cam
mount = bpy.data.objects['ff_empty']
if mount.animation_data and mount.animation_data.action:
    start, end = mount.animation_data.action.frame_range
else:
    start, end = next(a.frame_range for a in bpy.data.actions if 'ff_empty' in a.name)
scene.frame_start, scene.frame_end = int(start), int(end)
for j in range(25):
    frame = start + (end-start)*j/24
    scene.frame_set(int(frame), subframe=frame-int(frame))
    world = cam.matrix_world
    data['camera_samples'].append({'t':j/24,'frame':frame,'position':list(world.translation),'forward':list(world.to_quaternion() @ Vector((0,0,-1))), 'rotation':list(world.to_quaternion())})
data['camera'] = {'lens':cam.data.lens,'sensor_width':cam.data.sensor_width,'sensor_height':cam.data.sensor_height,'sensor_fit':cam.data.sensor_fit,'angle_y':cam.data.angle_y}
scene.frame_set(int(start))
data['render'] = {'cycles_devices':[]}
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.get_devices()
    data['render']['cycles_devices']=[{'name':d.name,'type':d.type} for d in prefs.devices]
except Exception as e: data['render']['error']=str(e)
(OUT/'reference-audit.json').write_text(json.dumps(data,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'icg-reference.blend'))
print('ICG_AUDIT', json.dumps(data))
