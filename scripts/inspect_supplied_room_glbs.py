import bpy
from mathutils import Vector


SOURCE_PATHS = [
    r"C:\Users\Sachin\Downloads\dining.glb",
    r"C:\Users\Sachin\Downloads\kids.glb",
    r"C:\Users\Sachin\Downloads\living.glb",
    r"C:\Users\Sachin\Downloads\bedroom.glb",
    r"C:\Users\Sachin\Downloads\chair.glb",
]


def bounds(objects):
    points = []
    for obj in objects:
        if obj.type == "MESH":
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return {
        "min": [round(v, 6) for v in low],
        "max": [round(v, 6) for v in high],
        "dimensions": [round(v, 6) for v in high - low],
    }


scene_objects = {}
for name in [
    "SOFA_Living_01_Base",
    "CHAIR_Living_Accent_Seat",
    "TABLE_Living_Coffee",
    "TABLE_Dining_01",
    "CHAIR_Dining_01_Seat",
    "BED_Kids_01",
    "HEADBOARD_Kids_01",
    "TOY_Kids_01",
    "TOY_Kids_02",
    "TARGET_LIVING",
    "TARGET_DINING",
    "TARGET_KIDS",
    "CAM_STOP_01_LIVING",
    "CAM_STOP_02_DINING",
    "CAM_STOP_04_KIDS",
]:
    obj = bpy.data.objects.get(name)
    if obj:
        scene_objects[name] = {
            "type": obj.type,
            "location": [round(v, 6) for v in obj.matrix_world.translation],
            "rotation": [round(v, 6) for v in obj.rotation_euler],
            "dimensions": [round(v, 6) for v in obj.dimensions],
            "parent": obj.parent.name if obj.parent else None,
        }

glbs = {}
for source_path in SOURCE_PATHS:
    before_objects = set(bpy.data.objects)
    before_meshes = set(bpy.data.meshes)
    before_materials = set(bpy.data.materials)
    before_images = set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=source_path)
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    glbs[source_path] = {
        "object_count": len(imported),
        "mesh_count": len(mesh_objects),
        "root_names": [obj.name for obj in imported if obj.parent not in imported][:20],
        "sample_names": [obj.name for obj in imported[:30]],
        "materials": sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material})[:30],
        "bounds": bounds(imported),
    }

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in [mesh for mesh in bpy.data.meshes if mesh not in before_meshes]:
        bpy.data.meshes.remove(mesh)
    for material in [material for material in bpy.data.materials if material not in before_materials]:
        bpy.data.materials.remove(material)
    for image in [image for image in bpy.data.images if image not in before_images]:
        bpy.data.images.remove(image)

result = {
    "blend_file": bpy.data.filepath,
    "scene": bpy.context.scene.name,
    "scene_objects": scene_objects,
    "glbs": glbs,
}
