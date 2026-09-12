"""Geometry checks or physical Cycles review images of the integrated gallery."""
import bpy,sys,time,json
from pathlib import Path
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06')
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
mode=args[0] if args else 'draft'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v06_meshy.blend'))
s=bpy.context.scene;s.render.threads_mode='FIXED';s.render.threads=3
s.render.resolution_x=1100;s.render.resolution_y=700;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'
if mode=='draft':
    s.render.engine='BLENDER_WORKBENCH';sh=s.display.shading;sh.light='STUDIO';sh.studio_light='paint.sl';sh.color_type='TEXTURE'
    sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH';s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0
else:
    s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.use_denoising=True;s.cycles.denoising_use_gpu=False
    s.cycles.samples=24;s.cycles.adaptive_threshold=.055;s.cycles.time_limit=150
    s.render.resolution_x=1200;s.render.resolution_y=760
    s.render.use_persistent_data=True
shots=[('01-living','CAM_ROOM_01_LIVING',0),('03-together','CAM_ROOM_03_TOGETHER',0),
       ('04-childhood','CAM_ROOM_04_CHILDHOOD',0),('05-study','CAM_ROOM_05_STUDY',0),
       ('06-anniversary','CAM_ROOM_06_ANNIVERSARY',0),('07-continuous-west',None,.31),('08-continuous-east',None,.69)]
for name,cam,p in shots:
    if len(args)>1 and name not in args[1:]:continue
    target=OUT/('analysis' if mode=='draft' else 'previews')/((mode+'-' if mode=='draft' else '')+name+'.png')
    if target.exists() and mode!='draft' and '--refresh' not in args:continue
    s.camera=bpy.data.objects[cam or 'CAM_TOUR'];s.frame_set(1+round(p*2880));s.render.filepath=str(target)
    print('V06_RENDER_START',name,flush=True);start=time.time()
    bpy.ops.render.render(write_still=True)
    print('V06_RENDER_READY',name,round(time.time()-start,1),flush=True)
print('V06_RENDER_COMPLETE',mode,flush=True)
