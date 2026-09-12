import fs from 'node:fs/promises';
const tabs=await fetch('http://127.0.0.1:9335/json').then(r=>r.json());
const tab=tabs.find(t=>t.type==='page');
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let id=0;const pending=new Map(),errors=[];
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))})}
await call('Runtime.enable');await call('Page.enable');await call('Network.enable');
await call('Network.setCacheDisabled',{cacheDisabled:true});
await call('Runtime.evaluate',{expression:'window.galleryReady=false'});
await call('Page.navigate',{url:'http://127.0.0.1:8765/?review='+Date.now()});
let ready=false;
for(let i=0;i<90;i++){
 await new Promise(r=>setTimeout(r,500));
 const state=await call('Runtime.evaluate',{expression:'({ready:window.galleryReady,error:window.galleryError})',returnByValue:true});
 if(state.result.value?.error)throw new Error(state.result.value.error);
 if(state.result.value?.ready){ready=true;break}
}
if(!ready)throw new Error('Viewer did not load in 45 seconds');
await new Promise(r=>setTimeout(r,500));
const shot=await call('Page.captureScreenshot',{format:'png'});
await fs.writeFile('C:/Personal_Projects/Framers/gallery_v04/previews/browser-tour-entry.png',Buffer.from(shot.data,'base64'));
const initial=await call('Runtime.evaluate',{expression:'({duration:gallery.gltf.animations[0].duration,cameras:gallery.rooms,drawCalls:gallery.renderer.info.render.calls,triangles:gallery.renderer.info.render.triangles,textureCount:gallery.renderer.info.memory.textures})',returnByValue:true});
const results=[];
for(const progress of [0,.2,.4,.55,.82,.955,1]){
 await call('Runtime.evaluate',{expression:`gallery.routeAt(${progress})`});
 await new Promise(r=>setTimeout(r,150));
 const state=await call('Runtime.evaluate',{expression:'({progress:document.querySelector("#progress").value,caption:document.querySelector("#caption").textContent})',returnByValue:true});
 results.push(state.result.value);
 const sample=await call('Page.captureScreenshot',{format:'png'});
 await fs.writeFile(`C:/Personal_Projects/Framers/gallery_v04/previews/tour-${Math.round(progress*1000)}.png`,Buffer.from(sample.data,'base64'));
}
const replay=[];
for(const progress of [0,.4,.95,.4]){
 await call('Runtime.evaluate',{expression:`gallery.routeAt(${progress})`});
 const state=await call('Runtime.evaluate',{expression:'gallery.gltf.scene.getObjectByName("CAM_TOUR").matrixWorld.elements.slice(12,15)',returnByValue:true});
 replay.push(state.result.value);
}
if(Math.hypot(...replay[0].map((v,i)=>v-replay[1][i]))<2){
 console.log(JSON.stringify({replay,route:(await call('Runtime.evaluate',{expression:'gallery.routeAt.toString()',returnByValue:true})).result.value}));
 throw new Error('Tour cannot scrub after reaching the end');
}
if(Math.hypot(...replay[1].map((v,i)=>v-replay[3][i]))>.01)throw new Error('Rewinding the tour changes its camera position');
await call('Runtime.evaluate',{expression:'document.querySelector("#play").click()'});
await new Promise(r=>setTimeout(r,1300));
const playback=await call('Runtime.evaluate',{expression:'Number(document.querySelector("#progress").value)',returnByValue:true});
await call('Runtime.evaluate',{expression:'document.querySelector("#play").click()'});
if(playback.result.value<=400)throw new Error('Play did not advance the tour');
await call('Runtime.evaluate',{expression:'document.querySelector("#rooms button").click();document.querySelector("#orbit").click()'});
const orbit=await call('Runtime.evaluate',{expression:'document.querySelector("#orbit").getAttribute("aria-pressed")',returnByValue:true});
await call('Runtime.evaluate',{expression:'gallery.routeAt(0)'});
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await new Promise(r=>setTimeout(r,400));
const mobile=await call('Runtime.evaluate',{expression:'({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttons:document.querySelectorAll("#rooms button").length})',returnByValue:true});
const mobileShot=await call('Page.captureScreenshot',{format:'png'});
await fs.writeFile('C:/Personal_Projects/Framers/gallery_v04/previews/browser-mobile.png',Buffer.from(mobileShot.data,'base64'));
await call('Emulation.clearDeviceMetricsOverride');
await fs.writeFile('C:/Personal_Projects/Framers/gallery_v04/browser-validation.json',JSON.stringify({initial:initial.result.value,stops:results,replay,playbackProgress:playback.result.value,orbitEnabled:orbit.result.value,mobile:mobile.result.value,errors},null,2));
console.log(JSON.stringify({initial:initial.result.value,stops:results.length,orbitEnabled:orbit.result.value,errors}));
ws.close();
