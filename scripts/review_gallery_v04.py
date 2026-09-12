"""Validate and render the actual exported GLB, not an alternate render scene."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v04')
PREVIEW=OUT/'previews';PREVIEW.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'framers_gallery_v04.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=1120;scene.render.resolution_y=630;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.world=bpy.data.worlds.new('Review_Background');scene.world.color=(.03,.025,.018)
meta=json.loads((OUT/'gallery-structure.json').read_text())
scene.view_layers.update()
errors=[]
for s in meta['rooms']:
    for name in ['ROOM_'+s['id'],'ART_'+s['id'],s['camera']]:
        if name not in bpy.data.objects:errors.append('Missing '+name)
tour=bpy.data.objects['CAM_TOUR']
if not bpy.data.actions:errors.append('No animation imported from GLB')
if tour.animation_data and tour.animation_data.action is None:
    action=next((a for a in bpy.data.actions if 'FirstFloor' in a.name),bpy.data.actions[0])
    tour.animation_data.action=action;tour.animation_data.action_slot=action.slots[0]
    for track in tour.animation_data.nla_tracks:track.mute=True
scene.frame_set(1)
audit={'errors':errors,'meshes':sum(o.type=='MESH' for o in scene.objects),'triangles':sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons),'cameras':[o.name for o in scene.objects if o.type=='CAMERA'],'actions':[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions],'images':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images],'ray_checks':[]}
# A room view must hit its own room, and the tour camera must have head clearance.
depsgraph=bpy.context.evaluated_depsgraph_get()
for s in meta['rooms']:
    cam=bpy.data.objects[s['camera']];pos=cam.matrix_world.translation
    forward=cam.matrix_world.to_quaternion()@Vector((0,0,-1))
    hit,loc,normal,index,obj,matrix=scene.ray_cast(depsgraph,pos,forward,distance=30)
    audit['ray_checks'].append({'camera':cam.name,'position':list(pos),'first_hit':obj.name if hit else None,'distance':(loc-pos).length if hit else None})
    if hit and (loc-pos).length<1.0:errors.append('View immediately blocked: '+cam.name)
(OUT/'validation.json').write_text(json.dumps(audit,indent=2))
if errors:print('VALIDATION_ERRORS',errors)
for s in meta['rooms']:
    scene.camera=bpy.data.objects[s['camera']]
    scene.render.filepath=str(PREVIEW/(s['id'].lower()+'.png'))
    bpy.ops.render.render(write_still=True)
    print('REVIEW_READY',s['id'],flush=True)
scene.camera=tour;scene.frame_set(1)
scene.render.filepath=str(PREVIEW/'00_tour_entry.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'analysis/export-review.blend'))
print('V04_REVIEW_COMPLETE',json.dumps(audit),flush=True)
