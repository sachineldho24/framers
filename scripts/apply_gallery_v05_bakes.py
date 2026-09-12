"""Executed by export only; never overwrites the editable physically lit scene."""
import bpy,json
from pathlib import Path
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05')
manifest=OUT/'baked/manifest.json'
if manifest.exists():
 records=json.loads(manifest.read_text())
 if len(records)!=8:raise RuntimeError('Expected completed wall, floor and six rug bakes')
 for entry in records:
  o=bpy.data.objects[entry['object']]
  if entry['kind']=='plane':
   d=bpy.data.meshes.new(o.name+'_Web_Baked_Surface');d.from_pydata(entry['vertices'],[],entry['faces']);d.update();o.data=d
   for m in list(o.modifiers):o.modifiers.remove(m)
   uv=d.uv_layers.new(name='UVMap');minx=min(v.co.x for v in d.vertices);maxx=max(v.co.x for v in d.vertices);miny=min(v.co.y for v in d.vertices);maxy=max(v.co.y for v in d.vertices)
   for i,l in enumerate(d.loops):v=d.vertices[l.vertex_index].co;uv.data[i].uv=((v.x-minx)/(maxx-minx),(v.y-miny)/(maxy-miny))
  else:
   for v in o.data.uv_layers.active.data:v.uv.x/=entry['u_divisor']
  m=bpy.data.materials.new('BAKED_'+o.name);m.use_nodes=True;n=m.node_tree.nodes;n.clear();output=n.new('ShaderNodeOutputMaterial');t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(entry['image'],check_existing=True);m.node_tree.links.new(t.outputs['Color'],output.inputs['Surface']);o.data.materials.clear();o.data.materials.append(m)
 print('V05_STATIC_LIGHT_BAKES_APPLIED',len(records),flush=True)
