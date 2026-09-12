"""Build a connected first-floor gallery and a renderer-independent GLB."""
import bpy
import math
import json
import random
import bmesh
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(r'C:\Personal_Projects\Framers')
OUT=ROOT/'gallery_v04'
TEX=OUT/'textures'
CACHE=OUT/'components'
CACHE.mkdir(parents=True,exist_ok=True)
random.seed(94)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.name='FRAMERS_FIRST_FLOOR_V04'
scene.unit_settings.system='METRIC'
scene.render.fps=30
scene.render.resolution_x=1280;scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.world=bpy.data.worlds.new('Warm environment')
scene.world.color=(.05,.04,.03)

def linear(c):
    return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

def rgba(color):
    return tuple(linear(c/255) for c in color)+(1,)

def material(name,image=None):
    m=bpy.data.materials.get(name)
    if m:return m
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=m.node_tree.nodes;n.clear()
    out=n.new('ShaderNodeOutputMaterial')
    if image:
        node=n.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(image),check_existing=True)
    else:
        node=n.new('ShaderNodeVertexColor');node.layer_name='BakedColor'
    m.node_tree.links.new(node.outputs['Color'],out.inputs['Surface'])
    return m

VERTEX=material('MAT_Baked_Vertex_Shading')
MATS={n:material('MAT_'+n,TEX/(n+'.jpg')) for n in ['wall_warm','wall_graphite','wall_taupe','wall_rose','stone_floor','rug_sand','rug_rose','rug_graphite','walnut']}

def link(o,parent=None):
    scene.collection.objects.link(o)
    if parent:o.parent=parent
    return o

def empty(name,loc=(0,0,0),rot=0,parent=None):
    o=link(bpy.data.objects.new(name,None),parent);o.location=loc;o.rotation_euler.z=rot
    return o

SHELL=empty('00_ARCHITECTURE')
CAMERAS=empty('90_CAMERAS')

def colorize(o,color,shade=True):
    if o.type!='MESH':return
    attr=o.data.color_attributes.get('BakedColor') or o.data.color_attributes.new(name='BakedColor',type='FLOAT_COLOR',domain='CORNER')
    o.data.color_attributes.active_color=attr
    for p in o.data.polygons:
        light=(.77+.21*max(0,p.normal.z)+.12*max(0,-p.normal.y)-.22*max(0,-p.normal.z)) if shade else 1
        for li in p.loop_indices:
            attr.data[li].color=rgba(tuple(min(255,c*light) for c in color))

