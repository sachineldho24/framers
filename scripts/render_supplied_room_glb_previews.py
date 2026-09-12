import bpy
import math
from mathutils import Vector


SOURCES = {
    "dining": r"C:\Users\Sachin\Downloads\dining.glb",
    "kids": r"C:\Users\Sachin\Downloads\kids.glb",
    "living": r"C:\Users\Sachin\Downloads\living.glb",
    "bedroom": r"C:\Users\Sachin\Downloads\bedroom.glb",
    "chair": r"C:\Users\Sachin\Downloads\chair.glb",
}
OUTPUT_DIR = r"C:\Personal_Projects\Framers\tmp\supplied_glb_previews"


def point_camera(camera, target):
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


original_scene = bpy.context.window.scene
preview_scene = bpy.data.scenes.new("TEMP_SUPPLIED_GLB_PREVIEW")
bpy.context.window.scene = preview_scene
preview_scene.render.engine = "BLENDER_WORKBENCH"
preview_scene.render.resolution_x = 640
preview_scene.render.resolution_y = 640
preview_scene.render.resolution_percentage = 100
preview_scene.render.image_settings.file_format = "PNG"
preview_scene.render.film_transparent = False
preview_scene.display.shading.light = "STUDIO"
preview_scene.display.shading.studio_light = "paint.sl"
preview_scene.display.shading.color_type = "MATERIAL"
preview_scene.display.shading.show_shadows = True
preview_scene.display.shading.show_cavity = True
preview_scene.display.shading.cavity_type = "WORLD"
preview_scene.display.shading.show_specular_highlight = True
preview_scene.world = bpy.data.worlds.new("TEMP_SUPPLIED_GLB_PREVIEW_WORLD")
preview_scene.world.color = (0.055, 0.055, 0.055)

camera_data = bpy.data.cameras.new("TEMP_PREVIEW_CAMERA_DATA")
camera = bpy.data.objects.new("TEMP_PREVIEW_CAMERA", camera_data)
preview_scene.collection.objects.link(camera)
preview_scene.camera = camera
camera.data.type = "ORTHO"

views = {
    "front": Vector((0.0, -1.0, 0.20)),
    "side": Vector((1.0, 0.0, 0.20)),
    "iso": Vector((1.0, -1.0, 0.72)),
}

outputs = []
try:
    for label, source_path in SOURCES.items():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=source_path)
        imported = [obj for obj in bpy.data.objects if obj not in before]
        meshes = [obj for obj in imported if obj.type == "MESH"]
        points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
        low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
        high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
        center = (low + high) * 0.5
        extent = high - low
        distance = max(extent) * 3.0

        for view_name, direction in views.items():
            direction.normalize()
            camera.location = center + direction * distance
            point_camera(camera, center)
            camera.data.ortho_scale = max(extent.x, extent.y, extent.z) * 1.30
            path = f"{OUTPUT_DIR}\\{label}_{view_name}.png"
            preview_scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            outputs.append(path)

        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
finally:
    bpy.context.window.scene = original_scene
    bpy.data.scenes.remove(preview_scene)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)

result = {"outputs": outputs}
