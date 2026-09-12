"""Continuous gallery: clean furniture, physical finishes and architectural light."""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v05';TEX=OUT/'textures'
(OUT/'previews').mkdir(exist_ok=True);(OUT/'analysis').mkdir(exist_ok=True)
random.seed(508)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'gallery_v04/framers_gallery_v04.blend'))
scene=bpy.context.scene;scene.name='FRAMERS_CONTINUOUS_GALLERY_V05'
meta=json.loads((ROOT/'gallery_v04/gallery-structure.json').read_text())
rooms=meta['rooms'];ids=[s['id'] for s in rooms]
# Retain the approved art mapping and camera choreography; replace the spatial shell.
for o in list(bpy.data.objects):
 keep=o.type=='CAMERA' or o.name in ['90_CAMERAS']+['ROOM_'+i for i in ids]+['ART_'+i for i in ids]
 keep=keep or any(o.name.startswith('FRAME_'+i+'_') for i in ids)
 if not keep:bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 if o.type=='MESH':
  for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)

def lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgb(c):return tuple(lin(x/255) for x in c)
def mat(name,color=(180,170,150),rough=.5,metal=0,tex=None,normal=None,coat=0,emission=0):
 m=bpy.data.materials.new('PBR_'+name);m.use_nodes=True
 n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb(color),1)
 p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Coat Weight'].default_value=coat
 if tex:
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(TEX/(tex+'.jpg')),check_existing=True)
  m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
 if normal:
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(TEX/(normal+'_normal.png')),check_existing=True);t.image.colorspace_settings.name='Non-Color'
  nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35;m.node_tree.links.new(t.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
 if emission:p.inputs['Emission Color'].default_value=(*rgb(color),1);p.inputs['Emission Strength'].default_value=emission
 return m
M={}
M['wood']=mat('American_Walnut',tex='walnut',normal='walnut',rough=.32,coat=.16)
M['stone']=mat('Honed_Limestone',tex='limestone',normal='limestone',rough=.34)
M['marble']=mat('Calacatta_Ivory',tex='ivory_marble',normal='ivory_marble',rough=.22,coat=.24)
M['darkstone']=mat('Pietra_Grey',tex='black_marble',rough=.25,coat=.15)
for k in ['linen','rose','oatmeal','charcoal','ivory']:
 M[k]=mat('Woven_'+k,tex='fabric_'+k,normal='fabric',rough=.83)
 p=M[k].node_tree.nodes.get('Principled BSDF');p.inputs['Sheen Weight'].default_value=.3;p.inputs['Sheen Roughness'].default_value=.7
M['leather']=mat('Espresso_Leather',tex='leather',normal='leather',rough=.35,coat=.18)
M['brass']=mat('Brushed_Champagne_Bronze',(170,129,73),.27,.82)
M['black']=mat('Blackened_Steel',(29,29,27),.28,.65)
M['ceramic']=mat('Bone_Glazed_Ceramic',(213,199,173),.24,coat=.3)
M['clay']=mat('Oxide_Ceramic',(126,72,46),.52)
M['green']=mat('Olive_Leaves',(66,87,39),.54)
M['bark']=mat('Olive_Bark',(87,72,46),.8)
M['soil']=mat('Planter_Soil',(38,31,23),.95)
M['paper']=mat('Warm_Paper',(204,197,179),.86)
M['led']=mat('Warm_Linear_Light',(255,206,136),.3,emission=5)
M['whiteled']=mat('Daylight_Diffuser',(224,231,244),.4,emission=2)
M['ceiling']=mat('Mineral_Ceiling',(98,92,79),.91)
M['grout']=mat('Stone_Joint',(87,82,71),.85)
for k in ['chalk','rose','graphite','sand']:M['wall_'+k]=mat('Limewash_'+k,tex='plaster_'+k,normal='plaster',rough=.86)

def empty(name,loc=(0,0,0),rot=0,parent=None):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;o.rotation_euler.z=rot;o.parent=parent;return o
SHELL=empty('00_CONTINUOUS_ARCHITECTURE');LIGHTS=empty('80_ARCHITECTURAL_LIGHTING')
def finish(o,name,ma,parent=None,smooth=False):
 o.name=name;o.parent=parent;o.data.materials.clear();o.data.materials.append(M.get(ma,ma))
 if smooth:
  for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,size,ma,bevel=.012,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,ma,parent)
 if bevel:
  b=o.modifiers.new('Crafted_edge_radius','BEVEL');b.width=bevel;b.segments=4
  b=o.modifiers.new('Surface_normals','WEIGHTED_NORMAL');b.keep_sharp=True;b.weight=40
 return o
def cyl(name,loc,r,depth,ma,parent=None,verts=48,bevel=.008):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=finish(bpy.context.object,name,ma,parent)
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 if bevel:b=o.modifiers.new('Rim_radius','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Surface_normals','WEIGHTED_NORMAL')
 return o