def cube(name,loc,size,color=(115,96,74),mat=None,bevel=0,parent=None):
    x,y,z=(s/2 for s in size)
    verts=[(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),(x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)]
    faces=[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=link(bpy.data.objects.new(name,mesh),parent);o.location=loc
    o.data.materials.append(mat or VERTEX)
    uv=mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        for li,v in zip(p.loop_indices,[(0,0),(0,1),(1,1),(1,0)]):uv.data[li].uv=v
    colorize(o,color)
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    return o

def plane(name,loc,width,height,mat,parent=None,floor=False,uvs=None):
    verts=[(-width/2,0,-height/2),(width/2,0,-height/2),(width/2,0,height/2),(-width/2,0,height/2)]
    if floor:verts=[(-width/2,-height/2,0),(width/2,-height/2,0),(width/2,height/2,0),(-width/2,height/2,0)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update()
    o=link(bpy.data.objects.new(name,mesh),parent);o.location=loc;o.data.materials.append(mat)
    uv=mesh.uv_layers.new(name='UVMap')
    for li,v in zip(mesh.polygons[0].loop_indices,uvs or [(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=v
    return o

def cylinder(name,loc,radius,depth,color=(40,35,29),parent=None,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.parent=parent;o.data.materials.append(VERTEX);colorize(o,color)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o

def sphere(name,loc,size,color,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=size;o.parent=parent;o.data.materials.append(VERTEX)
    colorize(o,color)
    for p in o.data.polygons:p.use_smooth=True
    return o

def rod(name,a,b,r,color,parent):
    a,b=Vector(a),Vector(b)
    o=cylinder(name,(a+b)/2,r,(b-a).length,color,parent,12)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def frame(name,center,w,h,ref,quad,parent):
    x,y,z=center
    path=ROOT/f'ChatGPT Image Aug 24, 2026, 04_58_05 PM ({ref}).png'
    mat=material('ART_'+name,path)
    # Map the original artwork quadrilateral directly, without baking an interior screenshot onto a wall.
    iw=ih=1254
    uv=[(u/iw,1-v/ih) for u,v in [quad[3],quad[2],quad[1],quad[0]]]
    art=plane('ART_'+name,(x,y-.036,z),w,h,mat,parent,uvs=uv)
    art['reference_image']=path.name;art['replaceable_artwork']=True
    for tag,loc,dim in [
        ('TOP',(x,y,z+h/2+.03),(w+.12,.12,.06)),
        ('BOTTOM',(x,y,z-h/2-.03),(w+.12,.12,.06)),
        ('LEFT',(x-w/2-.03,y,z),(.06,.12,h)),
        ('RIGHT',(x+w/2+.03,y,z),(.06,.12,h))]:
        cube('FRAME_'+name+'_'+tag,loc,dim,(25,23,19),bevel=.008,parent=parent)
    cube('FRAME_'+name+'_SHADOW',(x,y+.03,z-.03),(w+.18,.02,h+.17),(36,30,24),parent=parent)
    return art

def camera(name,loc,target,parent=None):
    data=bpy.data.cameras.new(name);data.type='PERSP';data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=41.4814758
    data.clip_start=.05;data.clip_end=150
    o=link(bpy.data.objects.new(name,data),parent);o.location=loc
    o.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    return o

def source_set(label,source,parent,height=2.85,back=-.12):
    cache=CACHE/(label+'.glb')
    before=set(bpy.data.objects);before_images=set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=str(cache if cache.exists() else Path(r'C:\Users\Sachin\Downloads')/(source+'.glb')))
    imported=[o for o in bpy.data.objects if o not in before]
    meshes=[o for o in imported if o.type=='MESH']
    if not cache.exists():
        for o in meshes:
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
            original=sum(len(p.vertices)-2 for p in o.data.polygons)
            mod=o.modifiers.new('Web mesh reduction','DECIMATE');mod.ratio=min(1,42000/original);mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
            o['original_triangle_count']=original
            for m in o.data.materials:
                bsdf=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
                img_node=bsdf.inputs['Base Color'].links[0].from_node
                im=img_node.image
                if max(im.size)>2048:im.scale(2048,2048)
                im.name='TEX_FURNITURE_'+label
                im.filepath_raw=str(TEX/('furniture_'+label+'.jpg'));im.file_format='JPEG';im.save()
                nodes=m.node_tree.nodes;nodes.clear()
                out=nodes.new('ShaderNodeOutputMaterial');node=nodes.new('ShaderNodeTexImage');node.image=im
                m.node_tree.links.new(node.outputs['Color'],out.inputs['Surface']);m.name='MAT_FURNITURE_'+label
        bpy.ops.object.select_all(action='DESELECT')
        for o in imported:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(cache),export_format='GLB',use_selection=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=88)
    for index,o in enumerate(meshes):
        # Cache imports preserve the normalized source orientation.
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        low=Vector([min(v.co[i] for v in o.data.vertices) for i in range(3)])
        high=Vector([max(v.co[i] for v in o.data.vertices) for i in range(3)])
        scale=height/(high.z-low.z)
        for v in o.data.vertices:v.co=(v.co-Vector(((low.x+high.x)/2,high.y,low.z)))*scale
        # Remove the original hero print from the supplied all-in-one mesh.
        # Regions were measured in furniture-components.json at a 2.86 m source height.
        removal={
            '01_LIVING':(-1.23,1.46,-.115,.02,1.10,2.90),
            '03_TOGETHER':(-.78,1.26,-.285,-.235,1.22,2.90),
            '04_CHILDHOOD':(-.58,.65,-.15,-.04,.90,2.55),
            '06_ANNIVERSARY':(-.81,.67,-.135,-.06,.85,2.44),
        }.get(label)
        if removal:
            factor=height/2.86;bb=[v*factor for v in removal]
            bm=bmesh.new();bm.from_mesh(o.data)
            rejected=[v for v in bm.verts if bb[0]<=v.co.x<=bb[1] and bb[2]<=v.co.y<=bb[3] and bb[4]<=v.co.z<=bb[5]]
            bmesh.ops.delete(bm,geom=rejected,context='VERTS');bm.to_mesh(o.data);bm.free()
            o['removed_duplicate_print_vertices']=len(rejected)
        # Shorten the exaggerated depth in the generated living-room furniture.
        if label=='01_LIVING':
            for v in o.data.vertices:v.co.y*=.70
        o.location=(0,back,.015);o.parent=parent;o.name='FURNITURE_'+label
        o['source_file']=source+'.glb';o['reference_room']=label
        o.data.update()
    for o in imported:
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    # Remove high-resolution normal and roughness maps that are not used by the baked web material.
    for im in list(bpy.data.images):
        if im not in before_images and im.users==0:bpy.data.images.remove(im)
    return meshes

def book_stack(x,y,z,parent):
    for i in range(3):
        o=cube('ACC_Book',(x,y,z+i*.044),(.31,.23,.038),[(90,74,54),(37,34,29),(176,158,126)][i],bevel=.007,parent=parent)
        o.rotation_euler.z=(i-1)*.12

def plant(x,y,z,parent,height=1.7):
    cylinder('ACC_Plant_Pot',(x,y,z+.22),.18,.44,(38,36,27),parent)
    for i in range(12):
        ang=i*2.399
        h=height*(.48+.48*random.random());reach=.32+.18*random.random()
        end=Vector((x+math.cos(ang)*reach,y+math.sin(ang)*reach,z+h))
        rod('ACC_Stem',(x,y,z+.25),end,.014,(58,67,36),parent)
        leaf=sphere('ACC_Leaf',end,(.10,.035,.29),(43+random.randrange(16),67+random.randrange(19),34),parent)
        leaf.rotation_euler=(end-Vector((x,y,z+.4))).to_track_quat('Z','Y').to_euler()

def leather_chair(x,y,angle,parent):
    root=empty('ACC_Leather_Chair',(x,y,0),angle,parent)
    for xx in [-.43,.43]:
        for yy in [-.42,.42]:cube('ACC_Chair_Leg',(xx,yy,.12),(.04,.04,.24),(22,21,19),parent=root)
    cube('ACC_Chair_Base',(0,0,.33),(1.04,1.04,.24),(41,34,27),bevel=.06,parent=root)
    cube('ACC_Chair_Seat',(0,-.06,.49),(.80,.83,.20),(60,47,35),bevel=.095,parent=root)
    back=cube('ACC_Chair_Back',(0,.38,.82),(.84,.20,.61),(50,40,31),bevel=.075,parent=root);back.rotation_euler.x=-.12
    for xx in [-.47,.47]:cube('ACC_Chair_Arm',(xx,-.015,.69),(.18,1.04,.46),(45,37,29),bevel=.075,parent=root)
    for xx in [-.21,0,.21]:cube('ACC_Leather_Stitch',(xx,.264,.83),(.008,.009,.49),(26,23,19),parent=root)

def wheel(x,y,z,r,parent):
    bpy.ops.mesh.primitive_torus_add(major_segments=36,minor_segments=8,location=(x,y,z),major_radius=r,minor_radius=.018)
    o=bpy.context.object;o.name='ACC_Motoring_Wheel';o.rotation_euler.x=math.pi/2;o.parent=parent;o.data.materials.append(VERTEX);colorize(o,(132,100,57))
    for a in [math.pi/2,math.pi*7/6,math.pi*11/6]:rod('ACC_Wheel_Spoke',(x,y,z),(x+math.cos(a)*r*.94,y,z+math.sin(a)*r*.94),.018,(148,116,74),parent)
    hub=cylinder('ACC_Wheel_Hub',(x,y,z),.07,.045,(26,25,22),parent);hub.rotation_euler.x=math.pi/2

def motoring_set(parent):
    leather_chair(-1.18,-2.25,-.16,parent);leather_chair(1.12,-2.25,.16,parent)
    table=cylinder('ACC_Motoring_Coffee_Table',(0,-2.28,.38),.78,.065,(65,46,29),parent,48);table.scale.y=.70
    for x in [-.51,.51]:
        for y in [-2.52,-2.08]:cylinder('ACC_Table_Leg',(x,y,.19),.023,.38,(25,22,17),parent,12)
    # A small display car with separate body, glazing and wheels.
    car=empty('ACC_Collector_Model_Car',(0,-2.3,.45),.12,parent)
    cube('ACC_Car_Body',(0,0,.065),(.63,.25,.10),(29,29,27),bevel=.045,parent=car)
    cube('ACC_Car_Glazing',(.02,0,.14),(.32,.20,.09),(61,62,56),bevel=.04,parent=car)
    for x in [-.19,.19]:
        for y in [-.13,.13]:
            o=cylinder('ACC_Car_Wheel',(x,y,.04),.064,.026,(19,18,16),car,16);o.rotation_euler.x=math.pi/2
    plant(-2.35,-.65,0,parent,2.25)
    cube('ACC_Motoring_Library',(2.27,-.15,1.7),(1.1,.36,3.32),mat=MATS['walnut'],parent=parent)
    for z in [.33,1.15,1.97,2.79]:
        cube('ACC_Motoring_Library_Shelf',(2.27,-.42,z),(1.03,.34,.045),(52,35,22),parent=parent)
        cube('ACC_Motoring_Library_LED',(2.27,-.585,z+.04),(.92,.015,.018),(241,198,132),parent=parent)
    for z in [.75,1.57,2.39]:wheel(2.27,-.5,z,.27,parent)

def study_set(parent):
    # Furniture has standard physical dimensions; the old generated study set
    # used its tallest picture to normalize an elevated, oversized desk.
    cube('ACC_Study_Desk_Top',(-.25,-2.15,.77),(2.65,.92,.075),mat=MATS['walnut'],bevel=.014,parent=parent)
    for x in [-1.46,.96]:
        for y in [-2.48,-1.82]:cube('ACC_Study_Desk_Leg',(x,y,.38),(.07,.07,.76),(57,39,25),bevel=.006,parent=parent)
    cube('ACC_Study_Desk_Apron',(-.25,-2.12,.63),(2.50,.055,.22),mat=MATS['walnut'],parent=parent)
    cube('ACC_Study_Drawer',(-.85,-2.19,.65),(.80,.71,.15),mat=MATS['walnut'],bevel=.01,parent=parent)
    cube('ACC_Study_Drawer_Handle',(-.85,-2.558,.66),(.20,.035,.018),(159,124,78),bevel=.005,parent=parent)
    chair=empty('ACC_Study_Office_Chair',(-.20,-1.12,0),0,parent)
    cylinder('ACC_Study_Chair_Column',(0,0,.28),.04,.43,(43,37,29),chair)
    for i in range(5):
        a=2*math.pi*i/5
        end=(math.cos(a)*.36,math.sin(a)*.36,.065)
        rod('ACC_Study_Chair_Spider',(0,0,.19),end,.024,(27,25,22),chair)
        sphere('ACC_Study_Chair_Caster',end,(.045,.055,.045),(20,20,18),chair)
    cube('ACC_Study_Chair_Seat',(0,0,.48),(.69,.62,.15),(93,59,34),bevel=.07,parent=chair)
    back=cube('ACC_Study_Chair_Back',(0,.23,.90),(.70,.18,.76),(92,57,32),bevel=.055,parent=chair);back.rotation_euler.x=-.13
    for x in [-.36,.36]:
        rod('ACC_Study_Arm_Support',(x,0,.49),(x,0,.73),.018,(39,28,20),chair)
        cube('ACC_Study_Arm',(x,-.02,.74),(.07,.49,.045),(85,52,29),bevel=.018,parent=chair)
    # Built-in walnut library with recessed shelves and warm linear lights.
    cube('ACC_Study_Library_Back',(2.10,.015,1.67),(1.5,.12,3.30),mat=MATS['walnut'],parent=parent)
    for x in [1.34,2.86]:cube('ACC_Study_Library_Side',(x,-.19,1.67),(.075,.55,3.34),(61,39,23),parent=parent)
    for z in [.17,.91,1.65,2.39,3.13]:
        cube('ACC_Study_Shelf',(2.10,-.19,z),(1.49,.55,.065),mat=MATS['walnut'],parent=parent)
        cube('ACC_Study_Shelf_LED',(2.10,-.447,z-.026),(1.33,.018,.012),(241,193,119),parent=parent)
    for i in range(9):
        x=1.49+i*.065
        cube('ACC_Library_Book',(x,-.21,2.43+(.25+i%3*.04)/2),(.048,.22,.25+i%3*.04),[(29,31,25),(49,44,33),(100,76,45)][i%3],bevel=.003,parent=parent)
    book_stack(2.48,-.23,2.44,parent);book_stack(2.32,-.20,.20,parent)
    sphere('ACC_Library_Globe',(2.12,-.25,1.97),(.22,.22,.22),(168,157,124),parent)
    rod('ACC_Globe_Axis',(2.03,-.25,1.73),(2.21,-.25,2.22),.009,(167,124,67),parent)
    cylinder('ACC_Globe_Base',(2.12,-.25,1.72),.12,.035,(46,33,22),parent)
    # Black adjustable desk lamp, laptop and a personal desk picture.
    cylinder('ACC_Study_Lamp_Base',(-1.10,-2.1,.83),.14,.025,(24,24,20),parent)
    rod('ACC_Study_Lamp_Arm',(-1.1,-2.1,.85),(-1.1,-2.1,1.23),.014,(26,25,21),parent)
    rod('ACC_Study_Lamp_Upper',(-1.1,-2.1,1.23),(-.90,-2.1,1.37),.013,(26,25,21),parent)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.115,radius2=.052,depth=.16,location=(-.87,-2.1,1.30))
    lamp=bpy.context.object;lamp.name='ACC_Study_Lamp_Shade';lamp.parent=parent;lamp.rotation_euler.y=-.35;lamp.data.materials.append(VERTEX);colorize(lamp,(25,25,22))
    cylinder('ACC_Study_Lamp_Diffuser',(-.84,-2.1,1.224),.097,.008,(241,207,151),parent)
    cube('ACC_Study_Laptop',(-.12,-2.27,.825),(.53,.34,.020),(27,28,24),bevel=.01,parent=parent)
    cube('ACC_Study_Notebook',(.68,-2.12,.835),(.31,.24,.025),(65,55,37),bevel=.005,parent=parent)
    frame('Study_Desk_Print',(-.70,-1.93,1.03),.20,.26,5,[(281,775),(322,773),(327,862),(280,866)],parent)
    frame('Study_Shelf_Print',(1.70,-.29,1.14),.23,.30,5,[(954,569),(1008,568),(1008,642),(957,643)],parent)
    plant(2.58,-.18,.95,parent,.57)

# The perimeter is architectural enclosure; its room fronts remain open to a continuous walk.
plane('ENV_Promenade_Floor',(0,1.8,-.016),26.0,25.8,MATS['stone_floor'],SHELL,True)
cube('ENV_Floor_Slab',(0,1.8,-.14),(26.0,25.8,.24),(57,50,40),parent=SHELL)
for name,loc,size in [
    ('WEST',(-13.0,1.8,1.74),(.20,25.8,3.48)),
    ('EAST',(12.85,1.8,1.74),(.20,25.8,3.48)),
    ('SOUTH',(-.075,-11.0,1.74),(26.05,.20,3.48)),
    ('NORTH',(-.075,14.6,1.74),(26.05,.20,3.48))]:
    cube('ENV_Outer_'+name,loc,size,(76,66,52),parent=SHELL)
cube('ENV_ROOF_Promenade',(0,1.8,3.57),(26,25.8,.18),(54,47,37),parent=SHELL)
# A screened central core gives depth at doorways, rather than a view into empty space.
cube('ENV_Central_Core',(1.2,4.5,1.70),(5.3,12.5,3.40),(80,68,51),parent=SHELL)

ZONES=[
 dict(id='01_LIVING',title='Living',ref=1,source='living',origin=(-2.8,3.54,0),angle=-math.pi/2,w=6.6,d=6.6,wall='warm',rug='sand',art=(.36,-.39,2.0,2.72,2.0),quad=[(391,235),(942,235),(942,641),(391,641)],stop=0),
 dict(id='02_MOTORING',title='Motoring',ref=2,source=None,origin=(-7.1,-.25,0),angle=0,w=6.3,d=6.4,wall='graphite',rug='graphite',art=(-.24,-.18,2.08,2.20,2.06),quad=[(341,248),(789,274),(789,680),(341,681)],stop=.20),
 dict(id='03_TOGETHER',title='Together',ref=4,source='dining',origin=(-1.15,-2.0,0),angle=0,w=5.7,d=5.8,wall='warm',rug='sand',art=(0,-.42,2.06,2.47,2.16),quad=[(365,164),(850,181),(850,603),(365,611)],stop=.40),
 dict(id='04_CHILDHOOD',title='Childhood',ref=3,source='kids',origin=(5.35,-2.0,0),angle=0,w=6.3,d=5.3,wall='rose',rug='rose',art=(.04,-.36,1.88,1.18,1.61),quad=[(369,169),(749,170),(749,682),(369,682)],stop=.55),
 dict(id='05_STUDY',title='Study',ref=5,source=None,origin=(4.15,2.35,0),angle=math.pi/2,w=6.4,d=5.7,wall='taupe',rug='graphite',art=(-.60,-.12,2.00,1.34,1.78),quad=[(306,158),(629,158),(629,596),(306,596)],stop=.82),
 dict(id='06_ANNIVERSARY',title='Anniversary',ref=6,source='bedroom',origin=(4.15,9.55,0),angle=math.pi/2,w=7.6,d=5.7,wall='warm',rug='sand',art=(0,-.43,2.11,1.90,2.12),quad=[(412,204),(838,204),(838,661),(412,661)],stop=.955),
]
for spec in ZONES:
    print('BUILDING_ROOM',spec['id'],flush=True)
    root=empty('ROOM_'+spec['id'],spec['origin'],spec['angle']);root['title']=spec['title'];root['reference_image']=spec['ref'];root['route_progress']=spec['stop']
    w,d=spec['w'],spec['d']
    cube('ENV_'+spec['id']+'_Backing',(0,.08,1.7),(w,.20,3.4),(75,63,48),parent=root)
    plane('ENV_'+spec['id']+'_Feature_Wall',(0,-.026,1.7),w,3.4,MATS['wall_'+spec['wall']],root)
    # Return walls establish genuine room volume; open doorways connect adjacent bays.
    for sign in [-1,1]:
        cube('ENV_'+spec['id']+'_Return',(sign*(w/2-.055),-1.28,1.7),(.14,2.5,3.4),(91,78,61) if spec['wall']!='rose' else (135,98,80),parent=root)
        # The outer corner of Childhood is an open turning bay; a pier here
        # intersects the source camera's curve at 61.46% progress.
        if not (spec['id']=='04_CHILDHOOD' and sign==1):
            cube('ENV_'+spec['id']+'_Portal_Pier',(sign*(w/2-.055),-d+.10,1.7),(.14,.24,3.4),(90,74,54),parent=root)
    cube('ENV_'+spec['id']+'_Opening_Lintel',(0,-d+.1,3.24),(w,.28,.32),(67,53,39),parent=root)
    cube('ENV_ROOF_'+spec['id'],(0,-d/2,3.43),(w,d,.12),(92,74,56) if spec['wall']!='graphite' else (37,34,29),parent=root)
    cube('TRIM_'+spec['id']+'_Skirting',(0,-.055,.065),(w,.055,.13),(58,44,30),parent=root)
    cube('TRIM_'+spec['id']+'_Cove',(0,-.13,3.31),(w-.24,.18,.035),(237,194,131),parent=root)
    plane('ENV_'+spec['id']+'_Rug',(0,-2.5,.012),min(w-.75,4.9),3.9,MATS['rug_'+spec['rug']],root,True)
    # Recessed spot apertures and a visible warm diffuser are modeled geometry.
    for x in [-w*.32,0,w*.32]:
        cylinder('TRIM_'+spec['id']+'_Spot_Rim',(x,-.85,3.35),.084,.03,(23,22,18),root)
        cylinder('TRIM_'+spec['id']+'_Spot_Diffuser',(x,-.85,3.328),.057,.009,(249,224,173),root)
    # Walnut fluting at the entry edge; repeated thin geometry is grouped on export.
    for i in range(11):
        cube('TRIM_'+spec['id']+'_Walnut_Slat',(-w/2+.19+i*.052,-.075,1.70),(.029,.055,3.25),mat=MATS['walnut'],parent=root)
    if spec['source']:source_set(spec['id'],spec['source'],root,2.86)
    elif spec['id']=='05_STUDY':study_set(root)
    else:motoring_set(root)
    x,y,z,aw,ah=spec['art']
    frame(spec['id'],(x,y,z),aw,ah,spec['ref'],spec['quad'],root)
    if spec['id']=='04_CHILDHOOD':
        for x in [-2.48,-1.25,0,1.25,2.48]:
            for xx in [x-.49,x+.49]:cube('TRIM_Rose_Panel_Vertical',(xx,-.10,.51),(.023,.025,.73),(155,117,95),parent=root)
            for zz in [.15,.875]:cube('TRIM_Rose_Panel_Horizontal',(x,-.10,zz),(.99,.025,.023),(155,117,95),parent=root)
        cube('TRIM_Rose_Dado',(0,-.13,.94),(w,.08,.045),(170,131,108),parent=root)
    # Room camera keeps the source vertical lens and human eye height.
    local_cam=camera('CAM_ROOM_'+spec['id'],(0,-7.9,1.7),(0,-.1,1.44),root)
    spec['camera']=local_cam.name

# Entry identity and small wayfinding plaques are modeled text, not HTML overlays.
def text_obj(name,text,loc,size,parent,rot=(math.pi/2,0,0),color=(201,183,151)):
    curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';curve.extrude=.0005
    o=link(bpy.data.objects.new(name,curve),parent);o.location=loc;o.rotation_euler=rot
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    o.data.materials.append(VERTEX);colorize(o,color,False)
    return o

for spec in ZONES:
    root=bpy.data.objects['ROOM_'+spec['id']]
    text_obj('SIGN_'+spec['id'],spec['id'][:2]+'  /  '+spec['title'].upper(),(0,-spec['d']-.047,3.17),.105,root)

# Copy the reference camera choreography, adapting its horizontal scale to domestic rooms.
route=json.loads((OUT/'analysis/camera-route.json').read_text())
tour=camera('CAM_TOUR',(0,0,1.7),(0,1,1.7),CAMERAS)
tour.rotation_mode='QUATERNION';camera_samples=[]
for s in route['samples']:
    p=s['position'];tour.location=(p[0]*.60,p[1]*.60,p[2]);tour.rotation_quaternion=Quaternion(s['quaternion_wxyz'])
    f=1+round(s['t']*2880)
    tour.keyframe_insert(data_path='location',frame=f);tour.keyframe_insert(data_path='rotation_quaternion',frame=f)
    camera_samples.append({'progress':s['t'],'time_seconds':s['t']*96,'position_blender':list(tour.location),'quaternion_blender_wxyz':list(tour.rotation_quaternion)})
tour.animation_data.action.name='Framers_FirstFloor_Tour'
tour['reference_camera']='ff_camera';tour['vertical_fov_radians']=route['vertical_fov_radians'];tour['horizontal_route_scale']=.6
scene.frame_start=1;scene.frame_end=2881;scene.frame_set(1);scene.camera=tour
scene['design_revision']='v04 — Iris-inspired residential first floor'
scene['source_references']='Six user-supplied PNGs; Iris first-floor choreography; local furnished-set GLBs'
scene['lighting']='Authored texture and vertex shading, portable KHR_materials_unlit'
scene['navigation']='Scrub Framers_FirstFloor_Tour by normalized progress; use CAM_ROOM_* for fixed room views'

metadata={'revision':'v04','units':'metres','vertical_fov_radians':route['vertical_fov_radians'],'duration_seconds':96,'coordinate_system':'Blender Z-up; exported GLB is Y-up','rooms':ZONES,'camera_samples':camera_samples,'construction':{'bounds_xy':[-13.1,-11.1,12.95,14.7],'ceiling_height':3.4}}
(OUT/'gallery-structure.json').write_text(json.dumps(metadata,indent=2))

scene.render.engine='CYCLES';scene.cycles.samples=4
scene.cycles.use_denoising=False
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'framers_gallery_v04.blend'))

# Join static architectural details within each bay for the downloadable web asset.
for root in [SHELL]+[bpy.data.objects['ROOM_'+s['id']] for s in ZONES]:
    groups={}
    for o in list(root.children):
        if o.type=='MESH' and o.name.startswith(('ENV_','TRIM_','ACC_')):
            key=(o.name.startswith('ENV_ROOF_'),o.data.materials[0].name if o.data.materials else '')
            groups.setdefault(key,[]).append(o)
    for (roof,matname),objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        objects[0].name=('ROOF_' if roof else 'ARCH_')+root.name+'_'+matname.removeprefix('MAT_')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'framers_gallery_v04.glb'),export_format='GLB',export_cameras=True,export_extras=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_step=15,export_image_format='JPEG',export_jpeg_quality=88,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_apply=True)
print('V04_BUILD_COMPLETE',json.dumps({'blend':str(OUT/'framers_gallery_v04.blend'),'glb':str(OUT/'framers_gallery_v04.glb'),'glb_bytes':(OUT/'framers_gallery_v04.glb').stat().st_size,'objects':len(scene.objects),'triangles':sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons)}),flush=True)
