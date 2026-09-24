// Making a piece in a real browser against the local Worker/D1/R2
// (roadmap/complete/studio-piece-create.md). Its own private
// library, like studio-smoke.mjs; it needs only `npm run build`.
//
// The form → ops → .gp → POST /api/library/pieces → the piece page reading that
// .gp back: the whole priority flow up to the moment a recording is added.
import os from 'node:os';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';
const library = await startLocalLibrary();
const { origin, session } = library;
const title = `Smoke piece ${Date.now()}`;
const profile = await fs.mkdtemp(`${os.tmpdir()}/mnx-piece-create-browser-`);
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws,'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  const wait = async expression => { for (let i=0;i<150;i++) { if (await c.evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('Browser assertion timed out: '+expression); };
  const app = "document.querySelector('mnx-studio').shadowRoot";
  const form = `${app}.querySelector('mnx-studio-new-piece')?.shadowRoot`;
  const piece = `${app}.querySelector('mnx-studio-piece')?.shadowRoot`;
  const frame = `${piece}.querySelector('mnx-score-frame').shadowRoot`;
  const library = `${app}.querySelector('mnx-studio-library')?.shadowRoot`;
  const type = (selector, value) => c.evaluate(`{ const i = ${form}.querySelector(${JSON.stringify(selector)}); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input')); }`);
  await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'});
  await c.send('Page.navigate',{url:origin+'/studio/#/'}); await c.send('Page.reload');
  // The library offers it; the form opens with the header's way back.
  await wait(`[...(${app}?.querySelectorAll('header a.button') ?? [])].some(a => a.textContent === 'New piece')`);
  await c.evaluate(`[...${app}.querySelectorAll('header a.button')].find(a => a.textContent === 'New piece').click()`);
  await wait(`location.hash === '#/new' && !!${form}?.querySelector('form')`);
  // A tuning the grammar cannot read is a sentence, not a request.
  await type('label:nth-of-type(1) input', title);
  await type('select', 'custom');
  await wait(`!!${form}.querySelector('input[placeholder="D2 A2 D3 G3 A3 D4"]')`);
  await type('input[placeholder="D2 A2 D3 G3 A3 D4"]', 'D2 A2 nonsense');
  await c.evaluate(`${form}.querySelector('form').requestSubmit()`);
  await wait(`${form}.querySelector('[role=alert]')?.textContent.includes('low string first')`);
  // DADGAD, capo 2, 6/8, two sharps, 9 bars.
  await type('input[placeholder="D2 A2 D3 G3 A3 D4"]', 'D2 A2 D3 G3 A3 D4');
  const inputs = `[...${form}.querySelectorAll('label')]`;
  const field = (label, value) => c.evaluate(`{ const i = ${inputs}.find(l => l.textContent.trim().startsWith(${JSON.stringify(label)})).querySelector('input, select'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input')); }`);
  await field('Artist', 'A synthetic author'); await field('Capo', '2'); await field('Time', '6/8'); await field('Key', 'D'); await field('Bars', '9');
  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-new-piece.png',Buffer.from(shot.result.data,'base64'));
  await c.evaluate(`${form}.querySelector('form').requestSubmit()`);
  // The service named it; the page opens what the service stored — the .gp, converted here.
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash)`);
  const pieceId = (await c.evaluate('location.hash')).slice('#/piece/'.length);
  await wait(`!!${piece}?.querySelector('mnx-document-viewer')?.shadowRoot?.querySelector('svg')`);
  await wait(`${frame}?.querySelector('.strip.top .head h1')?.textContent.includes(${JSON.stringify(title)})`);
  await wait(`${frame}.querySelector('.strip.top .head .sub')?.textContent.includes('A synthetic author')`);
  const viewer = `${piece}.querySelector('mnx-document-viewer')`;
  await wait(`!!${piece}.querySelector('mnx-player').performance`);
  const read = await c.evaluate(`JSON.stringify((d => ({ bars: d.global.measures.length, time: d.global.measures[0].time, key: d.global.measures[0].key, capo: d.parts[0]._x.mnxLab.capo, low: d.parts[0]._x.mnxLab.strings.find(s => s.string === 6).pitch, high: d.parts[0]._x.mnxLab.strings.find(s => s.string === 1).pitch }))(${piece}.querySelector('mnx-player').document))`);
  assert.deepEqual(JSON.parse(read), { bars: 9, time: { count: 6, unit: 8 }, key: { fifths: 2 }, capo: 2, low: { step: 'D', octave: 2 }, high: { step: 'D', octave: 4 } });
  // Nothing to sync against yet, and the tools row says what to do about it.
  const sourceButton = `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => b.getAttribute('aria-label')?.includes('Source'))`;
  await wait(`${sourceButton}?.getAttribute('aria-label')?.includes('add a recording')`);
  await c.evaluate(`${sourceButton}.click()`);
  const source = `${piece}.querySelector('mnx-studio-source[slot=side]')?.shadowRoot`;
  await wait(`!!${source}?.querySelector('[aria-label="Add recording"]') && !${source}.querySelector('[aria-label="Add recording"]').disabled`);
  const pieceShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-new-piece-opened.png',Buffer.from(pieceShot.result.data,'base64'));
  // It is a library piece like any other: listed under its title and artist, with the tags read off it.
  await c.evaluate(`${piece}.querySelector('a[slot=back]').click()`);
  await wait(`[...(${library}?.querySelectorAll('li .who a') ?? [])].some(a => a.textContent.includes(${JSON.stringify(title)}))`);
  const stored = await (await fetch(`${origin}/api/library/pieces/${pieceId}`, { headers: { 'Cf-Access-Jwt-Assertion': session.browser } })).json();
  assert.equal(stored.snapshot.piece.source_kind, 'studio');
  assert.deepEqual(stored.snapshot.renditions.map(r => [r.format, r.role, r.producer]), [['gp', 'original', 'studio']]);
  const tags = stored.snapshot.tags.map(t => `${t.dimension}:${t.value}`);
  for (const tag of [`title:${title}`, 'artist:A synthetic author', 'capo:2', 'tuning-name:DADGAD', 'part:Guitar']) assert.ok(tags.includes(tag), `${tag} in ${tags}`);
  console.log(`Piece-create smoke passed: the New piece form (a bad tuning refused in a sentence), ${title} made as ${pieceId}, its stored .gp read back as 9 bars of 6/8 in D on DADGAD capo 2, the Source row asking for a recording, and the library listing it.`);
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); await library.close(); }
