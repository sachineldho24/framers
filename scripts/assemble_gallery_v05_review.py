from pathlib import Path
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
out=Path(r'C:\Personal_Projects\Framers\gallery_v05\previews')
rooms=[('01-living','01 / LIVING'),('02-motoring','02 / MOTORING'),('03-together','03 / TOGETHER'),('04-childhood','04 / CHILDHOOD'),('05-study','05 / STUDY'),('06-anniversary','06 / ANNIVERSARY')]
fig,axes=plt.subplots(3,2,figsize=(16,15),facecolor='#181612')
for ax,(name,label) in zip(axes.flat,rooms):
 ax.imshow(mpimg.imread(out/(name+'.png')));ax.set_title(label,loc='left',color='#e8e0d2',fontsize=14,pad=12);ax.axis('off')
fig.suptitle('FRAMERS / THE CONTINUOUS GALLERY',color='#e8e0d2',fontsize=23,x=.04,ha='left')
fig.subplots_adjust(left=.04,right=.96,top=.94,bottom=.03,hspace=.08,wspace=.035)
fig.savefig(out/'room-overview.png',dpi=125,facecolor=fig.get_facecolor());plt.close(fig)
if '--rooms-only' in sys.argv:
 print('V05_ROOM_REVIEW_READY');raise SystemExit(0)
fig,axes=plt.subplots(2,1,figsize=(16,19),facecolor='#181612')
for ax,name,label in zip(axes,['07-continuous-west','08-continuous-east'],['WEST TURN / LOUNGE TO DINING','EAST TURN / CHILDHOOD TO STUDY']):
 ax.imshow(mpimg.imread(out/(name+'.png')));ax.set_title(label,loc='left',color='#e8e0d2',fontsize=16,pad=15);ax.axis('off')
fig.subplots_adjust(left=.04,right=.96,top=.96,bottom=.04,hspace=.08)
fig.savefig(out/'continuous-transitions.png',dpi=125,facecolor=fig.get_facecolor())
print('V05_REVIEW_SHEETS_READY')
