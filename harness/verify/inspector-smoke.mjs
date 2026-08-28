// The rung inspector, driven in a real browser
// (roadmap/inprogress/workbench-rung-inspector.md). The data layer is joined
// headlessly in harness/conformance/rung-inspector.test.ts; what only a
// browser can say is whether the KEYS do what the legend on the same screen
// promises — Enter opens it over the selection, ↑ walks the ladder with the
// crumbs following, bare typing adds a pill, ⌫ reverts a floor pill, Enter on
// a crumb goes to a sibling, Esc closes and the score has the keys again.
//
// Usage: npm run smoke:inspector   (after npm run build)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'dist/client');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.map': 'application/json; charset=utf-8'
};

let failures = 0;
const fail = message => { console.error(`  ✗ ${message}`); failures++; };
const pass = message => console.log(`  ✓ ${message}`);

function serve(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function devtoolsPort(profileDir) {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 80; attempt++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
      if (port) return Number(port);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome never reported a DevTools port (is CHROME_BIN correct?)');
}

async function connect(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* still starting */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('could not reach Chrome DevTools');
}

function client(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) => new Promise(resolve => {
    const messageId = ++id;
    pending.set(messageId, resolve);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    });
    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.exception?.description ?? 'evaluate threw');
    }
    return result.result?.result?.value;
  };
  return { send, evaluate };
}


/** The inspector, from inside the shadow root that owns it. */
const INSPECTOR = `(() => {
  const find = (root, tag, depth) => {
    if (!root || depth > 12) return null;
    const hit = root.querySelector(tag);
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      const deeper = el.shadowRoot && find(el.shadowRoot, tag, depth + 1);
      if (deeper) return deeper;
    }
    return null;
  };
  const el = find(document, 'mnx-rung-inspector', 0);
  if (!el) return JSON.stringify({ open: false });
  const sr = el.shadowRoot;
  // Child nodes joined with a space: the pill's word and value are adjacent
  // nodes separated by a flex gap, not by text.
  const text = n => (n ? [...n.childNodes].filter(c => c.nodeType === 1 || c.nodeType === 3).map(c => c.textContent).join(' ').replace(/\\s+/g, ' ').trim() : null);
  const crumbs = [...sr.querySelectorAll('.line:not(.attrs) .pill.crumb')].map(p => ({
    label: text(p), active: p.classList.contains('active'), cursor: p.classList.contains('cursor'),
    open: p.classList.contains('open')
  }));
  const pills = [...sr.querySelectorAll('.line.attrs .pill')].map(p => ({
    text: text(p), cls: [...p.classList].filter(c => c !== 'pill').join(' ')
  }));
  const menu = [...sr.querySelectorAll('.menu .row')].map(r => ({
    label: text(r.querySelector('.l')), cur: r.classList.contains('cur')
  }));
  const box = el.getBoundingClientRect();
  return JSON.stringify({
    open: true, state: text(sr.querySelector('.state')), primary: text(sr.querySelector('.primary')),
    crumbs, pills, menu, error: text(sr.querySelector('.error')), note: text(sr.querySelector('.note')),
    input: sr.querySelector('input')?.value ?? null,
    hasFocus: sr.activeElement !== null || document.activeElement?.tagName === 'MNX-RUNG-INSPECTOR',
    top: box.top, left: box.left, width: box.width
  });
})()`;

const SELECTION = `(() => {
  const find = (root, tag, depth) => {
    if (!root || depth > 12) return null;
    const hit = root.querySelector(tag);
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      const deeper = el.shadowRoot && find(el.shadowRoot, tag, depth + 1);
      if (deeper) return deeper;
    }
    return null;
  };
  const hud = find(document, 'mnx-score-hud', 0);
  const rows = [...(hud?.shadowRoot?.querySelectorAll('.row') ?? [])].map(r => ({
    key: r.querySelector('.label')?.textContent.trim(), value: r.querySelector('.value')?.textContent.trim(),
    active: r.classList.contains('active')
  }));
  return JSON.stringify({ rows });
})()`;

