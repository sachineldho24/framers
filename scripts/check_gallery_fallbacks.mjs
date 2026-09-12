import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const tabs=await fetch('http://127.0.0.1:9337/json').then(r=>r.json());
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let id=0;
const pending=new Map(), checks=[];
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){const start=Date.now();while(Date.now()-start<60000){if(await evaluate(expression))return;await delay(200);}throw new Error(expression);}
async function visit(){await call('Page.navigate',{url:'http://127.0.0.1:3000/gallery'});await until('document.readyState === "complete"');}
let injection;
try{
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  injection=await call('Page.addScriptToEvaluateOnNewDocument',{source:`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.call(this,type,...args);};`});
  await visit();await until('document.body?.innerText.includes("3D is unavailable")');
  assert.equal(await evaluate(`document.querySelector('main img').complete`),true);
  checks.push('Unavailable WebGL falls back to a loaded room image');
  await call('Page.removeScriptToEvaluateOnNewDocument',injection);injection=undefined;
  await call('Emulation.setScriptExecutionDisabled',{value:true});
  await visit();
  assert.ok(await evaluate('document.body.innerText.includes("Enable JavaScript")'));
  assert.ok(await evaluate(`document.querySelector('noscript a[href="/design/start"]') !== null`));
  await fs.writeFile('gallery_v07/browser/no-javascript.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  checks.push('No JavaScript retains the server-rendered image and designer link');
  await call('Emulation.setScriptExecutionDisabled',{value:false});
  await visit();await until('document.querySelector("canvas")?.style.opacity === "1"');
  for(const [width,height] of [[320,740],[844,390]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(500);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    assert.ok(await evaluate(`(()=>{const r=document.querySelector('header').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;})()`));
    await fs.writeFile(`gallery_v07/browser/viewport-${width}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    checks.push(`${width}x${height} keeps navigation within the viewport`);
  }
  console.log(JSON.stringify(checks));
}finally{
  if(injection)await call('Page.removeScriptToEvaluateOnNewDocument',injection).catch(()=>{});
  await call('Emulation.setScriptExecutionDisabled',{value:false}).catch(()=>{});
  await fs.writeFile('gallery_v07/browser/fallback-report.json',JSON.stringify({checks},null,2));
  ws.close();
}
