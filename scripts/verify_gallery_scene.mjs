import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
await fs.mkdir('gallery_v07/browser', { recursive: true });
const tabs=await fetch('http://127.0.0.1:9337/json').then(r=>r.json());
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let id=0;const pending=new Map(),checks=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<300;i++){if(await evaluate(expression))return;await delay(200);}throw new Error(expression);}
async function key(key){await evaluate(`document.querySelector('canvas').focus(); document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true}))`);}
async function screenshot(name){await evaluate('document.activeElement.blur()');await fs.writeFile(`gallery_v07/browser/${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));}
async function clean(){assert.equal(await evaluate('document.querySelector("main").innerText.trim()'),'');assert.equal(await evaluate('document.querySelectorAll("main header,main footer,main nav,main h1").length'),0);}
try {
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await call('Emulation.setDeviceMetricsOverride',{width:1358,height:700,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:3000/gallery'});
  await until('document.querySelector("canvas")?.dataset.progress !== undefined');
  await key('Home');await until('Number(document.querySelector("canvas").dataset.progress)===0 && !document.querySelector("button").hidden');
  await clean();await screenshot('scene-only-desktop');checks.push('No header, footer, caption, room labels, progress or text controls');
  await evaluate(`document.querySelector('button').focus();document.querySelector('button').click()`);
  await until('document.querySelector("dialog").open');
  assert.equal(await evaluate('document.querySelector("dialog a").getAttribute("href")'),'/design/start');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until('!document.querySelector("dialog").open');
  assert.equal(await evaluate('document.activeElement===document.querySelector("button")'),true);checks.push('Eye details and Escape focus restoration work');
  await evaluate(`document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:500,cancelable:true,bubbles:true}))`);
  await until('Number(document.querySelector("canvas").dataset.progress)>.02');checks.push('Continuous wheel travel works without controls');
  await key('Home');await until('Number(document.querySelector("canvas").dataset.progress)===0');
  await key('ArrowRight');await until('Math.abs(Number(document.querySelector("canvas").dataset.progress)-.11236606515402298)<.00001');checks.push('Keyboard room navigation remains available');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await key('Home');await until('Number(document.querySelector("canvas").dataset.progress)===0');await clean();await screenshot('scene-only-mobile');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:600}]});
  for(let y=560;y>=320;y-=40){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y}]});await delay(25);}
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await until('Number(document.querySelector("canvas").dataset.progress)>.02');checks.push('Mobile swipe travels through the gallery');
  await evaluate(`document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))`);
  await until('document.querySelector("canvas").dataset.progress === undefined && !document.querySelector("button").hidden');
  await clean();await key('End');
  await until('document.querySelector("main img").src.endsWith("room-5.webp")');
  await evaluate(`document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:-500,cancelable:true,bubbles:true}))`);
  await until('document.querySelector("main img").src.endsWith("room-4.webp")');
  await evaluate('document.querySelector("button").click()');await until('document.querySelector("dialog").open');checks.push('Image fallback retains room travel and artwork details without restoring labels');
  console.log(JSON.stringify(checks));
  await call('Page.navigate',{url:'http://127.0.0.1:3000/gallery'});
  await until('document.querySelector("canvas")?.dataset.progress !== undefined');
  await key('Home');await until('Number(document.querySelector("canvas").dataset.progress)===0');
  await evaluate('document.activeElement.blur()');
}finally{await fs.writeFile('gallery_v07/browser/scene-only-review.json',JSON.stringify({checks},null,2));ws.close();}
