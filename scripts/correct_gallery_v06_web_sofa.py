"""Move the sofa islands in the existing optimized GLB, preserving other geometry."""
import bpy,json,math,warnings,shutil
import numpy as np
from pathlib import Path
from mathutils import Matrix
import sys
sys.path.insert(0, str(Path(__file__).parent))
from preserve_gallery_animation import preserve_animation
warnings.filterwarnings('ignore',category=DeprecationWarning)
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06');path=OUT/'framers_gallery_v06.glb'
fix=json.loads((OUT/'analysis/sofa-correction.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update();s=bpy.context.scene
candidates=[o for o in s.objects if o.type=='MESH' and 'ROOM_01_LIVING_MESHY_PBR' in o.name]
assert len(candidates)==1,[o.name for o in candidates]
o=candidates[0];mesh=o.data;n=len(mesh.vertices)
pos=np.empty(n*3,dtype=np.float32);mesh.vertices.foreach_get('co',pos);pos=pos.reshape(-1,3)
edges=np.empty(len(mesh.edges)*2,dtype=np.int32);mesh.edges.foreach_get('vertices',edges);edges=edges.reshape(-1,2)
# Weld positions for connectivity only; preserve the original UV and normal seams.
unique,inverse=np.unique(pos,axis=0,return_inverse=True);parents=list(range(len(unique)))
def find(a):
    while parents[a]!=a:parents[a]=parents[parents[a]];a=parents[a]
    return a
for a,b in inverse[edges].tolist():
    a=find(a);b=find(b)
    if a!=b:parents[b]=a
labels=np.array([find(i) for i in range(len(unique))],dtype=np.int32)
roots,compact=np.unique(labels,return_inverse=True);vertex_component=compact[inverse]
room_world=Matrix(fix['room_matrix_world']);to_room=room_world.inverted()@o.matrix_world
tr=np.array(to_room,dtype=np.float64);room_pos=pos@tr[:3,:3].T+tr[:3,3]
lo=np.full((len(roots),3),np.inf);hi=-lo.copy()
np.minimum.at(lo,vertex_component,room_pos);np.maximum.at(hi,vertex_component,room_pos)
old=fix['old_placement']['room_bounds'];low=np.array(old['min'])-.006;high=np.array(old['max'])+.006
selected_components=np.all(lo>=low,axis=1)&np.all(hi<=high,axis=1)
selected=selected_components[vertex_component]
loop_vertices=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',loop_vertices)
loop_mask=selected[loop_vertices]
selected_triangles=int(loop_mask.sum()//3)
expected=next(x['web_triangles'] for x in json.loads((OUT/'web-geometry.json').read_text()) if 'Chaise_Sofa' in x['object'])
assert abs(selected_triangles-expected)<=max(30,expected*.002),(selected_triangles,expected,lo.tolist(),hi.tolist())
delta_local=o.matrix_world.inverted()@room_world@Matrix(fix['delta_room'])@room_world.inverted()@o.matrix_world
dm=np.array(delta_local,dtype=np.float64)
normals=np.empty(len(mesh.loops)*3,dtype=np.float32);mesh.corner_normals.foreach_get('vector',normals);normals=normals.reshape(-1,3)
original=pos.copy();pos[selected]=pos[selected]@dm[:3,:3].T+dm[:3,3]
normals[loop_mask]=normals[loop_mask]@dm[:3,:3].T
normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
mesh.vertices.foreach_set('co',pos.ravel());mesh.update();mesh.normals_split_custom_set(normals)
assert np.array_equal(pos[~selected],original[~selected]),'Other furniture geometry changed'
o['sofa_orientation']='Left side, reference matched'
report={'mesh':o.name,'geometric_islands':len(roots),'moved_islands':int(selected_components.sum()),
        'moved_vertices':int(selected.sum()),'moved_triangles':selected_triangles,'expected_sofa_triangles':expected,
        'other_vertices_unchanged':True,'normals_rotated':True}
(OUT/'analysis/web-sofa-correction.json').write_text(json.dumps(report,indent=2))
print('V06_WEB_SOFA_MOVED',json.dumps(report),flush=True)
for a in bpy.data.actions:a.name='Framers_Continuous_Tour'
staging=OUT/'analysis/framers_gallery_v06_sofa_corrected.glb'
bpy.ops.export_scene.gltf(filepath=str(staging),export_format='GLB',export_cameras=True,export_lights=True,
    export_extras=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,
    export_frame_step=15,export_image_format='AUTO',export_jpeg_quality=92,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_apply=True)
preserve_animation(path, staging)
shutil.copy2(path,OUT/'analysis/framers_gallery_v06_before_sofa_correction.glb')
staging.replace(path)
print('V06_WEB_SOFA_CORRECTION_COMPLETE',flush=True)
