import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle,Polygon
import numpy as np
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v04')
d=json.loads((OUT/'gallery-structure.json').read_text())
fig,ax=plt.subplots(figsize=(12,12),facecolor='#eee9df')
ax.set_facecolor('#eee9df')
ax.add_patch(Rectangle((-13.1,-11.1),26.05,25.8,fill=False,lw=3,color='#3c342a'))
colors=['#b5a385','#625d53','#aa8b65','#c49d8a','#888173','#c4b39a']
for s,color in zip(d['rooms'],colors):
    a=s['angle'];r=np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])
    origin=np.array(s['origin'][:2]);w,depth=s['w'],s['d']
    corners=np.array([[-w/2,0],[w/2,0],[w/2,-depth],[-w/2,-depth]])@r.T+origin
    ax.add_patch(Polygon(corners,facecolor=color,edgecolor='#4a3c2c',lw=1.5,alpha=.85))
    back=np.array([[-w/2,0],[w/2,0]])@r.T+origin
    ax.plot(back[:,0],back[:,1],color='#2b241b',lw=5)
    c=np.array([0,-depth*.42])@r.T+origin
    ax.text(*c,s['id'][:2]+'\n'+s['title'],ha='center',va='center',fontsize=11,color='white' if s['wall']=='graphite' else '#272019',weight='bold')
    cam=np.array([0,-7.9])@r.T+origin
    f=(origin-cam);f=f/np.linalg.norm(f)
    ax.arrow(cam[0],cam[1],f[0]*.8,f[1]*.8,width=.045,head_width=.25,color='#9b411f')
route=np.array([s['position_blender'][:2] for s in d['camera_samples']])
ax.plot(route[:,0],route[:,1],color='#ba572e',lw=2.8,label='Camera route — 96 seconds / scrub by progress')
ax.scatter(route[0,0],route[0,1],s=80,c='#2d7250',zorder=10)
ax.scatter(route[-1,0],route[-1,1],s=65,c='#ba572e',zorder=10)
ax.text(route[0,0]-.4,route[0,1]+.4,'START',ha='right',fontsize=9,color='#2d7250')
ax.text(route[-1,0]+.35,route[-1,1],'END',fontsize=9,color='#8e3a1e')
ax.add_patch(Rectangle((-1.45,-1.75),5.3,12.5,facecolor='#ded7cb',edgecolor='#a69c8b',hatch='///',alpha=.65))
ax.text(1.2,4.5,'SCREENED\nCENTRAL CORE',ha='center',fontsize=9,color='#837865')
ax.set_title('FRAMERS / FIRST FLOOR\nSix residential settings · one continuous promenade',loc='left',fontsize=19,pad=22,fontweight='bold',color='#382f24')
ax.set_aspect('equal');ax.set_xlim(-14.5,14.2);ax.set_ylim(-12.4,16)
ax.set_xlabel('metres');ax.set_ylabel('metres');ax.grid(alpha=.12)
ax.legend(loc='lower left',frameon=False,fontsize=9)
fig.text(.125,.04,'Eye height 1.70 m  |  Vertical FOV 32.3°  |  Ceiling 3.40 m\nPlan derives from the Iris first-floor camera path, horizontally adapted to 60%.',fontsize=10,color='#5c5040')
fig.savefig(OUT/'floor-plan.png',dpi=130,bbox_inches='tight')
fig.savefig(OUT/'floor-plan.svg',bbox_inches='tight')
plt.close(fig)
# Measured cross-section of the supplied original, for traceable analysis.
seg=OUT/'analysis/source-plan-segments.json'
if seg.exists():
    from matplotlib.collections import LineCollection
    fig,ax=plt.subplots(figsize=(10,10),facecolor='white')
    ax.add_collection(LineCollection(json.loads(seg.read_text()),colors='#77756b',linewidths=.5))
    ref=json.loads((OUT/'analysis/camera-route.json').read_text())
    p=np.array([s['position'][:2] for s in ref['samples']])
    ax.plot(p[:,0],p[:,1],color='#c4532b',lw=2)
    ax.autoscale();ax.set_aspect('equal');ax.set_title('IRIS SOURCE / section at 1.25 m + original first-floor camera route')
    fig.savefig(OUT/'analysis/iris-source-plan.png',dpi=130,bbox_inches='tight');plt.close(fig)
print('PLANS_READY')
