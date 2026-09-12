import bpy
import os

ROOT = r"C:\Personal_Projects\Framers"
scene = bpy.context.scene
camera = bpy.data.objects["CAM_MAIN_V02"]

# Use the saved, approved Entry camera without modifying its transform or optics.
scene.camera = camera
scene.render.use_compositing = False
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.eevee.taa_render_samples = 128

if os.environ.get("FRAMERS_NEUTRAL_ONLY") != "1":
    scene.render.filepath = ROOT + r"\v02_1_entry_lookdev.png"
    bpy.ops.render.render(write_still=True)

# Material-only control: neutralize artwork temporarily, render, then restore.
neutral = bpy.data.materials["M99_Neutral_Artwork_Control"]
original_slots = {}
for obj in scene.objects:
    if obj.type == "MESH" and obj.name.startswith("ART_"):
        original_slots[obj.name] = [material for material in obj.data.materials]
        obj.data.materials.clear()
        obj.data.materials.append(neutral)

scene.render.filepath = ROOT + r"\v02_1_entry_neutral_art.png"
bpy.ops.render.render(write_still=True)

for name, materials in original_slots.items():
    obj = bpy.data.objects[name]
    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)

print("Rendered v02.1 Entry/Living lookdev and neutral-art control")
