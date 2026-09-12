import bpy
import math
from mathutils import Vector

ROOT = r"C:\Personal_Projects\Framers"
V01 = ROOT + r"\framers_gallery_ribbon_v01.blend"
OUT = ROOT + r"\framers_gallery_ribbon_v02_checkpoint.blend"
RENDERS = {
    "top": ROOT + r"\v02_checkpoint_top.png",
    "entry": ROOT + r"\v02_checkpoint_entry.png",
    "first_transition": ROOT + r"\v02_checkpoint_first_transition.png",
    "deep_turn": ROOT + r"\v02_checkpoint_deep_turn.png",
    "signature_reveal": ROOT + r"\v02_checkpoint_signature_reveal.png",
}

if bpy.data.filepath.lower() != V01.lower():
    bpy.ops.wm.open_mainfile(filepath=V01)

# Save a protected copy before changing any datablocks.
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=False)

# Preserve packed images/materials from v01, rebuild everything else.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    bpy.data.collections.remove(collection)

scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.unit_settings.length_unit = "METERS"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world.use_nodes = True
world_bg = scene.world.node_tree.nodes.get("Background")
world_bg.inputs["Color"].default_value = (0.020, 0.014, 0.010, 1)
world_bg.inputs["Strength"].default_value = 0.16


def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent.children if parent else scene.collection.children).link(c)
    return c


WORLD = collection("WORLD")
ARCH = collection("ARCHITECTURE", WORLD)
FLOOR = collection("FLOOR", ARCH)
WALLS = collection("WALLS", ARCH)
CEILING = collection("CEILING", ARCH)
OPENINGS = collection("OPENINGS", ARCH)
ROOMS = {}
for name in ("ENTRY", "LIVING", "DINING", "CELEBRATION", "KIDS", "AUTOMOBILE", "SHOWCASE", "SIGNATURE"):
    ROOMS[name] = collection("ROOM_" + name, WORLD)
FURNITURE = collection("FURNITURE", WORLD)
DECOR = collection("DECOR", WORLD)
FRAMES = collection("FRAMES", WORLD)
LIGHTING = collection("LIGHTING", WORLD)
CAMERA_RIG = collection("CAMERA_RIG", WORLD)
HELPERS = collection("HELPERS", WORLD)


