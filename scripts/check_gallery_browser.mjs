import fs from 'node:fs/promises';
const tabs = await fetch('http://127.0.0.1:9337/json').then(r=>r.json());
const tab = tabs.find(t=>t.type==='page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
const pending = new Map(); let id=0;
const errors=[],requests=[];
ws.onmessage=event=>{
  const m=JSON.parse(event.data);
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(m.error);else p?.resolve(m.result);}
  else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);
  else if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/gallery-assets/'))requests.push(m.params.request.url);
};
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;}
async function waitFor(expression,limit=120000){const started=Date.now();while(Date.now()-started<limit){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,250));}throw new Error('Timed out: '+expression);}
await call('Runtime.enable');await call('Page.enable');await call('Network.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:3000/gallery'});
await waitFor('document.querySelector("canvas")?.dataset.progress !== undefined || document.body.innerText.includes("3D is unavailable")');
console.log('INITIAL',await evaluate('({text:document.body.innerText,canvas:document.querySelector("canvas")?.dataset})'));
await new Promise(r=>setTimeout(r,3000));
const dir='gallery_v07/browser';await fs.mkdir(dir,{recursive:true});
await fs.writeFile(`${dir}/desktop.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
const desktop=await evaluate('({text:document.body.innerText,canvas:{...document.querySelector("canvas").dataset},width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,pinHidden:document.querySelector("button").hidden})');
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
await new Promise(r=>setTimeout(r,1000));
await fs.writeFile(`${dir}/mobile.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
const mobile=await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,canvas:{...document.querySelector("canvas").dataset}})');
await fs.writeFile(`${dir}/initial-report.json`,JSON.stringify({desktop,mobile,errors,requests},null,2));
console.log(JSON.stringify({desktop,mobile,errors,requestCount:requests.length}));
ws.close();
