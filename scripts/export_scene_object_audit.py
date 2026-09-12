import bpy
import csv
import io


MODULAR_PREFIXES = (
    "FRAME_", "ART_", "GLASS_", "BACKING_", "SHADOW_GAP_",
    "SOFA_", "CHAIR_", "BENCH_", "TABLE_", "CONSOLE_", "BED_",
    "HEADBOARD_", "TOY_", "CAR_", "PLINTH_", "OBJECT_Showcase_", "PLANT_",
)
ARCH_COLLECTIONS = {"FLOOR", "WALLS", "CEILING", "OPENINGS", "WINDOWS", "DOORS", "ARCHITECTURE"}
HELPER_COLLECTIONS = {"HELPERS", "CAMERA_RIG"}


def classify(obj):
    collections = {collection.name for collection in obj.users_collection}
    if obj.name.startswith(MODULAR_PREFIXES):
        return "modular_asset", "capture_or_context"
    if obj.type == "LIGHT" or "LIGHTING" in collections or obj.name.startswith("LIGHT_"):
        return "lighting", "preserve_in_blender"
    if obj.type in {"CAMERA", "EMPTY"} or collections & HELPER_COLLECTIONS:
        return "helper_camera", "preserve_in_blender"
    if collections & ARCH_COLLECTIONS:
        return "authoritative_architecture", "preserve_in_blender"
    if obj.type == "CURVE" and obj.name.startswith("RAIL_"):
        return "authoritative_architecture", "preserve_in_blender"
    return "non_generation_scene_support", "preserve_in_blender"


buffer = io.StringIO()
writer = csv.writer(buffer, lineterminator="\n")
writer.writerow([
    "object_name", "object_type", "collections", "source_role", "generation_action",
    "location_x_m", "location_y_m", "location_z_m", "hide_render",
])
for obj in sorted(bpy.data.objects, key=lambda item: item.name.lower()):
    role, action = classify(obj)
    writer.writerow([
        obj.name,
        obj.type,
        ";".join(sorted(collection.name for collection in obj.users_collection)),
        role,
        action,
        f"{obj.location.x:.6f}",
        f"{obj.location.y:.6f}",
        f"{obj.location.z:.6f}",
        str(bool(obj.hide_render)).lower(),
    ])

print("SCENE_OBJECT_AUDIT_CSV_BEGIN")
print(buffer.getvalue(), end="")
print("SCENE_OBJECT_AUDIT_CSV_END")
