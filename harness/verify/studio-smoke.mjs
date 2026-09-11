// Studio in a real browser against the local Worker/D1/R2 — the studio-shell
// counterpart of library-smoke.mjs, with the same preconditions: local auth
// set up (docs/library-access.md → Local development) and wrangler dev on
// 8791 serving dist/client. In dev there is no Access gate, so the signed-out
// page is what an unauthenticated visit reaches; behind the gate it cannot.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root = new URL('../../', import.meta.url);
const origin = process.env.LIBRARY_LOCAL_ORIGIN ?? 'http://127.0.0.1:8791';
if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Smoke must target loopback only');
const session = JSON.parse(await fs.readFile(new URL('.secrets/local-library-session.json',root)));
// The service stores the SOURCE — a real .gp — and the browser converts it.
const bytes = new Uint8Array(await fs.readFile(new URL('converters/fixtures/Sun-did-glide.gp', root)));
const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const headers = { Authorization: 'Bearer local-development-only', 'Cf-Access-Jwt-Assertion': session.machine };
const before = await fetch(origin + '/api/library/ingest/StudioSmoke', { headers }); assert.equal(before.status,200);
const { snapshot } = await before.json();
const manifest = { expected_revision: snapshot?.piece.revision ?? null,
  source: { kind: 'soundslice', id: 'StudioSmoke' }, renditions: [{ id: 'StudioSmoke-gp', format: 'gp', role: 'export', producer: 'soundslice-cli', producer_version: null, producer_options: null, filename: 'Sun-did-glide.gp', sha256, file: 'score' }], recordings: [], tags: [{ dimension: 'list', value: 'Studio collection', source_ref: 'test' }], canonical: { mode: 'initialize', rendition_id: 'StudioSmoke-gp' }, derived_tags: [{ dimension: 'title', value: 'Studio smoke piece', source_ref: 'sidecar' }, { dimension: 'artist', value: 'Synthetic fixture', source_ref: 'sidecar' }] };
