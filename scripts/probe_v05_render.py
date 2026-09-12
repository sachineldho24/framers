import bpy,json
from pathlib import Path
out=Path(r'C:\Personal_Projects\Framers\gallery_v05')
(out/'analysis').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=4
s.render.resolution_x=160;s.render.resolution_y=100;s.render.resolution_percentage=100
s.cycles.use_denoising=True;s.cycles.denoising_use_gpu=False
s.render.filepath=str(out/'analysis/denoise-probe.png')
try:
 bpy.ops.render.render(write_still=True)
 report={'cpu_denoising':True}
except Exception as e:
 report={'cpu_denoising':False,'error':str(e)}
(out/'analysis/render-capabilities.json').write_text(json.dumps(report,indent=2))
print(report)
