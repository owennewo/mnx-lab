// The workbench on the promoted editor binding, driven in a real browser
// (roadmap: core-editor-element-promotion, work-list item 5). The scenario page
// no longer has a mount of its own: `bindEditor` hears the keys, and what is
// left on the page is the workbench's — WHICH session is in force, the ops
// panel that reads it, the chip, the rail. `smoke:inspector`, `smoke:selection`
// and `smoke:focus` prove the keys and the surfaces; this proves the seams
// between the page and the binding, which nothing else touches:
//
//   keys with nothing focused · the ops panel walking the session under the
//   binding · revert and construct replay REPLACING the session · the destruct
//   sweep · a refused rung flashing the chip · delete saying what it did · a
//   pointer outside closing the inspector · ↑/↓ at the document rung walking
//   the rail with the rung carried across.
//
// Usage: npm run smoke:workbench-editor   (after npm run build)
// WORKBENCH_EDITOR_SHOT=<path.png> also writes a screenshot with the inspector open over the score.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const delay = ms => new Promise(r => setTimeout(r, ms));

/** Page-side helpers, prepended to every evaluate. */
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
  const button = text => [...page().shadowRoot.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text) || (b.title ?? '').startsWith(text));
`;

const server = await serveStatic(root + 'dist/client');
const profile = fs.mkdtempSync('/tmp/mnx-workbench-editor-');
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1400,900', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(r => ws.addEventListener('open', r));
  const c = client(ws);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('mnx-lab.view','both');" });
  const run = expression => c.evaluate(`(async () => { ${LIB} ${expression} })()`);
  const until = async (expression, message) => {
    for (let i = 0; i < 120; i++) { if (await run(`return !!(${expression});`)) return; await delay(100); }
    throw new Error(message);
  };
  const press = async (key, code, keyCode, modifiers = 0, text) => {
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? { text } : {}) });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
    await delay(250);
  };
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    await delay(300);
  };
  const open = async id => {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/workbench/#/scenario/${id}` });
    await until(`page()?.editor && viewer()?.selection?.activeMeasureIndex != null`, `no bound editor on ${id}`);
    await delay(800);
  };

  // ── nothing focused: the keys are still the score's ────────────────────────
  await open('lab/document/twelve-bar-blues');
  assert.equal(await run(`return document.activeElement === document.body;`), true, 'something claimed focus on load');
  assert.equal(await run(`return viewer().selectionInactive;`), false, 'the cursor is dimmed although unclaimed keys are ours');
  const before = await run(`return JSON.stringify(page().editor.session.cursor);`);
  await press('ArrowRight', 'ArrowRight', 39);
  assert.notEqual(await run(`return JSON.stringify(page().editor.session.cursor);`), before, 'an arrow typed with nothing focused did not move the cursor');

  // ── an edit reaches the page; the ops panel walks the session under the binding ──
  await press('5', 'Digit5', 53, 0, '5');
  await delay(700); // the fret window
  assert.equal(await run(`return page().editor.session.appliedOps.length;`), 1, 'fret 5 did not become one op');
  assert.equal(await run(`return page().doc.mnxJson === page().editor.session.doc;`), true, 'the page is not showing the session’s document');
  await run(`[...page().shadowRoot.querySelectorAll('.panel-tabs button')].find(b => b.textContent.trim().startsWith('ops')).click();`);
  await delay(300);
  assert.equal(await run(`return page().shadowRoot.querySelectorAll('ol.ops li').length;`), 2, 'the ops panel does not list the op');
  await run(`page().shadowRoot.querySelector('ol.ops li.baseline').click();`);
  await delay(300);
  assert.deepEqual(await run(`const s = page().editor.session; return [s.appliedOps.length, s.canRedo, page().doc.mnxJson === s.doc];`), [0, true, true], 'jumping to the start did not undo through the binding');
  await run(`page().shadowRoot.querySelector('ol.ops li.row-past').click();`);
  await delay(300);
  assert.equal(await run(`return page().editor.session.appliedOps.length;`), 1, 'redo from the ops panel');

  // ── revert REPLACES the session: the binding follows it ────────────────────
  await run(`window.__session = page().editor.session; button('discard every edit').click();`);
  await until(`page().editor && page().editor.session !== window.__session`, 'revert did not rebind the editor to a new session');
  assert.deepEqual(await run(`const s = page().editor.session; return [s.appliedOps.length, page().doc.mnxJson === s.doc, viewer().selection.activeMeasureIndex != null];`),
    [0, true, true], 'after revert: a clean session, shown, with a cursor');
  assert.equal(await run(`return page().shadowRoot.querySelectorAll('mnx-editor-surfaces').length;`), 1, 'a rebind left a second surfaces layer behind');
  const reverted = await run(`return JSON.stringify(page().editor.session.cursor);`);
  await press('ArrowRight', 'ArrowRight', 39);
  assert.notEqual(await run(`return JSON.stringify(page().editor.session.cursor);`), reverted, 'the keys died with the old session');

  // ── delete says which of its two presses this was ──────────────────────────
  await press('Delete', 'Delete', 46);
  assert.ok(await run(`return page().shadowRoot.querySelector('.clipboard-notice')?.textContent.trim();`), 'delete said nothing');

  // ── a rung this document does not present flashes the chip ─────────────────
  let refusals = 0;
  for (const [index, level] of ['note', 'event', 'voiceMeasure', 'partMeasure', 'measure', 'document'].entries()) {
    await press(String(index + 1), `Digit${index + 1}`, 49 + index, 8);
    if (await run(`return page().editor.session.selectionLevel;`) === level) continue;
    refusals++;
    assert.equal(await run(`return !!page().shadowRoot.querySelector('.rung-chip.refused');`), true, `Shift+${index + 1} (${level}) was refused without a flash`);
    await delay(900);
  }

  // ── a pointer outside the inspector closes it ──────────────────────────────
  await press('1', 'Digit1', 49, 8);
  await press('Enter', 'Enter', 13);
  await until(`find(document, 'mnx-rung-inspector')`, 'Enter did not open the inspector');
  assert.equal(await run(`return viewer().selectionInactive;`), false, 'the cursor dimmed while the inspector had the keyboard');
  const panel = JSON.parse(await run(`const r = page().shadowRoot.querySelector('.panel-tabs').getBoundingClientRect(); return JSON.stringify({ x: r.right - 4, y: r.bottom + 40 });`));
  await clickAt(panel.x, panel.y);
  assert.equal(await run(`return !!find(document, 'mnx-rung-inspector');`), false, 'a click outside left the inspector open');

  // ── the chip's word is Enter's door, by pointer ────────────────────────────
  await press('ArrowRight', 'ArrowRight', 39);
  await run(`page().shadowRoot.querySelector('.rung-chip .chip-word').click();`);
  await until(`find(document, 'mnx-rung-inspector')`, 'the chip did not open the inspector');
  if (process.env.WORKBENCH_EDITOR_SHOT) {
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.WORKBENCH_EDITOR_SHOT, Buffer.from(shot.result.data, 'base64'));
  }
  await press('Escape', 'Escape', 27);
  assert.equal(await run(`return !!find(document, 'mnx-rung-inspector');`), false, 'Escape left the inspector open');

  // ── ↑/↓ at the document rung walks the rail, and the rung survives the step ─
  await press('6', 'Digit6', 54, 8);
  assert.equal(await run(`return page().editor.session.selectionLevel;`), 'document');
  const here = await run(`window.__session = page().editor.session; return location.hash;`);
  await press('ArrowDown', 'ArrowDown', 40);
  await until(`location.hash !== ${JSON.stringify(here)} && page()?.editor && page().editor.session !== window.__session`, '↓ at the document rung did not reach the next scenario');
  assert.equal(await run(`return page().editor.session.selectionLevel;`), 'document', 'the rung did not survive the step across the rail');
  await run(`window.__session = page().editor.session;`);
  await press('ArrowUp', 'ArrowUp', 38);
  await until(`location.hash === ${JSON.stringify(here)} && page()?.editor && page().editor.session !== window.__session`, '↑ did not walk back');
  assert.equal(await run(`return page().editor.session.selectionLevel;`), 'document', 'the rung did not survive the step back');

  // ── construct replay builds a session elsewhere and hands it over; the sweep drives it directly ──
  await open('lab/tab-derivation/bare-melody');
  await run(`[...page().shadowRoot.querySelectorAll('.panel-tabs button')].find(b => b.textContent.trim().startsWith('ops')).click();`);
  await delay(300);
  await run(`window.__session = page().editor.session; button('replay construct trace').click();`);
  await until(`page().editor && page().editor.session !== window.__session`, 'replay did not rebind the editor');
  const built = await run(`const s = page().editor.session; return [s.appliedOps.length > 0, page().doc.mnxJson === s.doc, viewer().selection.activeMeasureIndex != null];`);
  assert.deepEqual(built, [true, true, true], 'after replay: the construct queue, shown, with a cursor');
  await press('z', 'KeyZ', 90, 2);
  assert.equal(await run(`return page().editor.session.canRedo;`), true, 'Ctrl+Z did not reach the replayed session');

  await c.send('Page.navigate', { url: 'about:blank' }); // the same hash again would not reload the page
  await open('lab/tab-derivation/bare-melody');
  await run(`[...page().shadowRoot.querySelectorAll('.panel-tabs button')].find(b => b.textContent.trim().startsWith('ops')).click();`);
  await delay(300);
  await run(`button('run destruct sweep').click();`);
  await delay(500);
  // The sweep dissolves the score to `{}`, which the page must survive showing (it compiles every revision).
  assert.deepEqual(await run(`const s = page().editor.session; return [s.appliedOps.length > 0, page().doc.mnxJson === s.doc];`), [true, true], 'the sweep’s ops did not reach the page');
  await press('z', 'KeyZ', 90, 2);
  assert.equal(await run(`const s = page().editor.session; return s.canRedo && page().doc.mnxJson === s.doc;`), true, 'Ctrl+Z after the sweep did not rebuild through the binding');

  console.log(`Workbench editor smoke passed: unclaimed keys, an edit shown and walked from the ops panel, revert and construct replay rebinding the editor, the destruct sweep, delete's sentence, ${refusals} refused rung(s) flashed, the inspector closed by a pointer outside and opened from the chip, and the rail walked from the document rung with the rung carried across.`);
} finally {
  ws?.close();
  chrome.kill();
  server.server.close();
}
