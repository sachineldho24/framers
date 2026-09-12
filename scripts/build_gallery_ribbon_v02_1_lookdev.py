import bpy
import math
from mathutils import Vector

ROOT = r"C:\Personal_Projects\Framers"
SOURCE = ROOT + r"\framers_gallery_ribbon_v02_checkpoint.blend"
OUT = ROOT + r"\framers_gallery_ribbon_v02_1_entry_lookdev.blend"

if bpy.data.filepath.lower() != SOURCE.lower():
    raise RuntimeError("Open the approved v02 checkpoint before running the v02.1 lookdev build")

scene = bpy.context.scene
camera = bpy.data.objects["CAM_MAIN_V02"]
camera_matrix_before = camera.matrix_world.copy()
camera_lens_before = camera.data.lens
camera_sensor_height_before = camera.data.sensor_height
camera_sensor_fit_before = camera.data.sensor_fit
exposure_before = scene.view_settings.exposure
art_material_before = bpy.data.objects["ART_Living_Hero"].data.materials[0]

# Establish the isolated look-development file before changing scene data.
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=False)

# Repair the v02 frame-bar parent transform while preserving the approved
# artwork positions. The source generator now applies this inverse at creation.
for zone in ("Living", "Dining", "Celebration", "Kids", "Automobile", "Showcase", "Signature"):
    root = bpy.data.objects.get(f"FRAME_{zone}_Hero")
    if not root:
        continue
    for suffix in ("Top", "Bottom", "Left", "Right"):
        bar = bpy.data.objects.get(f"FRAME_{zone}_Hero_{suffix}")
        if bar and bar.parent == root:
            bar.matrix_parent_inverse = root.matrix_world.inverted()


def reset_material(name):
    old = bpy.data.materials.get(name)
    if old:
        bpy.data.materials.remove(old)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    output = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 0)
    bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (500, 0)
    mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat, bsdf


def object_coordinates(nodes):
    tex = nodes.new("ShaderNodeTexCoord")
    tex.location = (-900, 0)
    return tex.outputs["Object"]


def noise(nodes, links, vector, scale, detail=2.0, roughness=0.55, distortion=0.0, loc=(-650, 0)):
    node = nodes.new("ShaderNodeTexNoise")
    node.location = loc
    node.inputs["Scale"].default_value = scale
    node.inputs["Detail"].default_value = detail
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Distortion"].default_value = distortion
    links.new(vector, node.inputs["Vector"])
    return node


def color_ramp(nodes, links, fac, color_a, color_b, loc=(-360, 120)):
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = loc
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = color_a
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = color_b
    links.new(fac, ramp.inputs["Fac"])
    return ramp


def bump_from(nodes, links, height, strength, distance, loc=(210, -190)):
    bump = nodes.new("ShaderNodeBump")
    bump.location = loc
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    links.new(height, bump.inputs["Height"])
    return bump


def make_mineral_plaster():
    mat, bsdf = reset_material("M01_Mineral_Plaster_LookDev")
    n, l = mat.node_tree.nodes, mat.node_tree.links
    vec = object_coordinates(n)
    broad = noise(n, l, vec, 0.42, 2.0, 0.52, 0.08, (-650, 130))
    ramp = color_ramp(n, l, broad.outputs["Fac"], (0.69, 0.655, 0.59, 1), (0.735, 0.705, 0.65, 1), (-360, 150))
    l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    micro = noise(n, l, vec, 62.0, 2.2, 0.72, 0.0, (-400, -180))
    bump = bump_from(n, l, micro.outputs["Fac"], 0.075, 0.0015)
    l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    rough = color_ramp(n, l, broad.outputs["Fac"], (0.58,0.58,0.58,1), (0.67,0.67,0.67,1), (0,-30))
    l.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.38
    return mat


def make_limestone():
    mat, bsdf = reset_material("M02_Honed_Limestone_LookDev")
    n, l = mat.node_tree.nodes, mat.node_tree.links
    vec = object_coordinates(n)
    broad = noise(n, l, vec, 0.36, 3.0, 0.58, 0.18, (-660, 140))
    ramp = color_ramp(n, l, broad.outputs["Fac"], (0.47, 0.425, 0.37, 1), (0.56, 0.515, 0.455, 1), (-360, 150))
    l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    micro = noise(n, l, vec, 115.0, 2.0, 0.60, 0.0, (-420, -190))
    bump = bump_from(n, l, micro.outputs["Fac"], 0.065, 0.0010)
    l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    rough = color_ramp(n, l, broad.outputs["Fac"], (0.38,0.38,0.38,1), (0.46,0.46,0.46,1), (0,-35))
    l.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.46
    return mat


