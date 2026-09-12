"""Verify the saved authoring scene, source fidelity, and inherited camera route."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06')
path=OUT/'framers_gallery_v06_meshy.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
s=bpy.context.scene;meta=json.loads((OUT/'gallery-structure.json').read_text())
integration=json.loads((OUT/'integration-manifest.json').read_text())
components=json.loads((OUT/'component-manifest.json').read_text());errors=[]
objects=[o for o in s.objects if o.type=='MESH' and o.name.startswith('MESHY_')]
expected={p['name']:p['triangles'] for source in components.values() for p in source['parts']}
for name,triangles in expected.items():
    o=bpy.data.objects.get(name)
    if not o:errors.append('Missing supplied component: '+name);continue
    if len(o.data.polygons)!=triangles:errors.append('Source triangle count changed: '+name)
    if not o.data.uv_layers:errors.append('Missing UVs: '+name)
    if any(mod.type=='DECIMATE' for mod in o.modifiers):errors.append('Unexpected source decimation: '+name)
for name in integration['removed_objects']:
    if name in s.objects:errors.append('Replaced object remains: '+name)
if len(objects)!=20:errors.append('Expected 20 separated Meshy components')
cameras=[o.name for o in s.objects if o.type=='CAMERA']
if len(cameras)!=7:errors.append('Expected seven cameras')
for room in meta['rooms']:
    if 'ART_'+room['id'] not in s.objects:errors.append('Missing reference print '+room['id'])
tour=bpy.data.objects['CAM_TOUR'];animation_errors=[]
for p in meta['camera_samples']:
    f=1+p['progress']*2880;s.frame_set(int(f),subframe=f-int(f));s.view_layers.update()
    delta=(tour.matrix_world.translation-Vector(p['position_blender'])).length
    if delta>.0001:animation_errors.append(dict(progress=p['progress'],position_error=delta))
if animation_errors:errors.append('Camera sample mismatch')
s.frame_set(1);deps=bpy.context.evaluated_depsgraph_get();near=[]
print('V06_CHECKING_PATH',flush=True)
for p in meta['camera_samples']:
    pos=Vector(p['position_blender'])
    for i in range(24):
        a=2*math.pi*i/24
        hit,loc,n,idx,obj,m=s.ray_cast(deps,pos,Vector((math.cos(a),math.sin(a),0)),distance=.32)
        if hit:near.append(dict(progress=p['progress'],object=obj.name,distance=(loc-pos).length))
if near:errors.append('Camera clearance failed')
images=[]
for im in bpy.data.images:
    if im.source!='FILE':continue
    rec=dict(name=im.name,size=list(im.size),packed=bool(im.packed_file));images.append(rec)
    if not im.packed_file:errors.append('External image dependency: '+im.name)
source_images=[im for im in images if im['name'].startswith('MESHY_')]
if len(source_images)!=16:errors.append('Expected sixteen original Meshy images')
for im in source_images:
    if im['size']!=[2048,2048]:errors.append('Source texture resolution changed: '+im['name'])
floor_problems=[]
for rec in integration['placements']:
    if rec['room_bounds']['min'][2]<-.005:floor_problems.append(rec['object'])
if floor_problems:errors.append('Furniture below floor')
report=dict(errors=errors,blend_file=str(path),bytes=path.stat().st_size,
    sha256=hashlib.sha256(path.read_bytes()).hexdigest(),protected_scene_unchanged=integration['protected_scene_unchanged'],
    supplied_components=len(objects),original_detail_triangles=sum(len(o.data.polygons) for o in objects),
    source_triangle_counts_verified=True,cameras=cameras,reference_prints=6,
    animation_samples=len(meta['camera_samples']),animation_errors=animation_errors,
    camera_clearance=dict(samples=len(meta['camera_samples']),rays_per_sample=24,radius_metres=.32,collisions=near),
    floor_problems=floor_problems,source_images=source_images,all_images_packed=all(im['packed'] for im in images),
    lights=sum(o.type=='LIGHT' for o in s.objects),total_objects=len(s.objects))
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
print('V06_VALIDATION',json.dumps({k:v for k,v in report.items() if k!='source_images'}),flush=True)
if errors:raise RuntimeError('; '.join(errors))
