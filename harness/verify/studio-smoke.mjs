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
const manifest = { id: 'soundslice:StudioSmoke', expected_revision: snapshot?.piece.revision ?? null,
  source: { kind: 'soundslice', id: 'StudioSmoke' }, renditions: [{ id: 'StudioSmoke-gp', format: 'gp', role: 'export', producer: 'soundslice-cli', producer_version: null, producer_options: null, filename: 'Sun-did-glide.gp', sha256, file: 'score' }], recordings: [], tags: [{ dimension: 'unknown', value: 'Studio collection', source_ref: 'test' }], canonical: { mode: 'initialize', rendition_id: 'StudioSmoke-gp' }, derived_tags: [{ dimension: 'title', value: 'Studio smoke piece', source_ref: 'sidecar' }, { dimension: 'artist', value: 'Synthetic fixture', source_ref: 'sidecar' }] };
const form = new FormData(); form.set('manifest',JSON.stringify(manifest)); form.set('score',new Blob([bytes]),'Sun-did-glide.gp');
assert.equal((await fetch(origin+'/api/library/ingest',{method:'POST',headers,body:form})).status,200);
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
  await c.evaluate(`${library}.querySelector('input').value='unknown:Studio collection'; ${library}.querySelector('input').dispatchEvent(new Event('input'));`);
  await wait(`${library}.querySelector('datalist option')?.value==='unknown:Studio collection'`);
  await c.evaluate(`${library}.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));`);
  await wait(`${library}.querySelector('.chips button')?.textContent.includes('unknown:Studio collection')`);
  await wait(`${library}.querySelector('li a')?.textContent.includes('Studio smoke piece') && !${library}.querySelector('[role=status]')`);
  // Open it: the viewer draws, the player is wired, the bar names the piece.
  await c.evaluate(`${library}.querySelector('li a').click()`);
  await wait(`location.hash==='#/piece/soundslice%3AStudioSmoke'`);
  await wait(`!!${piece}?.querySelector('mnx-document-viewer')?.shadowRoot?.querySelector('svg')`);
  await wait(`${app}.querySelector('.title').textContent.includes('Studio smoke piece')`);
  assert.equal(await c.evaluate(`${app}.querySelector('footer').hidden`), false);
  await wait(`!!${app}.querySelector('mnx-player').performance`);
  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-piece.png',Buffer.from(shot.result.data,'base64'));
  // Back to the library without a reload: the piece title clears, the player hides.
  await c.evaluate(`${app}.querySelector('a.button').click()`);
  await wait(`!!${app}.querySelector('mnx-studio-library') && ${app}.querySelector('footer').hidden`);
  // A missing piece is a page, not a blank screen.
  await c.send('Page.navigate',{url:origin+'/studio/#/piece/soundslice%3ANoSuchPiece'});
  await wait(`${piece}?.textContent.includes('Could not open this piece')`);
  assert.equal(await c.evaluate(`Object.values(localStorage).some(v=>v.includes('Studio smoke piece') || v.includes('local@example.test'))`),false);
  console.log('Studio smoke passed: root redirect, signed-out page, library list + filter, canonical .gp converted into the piece view + player, missing piece, no private localStorage.');
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true}); }
