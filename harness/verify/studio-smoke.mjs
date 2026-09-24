// Studio in a real browser against the local Worker/D1/R2 — the studio-shell
// counterpart of library-smoke.mjs. It brings its own private library
// (localLibrary.mjs); it needs only `npm run build`. In dev there is no Access
// gate, so the signed-out page is what an unauthenticated visit reaches;
// behind the gate it cannot.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';
const root = new URL('../../', import.meta.url);
const library = await startLocalLibrary();
const { origin, session } = library;
// The service stores the SOURCE — a real .gp — and the browser converts it.
const bytes = new Uint8Array(await fs.readFile(new URL('converters/fixtures/Sun-did-glide.gp', root)));
const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const headers = { Authorization: `Bearer ${library.writeToken}`, 'Cf-Access-Jwt-Assertion': session.machine };
const before = await fetch(origin + '/api/library/ingest/StudioSmoke', { headers }); assert.equal(before.status,200);
const { snapshot } = await before.json();
const manifest = { expected_revision: snapshot?.piece.revision ?? null,
  source: { kind: 'soundslice', id: 'StudioSmoke' }, renditions: [{ id: 'StudioSmoke-gp', format: 'gp', role: 'export', producer: 'soundslice-cli', producer_version: null, producer_options: null, filename: 'Sun-did-glide.gp', sha256, file: 'score' }], recordings: [], tags: [{ dimension: 'list', value: 'Studio collection', source_ref: 'test' }], canonical: { mode: 'initialize', rendition_id: 'StudioSmoke-gp' }, // Title and artist are HEADER dimensions this score never states itself, so the
  // Edit piece panel shows them as placeholders; the tuning is read off the music,
  // so it is a row there, correctable only by an alias. One fixture, both halves.
  derived_tags: [{ dimension: 'title', value: 'Studio smoke piece', source_ref: 'sidecar' }, { dimension: 'artist', value: 'Synthetic fixture', source_ref: 'sidecar' }, { dimension: 'tuning-name', value: 'open G', source_ref: 'sidecar' }] };
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
  // Right after a navigation the chain may reach a shell that has not mounted
  // yet — under load it does — so a throw means "not yet" until the deadline,
  // and the last one is reported if it never clears.
  const wait = async expression => { let last = null; for (let i=0;i<100;i++) { try { if (await c.evaluate(expression)) return; last = null; } catch (error) { last = error; } await new Promise(r=>setTimeout(r,100)); } throw new Error('Browser assertion timed out: '+expression+'; '+(last ? last.message+'; ' : '')+c.logs.join('; ')); };
  const app = "document.querySelector('mnx-studio').shadowRoot";
  const library = `${app}.querySelector('mnx-studio-library').shadowRoot`;
  const piece = `${app}.querySelector('mnx-studio-piece').shadowRoot`;
  // The piece page IS the score frame (core-score-frame.md): the title sits in
  // the frame's tools row, the player in its tray, the shell header is gone.
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
  // Open it: the viewer draws, the player is wired, the tools row names the
  // piece, the shell's header is gone, and the tray under the score has its rail.
  await c.evaluate(`${library}.querySelector('li .who a').click()`);
  await wait(`location.hash==='#/piece/${pieceId}'`);
  await wait(`!!${piece}?.querySelector('mnx-document-viewer')?.shadowRoot?.querySelector('svg')`);
  await wait(`${piece}.querySelector('mnx-document-viewer').zoom === 1 && ${piece}.querySelector('mnx-document-viewer').densityH === 2 && ${piece}.querySelector('mnx-document-viewer').spacingMode === 'fill'`);
  await wait(`${frame}?.querySelector('.strip.top .head h1')?.textContent.includes('Studio smoke piece')`);
  assert.equal(await c.evaluate(`!!${app}.querySelector('header')`), false);
  await wait(`!!${piece}.querySelector('mnx-player').performance`);
  await wait(`!!${frame}.querySelector('.strip.bottom') && !!${piece}.querySelector('mnx-player').shadowRoot.querySelector('.rail')`);
  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-piece.png',Buffer.from(shot.result.data,'base64'));
  // The tools row: Zoom and Settings hosting the pads pinned under their
  // buttons. Studio leaves the staff view to the settings card's STAFF row —
  // no segmented control in the strip.
  assert.equal(await c.evaluate(`!!${frame}.querySelector('.seg')`), false);
  await c.evaluate(`[...${frame}.querySelectorAll('.strip.top .btn')].find(b => b.getAttribute('aria-label') === 'Zoom').click()`);
  await wait(`!!${frame}.querySelector('mnx-zoom-pad[pinned]')`);
  assert.equal(await c.evaluate(`!!${frame}.querySelector('mnx-zoom-pad').shadowRoot.querySelector('.focus-toggle, .spacing-toggle')`), false);
  await c.evaluate(`[...${frame}.querySelectorAll('.strip.top .btn')].find(b => b.getAttribute('aria-label') === 'Settings').click()`);
  await wait(`!${frame}.querySelector('mnx-zoom-pad') && !!${frame}.querySelector('mnx-settings-pad[pinned]')?.shadowRoot?.querySelector('.card')`);
  const pad = `${frame}.querySelector('mnx-settings-pad[pinned]').shadowRoot`;
  await wait(`${pad}.querySelector('button[data-row=systemAlignment] .word')?.textContent === 'Fill width'`);
  await c.evaluate(`${pad}.querySelector('button[data-row=view]').click()`);
  await wait(`!!${pad}.querySelector('.menu')`);
  await c.evaluate(`[...${pad}.querySelectorAll('.menu .item')].find(i => i.textContent.trim() === 'Tab').click()`);
  await wait(`${pad}.querySelector('button[data-row=view] .word')?.textContent === 'Tab' && localStorage.getItem('mnx-studio.view') === 'tab'`);
  // The theme is the settings card's last row now, not a button at the row's
  // end (2026-09-23). It names the value it wants rather than walking a cycle,
  // and pins the scheme on the document root so every light-dark() pair
  // follows. The card is still open from the STAFF row above.
  assert.equal(await c.evaluate(`!!${piece}.querySelector('button[slot=menu]')`), false);
  const pickTheme = async word => {
    await c.evaluate(`${pad}.querySelector('button[data-row=theme]').click()`);
    await wait(`!!${pad}.querySelector('.menu')`);
    await c.evaluate(`[...${pad}.querySelectorAll('.menu .item')].find(i => i.textContent.trim() === '${word}').click()`);
  };
  await pickTheme('Light');
  await wait(`document.documentElement.style.colorScheme === 'light' && localStorage.getItem('mnx-studio.theme') === 'light'`);
  await pickTheme('Dark');
  await wait(`document.documentElement.style.colorScheme === 'dark' && ${pad}.querySelector('button[data-row=theme] .word')?.textContent === 'Dark'`);
  await pickTheme('Auto');
  await wait(`document.documentElement.style.colorScheme === '' && localStorage.getItem('mnx-studio.theme') === null`);
  // The focus mark on the pane's corner hides both strips, remembers it, and
  // brings them back; the player is parked, not torn down, while focused.
  await c.evaluate(`${frame}.querySelector('.focus-mark').click()`);
  await wait(`!${frame}.querySelector('.strip.top') && !${frame}.querySelector('.strip.bottom') && ${frame}.querySelector('.focus-mark').getAttribute('aria-pressed') === 'true' && localStorage.getItem('mnx-studio.focused') === 'true'`);
  assert.equal(await c.evaluate(`!!${piece}.querySelector('mnx-player').performance`), true);
  const focusedShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-piece-focused.png',Buffer.from(focusedShot.result.data,'base64'));
  await c.evaluate(`${frame}.querySelector('.focus-mark').click()`);
  await wait(`!!${frame}.querySelector('.strip.top') && !!${frame}.querySelector('.strip.bottom') && localStorage.getItem('mnx-studio.focused') === 'false'`);
  // The Tags sheet: add a tag of your own, then correct how the artist shows with an alias.
  // ONE panel for what the piece IS, opened by the pencil beside the title.
  // Its three bands say where each value came from — the score's header as
  // fields, what the engine read off the notes, and your own — so the artist
  // here is an INPUT, not a read-only row: the old Tags sheet echoed the field
  // the Details sheet owned, and only the echo could be renamed.
  const sheet = `${piece}.querySelector('mnx-studio-edit-piece[slot=side]').shadowRoot`;
  await c.evaluate(`${piece}.querySelector('button[slot=title-action]').click()`);
  await wait(`${sheet}?.textContent.includes('From the music') && ${sheet}.textContent.includes('Read from the notes')`);
  // The artist this fixture shows was read at ingest, not stated by the score,
  // so the field carries it as a PLACEHOLDER: visible, and replaced the moment
  // one is typed. Hiding header dimensions from the rows below must not lose it.
  assert.deepEqual(await c.evaluate(`(() => { const i = [...${sheet}.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Artist')).querySelector('input'); return [i.value, i.placeholder]; })()`), ['', 'Synthetic fixture']);
  assert.equal(await c.evaluate(`${sheet}.textContent.toLowerCase().includes('tag')`), false, 'the panel still calls something a tag');
  // Your own values: dimensions nobody reads from the music.
  await c.evaluate(`${sheet}.querySelector('input[aria-label="Add a value"]').value = 'genre: folk'; ${sheet}.querySelector('input[aria-label="Add a value"]').dispatchEvent(new Event('input'));`);
  await c.evaluate(`[...${sheet}.querySelectorAll('form')].find(f => f.querySelector('input[aria-label="Add a value"]')).dispatchEvent(new Event('submit', { cancelable: true }))`);
  await wait(`[...${sheet}.querySelectorAll('.chip')].some(ch => ch.textContent.includes('folk'))`);
  // The sheet is busy until the write lands; a click on a disabled button is nothing.
  await wait(`!${sheet}.querySelector('input[aria-label="Add a value"]').disabled`);
  // What the notes say can only be corrected by an alias — and the header's own
  // dimensions are NOT among these rows, because they are the fields above.
  assert.equal(await c.evaluate(`[...${sheet}.querySelectorAll('.row')].some(r => r.textContent.includes('artist'))`), false, 'a header field appeared as a read-only row as well');
  // Whichever the file gave — a part here; a named tuning or a capo elsewhere.
  // The point is the correction, not the dimension.
  assert.ok(await c.evaluate(`${sheet}.querySelectorAll('.row').length > 0`), 'nothing was read from the notes');
  await c.evaluate(`${sheet}.querySelector('.row button').click()`);
  await wait(`!!${sheet}.querySelector('input[aria-label="Shown as"]')`);
  await c.evaluate(`const i = ${sheet}.querySelector('input[aria-label="Shown as"]'); i.value = 'A synthetic reading'; i.dispatchEvent(new Event('input')); [...${sheet}.querySelectorAll('button')].find(b => b.textContent === 'Save').click()`);
  await wait(`[...${sheet}.querySelectorAll('.row')].some(r => r.textContent.includes('A synthetic reading'))`);
  await c.evaluate(`${sheet}.querySelector('button[aria-label="Close"]').click()`);
  await wait(`!${piece}.querySelector('mnx-studio-edit-piece')`);
  // The Instruments sheet: in the frame's side slot, one row per part. The tray
  // carries no Sound selector here — the sheet chooses each part's sound.
  const player = `${piece}.querySelector('mnx-player')`;
  assert.equal(await c.evaluate(`!!${player}.shadowRoot.querySelector('select[aria-label="Playback sound"]')`), false);
  await c.evaluate(`[...${piece}.querySelectorAll('button[slot=actions]')].find(b => b.getAttribute('aria-label') === 'Instruments · 1').click()`);
  const instruments = `${piece}.querySelector('mnx-studio-instruments[slot=side]')?.shadowRoot`;
  await wait(`${instruments}?.querySelectorAll('.part').length === 1`);
  // A lone part cannot leave the score; a mute and a sound reach the player's
  // mix and the per-piece preference.
  await wait(`${instruments}.querySelector('button[aria-label^="Hide"]').disabled`);
  await c.evaluate(`${instruments}.querySelector('button[aria-label^="Mute"]').click()`);
  await wait(`${player}.partMix[0]?.muted === true && JSON.parse(localStorage.getItem('mnx-studio.parts.${pieceId}')).mix[0].muted === true`);
  await c.evaluate(`{ const s = ${instruments}.querySelector('select'); s.value = 'piano'; s.dispatchEvent(new Event('change')); }`);
  await wait(`${player}.partMix[0]?.sound === 'piano'`);
  const mixShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-instruments.png',Buffer.from(mixShot.result.data,'base64'));
  // Put the mix back so the next run starts from the default.
  await c.evaluate(`${instruments}.querySelector('button[aria-label^="Unmute"]').click()`);
  await c.evaluate(`{ const s = ${instruments}.querySelector('select'); s.value = 'synth'; s.dispatchEvent(new Event('change')); }`);
  await wait(`${player}.partMix[0]?.muted === false && ${player}.partMix[0]?.sound === 'synth'`);
  await c.evaluate(`${instruments}.querySelector('button[aria-label="Close instruments"]').click()`);
  await wait(`!${piece}.querySelector('mnx-studio-instruments')`);
  // The Source sheet: the tools row names what plays, the tray has no source
  // control, and the sheet lists Synth (checked) with Add recording.
  assert.equal(await c.evaluate(`!!${player}.shadowRoot.querySelector('select[aria-label="Playback source"]')`), false);
  const sourceButton = `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => b.getAttribute('aria-label')?.includes('Source'))`;
  await wait(`${sourceButton}?.getAttribute('aria-label')?.includes('Source · Synth')`);
  await c.evaluate(`${sourceButton}.click()`);
  const source = `${piece}.querySelector('mnx-studio-source[slot=side]')?.shadowRoot`;
  await wait(`${source}?.querySelector('[data-source="synth"]')?.getAttribute('aria-checked') === 'true' && !!${source}.querySelector('[aria-label="Add recording"]')`);
  const sourceShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-source.png',Buffer.from(sourceShot.result.data,'base64'));
  await c.evaluate(`${source}.querySelector('button[aria-label="Close source"]').click()`);
  await wait(`!${piece}.querySelector('mnx-studio-source')`);
  // Back to the library without a reload: the frame goes with the piece, the header returns.
  await c.evaluate(`${piece}.querySelector('a[slot=back]').click()`);
  await wait(`!!${app}.querySelector('mnx-studio-library') && !!${app}.querySelector('header') && !${app}.querySelector('mnx-studio-piece')`);
  // Option A's rail: the opened piece is the top row under Recent, the row
  // carries its chips and the star, and a list value narrows the list. The
  // artist reads as the sidecar gave it — the panel no longer offers to alias a
  // header value, because it offers the FIELD instead, and this score never
  // stated one; correcting it library-wide is the Aliases page's business.
  await wait(`${library}?.textContent.includes('Artist:') && ${library}.textContent.includes('Genre:')`);
  await wait(`${library}.querySelector('li .who a')?.textContent.includes('Studio smoke piece') && ${library}.querySelector('li .when').textContent !== ''`);
  await wait(`${library}.querySelector('li .who .artist')?.textContent === 'Synthetic fixture'`);
  // The way back keeps the library's view (it lives in the URL): the list
  // filter set before the piece opened is still on. Clear it, then choose it
  // again from the rail.
  const listLine = `[...${library}.querySelectorAll('.line')].find(l => l.textContent.includes('List:'))`;
  await wait(`${listLine}?.textContent.includes('Studio collection')`);
  await c.evaluate(`${listLine}.click()`);
  await wait(`${listLine}?.textContent.includes('All')`);
  await c.evaluate(`${listLine}.click()`);
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
  // The alias page lists what the panel set — the reading it corrected.
  await c.evaluate(`${library}.querySelector('a.foot[href*="aliases"]').click()`);
  await wait(`!!${app}.querySelector('mnx-studio-aliases')?.shadowRoot?.textContent.includes('A synthetic reading')`);
  const aliases = `${app}.querySelector('mnx-studio-aliases').shadowRoot`;
  await c.evaluate(`${aliases}.querySelector('button[aria-label="Remove alias"]').click()`);
  await wait(`${aliases}.textContent.includes('No aliases yet')`);
  // A missing piece is a page, not a blank screen.
  await c.send('Page.navigate',{url:origin+'/studio/#/piece/soundslice%3ANoSuchPiece'});
  await wait(`${piece}?.textContent.includes('Could not open this piece')`);
  assert.equal(await c.evaluate(`Object.values(localStorage).some(v=>v.includes('Studio smoke piece') || v.includes('local@example.test'))`),false);
  console.log('Studio smoke passed: root redirect, signed-out page, library list + filter, canonical .gp converted into the score frame + player, the tools row and tray (Zoom, Settings, the focus mark), Tags sheet add + alias, rail facets + favourite + sort, alias page, missing piece, no private localStorage.');
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); await library.close(); }
