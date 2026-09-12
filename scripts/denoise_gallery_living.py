"""Denoise diffuse bakes with Blender's bundled OIDN; preserve raw originals."""
import ctypes as c
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'gallery_v07/baked'
RAW = OUT / 'raw'
RAW.mkdir(exist_ok=True)
LIB = Path(r'C:\Program Files\Blender Foundation\Blender 5.2\blender.shared')
directory = os.add_dll_directory(str(LIB))
kernel = c.WinDLL('kernel32', use_last_error=True)
kernel.SetDllDirectoryW.argtypes = [c.c_wchar_p]
if not kernel.SetDllDirectoryW(str(LIB)): raise OSError(c.get_last_error())
plugin = c.CDLL(str(LIB / 'OpenImageDenoise_device_cpu.dll'))
lib = c.CDLL(str(LIB / 'OpenImageDenoise.dll'))
def api(name, result, args):
    fn = getattr(lib, name)
    fn.restype, fn.argtypes = result, args
    return fn
ptr, size = c.c_void_p, c.c_size_t
new_device = api('oidnNewDevice',ptr,[c.c_int])
set_device = api('oidnSetDeviceInt',None,[ptr,c.c_char_p,c.c_int])
commit_device = api('oidnCommitDevice',None,[ptr])
new_filter = api('oidnNewFilter',ptr,[ptr,c.c_char_p])
set_image = api('oidnSetSharedFilterImage',None,[ptr,c.c_char_p,ptr,c.c_int,size,size,size,size,size])
set_bool = api('oidnSetFilterBool',None,[ptr,c.c_char_p,c.c_bool])
set_int = api('oidnSetFilterInt',None,[ptr,c.c_char_p,c.c_int])
commit = api('oidnCommitFilter',None,[ptr])
execute = api('oidnExecuteFilter',None,[ptr])
get_error = api('oidnGetDeviceError',c.c_int,[ptr,c.POINTER(c.c_char_p)])
release_filter = api('oidnReleaseFilter',None,[ptr])
release_device = api('oidnReleaseDevice',None,[ptr])
device = new_device(1)
set_device(device,b'numThreads',3)
commit_device(device)
report = []
raw_glb = (ROOT/'gallery_v07/living-baked.glb').read_bytes()
json_length = struct.unpack_from('<I',raw_glb,12)[0]
gltf = json.loads(raw_glb[20:20+json_length])
binary = raw_glb[28+json_length:]
def accessor(index):
    a = gltf['accessors'][index]
    view = gltf['bufferViews'][a['bufferView']]
    width = {'SCALAR':1,'VEC2':2}[a['type']]
    dtype = {5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
    size = np.dtype(dtype).itemsize
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',width*size),size))

def pad_furniture(pixels):
    """Extend island edge colors before denoising and generating mipmaps."""
    h,w,_ = pixels.shape
    mask = Image.new('L',(w,h))
    draw = ImageDraw.Draw(mask)
    for mesh in gltf['meshes']:
        if not mesh['name'].startswith('MESHY_Living_'): continue
        primitive = mesh['primitives'][0]
        uv = accessor(primitive['attributes']['TEXCOORD_1'])
        indices = accessor(primitive['indices']).reshape(-1,3)
        for triangle in uv[indices]:
            draw.polygon([(float(p[0])*(w-1),float(p[1])*(h-1)) for p in triangle],fill=255)
    valid = np.asarray(mask)>0
    print('UV_COVERAGE',round(float(valid.mean()),3),'BLACK_INSIDE',round(float((pixels[valid].max(axis=1)<.01).mean()),3),flush=True)
    filled = pixels.copy()
    for _ in range(24):
        total = np.zeros_like(filled)
        count = np.zeros((h,w),np.float32)
        for axis,shift in [(0,1),(0,-1),(1,1),(1,-1)]:
            near = np.roll(valid,shift,axis=axis)
            if axis==0: near[0 if shift==1 else -1,:]=False
            else: near[:,0 if shift==1 else -1]=False
            total += np.roll(filled,shift,axis=axis)*near[:,:,None]
            count += near
        border = ~valid & (count>0)
        filled[border] = total[border]/count[border,None]
        valid |= border
    return np.ascontiguousarray(filled)

for name in ['living-furniture','living-floor','living-wall']:
    path = OUT / (name + '.png')
    backup = RAW / path.name
    if not backup.exists(): shutil.copy2(path,backup)
    pixels = np.ascontiguousarray(np.asarray(Image.open(backup).convert('RGB'),dtype=np.float32)/255)
    if name == 'living-furniture': pixels = pad_furniture(pixels)
    output = np.empty_like(pixels)
    h,w,_ = pixels.shape
    filt = new_filter(device,b'RT')
    set_image(filt,b'color',pixels.ctypes.data,3,w,h,0,0,0)
    set_image(filt,b'output',output.ctypes.data,3,w,h,0,0,0)
    set_bool(filt,b'srgb',True)
    set_bool(filt,b'hdr',False)
    set_int(filt,b'maxMemoryMB',384)
    commit(filt)
    execute(filt)
    message = c.c_char_p()
    if get_error(device,c.byref(message)): raise RuntimeError(message.value.decode())
    Image.fromarray(np.uint8(np.clip(output,0,1)*255+.5)).save(path)
    release_filter(filt)
    report.append(dict(image=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size))
    print('LIVING_DENOISED',path.name,flush=True)
release_device(device)
(OUT/'denoise-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
