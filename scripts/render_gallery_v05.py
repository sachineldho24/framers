"""Cycles review of continuous architecture and its real material/lighting system."""
import bpy,json,sys,time
from pathlib import Path
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05')
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
mode=args[0] if args else 'draft'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
s=bpy.context.scene;s.cycles.use_denoising=True;s.cycles.denoising_use_gpu=False
s.render.resolution_x=960 if mode=='draft' else 1600;s.render.resolution_y=540 if mode=='draft' else 900
s.cycles.samples=20 if mode=='draft' else 32;s.cycles.adaptive_threshold=.06 if mode=='draft' else .045
s.render.threads_mode='FIXED';s.render.threads=3
tour=bpy.data.objects['CAM_TOUR'];meta=json.loads((OUT/'gallery-structure.json').read_text())
if mode=='draft':shots=[('draft-entry',0,None),('draft-transition',.31,None),('draft-east',.69,None)]
else:shots=[('01-living',0,'CAM_ROOM_01_LIVING'),('02-motoring',0,'CAM_ROOM_02_MOTORING'),('03-together',0,'CAM_ROOM_03_TOGETHER'),('04-childhood',0,'CAM_ROOM_04_CHILDHOOD'),('05-study',0,'CAM_ROOM_05_STUDY'),('06-anniversary',0,'CAM_ROOM_06_ANNIVERSARY'),('07-continuous-west',.31,None),('08-continuous-east',.69,None)]
for name,p,cam in shots:
 if mode!='draft' and (OUT/'previews'/(name+'.png')).exists():
  print('V05_RENDER_EXISTS',name,flush=True);continue
 if mode!='draft':
  s.render.resolution_x=1280 if cam else 1600;s.render.resolution_y=720 if cam else 900
  s.cycles.time_limit=180 if cam else 240
 s.camera=bpy.data.objects[cam] if cam else tour;s.frame_set(1+round(p*2880))
 s.render.filepath=str(OUT/'previews'/(name+'.png'));start=time.time()
 print('V05_RENDER_START',name,flush=True)
 bpy.ops.render.render(write_still=True)
 print('V05_RENDER_READY',name,round(time.time()-start,1),flush=True)
print('V05_RENDER_BATCH_COMPLETE',mode,flush=True)
