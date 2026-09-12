import bpy
import math
from mathutils import Vector


OUTPUT_BLEND = r"C:\Personal_Projects\Framers\framers_gallery_ribbon_v03_furnished.blend"

PLACEMENTS = {
    "SET_Living_Detailed_V03": {
        "rotation_z": -math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MAX",
        "wall_coordinate": 15.84,
        "center_axis": "Y",
        "center_coordinate": -10.15,
    },
    "SET_Dining_Detailed_V03": {
        "rotation_z": -math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MAX",
        "wall_coordinate": 15.84,
        "center_axis": "Y",
        "center_coordinate": -2.65,
    },
    "SET_Bedroom_Detailed_V03": {
        "rotation_z": -math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MAX",
        "wall_coordinate": 15.84,
        "center_axis": "Y",
        "center_coordinate": 4.15,
    },
    "SET_Kids_Detailed_V03": {
        "rotation_z": 0.0,
        "target_height": 2.98,
        "wall_axis": "Y_MAX",
        "wall_coordinate": 13.84,
        "center_axis": "X",
        "center_coordinate": 6.10,
    },
    "SET_Study_Detailed_V03": {
        "rotation_z": math.pi / 2.0,
        "target_height": 2.95,
        "wall_axis": "X_MIN",
        "wall_coordinate": -15.84,
        "center_axis": "Y",
        "center_coordinate": 4.00,
    },
}


def world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


verified = []
for object_name, placement in PLACEMENTS.items():
    obj = bpy.data.objects.get(object_name)
    if obj is None:
        raise RuntimeError(f"Missing imported set: {object_name}")

    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, placement["rotation_z"])
    obj.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()
    low, high = world_bounds(obj)

    uniform_scale = placement["target_height"] / (high.z - low.z)
    obj.scale = (uniform_scale, uniform_scale, uniform_scale)
    bpy.context.view_layer.update()
    low, high = world_bounds(obj)

    translation = Vector((0.0, 0.0, -low.z))
    if placement["wall_axis"] == "X_MAX":
        translation.x += placement["wall_coordinate"] - high.x
    elif placement["wall_axis"] == "X_MIN":
        translation.x += placement["wall_coordinate"] - low.x
    elif placement["wall_axis"] == "Y_MAX":
        translation.y += placement["wall_coordinate"] - high.y
    else:
        raise RuntimeError(f"Unsupported wall axis: {placement['wall_axis']}")

    if placement["center_axis"] == "X":
        translation.x += placement["center_coordinate"] - ((low.x + high.x) * 0.5)
    elif placement["center_axis"] == "Y":
        translation.y += placement["center_coordinate"] - ((low.y + high.y) * 0.5)
    obj.location = translation
    bpy.context.view_layer.update()
    final_low, final_high = world_bounds(obj)

    if abs(final_low.z) > 0.002:
        raise RuntimeError(f"{object_name} does not sit on the floor: z={final_low.z}")
    if abs((final_high.z - final_low.z) - placement["target_height"]) > 0.002:
        raise RuntimeError(f"{object_name} height invariant failed")

    wall_value = {
        "X_MAX": final_high.x,
        "X_MIN": final_low.x,
        "Y_MAX": final_high.y,
    }[placement["wall_axis"]]
    if abs(wall_value - placement["wall_coordinate"]) > 0.002:
        raise RuntimeError(f"{object_name} wall alignment invariant failed")

    verified.append({
        "name": object_name,
        "scale": round(uniform_scale, 6),
        "location": [round(v, 6) for v in obj.location],
        "bounds_min": [round(v, 6) for v in final_low],
        "bounds_max": [round(v, 6) for v in final_high],
    })

bpy.context.scene["v03_placement_verified"] = True
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND, check_existing=False)

result = {"output_blend": OUTPUT_BLEND, "verified": verified}