def sphere(name,loc,scale,ma,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=1,location=loc);o=finish(bpy.context.object,name,ma,parent,True);o.scale=scale;return o
def mesh(name,verts,faces,ma,parent=None,uv=True):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);finish(o,name,ma,parent)
 if uv:
  u=d.uv_layers.new(name='UVMap')
  for p in d.polygons:
   for li in p.loop_indices:
    v=d.vertices[d.loops[li].vertex_index].co;u.data[li].uv=(v.x*.5+v.y*.15,v.z*.5+v.y*.5)
 return o
def tube(name,points,r,ma,parent=None,cyclic=False):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=r;d.bevel_resolution=3
 s=d.splines.new('POLY');s.points.add(len(points)-1)
 for p,v in zip(s.points,points):p.co=(*v,1)
 s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.parent=parent;d.materials.append(M[ma]);return o
def lathe(name,loc,profile,ma,parent=None):
 verts=[];faces=[];n=64
 for r,z in profile:
  for i in range(n):a=2*math.pi*i/n;verts.append((r*math.cos(a),r*math.sin(a),z))
 for j in range(len(profile)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 o=mesh(name,verts,faces,ma,parent);o.location=loc
 for p in o.data.polygons:p.use_smooth=True
 return o
def rod(name,a,b,r,ma,parent=None):return tube(name,[a,b],r,ma,parent)
def light(name,loc,target,power,size=2,color=(1,.86,.67),parent=None,kind='AREA'):
 d=bpy.data.lights.new(name,kind);d.energy=power;d.color=color
 if kind=='AREA':d.shape='DISK';d.size=size
 if kind=='SPOT':d.spot_size=math.radians(62);d.spot_blend=.65;d.shadow_soft_size=.18
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.parent=parent;o.location=loc;o.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();return o

def rug(parent,color='linen',w=4.8,d=4.0,y=-2.45):
 box('TEXTILE_Handwoven_Rug',(0,y,.018),(w,d,.035),color,.055,parent)
 for j in range(2):
  yy=y+(d/2-.10)*(1 if j else -1)
  for i in range(4):box('TEXTILE_Border_Stitch',(0,yy+i*.009*(1 if j==0 else -1),.038),(w-.16,.003,.002),'oatmeal',.001,parent)
def book(parent,loc,w=.29,d=.22,h=.045,cover='charcoal',angle=0):
 root=empty('PROP_Art_Book',loc,angle,parent)
 box('PROP_Book_Pages',(0,0,h/2),(w-.014,d-.008,h-.012),'paper',.002,root)
 for z in [.003,h-.003]:box('PROP_Book_Cover',(0,0,z),(w,d,.006),cover,.002,root)
 box('PROP_Book_Spine',(-w/2+.003,0,h/2),(.007,d,h),cover,.002,root)
 return root
def vase(parent,loc,ma='ceramic',scale=1):
 p=[(.07,0),(.11,.02),(.14,.12),(.13,.23),(.075,.30),(.065,.38),(.063,.395),(.05,.395),(.05,.32),(.06,.29)]
 return lathe('PROP_Handthrown_Vase',loc,[(r*scale,z*scale) for r,z in p],ma,parent)
def bowl(parent,loc,r=.21):return lathe('PROP_Stone_Bowl',loc,[(0,0),(.10,0),(r,.075),(r,.09),(r-.012,.09),(.095,.019),(0,.019)],'marble',parent)
def sculpture(parent,loc,scale=.48,ma='brass'):
 pts=[]
 for i in range(161):
  t=2*math.pi*i/160;r=scale*(.53+.16*math.cos(3*t));pts.append((r*math.cos(2*t),r*.40*math.sin(2*t),scale*.63+scale*.47*math.sin(3*t)))
 root=empty('PROP_Looped_Bronze',loc,0,parent);tube('PROP_Sculpture_Continuous_Loop',pts,.025*scale/.48,ma,root,True)
 cyl('PROP_Sculpture_Stone_Base',(0,0,.035),scale*.34,.07,'darkstone',root)
def leaf(parent,a,b,width):
 a,b=Vector(a),Vector(b);d=b-a;side=d.cross(Vector((0,0,1))).normalized();verts=[]
 for j in range(9):
  t=j/8;mid=a+d*t+Vector((0,0,.055*math.sin(math.pi*t)));w=width*math.sin(math.pi*t)**.75
  verts.extend([tuple(mid-side*w),tuple(mid+Vector((0,0,.012*math.sin(math.pi*t)))),tuple(mid+side*w)])
 faces=[]
 for j in range(8):
  k=j*3;faces.extend([(k,k+3,k+4,k+1),(k+1,k+4,k+5,k+2)])
 o=mesh('BOTANICAL_Olive_Leaf',verts,faces,'green',parent)
 for p in o.data.polygons:p.use_smooth=True
def tree(parent,loc,height=2.4):
 root=empty('BOTANICAL_Olive_Tree',loc,0,parent)
 lathe('BOTANICAL_Travertine_Planter',(0,0,0),[(.20,0),(.29,.035),(.36,.49),(.36,.56),(.325,.56),(.30,.45)],'stone',root)
 cyl('BOTANICAL_Soil',(0,0,.46),.30,.01,'soil',root)
 tube('BOTANICAL_Organic_Trunk',[(0,0,.42),(.055,.015,.95),(-.02,.03,1.48),(.05,0,height-.18)],.027,'bark',root)
 for j in range(18):
  a=j*2.399;z=.85+(j%7)/7*(height-1.1);reach=.35+random.random()*.30
  end=Vector((math.cos(a)*reach,math.sin(a)*reach,z+.29))
  rod('BOTANICAL_Branch',(0,0,z),end,.006,'bark',root)
  for k in range(5):
   t=.45+k*.13;start=Vector((0,0,z)).lerp(end,t)
   aa=a+(1 if k%2 else -1)*.8
   leaf(root,start,start+Vector((math.cos(aa)*.18,math.sin(aa)*.18,.075)),.044)
 return root
def cushion(parent,loc,size,ma='linen',rot=(0,0,0)):
 o=box('TEXTILE_Soft_Cushion',loc,size,ma,min(size)*.39,parent);o.rotation_euler=rot
 return o
def side_table(parent,loc,r=.35,h=.5):
 cyl('FURN_Pedestal_Foot',(loc[0],loc[1],loc[2]+.025),r*.7,.05,'brass',parent)
 cyl('FURN_Pedestal_Stem',(loc[0],loc[1],loc[2]+h/2),.036,h,'brass',parent)
 cyl('FURN_Stone_Tabletop',(loc[0],loc[1],loc[2]+h),r,.035,'marble',parent)
def lamp(parent,loc,h=.7):
 root=empty('LUMINAIRE_Table_Lamp',loc,0,parent)
 lathe('LUMINAIRE_Ceramic_Base',(0,0,0),[(.12,0),(.13,.03),(.10,h*.30),(.07,h*.47),(.04,h*.54)],'ceramic',root)
 cyl('LUMINAIRE_Bronze_Neck',(0,0,h*.55),.025,h*.25,'brass',root)
 lathe('LUMINAIRE_Linen_Shade',(0,0,h*.47),[(.22,0),(.155,h*.45),(.145,h*.45),(.21,0)],'ivory',root)
 light('LIGHT_Practical_Lamp',(0,0,h*.67),(0,0,0),12,.16,(1,.71,.43),root,kind='POINT')

def living(parent):
 rug(parent,'linen',5.4,4.3,-2.4)
 # Low walnut console with fine shadow gaps and recessed bronze feet.
 box('FURN_Living_Console',(0,-.45,.58),(3.8,.68,.63),'wood',.026,parent)
 for x in [-1.48,1.48]:box('FURN_Console_Foot',(x,-.45,.17),(.035,.43,.32),'brass',.008,parent)
 for x in [-1.25,0,1.25]:box('FURN_Console_Reveal',(x,-.798,.58),(.004,.008,.54),'black',.001,parent)
 vase(parent,(1.47,-.44,.905),'clay',.84);book(parent,(-1.38,-.45,.905),w=.40,d=.25)
 # L-shaped modular sofa with separate rounded seat pads, backs and throw pillows.
 sof=empty('FURN_Modular_Sofa',(-1.50,-2.65,0),-.09,parent)
 box('FURN_Sofa_Plinth',(0,0,.14),(2.45,1.02,.17),'wood',.06,sof)
 box('FURN_Sofa_Upholstered_Base',(0,0,.32),(2.58,1.12,.34),'oatmeal',.13,sof)
 for x in [-.79,0,.79]:
  cushion(sof,(x,-.04,.57),(.78,.95,.26),'linen')
  cushion(sof,(x,.44,.89),(.79,.30,.76),'linen',(-.14,0,0))
 for x in [-1.24,1.24]:cushion(sof,(x,0,.67),(.27,1.15,.62),'linen')
 box('FURN_Chaise_Base',(-.80,-.98,.32),(.94,1.12,.35),'oatmeal',.12,sof)
 cushion(sof,(-.80,-.96,.57),(.91,1.10,.27),'linen')
 for x,ma in [(-.75,'charcoal'),(.55,'oatmeal')]:cushion(sof,(x,.13,.92),(.51,.20,.52),ma,(-.24,.1,-.12+x*.14))
 tab=empty('FURN_Nested_Coffee_Table',(.78,-2.53,0),0,parent)
 cyl('FURN_Coffee_Table_Platform',(0,0,.24),.69,.44,'wood',tab)
 cyl('FURN_Coffee_Table_Top',(0,0,.49),.82,.07,'darkstone',tab)
 side_table(tab,(.76,.15,0),.39,.37);book(tab,(-.22,0,.53),.38,.28,.048,'ivory',-.20)
 bowl(tab,(.27,.09,.535));vase(tab,(.76,.15,.40),'ceramic',.38)
 tree(parent,(2.38,-.58,0),2.55)
 side_table(parent,(-2.60,-.87,0),.34,.62);lamp(parent,(-2.60,-.87,.66),1.15)

def lounge_chair(parent,loc,angle):
 root=empty('FURN_Leather_Lounge',loc,angle,parent)
 for x in [-.40,.40]:
  for y in [-.38,.38]:cyl('FURN_Leather_Chair_Leg',(x,y,.14),.023,.28,'brass',root,24)
 box('FURN_Leather_Chair_Base',(0,0,.36),(1.07,1.0,.26),'leather',.13,root)
 cushion(root,(0,-.08,.57),(.82,.80,.22),'leather')
 cushion(root,(0,.40,.89),(.88,.23,.66),'leather',(-.15,0,0))
 for x in [-.48,.48]:cushion(root,(x,-.02,.76),(.21,1.0,.48),'leather')
 # Fine stitched seams along the arm tops.
 for x in [-.49,.49]:tube('FURN_Leather_Piping',[(x,-.44,.985),(x,.32,.985)],.002,'oatmeal',root)
 return root
def motoring(parent):
 rug(parent,'charcoal',5.2,3.9,-2.3)
 lounge_chair(parent,(-1.08,-2.6,0),-.16);lounge_chair(parent,(1.06,-2.6,0),.16)
 side_table(parent,(0,-2.72,0),.62,.46);book(parent,(-.18,-2.75,.485),.31,.24,.032,'charcoal',.12)
 sculpture(parent,(.19,-2.62,.49),.27,'brass')
 box('FURN_Motoring_Credenza',(-.30,-.34,.51),(3.45,.53,.67),'wood',.024,parent)
 for x in [-1.70,-.72,.25,1.15]:box('FURN_Cabinet_Door',(x,-.614,.52),(.90,.045,.55),'leather',.016,parent)
 library(parent,2.30,2.8,1.05)
 for z in [.68,1.43,2.18]:
  pts=[(2.30+.23*math.cos(a),-.47,z+.23*math.sin(a)) for a in [i*2*math.pi/72 for i in range(73)]]
  tube('PROP_Collector_Steering_Wheel',pts,.025,'leather',parent,True)
  for a in [math.pi/2,7*math.pi/6,11*math.pi/6]:rod('PROP_Wheel_Bronze_Spoke',(2.30,-.47,z),(2.30+.21*math.cos(a),-.47,z+.21*math.sin(a)),.011,'brass',parent)
  o=cyl('PROP_Wheel_Centre',(2.30,-.47,z),.055,.034,'brass',parent,32);o.rotation_euler.x=math.pi/2
 tree(parent,(-2.62,-.65,0),2.25)

def library(parent,x,height=3.1,w=1.4):
 box('FURN_Library_Back',(x,.005,height/2),(w,.09,height),'wood',.008,parent)
 for xx in [x-w/2,x+w/2]:box('FURN_Library_Side',(xx,-.23,height/2),(.05,.53,height),'wood',.008,parent)
 for z in [.17,height*.30,height*.56,height*.82,height-.08]:
  box('FURN_Library_Shelf',(x,-.23,z),(w,.53,.045),'wood',.012,parent)
  box('LIGHT_Library_Recessed_Strip',(x,-.43,z-.03),(w-.12,.016,.012),'led',.004,parent)
 return height
def dining_chair(parent,loc,angle):
 root=empty('FURN_Boucle_Dining_Chair',loc,angle,parent)
 for x in [-.23,.23]:
  for y in [-.23,.23]:
   rod('FURN_Tapered_Chair_Leg',(x*1.13,y*1.1,.02),(x,y,.46),.027,'wood',root)
 cushion(root,(0,-.035,.50),(.63,.62,.16),'ivory')
 verts=[];faces=[];n=36
 for z,r in [(.54,.32),(.91,.33),(1.01,.31)]:
  for i in range(n+1):
   a=math.radians(15+150*i/n);verts.append((r*math.cos(a),r*math.sin(a)-.04,z))
 for j in range(2):
  for i in range(n):k=j*(n+1)+i;faces.append((k,k+1,k+n+2,k+n+1))
 o=mesh('FURN_Curved_Boucle_Back',verts,faces,'ivory',root)
 sol=o.modifiers.new('Upholstery_thickness','SOLIDIFY');sol.thickness=.095
 be=o.modifiers.new('Soft_upholstery_edges','BEVEL');be.width=.045;be.segments=5
 for p in o.data.polygons:p.use_smooth=True
def dining(parent):
 rug(parent,'oatmeal',5.2,4.5,-2.50)
 for x in [-.90,.9]:
  cyl('FURN_Fluted_Table_Core',(x,-2.47,.38),.28,.75,'wood',parent)
  for i in range(28):a=2*math.pi*i/28;cyl('FURN_Fluted_Table_Reed',(x+.28*math.cos(a),-2.47+.28*math.sin(a),.38),.021,.73,'wood',parent,12,.004)
 box('FURN_Oval_Dining_Table',(0,-2.47,.82),(3.10,1.25,.10),'wood',.32,parent)
 for x in [-1.03,0,1.03]:
  dining_chair(parent,(x,-3.37,0),math.pi);dining_chair(parent,(x,-1.54,0),0)
 bowl(parent,(.07,-2.48,.88),.27);vase(parent,(.59,-2.37,.88),'clay',.65)
 for x in [-.94,.98]:
  cyl('PROP_Stone_Place_Setting',(x,-2.65,.881),.175,.009,'ceramic',parent)
  rod('PROP_Bronze_Cutlery',(x+.21,-2.80,.891),(x+.21,-2.53,.891),.005,'brass',parent)
 box('FURN_Dining_Sideboard',(0,-.36,.52),(3.65,.60,.80),'wood',.028,parent)
 for x in [-1.20,0,1.20]:box('FURN_Sideboard_Door',(x,-.676,.53),(1.18,.04,.69),'wood',.008,parent)
 lamp(parent,(-1.40,-.34,.94),.56);vase(parent,(1.38,-.35,.94),'ceramic',.73)
 book(parent,(.94,-.35,.94),.38,.24,.040,'charcoal',.12)

def blanket(parent,y,width,length,z,ma):
 verts=[];faces=[];nx,ny=48,48
 for j in range(ny+1):
  v=j/ny;yy=y-length/2+v*length
  for i in range(nx+1):
   u=i/nx;xx=(u-.5)*width;edge=max(0,(abs(u-.5)-.39)/.11)
   zz=z-.34*edge**1.5+.018*math.sin(u*34+v*8)+.012*math.cos(v*41-u*9)+.027*math.sin(v*math.pi)
   if v<.05:zz-=.20*(1-v/.05)
   verts.append((xx,yy,zz))
 for j in range(ny):
  for i in range(nx):k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
 o=mesh('TEXTILE_Draped_Linen_Duvet',verts,faces,ma,parent)
 for p in o.data.polygons:p.use_smooth=True
 sol=o.modifiers.new('Blanket_edge_thickness','SOLIDIFY');sol.thickness=.014
 return o
def bed(parent,kid=False):
 w=1.25 if kid else 2.2;ma='rose' if kid else 'oatmeal';y=-1.88
 box('FURN_Bed_Walnut_Plinth',(0,y,.12),(w+.06,2.36,.20),'wood',.10,parent)
 box('FURN_Upholstered_Bed_Base',(0,y,.30),(w+.13,2.40,.34),ma,.12,parent)
 box('TEXTILE_Mattress',(0,y,.56),(w,2.25,.28),'ivory',.13,parent)
 box('FURN_Cushioned_Headboard',(0,-.59,.77),(w+.27,.20,1.28),ma,.16,parent)
 blanket(parent,-2.14,w+.24,1.80,.73,'rose' if kid else 'linen')
 for x in ([0] if kid else [-.51,.51]):
  cushion(parent,(x,-.91,.84),(.89 if not kid else .93,.62,.24),'ivory',(.16,0,0))
  cushion(parent,(x,-1.01,1.00),(.67,.20,.40),ma,(-.25,.04,.08))
 # Folded throw across the foot of the bed.
 throw=blanket(parent,-2.70,w+.18,.40,.77,'ivory' if kid else 'charcoal')
 for x in [-w/2-.45,w/2+.45]:
  box('FURN_Bedside_Cabinet',(x,-.84,.36),(.62,.62,.59),'wood',.026,parent)
  box('FURN_Bedside_Drawer',(x,-1.162,.41),(.55,.026,.23),'wood',.009,parent)
  rod('FURN_Bedside_Bronze_Pull',(x-.07,-1.186,.41),(x+.07,-1.186,.41),.006,'brass',parent)
  if not kid:lamp(parent,(x,-.84,.67),.53)
  else:book(parent,(x,-.83,.67),.28,.22,.04,'rose',.08)
def teddy(parent,loc):
 root=empty('PROP_Childhood_Teddy',loc,0,parent)
 sphere('PROP_Teddy_Body',(0,0,.17),(.115,.09,.16),'oatmeal',root);sphere('PROP_Teddy_Head',(0,-.02,.36),(.115,.10,.105),'oatmeal',root)
 for x in [-.09,.09]:
  sphere('PROP_Teddy_Ear',(x,-.01,.44),(.041,.025,.044),'rose',root)
  sphere('PROP_Teddy_Foot',(x,-.045,.06),(.06,.07,.05),'oatmeal',root)
  sphere('PROP_Teddy_Eye',(x*.39,-.11,.38),(.009,.006,.009),'black',root)
 sphere('PROP_Teddy_Muzzle',(0,-.11,.34),(.048,.025,.031),'ivory',root)
 sphere('PROP_Teddy_Nose',(0,-.136,.351),(.013,.006,.008),'black',root)
def childhood(parent):
 rug(parent,'rose',5.0,4.4,-2.5);bed(parent,True)
 for x in [-2.45,-1.32,0,1.32,2.45]:
  for xx in [x-.48,x+.48]:box('DETAIL_Rose_Wall_Moulding',(xx,-.13,.57),(.024,.035,.90),'wall_rose',.004,parent)
  for z in [.12,1.02]:box('DETAIL_Rose_Wall_Moulding',(x,-.13,z),(.98,.035,.024),'wall_rose',.004,parent)
 box('DETAIL_Rose_Picture_Rail',(0,-.15,1.09),(6.2,.09,.04),'wall_rose',.006,parent)
 for z in [1.21,1.92,2.63]:
  box('FURN_Childhood_Floating_Shelf',(2.06,-.30,z),(1.30,.50,.055),'wood',.018,parent)
 teddy(parent,(1.83,-.30,1.25));vase(parent,(2.35,-.27,1.95),'ceramic',.54)
 book(parent,(1.87,-.28,2.67),.35,.22,.065,'rose')
 side_table(parent,(1.60,-3.45,0),.49,.38);teddy(parent,(1.60,-3.46,.40))
 lamp(parent,(-1.16,-.84,.67),.45)

def study(parent):
 rug(parent,'charcoal',5.1,4.0,-2.4)
 box('FURN_Walnut_Executive_Desk',(-.28,-2.28,.80),(2.7,.94,.08),'wood',.045,parent)
 for x in [-1.46,.9]:
  for y in [-2.65,-1.94]:box('FURN_Desk_Bronze_Leg',(x,y,.40),(.035,.035,.80),'brass',.008,parent)
 box('FURN_Desk_Drawer',(-.85,-2.26,.66),(.90,.80,.19),'wood',.020,parent)
 rod('FURN_Desk_Pull',(-1.00,-2.68,.66),(-.70,-2.68,.66),.007,'brass',parent)
 box('PROP_Leather_Desk_Pad',(-.10,-2.35,.847),(1.10,.54,.007),'leather',.04,parent)
 # An open laptop adds a readable, domestic scale cue.
 lap=empty('PROP_Open_Laptop',(-.12,-2.31,.86),0,parent)
 box('PROP_Laptop_Base',(0,0,0),(.52,.33,.018),'black',.012,lap)
 screen=box('PROP_Laptop_Screen',(0,.15,.165),(.52,.014,.31),'black',.012,lap);screen.rotation_euler.x=-.18
 panel=box('PROP_Laptop_Display',(0,.136,.165),(.48,.004,.275),'charcoal',.006,lap);panel.rotation_euler.x=-.18
 chair=lounge_chair(parent,(-.18,-1.26,0),math.pi);chair.scale=(.68,.70,.89)
 library(parent,2.08,3.20,1.47)
 for i in range(8):
  b=book(parent,(1.57+i*.068,-.24,2.70),.32,.23,.055,['ivory','charcoal','oatmeal'][i%3]);b.rotation_euler.y=math.pi/2
 sculpture(parent,(2.08,-.25,1.83),.28,'brass');vase(parent,(2.42,-.24,1.17),'clay',.72)
 book(parent,(1.84,-.25,.21),.36,.24,.065,'charcoal',.09);book(parent,(1.85,-.25,.28),.35,.24,.045,'ivory',-.06)
 cyl('LUMINAIRE_Desk_Lamp_Base',(-1.26,-2.23,.86),.13,.018,'black',parent)
 rod('LUMINAIRE_Desk_Lamp_Stem',(-1.26,-2.23,.87),(-1.26,-2.23,1.22),.014,'brass',parent)
 rod('LUMINAIRE_Desk_Lamp_Arm',(-1.26,-2.23,1.22),(-1.02,-2.23,1.39),.014,'brass',parent)
 lathe('LUMINAIRE_Desk_Lamp_Shade',(-1.02,-2.23,1.23),[(.14,0),(.09,.12),(.05,.16)],'black',parent)
 light('LIGHT_Desk_Practical',(-1.02,-2.23,1.25),(-1.02,-2.23,.8),8,.15,(1,.80,.59),parent,'POINT')
 book(parent,(.77,-2.22,.85),.35,.25,.04,'oatmeal',.08)

def curtain(parent,x,y,width=1.2,height=3.55):
 verts=[];faces=[];nx,ny=80,8
 for j in range(ny+1):
  z=.035+j/ny*height
  for i in range(nx+1):
   u=i/nx;verts.append((x+(u-.5)*width,y+.052*math.sin(u*math.pi*22)+.015*math.cos(j*.5),z))
 for j in range(ny):
  for i in range(nx):k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
 o=mesh('TEXTILE_Fullheight_Linen_Drapery',verts,faces,'linen',parent)
 for p in o.data.polygons:p.use_smooth=True
 return o
def anniversary(parent):
 rug(parent,'linen',5.4,4.5,-2.3);bed(parent)
 curtain(parent,-2.85,-.10,.9);curtain(parent,2.85,-.10,.9)
 tree(parent,(2.43,-1.24,0),2.20)
 book(parent,(-1.55,-.88,.69),.28,.21,.032,'charcoal')

# Shared slab, large-format stone tiles and one ceiling: no compartment roofs or side walls.
box('ARCH_Continuous_Floor_Slab',(0,1.8,-.15),(26,25.8,.28),'grout',.012,SHELL)
for ix in range(13):
 for iy in range(13):
  box('ARCH_Limestone_Slab',(-12+ix*2,-10+iy*2,-.009),(1.996,1.996,.035),'stone',.003,SHELL)
box('ARCH_Uninterrupted_Ceiling',(0,1.8,3.89),(26,25.8,.18),'ceiling',.03,SHELL)
for x in [-12.95,12.85]:box('ARCH_Perimeter',(x,1.8,1.92),(.16,25.8,3.84),'wall_chalk',.02,SHELL)
for y in [-11.03,14.60]:box('ARCH_Perimeter',(0,y,1.92),(26,.16,3.84),'wall_chalk',.02,SHELL)
# Continuous perimeter clerestory creates a generous sense of daylight.
for x in [-12.84,12.74]:
 box('ARCH_Clerestory_Diffuser',(x,1.8,3.38),(.012,24.5,.50),'whiteled',.001,SHELL)
 for y in range(-10,15,2):box('ARCH_Clerestory_Mullion',(x,y,3.38),(.025,.035,.52),'brass',.003,SHELL)
# Remove the screened central block. Rear feature surfaces remain the support for the art.
wall_names=['sand','graphite','chalk','rose','graphite','sand']
art_heights=[2.35,2.32,2.28,2.16,2.23,2.43]
art_scales=[.91,.92,.88,1.0,1.0,.86]
builders=[living,motoring,dining,childhood,study,anniversary]
light_meta=[]
for s,wall,z,scale,build in zip(rooms,wall_names,art_heights,art_scales,builders):
 root=bpy.data.objects['ROOM_'+s['id']];root['spatial_type']='Open setting in a continuous gallery'
 root['divider_walls']=False;w=s['w']
 box('ARCH_Artwork_Backdrop_'+s['id'],(0,.09,1.9),(w,.19,3.8),'wall_'+wall,.02,root)
 box('ARCH_Continuous_Bronze_Skirting_'+s['id'],(0,-.015,.046),(w,.025,.075),'brass',.006,root)
 # Cove profiles run along the backing surface, never across the opening.
 box('LIGHT_Wall_Cove_'+s['id'],(0,-.11,3.71),(w,.07,.025),'led',.005,root)
 # Slim walnut accent occupies the back plane, preserving cross-setting sightlines.
 for j in range(10):box('DETAIL_Walnut_Fluting',(-w/2+.14+j*.055,-.047,1.82),(.033,.068,3.60),'wood',.009,root)
 old=Vector(s['art'][:3]);new=Vector((old.x,old.y,z))
 for o in list(root.children):
  if o.name=='ART_'+s['id'] or o.name.startswith('FRAME_'+s['id']+'_'):
   delta=o.location-old;o.location=new+Vector((delta.x*scale,delta.y,delta.z*scale));o.scale.x*=scale;o.scale.z*=scale
   if o.name.startswith('FRAME_'):o.data.materials.clear();o.data.materials.append(M['black'] if 'SHADOW' not in o.name else M['grout'])
   else:
    oldmat=o.data.materials[0];im=next(n.image for n in oldmat.node_tree.nodes if n.type=='TEX_IMAGE')
    a=mat('Fine_Art_'+s['id'],rough=.52,coat=.1);t=a.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;p=a.node_tree.nodes.get('Principled BSDF')
    a.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);a.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.035
    o.data.materials.clear();o.data.materials.append(a)
 s['art']=[new.x,new.y,new.z,s['art'][3]*scale,s['art'][4]*scale]
 build(root)
 # Broad key, cooler fill and warm artwork wash with actual soft shadowing.
 light('LIGHT_Key_'+s['id'],(-1.75,-4.25,3.60),(0,-.65,1.1),550,3.0,(1,.88,.72),root)
 light('LIGHT_Fill_'+s['id'],(2.6,-2.6,3.50),(0,-1.1,1.0),180,2.2,(.81,.89,1),root)
 for x in [-w*.24,w*.24]:
  cyl('LUMINAIRE_Track_Housing',(x,-1.25,3.66),.067,.16,'black',root,32)
  cyl('LUMINAIRE_Track_Diffuser',(x,-1.25,3.57),.045,.008,'led',root,32)
  light('LIGHT_Artwork_Wash_'+s['id'],(x,-1.22,3.57),(x*.8,-.12,1.90),85,.1,(1,.79,.52),root,'SPOT')
 root.update_tag();scene.view_layers.update()
 cam=bpy.data.objects[s['camera']];cam.location=(0,-7.9,1.65);cam.rotation_euler=(Vector((0,-.3,1.62))-cam.location).to_track_quat('-Z','Y').to_euler()
 s['wall']=wall;s['continuous']=True
 print('V05_SETTING_READY',s['id'],flush=True)

