"""Bake the corrected living room into a separate web asset (source is read-only).

Run: blender --background --factory-startup --threads 3 --python scripts/bake_gallery_living.py
The remaining five rooms are not rebaked or simplified by this script.
"""
import bpy
import json
import time
import hashlib
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'gallery_v06/framers_gallery_v06_meshy.blend'
OUT = ROOT / 'gallery_v07'
BAKES = OUT / 'baked'
BAKES.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.frame_set(1)
bpy.context.view_layer.update()
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_adaptive_sampling = False
scene.cycles.diffuse_bounces = 3
scene.cycles.max_bounces = 5
scene.render.threads_mode = 'FIXED'
scene.render.threads = 3
scene.render.bake.use_selected_to_active = False
scene.render.bake.margin = 12

report = {'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'furniture': [], 'bakes': [], 'source_saved': False}
targets = {'Chaise_Sofa_Cushions': 80000, 'Coffee_Table_Plant_Books': 10000, 'Floor_Lamp': 8000, 'Planters_Foliage': 8000, 'Walnut_Console': 12000}
furniture = []
for suffix, budget in targets.items():
    obj = bpy.data.objects['MESHY_Living_Room_' + suffix]
    before = len(obj.data.polygons)
    transform = [list(row) for row in obj.matrix_world]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Web silhouette detail', 'DECIMATE')
    mod.ratio = min(1, budget / before)
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    assert transform == [list(row) for row in obj.matrix_world]
    report['furniture'].append(dict(object=obj.name, before=before, after=len(obj.data.polygons), matrix_world=transform))
    furniture.append(obj)
    print('LIVING_SIMPLIFIED', obj.name, before, len(obj.data.polygons), flush=True)

def plane(name, vertices, source, source_uv):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name='SourceUV')
    for loop, coord in zip(uv.data, source_uv):
        loop.uv = coord
    mesh.materials.append(source.data.materials[0])
    return obj

# Both patches sit just in front of the full source surface. The original scene
# still supplies occlusion and bounce light; deployment overlays use the same pose.
wall = bpy.data.objects['ARCH_Continuous_Rounded_U_Wall']
wall_uv = wall.data.uv_layers.active
samples = [(wall.matrix_world @ wall.data.vertices[wall.data.loops[i].vertex_index].co, wall_uv.data[i].uv.copy()) for p in wall.data.polygons for i in p.loop_indices]
left = [(p, uv) for p, uv in samples if abs(p.x + 4.8) < .005]
upper = max(left, key=lambda t:t[0].y)
lower = min(left, key=lambda t:t[0].y)
def wall_source_uv(y, z):
    u = lower[1].x + (y-lower[0].y)/(upper[0].y-lower[0].y)*(upper[1].x-lower[1].x)
    vmax = max(uv.y for p, uv in left)
    return (u, z / 3.8 * vmax)
wall_vertices = [(-4.803, 5.4, 0), (-4.803, 5.4, 3.8), (-4.803, 12.1, 3.8), (-4.803, 12.1, 0)]
wall_patch = plane('BAKED_Living_Wall', wall_vertices, wall, [wall_source_uv(v[1],v[2]) for v in wall_vertices])

floor = bpy.data.objects['ARCH_Continuous_Floor']
top = max(floor.data.polygons, key=lambda p:p.normal.z)
floor_uv = floor.data.uv_layers.active
corners = [(floor.matrix_world @ floor.data.vertices[floor.data.loops[i].vertex_index].co, floor_uv.data[i].uv.copy()) for i in top.loop_indices]
p0, uv0 = corners[0]
p1, uv1 = corners[1]
p3, uv3 = corners[3]
def floor_source_uv(x,y):
    d = Vector((x,y,0)) - p0
    e1, e3 = p1-p0, p3-p0
    return uv0 + (uv1-uv0)*d.dot(e1)/e1.length_squared + (uv3-uv0)*d.dot(e3)/e3.length_squared
floor_vertices = [(-13.6,5.4,.003),(-4.8,5.4,.003),(-4.8,12.5,.003),(-13.6,12.5,.003)]
floor_patch = plane('BAKED_Living_Floor', floor_vertices, floor, [floor_source_uv(v[0],v[1]) for v in floor_vertices])

