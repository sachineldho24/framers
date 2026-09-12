import bpy
import json
from mathutils import Vector


def world_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    size = maximum - minimum
    return {
        "minimum_xyz": [round(value, 4) for value in minimum],
        "maximum_xyz": [round(value, 4) for value in maximum],
        "world_size_xyz": [round(value, 4) for value in size],
    }


groups = {
    "FRM_frame_hero_living": ["FRAME_Living_Hero", "ART_Living_Hero"],
    "FRM_frame_hero_dining": ["FRAME_Dining_Hero", "ART_Dining_Hero"],
    "FRM_frame_hero_celebration": ["FRAME_Celebration_Hero", "ART_Celebration_Hero"],
    "FRM_frame_hero_kids": ["FRAME_Kids_Hero", "ART_Kids_Hero"],
    "FRM_frame_hero_automobile": ["FRAME_Automobile_Hero", "ART_Automobile_Hero"],
    "FRM_frame_hero_showcase": ["FRAME_Showcase_Hero", "ART_Showcase_Hero"],
    "FRM_frame_hero_signature": ["FRAME_Signature_Hero", "ART_Signature_Hero"],
    "SEA_sofa_living": [name for name in bpy.data.objects.keys() if name.startswith("SOFA_Living_01_")],
    "SEA_chair_living_accent": [name for name in bpy.data.objects.keys() if name.startswith("CHAIR_Living_Accent_")],
    "SEA_chair_dining": [name for name in bpy.data.objects.keys() if name.startswith("CHAIR_Dining_01_")],
    "SEA_bench_celebration": [name for name in bpy.data.objects.keys() if name.startswith("BENCH_Celebration_01_")],
    "SEA_bench_signature": ["BENCH_Signature_01"],
    "TAB_table_living_coffee": ["TABLE_Living_Coffee"],
    "TAB_table_dining": ["TABLE_Dining_01"],
    "STO_console_celebration": ["CONSOLE_Celebration_01"],
    "STO_console_signature": ["CONSOLE_Signature_01"],
    "BED_kids": ["BED_Kids_01", "HEADBOARD_Kids_01"],
    "TOY_kids_soft_set": ["TOY_Kids_01", "TOY_Kids_02"],
    "AUT_vehicle_silhouette": [name for name in bpy.data.objects.keys() if name.startswith("CAR_Automobile_")],
    "DSP_plinth_celebration": ["PLINTH_Celebration_Glow"],
    "DSP_plinth_showcase_01": ["PLINTH_Showcase_01"],
    "DSP_plinth_showcase_02": ["PLINTH_Showcase_02"],
    "FRM_tabletop_showcase_01": ["OBJECT_Showcase_FrameProxy_01"],
    "FRM_tabletop_showcase_02": ["OBJECT_Showcase_FrameProxy_02"],
    "DEC_planter_plant_small": ["PLANT_01_Pot", "PLANT_01_Leaf"],
    "DEC_planter_plant_medium": ["PLANT_03_Pot", "PLANT_03_Leaf"],
    "DEC_planter_plant_large": ["PLANT_02_Pot", "PLANT_02_Leaf"],
}

for asset_id, anchors in list(groups.items()):
    if not asset_id.startswith("FRM_frame_hero_"):
        continue
    zone = asset_id.removeprefix("FRM_frame_hero_").title()
    groups[asset_id] = [
        obj.name
        for obj in bpy.data.objects
        if (
            obj.name in anchors
            or obj.name.startswith(f"FRAME_{zone}_Hero_")
            or (zone == "Living" and obj.name in {
                "GLASS_Living_Hero", "BACKING_Living_Hero", "SHADOW_GAP_Living_Hero"
            })
        )
    ]

payload = {}
for asset_id, names in groups.items():
    objects = [bpy.data.objects[name] for name in names if name in bpy.data.objects]
    payload[asset_id] = {
        "objects": sorted(obj.name for obj in objects),
        "bounds": world_bounds(objects),
    }

print("ASSET_REFERENCE_AUDIT=" + json.dumps(payload, sort_keys=True))

scene = bpy.context.scene
camera = bpy.data.objects.get("CAM_MAIN_V02")
settings = {
    "render_engine": scene.render.engine,
    "resolution": [scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage],
    "samples": scene.eevee.taa_render_samples,
    "film_transparent": scene.render.film_transparent,
    "png_color_mode": scene.render.image_settings.color_mode,
    "png_color_depth": scene.render.image_settings.color_depth,
    "png_compression": scene.render.image_settings.compression,
    "view_transform": scene.view_settings.view_transform,
    "look": scene.view_settings.look,
    "exposure": scene.view_settings.exposure,
    "gamma": scene.view_settings.gamma,
}
if camera:
    settings["camera"] = {
        "name": camera.name,
        "location": [round(value, 6) for value in camera.location],
        "rotation_euler": [round(value, 6) for value in camera.rotation_euler],
        "lens_mm": camera.data.lens,
        "sensor_width_mm": camera.data.sensor_width,
        "sensor_height_mm": camera.data.sensor_height,
        "sensor_fit": camera.data.sensor_fit,
        "clip_start_m": camera.data.clip_start,
        "clip_end_m": camera.data.clip_end,
        "angle_degrees": round(camera.data.angle * 180.0 / 3.141592653589793, 6),
    }
print("REFERENCE_SETTINGS_AUDIT=" + json.dumps(settings, sort_keys=True))
