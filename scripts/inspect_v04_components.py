import bpy,json
from pathlib import Path
from mathutils import Vector
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v04')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v04.blend'))
report={}
for o in bpy.data.objects:
 if not o.name.startswith('FURNITURE_'):continue
 n=len(o.data.vertices);parent=list(range(n))
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for e in o.data.edges:
  a,b=[find(v) for v in e.vertices]
  if a!=b:parent[b]=a
 groups={}
 for v in o.data.vertices:groups.setdefault(find(v.index),[]).append(v)
 items=[]
 for vs in groups.values():
  if len(vs)<20:continue
  lo=[min(v.co[i] for v in vs) for i in range(3)];hi=[max(v.co[i] for v in vs) for i in range(3)]
  items.append({'vertices':len(vs),'min':lo,'max':hi,'dimensions':[b-a for a,b in zip(lo,hi)]})
 report[o.name]=sorted(items,key=lambda x:-x['vertices'])
(OUT/'analysis/furniture-components.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
