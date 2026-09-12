"""Bake static diffuse light for the web while keeping editable source PBR materials."""
import bpy,json,time
from pathlib import Path
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05');BAKE=OUT/'baked';BAKE.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
s=bpy.context.scene;s.cycles.samples=16;s.cycles.use_adaptive_sampling=False;s.cycles.diffuse_bounces=3;s.cycles.max_bounces=5
s.render.threads_mode='FIXED';s.render.threads=2
targets=[bpy.data.objects['ARCH_Continuous_Rounded_U_Wall'],bpy.data.objects['ARCH_Continuous_Floor']]+[o for o in s.objects if o.name.startswith('TEXTILE_Handwoven_Rug')]
report=[]
for original in targets:
 name=original.name;start=time.time();iswall='Wall' in name
 o=original
 if not iswall:
  poly=max(original.data.polygons,key=lambda p:p.normal.z)
  vertices=[tuple(original.data.vertices[i].co) for i in poly.vertices]
  d=bpy.data.meshes.new('Bake_Surface');d.from_pydata(vertices,[],[tuple(range(len(vertices)))]);d.update()
  o=bpy.data.objects.new('BAKE_'+name,d);s.collection.objects.link(o);o.parent=original.parent;o.matrix_parent_inverse=original.matrix_parent_inverse.copy();o.location=original.location.copy();o.rotation_euler=original.rotation_euler.copy();o.scale=original.scale.copy()
  uv=d.uv_layers.new(name='UVMap')
  old_uv=original.data.uv_layers.active
  for li,oldli in zip(d.polygons[0].loop_indices,poly.loop_indices):uv.data[li].uv=old_uv.data[oldli].uv
  o.data.materials.append(original.data.materials[0]);original.hide_render=True
  export=dict(kind='plane',vertices=vertices,faces=[list(range(len(vertices)))])
 else:
  export=dict(kind='wall')
  for m in o.modifiers:m.show_render=False;m.show_viewport=False
 original_uv=o.data.uv_layers.active
 m=o.data.materials[0].copy();o.data.materials[0]=m
 uv_node=m.node_tree.nodes.new('ShaderNodeUVMap');uv_node.uv_map=original_uv.name
 for t in m.node_tree.nodes:
  if t.type=='TEX_IMAGE':m.node_tree.links.new(uv_node.outputs['UV'],t.inputs['Vector'])
 atlas=o.data.uv_layers.new(name='BakedUV')
 if iswall:
  us=[l.uv.x for l in original_uv.data];umax=max(us)
  for i,v in enumerate(original_uv.data):atlas.data[i].uv=(v.uv.x/umax,v.uv.y)
  size=(2048,256);export['u_divisor']=umax
 else:
  minx=min(v.co.x for v in o.data.vertices);maxx=max(v.co.x for v in o.data.vertices);miny=min(v.co.y for v in o.data.vertices);maxy=max(v.co.y for v in o.data.vertices)
  for i,l in enumerate(o.data.loops):v=o.data.vertices[l.vertex_index].co;atlas.data[i].uv=((v.x-minx)/(maxx-minx),(v.y-miny)/(maxy-miny))
  size=(1024,1024) if 'Floor' in name else (384,384)
 o.data.uv_layers.active=atlas
 im=bpy.data.images.new('BAKED_'+name,width=size[0],height=size[1],alpha=False);im.filepath_raw=str(BAKE/(name+'.png'));im.file_format='PNG'
 node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
 for n in m.node_tree.nodes:n.select=False
 node.select=True;m.node_tree.nodes.active=node
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 print('BAKE_START',name,size,flush=True)
 bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR','DIRECT','INDIRECT'},use_clear=True,margin=6)
 im.save();export.update(object=name,image=im.filepath_raw,size=size,seconds=round(time.time()-start,1));report.append(export)
 # Continue illuminating with the original PBR surface after each bake.
 if not iswall:original.hide_render=False;bpy.data.objects.remove(o,do_unlink=True)
 else:
  for mod in original.modifiers:mod.show_render=True;mod.show_viewport=True
 (BAKE/'manifest.json').write_text(json.dumps(report,indent=2))
 print('BAKE_READY',name,export['seconds'],flush=True)
print('V05_ARCHITECTURE_BAKED',len(report),flush=True)
