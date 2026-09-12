"""Repack embedded JPEGs and name the tour clip without changing geometry or UVs."""
from pathlib import Path
import io,json,struct,hashlib
from PIL import Image
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v04')
p=OUT/'framers_gallery_v04.glb'
raw=p.read_bytes();jlen=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+jlen]);binary=raw[28+jlen:]
image_views={image['bufferView']:image for image in doc.get('images',[]) if 'bufferView' in image}
rebuilt=bytearray();images=[]
for index,view in enumerate(doc['bufferViews']):
    source=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    new=source
    if index in image_views:
        im=Image.open(io.BytesIO(source)).convert('RGB')
        out=io.BytesIO();im.save(out,'JPEG',quality=85,optimize=True,subsampling=0)
        if len(out.getvalue())<len(source):new=out.getvalue()
        images.append({'name':image_views[index].get('name'),'dimensions':list(im.size),'before_bytes':len(source),'after_bytes':len(new)})
        image_views[index]['mimeType']='image/jpeg'
    while len(rebuilt)%4:rebuilt.append(0)
    view['byteOffset']=len(rebuilt);view['byteLength']=len(new)
    rebuilt.extend(new)
doc['buffers'][0]['byteLength']=len(rebuilt)
for animation in doc.get('animations',[]):animation['name']='Framers_FirstFloor_Tour'
while len(rebuilt)%4:rebuilt.append(0)
j=json.dumps(doc,separators=(',',':')).encode()
j+=b' '*((-len(j))%4)
new=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(rebuilt))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(rebuilt),0x004e4942)+rebuilt
p.write_bytes(new)
report={'before_bytes':len(raw),'after_bytes':len(new),'sha256':hashlib.sha256(new).hexdigest(),'images':images,'mesh_count':len(doc.get('meshes',[])),'camera_count':len(doc.get('cameras',[])),'animations':[a['name'] for a in doc.get('animations',[])],'extensions':doc.get('extensionsUsed',[]),'external_resources':[x['uri'] for key in ('images','buffers') for x in doc.get(key,[]) if 'uri' in x]}
(OUT/'export-manifest.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='images'}))