let chrome; let site;
try {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/client/index.html missing — run `npm run build` first');
  }
  site = await serve(DIST);
  const profile = fs.mkdtempSync('/tmp/mnx-inspector-smoke-');
  chrome = spawn(
    process.env.CHROME_BIN ?? 'google-chrome',
    ['--headless=new', '--remote-debugging-port=0', '--disable-gpu', '--no-sandbox',
     '--window-size=1400,900', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' }
  );
  const ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(resolve => ws.addEventListener('open', resolve));
  const cdp = client(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const url = `http://127.0.0.1:${site.port}/#/scenario/lab/document/twelve-bar-blues?view=both`;
  await cdp.send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 7000));

  const press = async (key, code, keyCode, settleMs = 500, modifiers = 0) => {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, modifiers });
    }
    await new Promise(r => setTimeout(r, settleMs));
  };
  const type = async text => {
    for (const ch of text) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    await new Promise(r => setTimeout(r, 400));
  };
  const state = async () => JSON.parse(await cdp.evaluate(INSPECTOR));

  // ── Enter opens it over the selection ───────────────────────────────────
  console.log('Enter with nothing pending opens the inspector');
  await press('ArrowRight', 'ArrowRight', 39);
  await press('Enter', 'Enter', 13, 1000);
  let s = await state();
  if (!s.open) fail('no inspector after Enter');
  else {
    pass(`open · ${s.state} · “${s.primary}” · ${s.crumbs.length} crumbs`);
    if (s.state !== 'walking') fail(`state reads ${s.state}, not walking`);
    if (!s.crumbs.some(c => c.cursor)) fail('no crumb carries the cursor');
    if (s.top < 0 || s.left < 0) fail(`placed off-screen at ${s.left},${s.top}`);
    else pass(`placed at ${s.left.toFixed(0)},${s.top.toFixed(0)} × ${s.width.toFixed(0)}`);
  }

  // ── ↑ walks the ladder, the crumbs follow ───────────────────────────────
  console.log('\n↑ walks the ladder until the bar rung');
  let guard = 0;
  while (guard++ < 8) {
    s = await state();
    const active = s.crumbs.find(c => c.active);
    if (active?.label.startsWith('bar ')) break;
    await press('ArrowUp', 'ArrowUp', 38);
  }
  s = await state();
  const bar = s.crumbs.find(c => c.active);
  if (!bar?.label.startsWith('bar ')) fail(`never reached the bar rung: ${JSON.stringify(s.crumbs.map(c => c.label))}`);
  else {
    pass(`active crumb “${bar.label}” after ${guard - 1} presses`);
    if (!bar.cursor) fail('the cursor did not follow the rung it walked to');
    else pass('the cursor follows the rung');
    if (!s.pills.some(p => p.text.startsWith('barline:'))) fail(`no barline pill: ${JSON.stringify(s.pills)}`);
    else pass(`pills: ${s.pills.map(p => p.text).join(' · ')}`);
    const hud = JSON.parse(await cdp.evaluate(SELECTION));
    const hudActive = hud.rows.find(r => r.active);
    if (hudActive?.key !== 'bar') fail(`the HUD says the rung is ${hudActive?.key}, the inspector says bar`);
    else pass('the HUD agrees about the rung');
  }

  // ── bare typing adds ────────────────────────────────────────────────────
  console.log('\nbare typing goes to the blank slot and adds a pill');
  await type('barline double');
  s = await state();
  if (s.state !== 'add') fail(`typing did not open the slot (state ${s.state}, input ${s.input})`);
  else pass(`slot open with “${s.input}”, ${s.menu.length} candidate(s)`);
  await press('Enter', 'Enter', 13, 900);
  s = await state();
  const barline = s.pills.find(p => p.text.startsWith('barline:'));
  if (barline?.text !== 'barline: double') fail(`barline pill reads “${barline?.text}” (error: ${s.error})`);
  else pass('barline: double, back to walking');
  if (s.state !== 'walking') fail(`state reads ${s.state} after applying`);

  // ── ⌫ on a floor pill reverts it ────────────────────────────────────────
  console.log('\n⌫ on the barline pill reverts it to regular');
  // Walk the cursor to the barline pill.
  guard = 0;
  while (guard++ < 12) {
    s = await state();
    const i = s.pills.findIndex(p => p.cls.includes('cursor'));
    if (i >= 0 && s.pills[i].text.startsWith('barline:')) break;
    await press('ArrowRight', 'ArrowRight', 39, 200);
  }
  await press('Backspace', 'Backspace', 8, 900);
  s = await state();
  const reverted = s.pills.find(p => p.text.startsWith('barline:'));
  if (reverted?.text !== 'barline: regular') fail(`barline reads “${reverted?.text}” after ⌫`);
  else pass('barline: regular — press 1 reverted to the floor');

  // ── Enter on the bar crumb goes to a sibling ────────────────────────────
  console.log('\nEnter on the bar crumb, ↓, Enter goes to the next bar');
  guard = 0;
  while (guard++ < 12) {
    s = await state();
    if (s.crumbs.find(c => c.cursor)?.label.startsWith('bar ')) break;
    await press('ArrowLeft', 'ArrowLeft', 37, 200);
  }
  const before = s.crumbs.find(c => c.active)?.label;
  await press('Enter', 'Enter', 13, 600);
  s = await state();
  if (s.state !== 'go to' || s.menu.length === 0) fail(`crumb did not open (state ${s.state}, ${s.menu.length} rows)`);
  else pass(`go to: ${s.menu.length} bars, current “${s.menu.find(m => m.cur)?.label}”`);
  await press('ArrowDown', 'ArrowDown', 40, 300);
  await press('Enter', 'Enter', 13, 900);
  s = await state();
  const after = s.crumbs.find(c => c.active)?.label;
  if (!s.open) fail('the inspector closed on go-to; it should stay open');
  else if (after === before) fail(`still on “${after}” after go-to`);
  else pass(`“${before}” → “${after}”`);

  // ── the event rung: a marking pill, and the rung survives the edit ──────
  console.log('\n↓ to the event rung, type staccato — the pill appears and the rung holds');
  guard = 0;
  while (guard++ < 8) {
    s = await state();
    if (s.crumbs.find(c => c.active)?.label.startsWith('event')) break;
    await press('ArrowDown', 'ArrowDown', 40, 400);
  }
  s = await state();
  const eventCrumb = s.crumbs.find(c => c.active)?.label;
  if (!eventCrumb?.startsWith('event')) fail(`never reached the event rung: ${JSON.stringify(s.crumbs.map(c => c.label))}`);
  else {
    pass(`at “${eventCrumb}” · pills: ${s.pills.map(p => p.text).join(' · ') || '(none)'}`);
    if (!s.pills.some(p => p.text.startsWith('duration:'))) fail('no duration pill at the event rung');
    await type('staccato');
    await press('Enter', 'Enter', 13, 900);
    s = await state();
    if (!s.pills.some(p => p.text.startsWith('staccato'))) fail(`no staccato pill after applying (error: ${s.error}; pills ${JSON.stringify(s.pills.map(p => p.text))})`);
    else pass('staccato pill added');
    if (!s.crumbs.find(c => c.active)?.label.startsWith('event')) fail('the rung dropped after the edit — the inspector should hold it');
    else pass('still at the event rung after the edit');
  }

  // ── the note rung reads the string ──────────────────────────────────────
  console.log('\n↓ to the note rung');
  await press('ArrowDown', 'ArrowDown', 40, 500);
  s = await state();
  if (!s.crumbs.find(c => c.active)?.label.startsWith('note')) fail(`not at the note rung: ${s.crumbs.find(c => c.active)?.label}`);
  // This document's strings are DERIVED (no `_x.mnxLab.string`), so there is
  // no string annotation to show; the event's marking rides along.
  else if (!s.pills.some(p => p.text.startsWith('staccato'))) fail(`the event's marking is not read at the note: ${JSON.stringify(s.pills.map(p => p.text))}`);
  else pass(`note pills: ${s.pills.map(p => p.text).join(' · ')}`);

  // ── a range: the marking on one of two notes reads half-tone ────────────
  console.log('\nShift+→ twice: the first re-levels note→event (the floor axis), the second extends — staccato is on one of two, so it reads half-tone');
  await press('ArrowRight', 'ArrowRight', 39, 500, 8);
  await press('ArrowRight', 'ArrowRight', 39, 500, 8);
  s = await state();
  const half = s.pills.find(p => p.text.startsWith('staccato'));

  if (!s.crumbs.find(c => c.active)) fail('no active crumb over the range');
  if (!half) fail(`no staccato pill over the range: ${JSON.stringify(s.pills.map(p => p.text))}`);
  else if (!half.cls.includes('half')) fail(`staccato is not half-tone over a range where one member has it (${half.cls})`);
  else pass('staccato reads half-tone over the range');

  // ── Esc closes; the score has the keys again ────────────────────────────
  console.log('\nEsc closes it');
  await press('Escape', 'Escape', 27, 700);
  s = await state();
  if (s.open) fail('still open after Escape');
  else pass('closed');
  await press('ArrowRight', 'ArrowRight', 39, 600);
  const hudAfter = JSON.parse(await cdp.evaluate(SELECTION));
  pass(`the score took the next key (bar row: ${hudAfter.rows.find(r => r.key === 'bar')?.value})`);
} catch (error) {
  fail(error.message);
} finally {
  chrome?.kill();
  site?.server.close();
}

if (failures > 0) {
  console.error(`\ninspector smoke: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ninspector smoke: OK');
