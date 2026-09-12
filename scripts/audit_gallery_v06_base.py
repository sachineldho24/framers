import bpy,json
from pathlib import Path
ROOT=Path(r'C:\Personal_Projects\Framers')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'gallery_v05/framers_gallery_v05.blend'))
report={}
for root in [o for o in bpy.data.objects if o.name.startswith('ROOM_')]:
    report[root.name]=[dict(name=o.name,type=o.type,parent=o.parent.name if o.parent else None,location=list(o.location),dimensions=list(o.dimensions)) for o in root.children_recursive]
(ROOT/'gallery_v06/analysis/base-room-objects.json').write_text(json.dumps(report,indent=2))
print({k:len(v) for k,v in report.items()})
