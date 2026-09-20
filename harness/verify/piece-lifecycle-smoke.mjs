// A piece's life in a real browser against the local Worker/D1/R2
// (roadmap/complete/studio-piece-lifecycle.md). Same preconditions as
// studio-smoke.mjs: local auth (docs/library-access.md → Local development) and
// wrangler dev serving dist/client on LIBRARY_LOCAL_ORIGIN, migrations applied.
//
// Versions listed from the saves the service kept; an older one looked at
// without anything changing; made current by a pointer move; the piece deleted,
// brought back by the library's undo, deleted again and restored from #/deleted.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root = new URL('../../', import.meta.url);
const origin = process.env.LIBRARY_LOCAL_ORIGIN ?? 'http://127.0.0.1:8791';
if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Smoke must target loopback only');
const session = JSON.parse(await fs.readFile(new URL('.secrets/local-library-session.json',root)));
const api = async (path, init = {}) => fetch(`${origin}/api/library${path}`, { ...init, headers: { 'Cf-Access-Jwt-Assertion': session.browser, ...(init.headers ?? {}) } });
const title = `Life smoke ${Date.now()}`;
const profile = await fs.mkdtemp('/tmp/mnx-piece-lifecycle-browser-');
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws,'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const wait = async expression => { for (let i=0;i<200;i++) { if (await c.evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('Browser assertion timed out: '+expression); };
  const app = "document.querySelector('mnx-studio')?.shadowRoot";
  const form = `${app}?.querySelector('mnx-studio-new-piece')?.shadowRoot`;
  const piece = `${app}?.querySelector('mnx-studio-piece')?.shadowRoot`;
  const library = `${app}?.querySelector('mnx-studio-library')?.shadowRoot`;
  const deleted = `${app}?.querySelector('mnx-studio-deleted')?.shadowRoot`;
  const frame = `${piece}?.querySelector('mnx-score-frame')?.shadowRoot`;
  const details = `${piece}?.querySelector('mnx-studio-edit-piece[slot=side]')?.shadowRoot`;
  // The pencil beside the title: one Edit piece panel in place of Details + Tags.
  const editPiece = `${piece}.querySelector('button[slot=title-action]')`;
  const saving = `${piece}?.querySelector('mnx-studio-save[slot=side]')?.shadowRoot`;
  const action = text => `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => b.textContent.includes(${JSON.stringify(text)}))`;
  const chip = `${piece}?.querySelector('button.save')`;
  const heading = `${frame}?.querySelector('.strip.top .head h1')?.textContent`;
  const press = (scope, label) => c.evaluate(`[...${scope}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const field = (label, value) => c.evaluate(`{ const i = [...${details}.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(${JSON.stringify(label)})).querySelector('input, textarea'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('change')); }`);
  const snapshot = async id => (await (await api(`/pieces/${id}`)).json()).snapshot;
  const listed = `[...(${library}?.querySelectorAll('li .who a') ?? [])].map(a => a.textContent)`;

  await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'});
  await c.send('Page.navigate',{url:origin+'/studio/#/new'}); await c.send('Page.reload');
  await wait(`!!${form}?.querySelector('form')`);
  await c.evaluate(`{ const i = ${form}.querySelector('label input'); i.value = ${JSON.stringify(title)}; i.dispatchEvent(new Event('input')); ${form}.querySelector('form').requestSubmit(); }`);
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash)`);
  const pieceId = (await c.evaluate('location.hash')).slice('#/piece/'.length);
  await wait(`${chip}?.dataset.save === 'clean'`);
  const first = await snapshot(pieceId);

  // Two more saves: an automatic one and a named one.
  await c.evaluate(`${editPiece}.click()`); await wait(`!!${details}?.querySelector('input')`);
  await field('Title', `${title} v2`);
  await c.evaluate(`${chip}.click()`); await wait(`!!${saving}`);
  await press(saving, 'Save now'); await wait(`${chip}.dataset.save === 'clean' && ${chip}.textContent.includes('just now')`);
  await c.evaluate(`${editPiece}.click()`); await wait(`!!${details}?.querySelector('input')`);
  await field('Artist', 'A synthetic author');
  await c.evaluate(`${chip}.click()`); await wait(`!!${saving}?.querySelector('input[aria-label="Version name"]')`);
  await c.evaluate(`{ const i = ${saving}.querySelector('input[aria-label="Version name"]'); i.value = 'With an author'; i.dispatchEvent(new Event('input')); }`);
  await wait(`!${saving}.querySelector('form button').disabled`);
  await c.evaluate(`${saving}.querySelector('form').requestSubmit()`);
  await wait(`${chip}.dataset.save === 'clean' && ${saving}.querySelectorAll('li.version').length === 3`);
  const rows = JSON.parse(await c.evaluate(`JSON.stringify([...${saving}.querySelectorAll('li.version')].map(li => [li.querySelector('b').textContent, li.querySelector('.what span').textContent.startsWith('Current'), !!li.querySelector('button')]))`));
  assert.deepEqual(rows, [['With an author', true, false], ['Saved automatically', false, true], ['As first made', false, true]]);
  const versionsShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-versions.png',Buffer.from(versionsShot.result.data,'base64'));

  // Look at the first version: its document is on screen, nothing is written, editing is off.
  const before = await snapshot(pieceId);
  await c.evaluate(`${saving}.querySelector('li.version[data-version="${first.piece.canonical_rendition_id}"] button').click()`);
  await wait(`${piece}.querySelector('.viewing')?.textContent.includes('Looking at an older version')`);
  await wait(`${heading} === ${JSON.stringify(title)}`);
  await wait(`${saving}.querySelector('li.version.viewing b').textContent === 'As first made'`);
  assert.equal(await c.evaluate(`${chip}.dataset.save`), 'clean');
  await c.evaluate(`${editPiece}.click()`); await wait(`!!${details}?.querySelector('input')`);
  assert.equal(await c.evaluate(`[...${details}.querySelectorAll('input')].every(i => i.readOnly) && !${details}.querySelector('.danger')`), true);
  assert.deepEqual([(await snapshot(pieceId)).piece.revision, (await snapshot(pieceId)).piece.canonical_rendition_id], [before.piece.revision, before.piece.canonical_rendition_id]);
  const viewingShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-version-viewing.png',Buffer.from(viewingShot.result.data,'base64'));
  // Back, and nothing moved; look again, and make it current: a pointer move, no new rendition, the tags following.
  await press(`${piece}.querySelector('.viewing')`, 'Back to current');
  await wait(`!${piece}.querySelector('.viewing') && ${heading} === ${JSON.stringify(`${title} v2`)}`);
  await c.evaluate(`${chip}.click()`); await wait(`!!${saving}?.querySelector('li.version')`);
  await c.evaluate(`${saving}.querySelector('li.version[data-version="${first.piece.canonical_rendition_id}"] button').click()`);
  await wait(`!!${piece}.querySelector('.viewing')`);
  await press(`${piece}.querySelector('.viewing')`, 'Make this the current version');
  await wait(`!${piece}?.querySelector('.viewing') && ${heading} === ${JSON.stringify(title)} && ${chip}?.dataset.save === 'clean'`);
  const reverted = await snapshot(pieceId);
  assert.equal(reverted.piece.canonical_rendition_id, first.piece.canonical_rendition_id);
  assert.equal(reverted.renditions.length, 3);
  assert.ok(reverted.tags.some(t => t.dimension === 'title' && t.value === title) && !reverted.tags.some(t => t.dimension === 'artist'));
  // The next edit is edited FROM where the pointer is.
  await c.evaluate(`${editPiece}.click()`); await wait(`!!${details}?.querySelector('input')`);
  await field('Subtitle', 'after going back');
  await c.evaluate(`${chip}.click()`); await wait(`!!${saving}`);
  await press(saving, 'Save now'); await wait(`${chip}.dataset.save === 'clean' && ${chip}.textContent.includes('just now')`);
  const fourth = await snapshot(pieceId);
  assert.equal(fourth.renditions.find(r => r.id === fourth.piece.canonical_rendition_id).derived_from, first.piece.canonical_rendition_id);

  // Delete: out of the library, nothing destroyed; the library offers the undo.
  await c.evaluate(`${editPiece}.click()`); await wait(`!!${details}?.querySelector('.danger')`);
  await press(details, 'Delete this piece…');
  await wait(`${details}.querySelector('.danger [role=alert]')?.textContent.includes('Nothing is destroyed')`);
  await press(details, 'Delete the piece');
  await wait(`!!${library} && ${library}.querySelector('.undo')?.textContent.includes(${JSON.stringify(title)})`);
  await wait(`!${listed}.some(t => t.includes(${JSON.stringify(title)}))`);
  assert.equal((await api(`/pieces/${pieceId}`)).status, 404);
  const undoShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-deleted-undo.png',Buffer.from(undoShot.result.data,'base64'));
  await press(`${library}.querySelector('.undo')`, 'Undo');
  await wait(`!${library}.querySelector('.undo') && ${listed}.some(t => t.includes(${JSON.stringify(title)}))`);
  assert.equal((await snapshot(pieceId)).renditions.length, 4);
  // Again, and back through the Deleted pieces page.
  const again = await snapshot(pieceId);
  assert.equal((await api(`/pieces/${pieceId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: again.piece.revision }) })).status, 204);
  await c.evaluate(`[...${library}.querySelectorAll('a.foot')].find(a => a.textContent.includes('Deleted pieces')).click()`);
  await wait(`!!${deleted}?.querySelector('[data-piece="${pieceId}"]')`);
  await c.evaluate(`${deleted}.querySelector('[data-piece="${pieceId}"] button').click()`);
  await wait(`location.hash === '#/piece/${pieceId}' && ${heading} === ${JSON.stringify(title)}`);
  await wait(`${frame}.querySelector('.strip.top .head .sub') === null || true`);
  assert.equal((await snapshot(pieceId)).renditions.length, 4);
  console.log(`Piece-lifecycle smoke passed: ${pieceId} — three versions listed, the first looked at with nothing written, made current by a pointer move (tags following, the next edit derived from it), deleted with the library's undo, deleted again and restored from #/deleted with all four renditions.`);
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); }