def make_graphite_ceiling():
    mat, bsdf = reset_material("M03_Graphite_Ceiling_LookDev")
    n, l = mat.node_tree.nodes, mat.node_tree.links
    vec = object_coordinates(n)
    broad = noise(n, l, vec, 0.55, 2.0, 0.50, 0.0, (-620, 120))
    ramp = color_ramp(n, l, broad.outputs["Fac"], (0.028,0.032,0.038,1), (0.060,0.065,0.073,1), (-330,130))
    l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    micro = noise(n, l, vec, 40.0, 2.0, 0.60, 0.0, (-380,-180))
    bump = bump_from(n, l, micro.outputs["Fac"], 0.055, 0.0012)
    l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.50
    bsdf.inputs["Specular IOR Level"].default_value = 0.32
    return mat


def make_boucle():
    mat, bsdf = reset_material("M04_Boucle_Ivory_LookDev")
    n, l = mat.node_tree.nodes, mat.node_tree.links
    vec = object_coordinates(n)
    macro = noise(n, l, vec, 7.0, 3.0, 0.72, 0.15, (-650,130))
    ramp = color_ramp(n, l, macro.outputs["Fac"], (0.70,0.665,0.60,1), (0.82,0.79,0.72,1), (-350,140))
    l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    weave = noise(n, l, vec, 145.0, 3.0, 0.78, 0.05, (-400,-190))
    bump = bump_from(n, l, weave.outputs["Fac"], 0.18, 0.0028)
    l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.82
    bsdf.inputs["Sheen Weight"].default_value = 0.18
    bsdf.inputs["Sheen Roughness"].default_value = 0.72
    return mat


def make_walnut():
    mat, bsdf = reset_material("M05_Walnut_Satin_LookDev")
    n, l = mat.node_tree.nodes, mat.node_tree.links
    vec = object_coordinates(n)
    grain = noise(n, l, vec, 3.2, 4.0, 0.48, 2.8, (-650,120))
    ramp = color_ramp(n, l, grain.outputs["Fac"], (0.055,0.018,0.007,1), (0.23,0.075,0.025,1), (-350,130))
    l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    micro = noise(n, l, vec, 34.0, 2.0, 0.55, 0.2, (-390,-190))
    bump = bump_from(n, l, micro.outputs["Fac"], 0.09, 0.0012)
    l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.41
    bsdf.inputs["Coat Weight"].default_value = 0.10
    bsdf.inputs["Coat Roughness"].default_value = 0.32
    return mat


def make_graphite_frame():
    mat, bsdf = reset_material("M06_Graphite_Frame_LookDev")
    bsdf.inputs["Base Color"].default_value = (0.008,0.009,0.011,1)
    bsdf.inputs["Metallic"].default_value = 0.32
    bsdf.inputs["Roughness"].default_value = 0.27
    bsdf.inputs["Coat Weight"].default_value = 0.08
    bsdf.inputs["Coat Roughness"].default_value = 0.24
    return mat


def make_glass():
    mat, bsdf = reset_material("M07_Frame_Glass_LookDev")
    bsdf.inputs["Base Color"].default_value = (0.92,0.95,1.0,1)
    bsdf.inputs["Roughness"].default_value = 0.13
    bsdf.inputs["IOR"].default_value = 1.46
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["Alpha"].default_value = 0.22
    bsdf.inputs["Specular IOR Level"].default_value = 0.55
    mat.diffuse_color = (0.8,0.9,1.0,0.22)
    mat.surface_render_method = "DITHERED"
    return mat


def make_datum():
    mat, bsdf = reset_material("M08_Datum_2800K_LookDev")
    bsdf.inputs["Base Color"].default_value = (0.60,0.20,0.055,1)
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Emission Color"].default_value = (1.0,0.44,0.16,1)
    bsdf.inputs["Emission Strength"].default_value = 1.65
    return mat


def make_neutral_art():
    mat, bsdf = reset_material("M99_Neutral_Artwork_Control")
    bsdf.inputs["Base Color"].default_value = (0.20,0.20,0.20,1)
    bsdf.inputs["Roughness"].default_value = 0.48
    return mat


plaster = make_mineral_plaster()
limestone = make_limestone()
graphite = make_graphite_ceiling()
boucle = make_boucle()
walnut = make_walnut()
frame_mat = make_graphite_frame()
glass_mat = make_glass()
datum_mat = make_datum()
neutral_art = make_neutral_art()
neutral_art.use_fake_user = True


def assign_material(obj_name, mat):
    obj = bpy.data.objects.get(obj_name)
    if not obj or obj.type not in {"MESH", "CURVE"}:
        return
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# Limit material application to the Entry/Living camera and immediate background.
assign_material("FLOOR_Continuous_U", limestone)
assign_material("CEILING_Continuous_U", graphite)
for name in (
    "WALL_Outer_East", "WALL_Entry_Jamb_Inner", "WALL_Entry_Jamb_Outer",
    "WALL_Inner_Right_Entry_Guide", "WALL_Living_Dining_InnerPier",
    "WALL_Living_Dining_OuterReturn", "WALL_Dining_Celebration_Diagonal"):
    assign_material(name, plaster)

