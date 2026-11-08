// A press after a reload stays where it was pressed (the owner, 2026-11-08):
// "Sometimes when I reload the page on a piece then scroll down towards the end
// of the piece and click a note, the page scrolls back to bar 1." Reported
// before and fixed once (d9b8995b, a parked playhead outranking the reader);
// this pins the reload path, at two moments — before the editor has bound, and
// after — and records every programmatic scroll with its stack, so a failure
// names its cause.
import { chromeBin, TEST_BROWSER_FLAGS } from './chromeBin.mjs';
import os from 'node:os';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client, until, STUDIO_STATE, stopChrome } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';

const root = new URL('../../', import.meta.url);
const library = await startLocalLibrary();
const { origin, session } = library;
const FILE = 'House-of-the-Rising-Sun.gpx';
const bytes = new Uint8Array(await fs.readFile(new URL(`converters/fixtures/${FILE}`, root)));
const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const headers = { Authorization: `Bearer ${library.writeToken}`, 'Cf-Access-Jwt-Assertion': session.machine };
const before = await fetch(origin + '/api/library/ingest/ReloadClick', { headers }); assert.equal(before.status, 200);
const { snapshot } = await before.json();
const manifest = { expected_revision: snapshot?.piece.revision ?? null,
  source: { kind: 'soundslice', id: 'ReloadClick' },
  renditions: [{ id: 'ReloadClick-gp', format: 'gp', role: 'export', producer: 'soundslice-cli', producer_version: null, producer_options: null, filename: FILE, sha256, file: 'score' }],
  recordings: [], tags: [], canonical: { mode: 'initialize', rendition_id: 'ReloadClick-gp' },
  derived_tags: [{ dimension: 'title', value: 'Reload click smoke', source_ref: 'sidecar' }] };
const form = new FormData(); form.set('manifest', JSON.stringify(manifest)); form.set('score', new Blob([bytes]), FILE);
const stored = await fetch(origin + '/api/library/ingest', { method: 'POST', headers, body: form });
assert.equal(stored.status, 200, await stored.clone().text());
const pieceId = (await stored.json()).snapshot.piece.id;

// Every programmatic scroll of any element, with who asked — installed before the page's own scripts.
const SPY = `(() => {
  window.__scrolls = [];
  const log = (el, how, value) => window.__scrolls.push({ t: Math.round(performance.now()), el: el.tagName || 'window', how, value: JSON.stringify(value), stack: new Error().stack.split('\\n').slice(2, 9).join(' | ') });
  for (const name of ['scrollTo', 'scrollBy', 'scroll', 'scrollIntoView']) {
    const original = Element.prototype[name];
    Element.prototype[name] = function (...args) {
      log(this, name, args);
      if (this.tagName === 'MNX-DOCUMENT-VIEWER') {
        const svg = this.shadowRoot?.querySelector('svg');
        const groups = [...(svg?.querySelectorAll(':scope > g.enclosure, :scope > g.cursor-ghost') ?? [])].map(g => {
          const r = g.getBoundingClientRect();
          return g.getAttribute('class') + ' top=' + Math.round(r.top) + ' h=' + Math.round(r.height) + ' rects=' + g.querySelectorAll('rect').length + ' rows=' + [...new Set([...g.querySelectorAll('rect')].map(x => x.getAttribute('data-system-row')))].join(',');
        });
        const view = this.getBoundingClientRect();
        window.__scrolls.push({ t: 0, el: 'state', how: 'at scroll', value: JSON.stringify({ active: this.selection?.activeMeasureIndex, enclosure: this.selection?.enclosure, notes: this.selection?.selectedNoteIds?.slice(0, 3), viewTop: Math.round(view.top), viewH: Math.round(view.height), groups }), stack: '' });
      }
      return original.apply(this, args);
    };
  }
  const top = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get() { return top.get.call(this); }, set(v) { log(this, 'scrollTop=', v); top.set.call(this, v); } });
})();`;

