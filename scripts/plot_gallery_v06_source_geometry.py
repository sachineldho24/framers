"""Coordinate views for selecting furniture from fused source architecture."""
import io
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
from segment_gallery_v06_sources import read_glb,OUT

for name in ['Kids_Room','Living_Room','Workplace']:
    doc,blob,pos,tri,uv=read_glb(Path(r'C:\Users\Sachin\Downloads')/(name+'.glb'))
    xyz=pos[:,[0,2,1]].copy();xyz[:,1]*=-1
    v=doc['bufferViews'][doc['images'][0]['bufferView']]
    offset=v.get('byteOffset',0)
    tex=np.array(Image.open(io.BytesIO(blob[offset:offset+v['byteLength']])).convert('RGB'))
    indices=np.arange(0,len(pos),5);u=uv[indices]
    col=tex[(u[:,1]*(tex.shape[0]-1)).astype(int).clip(0,tex.shape[0]-1),(u[:,0]*(tex.shape[1]-1)).astype(int).clip(0,tex.shape[1]-1)]/255
    fig,axs=plt.subplots(1,3,figsize=(18,6),layout='constrained')
    for ax,(a,b),label in zip(axs,[(0,1),(0,2),(1,2)],['Top X/Y','Front X/Z','Side Y/Z']):
        ax.scatter(xyz[indices,a],xyz[indices,b],s=.25,c=col,rasterized=True)
        ax.set_aspect('equal');ax.set_title(label);ax.set_xticks(np.arange(-1,1.01,.2));ax.set_yticks(np.arange(-1,1.01,.2));ax.grid(alpha=.3)
    fig.suptitle(name);fig.savefig(OUT/(name+'-coordinates.png'),dpi=140);plt.close(fig)
