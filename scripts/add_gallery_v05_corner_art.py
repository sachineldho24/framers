import bpy,math,json
from pathlib import Path
from mathutils import Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05');bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
s=bpy.context.scene;shell=bpy.data.objects['00_CONTINUOUS_ARCHITECTURE']
for name,(x,y),material in [('WEST',(-6.25,-4.45),'PBR_Brushed_Champagne_Bronze'),('EAST',(10.00,-4.60),'PBR_Bone_Glazed_Ceramic')]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.67,depth=.64,location=(x,y,.32));o=bpy.context.object;o.name='SCULPTURE_'+name+'_Travertine_Plinth';o.parent=shell;o.data.materials.append(bpy.data.materials['PBR_Honed_Limestone'])
 b=o.modifiers.new('Honed_plinth_edge','BEVEL');b.width=.028;b.segments=4;o.modifiers.new('Surface_normals','WEIGHTED_NORMAL')
 for p in o.data.polygons:p.use_smooth=True
 points=[]
 for i in range(257):
  t=2*math.pi*i/256;r=.51+.13*math.cos(3*t)
  points.append(Vector((r*math.cos(2*t),r*.52*math.sin(2*t),.64+.53*math.sin(3*t))))
 verts=[];faces=[]
 for i,p in enumerate(points):
  tangent=(points[(i+1)%256]-points[(i-1)%256]).normalized();a=tangent.cross(Vector((0,1,0))).normalized();b=tangent.cross(a).normalized()
  for j in range(12):
   angle=2*math.pi*j/12;v=p+a*.062*math.cos(angle)+b*.036*math.sin(angle);verts.append(tuple(v+Vector((x,y,.66))))
 for i in range(256):
  for j in range(12):a=i*12+j;b=i*12+(j+1)%12;faces.append((a,b,b+12,a+12))
 d=bpy.data.meshes.new('Cast_Ribbon_Form');d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new('SCULPTURE_'+name+'_Cast_Ribbon',d);s.collection.objects.link(o);o.parent=shell;d.materials.append(bpy.data.materials[material])
 for p in d.polygons:p.use_smooth=True
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.04,depth=.17,location=(x-.51,y,.705));o=bpy.context.object;o.name='SCULPTURE_'+name+'_Mount';o.parent=shell;o.data.materials.append(bpy.data.materials[material])
meta=json.loads((OUT/'gallery-structure.json').read_text());meta['corner_sculptures']=[[-6.25,-4.45],[10,-4.60]]
for room in meta['rooms']:room['source']='Procedurally modeled v05 furnishings'
(OUT/'gallery-structure.json').write_text(json.dumps(meta,indent=2))
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
print('V05_CORNER_ART_READY',flush=True)
