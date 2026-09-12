/** Package scene groups without changing the five unbaked rooms' geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { cloneDocument, copyToDocument, prune, unpartition, compressTexture, listTextureSlots, draco as compressDraco } from '@gltf-transform/functions';
import draco from 'draco3dgltf';
import sharp from 'sharp';
import { Matrix3, Matrix4, Vector3 } from 'three';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/gallery-assets/v07');
await fs.mkdir(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco.createDecoderModule(),
  'draco3d.encoder': await draco.createEncoderModule(),
});
const source = await io.read(path.join(ROOT, 'gallery_v06/framers_gallery_v06.glb'));
const metadata = JSON.parse(await fs.readFile(path.join(ROOT, 'gallery_v06/gallery-structure.json'), 'utf8'));
const metadataOnly = process.argv.includes('--metadata-only');
const livingOnly = process.argv.includes('--living-only') || metadataOnly;
const report = livingOnly ? JSON.parse(await fs.readFile(path.join(ROOT,'gallery_v07/asset-report.json'),'utf8')) : { revision: 'v07', rooms: [], textures: 'WebP; 1024px maximum; normal/data maps lossless', otherRoomGeometryChanged: false };

function roomFor(node) {
  for (let ancestor = node; ancestor; ancestor = ancestor.getParentNode()) {
    const match = ancestor.getName().match(/(?:ROOM_|SET_)(\d\d_[A-Z]+)/);
    if (match) return match[1];
  }
  return null;
}

function extract(document, selected) {
  const target = new Document();
  for (const ext of document.getRoot().listExtensionsUsed()) target.createExtension(ext.constructor).setRequired(ext.isRequired());
  const map = copyToDocument(target, document, selected);
  const scene = target.createScene('Gallery');
  for (const node of selected) {
    const copy = map.get(node);
    copy.setMatrix(node.getWorldMatrix());
    scene.addChild(copy);
  }
  return target;
}

async function write(document, name) {
  await document.transform(prune(), unpartition());
  // Encode sequentially: bounds peak native-image memory while Blender bakes.
  for (const texture of document.getRoot().listTextures()) {
    const dataMap = listTextureSlots(texture).some(slot => /normal|metallicRoughness|occlusion/.test(slot));
    const tiledSurface = /^(limestone|plaster|walnut|fabric|leather|ivory_marble|black_marble)/.test(texture.getName());
    const edge = texture.getName() === 'living-furniture' ? 2048 : tiledSurface ? 512 : 1024;
    await compressTexture(texture, { encoder: sharp, targetFormat: 'webp', resize: [edge,edge], quality: 88, lossless: dataMap });
  }
  if (document.getRoot().listTextures().length) document.createExtension(EXTTextureWebP).setRequired(true);
  await document.transform(compressDraco({ method: 'edgebreaker', quantizePosition: 14, quantizeTexcoord: name === 'living-baked.glb' ? 16 : 12 }));
  const bytes = await io.writeBinary(document);
  await fs.writeFile(path.join(OUT, name), bytes);
  const triangles = document.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n,p) => n+(p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount())/3,0),0);
  return { file: name, bytes: bytes.byteLength, triangles };
}

const meshes = source.getRoot().listNodes().filter(n => n.getMesh());
report.textures = 'WebP; tiled surface maps 512px, artwork/source furniture 1024px, living furniture bake 2048px; normal/data maps lossless';
if (!livingOnly) {
report.shell = await write(extract(source, meshes.filter(n => !roomFor(n))), 'shell.glb');
console.log('PACKAGED', report.shell);

const cameraDoc = cloneDocument(source);
for (const node of cameraDoc.getRoot().listNodes()) {
  if (node.getMesh() || node.getExtension('KHR_lights_punctual')) node.dispose();
}
await cameraDoc.transform(prune(), unpartition());
const cameraBytes = await io.writeBinary(cameraDoc);
await fs.writeFile(path.join(OUT, 'camera-paths.glb'), cameraBytes);
report.cameraBytes = cameraBytes.byteLength;

const previewFiles = ['01-living','02-motoring','03-together','04-childhood','05-study','06-anniversary'];
for (const [index, room] of metadata.rooms.entries()) {
  const selected = meshes.filter(n => roomFor(n) === room.id && !(index === 0 && n.getName().includes('MESHY')));
  const document = extract(source, selected);
  const packed = await write(document, `room-${index}.glb`);
  report.rooms.push(packed);
  console.log('PACKAGED', packed);
  let preview = path.join(ROOT, `gallery_v06/previews/${previewFiles[index]}.png`);
  try { await fs.access(preview); } catch { preview = path.join(ROOT, `gallery_v05/previews/${previewFiles[index]}.png`); }
  await sharp(preview).resize(1600,1000,{fit:'inside',withoutEnlargement:true}).webp({quality:88}).toFile(path.join(OUT, `room-${index}.webp`));
}
}

const anchors = [];
for (const [index, room] of metadata.rooms.entries()) {
  const art = source.getRoot().listNodes().find(n => n.getName() === 'ART_' + room.id);
  const matrix = art.getWorldMatrix();
  const primitive = art.getMesh().listPrimitives()[0];
  const localNormal = primitive.getAttribute('NORMAL').getElement(0, []);
  const normal = new Vector3().fromArray(localNormal).applyNormalMatrix(new Matrix3().getNormalMatrix(new Matrix4().fromArray(matrix)));
  anchors.push({position:matrix.slice(12,15),normal:normal.toArray(),node:art.getName()});
  // Artwork planes crop a room-reference texture through their UV coordinates.
  // Export that artwork region for details, rather than the entire source room.
  const material = primitive.getMaterial();
  const texture = material.getBaseColorTexture();
  const uv = primitive.getAttribute(`TEXCOORD_${material.getBaseColorTextureInfo().getTexCoord()}`);
  const min = uv.getMin([]), max = uv.getMax([]);
  const size = await sharp(texture.getImage()).metadata();
  const left = Math.max(0,Math.floor(min[0]*size.width));
  const top = Math.max(0,Math.floor(min[1]*size.height));
  const right = Math.min(size.width,Math.ceil(max[0]*size.width));
  const bottom = Math.min(size.height,Math.ceil(max[1]*size.height));
  await sharp(texture.getImage()).extract({left,top,width:right-left,height:bottom-top})
    .resize(1000,1000,{fit:'inside',withoutEnlargement:true}).webp({quality:92}).toFile(path.join(OUT,`art-${index}.webp`));
}
await fs.writeFile(path.join(OUT,'scene.json'),JSON.stringify({anchors,lights:metadata.lights_blender},null,2));

if (!process.argv.includes('--base-only') && !metadataOnly) {
  const baked = await io.read(path.join(ROOT, 'gallery_v07/living-baked.glb'));
  const unlit = baked.createExtension(KHRMaterialsUnlit);
  for (const material of baked.getRoot().listMaterials()) {
    const texture = material.getEmissiveTexture();
    const uv = material.getEmissiveTextureInfo()?.getTexCoord() ?? 0;
    material.setBaseColorTexture(texture).setBaseColorFactor([1,1,1,1]);
    material.getBaseColorTextureInfo()?.setTexCoord(uv);
    material.setEmissiveTexture(null).setEmissiveFactor([0,0,0]);
    material.setExtension('KHR_materials_unlit',unlit.createUnlit());
  }
  // Use the independently denoised images; the raw Blender export stays intact.
  for (const texture of baked.getRoot().listTextures()) {
    const name = texture.getName();
    if (/^living-(furniture|floor|wall)$/.test(name)) {
      texture.setImage(new Uint8Array(await fs.readFile(path.join(ROOT, 'gallery_v07/baked', `${name}.png`))));
    }
  }
  report.livingBake = await write(baked, 'living-baked.glb');
  console.log('PACKAGED', report.livingBake);
}

const decoderDir = path.join(OUT, 'draco');
await fs.mkdir(decoderDir, { recursive: true });
for (const file of ['draco_wasm_wrapper.js','draco_decoder.wasm']) {
  await fs.copyFile(path.join(ROOT,'node_modules/three/examples/jsm/libs/draco/gltf',file),path.join(decoderDir,file));
}
await fs.copyFile(path.join(ROOT,'node_modules/three/LICENSE'),path.join(OUT,'THREE-LICENSE.txt'));
await fs.copyFile(path.join(ROOT,'node_modules/three/examples/jsm/libs/draco/README.md'),path.join(OUT,'draco/README.md'));
await fs.writeFile(path.join(ROOT,'gallery_v07/asset-report.json'),JSON.stringify(report,null,2));
console.log('GALLERY_ASSETS_READY',OUT);