for obj in bpy.data.objects:
    if obj.name.startswith("SOFA_Living_01_"):
        assign_material(obj.name, boucle)
    elif obj.name.startswith("CHAIR_Dining_") and (obj.name.endswith("_Seat") or obj.name.endswith("_Back")):
        assign_material(obj.name, boucle)
for name in ("TABLE_Living_Coffee", "TABLE_Dining_01", "CONSOLE_Celebration_01"):
    assign_material(name, walnut)
for name in ("FRAME_Living_Hero_Top", "FRAME_Living_Hero_Bottom", "FRAME_Living_Hero_Left", "FRAME_Living_Hero_Right"):
    assign_material(name, frame_mat)
assign_material("LIGHT_Ceiling_Datum", datum_mat)

# Improve the visible dark leather response without creating another master family.
leather = bpy.data.materials.get("MAT_Leather_Black")
if leather and leather.use_nodes:
    leather_bsdf = leather.node_tree.nodes.get("Principled BSDF")
    if leather_bsdf:
        leather_bsdf.inputs["Base Color"].default_value = (0.009,0.010,0.012,1)
        leather_bsdf.inputs["Roughness"].default_value = 0.38
        leather_bsdf.inputs["Coat Weight"].default_value = 0.16
        leather_bsdf.inputs["Coat Roughness"].default_value = 0.30


def controlled_bevel(obj_name, width):
    obj = bpy.data.objects.get(obj_name)
    if not obj or obj.type != "MESH":
        return
    bevel = next((m for m in obj.modifiers if m.type == "BEVEL"), None)
    if bevel is None:
        bevel = obj.modifiers.new("BEVEL_LookDev", "BEVEL")
    bevel.width = width
    bevel.segments = 2
    bevel.limit_method = "ANGLE"


for name in (
    "WALL_Outer_East", "WALL_Entry_Jamb_Inner", "WALL_Entry_Jamb_Outer",
    "WALL_Inner_Right_Entry_Guide", "WALL_Living_Dining_InnerPier",
    "WALL_Living_Dining_OuterReturn", "WALL_Dining_Celebration_Diagonal"):
    controlled_bevel(name, 0.008)
controlled_bevel("FLOOR_Continuous_U", 0.006)
for obj in bpy.data.objects:
    if obj.name.startswith("SOFA_Living_01_"):
        controlled_bevel(obj.name, 0.018)
    elif obj.name.startswith("CHAIR_Dining_") and (obj.name.endswith("_Seat") or obj.name.endswith("_Back")):
        controlled_bevel(obj.name, 0.012)
for name in ("TABLE_Living_Coffee", "TABLE_Dining_01", "CONSOLE_Celebration_01"):
    controlled_bevel(name, 0.005)
for name in ("FRAME_Living_Hero_Top", "FRAME_Living_Hero_Bottom", "FRAME_Living_Hero_Left", "FRAME_Living_Hero_Right"):
    controlled_bevel(name, 0.0025)


lookdev_collection = bpy.data.collections.get("LOOKDEV_V02_1")
if lookdev_collection:
    bpy.data.collections.remove(lookdev_collection)
lookdev_collection = bpy.data.collections.new("LOOKDEV_V02_1")
bpy.data.collections["WORLD"].children.link(lookdev_collection)


def link_only(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def box(name, loc, dims, mat):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    link_only(obj, lookdev_collection)
    return obj


def plane_x(name, x, yc, zc, width, height, mat):
    verts = [(x,yc-width/2,zc-height/2),(x,yc-width/2,zc+height/2),
             (x,yc+width/2,zc+height/2),(x,yc+width/2,zc-height/2)]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], [(0,1,2,3)])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    lookdev_collection.objects.link(obj)
    return obj


# Production-frame construction: front glazing, recessed artwork, backing and shadow gap.
frame_root = bpy.data.objects["FRAME_Living_Hero"]
glass = plane_x("GLASS_Living_Hero", 15.697, -10.15, 1.67, 2.75, 2.05, glass_mat)
backing = box("BACKING_Living_Hero", (15.782,-10.15,1.67), (.020,2.79,2.09), walnut)
shadow = box("SHADOW_GAP_Living_Hero", (15.808,-10.15,1.67), (.012,2.91,2.21), frame_mat)
for obj in (glass,backing,shadow):
    obj.parent = frame_root
    obj.matrix_parent_inverse = frame_root.matrix_world.inverted()
