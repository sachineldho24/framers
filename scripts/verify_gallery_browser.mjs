import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run against the single local server and a headless Chromium CDP port.
const tabs = await fetch('http://127.0.0.1:9337/json').then(r => r.json());
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map(), errors = [], requests = [], checks = [];
ws.onmessage = event => {
  const m = JSON.parse(event.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(m.error); else p?.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
};
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, {resolve,reject}); ws.send(JSON.stringify({id:key,method,params})); });
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(expression, limit = 90000) {
  const start = Date.now();
  while (Date.now() - start < limit) { if (await evaluate(expression)) return; await delay(200); }
  throw new Error(`Timed out: ${expression}`);
}
const record = (name, evidence) => { checks.push({name, evidence}); console.log('PASS', name, JSON.stringify(evidence)); };
const snapshot = () => evaluate('({...document.querySelector("canvas").dataset})');
const nav = `document.querySelectorAll('nav[aria-label="Gallery rooms"] button')`;
async function visit(path = '/gallery') {
  await call('Page.navigate', {url:'http://127.0.0.1:3000' + path});
  await until('document.readyState === "complete"');
}
async function room(index, stop) {
  await evaluate(`${nav}[${index}].click()`);
  await until(`Math.abs(Number(document.querySelector('canvas').dataset.progress) - ${stop}) < .00001 && !document.body.innerText.includes('Preparing')`);
  const state = await snapshot();
  assert.equal(await evaluate(`${nav}[${index}].getAttribute('aria-current')`), 'step');
  return state;
}
const dir = 'gallery_v07/browser';
await fs.mkdir(dir, {recursive:true});
try {
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', {urls:[]});
  await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await call('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:1});
  await visit();
  await until('document.querySelector("canvas")?.dataset.progress !== undefined && !document.body.innerText.includes("Preparing")');
  await room(0,0);
  record('Initial living room', await snapshot());

  await evaluate('document.querySelector("canvas").dispatchEvent(new WheelEvent("wheel", {deltaY:500,cancelable:true}))');
  await until('Number(document.querySelector("canvas").dataset.progress) > .02');
  await evaluate(`const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='View artwork'); b.focus(); b.click()`);
  await until('document.querySelector("dialog").open');
  const paused = await snapshot();
  await evaluate('document.querySelector("canvas").dispatchEvent(new WheelEvent("wheel", {deltaY:3000,cancelable:true}))');
  await delay(1000);
  assert.equal((await snapshot()).progress, paused.progress);
  assert.equal(await evaluate('document.querySelector("dialog a").getAttribute("href")'), '/design/start');
  await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await call('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until('!document.querySelector("dialog").open');
  assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'View artwork');
  record('Artwork pauses travel, Escape restores focus, designer handoff', paused.progress);

  await room(0,0);
  await call('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:170,y:480}]});
  for (let y=440;y>=250;y-=40) { await call('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:170,y}]}); await delay(25); }
  await call('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await until('Number(document.querySelector("canvas").dataset.progress) > .02');
  record('Touch swipe advances the continuous camera', await snapshot());

  const stops = [0,.11236606515402298,.44831844772073964,.5516530618976262,.8744143977690316,.990085347192292];
  const chapters = [];
  for (let i=0;i<6;i++) {
    chapters.push(await room(i,stops[i]));
    assert.equal(await evaluate('document.querySelector("button").hidden'),false,`Artwork pin is visible at stop ${i}`);
    await fs.writeFile(`${dir}/room-${i}-mobile.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  record('All six stops load and remain reachable', chapters);
  await evaluate('document.querySelector("canvas").focus()');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35});
  await evaluate('document.querySelector("canvas").dispatchEvent(new WheelEvent("wheel", {deltaY:90000,cancelable:true}))');
  await until('Number(document.querySelector("canvas").dataset.progress) === 1');
  await evaluate('document.querySelector("canvas").dispatchEvent(new WheelEvent("wheel", {deltaY:-1000,cancelable:true}))');
  await until('Number(document.querySelector("canvas").dataset.progress) < .94');
  record('Travel reverses after the end of the animation', await snapshot());

  await room(0,0);
  await delay(1000);
  const idle = await snapshot(); await delay(1000);
  console.log('IDLE_RESOURCES', idle);
  assert.equal((await snapshot()).frameCount, idle.frameCount);
  assert.equal(idle.residentRooms,'0,1');
  // First travel uploads textures that were initially outside the view. Compare
  // two complete visits after that warm-up, rather than cold allocation counts.
  await room(5,stops[5]); await room(0,0); await delay(800);
  const repeated = await snapshot();
  assert.equal(repeated.residentRooms,'0,1');
  assert.ok(Number(repeated.textures) <= Number(idle.textures));
  record('Renderer sleeps when still; repeated tours release distant room textures', {idle,repeated});
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false);
  record('390px viewport has no horizontal overflow',true);

  await evaluate(`document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))`);
  await until('document.body.innerText.includes("3D is unavailable")');
  await evaluate(`${nav}[5].click()`);
  assert.ok(await evaluate('document.querySelector("main img").src.endsWith("room-5.webp")'));
  record('Context loss preserves all six image rooms',true);
  for (let i=0;i<3;i++) {
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Enter 3D').click()`);
    await until('document.querySelector("canvas").style.opacity === "1" && !document.body.innerText.includes("Preparing")');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='View images').click()`);
    await until('document.body.innerText.includes("Room views")');
  }
  record('3D can restart after context loss and repeated image-mode visits',true);

  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const reducedStart=requests.length;
  await visit(); await until('document.body.innerText.includes("Room views")'); await delay(800);
  assert.equal(requests.slice(reducedStart).some(url=>/\.glb(?:\?|$)/.test(url)),false);
  record('Reduced motion starts with photographs and no model requests',true);

  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await call('Network.setBlockedURLs',{urls:['*gallery-assets*v07*shell.glb*']});
  await visit(); await until('document.body.innerText.includes("3D is unavailable")');
  record('Asset failure falls back to images',true);
  await call('Network.setBlockedURLs',{urls:[]});

  const homeStart=requests.length;
  await visit('/');
  await until(`document.querySelector('a[href="/gallery"]') !== null`);
  await evaluate('document.getElementById("gallery-feature-title").scrollIntoView({block:"center"})');
  await delay(1500);
  const homeRequests=requests.slice(homeStart);
  assert.equal(homeRequests.some(url=>/\.glb(?:\?|$)|draco_decoder|draco_wasm_wrapper/.test(url)),false);
  const runtimeChunks=[];
  for (const file of await fs.readdir('.next/static/chunks',{recursive:true})) {
    if (!file.endsWith('.js')) continue;
    const code=await fs.readFile(`.next/static/chunks/${file}`,'utf8');
    if (/THREE\.WebGLRenderer|Gallery asset could not load/.test(code)) runtimeChunks.push(file.replaceAll('\\','/'));
  }
  assert.ok(runtimeChunks.length>0,'Find the built runtime chunks to check network isolation');
  assert.equal(homeRequests.some(url=>runtimeChunks.some(file=>url.includes(file))),false);
  await fs.writeFile(`${dir}/homepage-mobile.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  record('Homepage gallery entry downloads no 3D runtime, models or decoder',{runtimeChunks});
  await evaluate(`[...document.querySelectorAll('a[href="/gallery"]')].find(a=>a.textContent.includes('Explore the gallery')).click()`);
  await until('document.querySelector("canvas")?.dataset.progress !== undefined && !document.body.innerText.includes("Preparing")');
  await room(0,0);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='View artwork').click()`);
  await until('document.querySelector("dialog").open');
  await fs.writeFile(`${dir}/artwork-mobile.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('document.querySelector("dialog a").click()');
  await until('location.pathname === "/login" || location.pathname === "/design/start"');
  record('Artwork CTA reaches the existing designer/login flow',await evaluate('location.pathname + location.search'));
  await call('Network.emulateNetworkConditions',{offline:false,latency:250,downloadThroughput:100000,uploadThroughput:100000});
  await call('Page.navigate',{url:'http://127.0.0.1:3000/gallery'});
  await until('document.body?.innerText.includes("Preparing your first room")');
  await evaluate(`document.querySelector('a[aria-label="Back to shop"]').click()`);
  await until('location.pathname === "/" && !document.querySelector("canvas[data-engine]")');
  await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  record('Leaving during loading aborts the gallery without an uncaught error',true);
  assert.deepEqual(errors,[]);
} finally {
  await fs.writeFile(`${dir}/verification-report.json`,JSON.stringify({checks,errors,requests},null,2));
  await call('Network.setBlockedURLs',{urls:[]}).catch(()=>{});
  await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});
  ws.close();
}
