"""Plan of the existing continuous wall and the replacement furniture bounds."""
import json,math
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon,Rectangle,Arc,Patch

OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06')
meta=json.loads((OUT/'gallery-structure.json').read_text())
furniture=json.loads((OUT/'integration-manifest.json').read_text())['placements']
fig,ax=plt.subplots(figsize=(14,12),facecolor='#f1eee6');ax.set_facecolor('#f1eee6')
ax.add_patch(Rectangle((-15.2,-12.93),34.1,27.36,fill=False,lw=1.5,color='#b3a996'))
for a,b in [((-4.8,12.1),(-4.8,-2.2)),((-4,-3),(7.7,-3)),((8.5,-2.2),(8.5,12.1))]:
    ax.plot([a[0],b[0]],[a[1],b[1]],lw=5,color='#4f473b')
ax.add_patch(Arc((-4,-2.2),1.6,1.6,theta1=180,theta2=270,lw=5,color='#4f473b'))
ax.add_patch(Arc((7.7,-2.2),1.6,1.6,theta1=270,theta2=360,lw=5,color='#4f473b'))
colors=['#a8916e','#69635b','#b09870','#c79d96','#817666','#b6a48b']
for room,color in zip(meta['rooms'],colors):
    angle=room['angle'];rot=np.array([[math.cos(angle),-math.sin(angle)],[math.sin(angle),math.cos(angle)]])
    origin=np.array(room['origin'][:2]);w=min(room['w']-1,5.2)
    rug=np.array([[-w/2,-.3],[w/2,-.3],[w/2,-4.5],[-w/2,-4.5]])@rot.T+origin
    ax.add_patch(Polygon(rug,facecolor=color,alpha=.19,edgecolor='none'))
    for item in [p for p in furniture if p['room']==room['id']]:
        lo=item['room_bounds']['min'];hi=item['room_bounds']['max']
        corners=np.array([[lo[0],lo[1]],[hi[0],lo[1]],[hi[0],hi[1]],[lo[0],hi[1]]])@rot.T+origin
        ax.add_patch(Polygon(corners,facecolor=color,alpha=.62,edgecolor='#514334',linewidth=.6))
    pos=np.array([0,-5.45])@rot.T+origin
    label=room['id'][:2]+' / '+room['title']+('\nExisting lounge' if room['id']=='02_MOTORING' else '\nMeshy furniture')
    ax.text(*pos,label,ha='center',va='center',fontsize=9,rotation=90 if abs(angle)>1 else 0,color='#3e342a')
route=np.array([p['position_blender'][:2] for p in meta['camera_samples']])
ax.plot(route[:,0],route[:,1],color='#ad7437',lw=2)
ax.scatter(*route[0],color='#587247',s=60,zorder=5);ax.scatter(*route[-1],color='#ad7437',s=60,zorder=5)
ax.text(route[0,0]-.4,route[0,1]+.4,'START',ha='right',fontsize=9,color='#587247')
ax.text(route[-1,0]+.4,route[-1,1]+.4,'END',fontsize=9,color='#886135')
for x,y in meta.get('corner_sculptures',[]):ax.scatter(x,y,s=125,marker='D',color='#aa8246',edgecolor='#735327',zorder=5)
ax.text(1.85,6,'FRAMERS / V06\nMESHY FURNITURE',ha='center',fontsize=17,color='#766652',linespacing=1.8,weight='bold')
ax.text(1.85,3.5,'One continuous wall\n20 extracted components\nOriginal camera route',ha='center',fontsize=12,color='#8c7b65',linespacing=1.6)
ax.set_title('THE CONTINUOUS GALLERY\nFurniture placement after the Meshy integration',loc='left',fontsize=19,weight='bold',pad=20,color='#382e24')
ax.set_aspect('equal');ax.set_xlim(-17,20.5);ax.set_ylim(-14,16);ax.set_xlabel('metres');ax.set_ylabel('metres');ax.grid(alpha=.12)
fig.text(.12,.035,'Furniture shown as plan bounds.  /  1.70 m eye height  /  96-second tour  /  No room partitions',fontsize=10,color='#786751')
fig.savefig(OUT/'furniture-layout.png',dpi=150,bbox_inches='tight');fig.savefig(OUT/'furniture-layout.svg',bbox_inches='tight')
print('V06_FURNITURE_LAYOUT_READY')
