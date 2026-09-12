"""Compress photographic textures lossily; retain normal maps losslessly."""
from pathlib import Path
import io,json,struct,hashlib
from PIL import Image
OUT=Path(r'C:\Personal_Projects\Framers\gallery_v06');p=OUT/'framers_gallery_v06.glb'
raw=p.read_bytes();jlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jlen]);binary=raw[28+jlen:]
image_views={im['bufferView']:im for im in doc.get('images',[]) if 'bufferView' in im}
rebuilt=bytearray();images=[]
for i,v in enumerate(doc['bufferViews']):
 source=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];new=source
 if i in image_views:
  entry=image_views[i];im=Image.open(io.BytesIO(source));fmt=entry.get('mimeType','image/png')
  if fmt=='image/jpeg':
   buf=io.BytesIO();im.convert('RGB').save(buf,'JPEG',quality=88,optimize=True,subsampling=0)
   if len(buf.getvalue())<len(source):new=buf.getvalue()
  images.append(dict(name=entry.get('name'),size=list(im.size),mimeType=fmt,bytes=len(new)))
 while len(rebuilt)%4:rebuilt.append(0)
 v['byteOffset']=len(rebuilt);v['byteLength']=len(new);rebuilt.extend(new)
doc['buffers'][0]['byteLength']=len(rebuilt)
for a in doc.get('animations',[]):a['name']='Framers_Continuous_Tour'
while len(rebuilt)%4:rebuilt.append(0)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
new=struct.pack('<III',0x46546c67,2,28+len(j)+len(rebuilt))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(rebuilt),0x004e4942)+rebuilt
p.write_bytes(new)
report=dict(before_bytes=len(raw),bytes=len(new),sha256=hashlib.sha256(new).hexdigest(),images=images,meshes=len(doc.get('meshes',[])),materials=len(doc.get('materials',[])),cameras=len(doc.get('cameras',[])),animations=[a['name'] for a in doc.get('animations',[])],extensions=doc.get('extensionsUsed',[]),external_resources=[x['uri'] for key in ['images','buffers'] for x in doc.get(key,[]) if 'uri' in x])
(OUT/'export-manifest.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='images'}))
