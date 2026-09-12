import bpy
from mathutils import Vector


OUTPUT_DIR = r"C:\Personal_Projects\Framers\tmp\v03_zone_reviews"
VIEWS = [
    ("living", "CAM_STOP_01_LIVING", "TARGET_LIVING"),
    ("dining", "CAM_STOP_02_DINING", "TARGET_DINING"),
    ("celebration_bedroom", "CAM_STOP_03_CELEBRATION", "TARGET_CELEBRATION"),
    ("kids", "CAM_STOP_04_KIDS", "TARGET_KIDS"),
    ("showcase_study", "CAM_STOP_06_SHOWCASE", "TARGET_SHOWCASE"),
]


scene = bpy.context.scene
original_camera = scene.camera
original_engine = scene.render.engine
original_resolution = (
    scene.render.resolution_x,
    scene.render.resolution_y,
    scene.render.resolution_percentage,
)
original_filepath = scene.render.filepath
original_format = scene.render.image_settings.file_format

camera_data = bpy.data.cameras.new("TEMP_V03_REVIEW_CAMERA_DATA")
camera = bpy.data.objects.new("TEMP_V03_REVIEW_CAMERA", camera_data)
scene.collection.objects.link(camera)
camera.data.lens = 41.481
camera.data.sensor_width = 36.0
scene.camera = camera
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"

outputs = []
try:
    for label, stop_name, target_name in VIEWS:
        stop = bpy.data.objects.get(stop_name)
        target = bpy.data.objects.get(target_name)
        if stop is None or target is None:
            raise RuntimeError(f"Missing review helper: {stop_name} or {target_name}")
        camera.location = stop.matrix_world.translation
        direction = target.matrix_world.translation - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        path = f"{OUTPUT_DIR}\\{label}.png"
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        outputs.append(path)
finally:
    scene.camera = original_camera
    scene.render.engine = original_engine
    scene.render.resolution_x = original_resolution[0]
    scene.render.resolution_y = original_resolution[1]
    scene.render.resolution_percentage = original_resolution[2]
    scene.render.filepath = original_filepath
    scene.render.image_settings.file_format = original_format
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)

result = {"outputs": outputs}
