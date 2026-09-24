// Writing notes in Studio, in a real browser against the local Worker/D1/R2
// (roadmap/complete/core-editor-element-promotion.md, slice 1 — keyboard only).
// Its own private library, like studio-smoke.mjs. Real key events through the DevTools
// protocol, because the point is who hears them: the editor's listener is on the
// viewer, so keys typed into a text field must not reach it.
import os from 'node:os';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client, until, STUDIO_STATE, stopChrome } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';
const library = await startLocalLibrary();
const { origin, session } = library;
const api = async path => fetch(`${origin}/api/library${path}`, { headers: { 'Cf-Access-Jwt-Assertion': session.browser } });
const title = `Editor smoke ${Date.now()}`;
const profile = await fs.mkdtemp(`${os.tmpdir()}/mnx-studio-editor-browser-`);
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws,'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  // A headless page is not the focused window, and an unfocused page fires no focus events: emulate one, as a person's would be.
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  const wait = expression => until(c, expression, { timeoutMs: 20000, describe: STUDIO_STATE });
  const VK = { ArrowRight: 39, ArrowLeft: 37, Escape: 27, Enter: 13, Delete: 46, KeyZ: 90, KeyY: 89, KeyL: 76, KeyC: 67, KeyV: 86, Digit1: 49, Digit2: 50, Digit3: 51, Digit5: 53 };
  const key = async (code, { ctrl = false, shift = false, text } = {}) => {
    const base = { code, key: text ?? code, windowsVirtualKeyCode: VK[code], modifiers: (ctrl ? 2 : 0) | (shift ? 8 : 0) };
    await c.send('Input.dispatchKeyEvent', { type: text && !ctrl ? 'keyDown' : 'rawKeyDown', ...base, ...(text && !ctrl ? { text } : {}) });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };
  const app = "document.querySelector('mnx-studio')?.shadowRoot";
  const form = `${app}?.querySelector('mnx-studio-new-piece')?.shadowRoot`;
  const page = `${app}?.querySelector('mnx-studio-piece')`;
  const piece = `${page}?.shadowRoot`;
  const viewer = `${piece}?.querySelector('mnx-document-viewer')`;
  const details = `${piece}?.querySelector('mnx-studio-edit-piece[slot=side]')?.shadowRoot`;
  // The pencil beside the title, not a tools-row button: one panel holds the
  // score's header, what was read from the notes, and your own values.
  const editPiece = `${piece}.querySelector('button[slot=title-action]')`;
  const saving = `${piece}?.querySelector('mnx-studio-save[slot=side]')?.shadowRoot`;
  const keys = `${piece}?.querySelector('mnx-studio-keys[slot=side]')?.shadowRoot`;
  const chip = `${piece}?.querySelector('button.save')`;
  const action = text => `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => (b.getAttribute('aria-label') ?? b.textContent).includes(${JSON.stringify(text)}))`;
  // Every fretted note in the live document, as "bar:string:fret".
  const frets = `JSON.stringify(${piece}.querySelector('mnx-player').document.parts[0].measures.flatMap((m, bar) => m.sequences.flatMap(s => s.content.flatMap(e => (e.notes ?? []).map(n => bar + ':' + n._x?.mnxLab?.string + ':' + n._x?.mnxLab?.fret)))))`;
  const fretsNow = async () => JSON.parse(await c.evaluate(frets));

  await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'});
  await c.send('Page.navigate',{url:origin+'/studio/#/new'}); await c.send('Page.reload');
  await wait(`!!${form}?.querySelector('form')`);
  await c.evaluate(`{ const i = ${form}.querySelector('label input'); i.value = ${JSON.stringify(title)}; i.dispatchEvent(new Event('input')); ${form}.querySelector('form').requestSubmit(); }`);
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash)`);
  const pieceId = (await c.evaluate('location.hash')).slice('#/piece/'.length);
  await wait(`${chip}?.dataset.save === 'clean' && !!${page}.editor`);

  // Until the score has the keyboard the cursor is dimmed; focus it and it is live.
  await wait(`${viewer}.selection?.cursor != null && ${viewer}.selectionInactive === true`);
  await c.evaluate(`${viewer}.focus()`);
  await wait(`${viewer}.selectionInactive === false`);
  assert.deepEqual(await fretsNow(), []);

  // A fret: the digit waits out its window (is "1" the start of "12"?), then becomes a note where the cursor stands.
  await key('Digit3', { text: '3' });
  await wait(`${frets} !== '[]'`);
  const first = await fretsNow();
  assert.equal(first.length, 1); assert.match(first[0], /^0:\d:3$/);
  await wait(`${chip}.textContent.trim() === '1 edit unsaved'`);
  // Two digits inside the window are one fret.
  await key('ArrowRight'); await key('Digit1', { text: '1' }); await key('Digit2', { text: '2' });
  await wait(`JSON.parse(${frets}).some(f => f.endsWith(':12'))`);
  assert.equal((await fretsNow()).length, 2);
  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-editor.png',Buffer.from(shot.result.data,'base64'));

  // Undo and redo from the keyboard.
  await key('KeyZ', { ctrl: true }); await wait(`JSON.parse(${frets}).length === 1`);
  await key('KeyY', { ctrl: true }); await wait(`JSON.parse(${frets}).length === 2`);

  // One history for notes and metadata: the Details sheet's Undo takes back the artist, then the fret.
  await c.evaluate(`${editPiece}.click()`); await wait(`!!${details}?.querySelector('input')`);
  await c.evaluate(`{ const i = [...${details}.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Artist')).querySelector('input'); i.focus(); i.value = 'A synthetic author'; i.dispatchEvent(new Event('change')); }`);
  await wait(`${piece}.querySelector('mnx-player').document._x.mnxLab.work.artist === 'A synthetic author'`);
  // A digit typed INTO the text field is the field's: the editor's listener is on the viewer, and never hears it.
  await key('Digit5', { text: '5' });
  await new Promise(r => setTimeout(r, 800));
  assert.equal((await fretsNow()).length, 2, 'a key typed in a text field reached the editor');
  const undo = `[...${details}.querySelectorAll('button')].find(b => b.textContent === 'Undo')`;
  await c.evaluate(`${undo}.click()`);
  await wait(`${piece}.querySelector('mnx-player').document._x.mnxLab.work.artist === undefined`);
  await c.evaluate(`${undo}.click()`);
  await wait(`JSON.parse(${frets}).length === 1`);
  await c.evaluate(`[...${details}.querySelectorAll('button')].find(b => b.textContent === 'Redo').click()`);
  await wait(`JSON.parse(${frets}).length === 2`);

  // The Keys sheet lists what is bound HERE, for the rung the cursor is on.
  await c.evaluate(`${action('Keys')}.click()`); await wait(`!!${keys}?.querySelector('.row')`);
  const listed = await c.evaluate(`${keys}.textContent`);
  for (const expected of ['Note entry', 'a note', 'Ctrl+Z']) assert.ok(listed.includes(expected), `Keys sheet lacks "${expected}"`);
  assert.ok(!/palette/i.test(listed), 'Keys sheet advertises a surface that is not mounted');
  for (const mounted of ['Enter', 'Shift+L', '+C']) assert.ok(listed.includes(mounted), `Keys sheet lacks "${mounted}", which is mounted here`);

  // ── slices 2–3: the surfaces ──────────────────────────────────────────────
  // The rung inspector: Enter, over the selection, wearing the design system's tokens though studio declares none of them.
  const inspector = `${piece}.querySelector('.editor-overlay mnx-editor-surfaces mnx-rung-inspector')`;
  await c.evaluate(`${viewer}.focus()`);
  await c.evaluate(`${page}.editor.handleIntent({ type: 'goToLevel', level: 'measure' })`);
  await key('Enter');
  await wait(`!!${inspector} && ${inspector}.crumbs.length > 0 && ${inspector}.anchor != null`);
  assert.notEqual(await c.evaluate(`getComputedStyle(${inspector}).getPropertyValue('--surface').trim()`), '', 'the inspector has no palette here');
  assert.equal(await c.evaluate(`${viewer}.selectionInactive`), false, 'the cursor dimmed although the inspector — ours — has the keyboard');
  const inspectorShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-inspector.png',Buffer.from(inspectorShot.result.data,'base64'));
  // A line the grammar cannot read is a sentence; one it can is an edit — and a meter is a change of shape, saved at once.
  await c.evaluate(`${inspector}.dispatchEvent(new CustomEvent('inspector-apply', { detail: { word: 'time', text: 'nonsense' } }))`);
  await wait(`typeof ${inspector}.error === 'string' && ${inspector}.error.length > 0`);
  await c.evaluate(`${inspector}.dispatchEvent(new CustomEvent('inspector-apply', { detail: { word: 'time', text: '3/4' } }))`);
  await wait(`${piece}.querySelector('mnx-player').document.global.measures[0].time.count === 3 && ${inspector}.error === null`);
  assert.equal(await c.evaluate(`${page}.editor.session.selectionLevel`), 'measure', 'the inspector let the ladder fall off its rung');
  await wait(`${chip}.dataset.save === 'clean' && ${chip}.textContent.includes('just now')`);
  // Escape, typed into the inspector, closes it and hands the keyboard back to the score.
  await key('Escape');
  await wait(`!${inspector} && ${viewer}.selectionInactive === false`);

  // Actual typed meter commands in an editable Studio session, with exact history.
  const meterRead = () => c.evaluate(`${page}.editor.document`);
  const meterInitial = await meterRead();
  const typeMeter = async (text, submit = true) => {
    await c.evaluate(`${viewer}.focus()`);
    await key('Digit5', { shift: true }); await key('Enter');
    await wait(`!!${inspector}`);
    for (const ch of text) {
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    if (submit) await key('Enter');
  };
  for (const [count, unit] of [[33,4], [3,128]]) {
    const beforeMeter = await meterRead();
    await typeMeter(`time ${count}/${unit}`);
    await wait(`${page}.editor.document.global.measures[0].time.count === ${count} && ${page}.editor.document.global.measures[0].time.unit === ${unit}`);
    const changed = await meterRead();
    assert.deepEqual(changed.global.measures.slice(1), beforeMeter.global.measures.slice(1));
    // These bars inherit the first meter, so their rest padding must change too.
    const ink = d => d.parts.map(p => p.measures.map(m => ({ ...m, sequences: m.sequences.map(s => ({ ...s, content: s.content.filter(e => !e.rest) })) })));
    assert.deepEqual(ink(changed), ink(beforeMeter));
    const notes = d => d.parts[0].measures[0].sequences[0].content.filter(e => e.notes);
    assert.deepEqual(notes(changed), notes(beforeMeter));
    await key('Escape'); await c.evaluate(`${viewer}.focus()`);
    await key('KeyZ', { ctrl: true });
    await wait(`JSON.stringify(${page}.editor.document) === ${JSON.stringify(JSON.stringify(beforeMeter))}`);
    await key('KeyY', { ctrl: true });
    await wait(`JSON.stringify(${page}.editor.document) === ${JSON.stringify(JSON.stringify(changed))}`);
    await key('KeyZ', { ctrl: true });
    await wait(`JSON.stringify(${page}.editor.document) === ${JSON.stringify(JSON.stringify(beforeMeter))}`);
  }
  // Cancellation cannot alter the document, including while a valid command is typed.
  await typeMeter('time 4/4', false); await key('Escape');
  if (await c.evaluate(`!!${inspector}`)) await key('Escape');
  await wait(`!${inspector}`); await c.evaluate(`${viewer}.focus()`);
  assert.deepEqual(await meterRead(), meterInitial);
  console.log('Extended numeric meters: Studio typed 33/4 and 3/128, preserved all musical content and later meter declarations, exact undo/redo and cancellation');

  // The lyric text editor: Shift+L. A clean parse draws live on a scratch copy; nothing is edited until it is applied.
  const lyrics = `${piece}.querySelector('.editor-overlay mnx-editor-surfaces mnx-lyric-text-editor')`;
  const sung = doc => `JSON.stringify(${doc}.parts[0].measures[0].sequences[0].content.map(e => Object.values(e.lyrics?.lines ?? {}).map(l => l.text)).flat())`;
  // Let the meter section's save land first: the claim below is that the
  // preview leaves a settled chip alone, and a save still in flight is not settled.
  await wait(`${chip}.dataset.save === 'clean'`);
  await c.evaluate(`${page}.editor.handleIntent({ type: 'goToLevel', level: 'note' })`);
  await key('KeyL', { shift: true });
  await wait(`!!${lyrics}?.shadowRoot?.querySelector('textarea')`);
  await c.evaluate(`{ const t = ${lyrics}.shadowRoot.querySelector('textarea'); t.value = 'sing song'; t.dispatchEvent(new Event('input')); }`);
  await wait(`${sung(`${piece}.querySelector('mnx-player').document`)} === '["sing","song"]'`);
  assert.equal(await c.evaluate(sung(`${page}.editor.document`)), '[]', 'the preview edited the document');
  const previewSave = await c.evaluate(`${chip}.dataset.save + ' / ' + ${chip}.textContent.trim()`);
  assert.ok(previewSave.startsWith('clean /'), `the preview was told to the save session: ${previewSave}`);
  await c.evaluate(`${lyrics}.shadowRoot.querySelector('button.apply').click()`);
  await wait(`!${lyrics} && ${sung(`${page}.editor.document`)} === '["sing","song"]'`);
  // One edit, however many syllables: the chip counts history steps (and by now it knows when it last saved).
  await wait(`${chip}.textContent.trim().startsWith('1 edit unsaved')`);

  // Copy a note, paste it two beats on; the page says what happened.
  await c.evaluate(`${viewer}.focus()`);
  await c.evaluate(`${page}.editor.handleIntent({ type: 'goToEdge', edge: 'first' })`);
  await key('KeyC', { ctrl: true });
  await wait(`${piece}.querySelector('.clip-notice')?.textContent.length > 0`);
  await key('ArrowRight'); await key('ArrowRight');
  await key('KeyV', { ctrl: true });
  await wait(`JSON.parse(${frets}).length === 3`);

  // Escape puts the cursor away; an arrow brings it back.
  await c.evaluate(`${viewer}.focus()`);
  await key('Escape'); await wait(`${viewer}.selection.cursor == null`);
  await key('ArrowLeft'); await wait(`${viewer}.selection.cursor != null`);

  // A bar added is saved at once, not after the pause: the chip goes clean without anyone asking.
  const before = (await (await api(`/pieces/${pieceId}`)).json()).snapshot;
  await c.evaluate(`${page}.editor.handleIntent({ type: 'appendMeasure' })`);
  await wait(`${piece}.querySelector('mnx-player').document.global.measures.length === 17`);
  await wait(`${chip}.dataset.save === 'clean' && ${chip}.textContent.includes('just now')`);
  const after = (await (await api(`/pieces/${pieceId}`)).json()).snapshot;
  assert.notEqual(after.piece.canonical_rendition_id, before.piece.canonical_rendition_id);
  const saved = JSON.parse(after.renditions.find(r => r.id === after.piece.canonical_rendition_id).provenance);
  assert.equal(saved.kind, 'checkpoint');

  // And it is really there: reload, and the stored .gp gives the notes back.
  await c.send('Page.reload');
  await wait(`${chip}?.dataset.save === 'clean' && !!${page}.editor`);
  const reloaded = await fretsNow();
  assert.deepEqual(reloaded.map(f => f.split(':')[2]).sort(), ['12', '3', '3']);
  assert.equal(await c.evaluate(`${piece}.querySelector('mnx-player').document.global.measures.length`), 17);
  assert.deepEqual(await c.evaluate(`JSON.stringify(${piece}.querySelector('mnx-player').document.global.measures[0].time)`), '{"count":3,"unit":4}');
  assert.equal(await c.evaluate(sung(`${piece}.querySelector('mnx-player').document`)), '["sing","song"]', 'the lyrics did not survive the stored .gp');
  console.log(`Studio editor smoke passed: ${pieceId} — a dimmed cursor made live by focus, fret 3 and a two-digit fret 12 entered from the keyboard, Ctrl+Z / Ctrl+Y, one undo history across notes and the Edit piece panel, a text field keeping its own keys, a Keys sheet of what is bound here, the rung inspector opened with Enter and a meter typed into it, lyrics previewed then applied from the text editor, a note copied and pasted, Escape and back, a bar added saved at once (${saved.check.verdict}), and the notes read back from the stored .gp after a reload.`);
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); await stopChrome(chrome); await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); await library.close(); }
