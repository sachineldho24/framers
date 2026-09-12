"""Export a lighter browser model without changing the full-detail authoring file."""
import bpy,json,time,warnings
from pathlib import Path
warnings.filterwarnings('ignore',category=DeprecationWarning)
ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v06'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v06_meshy.blend'))
scene=bpy.context.scene;SHELL=bpy.data.objects['00_CONTINUOUS_ARCHITECTURE'];report=[]
for o in [o for o in scene.objects if o.type=='MESH' and o.name.startswith('MESHY_')]:
    before=len(o.data.polygons);target=min(180000,max(6000,round(before*.14)))
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Browser mesh detail','DECIMATE');mod.ratio=min(1,target/before);mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o['web_optimized']=True;o['authoring_triangles']=before
    report.append(dict(object=o.name,source_triangles=before,web_triangles=len(o.data.polygons)))
    print('V06_WEB_REDUCED',o.name,before,len(o.data.polygons),flush=True)
(OUT/'web-geometry.json').write_text(json.dumps(report,indent=2))
# Physical materials are evaluated by the browser light rig. Do not reuse v05 bakes,
# whose shadows belong to superseded furniture.
code=(ROOT/'scripts/build_gallery_v05.py').read_text(encoding='utf-8')
code=code[code.index('# Resolve modifiers and join'):]
code=code.replace("'framers_gallery_v05.glb'","'framers_gallery_v06.glb'").replace('V05_','V06_')
exec(code)
print('V06_WEB_EXPORT_COMPLETE',flush=True)
