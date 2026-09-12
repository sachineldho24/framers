import bpy,json,math
from pathlib import Path
from mathutils import Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v04')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v04.blend'))
scene=bpy.context.scene
data=json.loads((OUT/'gallery-structure.json').read_text())
deps=bpy.context.evaluated_depsgraph_get();hits=[]
for s in data['camera_samples']:
    p=Vector(s['position_blender'])
    for i in range(16):
        a=2*math.pi*i/16;direction=Vector((math.cos(a),math.sin(a),0))
        found,loc,normal,index,obj,matrix=scene.ray_cast(deps,p,direction,distance=.32)
        if found:hits.append({'progress':s['progress'],'distance':(loc-p).length,'object':obj.name})
removed={o.name:o.get('removed_duplicate_print_vertices') for o in scene.objects if o.name.startswith('FURNITURE_')}
report={'camera_samples':len(data['camera_samples']),'clearance_radius_metres':.32,'near_geometry':hits,'duplicate_print_vertices_removed':removed}
(OUT/'path-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
