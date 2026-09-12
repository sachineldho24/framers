"""Create an exportable contact sheet from the actual v06 Cycles renders."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.image as mpimg

OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06')
shots=[('01-living','Living — chaise sofa, console and coffee table'),
       ('03-together','Together — dining table and six chairs'),
       ('04-childhood','Childhood — bed, bedding and ride-on toys'),
       ('05-study','Study — desk and swivel chair'),
       ('06-anniversary','Anniversary — bed, nightstands and linen')]
fig,axs=plt.subplots(3,2,figsize=(16,15.7),facecolor='#f3f0e9')
for ax,(name,title) in zip(axs.flat,shots):
    ax.imshow(mpimg.imread(OUT/'previews'/(name+'.png')));ax.axis('off');ax.set_title(title,fontsize=13,loc='left',pad=9)
ax=axs.flat[5];ax.axis('off')
ax.text(.04,.90,'FRAMERS / V06',transform=ax.transAxes,fontsize=25,weight='bold')
ax.text(.04,.76,'Meshy furniture integration',transform=ax.transAxes,fontsize=17)
ax.text(.04,.61,'Five supplied models\nTwenty editable furniture components\nOriginal geometry and 2K materials\nContinuous gallery and camera tour',transform=ax.transAxes,fontsize=15,linespacing=1.8,va='top')
ax.text(.04,.18,'Actual Cycles renders from the delivered Blender scene.',transform=ax.transAxes,fontsize=11,color='#55534d')
fig.subplots_adjust(left=.025,right=.975,top=.97,bottom=.02,wspace=.035,hspace=.12)
fig.savefig(OUT/'previews'/'meshy-room-overview.png',dpi=140,facecolor=fig.get_facecolor());plt.close(fig)
fig,axs=plt.subplots(2,1,figsize=(15,19),facecolor='#f3f0e9')
for ax,name,title in zip(axs,['07-continuous-west','08-continuous-east'],['West turn — living, motoring and dining','East turn — childhood, study and anniversary']):
    ax.imshow(mpimg.imread(OUT/'previews'/(name+'.png')));ax.axis('off');ax.set_title(title,fontsize=16,loc='left',pad=12)
fig.subplots_adjust(left=.025,right=.975,top=.97,bottom=.015,hspace=.08)
fig.savefig(OUT/'previews'/'continuous-transitions.png',dpi=140,facecolor=fig.get_facecolor());plt.close(fig)
print('V06_REVIEW_SHEETS_READY')