const form = new FormData(); form.set('manifest',JSON.stringify(manifest)); form.set('score',new Blob([bytes]),'Sun-did-glide.gp');
const stored = await fetch(origin+'/api/library/ingest',{method:'POST',headers,body:form}); assert.equal(stored.status,200);
const pieceId = (await stored.json()).snapshot.piece.id; assert.match(pieceId, /^[0-9a-f]{16}$/);
// The root is studio's.
const rootResponse = await fetch(origin + '/', { redirect: 'manual' });
assert.equal(rootResponse.status, 302); assert.equal(rootResponse.headers.get('location'), '/studio/');
const profile = await fs.mkdtemp('/tmp/mnx-studio-browser-');
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws,'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  const wait = async expression => { for (let i=0;i<100;i++) { if (await c.evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('Browser assertion timed out: '+expression+'; '+c.logs.join('; ')); };
  const app = "document.querySelector('mnx-studio').shadowRoot";
  const library = `${app}.querySelector('mnx-studio-library').shadowRoot`;
  const piece = `${app}.querySelector('mnx-studio-piece').shadowRoot`;
  // The piece page IS the score frame (core-score-frame.md): the title sits in
  // the frame's top grip, the player in its bottom grip, the shell header is gone.
  const frame = `${piece}.querySelector('mnx-score-frame').shadowRoot`;
  // No identity: the shell reports it rather than showing an empty library.
  await c.send('Page.navigate',{url:origin+'/studio/'});
  await wait(`${app}?.textContent.includes('Signed out')`);
  assert.equal(await c.evaluate(`!!${app}.querySelector('mnx-studio-library')`), false);
  // Signed local identity: the library lists the ingested piece, the filter narrows it.
  await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'});
  // Same document, new hash would not reload; the session is read at boot, so reload.
  await c.send('Page.navigate',{url:origin+'/studio/#/'}); await c.send('Page.reload');
  await wait(`${app}?.querySelector('.who')?.textContent === 'local@example.test'`);
  await wait(`${library}?.textContent.includes('Studio smoke piece')`);
  await c.evaluate(`${library}.querySelector('input').value='list:Studio collection'; ${library}.querySelector('input').dispatchEvent(new Event('input'));`);
  await wait(`${library}.querySelector('datalist option')?.value==='list:Studio collection'`);
  await c.evaluate(`${library}.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));`);
  await wait(`${library}.querySelector('.chip')?.textContent.includes('Studio collection')`);
  await wait(`${library}.querySelector('li .who a')?.textContent.includes('Studio smoke piece') && !${library}.querySelector('[role=status]')`);
  // Open it: the viewer draws, the player is wired, the top grip names the piece,
  // the shell's header is gone, and the quiet view keeps pause on the bottom grip.
  await c.evaluate(`${library}.querySelector('li .who a').click()`);
  await wait(`location.hash==='#/piece/${pieceId}'`);
  await wait(`!!${piece}?.querySelector('mnx-document-viewer')?.shadowRoot?.querySelector('svg')`);
  await wait(`${frame}?.querySelector('.grip.top .name')?.textContent.includes('Studio smoke piece')`);
  assert.equal(await c.evaluate(`!!${app}.querySelector('header')`), false);
  await wait(`!!${piece}.querySelector('mnx-player').performance`);
  await wait(`!${frame}.querySelector('.grip.bottom .primary').disabled && ${frame}.querySelector('.grip.bottom .readout')?.textContent.length > 0`);
  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-piece.png',Buffer.from(shot.result.data,'base64'));
  // Draw the top grip out: the tools row, the staff view as a segmented control,
  // Zoom and Settings hosting the pads pinned under their buttons.
  await c.evaluate(`${frame}.querySelector('.grip.top').click()`);
  await wait(`!!${frame}.querySelector('.strip.top .head h1') && !!${frame}.querySelector('.seg button[aria-pressed=true]')`);
  await c.evaluate(`[...${frame}.querySelectorAll('.strip.top .btn')].find(b => b.textContent.includes('Zoom')).click()`);
  await wait(`!!${frame}.querySelector('mnx-zoom-pad[pinned]')`);
  await c.evaluate(`[...${frame}.querySelectorAll('.strip.top .btn')].find(b => b.textContent.includes('Settings')).click()`);
  await wait(`!${frame}.querySelector('mnx-zoom-pad') && !!${frame}.querySelector('mnx-settings-pad[pinned]')?.shadowRoot?.querySelector('.card')`);
  await c.evaluate(`[...${frame}.querySelectorAll('.seg button')].find(b => b.textContent === 'Tab').click()`);
  await wait(`${frame}.querySelector('.seg button[aria-pressed=true]')?.textContent === 'Tab' && localStorage.getItem('mnx-studio.view') === 'tab'`);
  // Draw the bottom grip out: the player's own tray, with its scrubber.
  await c.evaluate(`${frame}.querySelector('.grip.bottom .chev').click()`);
  await wait(`!!${frame}.querySelector('.strip.bottom') && !!${piece}.querySelector('mnx-player').shadowRoot.querySelector('.scrub')`);
  const openShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-piece-open.png',Buffer.from(openShot.result.data,'base64'));
  // The Tags sheet: add a tag of your own, then correct how the artist shows with an alias.
  const sheet = `${piece}.querySelector('mnx-studio-tags').shadowRoot`;
  // Local D1 keeps what earlier runs asserted (the tag, the favourite), so the
  // count is checked relative to what the sheet shows, not as a literal.
  const tagsBefore = Number((await c.evaluate(`${piece}.querySelector('button[slot=actions]').textContent`)).match(/\d+/)[0]);
  await c.evaluate(`${piece}.querySelector('button[slot=actions]').click()`);
  await wait(`${sheet}?.textContent.includes('From the music') && ${sheet}.textContent.includes('Synthetic fixture')`);
  const hadFolk = await c.evaluate(`[...${sheet}.querySelectorAll('.chip')].some(ch => ch.textContent.includes('folk'))`);
  await c.evaluate(`${sheet}.querySelector('input[aria-label="Add a tag"]').value = 'genre: folk'; ${sheet}.querySelector('input[aria-label="Add a tag"]').dispatchEvent(new Event('input'));`);
  await c.evaluate(`${sheet}.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))`);
  await wait(`[...${sheet}.querySelectorAll('.chip')].some(ch => ch.textContent.includes('folk'))`);
  await wait(`${piece}.querySelector('button[slot=actions]').textContent.includes('Tags · ${tagsBefore + (hadFolk ? 0 : 1)}')`);
  // The sheet is busy until the write lands; a click on a disabled button is nothing.
  await wait(`!${sheet}.querySelector('input[aria-label="Add a tag"]').disabled`);
  await c.evaluate(`[...${sheet}.querySelectorAll('.row')].find(r => r.textContent.includes('artist')).querySelector('button').click()`);
  await wait(`!!${sheet}.querySelector('input[aria-label="Shown as"]')`);
  await c.evaluate(`const i = ${sheet}.querySelector('input[aria-label="Shown as"]'); i.value = 'A synthetic fixture'; i.dispatchEvent(new Event('input')); [...${sheet}.querySelectorAll('button')].find(b => b.textContent === 'Save alias').click()`);
  await wait(`${frame}.querySelector('.strip.top .head .sub')?.textContent.includes('A synthetic fixture')`);
  await wait(`[...${sheet}.querySelectorAll('.row')].some(r => r.textContent.includes('A synthetic fixture') && r.textContent.includes('Synthetic fixture'))`);
  await c.evaluate(`${sheet}.querySelector('button[aria-label="Close tags"]').click()`);
  await wait(`!${piece}.querySelector('mnx-studio-tags')`);
  // Back to the library without a reload: the frame goes with the piece, the header returns.
  await c.evaluate(`${piece}.querySelector('a[slot=back]').click()`);
  await wait(`!!${app}.querySelector('mnx-studio-library') && !!${app}.querySelector('header') && !${app}.querySelector('mnx-studio-piece')`);
  // Option A's rail: the alias shows in the artist line, the opened piece is the top row under Recent,
  // the row carries its chips and the star, and a list value narrows the list.
  await wait(`${library}?.textContent.includes('Artist:') && ${library}.textContent.includes('Genre:')`);
  await wait(`${library}.querySelector('li .who a')?.textContent.includes('Studio smoke piece') && ${library}.querySelector('li .when').textContent !== ''`);
  await wait(`${library}.querySelector('li small')?.textContent === 'A synthetic fixture'`);
  await c.evaluate(`[...${library}.querySelectorAll('.line')].find(l => l.textContent.includes('List:')).click()`);
  await wait(`!!${library}.querySelector('.group')`);
  await c.evaluate(`[...${library}.querySelectorAll('.option')].find(o => o.textContent.includes('Studio collection')).click()`);
  await wait(`[...${library}.querySelectorAll('.line')].some(l => l.textContent.includes('List:') && l.textContent.includes('Studio collection')) && ${library}.querySelector('.chip')?.textContent.includes('Studio collection')`);
  await wait(`${library}.querySelectorAll('li').length === 1`);
  await c.evaluate(`${library}.querySelector('li .star').click()`);
  await wait(`${library}.querySelector('li .star').getAttribute('aria-pressed') === 'true'`);
  await wait(`[...${library}.querySelectorAll('.line')].some(l => l.textContent.includes('Favourites') && l.textContent.includes('1'))`);
  const railShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-library.png',Buffer.from(railShot.result.data,'base64'));
  await c.evaluate(`[...${library}.querySelectorAll('.sort button')].find(b => b.textContent === 'Title').click()`);
  await wait(`${library}.querySelector('.sort button.on').textContent === 'Title' && ${library}.querySelectorAll('li').length === 1`);
  // The alias page lists what the sheet set.
  await c.evaluate(`${library}.querySelector('a.foot').click()`);
  await wait(`!!${app}.querySelector('mnx-studio-aliases')?.shadowRoot?.textContent.includes('A synthetic fixture')`);
  const aliases = `${app}.querySelector('mnx-studio-aliases').shadowRoot`;
  await c.evaluate(`${aliases}.querySelector('button[aria-label="Remove alias"]').click()`);
  await wait(`${aliases}.textContent.includes('No aliases yet')`);
  // A missing piece is a page, not a blank screen.
  await c.send('Page.navigate',{url:origin+'/studio/#/piece/soundslice%3ANoSuchPiece'});
  await wait(`${piece}?.textContent.includes('Could not open this piece')`);
  assert.equal(await c.evaluate(`Object.values(localStorage).some(v=>v.includes('Studio smoke piece') || v.includes('local@example.test'))`),false);
  console.log('Studio smoke passed: root redirect, signed-out page, library list + filter, canonical .gp converted into the score frame + player, the grips drawn out (staff view, Zoom, Settings, tray), Tags sheet add + alias, rail facets + favourite + sort, alias page, missing piece, no private localStorage.');
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true}); }
