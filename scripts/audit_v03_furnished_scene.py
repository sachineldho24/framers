import bpy
from mathutils import Vector


SET_NAMES = [
    "SET_Living_Detailed_V03",
    "SET_Dining_Detailed_V03",
    "SET_Bedroom_Detailed_V03",
    "SET_Kids_Detailed_V03",
    "SET_Study_Detailed_V03",
]


def world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


bpy.context.view_layer.update()
sets = []
for name in SET_NAMES:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RuntimeError(f"Missing set: {name}")
    low, high = world_bounds(obj)
    triangles = sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)
    sets.append({
        "name": name,
        "zone": obj.get("gallery_zone"),
        "triangles": triangles,
        "floor_z": round(low.z, 6),
        "height": round(high.z - low.z, 6),
        "bounds_min": [round(v, 4) for v in low],
        "bounds_max": [round(v, 4) for v in high],
    })

temporary_datablocks = sorted(
    block.name
    for blocks in (bpy.data.objects, bpy.data.cameras, bpy.data.scenes, bpy.data.worlds)
    for block in blocks
    if block.name.startswith("TEMP_")
)
hidden_replaced = [
    obj.name
    for obj in bpy.context.scene.objects
    if obj.get("replaced_by_v03") and obj.hide_render and obj.hide_viewport
]
packed_import_images = [
    image.name
    for image in bpy.data.images
    if image.name.startswith("IMG_") and "Imported" in image.name and image.packed_file is not None
]

result = {
    "filepath": bpy.data.filepath,
    "active_scene": bpy.context.scene.name,
    "active_camera": bpy.context.scene.camera.name if bpy.context.scene.camera else None,
    "placement_verified": bool(bpy.context.scene.get("v03_placement_verified")),
    "sets": sets,
    "total_imported_triangles": sum(item["triangles"] for item in sets),
    "hidden_replaced_proxy_count": len(hidden_replaced),
    "packed_import_image_count": len(packed_import_images),
    "temporary_datablocks": temporary_datablocks,
}