# Sculptural accents bridge the settings; each is below eye level or outside the route.
for name,loc in [('West',(-10.18,-1.35,0)),('South',(1.80,-6.0,0)),('East',(9.33,6.20,0))]:
 pl=empty('TRANSITION_'+name,loc,0,SHELL)
 cyl('TRANSITION_Travertine_Plinth',(0,0,.42),.33,.84,'stone',pl)
 sculpture(pl,(0,0,.85),.47,'brass' if name!='South' else 'ceramic')
# A single bronze rail and narrow light ribbon follow the smooth camera promenade.
route=meta['camera_samples']
pts=[(p['position_blender'][0],p['position_blender'][1],3.73) for p in route]
tube('ARCH_Continuous_Ceiling_Rail',pts,.038,'black',SHELL)
tube('LIGHT_Continuous_Promenade_Ribbon',[(x,y,z-.044) for x,y,z in pts],.014,'led',SHELL)
for k in range(0,len(pts),8):
 x,y,z=pts[k];rod('ARCH_Rail_Suspension',(x,y,z+.03),(x,y,3.80),.006,'brass',SHELL)
# Inlaid bronze dots guide the walk without an aisle boundary.
for p in route[::4]:
 x,y,_=p['position_blender'];cyl('DETAIL_Wayfinding_Inlay',(x,y,.013),.022,.003,'brass',SHELL,24,.001)

