/** Real upload checks with a temporary, non-admin user. Run with:
 * node --env-file=.env.local scripts/check-studio-uploads.mjs [origin]
 * Requires a running app and the isolated Chrome CDP on port 9338.
 * Test-owned storage, sessions, and user are removed in finally.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import sharp from 'sharp';

const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
const bucket = 'design-exports';
const output = path.resolve('tmp/studio-uploads');
await fs.mkdir(output, { recursive: true });
const source = path.resolve('public/storefront/bmw-frame.jpg');
for (const format of ['jpeg', 'png', 'webp']) {
  await sharp(source).resize(480).toFormat(format).toFile(path.join(output, `photo.${format}`));
}
await fs.writeFile(path.join(output, 'broken.jpg'), 'This is not an image.');
await fs.writeFile(path.join(output, 'unsupported.txt'), 'Unsupported file type.');
const large = await fs.open(path.join(output, 'large.png'), 'w');
await large.truncate(31 * 1024 * 1024); await large.close();

const config = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, config);
const password = `${crypto.randomUUID()}Aa1!`;
const email = `studio-upload-${crypto.randomUUID()}@example.com`;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw created.error;
const userId = created.data.user.id;
let ws, tab, sessionId;
const checks = [];
try {
  let cookies = [];
  const login = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookies, setAll: entries => { cookies = entries; } },
  });
  const signedIn = await login.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  tab = await fetch('http://127.0.0.1:9338/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0, chooser;
  const pending = new Map(), exceptions = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request.reject(message.error);
      else request.resolve(message.result);
    } else if (message.method === 'Page.fileChooserOpened') chooser = message.params;
    else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 250));
  const wait = async (expression, label = expression) => {
    for (let i = 0; i < 160; i++) { if (await evaluate(expression)) return; await pause(); }
    throw Error(`Timed out: ${label}`);
  };
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await pause();
  };
  const navigate = async url => {
    await call('Page.navigate', { url });
    await pause();
  };
  const screenshot = async name => fs.writeFile(path.join(output, `${name}.png`), Buffer.from((await call('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Page.setInterceptFileChooserDialog', { enabled: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Network.setCookies', { cookies: cookies.map(c => ({ name: c.name, value: c.value, url: origin, path: '/' })) });
  await navigate(origin);
  await wait('document.readyState === "complete"');
  sessionId = await evaluate(`fetch('/api/design/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(async r=>{const b=await r.json();if(!r.ok)throw Error('Create session failed: '+r.status);return b.sessionId})`);
  const editor = `${origin}/design/${sessionId}/edit`;
  await navigate(editor);
  await wait('!!document.querySelector("[role=tablist][aria-orientation=horizontal]")', 'mobile editor hydration');
  await click('#studio-rail-uploads');
  const upload = async name => {
    chooser = null;
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Upload an image')).click()`);
    for (let i = 0; i < 40 && !chooser; i++) await pause();
    assert(chooser, 'File picker opens');
    await call('DOM.setFileInputFiles', { backendNodeId: chooser.backendNodeId, files: name ? [path.join(output, name)] : [] });
  };
  // Invalid files must produce a recoverable message rather than an unhandled rejection.
  for (const [name, message] of [['unsupported.txt','JPG'], ['large.png','30 MB'], ['broken.jpg','readable']]) {
    await upload(name);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes(${JSON.stringify(message)})`, `visible validation for ${name}`);
    checks.push(`rejected ${name}`);
  }
  for (const format of ['jpeg', 'png', 'webp']) {
    await upload(`photo.${format}`);
    await wait(`document.querySelectorAll('.studio-panel li img').length === ${checks.length - 2}`, `${format} upload thumbnail`);
    await wait(`fetch('/api/design/session/${sessionId}/document').then(r=>r.json()).then(b=>(b.document?.layers?.length??0)>=${checks.length - 2})`, `${format} durable layer`);
    checks.push(`uploaded ${format}`);
  }
  await screenshot('uploads-mobile');
  await navigate(editor);
  await wait('!!document.querySelector("[role=tablist][aria-orientation=horizontal]")');
  await wait('!!document.querySelector("canvas") && !document.body.innerText.includes("Loading image")');
  const stored = await admin.from('design_sessions').select('document').eq('id', sessionId).single();
  assert.equal(stored.data.document.layers.filter(l => l.kind === 'image').length, 3, 'All uploaded image layers persist');
  checks.push('reload preserves all images');
  await screenshot('uploads-reloaded');
  await click('#studio-rail-uploads');
  await wait("document.querySelectorAll('.studio-panel li img').length === 3", 'reload restores upload library');
  checks.push('upload library restored after reload');
  await evaluate("[...document.querySelectorAll('header button')].find(b=>b.textContent.trim()==='Done').click()");
  await wait(`fetch('/api/design/session/${sessionId}/document').then(r=>r.json()).then(b=>!!b.printPath && !!b.thumbnailPath)`, 'Done uploads print and thumbnail');
  checks.push('Done saves print and thumbnail');

  // The first-step upload must not navigate if the session PATCH fails.
  await navigate(`${origin}/design/${sessionId}/upload`);
  await wait('!!document.querySelector("input[type=file]")');
  const setInitialFile = async name => {
    const tree = await call('DOM.getDocument');
    const input = await call('DOM.querySelector', { nodeId: tree.root.nodeId, selector: 'input[type=file]' });
    await call('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path.join(output, name)] });
  };
  await setInitialFile('broken.jpg');
  await wait("document.querySelector('[role=alert]')?.textContent.includes('readable')");
  await evaluate(`window.originalUploadFetch=window.fetch;window.fetch=(url,options)=>options?.method==='PATCH'?Promise.resolve(new Response('{}',{status:500})):window.originalUploadFetch(url,options)`);
  await setInitialFile('photo.png');
  await wait("document.querySelector('[role=alert]')?.textContent.includes(\"couldn't be saved\")", 'failed save remains on upload step');
  assert((await evaluate('location.pathname')).endsWith('/upload'));
  checks.push('failed session save is recoverable');
  await evaluate('window.fetch=window.originalUploadFetch;delete window.originalUploadFetch');
  await setInitialFile('photo.png');
  await wait("location.pathname.endsWith('/size')", 'first upload advances after durable save');
  let uploaded = await admin.from('design_sessions').select('upload_path').eq('id',sessionId).single();
  assert(uploaded.data.upload_path.endsWith('.png'));
  checks.push('initial PNG upload persists');
  for (const format of ['jpeg','webp']) {
    await navigate(`${origin}/design/${sessionId}/upload`);
    await wait('!!document.querySelector("input[type=file]")');
    await setInitialFile(`photo.${format}`);
    await wait("location.pathname.endsWith('/size')");
    uploaded = await admin.from('design_sessions').select('upload_path').eq('id',sessionId).single();
    assert(uploaded.data.upload_path.endsWith(`.${format}`));
    checks.push(`initial ${format} upload persists`);
  }
  assert.deepEqual(exceptions, [], 'No unhandled browser exceptions');
  console.log(`PASS: ${checks.join('; ')}`);
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ origin, checks }, null, 2));
} finally {
  if (tab) await fetch(`http://127.0.0.1:9338/json/close/${tab.id}`).catch(() => {});
  ws?.close();
  const paths = [];
  async function list(prefix) {
    const result = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (result.error) throw result.error;
    for (const entry of result.data) {
      const key = `${prefix}/${entry.name}`;
      if (entry.id) paths.push(key);
      else await list(key);
    }
  }
  await list(userId);
  if (paths.length) {
    const removed = await admin.storage.from(bucket).remove(paths);
    if (removed.error) throw removed.error;
  }
  const sessions = await admin.from('design_sessions').delete().eq('user_id', userId);
  if (sessions.error) throw sessions.error;
  const removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error) throw removed.error;
  console.log('Temporary test user, design sessions and uploads removed.');
}
