"""Read the supplied Meshy GLBs without altering them."""
import json
import struct
from pathlib import Path

ROOT = Path(r'C:\Personal_Projects\Framers')
OUT = ROOT / 'gallery_v06' / 'analysis'
OUT.mkdir(parents=True, exist_ok=True)
report = {}
for name in ['Kids_Room', 'Living_Room', 'Workplace', 'Couple_Room', 'Dining_Room']:
    path = Path(r'C:\Users\Sachin\Downloads') / (name + '.glb')
    with path.open('rb') as f:
        magic, version, size = struct.unpack('<III', f.read(12))
        length, kind = struct.unpack('<II', f.read(8))
        doc = json.loads(f.read(length))
    meshes = []
    for m in doc.get('meshes', []):
        primitives = []
        for p in m['primitives']:
            pos = doc['accessors'][p['attributes']['POSITION']]
            idx = doc['accessors'][p['indices']] if 'indices' in p else pos
            primitives.append(dict(vertices=pos['count'], triangles=idx['count']//3,
                                   min=pos.get('min'), max=pos.get('max'),
                                   material=p.get('material'), extensions=list(p.get('extensions', {}))))
        meshes.append(dict(name=m.get('name'), primitives=primitives))
    report[name] = dict(path=str(path), bytes=size, meshes=meshes,
                        nodes=doc.get('nodes', []), materials=doc.get('materials', []),
                        images=doc.get('images', []), extensions=doc.get('extensionsUsed', []))
    (OUT / (name + '-gltf.json')).write_text(json.dumps(doc, indent=2))
(OUT / 'sources.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
