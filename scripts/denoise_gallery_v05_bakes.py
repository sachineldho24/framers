"""Run Blender's bundled OpenImageDenoise on diffuse-light bake outputs."""
import ctypes as c,os,json,hashlib,shutil
from pathlib import Path
import numpy as np
from PIL import Image
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05\baked');raw=OUT/'raw';raw.mkdir(exist_ok=True)
libdir=Path(r'C:\Program Files\Blender Foundation\Blender 5.2\blender.shared');dll_directory=os.add_dll_directory(str(libdir))
# OIDN loads its device modules itself; extend this process's Win32 loader path too.
kernel=c.WinDLL('kernel32',use_last_error=True);kernel.SetDllDirectoryW.argtypes=[c.c_wchar_p];kernel.SetDllDirectoryW.restype=c.c_bool
if not kernel.SetDllDirectoryW(str(libdir)):raise OSError(c.get_last_error())
cpu_plugin=c.CDLL(str(libdir/'OpenImageDenoise_device_cpu.dll'))
lib=c.CDLL(str(libdir/'OpenImageDenoise.dll'))
def api(name,result,args):
 f=getattr(lib,name);f.restype=result;f.argtypes=args;return f
ptr=c.c_void_p;sz=c.c_size_t
newdev=api('oidnNewDevice',ptr,[c.c_int]);setdev=api('oidnSetDeviceInt',None,[ptr,c.c_char_p,c.c_int]);commitdev=api('oidnCommitDevice',None,[ptr])
newfilter=api('oidnNewFilter',ptr,[ptr,c.c_char_p]);setimage=api('oidnSetSharedFilterImage',None,[ptr,c.c_char_p,ptr,c.c_int,sz,sz,sz,sz,sz])
setbool=api('oidnSetFilterBool',None,[ptr,c.c_char_p,c.c_bool]);setint=api('oidnSetFilterInt',None,[ptr,c.c_char_p,c.c_int])
commit=api('oidnCommitFilter',None,[ptr]);execute=api('oidnExecuteFilter',None,[ptr]);error=api('oidnGetDeviceError',c.c_int,[ptr,c.POINTER(c.c_char_p)])
releasefilter=api('oidnReleaseFilter',None,[ptr]);releasedev=api('oidnReleaseDevice',None,[ptr])
device=newdev(1);setdev(device,b'numThreads',2);commitdev(device)
report_path=OUT/'denoise-manifest.json';report=json.loads(report_path.read_text()) if report_path.exists() else {}
for entry in json.loads((OUT/'manifest.json').read_text()):
 p=Path(entry['image']);sha=hashlib.sha256(p.read_bytes()).hexdigest()
 if report.get(p.name,{}).get('sha256')==sha:continue
 shutil.copy2(p,raw/p.name)
 pixels=np.asarray(Image.open(p).convert('RGB'),dtype=np.float32)/255;pixels=np.ascontiguousarray(pixels);result=np.empty_like(pixels);h,w,_=pixels.shape
 f=newfilter(device,b'RT');setimage(f,b'color',pixels.ctypes.data,3,w,h,0,0,0);setimage(f,b'output',result.ctypes.data,3,w,h,0,0,0)
 setbool(f,b'srgb',True);setbool(f,b'hdr',False);setint(f,b'maxMemoryMB',384);commit(f);execute(f)
 msg=c.c_char_p();code=error(device,c.byref(msg))
 if code:raise RuntimeError(msg.value.decode() if msg.value else str(code))
 Image.fromarray(np.uint8(np.clip(result,0,1)*255+.5)).save(p)
 releasefilter(f);report[p.name]=dict(sha256=hashlib.sha256(p.read_bytes()).hexdigest(),size=[w,h],denoiser='OpenImageDenoise RT CPU, sRGB')
 report_path.write_text(json.dumps(report,indent=2));print('BAKE_DENOISED',p.name,flush=True)
releasedev(device)
