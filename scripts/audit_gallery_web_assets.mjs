import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const base = 'public/gallery-assets/v07';
const files = ['camera-paths.glb','shell.glb','living-baked.glb',...Array.from({length:6},(_,i)=>`room-${i}.glb`)];
const assets = [];
for (const file of files) {
  const bytes = await fs.readFile(`${base}/${file}`);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  const binary = bytes.subarray(28+jsonLength);
  const images = [];
  for (const img of gltf.images || []) {
    const view = gltf.bufferViews[img.bufferView];
    const meta = await sharp(binary.subarray(view.byteOffset,view.byteOffset+view.byteLength)).metadata();
    images.push({name:img.name,width:meta.width,height:meta.height,encodedBytes:view.byteLength});
  }
  assets.push({file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    triangles:(gltf.meshes||[]).reduce((n,m)=>n+m.primitives.reduce((p,a)=>p+gltf.accessors[a.indices ?? a.attributes.POSITION].count/3,0),0),
    images,rgba8MipBytesEstimate:Math.ceil(images.reduce((n,img)=>n+img.width*img.height*4*4/3,0))});
}
const initial = assets.filter(a=>['camera-paths.glb','shell.glb','room-0.glb','living-baked.glb'].includes(a.file));
const initialBytes = initial.reduce((n,a)=>n+a.bytes,0);
const livingResident = [...initial,assets.find(a=>a.file==='room-1.glb')];
const decoderBytes = (await fs.stat(`${base}/draco/draco_wasm_wrapper.js`)).size + (await fs.stat(`${base}/draco/draco_decoder.wasm`)).size;
const report = {assets,initialSceneBytes:initialBytes,totalSceneBytes:assets.reduce((n,a)=>n+a.bytes,0),decoderBytes,
  initialRgba8MipBytesEstimate:initial.reduce((n,a)=>n+a.rgba8MipBytesEstimate,0),
  livingWithAdjacentRgba8MipBytesEstimate:livingResident.reduce((n,a)=>n+a.rgba8MipBytesEstimate,0),
  textureEstimateNote:'Conservative RGBA8 with full mip chains for every embedded image in resident files; excludes generated environment, framebuffer, geometry and browser overhead. WebP reduces transfer, not GPU allocation.',
  firstSceneBudgetPass:initialBytes<=4_000_000};
await fs.mkdir('gallery_v07', { recursive: true });
await fs.writeFile('gallery_v07/web-asset-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,assets:undefined},null,2));