def bake(objects, name, size, furniture_atlas=False):
    image = bpy.data.images.new(name, width=size[0], height=size[1], alpha=False)
    image.filepath_raw = str(BAKES / (name + '.png'))
    image.file_format = 'PNG'
    originals = []
    for obj in objects:
        source_name = obj.data.uv_layers.active.name
        source_coords = [loop.uv.copy() for loop in obj.data.uv_layers.active.data]
        baked_uv = obj.data.uv_layers.new(name='BakedUV')
        for i, loop in enumerate(baked_uv.data):
            loop.uv = source_coords[i] if furniture_atlas else [(0,0),(1,0),(1,1),(0,1)][i]
        obj.data.uv_layers.active = baked_uv
        baked_uv.active_render = True
        materials = list(obj.data.materials)
        originals.append((obj, materials))
        for i, source_mat in enumerate(materials):
            mat = source_mat.copy()
            obj.data.materials[i] = mat
            nodes = mat.node_tree.nodes
            uvnode = nodes.new('ShaderNodeUVMap')
            uvnode.uv_map = source_name
            for node in list(nodes):
                if node.type == 'TEX_IMAGE':
                    mat.node_tree.links.new(uvnode.outputs['UV'],node.inputs['Vector'])
            target = nodes.new('ShaderNodeTexImage')
            target.image = image
            for node in nodes:
                node.select = False
            target.select = True
            nodes.active = target
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if furniture_atlas:
        # Retain the source's coherent charts, but pack them without overlap.
        # Smart projection fragmented the reconstructed furniture into thousands
        # of tiny islands and wasted nearly all of the atlas on margins.
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(margin=.0015, margin_method='FRACTION', rotate=True)
        bpy.ops.object.mode_set(mode='OBJECT')
    started = time.time()
    print('LIVING_BAKE_START', name, size, flush=True)
    raw_path = BAKES / 'raw' / (name + '.png')
    if '--reuse-surfaces' in sys.argv and not furniture_atlas and raw_path.exists():
        bpy.data.images.remove(image)
        image = bpy.data.images.load(str(raw_path), check_existing=False)
        image.name = name
        image.filepath_raw = str(BAKES / (name + '.png'))
        image.save()
    else:
        bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR','DIRECT','INDIRECT'},use_clear=True,margin=12)
        image.save()
        raw_path.parent.mkdir(exist_ok=True)
        raw_path.write_bytes(Path(image.filepath_raw).read_bytes())
    mat = bpy.data.materials.new(name + '_Unlit')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'BakedUV'
    mat.node_tree.links.new(uv.outputs['UV'],texture.inputs['Vector'])
    mat.node_tree.links.new(texture.outputs['Color'],emission.inputs['Color'])
    mat.node_tree.links.new(emission.outputs['Emission'],output.inputs['Surface'])
    # Restore the physical shaders for subsequent bakes. Assign baked shaders
    # only after every surface has finished, to avoid changing bounce lighting.
    for obj, materials in originals:
        obj.data.materials.clear()
        for original in materials: obj.data.materials.append(original)
        obj.data.uv_layers.active = obj.data.uv_layers[0]
        obj.data.uv_layers[0].active_render = True
    report['bakes'].append(dict(name=name, dimensions=size, seconds=round(time.time()-started,1), bytes=Path(image.filepath_raw).stat().st_size))
    (OUT/'bake-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('LIVING_BAKE_READY',name,report['bakes'][-1],flush=True)
    return mat

furniture_mat = bake(furniture, 'living-furniture', (2048,2048), True)
floor_mat = bake([floor_patch], 'living-floor', (1024,1024))
wall_mat = bake([wall_patch], 'living-wall', (1024,512))
for objects, mat in [(furniture,furniture_mat),([floor_patch],floor_mat),([wall_patch],wall_mat)]:
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        obj.data.uv_layers.active = obj.data.uv_layers['BakedUV']
        obj.data.uv_layers['BakedUV'].active_render = True
        obj['gallery_baked'] = True

bpy.ops.object.select_all(action='DESELECT')
for obj in furniture + [floor_patch,wall_patch]: obj.select_set(True)
bpy.context.view_layer.objects.active = furniture[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'living-baked.glb'), export_format='GLB', use_selection=True,
    export_cameras=False, export_lights=False, export_animations=False, export_extras=True,
    export_image_format='AUTO', export_apply=True)
report['triangles'] = sum(len(o.data.polygons) for o in furniture) + 4
report['source_unchanged'] = report['source_sha256'] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert report['source_unchanged']
(OUT/'bake-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('LIVING_WEB_EXPORTED',report['triangles'],flush=True)
