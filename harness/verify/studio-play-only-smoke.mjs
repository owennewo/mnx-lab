// Studio on a touch device plays; it does not edit
// (roadmap/rejected/studio-editor-touch.md, apps/studio/README.md).
//
// The rule it guards is an ABSENCE, which is the kind that rots quietly: a
// refactor that re-binds the editor breaks nothing a test can see unless a test
// is watching for nothing. So this one drives studio as a tablet — touch
// emulation, real touch events, never a key — and asserts that:
//
//   the pointer is coarse · the piece still opens, renders and plays · no
//   editor is bound and the editor chunk is never even fetched · a tap on the
//   score leaves no edit cursor · the tools row offers no Keys sheet · and the
//   chip and the Details sheet SAY why rather than going quiet.
//
// Same preconditions as studio-smoke.mjs (a local Worker over D1/R2 and a
// signed local session). Usage: npm run smoke:play-only
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root = new URL('../../', import.meta.url);
const origin = process.env.LIBRARY_LOCAL_ORIGIN ?? 'http://127.0.0.1:8791';
if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Smoke must target loopback only');
const session = JSON.parse(await fs.readFile(new URL('.secrets/local-library-session.json',root)));
const title = `Play-only smoke ${Date.now()}`;
const profile = await fs.mkdtemp('/tmp/mnx-studio-play-only-browser-');
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=900,1200','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws,'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  // Every URL the page asks for: the editor's chunk must not be among them.
  const requested = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Network.requestWillBeSent') requested.push(message.params.request.url);
  });

  // A tablet in portrait: touch points and a coarse primary pointer, which is the one thing studio reads.
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await c.send('Emulation.setDeviceMetricsOverride',{width:900,height:1200,deviceScaleFactor:2,mobile:true});
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  const wait = async expression => { for (let i=0;i<200;i++) { if (await c.evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('Browser assertion timed out: '+expression); };
  /** A real finger, not a mouse pretending to be one. */
  const tap = async (x, y) => {
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await new Promise(r => setTimeout(r, 400));
  };
  const app = "document.querySelector('mnx-studio')?.shadowRoot";
  const form = `${app}?.querySelector('mnx-studio-new-piece')?.shadowRoot`;
  const page = `${app}?.querySelector('mnx-studio-piece')`;
  const piece = `${page}?.shadowRoot`;
  const viewer = `${piece}?.querySelector('mnx-document-viewer')`;
  const details = `${piece}?.querySelector('mnx-studio-edit-piece[slot=side]')?.shadowRoot`;
  // The pencil beside the title: one Edit piece panel in place of Details + Tags.
  const editPiece = `${piece}.querySelector('button[slot=title-action]')`;
  const chip = `${piece}?.querySelector('button.save')`;
  const actions = `[...${piece}.querySelectorAll('button[slot=actions]')].map(b => b.textContent.trim())`;
  const action = text => `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => b.textContent.includes(${JSON.stringify(text)}))`;

  await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'});
  // Making a piece is a FORM, so it still works here — it is the music that waits for a keyboard.
  await c.send('Page.navigate',{url:origin+'/studio/#/new'}); await c.send('Page.reload');
  await wait(`!!${form}?.querySelector('form')`);
  assert.equal(await c.evaluate(`window.matchMedia('(pointer: coarse)').matches`), true, 'touch emulation did not make the pointer coarse');
  await c.evaluate(`{ const i = ${form}.querySelector('label input'); i.value = ${JSON.stringify(title)}; i.dispatchEvent(new Event('input')); ${form}.querySelector('form').requestSubmit(); }`);
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash)`);
  const pieceId = (await c.evaluate('location.hash')).slice('#/piece/'.length);

  // The piece opens, renders and has its player: everything the device is for.
  await wait(`!!${viewer}?.renderRoot.querySelector('#projection-container svg')`);
  await wait(`!!${chip}`);
  await wait(`!!${piece}.querySelector('mnx-player')?.document`);

  // ── and no editor, by any route ───────────────────────────────────────────
  // Give the page the time the binding would have taken: the mount is a dynamic
  // import, so "not yet" and "never" look identical for a moment.
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(await c.evaluate(`${page}.editor`), null, 'studio bound an editor on a touch device');
  assert.equal(await c.evaluate(`!!${piece}.querySelector('.editor-overlay mnx-editor-surfaces')`), false, 'the editor surfaces layer was mounted on a touch device');
  const editorChunk = requested.filter(url => /editorHost/.test(url));
  assert.deepEqual(editorChunk, [], `the editor chunk was fetched on a touch device: ${editorChunk.join(', ')}`);

  // A tap on the score is navigation and playback, never an edit cursor.
  const staff = JSON.parse(await c.evaluate(`(() => {
    const svg = ${viewer}.renderRoot.querySelector('#projection-container svg');
    const box = svg.getBoundingClientRect();
    return JSON.stringify({ x: box.x + box.width * 0.5, y: box.y + box.height * 0.4 });
  })()`));
  await tap(staff.x, staff.y);
  assert.equal(await c.evaluate(`${viewer}.selection?.cursor ?? null`), null, 'a tap placed an edit cursor on a touch device');

  // ── it says so, rather than going quiet ───────────────────────────────────
  assert.match(await c.evaluate(`${chip}.textContent`), /Play only on this device/, 'the save chip does not say the device plays only');
  const row = await c.evaluate(actions);
  assert.ok(!row.some(label => label.includes('Keys')), `the tools row offers a Keys sheet with nothing bound: ${row.join(' · ')}`);
  for (const kept of ['Source', 'Instruments'])
    assert.ok(row.some(label => label.includes(kept)), `the tools row lost ${kept}, which touch keeps`);

  await c.evaluate(`${editPiece}.click()`);
  await wait(`!!${details}?.querySelector('input')`);
  assert.match(await c.evaluate(`${details}.textContent`), /Open the piece on a computer with a keyboard/, 'the Details sheet does not say why it cannot be edited');
  assert.equal(await c.evaluate(`[...${details}.querySelectorAll('input')].every(i => i.disabled || i.readOnly)`), true, 'the Details sheet offers live fields on a play-only device');

  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-play-only.png',Buffer.from(shot.result.data,'base64'));
  console.log(`Studio play-only smoke passed: ${pieceId} — a coarse pointer, a piece made from the form, score and player rendered, no editor bound and its chunk never fetched, a tap leaving no cursor, no Keys sheet, and the chip and the Details sheet saying why.`);
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); }
