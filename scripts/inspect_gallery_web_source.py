"""Read the corrected authoring file in background Blender; never save it."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'gallery_v07'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'gallery_v06/framers_gallery_v06_meshy.blend'))
scene = bpy.context.scene
objects = []
for obj in scene.objects:
    if obj.name.startswith(('MESHY_Living_', 'ARCH_Continuous_', 'ART_01', 'LIGHT_Key_01', 'LIGHT_Art_01', 'CAM_ROOM_01', 'ROOM_01')):
        objects.append(dict(name=obj.name, type=obj.type, parent=obj.parent.name if obj.parent else None,
            position=list(obj.matrix_world.translation), matrix=[list(row) for row in obj.matrix_world],
            bounds=[list(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box],
            polygons=len(obj.data.polygons) if obj.type == 'MESH' else None,
            uv_layers=[uv.name for uv in obj.data.uv_layers] if obj.type == 'MESH' else [],
            materials=[m.name for m in obj.data.materials] if obj.type == 'MESH' else [],
            modifiers=[dict(name=m.name, type=m.type) for m in obj.modifiers]))
materials = []
for mat in bpy.data.materials:
    if mat.name.startswith('MESHY_PBR_Living') or mat.name in {'PBR_Honed_Limestone', 'PBR_Limewash_chalk'}:
        materials.append(dict(name=mat.name, nodes=[dict(name=n.name, type=n.type,
            image=n.image.name if n.type == 'TEX_IMAGE' and n.image else None,
            inputs={i.name: str(i.default_value) for i in n.inputs if hasattr(i, 'default_value')}) for n in mat.node_tree.nodes]))
result = dict(objects=objects, materials=materials, lights=[dict(name=o.name, type=o.data.type, energy=o.data.energy, position=list(o.matrix_world.translation)) for o in scene.objects if o.type == 'LIGHT'],
    view=dict(transform=scene.view_settings.view_transform, look=scene.view_settings.look, exposure=scene.view_settings.exposure),
    engine=scene.render.engine, world=scene.world.name if scene.world else None)
(OUT / 'source-inspection.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print('GALLERY_SOURCE_INSPECTED', len(objects), flush=True)
