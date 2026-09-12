from pathlib import Path
import json,math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon,Rectangle,Arc
import numpy as np
out=Path(r'C:\Personal_Projects\Framers\gallery_v05');d=json.loads((out/'gallery-structure.json').read_text())
fig,ax=plt.subplots(figsize=(13,11),facecolor='#eae5db');ax.set_facecolor('#eae5db')
ax.add_patch(Rectangle((-15.2,-12.93),34.1,27.36,fill=False,lw=2,color='#9d9485'))
ax.plot([-4.8,-4.8],[12.1,-2.2],lw=6,color='#5e5141');ax.plot([-4,7.7],[-3,-3],lw=6,color='#5e5141');ax.plot([8.5,8.5],[-2.2,12.1],lw=6,color='#5e5141')
ax.add_patch(Arc((-4,-2.2),1.6,1.6,theta1=180,theta2=270,lw=6,color='#5e5141'))
ax.add_patch(Arc((7.7,-2.2),1.6,1.6,theta1=270,theta2=360,lw=6,color='#5e5141'))
colors=['#bdac91','#7d7467','#bda482','#caa99b','#8c887a','#c1b8a1']
for room,color in zip(d['rooms'],colors):
 a=room['angle'];rot=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
 origin=np.array(room['origin'][:2]);w=min(room['w']-1,5.2)
 rug=np.array([[-w/2,-.5],[w/2,-.5],[w/2,-4.6],[-w/2,-4.6]])@rot.T+origin
 ax.add_patch(Polygon(rug,facecolor=color,alpha=.6,lw=0))
 c=np.array([0,-2.5])@rot.T+origin
 ax.text(*c,room['id'][:2]+' / '+room['title'],ha='center',va='center',fontsize=10,weight='bold',rotation=90 if abs(a)>1 else 0,color='#332d25')
route=np.array([p['position_blender'][:2] for p in d['camera_samples']]);ax.plot(route[:,0],route[:,1],lw=2.4,color='#a96e36')
for x,y in d.get('corner_sculptures',[]):
 ax.scatter(x,y,s=90,marker='D',color='#aa864a',edgecolor='#725832',zorder=5)
 ax.text(x,y-.65,'Sculpture',ha='center',fontsize=8,color='#766044')
ax.scatter(*route[0],s=70,color='#56704b',zorder=5);ax.scatter(*route[-1],s=70,color='#a96e36',zorder=5)
ax.text(route[0,0]-.5,route[0,1]+.4,'START',ha='right',fontsize=10,color='#56704b')
ax.text(route[-1,0]+.5,route[-1,1]+.4,'END',fontsize=10,color='#855225')
ax.text(1.85,6.1,'ONE CONTINUOUS\nROUNDED GALLERY WALL',ha='center',fontsize=13,color='#84735d',linespacing=1.6)
ax.text(1.85,3.9,'Open settings • shared floor • uninterrupted ceiling',ha='center',fontsize=10,color='#99866e')
ax.set_title('FRAMERS / THE CONTINUOUS GALLERY\nSix stories, one architectural walk',loc='left',fontweight='bold',fontsize=19,pad=23,color='#382e22')
ax.set_aspect('equal');ax.set_xlim(-16.5,20);ax.set_ylim(-14,16);ax.set_xlabel('metres');ax.set_ylabel('metres');ax.grid(alpha=.10)
fig.text(.12,.035,'1.70 m eye height  /  7.80 m viewing distance  /  96-second tour  /  0.80 m wall corner radius',fontsize=10,color='#76634e')
fig.savefig(out/'floor-plan.png',dpi=150,bbox_inches='tight');fig.savefig(out/'floor-plan.svg',bbox_inches='tight');print('V05_PLAN_READY')