for o in bpy.data.objects:
 if o.type=='CAMERA':o.data.lens=34.85;o.data.sensor_fit='VERTICAL';o.data.sensor_height=24;o.data.clip_start=.05
scene.camera=bpy.data.objects['CAM_TOUR'];scene.frame_set(1)
scene.world=bpy.data.worlds.new('Gallery_Soft_Ambient');scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.69,.76,.86,1);bg.inputs['Strength'].default_value=.18
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=128;scene.cycles.use_denoising=True;scene.cycles.denoising_use_gpu=False
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.025;scene.cycles.max_bounces=7;scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=4
scene.cycles.sample_clamp_indirect=3;scene.cycles.use_light_tree=True
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.65
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene['quality_workflow']='Physical materials, modeled details, Cycles global illumination, CPU OpenImageDenoise'
scene['continuous_layout']='No side returns, portal piers, room lintels or central obstruction; shared ceiling and floor'
scene['revision']='v05 continuous gallery'
meta.update(revision='v05',vertical_fov_radians=2*math.atan(12/34.85),rendering='PBR, actual lights and soft shadows',transition='Open cross-setting views; no side division walls')
meta['construction']['ceiling_height']=3.8;meta['construction']['central_core']=False
for l in [o for o in scene.objects if o.type=='LIGHT']:
 l.update_tag()
