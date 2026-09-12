"""Arrange unchanged exported-model renders on a review sheet."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.image as mpimg

out = Path(r'C:\Personal_Projects\Framers\gallery_v04\previews')
rooms = [('01_living', '01 / LIVING'), ('02_motoring', '02 / MOTORING'),
         ('03_together', '03 / TOGETHER'), ('04_childhood', '04 / CHILDHOOD'),
         ('05_study', '05 / STUDY'), ('06_anniversary', '06 / ANNIVERSARY')]
fig, axes = plt.subplots(3, 2, figsize=(16, 15), facecolor='#181612')
for ax, (name, label) in zip(axes.flat, rooms):
    ax.imshow(mpimg.imread(out / (name + '.png')))
    ax.set_title(label, loc='left', color='#e8e0d2', fontsize=14, pad=12)
    ax.axis('off')
fig.suptitle('FRAMERS / FIRST FLOOR', color='#e8e0d2', fontsize=24, x=.04, ha='left')
fig.subplots_adjust(left=.04, right=.96, top=.94, bottom=.03, hspace=.08, wspace=.035)
fig.savefig(out / 'room-overview.png', dpi=125, facecolor=fig.get_facecolor())
print(out / 'room-overview.png')
