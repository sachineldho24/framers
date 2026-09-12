"""Seamless albedo and tangent normals for physical gallery materials."""
from pathlib import Path
import numpy as np
from PIL import Image
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v05\textures');OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(508)
n=1024;y,x=np.mgrid[0:n,0:n]/n
def noise(octaves=5):
 a=np.zeros((n,n))
 for k in range(octaves):
  for j in range(5):
   fx,fy=rng.integers(-2**(k+1),2**(k+1)+1,2)
   a+=np.sin(2*np.pi*(fx*x+fy*y)+rng.uniform(0,6.28))/(2**k*5)
 return a
def save(name,a):Image.fromarray(np.clip(a,0,255).astype('uint8')).save(OUT/(name+'.jpg'),quality=93,subsampling=0)
def normal(name,h,strength):
 dx=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*strength
 dy=(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*strength
 v=np.stack([-dx,-dy,np.ones_like(h)],axis=-1);v/=np.linalg.norm(v,axis=-1)[...,None]
 Image.fromarray(np.uint8(np.clip((v*.5+.5)*255,0,255))).save(OUT/(name+'_normal.png'))
cloud=noise();fine=noise(8)
stone=cloud*5+fine*2
save('limestone',np.array([183,175,160])+stone[...,None]);normal('limestone',fine,1.4)
vein=np.abs(np.sin(2*np.pi*(x*3+y*2)+cloud*6))
vein=np.exp(-vein*44)*.7+np.exp(-vein*14)*.10
save('ivory_marble',np.array([215,210,196])+cloud[...,None]*9-vein[...,None]*np.array([85,82,76]));normal('ivory_marble',fine,.5)
save('black_marble',np.array([34,37,36])+cloud[...,None]*6+vein[...,None]*np.array([105,102,90]))
grain=np.sin(2*np.pi*y*63+cloud*4)*2.2+np.sin(2*np.pi*y*211+cloud*6)*1.2+cloud*8
save('walnut',np.array([101,65,39])+grain[...,None]);normal('walnut',grain/15,.7)
weave=np.sin(x*2*np.pi*320)*np.sin(y*2*np.pi*256)*1.8+fine*1.8
for name,col in [('linen',(202,191,171)),('rose',(178,137,125)),('oatmeal',(181,163,134)),('charcoal',(45,44,39)),('ivory',(223,215,198))]:
 save('fabric_'+name,np.array(col)+weave[...,None]+cloud[...,None]*2)
normal('fabric',weave/4,2.4)
leather=np.abs(noise(8))*6
save('leather',np.array([53,35,23])+leather[...,None]);normal('leather',fine,1.8)
for name,col in [('chalk',(185,177,162)),('rose',(154,113,99)),('graphite',(66,66,59)),('sand',(165,148,121))]:
 save('plaster_'+name,np.array(col)+cloud[...,None]*4+fine[...,None]*1.7)
normal('plaster',fine,1.9)
print('V05_PBR_TEXTURES_READY')
