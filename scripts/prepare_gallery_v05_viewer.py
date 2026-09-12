from pathlib import Path
root=Path(r'C:\Personal_Projects\Framers');out=root/'gallery_v05'
html=(root/'gallery_v04/index.html').read_text(encoding='utf-8')
html=html.replace('framers_gallery_v04.glb','framers_gallery_v05.glb')
html=html.replace('FRAMERS / FIRST FLOOR','FRAMERS / CONTINUOUS GALLERY').replace('Six rooms. One continuous walk.','Art, in the spaces we live.').replace('Framers — First Floor','Framers — Continuous Gallery')
html=html.replace("import {OrbitControls} from './vendor/OrbitControls.js';", """import {OrbitControls} from './vendor/OrbitControls.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();""")
html=html.replace("renderer.toneMapping=THREE.NoToneMapping;", """renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.2;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const pmrem=new THREE.PMREMGenerator(renderer);const reflectionRoom=new RoomEnvironment();
const environment=pmrem.fromScene(reflectionRoom,.04).texture;reflectionRoom.dispose();pmrem.dispose();""")
html=html.replace("scene.background=new THREE.Color('#29241d');", """scene.background=new THREE.Color('#777467');scene.environment=environment;scene.environmentIntensity=.30;
scene.add(new THREE.HemisphereLight(0xf4ecdc,0x534736,.20));""")
html=html.replace('let data;const names=[];', 'let data;let updateLighting=()=>{};const names=[];')
html=html.replace("const resize=()=>{", "let dirty=true;controls.addEventListener('change',()=>{dirty=true});const resize=()=>{dirty=true;")
html=html.replace("root=gltf.scene;scene.add(root);", """root=gltf.scene;scene.add(root);
 root.traverse(o=>{
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material?.map)o.material.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
  // Use a consistent local light rig; exported punctual lights remain in the GLB for other viewers.
  if(o.isLight)o.visible=false;
 });
 const toWeb=p=>new THREE.Vector3(p[0],p[2],-p[1]);
 const keys=data.lights_blender.filter(l=>l.name.startsWith('LIGHT_Key_')).map(l=>({...l,web:toWeb(l.position)}));
 const slots=Array.from({length:2},()=>{
  const area=new THREE.RectAreaLight(0xffe8c4,5,3,3);scene.add(area);
  const shadow=new THREE.SpotLight(0xffe8c4,65,17,Math.PI*.37,.85,2);shadow.castShadow=true;
  shadow.shadow.mapSize.set(1024,1024);shadow.shadow.bias=-.0003;shadow.shadow.normalBias=.016;shadow.shadow.camera.near=.3;shadow.shadow.camera.far=17;
  scene.add(shadow,shadow.target);
  const washes=Array.from({length:2},()=>{const w=new THREE.SpotLight(0xffd6a0,15,10,.55,.68,2);scene.add(w,w.target);return w});
  return {area,shadow,washes,key:null};
 });
 const eye=new THREE.Vector3();
 updateLighting=()=>{
  active.getWorldPosition(eye);
  const near=keys.map(k=>({key:k,d:k.web.distanceToSquared(eye)})).sort((a,b)=>a.d-b.d).slice(0,2);
  near.forEach(({key:k},i)=>{
   const slot=slots[i];if(slot.key===k.name)return;slot.key=k.name;
   slot.area.color.setRGB(...k.color);slot.area.intensity=k.energy/(k.size*k.size*9);slot.area.width=k.size;slot.area.height=k.size;
   slot.area.position.copy(k.web);slot.area.lookAt(toWeb(k.target));
   slot.shadow.color.setRGB(...k.color);slot.shadow.intensity=k.energy*.15;slot.shadow.position.copy(k.web);slot.shadow.target.position.copy(toWeb(k.target));
   const id=k.name.replace('LIGHT_Key_','');const washes=data.lights_blender.filter(l=>l.type==='SPOT'&&l.name.includes(id));
   slot.washes.forEach((light,j)=>{const l=washes[j];if(!l){light.intensity=0;return}light.intensity=l.energy*.22;light.color.setRGB(...l.color);light.position.copy(toWeb(l.position));light.target.position.copy(toWeb(l.target))});
   renderer.shadowMap.needsUpdate=true;
  });
 };
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;""")
html=html.replace('if(controls.enabled)controls.update();renderer.render(scene,active)', 'if(controls.enabled)controls.update();updateLighting();renderer.render(scene,active)')
html=html.replace('renderer.render(scene,active)', 'if(playing||controls.enabled||dirty){renderer.render(scene,active);dirty=false}')
html=html.replace("status').textContent=Math.round(progress*96)","status').textContent=Math.round(progress*96)")
html=html.replace('<style>','''<style>
header{position:relative;z-index:2}button{transition:background .18s,color .18s}
@media(max-width:700px){h1{font-size:12px!important;letter-spacing:.09em!important}}
''')
(out/'index.html').write_text(html,encoding='utf-8')
print('V05_VIEWER_READY')
