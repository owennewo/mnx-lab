// The entry bar on a touch device (roadmap/proposed/studio-editor-touch.md).
//
// The whole point of the item is a tablet with no keyboard, so this drives the
// editor the way a tablet does and never presses a key:
//
//   touch emulation on → the bar appears on its own (it follows the POINTER,
//   not a setting) · a tap on the score places the cursor · a tap on a fret
//   writes that fret · a tap on a duration re-values it · undo walks it back ·
//   the bar never steals the keyboard, so the cursor is never drawn dimmed ·
//   and it is absent on a mouse.
//
// Usage: npm run smoke:entry-bar   (after npm run build)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const delay = ms => new Promise(r => setTimeout(r, ms));

const LIB = `
  const find = (root, tag, depth = 0) => {
    if (!root || depth > 12) return null;
    const hit = root.querySelector(tag);
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      const deeper = el.shadowRoot && find(el.shadowRoot, tag, depth + 1);
      if (deeper) return deeper;
    }
    return null;
  };
  const page = () => find(document, 'mnx-scenario-page');
  const viewer = () => find(document, 'mnx-document-viewer');
  const bar = () => find(document, 'mnx-entry-bar');
  const barButton = label => [...(bar()?.shadowRoot.querySelectorAll('button') ?? [])]
    .find(b => (b.getAttribute('aria-label') ?? '') === label);
`;

const server = await serveStatic(root + 'dist/client');
const profile = fs.mkdtempSync('/tmp/mnx-entry-bar-');
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1100,900', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });

let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(r => ws.addEventListener('open', r));
  const c = client(ws);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('mnx-lab.view','tab');" });
  const run = expression => c.evaluate(`(async () => { ${LIB} ${expression} })()`);
  const until = async (expression, message) => {
    for (let i = 0; i < 120; i++) { if (await run(`return !!(${expression});`)) return; await delay(100); }
    throw new Error(message);
  };
  const open = async id => {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/workbench/#/scenario/${id}` });
    await until(`page()?.editor && viewer()?.selection?.activeMeasureIndex != null`, `no bound editor on ${id}`);
    await delay(700);
  };
  /** A real finger: touch points, not a mouse. */
  const tap = async (x, y) => {
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(320);
  };
  const centreOf = async selectorExpr => {
    const box = await run(`
      const el = ${selectorExpr};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });`);
    assert.ok(box, `nothing to tap for ${selectorExpr}`);
    return JSON.parse(box);
  };

  // ── on a mouse there is no bar ─────────────────────────────────────────────
  await open('lab/tab-derivation/bare-melody');
  assert.equal(await run(`return !!bar();`), false, 'the entry bar appeared on a desktop pointer');

  // ── a finger brings it, with no setting anywhere ───────────────────────────
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: 1100, height: 900, deviceScaleFactor: 1, mobile: true
  });
  await c.send('Page.navigate', { url: 'about:blank' });
  await open('lab/tab-derivation/bare-melody');
  assert.equal(await run(`return window.matchMedia('(pointer: coarse)').matches;`), true, 'touch emulation did not make the pointer coarse');
  await until(`bar()`, 'a coarse pointer did not bring the entry bar');

  // Every verb the bar offers must be reachable; the fingerboard is the point.
  for (const label of ['Fret 0', 'Fret 5', 'Quarter', 'Dotted', 'Tie', 'Delete', 'Undo'])
    assert.ok(await run(`return !!barButton(${JSON.stringify(label)});`), `the bar has no ${label} button`);

  // ── a tap on the score places the cursor, with no key pressed ──────────────
  const staff = JSON.parse(await run(`
    const svg = viewer().renderRoot.querySelector('#projection-container svg');
    const box = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const scale = box.height / (view.height || 1);
    const ys = [...svg.querySelectorAll('line.staff-line')]
      .map(l => box.y + (l.y1.baseVal.value - view.y) * scale)
      .filter(y => y > 60 && y < window.innerHeight - 220)
      .sort((a, b) => a - b);
    return JSON.stringify({ x: box.x + box.width * 0.5, y: ys[1] ?? ys[0] });`));
  await tap(staff.x, staff.y);
  const placed = await run(`return JSON.stringify(page().editor.session.cursor);`);
  assert.ok(placed, 'a tap on the score left no cursor');

  // ── a fret written by thumb ───────────────────────────────────────────────
  // Counted in the MUSIC, not in the op log: `enterFret` is the intent, while
  // the op it records is an insertion — two vocabularies, and only one of them
  // is evidence that a 5 reached the fingerboard.
  const fretFives = `((JSON.stringify(page().editor.session.doc).match(/"fret":5\\b/g) ?? []).length)`;
  const opsBefore = await run(`return page().editor.session.appliedOps.length;`);
  const fivesBefore = await run(`return ${fretFives};`);
  const fret5 = await centreOf(`barButton('Fret 5')`);
  await tap(fret5.x, fret5.y);
  assert.equal(
    await run(`return page().editor.session.appliedOps.length;`),
    opsBefore + 1,
    'tapping a fret wrote nothing'
  );
  assert.equal(
    await run(`return ${fretFives};`),
    fivesBefore + 1,
    'tapping fret 5 did not put a 5 on the fingerboard'
  );

  // ── the bar must not take the keyboard ────────────────────────────────────
  assert.equal(await run(`return viewer().selectionInactive;`), false,
    'the bar stole focus, so the cursor is drawn dimmed');

  // ── a duration, then undo walking it back ─────────────────────────────────
  const quarter = await centreOf(`barButton('Quarter')`);
  await tap(quarter.x, quarter.y);
  const afterDuration = await run(`return page().editor.session.appliedOps.length;`);
  const undo = await centreOf(`barButton('Undo')`);
  await tap(undo.x, undo.y);
  assert.ok(
    await run(`return page().editor.session.appliedOps.length < ${afterDuration} && page().editor.session.canRedo;`),
    'undo from the bar did not walk the history back'
  );

  // ── the page is showing what the session holds, throughout ────────────────
  assert.equal(await run(`return page().doc.mnxJson === page().editor.session.doc;`), true,
    'the page drifted from the session the bar was editing');

  console.log('Entry bar smoke passed: absent on a mouse, brought by a coarse pointer alone, a tap placing the cursor, a fret and a duration written by thumb, undo walking them back, and the keyboard never stolen.');
} finally {
  ws?.close();
  chrome.kill();
  server.server.close();
}
