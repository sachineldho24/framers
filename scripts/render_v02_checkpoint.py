import bpy
from mathutils import Vector

ROOT = r"C:\Personal_Projects\Framers"
scene = bpy.context.scene
scene.render.use_compositing = False
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False

cam = bpy.data.objects["CAM_MAIN_V02"]
scene.camera = cam


def aim(pos, target):
    cam.location = pos
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()


shots = {
    "entry": ((7.25, -13.35, 1.70), (14.35, -7.35, 1.58)),
    "first_transition": ((8.00, -5.85, 1.70), (11.50, 2.65, 1.52)),
    "deep_turn": ((8.75, 3.90, 1.70), (4.15, 11.45, 1.55)),
    "signature_reveal": ((-7.55, 2.35, 1.70), (-14.25, -9.65, 1.58)),
}

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 540
for name, (position, target) in shots.items():
    aim(position, target)
    scene.render.filepath = ROOT + rf"\v02_checkpoint_{name}.png"
    bpy.ops.render.render(write_still=True)

hidden = []
for obj in scene.objects:
    if obj.name.startswith("CEILING_") or obj.name.startswith("LIGHT_") or obj.name.startswith("RAIL_"):
        hidden.append((obj, obj.hide_render))
        obj.hide_render = True
for obj in scene.objects:
    if obj.name.startswith("MARKER_CAM_STOP_") or obj.name in {"PATH_GUIDE_V02", "SIGHTLINE_Dining_to_Signature"}:
        obj.hide_render = False

top_data = bpy.data.cameras.new("CAM_AUDIT_TOP_Data")
top_data.type = "ORTHO"
top_data.ortho_scale = 37
top = bpy.data.objects.new("CAM_AUDIT_TOP", top_data)
scene.collection.objects.link(top)
top.location = (0, 0, 42)
top.rotation_euler = (Vector((0, 0, 0)) - top.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = top
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 850
scene.render.filepath = ROOT + r"\v02_checkpoint_top.png"
bpy.ops.render.render(write_still=True)

print("Rendered v02 structural checkpoint views")
