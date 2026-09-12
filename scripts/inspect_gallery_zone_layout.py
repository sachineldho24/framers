import bpy
from mathutils import Vector


PREFIXES = {
    "living": ("SOFA_Living", "CHAIR_Living", "TABLE_Living", "PLANT_01", "PLANT_02", "FRAME_Living", "ART_Living"),
    "dining": ("TABLE_Dining", "CHAIR_Dining", "FRAME_Dining", "ART_Dining"),
    "celebration": ("BENCH_Celebration", "CONSOLE_Celebration", "PLINTH_Celebration", "FRAME_Celebration", "ART_Celebration"),
    "kids": ("BED_Kids", "HEADBOARD_Kids", "TOY_Kids", "PLANT_03", "FRAME_Kids", "ART_Kids"),
    "showcase": ("PLINTH_Showcase", "OBJECT_Showcase", "FRAME_Showcase", "ART_Showcase"),
    "signature": ("BENCH_Signature", "CONSOLE_Signature", "FRAME_Signature", "ART_Signature"),
}


def world_bounds(obj):
    if obj.type != "MESH":
        return None
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return {
        "min": [round(v, 4) for v in low],
        "max": [round(v, 4) for v in high],
        "dimensions": [round(v, 4) for v in high - low],
    }


zones = {}
for zone, prefixes in PREFIXES.items():
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(prefixes):
            objects.append({
                "name": obj.name,
                "type": obj.type,
                "location": [round(v, 4) for v in obj.matrix_world.translation],
                "rotation_z": round(obj.rotation_euler.z, 6),
                "bounds": world_bounds(obj),
                "hidden_viewport": obj.hide_viewport,
                "hidden_render": obj.hide_render,
            })
    zones[zone] = objects

collections = {
    collection.name: {
        "objects": len(collection.objects),
        "hidden_viewport": collection.hide_viewport,
        "hidden_render": collection.hide_render,
    }
    for collection in bpy.data.collections
}

result = {
    "zones": zones,
    "collections": collections,
    "scene_object_count": len(bpy.context.scene.objects),
}
