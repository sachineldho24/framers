import bpy, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Personal_Projects\Framers\gallery_v04\analysis')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'icg-reference.blend'))
scene=bpy.context.scene
mount=bpy.data.objects['ff_empty']
action=bpy.data.actions['ff_empty_action']
mount.animation_data.action=action
mount.animation_data.action_slot=action.slots[0]
for track in mount.animation_data.nla_tracks: track.mute=True
cam=bpy.data.objects['ff_camera'];scene.camera=cam
samples=[]
for f in range(97):
 scene.frame_set(f)
 samples.append({'t':f/96,'frame':f,'position':list(cam.matrix_world.translation),'quaternion_wxyz':list(cam.matrix_world.to_quaternion()),'forward':list(cam.matrix_world.to_quaternion() @ Vector((0,0,-1)))})
(ROOT/'camera-route.json').write_text(json.dumps({'source':'camera_paths.glb / ff_empty_action','vertical_fov_radians':0.5631968975067139,'samples':samples},indent=2))
# Read the original baked color textures without adding a second lighting pass.
for m in bpy.data.materials:
 if not m.use_nodes: continue
 nodes=m.node_tree.nodes;links=m.node_tree.links
 bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
 out=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
 if not bsdf or not out:continue
 emission=nodes.new('ShaderNodeEmission')
 if bsdf.inputs['Base Color'].is_linked: links.new(bsdf.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
 else:emission.inputs['Color'].default_value=bsdf.inputs['Base Color'].default_value
 links.new(emission.outputs[0],out.inputs['Surface'])
scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.resolution_x=800;scene.render.resolution_y=450;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
for f in [0,20,43,63,89]:
 scene.frame_set(f);scene.render.filepath=str(ROOT/f'iris-view-{f:02d}.png');bpy.ops.render.render(write_still=True)
# Horizontal section line segments, for an exact measured source plan.
segments=[]
for o in scene.objects:
 if o.type!='MESH':continue
 o.data.calc_loop_triangles()
 for tri in o.data.loop_triangles:
  pts=[o.matrix_world@o.data.vertices[i].co for i in tri.vertices]
  hits=[]
  for a,b in zip(pts,pts[1:]+pts[:1]):
   if (a.z-1.25)*(b.z-1.25)<0:
    v=a+(b-a)*((1.25-a.z)/(b.z-a.z));hits.append([v.x,v.y])
  if len(hits)==2:segments.append(hits)
(ROOT/'source-plan-segments.json').write_text(json.dumps(segments))
print('REFERENCE_PREVIEWS_COMPLETE')
