import bpy,json,math
from pathlib import Path
from mathutils import Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05');meta=json.loads((OUT/'gallery-structure.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
s=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();near=[]
for p in meta['camera_samples']:
 pos=Vector(p['position_blender'])
 for i in range(24):
  a=2*math.pi*i/24;hit,loc,n,idx,obj,m=s.ray_cast(deps,pos,Vector((math.cos(a),math.sin(a),0)),distance=.32)
  if hit:near.append(dict(progress=p['progress'],object=obj.name,distance=(loc-pos).length))
forbidden=[o.name for o in s.objects if any(k in o.name for k in ['_Return','Portal_Pier','Opening_Lintel','Central_Core'])]
source=dict(sampled_positions=len(meta['camera_samples']),rays_per_position=24,clearance_radius=.32,near_geometry=near,separation_walls=forbidden,lights=sum(o.type=='LIGHT' for o in s.objects))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'framers_gallery_v05.glb'))
errors=[]
for room in meta['rooms']:
 for name in ['ART_'+room['id'],room['camera']]:
  if name not in bpy.data.objects:errors.append('Missing '+name)
cams=[o.name for o in bpy.context.scene.objects if o.type=='CAMERA']
if len(cams)!=7:errors.append('Expected seven cameras')
if not bpy.data.actions:errors.append('Missing animated tour')
report=dict(source=source,errors=errors,cameras=cams,meshes=sum(o.type=='MESH' for o in bpy.context.scene.objects),triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons),images=[dict(name=i.name,size=list(i.size)) for i in bpy.data.images],actions=[a.name for a in bpy.data.actions])
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
print('V05_VALIDATION',json.dumps({k:v for k,v in report.items() if k!='images'}),flush=True)
