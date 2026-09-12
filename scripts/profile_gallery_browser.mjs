import fs from 'node:fs/promises';

const tabs=await fetch('http://127.0.0.1:9337/json').then(r=>r.json());
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let id=0;
const pending=new Map(), requests=new Map(), completed=[];
ws.onmessage=event=>{
  const m=JSON.parse(event.data);
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(m.error);else p?.resolve(m.result);}
  if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,m.params.request.url);
  if(m.method==='Network.loadingFinished')completed.push({url:requests.get(m.params.requestId),bytes:m.params.encodedDataLength});
};
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){const start=Date.now();while(Date.now()-start<120000){if(await evaluate(expression))return;await delay(200);}throw new Error('Gallery did not become ready');}
async function profile(seconds){
  return evaluate(`new Promise(resolve=>{
    const canvas=document.querySelector('canvas'), times=[];
    let previous=performance.now(), direction=1;
    const started=previous;
    const observer=new MutationObserver(()=>{const now=performance.now();times.push(now-previous);previous=now;});
    observer.observe(canvas,{attributes:true,attributeFilter:['data-frame-count']});
    const travel=setInterval(()=>{const p=Number(canvas.dataset.progress);if(p>.045)direction=-1;if(p<.002)direction=1;canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:direction*80,cancelable:true}));},140);
    setTimeout(()=>{
      clearInterval(travel);observer.disconnect();
      const elapsed=performance.now()-started, ordered=[...times].sort((a,b)=>a-b);
      resolve({seconds:elapsed/1000,renderedFrames:times.length,averageFps:times.length/(elapsed/1000),p50FrameMs:ordered[Math.floor(ordered.length*.5)],p95FrameMs:ordered[Math.floor(ordered.length*.95)],stallsOver100ms:times.filter(t=>t>100).length,maxFrameMs:Math.max(...times),viewport:[innerWidth,innerHeight],devicePixelRatio:devicePixelRatio,drawingBuffer:[canvas.width,canvas.height],finalResources:{...canvas.dataset}});
    },${seconds*1000});
  })`);
}
const report={note:'Desktop Chromium and emulated portrait viewport on the available computer; not a physical-phone acceptance result. Frame times measure actual canvas render updates during automated forward/backward travel through the living room.'};
try{
  await call('Runtime.enable');await call('Page.enable');await call('Network.enable');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await evaluate('sessionStorage.removeItem("framers_gallery_progress")');
  await call('Network.clearBrowserCache');
  await call('Network.setCacheDisabled',{cacheDisabled:true});
  await call('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:10_000_000/8,uploadThroughput:2_000_000/8});
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  const started=Date.now();
  await call('Page.navigate',{url:'http://127.0.0.1:3000/gallery'});
  await until('document.querySelector("canvas")?.dataset.progress !== undefined && document.querySelector("canvas").style.opacity === "1"');
  report.coldLoad={network:'10 Mbps down / 2 Mbps up, 80 ms latency; browser cache disabled',firstUsefulFrameMs:Date.now()-started,completedTransfersAtFirstFrame:[...completed]};
  report.browser=await evaluate(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};})()`);
  await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await until('!document.body.innerText.includes("Preparing")');
  console.log('COLD',JSON.stringify({ms:report.coldLoad.firstUsefulFrameMs,browser:report.browser}));
  report.portrait=await profile(60);
  console.log('PORTRAIT',JSON.stringify(report.portrait));
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await delay(500);
  report.desktop=await profile(30);
  console.log('DESKTOP',JSON.stringify(report.desktop));
}finally{
  await fs.writeFile('gallery_v07/browser/performance-report.json',JSON.stringify(report,null,2));
  await call('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});
  await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});
  ws.close();
}
