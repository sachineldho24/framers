import bpy
import math
from mathutils import Vector


OUTPUT_BLEND = r"C:\Personal_Projects\Framers\framers_gallery_ribbon_v03_furnished.blend"
TARGET_TRIANGLES_PER_SET = 120_000
MASTER_COLLECTION_NAME = "IMPORTED_FURNITURE_V03"

CONFIGS = [
    {
        "label": "Living",
        "zone": "living",
        "source": r"C:\Users\Sachin\Downloads\living.glb",
        "rotation_z": -math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MAX",
        "wall_coordinate": 15.84,
        "center_axis": "Y",
        "center_coordinate": -10.15,
        "hide_prefixes": ("SOFA_Living_01", "CHAIR_Living_Accent", "TABLE_Living_Coffee", "PLANT_01_"),
    },
    {
        "label": "Dining",
        "zone": "dining",
        "source": r"C:\Users\Sachin\Downloads\dining.glb",
        "rotation_z": -math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MAX",
        "wall_coordinate": 15.84,
        "center_axis": "Y",
        "center_coordinate": -2.65,
        "hide_prefixes": ("TABLE_Dining_01", "CHAIR_Dining_"),
    },
    {
        "label": "Bedroom",
        "zone": "celebration",
        "source": r"C:\Users\Sachin\Downloads\bedroom.glb",
        "rotation_z": -math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MAX",
        "wall_coordinate": 15.84,
        "center_axis": "Y",
        "center_coordinate": 4.15,
        "hide_prefixes": ("BENCH_Celebration_01", "CONSOLE_Celebration_01", "PLINTH_Celebration_Glow"),
    },
    {
        "label": "Kids",
        "zone": "kids",
        "source": r"C:\Users\Sachin\Downloads\kids.glb",
        "rotation_z": 0.0,
        "target_height": 2.98,
        "wall_axis": "Y_MAX",
        "wall_coordinate": 13.84,
        "center_axis": "X",
        "center_coordinate": 6.10,
        "hide_prefixes": ("BED_Kids_01", "HEADBOARD_Kids_01", "TOY_Kids_", "PLANT_03_"),
    },
    {
        "label": "Study",
        "zone": "showcase",
        "source": r"C:\Users\Sachin\Downloads\chair.glb",
        "rotation_z": math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MIN",
        "wall_coordinate": -15.84,
        "center_axis": "Y",
        "center_coordinate": 4.00,
        "hide_prefixes": ("PLINTH_Showcase_", "OBJECT_Showcase_FrameProxy_"),
    },
]


def object_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def triangle_count(obj):
    return sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)


if bpy.data.collections.get(MASTER_COLLECTION_NAME):
    raise RuntimeError(f"{MASTER_COLLECTION_NAME} already exists; start from the v02.1 source scene")

scene = bpy.context.scene
master_collection = bpy.data.collections.new(MASTER_COLLECTION_NAME)
scene.collection.children.link(master_collection)

hidden_proxies = []
for config in CONFIGS:
    for obj in scene.objects:
        if obj.name.startswith(config["hide_prefixes"]):
            obj.hide_render = True
            obj.hide_viewport = True
            obj["replaced_by_v03"] = config["label"]
            hidden_proxies.append(obj.name)

placed = []
for config in CONFIGS:
    before_objects = set(bpy.data.objects)
    before_meshes = set(bpy.data.meshes)
    before_materials = set(bpy.data.materials)
    before_images = set(bpy.data.images)

    bpy.ops.import_scene.gltf(filepath=config["source"])
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"Expected one mesh in {config['source']}, got {len(mesh_objects)}")
    obj = mesh_objects[0]

    zone_collection = bpy.data.collections.new(f"ROOM_{config['label'].upper()}_IMPORTED_V03")
    master_collection.children.link(zone_collection)
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    zone_collection.objects.link(obj)

    obj.name = f"SET_{config['label']}_Detailed_V03"
    obj.data.name = f"MESH_SET_{config['label']}_Detailed_V03"

    for index, material in enumerate([m for m in bpy.data.materials if m not in before_materials], start=1):
        material.name = f"MAT_{config['label']}_Imported_{index:02d}_V03"
    for index, image in enumerate([i for i in bpy.data.images if i not in before_images], start=1):
        image.name = f"IMG_{config['label']}_Imported_{index:02d}_V03"

    original_triangles = triangle_count(obj)
    ratio = min(1.0, TARGET_TRIANGLES_PER_SET / original_triangles)
    if ratio < 1.0:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new("WebPreview_Decimate_V03", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    obj.rotation_euler = (0.0, 0.0, config["rotation_z"])
    obj.scale = (1.0, 1.0, 1.0)
    scene.view_layers.update()
    low, high = object_bounds(obj)
    uniform_scale = config["target_height"] / (high.z - low.z)
    obj.scale = (uniform_scale, uniform_scale, uniform_scale)
    scene.view_layers.update()
    low, high = object_bounds(obj)

    translation = Vector((0.0, 0.0, -low.z))
    if config["wall_axis"] == "X_MAX":
        translation.x += config["wall_coordinate"] - high.x
    elif config["wall_axis"] == "X_MIN":
        translation.x += config["wall_coordinate"] - low.x
    elif config["wall_axis"] == "Y_MAX":
        translation.y += config["wall_coordinate"] - high.y
    else:
        raise RuntimeError(f"Unsupported wall axis: {config['wall_axis']}")

    if config["center_axis"] == "X":
        translation.x += config["center_coordinate"] - ((low.x + high.x) * 0.5)
    elif config["center_axis"] == "Y":
        translation.y += config["center_coordinate"] - ((low.y + high.y) * 0.5)
    obj.location += translation
    scene.view_layers.update()
    final_low, final_high = object_bounds(obj)

    obj["source_glb"] = config["source"]
    obj["gallery_zone"] = config["zone"]
    obj["original_triangles"] = original_triangles
    obj["optimized_triangles"] = triangle_count(obj)
    obj["placement_revision"] = "v03"
    placed.append({
        "name": obj.name,
        "zone": config["zone"],
        "source": config["source"],
        "original_triangles": original_triangles,
        "optimized_triangles": triangle_count(obj),
        "scale": round(uniform_scale, 6),
        "location": [round(v, 6) for v in obj.location],
        "rotation_z": round(obj.rotation_euler.z, 6),
        "bounds_min": [round(v, 6) for v in final_low],
        "bounds_max": [round(v, 6) for v in final_high],
    })

scene["furniture_revision"] = "v03_furnished"
scene["furniture_source_count"] = len(CONFIGS)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND, check_existing=False)

result = {
    "output_blend": OUTPUT_BLEND,
    "placed": placed,
    "hidden_proxy_count": len(hidden_proxies),
    "hidden_proxies": hidden_proxies,
    "scene_object_count": len(scene.objects),
}
