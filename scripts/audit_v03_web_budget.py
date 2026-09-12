"""Headless audit of the v03 furnished scene against the ICG web budget.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
      framers_gallery_ribbon_v03_furnished.blend -P scripts/audit_v03_web_budget.py

Reference budget taken from the captured ICG first-floor payload
(webgl/models/ff_pov-mobile.glb): 124,140 triangles, 17 meshes, 16 materials,
17 WebP images, 1.80 MB on the wire with Draco + EXT_texture_webp.
"""

import json
import bpy

scene = bpy.context.scene
depsgraph = bpy.context.evaluated_depsgraph_get()

visible = []
for obj in scene.objects:
    if obj.type != "MESH":
        continue
    if obj.hide_render:
        continue
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    triangles = sum(max(1, len(poly.vertices) - 2) for poly in mesh.polygons)
    evaluated.to_mesh_clear()
    visible.append(
        {
            "name": obj.name,
            "zone": obj.get("gallery_zone"),
            "triangles": triangles,
            "imported": bool(obj.get("source_glb")),
        }
    )

visible.sort(key=lambda item: item["triangles"], reverse=True)
imported = [item for item in visible if item["imported"]]
native = [item for item in visible if not item["imported"]]

images = []
for image in bpy.data.images:
    if not image.users:
        continue
    packed = image.packed_file
    images.append(
        {
            "name": image.name,
            "size": list(image.size),
            "packed_bytes": packed.size if packed else 0,
        }
    )
images.sort(key=lambda item: item["packed_bytes"], reverse=True)

report = {
    "blend": bpy.data.filepath,
    "totals": {
        "visible_mesh_objects": len(visible),
        "visible_triangles": sum(item["triangles"] for item in visible),
        "imported_set_triangles": sum(item["triangles"] for item in imported),
        "native_triangles": sum(item["triangles"] for item in native),
        "materials_in_use": len([m for m in bpy.data.materials if m.users]),
        "lights": len([o for o in scene.objects if o.type == "LIGHT" and not o.hide_render]),
        "packed_image_bytes": sum(item["packed_bytes"] for item in images),
        "image_count": len(images),
    },
    "icg_first_floor_reference": {
        "triangles": 124140,
        "meshes": 17,
        "materials": 16,
        "wire_bytes": 1801172,
    },
    "imported_sets": imported,
    "heaviest_native": native[:15],
    "heaviest_images": images[:15],
}

print("BUDGET_AUDIT_JSON_START")
print(json.dumps(report, indent=2))
print("BUDGET_AUDIT_JSON_END")
