"""Align all six settings to one continuous rounded U wall and its parallel walk."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v05'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
s=bpy.context.scene;meta=json.loads((OUT/'gallery-structure.json').read_text())
origins=[(-4.8,8.8,0),(-4.8,2.0,0),(-1.3,-3,0),(4.8,-3,0),(8.5,1,0),(8.5,8.0,0)]
angles=[-math.pi/2,-math.pi/2,0,0,math.pi/2,math.pi/2]
for room,origin,angle in zip(meta['rooms'],origins,angles):
 o=bpy.data.objects['ROOM_'+room['id']];o.location=origin;o.rotation_euler.z=angle
 room['origin']=origin;room['angle']=angle
for name in [o.name for o in bpy.data.objects]:
 o=bpy.data.objects.get(name)
 if o and o.name.startswith(('ARCH_Artwork_Backdrop','ARCH_Continuous_Bronze_Skirting','LIGHT_Wall_Cove','ARCH_Continuous_Ceiling_Rail','LIGHT_Continuous_Promenade_Ribbon','ARCH_Rail_Suspension','DETAIL_Wayfinding_Inlay','ARCH_Clerestory','ARCH_Perimeter','ARCH_Limestone_Slab','ARCH_Continuous_Floor_Slab','ARCH_Uninterrupted_Ceiling','TRANSITION_')):
  # Transition roots own their plinths and sculpture geometry.
  for child in list(o.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
  if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
shell=bpy.data.objects['00_CONTINUOUS_ARCHITECTURE']
M={k:bpy.data.materials[v] for k,v in [('stone','PBR_Honed_Limestone'),('plaster','PBR_Limewash_chalk'),('ceiling','PBR_Mineral_Ceiling'),('brass','PBR_Brushed_Champagne_Bronze'),('black','PBR_Blackened_Steel'),('led','PBR_Warm_Linear_Light'),('white','PBR_Daylight_Diffuser')]}
def box(name,loc,size,ma,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.parent=shell;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[ma])
 if bevel:
  m=o.modifiers.new('Edge_radius','BEVEL');m.width=bevel;m.segments=3;m.harden_normals=True
  o.modifiers.new('Surface_normals','WEIGHTED_NORMAL')
 return o
def tube(name,points,r,ma):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=4
 sp=d.splines.new('POLY');sp.points.add(len(points)-1)
 for p,v in zip(sp.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.parent=shell;d.materials.append(M[ma]);return o
wall=[]
def line(a,b,n=32):
 for j in range(n):t=j/n;wall.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t))
line((-4.8,12.1),(-4.8,-2.2),64)
for j in range(25):a=math.pi+math.pi/2*j/24;wall.append((-4+.8*math.cos(a),-2.2+.8*math.sin(a)))
line((-4,-3),(7.7,-3),64)
for j in range(25):a=3*math.pi/2+math.pi/2*j/24;wall.append((7.7+.8*math.cos(a),-2.2+.8*math.sin(a)))
line((8.5,-2.2),(8.5,12.1),64);wall.append((8.5,12.1))
verts=[];faces=[];distance=[0]
for i,p in enumerate(wall):
 if i:distance.append(distance[-1]+math.dist(p,wall[i-1]))
 verts.extend([(p[0],p[1],0),(p[0],p[1],3.8)])
for i in range(len(wall)-1):faces.append((2*i,2*i+2,2*i+3,2*i+1))
d=bpy.data.meshes.new('Continuous_U_Wall');d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new('ARCH_Continuous_Rounded_U_Wall',d);s.collection.objects.link(o);o.parent=shell
# One physical material and uninterrupted surface across all frame stories.
o.data.materials.append(M['plaster']);uv=d.uv_layers.new(name='UVMap')
for p in d.polygons:
 p.use_smooth=True
 for li in p.loop_indices:
  vi=d.loops[li].vertex_index;uv.data[li].uv=(distance[vi//2]/3,vi%2)
sol=o.modifiers.new('Wall_thickness_to_inner_core','SOLIDIFY');sol.thickness=.16;sol.offset=-1
tube('ARCH_Continuous_Bronze_Skirting',[(x,y,.05) for x,y in wall],.026,'brass')
tube('LIGHT_Continuous_Artwall_Cove',[(x,y,3.71) for x,y in wall],.020,'led')
# New perimeter follows the generous outer walk. All furniture remains on a common floor.
floor=box('ARCH_Continuous_Floor',(1.85,.75,-.08),(34.2,27.5,.15),'stone')
for poly in floor.data.polygons:
 for li in poly.loop_indices:
  v=floor.data.vertices[floor.data.loops[li].vertex_index].co
  floor.data.uv_layers.active.data[li].uv=(v.x/2,v.y/2)
box('ARCH_Uninterrupted_Ceiling',(1.85,.75,3.91),(34.2,27.5,.18),'ceiling')
for x in [-15.20,18.90]:box('ARCH_Perimeter',(x,.75,1.92),(.16,27.5,3.84),'plaster')
for y in [-12.93,14.43]:box('ARCH_Perimeter',(1.85,y,1.92),(34.2,.16,3.84),'plaster')
# Thin expansion joints create a restrained large-format limestone grid.
for x in range(-14,19,2):box('DETAIL_Limestone_Joint',(x,.75,.001),(.003,27.3,.002),'ceiling',0)
for y in range(-12,15,2):box('DETAIL_Limestone_Joint',(1.85,y,.001),(34,.003,.002),'ceiling',0)
for x in [-15.105,18.805]:
 box('ARCH_Clerestory_Diffuser',(x,.75,3.40),(.014,26.4,.47),'white',.001)
 for y in range(-12,15,2):box('ARCH_Clerestory_Mullion',(x,y,3.4),(.03,.032,.50),'brass',.003)
# The camera stays parallel to the U wall with tangent-continuous quarter-circle turns.
path=[]
def sample_segment(a,b,n):
 for j in range(n):t=j/n;path.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[2],a[3]))
sample_segment((-12.6,8.8,1,0),(-12.6,-2.2,1,0),55)
for j in range(49):
 a=math.pi+math.pi/2*j/48;path.append((-4+8.6*math.cos(a),-2.2+8.6*math.sin(a),-math.cos(a),-math.sin(a)))
sample_segment((-4,-10.8,0,1),(7.7,-10.8,0,1),58)
for j in range(49):
 a=3*math.pi/2+math.pi/2*j/48;path.append((7.7+8.6*math.cos(a),-2.2+8.6*math.sin(a),-math.cos(a),-math.sin(a)))
sample_segment((16.3,-2.2,-1,0),(16.3,8.6,-1,0),54);path.append((16.3,8.6,-1,0))
length=[0]
for i in range(1,len(path)):length.append(length[-1]+math.dist(path[i][:2],path[i-1][:2]))
tour=bpy.data.objects['CAM_TOUR'];tour.animation_data_clear();tour.rotation_mode='QUATERNION';cam_samples=[]
for point,dist in zip(path,length):
 x,y,dx,dy=point;p=dist/length[-1];frame=1+p*2880
 tour.location=(x,y,1.70);tour.rotation_quaternion=Vector((dx,dy,-.01)).to_track_quat('-Z','Y')
 tour.keyframe_insert(data_path='location',frame=frame);tour.keyframe_insert(data_path='rotation_quaternion',frame=frame)
 cam_samples.append(dict(progress=p,time_seconds=p*96,position_blender=list(tour.location),quaternion_blender_wxyz=list(tour.rotation_quaternion)))
tour.animation_data.action.name='Framers_Continuous_Tour'
# Linear samples keep exact constant speed along the many closely spaced route points.
for layer in tour.animation_data.action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    for key in curve.keyframe_points:key.interpolation='LINEAR'
for room in meta['rooms']:
 root=bpy.data.objects['ROOM_'+room['id']]
 cam=bpy.data.objects[room['camera']];cam.location=(0,-7.8,1.7);cam.rotation_euler=(Vector((0,-.3,1.55))-cam.location).to_track_quat('-Z','Y').to_euler()
 root.update_tag()
s.view_layers.update()
for room in meta['rooms']:
 cp=bpy.data.objects[room['camera']].matrix_world.translation
 best=min(cam_samples,key=lambda p:(Vector(p['position_blender'])-cp).length)
 room['stop']=best['progress']
rail=[(p['position_blender'][0],p['position_blender'][1],3.68) for p in cam_samples]
tube('ARCH_Continuous_Ceiling_Rail',rail,.034,'black');tube('LIGHT_Continuous_Promenade_Ribbon',[(x,y,z-.041) for x,y,z in rail],.012,'led')
# Soften manufactured bevels and remove the reflective veil from paper prints.
for obj in s.objects:
 if obj.type=='MESH' and any(m.type=='BEVEL' for m in obj.modifiers):
  for p in obj.data.polygons:p.use_smooth=True
  for mod in obj.modifiers:
   if mod.type=='BEVEL':mod.harden_normals=True
for m in bpy.data.materials:
 if not m.use_nodes:continue
 p=m.node_tree.nodes.get('Principled BSDF')
 if not p:continue
 if m.name.startswith('PBR_Fine_Art'):
  p.inputs['Specular IOR Level'].default_value=.04;p.inputs['Coat Weight'].default_value=0;p.inputs['Roughness'].default_value=.85
 if m.name.startswith('PBR_Woven'):p.inputs['Specular IOR Level'].default_value=.24
# Preserve tonal depth, especially in the artwork and dark furniture.
s.view_settings.exposure=.05;s.view_settings.look='AgX - Medium High Contrast'
for l in [o for o in s.objects if o.type=='LIGHT']:
 if l.name.startswith('LIGHT_Key'):l.data.energy=420
 if l.name.startswith('LIGHT_Fill'):l.data.energy=125
 if l.name.startswith('LIGHT_Artwork_Wash'):l.data.energy=60
s.cycles.samples=64;s.cycles.adaptive_threshold=.035;s.cycles.diffuse_bounces=3;s.cycles.max_bounces=5
s.frame_set(1);s.camera=tour;s.view_layers.update()
meta['camera_samples']=cam_samples;meta['source_camera_adaptation']='New tangent-continuous U route: 7.8 m viewing distance, 1.70 m eye height, 96 s; retains Iris-inspired first-floor choreography.'
meta['construction'].update(bounds_xy=[-15.2,-12.93,18.9,14.43],ceiling_height=3.8,continuous_wall=True,corner_radius=.8)
meta['lights_blender']=[]
for l in [o for o in s.objects if o.type=='LIGHT']:
 p=l.matrix_world.translation;forward=l.matrix_world.to_quaternion()@Vector((0,0,-1))
 meta['lights_blender'].append(dict(name=l.name,type=l.data.type,position=list(p),target=list(p+forward*3),energy=l.data.energy,color=list(l.data.color),size=getattr(l.data,'size',.15)))
(OUT/'gallery-structure.json').write_text(json.dumps(meta,indent=2))
s['continuous_layout']='One uninterrupted rounded U wall, no freestanding backdrops, no side partitions; parallel continuous camera walk'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
print('V05_CONTINUITY_REFINED',len(cam_samples),'camera samples',flush=True)