scene.view_layers.update()
for l in [o for o in scene.objects if o.type=='LIGHT']:
 direction=l.matrix_world.to_quaternion()@Vector((0,0,-1));p=l.matrix_world.translation
 light_meta.append(dict(name=l.name,type=l.data.type,position=list(p),target=list(p+direction*3),energy=l.data.energy,color=list(l.data.color),size=getattr(l.data,'size',.15)))
meta['lights_blender']=light_meta
(OUT/'gallery-structure.json').write_text(json.dumps(meta,indent=2))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all()
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
print('V05_SOURCE_SAVED',len(scene.objects),flush=True)
# Resolve modifiers and join static geometry by setting and material for web delivery.
bpy.ops.object.select_all(action='DESELECT')
convertible=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
for o in convertible:o.select_set(True)
bpy.context.view_layer.objects.active=convertible[0]
bpy.ops.object.convert(target='MESH')
print('V05_MODIFIERS_RESOLVED',flush=True)
groups={}
for o in list(scene.objects):
 if o.type!='MESH' or o.name.startswith('ART_'):continue
 p=o
 while p.parent and not p.name.startswith('ROOM_') and p.parent!=SHELL:p=p.parent
 group=p.name if p.name.startswith('ROOM_') else 'ARCHITECTURE'
 ma=o.data.materials[0].name if o.data.materials else 'None'
 # Keep roofs separate for plan / overview review.
 key=(group,ma,'CEILING' if 'Ceiling' in o.name or 'ceiling' in o.name else 'STATIC')
 groups.setdefault(key,[]).append(o)
for (group,ma,tag),items in groups.items():
 if len(items)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in items:o.select_set(True)
 bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name=tag+'_'+group+'_'+ma
print('V05_WEB_GROUPS_JOINED',len(groups),flush=True)
bpy.ops.object.select_all(action='SELECT')
# Area light dimensions are serialized in metadata for the web viewer; punctual lights travel in GLB.
bpy.ops.export_scene.gltf(filepath=str(OUT/'framers_gallery_v05.glb'),export_format='GLB',export_cameras=True,export_lights=True,export_extras=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_step=15,export_image_format='AUTO',export_jpeg_quality=92,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_apply=True)
print('V05_EXPORT_READY', (OUT/'framers_gallery_v05.glb').stat().st_size,flush=True)
