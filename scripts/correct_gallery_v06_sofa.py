"""Turn the living sofa along the left side, matching the supplied reference."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v06_meshy.blend'))
s=bpy.context.scene;s.frame_set(1);bpy.context.view_layer.update()
sofa=bpy.data.objects['MESHY_Living_Room_Chaise_Sofa_Cushions'];room=bpy.data.objects['ROOM_01_LIVING']
manifest=json.loads((OUT/'integration-manifest.json').read_text())
entry=next(x for x in manifest['placements'] if x['object']==sofa.name)
old_matrix=room.matrix_world.inverted()@sofa.matrix_world
old_entry=json.loads(json.dumps(entry))
other={o.name:[list(r) for r in o.matrix_world] for o in s.objects if o!=sofa}
# The object data was recentered at its exact bottom-centre during import.
new_matrix=Matrix.Translation(Vector((-1.55,-2.50,.039)))@Matrix.Scale(2.35,4)
sofa.matrix_basis=new_matrix
bpy.context.view_layer.update()
delta=new_matrix@old_matrix.inverted()
points=[room.matrix_world.inverted()@sofa.matrix_world@Vector(v) for v in sofa.bound_box]
entry['room_bounds']={'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
entry['matrix_world']=[list(r) for r in sofa.matrix_world];entry['dimensions_metres']=list(sofa.dimensions)
assert all([list(r) for r in bpy.data.objects[n].matrix_world]==v for n,v in other.items()),'An unrelated object moved'
assert entry['room_bounds']['min'][2]>=.035
record={'object':sofa.name,'room':'01_LIVING','old_placement':old_entry,'new_placement':entry,
    'delta_room':[list(r) for r in delta],'room_matrix_world':[list(r) for r in room.matrix_world],
    'rotation_change_degrees':90,'unrelated_object_transforms_unchanged':True}
(OUT/'analysis/sofa-correction.json').write_text(json.dumps(record,indent=2))
(OUT/'integration-manifest.json').write_text(json.dumps(manifest,indent=2))
meta=json.loads((OUT/'gallery-structure.json').read_text())
meta['living_sofa_orientation']='Long back along the left side; chaise toward the centre, matching the supplied reference.'
(OUT/'gallery-structure.json').write_text(json.dumps(meta,indent=2))
bpy.context.preferences.filepaths.save_version=0;s.camera=bpy.data.objects['CAM_TOUR']
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'framers_gallery_v06_meshy.blend'),compress=True)
print('V06_SOFA_CORRECTED',json.dumps(record),flush=True)
# Immediate composition review; does not overwrite the physical render settings in the blend.
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=1200;s.render.resolution_y=760;s.render.resolution_percentage=100
sh=s.display.shading;sh.light='STUDIO';sh.studio_light='paint.sl';sh.color_type='TEXTURE';sh.show_shadows=True;sh.show_cavity=True
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0
s.camera=bpy.data.objects['CAM_ROOM_01_LIVING'];s.render.filepath=str(OUT/'analysis/sofa-corrected-composition.png')
bpy.ops.render.render(write_still=True)
print('V06_SOFA_COMPOSITION_READY',flush=True)