glass["frame_layer"] = "glazing"
backing["frame_layer"] = "backing"
shadow["frame_layer"] = "shadow_gap"
bpy.data.objects["ART_Living_Hero"]["frame_layer"] = "artwork"


def set_light(name, energy, color, size=None, spot_size=None):
    obj = bpy.data.objects.get(name)
    if not obj or obj.type != "LIGHT":
        return
    obj.data.energy = energy
    obj.data.color = color
    if size is not None and obj.data.type == "AREA":
        obj.data.size = size
    if spot_size is not None and obj.data.type == "SPOT":
        obj.data.spot_size = spot_size
        obj.data.spot_blend = 0.68


# Approximate black-body colours tuned for Blender's linear light colour input.
K4200 = (1.0, 0.89, 0.76)
K3300 = (1.0, 0.76, 0.55)
K5200 = (0.92, 0.96, 1.0)
set_light("LIGHT_Living_Ambient", 610, K4200, 5.2)
set_light("LIGHT_Living_WebGL_Fill", 82, K4200)
set_light("LIGHT_Dining_Ambient", 430, K4200, 4.3)
set_light("LIGHT_Dining_WebGL_Fill", 64, K4200)
set_light("LIGHT_Living_Hero", 430, K3300, spot_size=0.58)
set_light("LIGHT_Dining_Hero", 260, K3300, spot_size=0.62)
set_light("LIGHT_Daylight_Cut_01", 300, K5200, 3.0)
set_light("LIGHT_Daylight_Cut_02", 220, K5200, 2.8)


def add_area(name, loc, target, energy, size, color):
    data = bpy.data.lights.new(name + "_Data", "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    lookdev_collection.objects.link(obj)
    return obj


def add_spot(name, loc, target, energy, angle, color):
    data = bpy.data.lights.new(name + "_Data", "SPOT")
    data.energy = energy
    data.color = color
    data.spot_size = angle
    data.spot_blend = 0.72
    data.shadow_soft_size = 0.22
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    lookdev_collection.objects.link(obj)
    return obj


add_area("LIGHT_Entry_Neutral_Fill_LookDev", (8.4,-12.2,2.55), (12.0,-9.4,1.10), 260, 4.2, K4200)
add_area("LIGHT_Living_Ceiling_Bounce_LookDev", (10.4,-10.2,2.35), (10.4,-10.2,3.18), 165, 4.5, K4200)
add_spot("LIGHT_Living_Plaster_Graze_LookDev", (14.25,-7.45,2.88), (15.76,-9.55,1.35), 220, 0.50, K3300)

world_bg = scene.world.node_tree.nodes.get("Background")
world_bg.inputs["Color"].default_value = (0.055,0.050,0.044,1)
world_bg.inputs["Strength"].default_value = 0.20

# Preserve exposure while using a less crushed AgX display look.
scene.view_settings.look = "AgX - Medium Low Contrast"
scene.view_settings.exposure = exposure_before
scene.eevee.taa_render_samples = 128
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.engine = "BLENDER_EEVEE"
scene.camera = camera

scene["lookdev_stage"] = "v02.1 Entry/Living Material Fidelity & Lighting"
scene["lookdev_scope"] = "Entry/Living camera only"
scene["base_light_temperature_k"] = 4200
scene["artwork_accent_temperature_k"] = 3300
scene["ceiling_datum_temperature_k"] = 2800
scene["camera_locked"] = True
scene["exposure_locked"] = True
scene["architecture_locked"] = True

# Hard assertions: camera, exposure and artwork remain unchanged.
for row_before, row_after in zip(camera_matrix_before, camera.matrix_world):
    for a, b in zip(row_before, row_after):
        if abs(a-b) > 1e-7:
            raise RuntimeError("Entry camera transform changed during look development")
if camera.data.lens != camera_lens_before or camera.data.sensor_height != camera_sensor_height_before or camera.data.sensor_fit != camera_sensor_fit_before:
    raise RuntimeError("Camera optics changed during look development")
if scene.view_settings.exposure != exposure_before:
    raise RuntimeError("Exposure changed during look development")
if bpy.data.objects["ART_Living_Hero"].data.materials[0] != art_material_before:
    raise RuntimeError("Living artwork material changed during look development")

bpy.ops.wm.save_as_mainfile(filepath=OUT)

deps = bpy.context.evaluated_depsgraph_get()
triangles = 0
for obj in scene.objects:
    if obj.type == "MESH":
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()

print({
    "file": OUT,
    "objects": len(scene.objects),
    "triangles": triangles,
    "materials": len(bpy.data.materials),
    "lights": sum(obj.type == "LIGHT" for obj in scene.objects),
    "camera_locked": True,
    "exposure": scene.view_settings.exposure,
    "living_art_unchanged": bpy.data.objects["ART_Living_Hero"].data.materials[0].name,
})