def move_to(obj, target):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def get_mat(name, color=(0.5, 0.5, 0.5, 1), rough=0.55, metallic=0.0, emission=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission[0]
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    return m


MAT_WALL = get_mat("MAT_Wall_Warm_Plaster", (0.69, 0.59, 0.48, 1), 0.72)
MAT_LIGHT_WALL = get_mat("MAT_Wall_Light_Plaster", (0.82, 0.77, 0.68, 1), 0.70)
MAT_DARK = get_mat("MAT_Charcoal_Plaster", (0.018, 0.015, 0.014, 1), 0.64)
MAT_FLOOR = get_mat("MAT_Floor_Large_Format", (0.42, 0.34, 0.27, 1), 0.66)
MAT_WALNUT = get_mat("MAT_Walnut", (0.16, 0.055, 0.025, 1), 0.48)
MAT_BLACK = get_mat("MAT_Black_Metal", (0.012, 0.012, 0.012, 1), 0.48, 0.32)
MAT_FRAME = get_mat("MAT_Frame_Black", (0.008, 0.008, 0.008, 1), 0.52, 0.18)
MAT_CREAM = get_mat("MAT_Fabric_Cream", (0.74, 0.66, 0.56, 1), 0.86)
MAT_BLUSH = get_mat("MAT_Fabric_Blush", (0.52, 0.22, 0.20, 1), 0.84)
MAT_LEATHER = get_mat("MAT_Leather_Black", (0.018, 0.014, 0.013, 1), 0.46)
MAT_BRONZE = get_mat("MAT_Bronze", (0.25, 0.10, 0.035, 1), 0.38, 0.68)
MAT_STONE = get_mat("MAT_Rug_Taupe", (0.36, 0.29, 0.23, 1), 0.88)
MAT_GREEN = get_mat("MAT_Plant_Green", (0.05, 0.18, 0.055, 1), 0.78)
MAT_EMISSIVE = get_mat("MAT_Warm_Emissive", (1.0, 0.21, 0.035, 1), 0.35, 0.0, ((1.0, 0.11, 0.025, 1), 6.0))
MAT_PATH = get_mat("MAT_Path_Guide_V02", (0.45, 1.0, 0.02, 1), 0.45, 0.0, ((0.25, 1.0, 0.01, 1), 2.0))


def assign(obj, mat):
    if mat:
        obj.data.materials.append(mat)
    return obj


def box(name, loc, dims, mat, coll, rot_z=0.0, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=(0, 0, rot_z))
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, mat)
    move_to(o, coll)
    if bevel > 0:
        mod = o.modifiers.new("BEVEL_Subtle", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return o


def wall_between(name, a, b, height=3.2, thickness=0.18, mat=MAT_WALL, coll=WALLS, z0=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    return box(name, ((a.x+b.x)/2, (a.y+b.y)/2, z0+height/2),
               (d.length, thickness, height), mat, coll, math.atan2(d.y, d.x))


def u_slab(name, z, thickness, mat, coll, upward=False):
    pts = [(-16,-15),(-6,-15),(-6,5),(6,5),(6,-15),(16,-15),(16,14),(-16,14)]
    verts = [(x,y,z) for x,y in pts]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], [list(range(len(verts)))])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    solid = obj.modifiers.new("SOLIDIFY_Slab", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = 1.0 if upward else -1.0
    return obj


def curve_poly(name, points, bevel, mat, coll, cyclic=False):
    cu = bpy.data.curves.new(name + "_Data", "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 1
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(points)-1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    assign(o, mat)
    return o


def curved_wall(name, center, radius, a0, a1, height, thickness, mat, coll, steps=18):
    cx, cy = center
    ri, ro = radius-thickness/2, radius+thickness/2
    verts = []
    for z in (0, height):
        for r in (ri, ro):
            for i in range(steps+1):
                a = math.radians(a0 + (a1-a0)*i/steps)
                verts.append((cx+r*math.cos(a), cy+r*math.sin(a), z))
    n = steps+1
    faces = []
    # Inner and outer curved skins.
    for base in (0, n):
        top = base + 2*n
        for i in range(steps):
            faces.append((base+i, base+i+1, top+i+1, top+i))
    # Top, bottom and end caps.
    for i in range(steps):
        faces.append((i, i+1, n+i+1, n+i))
        faces.append((2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1))
    faces += [(0,n,3*n,2*n), (steps,n+steps,3*n+steps,2*n+steps)]
    me = bpy.data.meshes.new(name + "_Mesh")
    me.from_pydata(verts, [], faces)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


def cylinder(name, loc, radius, depth, mat, coll, vertices=20, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    assign(o, mat)
    move_to(o, coll)
    return o


def sphere(name, loc, scale, mat, coll):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, mat)
    move_to(o, coll)
    return o


def empty(name, loc, coll, display="PLAIN_AXES", size=0.25):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    o.empty_display_type = display
    o.empty_display_size = size
    coll.objects.link(o)
    return o


def area_light(name, loc, energy, size, color, target):
    data = bpy.data.lights.new(name + "_Data", "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    o = bpy.data.objects.new(name, data)
    o.location = loc
    o.rotation_euler = (Vector(target)-o.location).to_track_quat("-Z", "Y").to_euler()
    LIGHTING.objects.link(o)
    return o


def spot_light(name, loc, energy, color, target, angle=0.72):
    data = bpy.data.lights.new(name + "_Data", "SPOT")
    data.energy = energy
    data.color = color
    data.spot_size = angle
    data.spot_blend = 0.62
    data.shadow_soft_size = 0.24
    o = bpy.data.objects.new(name, data)
    o.location = loc
    o.rotation_euler = (Vector(target)-o.location).to_track_quat("-Z", "Y").to_euler()
    LIGHTING.objects.link(o)
    return o


def point_light(name, loc, energy, color, radius=2.0):
    data = bpy.data.lights.new(name + "_Data", "POINT")
    data.energy = energy
    data.color = color
    data.shadow_soft_size = radius
    o = bpy.data.objects.new(name, data)
    o.location = loc
    LIGHTING.objects.link(o)
    o["webgl_fill"] = True
    return o


def plane_x(name, x, yc, zc, width, height, mat, uv_bounds, flip_u=False):
    y0,y1 = yc-width/2,yc+width/2
    z0,z1 = zc-height/2,zc+height/2
    verts=[(x,y0,z0),(x,y1,z0),(x,y1,z1),(x,y0,z1)]
    me=bpy.data.meshes.new(name+"_Mesh")
    me.from_pydata(verts,[],[(0,1,2,3)])
    me.materials.append(mat)
    uv=me.uv_layers.new(name="UVMap")
    u0,u1,v0,v1=uv_bounds
    if flip_u: u0,u1=u1,u0
    for loop,co in zip(me.loops,[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]): uv.data[loop.index].uv=co
    o=bpy.data.objects.new(name,me);FRAMES.objects.link(o);o["dynamic_artwork"]=True
    return o


def plane_y(name, y, xc, zc, width, height, mat, uv_bounds):
    x0,x1=xc-width/2,xc+width/2
    z0,z1=zc-height/2,zc+height/2
    verts=[(x0,y,z0),(x1,y,z0),(x1,y,z1),(x0,y,z1)]
    me=bpy.data.meshes.new(name+"_Mesh")
    me.from_pydata(verts,[],[(0,1,2,3)])
    me.materials.append(mat)
    uv=me.uv_layers.new(name="UVMap")
    u0,u1,v0,v1=uv_bounds
    for loop,co in zip(me.loops,[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]): uv.data[loop.index].uv=co
    o=bpy.data.objects.new(name,me);FRAMES.objects.link(o);o["dynamic_artwork"]=True
    return o


def frame_x(zone, x, yc, zc, width, height, art_mat, uv, facing):
    root=empty("FRAME_"+zone+"_Hero",(x,yc,zc),FRAMES,"CUBE",0.12)
    front=x+facing*0.08
    border=0.085
    for suffix,loc,dims in (
        ("Top",(front,yc,zc+height/2+border/2),(0.08,width+2*border,border)),
        ("Bottom",(front,yc,zc-height/2-border/2),(0.08,width+2*border,border)),
        ("Left",(front,yc-width/2-border/2,zc),(0.08,border,height)),
        ("Right",(front,yc+width/2+border/2,zc),(0.08,border,height))):
        bar=box("FRAME_"+zone+"_Hero_"+suffix,loc,dims,MAT_FRAME,FRAMES,bevel=.012);bar.parent=root;bar.matrix_parent_inverse=root.matrix_world.inverted()
    art=plane_x("ART_"+zone+"_Hero",x+facing*0.065,yc,zc,width,height,art_mat,uv,facing<0)
    empty("TARGET_"+zone.upper(),(x+facing*.25,yc,zc),HELPERS,"SPHERE",.18)
    return root,art


def frame_y(zone, y, xc, zc, width, height, art_mat, uv, facing):
    root=empty("FRAME_"+zone+"_Hero",(xc,y,zc),FRAMES,"CUBE",0.12)
    front=y+facing*0.08
    border=.085
    for suffix,loc,dims in (
        ("Top",(xc,front,zc+height/2+border/2),(width+2*border,.08,border)),
        ("Bottom",(xc,front,zc-height/2-border/2),(width+2*border,.08,border)),
        ("Left",(xc-width/2-border/2,front,zc),(border,.08,height)),
        ("Right",(xc+width/2+border/2,front,zc),(border,.08,height))):
        bar=box("FRAME_"+zone+"_Hero_"+suffix,loc,dims,MAT_FRAME,FRAMES,bevel=.012);bar.parent=root;bar.matrix_parent_inverse=root.matrix_world.inverted()
    art=plane_y("ART_"+zone+"_Hero",y+facing*.065,xc,zc,width,height,art_mat,uv)
    empty("TARGET_"+zone.upper(),(xc,y+facing*.25,zc),HELPERS,"SPHERE",.18)
    return root,art


def sofa(name, loc, width, rot=0, mat=MAT_CREAM):
    x,y=loc
    box(name+"_Base",(x,y,.29),(width,.88,.24),mat,FURNITURE,rot,.06)
    box(name+"_Back",(x-.37*math.sin(rot),y+.37*math.cos(rot),.68),(width,.18,.74),mat,FURNITURE,rot,.06)
    box(name+"_Seat",(x,y-.06,.48),(width-.24,.62,.16),mat,FURNITURE,rot,.05)


def chair(name, loc, rot=0, mat=MAT_CREAM):
    x,y=loc
    box(name+"_Seat",(x,y,.48),(.62,.62,.16),mat,FURNITURE,rot,.04)
    box(name+"_Back",(x-.26*math.sin(rot),y+.26*math.cos(rot),.80),(.62,.12,.68),mat,FURNITURE,rot,.04)
    for dx in (-.24,.24):
        for dy in (-.24,.24):
            box(name+f"_Leg_{dx}_{dy}",(x+dx,y+dy,.23),(.045,.045,.46),MAT_BLACK,FURNITURE,rot)


# Continuous horseshoe floor and ceiling datum.
u_slab("FLOOR_Continuous_U",0,.14,MAT_FLOOR,FLOOR)
u_slab("CEILING_Continuous_U",3.20,.12,MAT_DARK,CEILING,True)

# Outer shell: one continuous backdrop, not a chain of bays.
wall_between("WALL_Outer_East",(16,-15),(16,14),3.2,.18,MAT_LIGHT_WALL)
wall_between("WALL_Outer_North",(16,14),(-16,14),3.2,.18,MAT_WALL)
wall_between("WALL_Outer_West",(-16,14),(-16,-15),3.2,.18,MAT_WALL)

# Open ends with deliberately unequal entry/exit portals.
wall_between("WALL_Entry_Jamb_Inner",(6,-15),(8.0,-15),3.2,.18,MAT_WALL)
wall_between("WALL_Entry_Jamb_Outer",(12.5,-15),(16,-15),3.2,.18,MAT_WALL)
wall_between("WALL_Exit_Jamb_Outer",(-16,-15),(-12.2,-15),3.2,.18,MAT_WALL)
wall_between("WALL_Exit_Jamb_Inner",(-8.0,-15),(-6,-15),3.2,.18,MAT_WALL)

# Right wing: two broad, offset portals instead of repeated arches.
wall_between("WALL_Living_Dining_InnerPier",(6,-6.35),(8.15,-6.35),3.2,.18,MAT_WALNUT)
wall_between("WALL_Living_Dining_OuterReturn",(12.65,-6.35),(16,-6.35),3.2,.18,MAT_WALL)
wall_between("WALL_Dining_Celebration_InnerPier",(6,1.15),(7.75,1.15),3.2,.18,MAT_WALL)
wall_between("WALL_Dining_Celebration_Diagonal",(12.8,1.55),(16,2.25),3.2,.18,MAT_WALNUT)

# Inner U edges: long openings, one curved turn and one diagonal return.
wall_between("WALL_Inner_Right_Entry_Guide",(6,-15),(6,-10.1),2.35,.18,MAT_WALL)
wall_between("WALL_Inner_Right_Reveal",(6,-.9),(6,2.0),3.2,.18,MAT_WALL)
curved_wall("WALL_Celebration_Kids_Curve",(3,2),3,0,90,3.2,.18,MAT_LIGHT_WALL,WALLS)
wall_between("WALL_Inner_Top_LongReveal",(3,5),(-2.2,5),1.15,.20,MAT_WALNUT)
wall_between("WALL_Inner_Top_Diagonal",(-2.2,5),(-6,7.0),2.45,.18,MAT_WALL)
wall_between("WALL_Inner_Left_ShowcaseReveal",(-6,3.2),(-6,-.8),2.55,.18,MAT_WALL)
wall_between("WALL_Inner_Left_SignatureGuide",(-6,-8.2),(-6,-15),2.25,.18,MAT_WALL)

# Sparse zone-defining screens.
wall_between("SCREEN_Kids_Auto_Diagonal",(2.1,13.9),(3.6,10.9),2.4,.12,MAT_WALNUT)
wall_between("SCREEN_Showcase_Signature_Diagonal",(-16,.2),(-12.2,-.35),2.55,.14,MAT_WALNUT)
for i in range(7):
    wall_between(f"SLAT_Showcase_{i+1:02d}",(-15.72+i*.16,6.5),(-15.72+i*.16,8.6),2.45,.055,MAT_BLACK)

# Continuous ceiling track along the journey.
datum=[(10,-14.2,3.08),(10,-9.0,3.08),(9.6,-3.0,3.08),(9.3,3.0,3.08),(6.8,7.2,3.08),(1.5,9.0,3.08),(-5.0,8.5,3.08),(-9.0,5.2,3.08),(-9.5,-2.0,3.08),(-10,-11.8,3.08)]
curve_poly("LIGHT_Ceiling_Datum",datum,.045,MAT_EMISSIVE,LIGHTING)
curve_poly("RAIL_Ceiling_Datum",[(x,y,z+.035) for x,y,z in datum],.075,MAT_BLACK,CEILING)

# Hero frame mapping uses packed v01 image materials and retained crop coordinates.
UV_LIVING=(.301,.761,.477,.825)
UV_AUTO=(.255,.644,.426,.825)
UV_SHOW=(.231,.516,.514,.888)
UV_CELEB=(.317,.681,.457,.851)
UV_KIDS=(.279,.614,.442,.880)
UV_DINING=(.277,.690,.498,.887)
frame_x("Living",15.80,-10.15,1.67,2.75,2.05,bpy.data.materials["MAT_Art_Living"],UV_LIVING,-1)
frame_x("Dining",15.80,-2.65,1.67,2.25,2.10,bpy.data.materials["MAT_Art_Final"],UV_DINING,-1)
frame_x("Celebration",15.80,4.15,1.67,1.72,2.18,bpy.data.materials["MAT_Art_Master"],UV_CELEB,-1)
frame_y("Kids",13.80,6.1,1.67,1.72,2.18,bpy.data.materials["MAT_Art_Kids"],UV_KIDS,-1)
frame_y("Automobile",13.80,-1.65,1.67,2.35,2.18,bpy.data.materials["MAT_Art_Auto"],UV_AUTO,-1)
frame_x("Showcase",-15.80,4.0,1.67,1.64,2.18,bpy.data.materials["MAT_Art_Study"],UV_SHOW,1)
frame_x("Signature",-15.80,-8.15,1.68,3.65,2.32,bpy.data.materials["MAT_Art_Living"],UV_LIVING,1)

# Low-detail furniture/context massing only.
sofa("SOFA_Living_01",(10.7,-10.15),3.2,math.radians(-8),MAT_CREAM)
box("TABLE_Living_Coffee",(12.4,-9.35,.31),(1.55,.78,.18),MAT_WALNUT,FURNITURE,math.radians(-8),.05)
chair("CHAIR_Living_Accent",(13.7,-11.45),math.radians(-25),MAT_LEATHER)

box("TABLE_Dining_01",(11.15,-2.7,.73),(2.75,1.12,.12),MAT_WALNUT,FURNITURE,math.radians(4),.04)
for i,(x,y,r) in enumerate(((9.95,-3.55,0),(11.2,-3.55,0),(12.4,-3.4,0),(10.0,-1.8,math.pi),(11.25,-1.82,math.pi),(12.45,-1.95,math.pi))):
    chair(f"CHAIR_Dining_{i+1:02d}",(x,y),r,MAT_CREAM)

box("CONSOLE_Celebration_01",(14.6,4.15,.62),(.58,2.35,.76),MAT_WALNUT,FURNITURE,math.pi/2,.035)
sofa("BENCH_Celebration_01",(10.7,3.65),2.15,math.radians(18),MAT_BLUSH)
box("PLINTH_Celebration_Glow",(8.0,4.2,.72),(.75,.75,1.44),MAT_STONE,FURNITURE,0,.04)

box("BED_Kids_01",(8.8,10.25,.38),(2.5,1.65,.52),MAT_CREAM,FURNITURE,math.radians(-8),.08)
box("HEADBOARD_Kids_01",(8.95,11.05,.92),(2.65,.16,1.22),MAT_BLUSH,FURNITURE,math.radians(-8),.06)
sphere("TOY_Kids_01",(11.0,8.8,.38),(.38,.38,.38),MAT_BLUSH,DECOR)
sphere("TOY_Kids_02",(11.65,9.35,.26),(.25,.25,.25),MAT_CREAM,DECOR)

# Automobile silhouette: low-poly and intentionally subordinate to the artwork.
box("CAR_Automobile_Body",(-1.5,9.2,.55),(4.5,1.82,.56),MAT_BLACK,FURNITURE,math.radians(-3),.18)
box("CAR_Automobile_Cabin",(-1.15,9.2,1.02),(2.2,1.58,.58),MAT_BLACK,FURNITURE,math.radians(-3),.16)
for i,(x,y) in enumerate(((-2.9,8.35),(.0,8.35),(-2.9,10.05),(.0,10.05))):
    cylinder(f"CAR_Automobile_Wheel_{i+1:02d}",(x,y,.43),.36,.24,MAT_LEATHER,FURNITURE,18,(math.pi/2,0,0))
box("LIGHT_Automobile_FloorSlash",(-1.5,7.45,.035),(5.1,.07,.035),MAT_EMISSIVE,LIGHTING,math.radians(-3))

box("PLINTH_Showcase_01",(-11.2,5.15,.65),(1.2,1.2,1.30),MAT_STONE,FURNITURE,math.radians(8),.045)
box("PLINTH_Showcase_02",(-9.0,3.55,.46),(.82,.82,.92),MAT_WALNUT,FURNITURE,math.radians(-10),.045)
box("OBJECT_Showcase_FrameProxy_01",(-11.2,5.15,1.48),(.55,.12,.72),MAT_FRAME,DECOR,math.radians(8),.02)
box("OBJECT_Showcase_FrameProxy_02",(-9.0,3.55,1.06),(.42,.10,.55),MAT_BRONZE,DECOR,math.radians(-10),.02)

box("CONSOLE_Signature_01",(-14.65,-8.15,.55),(.62,4.4,.72),MAT_WALNUT,FURNITURE,math.pi/2,.035)
box("BENCH_Signature_01",(-10.4,-9.2,.36),(2.35,.72,.45),MAT_LEATHER,FURNITURE,math.radians(8),.055)

# A few foreground anchors; no decorative over-dressing.
for idx,(x,y) in enumerate(((8.15,-12.8),(7.0,-5.0),(7.1,5.8),(-7.1,6.0),(-7.2,-4.0))):
    cylinder(f"PLANT_{idx+1:02d}_Pot",(x,y,.35),.28,.70,MAT_BLACK,DECOR,18)
    leaf_scale=(.23,.18,.48) if idx==0 else ((.27,.21,.54) if idx==2 else (.38,.30,.78))
    sphere(f"PLANT_{idx+1:02d}_Leaf",(x,y,.98),leaf_scale,MAT_GREEN,DECOR)

# Lighting: continuous warm logic, selective accents, dark automotive pocket.
warm=(1.0,.50,.26); warm_soft=(1.0,.68,.42); daylight=(.64,.78,1.0)
zone_lights=[
    ("Living",(11,-10,2.85),420,4.0,warm_soft),
    ("Dining",(11,-2.7,2.85),360,3.6,warm_soft),
    ("Celebration",(10.6,3.8,2.85),440,3.7,warm),
    ("Kids",(7.2,9.7,2.85),480,4.3,(1.0,.72,.60)),
    ("Automobile",(-1.5,9.0,2.75),150,3.3,(.42,.48,.62)),
    ("Showcase",(-10.5,4.5,2.85),300,3.5,warm),
    ("Signature",(-10.5,-8.0,2.85),390,4.2,warm_soft),
]
for name,loc,energy,size,color in zone_lights:
    area_light("LIGHT_"+name+"_Ambient",loc,energy,size,color,(loc[0],loc[1],0))
    point_light("LIGHT_"+name+"_WebGL_Fill",(loc[0],loc[1],2.1),70,color,2.3)

hero_targets={
    "Living":(15.7,-10.15,1.67),"Dining":(15.7,-2.65,1.67),"Celebration":(15.7,4.15,1.67),
    "Kids":(6.1,13.7,1.67),"Automobile":(-1.65,13.7,1.67),"Showcase":(-15.7,4.0,1.67),
    "Signature":(-15.7,-8.15,1.68)}
hero_spots={
    "Living":(13.2,-10.15,2.9),"Dining":(13.2,-2.65,2.9),"Celebration":(13.2,4.15,2.9),
    "Kids":(6.1,11.4,2.9),"Automobile":(-1.65,11.3,2.85),"Showcase":(-13.2,4.0,2.9),
    "Signature":(-12.4,-8.15,2.95)}
for name in hero_targets:
    spot_light("LIGHT_"+name+"_Hero",hero_spots[name],510 if name=="Signature" else 350,warm if name!="Automobile" else (.38,.48,.75),hero_targets[name],.62)

# Cool courtyard bounce through the long inner edge.
for i,(x,y) in enumerate(((6.8,-8),(6.8,-1),(5.5,6),(-5.5,6),(-6.8,0),(-6.8,-8))):
    area_light(f"LIGHT_Daylight_Cut_{i+1:02d}",(x,y,2.7),240,2.5,daylight,(x+(1 if x<0 else -1)*2,y,1.2))

# Camera helpers and visible path guide.
stops={
    "CAM_STOP_00_ENTRY":(9.2,-13.25,1.70),
    "CAM_STOP_01_LIVING":(8.8,-9.6,1.70),
    "CAM_STOP_02_DINING":(8.55,-3.9,1.70),
    "CAM_STOP_03_CELEBRATION":(8.75,2.45,1.70),
    "CAM_STOP_04_KIDS":(5.15,7.2,1.70),
    "CAM_STOP_05_AUTOMOBILE":(-1.2,7.15,1.70),
    "CAM_STOP_06_SHOWCASE":(-8.35,4.85,1.70),
    "CAM_STOP_07_SIGNATURE":(-8.35,-4.15,1.70),
}
for name,loc in stops.items():
    e=empty(name,loc,CAMERA_RIG,"CONE",.28);e["camera_stop"]=True
    marker=cylinder("MARKER_"+name, (loc[0],loc[1],.025), .15,.025,MAT_PATH,HELPERS,18)
    marker.hide_render=True

path_points=[stops[k] for k in stops]
path=curve_poly("PATH_GUIDE_V02",path_points,.055,MAT_PATH,HELPERS)
path.hide_render=True
path["purpose"]="Unanimated inner-U camera clearance guide"

# Explicit sightline marker from Dining to the distant Signature Wall.
sight=curve_poly("SIGHTLINE_Dining_to_Signature",[(8.55,-3.9,1.72),(-15.55,-8.15,1.72)],.018,MAT_EMISSIVE,HELPERS)
sight.hide_render=True
sight["purpose"]="Signature Wall teaser line of sight"

cam_data=bpy.data.cameras.new("CAM_MAIN_V02_Data")
cam_data.lens=41.481
cam_data.sensor_width=36
cam_data.sensor_height=24
cam_data.sensor_fit="VERTICAL"
cam_data.clip_start=.08
cam_data.clip_end=120
cam=bpy.data.objects.new("CAM_MAIN_V02",cam_data)
CAMERA_RIG.objects.link(cam)
scene.camera=cam


def aim_camera(pos,target):
    cam.location=pos
    cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat("-Z","Y").to_euler()


# Metadata used by later animation/Three.js integration.
scene["project"]="Framers Lab Gallery Ribbon v02"
scene["checkpoint_stage"]="architecture_and_camera_massing"
scene["journey_order"]="Entry > Living > Dining > Celebration > Kids > Automobile > Showcase > Signature Reveal"
scene["scene_dimensions_m"]="32 x 29 x 3.32"
scene["minimum_major_portal_width_m"]=4.5
scene["minimum_camera_lane_width_m"]=2.6
scene["camera_eye_height_m"]=1.70
scene["camera_vertical_fov_deg"]=32.269
scene["signature_teased_from"]="CAM_STOP_02_DINING"
scene["final_camera_animation_authored"]=False

# Save checkpoint before rendering with the intended entry composition active.
aim_camera((7.25,-13.35,1.70),(14.35,-7.35,1.58))
bpy.ops.wm.save_as_mainfile(filepath=OUT)

# Four cinematic checkpoint renders.
scene.render.engine="BLENDER_EEVEE"
scene.render.resolution_x=960
scene.render.resolution_y=540
shots={
    "entry":((7.25,-13.35,1.70),(14.35,-7.35,1.58)),
    "first_transition":((8.00,-5.85,1.70),(11.50,2.65,1.52)),
    "deep_turn":((8.75,3.90,1.70),(4.15,11.45,1.55)),
    "signature_reveal":((-7.55,2.35,1.70),(-14.25,-9.65,1.58)),
}
for name,(pos,target) in shots.items():
    aim_camera(pos,target)
    scene.render.filepath=RENDERS[name]
    bpy.ops.render.render(write_still=True)

# Orthographic top view with ceiling and lights hidden and path visible.
hidden=[]
for o in scene.objects:
    if o.name.startswith("CEILING_") or o.name.startswith("LIGHT_") or o.name.startswith("RAIL_"):
        hidden.append((o,o.hide_render));o.hide_render=True
for o in scene.objects:
    if o.name.startswith("MARKER_CAM_STOP_") or o.name=="PATH_GUIDE_V02" or o.name=="SIGHTLINE_Dining_to_Signature":
        o.hide_render=False
top_data=bpy.data.cameras.new("CAM_AUDIT_TOP_Data")
top_data.type="ORTHO";top_data.ortho_scale=37
top=bpy.data.objects.new("CAM_AUDIT_TOP",top_data);CAMERA_RIG.objects.link(top)
top.location=(0,0,42);top.rotation_euler=(0,0,0);top.rotation_euler=(Vector((0,0,0))-top.location).to_track_quat("-Z","Y").to_euler()
scene.camera=top
old_engine=scene.render.engine
scene.render.engine="BLENDER_WORKBENCH"
scene.display.shading.light="STUDIO"
scene.display.shading.color_type="MATERIAL"
scene.display.shading.show_shadows=True
scene.render.resolution_x=1000;scene.render.resolution_y=850
scene.render.filepath=RENDERS["top"]
bpy.ops.render.render(write_still=True)
scene.render.engine=old_engine
for o,v in hidden:o.hide_render=v
for o in scene.objects:
    if o.name.startswith("MARKER_CAM_STOP_") or o.name=="PATH_GUIDE_V02" or o.name=="SIGHTLINE_Dining_to_Signature":o.hide_render=True
scene.camera=cam
bpy.data.objects.remove(top,do_unlink=True)
bpy.data.cameras.remove(top_data)

# Restore the saved entry camera pose without modifying the saved checkpoint.
aim_camera(shots["entry"][0],shots["entry"][1])
scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=OUT)

tris=0
deps=bpy.context.evaluated_depsgraph_get()
for o in scene.objects:
    if o.type=="MESH":
        eo=o.evaluated_get(deps);me=eo.to_mesh();me.calc_loop_triangles();tris+=len(me.loop_triangles);eo.to_mesh_clear()
print({
    "checkpoint":OUT,
    "objects":len(scene.objects),
    "triangles":tris,
    "materials":len(bpy.data.materials),
    "lights":sum(o.type=="LIGHT" for o in scene.objects),
    "hero_art":sum(o.name.startswith("ART_") and o.type=="MESH" for o in scene.objects),
    "renders":RENDERS,
})
