"""Author reusable procedural architectural textures for the GLB scene."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

OUT=Path(r'C:\Personal_Projects\Framers\gallery_v04\textures')
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(940)

def noise(w,h,coarse=32):
    low=Image.fromarray(rng.integers(0,256,(coarse,coarse),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC)
    return np.asarray(low,dtype=float)/255-.5

def save(name,a):
    Image.fromarray(np.clip(a,0,255).astype(np.uint8),'RGB').save(OUT/f'{name}.jpg',quality=92,subsampling=0)

palette={'warm':(132,113,90),'rose':(160,119,102),'graphite':(65,61,55),'taupe':(120,112,101)}
for name,color in palette.items():
    w,h=1024,512
    x,z=np.meshgrid(np.linspace(0,1,w),np.linspace(1,0,h))
    a=np.ones((h,w,3))*np.array(color)
    a+=noise(w,h,16)[...,None]*12+noise(w,h,140)[...,None]*9+rng.normal(0,1.6,(h,w,1))
    shade=.69+.23*z
    for cx in [.18,.50,.82]:
        spread=.018+(1-z)*.19
        cone=np.exp(-((x-cx)/spread)**2)*np.exp(-((z-.76)/.50)**2)
        a+=cone[...,None]*np.array([63,47,29])
    a*=shade[...,None]
    a+=np.exp(-((z-.97)/.035)**2)[...,None]*np.array([24,18,10])
    a-=np.exp(-(z/.065)**2)[...,None]*18
    save('wall_'+name,a)

w=h=1024
x,y=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h))
grain=noise(w,h,20)*17+noise(w,h,140)*5+rng.normal(0,1.2,(h,w))
tiles=((x*8)%1<.008)|((y*8)%1<.008)
a=np.ones((h,w,3))*np.array([102,91,77])+grain[...,None]
a[tiles]*=.72
save('stone_floor',a)
for name,color in [('rug_sand',(115,104,89)),('rug_rose',(135,103,89)),('rug_graphite',(69,65,57))]:
    a=np.ones((h,w,3))*np.array(color)+noise(w,h,42)[...,None]*9+rng.normal(0,3,(h,w,1))
    a+=(np.sin(x*1600)*1.5+np.sin(y*1200)*1.5)[...,None]
    edge=np.minimum.reduce([x,1-x,y,1-y])
    a*=np.clip(.70+edge*10,0,1)[...,None]
    # Broad contact shadows keep the furniture visually grounded in a lightless viewer.
    for cx,cy,rx,ry in [(.32,.55,.19,.22),(.67,.32,.17,.15),(.52,.79,.24,.08)]:
        a*=1-.20*np.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2))[...,None]
    save(name,a)

w,h=512,1024
x,y=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h))
grain=np.sin(y*900+noise(w,h,8)*45)*3+np.sin(y*250+noise(w,h,18)*12)*5+noise(w,h,160)*7
save('walnut',np.ones((h,w,3))*np.array([76,47,27])+grain[...,None])
print('TEXTURES_READY',OUT)