const profile = await fs.mkdtemp(`${os.tmpdir()}/mnx-reload-click-browser-`);
const chrome = spawn(chromeBin(), [...TEST_BROWSER_FLAGS, '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws, 'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: SPY });
  const wait = expression => until(c, expression, { timeoutMs: 30000, describe: STUDIO_STATE });
  const app = "document.querySelector('mnx-studio')?.shadowRoot";
  const page = `${app}?.querySelector('mnx-studio-piece')`;
  const piece = `${page}?.shadowRoot`;
  const viewer = `${piece}?.querySelector('mnx-document-viewer')`;

  await c.send('Network.setCookie', { name: 'CF_Authorization', value: session.browser, url: origin, httpOnly: true, sameSite: 'Lax' });
  await c.send('Page.navigate', { url: `${origin}/studio/#/piece/${pieceId}` });
  await wait(`!!${page}?.editor && !!${viewer}?.shadowRoot?.querySelector('.fret-number')`);

  /** Reload, scroll the score to its end, press the last fret drawn, and report what the page did. */
  const attempt = async (label, waitForEditor) => {
    await c.send('Page.reload');
    await wait(`!!${viewer}?.shadowRoot?.querySelector('.fret-number') && ${viewer}.scrollHeight > ${viewer}.clientHeight + 200`);
    if (waitForEditor) await wait(`!!${page}?.editor`);
    const bound = await c.evaluate(`!!${page}?.editor`);
    await c.evaluate(`{ const v = ${viewer}; v.scrollTop = v.scrollHeight; window.__scrolls.length = 0;
      const proto = Object.getPrototypeOf(v), d = Object.getOwnPropertyDescriptor(proto, 'selection');
      if (d && !window.__wrapped) { window.__wrapped = true; Object.defineProperty(proto, 'selection', { configurable: true, get() { return d.get.call(this); }, set(x) {
        window.__scrolls.push({ t: Math.round(performance.now()), el: 'viewer', how: 'selection=', value: JSON.stringify({ active: x?.activeMeasureIndex, notes: x?.selectedNoteIds?.slice(0, 2) }), stack: new Error().stack.split('\\n').slice(2, 8).join(' | ') });
        d.set.call(this, x); } }); }
      window.__pressAt = 0; } 0`);
    await new Promise(r => setTimeout(r, 300));
    const target = JSON.parse(await c.evaluate(`JSON.stringify((() => {
      const v = ${viewer}, box = v.getBoundingClientRect();
      const frets = [...v.shadowRoot.querySelectorAll('.fret-number')].map(f => f.getBoundingClientRect()).filter(r => r.top > box.top && r.bottom < box.bottom);
      const r = frets[frets.length - 1]; return { x: r.x + r.width / 2, y: r.y + r.height / 2, scrollTop: v.scrollTop };
    })())`));
    await c.evaluate(`window.__scrolls.push({ t: Math.round(performance.now()), el: 'probe', how: 'PRESS', value: '', stack: '' }); 0`);
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 3000));
    const after = JSON.parse(await c.evaluate(`JSON.stringify({ scrollTop: ${viewer}.scrollTop, bar: ${page}?.editor?.session?.cursor?.measureIndex ?? null, bars: ${page}?.editor?.session?.doc?.global?.measures?.length ?? null, scrolls: window.__scrolls })`));
    console.log(`${label}: scrollTop ${target.scrollTop.toFixed(0)} → ${after.scrollTop.toFixed(0)}, cursor bar ${after.bar === null ? '—' : after.bar + 1} of ${after.bars} (editor bound: ${bound})`);
    // What moved the score, and who said so — printed only when it went back towards bar 1.
    if (after.scrollTop < target.scrollTop / 2) for (const s of after.scrolls) console.log(`  t=${s.t} ${s.el}.${s.how}(${s.value})\n     ${s.stack}`);
    return { ...after, before: target.scrollTop };
  };

  const results = [];
  results.push(await attempt('press straight after the reload', false));
  results.push(await attempt('press once the editor has bound', true));
  
  const jumped = results.filter(r => r.scrollTop < r.before / 2);
  assert.equal(jumped.length, 0, `${jumped.length} of ${results.length} presses scrolled the score back towards bar 1`);
  console.log('\nReload-click smoke passed: a press near the end of a reloaded score, straight away and once the editor has bound, stays where it was pressed.');
} finally {
  ws?.close();
  await stopChrome(chrome);
  await library.close();
  await fs.rm(profile, { recursive: true, force: true });
}
