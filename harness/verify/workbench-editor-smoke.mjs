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
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client, settle } from './browserHarness.mjs';

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
const profile = fs.mkdtempSync(`${os.tmpdir()}/mnx-workbench-editor-`);
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
    await settle(c);
  };
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    await settle(c);
  };
  const open = async id => {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/workbench/#/scenario/${id}` });
    await until(`page()?.editor && viewer()?.selection?.activeMeasureIndex != null`, `no bound editor on ${id}`);
    await settle(c);
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
  await until(`page().editor.session.appliedOps.length > 0`, 'the fret window never closed');
  assert.equal(await run(`return page().editor.session.appliedOps.length;`), 1, 'fret 5 did not become one op');
  assert.equal(await run(`return page().doc.mnxJson === page().editor.session.doc;`), true, 'the page is not showing the session’s document');
  await run(`[...page().shadowRoot.querySelectorAll('.panel-tabs button')].find(b => b.textContent.trim().startsWith('ops')).click();`);
  await settle(c);
  assert.equal(await run(`return page().shadowRoot.querySelectorAll('ol.ops li').length;`), 2, 'the ops panel does not list the op');
  await run(`page().shadowRoot.querySelector('ol.ops li.baseline').click();`);
  await settle(c);
  assert.deepEqual(await run(`const s = page().editor.session; return [s.appliedOps.length, s.canRedo, page().doc.mnxJson === s.doc];`), [0, true, true], 'jumping to the start did not undo through the binding');
  await run(`page().shadowRoot.querySelector('ol.ops li.row-past').click();`);
  await settle(c);
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
    await until(`!page().shadowRoot.querySelector('.rung-chip.refused')`, 'the refusal flash never cleared');
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
  await settle(c);
  await run(`window.__session = page().editor.session; button('replay construct trace').click();`);
  await until(`page().editor && page().editor.session !== window.__session`, 'replay did not rebind the editor');
  const built = await run(`const s = page().editor.session; return [s.appliedOps.length > 0, page().doc.mnxJson === s.doc, viewer().selection.activeMeasureIndex != null];`);
  assert.deepEqual(built, [true, true, true], 'after replay: the construct queue, shown, with a cursor');
  await press('z', 'KeyZ', 90, 2);
  assert.equal(await run(`return page().editor.session.canRedo;`), true, 'Ctrl+Z did not reach the replayed session');

  await c.send('Page.navigate', { url: 'about:blank' }); // the same hash again would not reload the page
  await open('lab/tab-derivation/bare-melody');
  await run(`[...page().shadowRoot.querySelectorAll('.panel-tabs button')].find(b => b.textContent.trim().startsWith('ops')).click();`);
  await settle(c);
  await run(`button('run destruct sweep').click();`);
  await settle(c);
  // The sweep dissolves the score to `{}`, which the page must survive showing (it compiles every revision).
  assert.deepEqual(await run(`const s = page().editor.session; return [s.appliedOps.length > 0, page().doc.mnxJson === s.doc];`), [true, true], 'the sweep’s ops did not reach the page');
  // …and survive RENDERING it: settle() counts a thrown update as finished, so ask the page directly.
  assert.equal(await run(`try { await page().updateComplete; return 'rendered'; } catch (error) { return String(error); }`), 'rendered', 'the page threw rendering the swept {}');
  await press('z', 'KeyZ', 90, 2);
  assert.equal(await run(`const s = page().editor.session; return s.canRedo && page().doc.mnxJson === s.doc;`), true, 'Ctrl+Z after the sweep did not rebuild through the binding');

  // ── a pointer places the cursor (core-editor-pointer-placement.md) ────────
  //
  // The whole chain in a real browser: the viewer measures the page, the host
  // turns that into an intent, the session lands, and the overlay redraws.
  //
  // The assertion compares the placement against what was under the pointer AT
  // THE MOMENT OF THE PRESS, captured by a listener rather than measured
  // beforehand. Coordinates read in advance are not trustworthy here: placing
  // the cursor can reveal-scroll the score, so a rect measured one round trip
  // earlier may name a different note by the time the press is dispatched.
  // (That is also why placement listens on `pointerdown` and not `click` — a
  // press that re-engraves the score leaves mouse-down and mouse-up on
  // different nodes, and no `click` is synthesised at all.)
  await c.send('Page.navigate', { url: 'about:blank' });
  await open('lab/document/twelve-bar-blues');
  assert.equal(await run(`return viewer().pointerPlacement;`), true, 'bindEditor did not turn placement on');

  await run(`
    window.__placed = [];
    const v = viewer();
    v.addEventListener('position-selected', e => {
      window.__placed.push({ detail: JSON.parse(JSON.stringify(e.detail)) });
    });
    // What the pointer was actually over, read in the same dispatch.
    v.container.addEventListener('pointerdown', e => {
      const el = e.composedPath().find(n => n.getAttribute && n.getAttribute('data-source-id'));
      const last = window.__placed.length;
      window.__under = el ? el.getAttribute('data-source-id') : null;
    }, true);
    return 'armed';`);

  // Aim at a notehead on screen; whichever note is under the pointer when the
  // press lands is the one the cursor must end up on.
  const aim = await run(`
    const svg = viewer().renderRoot.querySelector('#projection-container svg');
    const glyphs = [...svg.querySelectorAll('.notehead[data-source-id], .fret-number[data-source-id]')];
    const vis = glyphs.filter(g => {
      const r = g.getBoundingClientRect();
      return r.top > 60 && r.bottom < window.innerHeight - 60 && r.left > 60 && r.right < window.innerWidth - 60;
    });
    const el = vis[Math.floor(vis.length * 0.6)];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  `);
  assert.ok(aim, 'the score drew no on-screen note ink to aim at');
  const at = JSON.parse(aim);
  await clickAt(at.x, at.y);

  const placed = JSON.parse(await run(`return JSON.stringify({ placed: window.__placed, under: window.__under });`));
  assert.equal(placed.placed.length, 1, 'a press on the score emitted no placement');
  assert.ok(placed.under, 'the press did not land on note ink at all');
  assert.equal(placed.placed[0].detail.noteKey, placed.under, 'the placement named a different note than the one pressed');
  assert.equal(
    await run(`return (viewer().selection.selectedNoteIds ?? []).includes(${JSON.stringify(placed.under)});`),
    true,
    'the cursor did not land on the note that was pressed'
  );
  assert.equal(
    await run(`return page().editor.session.cursor.measureIndex;`),
    placed.placed[0].detail.measureIndex,
    'the session landed in a different bar than the placement named'
  );

  // ── A PRESS ON A BLANK STRING LANDS ON THE BEAT BESIDE IT ────────────────
  //
  // The tab staff draws no rests and most of its strings are empty, so a press
  // there is usually over no ink at all — and it used to be resolved by a
  // LINEAR fraction of the bar's width. Engraving is not linear (a bar with a
  // clef and a time signature starts its ink a quarter of the way in), so the
  // press drifted to the next beat: the owner's report was that clicking the
  // first rest of a bar of rests entered the note on the second.
  //
  // The invariant needs no knowledge of the document. Press a fret digit, then
  // press the SAME x on a string with nothing on it: both are the same beat, so
  // the cursor must not move along the bar. Before the columns were measured,
  // the second press walked off the first.
  await run(`window.__placed = []; window.__under = undefined;`);
  const column = await run(`
    const svg = viewer().renderRoot.querySelector('#projection-container svg');
    const onScreen = r => r.top > 80 && r.bottom < window.innerHeight - 80 && r.left > 80 && r.right < window.innerWidth - 80;
    const digits = [...svg.querySelectorAll('.fret-number[data-source-id]')]
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(d => onScreen(d.r));
    const ink = [...svg.querySelectorAll('[data-source-id]')].map(el => el.getBoundingClientRect());
    const clear = (x, y) => !ink.some(r => x > r.left - 4 && x < r.right + 4 && y > r.top - 4 && y < r.bottom + 4);
    for (const d of digits) {
      const x = d.r.x + d.r.width / 2, y = d.r.y + d.r.height / 2;
      // One or two strings away, whichever side has nothing drawn on it.
      for (const dy of [d.r.height * 1.4, -d.r.height * 1.4, d.r.height * 2.8, -d.r.height * 2.8]) {
        if (!clear(x, y + dy)) continue;
        if (!onScreen({ top: y + dy - 4, bottom: y + dy + 4, left: x - 4, right: x + 4 })) continue;
        return JSON.stringify({ key: d.el.getAttribute('data-source-id'), x, y, blankY: y + dy });
      }
    }
    return null;
  `);
  assert.ok(column, 'found no fret digit with a blank string beside it to press');
  const col = JSON.parse(column);

  await clickAt(col.x, col.y); // on the digit itself: the exact path
  const onInk = JSON.parse(await run(`
    const c = page().editor.session.cursor;
    return JSON.stringify({ measureIndex: c.measureIndex, num: c.onset.num, den: c.onset.den });
  `));

  await run(`window.__placed = []; window.__under = undefined;`);
  await clickAt(col.x, col.blankY); // the same beat, on a string with nothing on it
  const offInk = JSON.parse(await run(`
    const c = page().editor.session.cursor;
    return JSON.stringify({ measureIndex: c.measureIndex, num: c.onset.num, den: c.onset.den });
  `));
  const blankPress = JSON.parse(await run(`return JSON.stringify(window.__placed[0]?.detail ?? null);`));
  assert.ok(blankPress, 'a press on a blank string emitted no placement');
  assert.equal(blankPress.projection, 'tab', 'the press did not land on the fingerboard');
  assert.ok(
    blankPress.columnKey,
    'the press fell back to the linear fraction: no drawn column was measured'
  );
  assert.equal(
    `${offInk.measureIndex}:${offInk.num}/${offInk.den}`,
    `${onInk.measureIndex}:${onInk.num}/${onInk.den}`,
    'pressing a blank string beside a fret digit landed on a different beat than the digit itself'
  );

  // A press on empty staff space places too — the owner's case is a skeleton
  // of rests with no ink to aim at. Here: the same staff, a space above its
  // top line, where no glyph sits.
  await run(`window.__placed = []; window.__under = undefined;`);
  const blank = await run(`
    const svg = viewer().renderRoot.querySelector('#projection-container svg');
    const box = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const scale = box.height / (view.height || 1);
    const ys = [...svg.querySelectorAll('line.staff-line')]
      .map(l => box.y + (l.y1.baseVal.value - view.y) * scale)
      .filter(y => y > 80 && y < window.innerHeight - 80)
      .sort((a, b) => a - b);
    if (ys.length < 2) return null;
    return JSON.stringify({ x: box.x + box.width * 0.45, y: (ys[0] + ys[1]) / 2 });
  `);
  assert.ok(blank, 'no staff lines on screen to aim between');
  const gap = JSON.parse(blank);
  await clickAt(gap.x, gap.y);
  const onBlank = JSON.parse(await run(`return JSON.stringify(window.__placed);`));
  assert.equal(onBlank.length, 1, 'a press on empty staff space emitted no placement');
  assert.equal(
    await run(`return page().editor.session.cursor.measureIndex;`),
    onBlank[0].detail.measureIndex,
    'a press on empty staff space did not move the cursor to the bar it named'
  );

  // The hover ghost: a mouse over the paper proposes a landing, and leaving
  // takes it away. Touch never sees it, which is why the snap has to be enough.
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: gap.x + 30, y: gap.y, button: 'none' });
  await settle(c);
  assert.equal(
    await run(`const svg = viewer().renderRoot.querySelector('#projection-container svg'); return !!svg.querySelector(':scope > g.pointer-ghost');`),
    true,
    'a mouse over the score drew no hover ghost'
  );
  await run(`viewer().container.dispatchEvent(new PointerEvent('pointerleave'));`);
  await settle(c);
  assert.equal(
    await run(`const svg = viewer().renderRoot.querySelector('#projection-container svg'); return !!svg.querySelector(':scope > g.pointer-ghost');`),
    false,
    'the hover ghost outlived the pointer'
  );

  // ── click targets (core-editor-click-targets.md) ─────────────────────────
  //
  // Every point is an element (selected), a slot (places the cursor) or dead
  // space (nothing). The gutter between two systems is dead: a press there
  // emits no placement, moves no cursor, and the hover shows nothing.
  const pressTwice = async (x, y) => {
    // A person's double press does not run on from the single press before it.
    await delay(600);
    for (const clickCount of [1, 2]) {
      for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount });
    }
    await settle(c);
  };
  await run(`window.__placed = []; window.__pressed = [];
    viewer().addEventListener('element-selected', e => window.__pressed.push(['selected', JSON.parse(JSON.stringify(e.detail))]));
    viewer().addEventListener('element-activated', e => window.__pressed.push(['activated', JSON.parse(JSON.stringify(e.detail))]));
    return 'armed';`);
  // Dead paper by the slot rule itself: the staves' reaches (three ledger
  // lines in notation, half a gap in tab), and a point outside every one —
  // between two systems when they stand far enough apart, else above the first.
  const gutter = await run(`
    const v = viewer(); const { svg, map } = v.measuredPage();
    const ctm = svg.getScreenCTM();
    const toClient = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(ctm); };
    const reachOf = (band, i) => (map.tab[i] ? 0.5 : 3.25) * (map.gaps[i] || map.sp);
    const staves = map.staves.map((band, i) => ({ top: band.top - reachOf(band, i), bottom: band.bottom + reachOf(band, i), x: (band.x1 + band.x2) / 2 }))
      .sort((a, b) => a.top - b.top);
    const holes = [[svg.viewBox.baseVal.y, staves[0].top]];
    for (let i = 0; i + 1 < staves.length; i++) holes.push([staves[i].bottom, staves[i + 1].top]);
    for (const [from, to] of holes) {
      if (to - from < 2 * map.sp) continue;
      const at = toClient(staves[0].x, (from + to) / 2);
      if (at.y > 80 && at.y < window.innerHeight - 80) return JSON.stringify({ x: at.x, y: at.y });
    }
    return null;`);
  assert.ok(gutter, 'found no dead paper on screen to press');
  const gap2 = JSON.parse(gutter);
  const beforeGutter = await run(`return JSON.stringify(page().editor.session.cursor);`);
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: gap2.x, y: gap2.y, button: 'none' });
  await settle(c);
  assert.equal(
    await run(`const svg = viewer().renderRoot.querySelector('#projection-container svg'); return !!svg.querySelector(':scope > g.pointer-ghost');`),
    false,
    'the hover over dead paper promised a landing: ' + await run(`
      const v = viewer(); const pg = v.measuredPage(); const svg = pg.svg;
      const pt = v.scorePointOf({ clientX: ${gap2.x}, clientY: ${gap2.y} }, svg);
      return JSON.stringify({ pt, staves: pg.map.staves, gaps: pg.map.gaps, sig: v.hoverSignature,
        ghost: svg.querySelector(':scope > g.pointer-ghost rect')?.getAttribute('y') });`)
  );
  await clickAt(gap2.x, gap2.y);
  assert.equal(await run(`return window.__placed.length;`), 0, 'a press on dead paper emitted a placement');
  assert.equal(await run(`return JSON.stringify(page().editor.session.cursor);`), beforeGutter, 'a press on dead space moved the cursor');

  // A REPEAT COUNT is an element: hover outlines it, a press selects its bar
  // at the bar rung, and a double press opens the inspector on its pill with
  // the value selected — ×3 becomes ×4 by typing 4 and Enter.
  await c.send('Page.navigate', { url: 'about:blank' });
  await open('lab/navigation/repeats-and-marks-on-tab');
  await run(`window.__pressed = [];
    viewer().addEventListener('element-selected', e => window.__pressed.push(['selected', JSON.parse(JSON.stringify(e.detail))]));
    viewer().addEventListener('element-activated', e => window.__pressed.push(['activated', JSON.parse(JSON.stringify(e.detail))]));
    return 'armed';`);
  const times = JSON.parse(await run(`
    const el = viewer().renderRoot.querySelector('#projection-container svg .repeat-times[data-element="repeat-end"]');
    if (!el) return 'null';
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, measure: Number(el.getAttribute('data-measure')) });`));
  assert.ok(times, 'the repeat count carries no element target');
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: times.x, y: times.y, button: 'none' });
  await settle(c);
  assert.equal(
    await run(`const svg = viewer().renderRoot.querySelector('#projection-container svg'); return [!!svg.querySelector(':scope > g.element-hover'), !!svg.querySelector(':scope > g.pointer-ghost')].join();`),
    'true,false',
    'hovering the repeat count did not outline it (or still drew a landing ghost)'
  );
  await clickAt(times.x, times.y);
  assert.deepEqual(
    JSON.parse(await run(`const s = page().editor.session; return JSON.stringify([window.__pressed.map(p => p[0]).join(), s.cursor.measureIndex, s.selectionLevel, viewer().selection.focusedElement]);`)),
    ['selected', times.measure, 'measure', `repeat-end:${times.measure}`],
    'a press on the repeat count did not select its bar at the bar rung'
  );
  assert.equal(
    await run(`return !!viewer().renderRoot.querySelector('#projection-container svg > g.element-focus');`),
    true,
    'the selected repeat is not outlined'
  );
  await pressTwice(times.x, times.y);
  await until(`find(document, 'mnx-rung-inspector')?.renderRoot.querySelector('input')`, 'a double press on the repeat count did not open its pill');
  const amend = JSON.parse(await run(`
    const input = find(document, 'mnx-rung-inspector').renderRoot.querySelector('input');
    return JSON.stringify({ value: input.value, selected: input.value.slice(input.selectionStart, input.selectionEnd) });`));
  assert.deepEqual(amend, { value: '3', selected: '3' }, 'the repeat pill did not open with its count selected');
  await press('4', 'Digit4', 52, 0, '4');
  await press('Enter', 'Enter', 13);
  assert.equal(
    await run(`return page().editor.session.doc.global.measures[${times.measure}].repeatEnd.times;`),
    4,
    'typing 4 into the opened pill did not make the repeat ×4'
  );
  await press('Escape', 'Escape', 27);

  // A LYRIC is an element: a press puts the cursor on its note at the note
  // rung, and a double press opens the lyric panel with the caret on the word.
  await c.send('Page.navigate', { url: 'about:blank' });
  await open('lab/lyrics/tab-verses');
  const word = JSON.parse(await run(`
    const el = [...viewer().renderRoot.querySelectorAll('#projection-container svg text.lyric[data-lyric-line="1"]')]
      .find(t => t.textContent === 'did');
    if (!el) return 'null';
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, key: el.getAttribute('data-playback-id') });`));
  assert.ok(word, 'no syllable "did" drawn to press');
  await run(`page().editor.handleIntent({ type: 'goToLevel', level: 'measure' }); return true;`);
  await clickAt(word.x, word.y);
  assert.deepEqual(
    JSON.parse(await run(`const s = page().editor.session; return JSON.stringify([s.selectionLevel, s.selectedNoteKeys.includes(${JSON.stringify(word.key)}), (viewer().selection.focusedElement ?? '').startsWith('lyric:1:')]);`)),
    ['note', true, true],
    'a press on a syllable did not put the cursor on its note at the note rung'
  );
  await pressTwice(word.x, word.y);
  await until(`find(document, 'mnx-lyric-text-editor')?.renderRoot.querySelector('textarea')`, 'a double press on a syllable did not open the lyric panel');
  await settle(c);
  assert.equal(
    await run(`const area = find(document, 'mnx-lyric-text-editor').renderRoot.querySelector('textarea'); return area.value.slice(area.selectionStart, area.selectionEnd);`),
    'did',
    'the lyric panel did not open with the caret on the pressed word'
  );
  // The word is outlined in the panel, not only selected: a press on the score takes
  // focus from the box, and an unfocused box draws no selection.
  const markOf = `const ed = find(document, 'mnx-lyric-text-editor').renderRoot, area = ed.querySelector('textarea');
    const mark = ed.querySelector('.marks span'), m = mark.getBoundingClientRect(), a = area.getBoundingClientRect();
    const g = document.createElement('canvas').getContext('2d'); g.font = getComputedStyle(area).font;
    return JSON.stringify({ hidden: mark.hidden, inside: m.left >= a.left && m.right <= a.right && m.top >= a.top && m.bottom <= a.bottom,
      chars: (m.width - 4) / g.measureText('M').width, left: m.left, top: m.top,
      word: area.value.slice(area.selectionStart, area.selectionEnd), focused: ed.activeElement === area });`;
  const opened = JSON.parse(await run(markOf));
  assert.ok(!opened.hidden && opened.inside && Math.abs(opened.chars - 3) < 0.5, `the pressed word is not outlined in the lyric panel: ${JSON.stringify(opened)}`);
  // …and the outline follows a press on another syllable while the box is not being typed in.
  const next = JSON.parse(await run(`
    const el = [...viewer().renderRoot.querySelectorAll('#projection-container svg text.lyric[data-lyric-line="1"]')]
      .find(t => t.textContent.length > 1 && t.textContent !== 'did' && t.getAttribute('data-playback-id') !== ${JSON.stringify(word.key)});
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent });`));
  await clickAt(next.x, next.y);
  await settle(c);
  const moved = JSON.parse(await run(markOf));
  assert.ok(!moved.hidden && !moved.focused && moved.word === next.text && (moved.left !== opened.left || moved.top !== opened.top)
    && Math.abs(moved.chars - next.text.length) < 0.5, `a press on "${next.text}" did not move the panel's outline to it: ${JSON.stringify(moved)}`);
  // A note of that event the word is not stored on — a chord's other note — still outlines it, as the score lights it.
  const ops = await run(`return page().editor.session.appliedOps.length;`);
  await press('ArrowUp', 'ArrowUp', 38);
  await press('7', 'Digit7', 55, 0, '7');
  await until(`page().editor.session.appliedOps.length > ${ops}`, 'the chord note was never entered');
  await settle(c);
  const chord = JSON.parse(await run(markOf));
  assert.ok(!chord.hidden && chord.left === moved.left && chord.top === moved.top,
    `the cursor on the chord's other note outlines no word in the lyric panel: ${JSON.stringify({ chord, moved })}`);
  await press('z', 'KeyZ', 90, 2);
  // Playing, the outline follows the sung word, as the score's lyric does.
  await press(' ', 'Space', 32);
  await until(`find(document, 'mnx-player').snapshot?.state === 'playing'`, 'Space did not start playback with the lyric panel open');
  for (let i = 0; i < 100; i++) {
    const now = JSON.parse(await run(markOf));
    if (!now.hidden && (now.left !== moved.left || now.top !== moved.top)) break;
    if (i === 99) assert.fail(`the lyric panel's outline did not follow the music: ${JSON.stringify(now)}`);
    await delay(100);
  }
  await press(' ', 'Space', 32);
  await until(`find(document, 'mnx-player').snapshot?.state !== 'playing'`, 'Space did not pause');
  // A place nobody sings is still one token's: the cursor on a skipped note outlines the `_`, and in
  // a bar without words the `×1` — the same answer the playhead gets, with the line lit.
  await run(`const ed = find(document, 'mnx-lyric-text-editor'), area = ed.renderRoot.querySelector('textarea');
    area.value = 'Sun _ glide down | ×1 | wa-ter car-ry | me safe-ly home'; area.dispatchEvent(new Event('input')); ed.commit(); return true;`);
  await settle(c);
  const outlined = async () => JSON.parse(await run(`const ed = find(document, 'mnx-lyric-text-editor').renderRoot, area = ed.querySelector('textarea');
    return JSON.stringify({ hidden: ed.querySelector('.marks .word').hidden, word: area.value.slice(area.selectionStart, area.selectionEnd),
      lit: ed.querySelector('.paint-inner > .now')?.textContent ?? null });`));
  await press('Home', 'Home', 36);
  assert.equal((await outlined()).word, 'Sun', 'Home did not outline the first word');
  await press('ArrowRight', 'ArrowRight', 39);
  const skip = await outlined();
  assert.ok(!skip.hidden && skip.word === '_' && skip.lit?.startsWith('Sun _'), `the cursor on a skipped note does not outline its _: ${JSON.stringify(skip)}`);
  for (let i = 0; i < 3; i++) await press('ArrowRight', 'ArrowRight', 39);
  const run1 = await outlined();
  assert.ok(!run1.hidden && run1.word === '×1' && run1.lit?.startsWith('Sun _'), `the cursor in a bar without words does not outline its ×1: ${JSON.stringify(run1)}`);
  // The copy button hands over the whole text, as typed — the backup a paste puts back.
  const copiedText = JSON.parse(await run(`const ed = find(document, 'mnx-lyric-text-editor').renderRoot;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedLyrics = text; } } });
    ed.querySelector('button.copy').click(); await new Promise(r => setTimeout(r, 50)); await find(document, 'mnx-lyric-text-editor').updateComplete;
    return JSON.stringify({ copied: window.copiedLyrics ?? null, text: ed.querySelector('textarea').value, label: ed.querySelector('button.copy').getAttribute('aria-label') });`));
  assert.ok(copiedText.copied === copiedText.text && copiedText.text.startsWith('Sun _') && copiedText.label === 'Copied', `the copy button did not copy the lyric text: ${JSON.stringify(copiedText)}`);
  await run(`find(document, 'mnx-lyric-text-editor').dispatchEvent(new CustomEvent('lyric-editor-close')); return true;`);
  await settle(c);

  // ── the container may arrive LATE, and must still be bound ────────────────
  //
  // The studio bug, as a test. With no document the viewer renders a "no
  // document" panel and NO score container, so a host that loads its piece
  // asynchronously first-updates with nothing to bind to. Binding once in
  // `firstUpdated` bound nothing and never tried again: in studio a click on
  // the score did nothing at all, while the workbench — which has its scenario
  // at first render — worked, which is why this hid. Here the document is
  // taken away and given back, which destroys and rebuilds that container.
  const rebound = JSON.parse(await run(`
    const v = viewer();
    const doc = v.mnxDoc;
    v.mnxDoc = undefined;
    await v.updateComplete;
    const gone = { container: !!v.container, bound: !!v.boundContainer };
    v.mnxDoc = doc;
    await v.updateComplete;
    await new Promise(r => setTimeout(r, 700));
    let fired = null;
    const onPlace = e => { fired = JSON.parse(JSON.stringify(e.detail)); };
    v.addEventListener('position-selected', onPlace);
    const svg = v.container && v.container.querySelector('svg');
    // On a staff line: a press on the paper between systems is dead space and places nothing.
    const line = svg && svg.querySelector('line.staff-line');
    if (line) {
      const r = svg.getBoundingClientRect(), l = line.getBoundingClientRect();
      v.container.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.x + r.width * 0.35, clientY: l.y + l.height / 2,
        button: 0, isPrimary: true, pointerType: 'mouse', bubbles: true, composed: true
      }));
    }
    v.removeEventListener('position-selected', onPlace);
    return JSON.stringify({ gone, container: !!v.container, bound: !!v.boundContainer,
                            observer: !!v.containerObserver, fired });
  `));
  assert.equal(rebound.gone.container, false, 'a document-less viewer drew a score container after all — this no longer reproduces the bug');
  assert.equal(rebound.gone.bound, false, 'the viewer still held a container it no longer has');
  assert.equal(rebound.container, true, 'the returning document drew no score container');
  assert.equal(rebound.bound, true, 'the container came back but was never re-bound: a click on the score would do nothing');
  assert.equal(rebound.observer, true, 'the returning container got no resize observer, so the score would not re-engrave on a width change');
  assert.ok(rebound.fired, 'a press on a viewer whose container arrived late emitted no placement');

  // ── Space at the score is the transport, not an editor key ────────────────
  // The viewer reports it as `transport-toggle` (the two-finger tap's event)
  // and the host calls toggle(), so the keystroke never has to know a player
  // exists. `toggleNote` moved to `N` to make room; that binding is pinned in
  // harness/conformance/keymap-docs.test.ts, along with Space resolving to
  // NOTHING in the keymap — which is what lets the event reach the surface.
  await open('lab/document/twelve-bar-blues');
  await until(`find(document, 'mnx-player')?.performance`, 'the scenario page never loaded a performance');
  await run(`viewer().focus(); return true;`);
  assert.equal(await run(`return find(document, 'mnx-document-viewer') === page().shadowRoot.activeElement;`), true,
    'the score did not take focus, so this proves nothing about a key pressed at it');
  await press(' ', 'Space', 32);
  await until(`find(document, 'mnx-player').snapshot?.state === 'playing'`, 'Space at the score did not start playback');
  await press(' ', 'Space', 32);
  await until(`find(document, 'mnx-player').snapshot?.state !== 'playing'`, 'Space again did not pause');
  assert.equal(await run(`return window.scrollY === 0 && document.documentElement.scrollTop === 0;`), true,
    'Space scrolled the page: the surface did not take the keystroke');

  console.log(`Workbench editor smoke passed: unclaimed keys, an edit shown and walked from the ops panel, revert and construct replay rebinding the editor, the destruct sweep, delete's sentence, ${refusals} refused rung(s) flashed, the inspector closed by a pointer outside and opened from the chip, the rail walked from the document rung with the rung carried across, a pointer placing the cursor on the note it clicked with a hover ghost before it, a press on dead paper doing nothing, a repeat count selected and amended ×3→×4 from its pill, a syllable selected and opened in the lyric panel with its word outlined there, the outline following the next press, a chord's other note and the music, a skipped note and a bar without words outlined as their _ and ×1, the copy button handing over the text, and a viewer whose document arrived late still binding its score surface, and Space at the score playing and pausing the transport.`);
} finally {
  ws?.close();
  chrome.kill();
  server.server.close();
}
