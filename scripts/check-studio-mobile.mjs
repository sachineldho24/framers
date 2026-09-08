/**
 * Mobile studio regression checks, using a disposable page and Chrome CDP.
 * Start one `npm run dev -- --hostname 127.0.0.1` server and a headless Chrome
 * with --remote-debugging-port=9338 and a separate --user-data-dir, then run:
 *   node scripts/check-studio-mobile.mjs
 * No account, database writes, or extra packages are needed. The fixture route
 * is removed afterwards. Screenshots go to ignored tmp/studio-mobile/.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const routeDir = new URL('../src/app/studio-mobile-check/', import.meta.url);
const fixture = new URL('./fixtures/studio-mobile-page.tsx', import.meta.url);
const output = new URL('../tmp/studio-mobile/', import.meta.url);
const origin = process.env.STUDIO_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const debuggerOrigin = process.env.STUDIO_CDP_ORIGIN ?? 'http://127.0.0.1:9338';
await fs.mkdir(routeDir, { recursive: true });
// Exclusive creation protects any pre-existing page at the test route.
await fs.copyFile(fixture, new URL('page.tsx', routeDir), fs.constants.COPYFILE_EXCL);
let ws;
const results = [];
try {
  await fs.mkdir(output, { recursive: true });
  const oldTabs = await fetch(`${debuggerOrigin}/json`).then(r => r.json());
  for (const oldTab of oldTabs.filter(tab => tab.url === `${origin}/studio-mobile-check`)) {
    await fetch(`${debuggerOrigin}/json/close/${oldTab.id}`);
  }
  const tab = await fetch(`${debuggerOrigin}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(message.error);
      else entry.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 350));
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
    throw Error(`Timed out: ${expression}`);
  };
  const viewport = async (width, height, mobile = true) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await call('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
    await pause();
  };
  const tap = async selector => {
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw Error('Missing control: ' + ${JSON.stringify(selector)});
      el.scrollIntoView({block:'nearest',inline:'nearest'});
      const r = el.getBoundingClientRect();
      return {x:r.x+r.width/2, y:r.y+r.height/2};
    })()`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pause();
  };
  const clickText = async text => {
    await evaluate(`(() => {
      const el = [...document.querySelectorAll('button')].find(b=>b.textContent.replace(/\\s+/g,' ').trim().includes(${JSON.stringify(text)}));
      if (!el) throw Error('Missing button: ' + ${JSON.stringify(text)});
      el.click();
    })()`);
    await pause();
  };
  const check = async (name, { panel = true, minHeight = 160, mobile = true } = {}) => {
    await pause();
    const metrics = await evaluate(`(() => {
      const rect = selector => {
        const el = document.querySelector(selector);
        if (!el || !el.getClientRects().length) return null;
        const r = el.getBoundingClientRect();
        return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};
      };
      return { canvas:rect('canvas'), panel:rect('.studio-panel'), controls:rect('.studio-mobile-actions'),
        entry:rect('.studio-text-entry'), root:rect('.studio-root'), width:innerWidth, height:innerHeight,
        overflow:document.documentElement.scrollWidth>innerWidth, panels:document.querySelectorAll('.studio-panel').length };
    })()`);
    assert(metrics.canvas.height >= minHeight, `${name}: usable canvas height (${metrics.canvas.height})`);
    const landscape = mobile && metrics.width >= 600 && metrics.height <= 500;
    assert(metrics.canvas.width >= (mobile && !landscape ? metrics.width - 1 : 500), `${name}: canvas width`);
    assert(!metrics.overflow, `${name}: no page overflow`);
    assert(metrics.root.bottom <= metrics.height + 1, `${name}: controls fit visible viewport`);
    if (panel) {
      assert.equal(metrics.panels, 1, `${name}: only one panel`);
      assert(metrics.panel, `${name}: panel is visible`);
      if (mobile && !landscape) assert(metrics.canvas.bottom <= metrics.panel.y, `${name}: panel below artwork`);
      else if (landscape) assert(metrics.canvas.right <= metrics.panel.x, `${name}: landscape panel beside artwork`);
      else assert(metrics.panel.right <= metrics.canvas.x, `${name}: desktop panel beside artwork`);
    }
    for (const control of [metrics.controls, metrics.entry]) {
      if (control) assert(metrics.canvas.bottom <= control.y + 1, `${name}: controls cannot cover canvas`);
    }
    await fs.writeFile(new URL(`${name}.png`, output), Buffer.from((await call('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    results.push({ name, ...metrics });
  };
  await call('Page.enable');
  await call('Runtime.enable');
  await viewport(390, 844);
  await call('Page.navigate', { url: `${origin}/studio-mobile-check` });
  await waitFor('!!document.querySelector("[role=tablist][aria-orientation=horizontal]")');
  await evaluate('document.fonts.ready.then(()=>true)');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("header")).display'), 'grid', 'Mobile stylesheet must be current (restart dev server if stale)');
  await check('tools');
  await tap('canvas');
  await clickText('Brightness, contrast, filters');
  await check('adjust');
  await tap('#studio-rail-tools');
  await clickText('Trim to what matters');
  await check('crop');
  await tap('[aria-label="Close Crop"]');
  await clickText('A printed edge around the art');
  await check('border');
  await tap('#studio-rail-text');
  await clickText('Add a heading');
  await waitFor('!!document.querySelector(".studio-text-entry textarea")');
  await call('Input.insertText', { text: 'DRIVE' });
  await check('typing', { panel: false });
  // Emulate the reduced visible area while a software keyboard is open.
  await viewport(390, 420);
  await check('keyboard-viewport', { panel: false });
  assert.equal(await evaluate('document.querySelector(".studio-text-entry textarea").value'), 'DRIVE');
  await clickText('Done typing');
  await viewport(390, 844);
  await check('text-size');
  const before = await evaluate('document.querySelector("canvas").toDataURL()');
  await tap('.studio-panel input[type="range"]');
  const after = await evaluate('document.querySelector("canvas").toDataURL()');
  assert.notEqual(before, after, 'Changing text size must repaint the live canvas');
  await check('text-resized');
  for (const [width, height] of [[320,568], [360,640], [430,932], [768,1024], [844,390]]) {
    await viewport(width, height);
    await check(`viewport-${width}x${height}`, { minHeight: height < 450 ? 75 : 150 });
  }
  await viewport(390,844);
  await tap('[aria-label="Close panel"]');
  await check('panel-closed', { panel: false });
  await tap('[aria-label="Zoom in"]');
  await tap('#studio-rail-tools');
  await check('reopen-after-zoom');
  await viewport(1440,900,false);
  await check('desktop', { mobile: false });
  assert.deepEqual(exceptions, [], 'No browser runtime exceptions');
  await fs.writeFile(new URL('report.json', output), JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} studio layout/interaction checks; text resize repaints; no runtime exceptions.`);
  await fetch(`${debuggerOrigin}/json/close/${tab.id}`);
} finally {
  ws?.close();
  await fs.unlink(new URL('page.tsx', routeDir));
  await fs.rmdir(routeDir);
}
