// Editing and saving in a real browser against the local Worker/D1/R2
// (roadmap/complete/studio-save-pipeline.md). Same preconditions as
// studio-smoke.mjs: local auth (docs/library-access.md → Local development) and
// wrangler dev serving dist/client on LIBRARY_LOCAL_ORIGIN.
//
// What only a browser can show: the Details sheet editing the document, the
// chip, the IndexedDB recovery record surviving a reload ("the crash"), the
// storage check running in its worker, the edit lock, and a conflict with
// another device settled by keeping a copy.
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
const stamp = Date.now(); const title = `Save smoke ${stamp}`;
const profile = await fs.mkdtemp('/tmp/mnx-save-pipeline-browser-');
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws,'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  const wait = async expression => { for (let i=0;i<200;i++) { if (await c.evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('Browser assertion timed out: '+expression); };
  const app = "document.querySelector('mnx-studio')?.shadowRoot";
  const form = `${app}?.querySelector('mnx-studio-new-piece')?.shadowRoot`;
  const piece = `${app}?.querySelector('mnx-studio-piece')?.shadowRoot`;
  const frame = `${piece}?.querySelector('mnx-score-frame')?.shadowRoot`;
  const details = `${piece}?.querySelector('mnx-studio-edit-piece[slot=side]')?.shadowRoot`;
  // The pencil beside the title, not a tools-row button: one panel holds the
  // score's header, what was read from the notes, and your own values.
  const editPiece = `${piece}.querySelector('button[slot=title-action]')`;
  const saving = `${piece}?.querySelector('mnx-studio-save[slot=side]')?.shadowRoot`;
  const action = text => `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => b.textContent.includes(${JSON.stringify(text)}))`;
  const chip = `${piece}?.querySelector('button.save')`;
  const heading = `${frame}?.querySelector('.strip.top .head h1')?.textContent`;
  const field = (label, value) => c.evaluate(`{ const i = [...${details}.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(${JSON.stringify(label)})).querySelector('input, textarea'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('change')); }`);
  const record = id => c.evaluate(`new Promise(resolve => { const open = indexedDB.open('mnx-studio.recovery', 1); open.onupgradeneeded = () => open.result.createObjectStore('recovery', { keyPath: 'pieceId' }); open.onsuccess = () => { const get = open.result.transaction('recovery').objectStore('recovery').get(${JSON.stringify(id)}); get.onsuccess = () => resolve(get.result ? JSON.stringify({ title: get.result.document._x.mnxLab.work.title, base: get.result.baseRenditionId, edits: get.result.edits, build: get.result.build }) : null); }; })`);
  const snapshot = async id => (await (await api(`/pieces/${id}`)).json()).snapshot;

  await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'});
  await c.send('Page.navigate',{url:origin+'/studio/#/new'}); await c.send('Page.reload');
  await wait(`!!${form}?.querySelector('form')`);
  await c.evaluate(`{ const i = ${form}.querySelector('label input'); i.value = ${JSON.stringify(title)}; i.dispatchEvent(new Event('input')); ${form}.querySelector('form').requestSubmit(); }`);
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash)`);
  const pieceId = (await c.evaluate('location.hash')).slice('#/piece/'.length);
  await wait(`${heading}?.includes(${JSON.stringify(title)})`);
  // Opened clean, holding this piece's edit lock.
  await wait(`${chip}?.textContent.trim() === 'Saved' && ${chip}.dataset.save === 'clean'`);
  await wait(`navigator.locks.query().then(q => q.held.some(l => l.name === 'mnx-studio.piece.${pieceId}'))`);
  const first = await snapshot(pieceId);

  // An edit: the heading follows the document at once, the chip counts the risk, the record lands on this device.
  await c.evaluate(`${editPiece}.click()`);
  await wait(`!!${details}?.querySelector('input')`);
  await field('Title', `${title} (edited)`);
  await wait(`${heading}?.includes('(edited)')`);
  await wait(`${chip}.textContent.trim() === '1 edit unsaved'`);
  await wait(`indexedDB.databases().then(d => d.some(x => x.name === 'mnx-studio.recovery'))`);
  let kept; for (let i = 0; i < 40 && !(kept = await record(pieceId)); i++) await new Promise(r => setTimeout(r, 100));
  assert.deepEqual({ ...JSON.parse(kept), build: undefined }, { title: `${title} (edited)`, base: first.piece.canonical_rendition_id, edits: 1, build: undefined });
  assert.match(JSON.parse(kept).build, /^\d+\.\d+\.\d+\+/);
  assert.equal((await snapshot(pieceId)).piece.canonical_rendition_id, first.piece.canonical_rendition_id, 'nothing was saved yet');

  // The crash: reload before any checkpoint. The edit comes back from this device, and says so.
  await c.send('Page.reload');
  await wait(`${heading}?.includes('(edited)')`);
  await wait(`${chip}?.textContent.trim() === 'Recovered 1 edit from this device'`);
  await c.evaluate(`${chip}.click()`);
  await wait(`${saving}?.textContent.includes('recovered from this device')`);
  const recoveredShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-save-recovered.png',Buffer.from(recoveredShot.result.data,'base64'));

  // Save now: the check runs in its worker, a new edit rendition takes the pointer, the record goes, the tags follow.
  await c.evaluate(`[...${saving}.querySelectorAll('button')].find(b => b.textContent === 'Save now').click()`);
  await wait(`${chip}.textContent.trim() === 'Saved · just now'`);
  const second = await snapshot(pieceId);
  assert.notEqual(second.piece.canonical_rendition_id, first.piece.canonical_rendition_id);
  assert.deepEqual(second.renditions.map(r => [r.role, r.derived_from]).sort(), [['edit', first.piece.canonical_rendition_id], ['original', null]]);
  const edit = second.renditions.find(r => r.role === 'edit');
  // `clean`, not `gains`: this document was READ from a .gp, so it already says everything Guitar Pro makes explicit.
  assert.deepEqual([JSON.parse(edit.provenance).kind, JSON.parse(edit.provenance).name, JSON.parse(edit.provenance).check.verdict], ['checkpoint', null, 'clean']);
  assert.deepEqual(JSON.parse(edit.producer_options), { collapseTabUnisons: false, compress: true });
  assert.ok(second.tags.some(t => t.dimension === 'title' && t.value === `${title} (edited)`));
  assert.equal(await record(pieceId), null);

  // Undo back to the saved document is clean again — nothing to save, nothing kept.
  await c.evaluate(`${editPiece}.click()`);
  await wait(`!!${details}?.querySelector('input')`);
  await field('Artist', 'A synthetic author');
  await wait(`${chip}.textContent.trim().startsWith('1 edit unsaved')`);
  await c.evaluate(`[...${details}.querySelectorAll('button')].find(b => b.textContent === 'Undo').click()`);
  await wait(`${chip}.textContent.trim().startsWith('Saved ·') && ${chip}.dataset.save === 'clean'`);
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(await record(pieceId), null);
  assert.equal((await snapshot(pieceId)).piece.revision, second.piece.revision);

  // A named version.
  await c.evaluate(`[...${details}.querySelectorAll('button')].find(b => b.textContent === 'Redo').click()`);
  await wait(`${chip}.textContent.trim().startsWith('1 edit unsaved')`);
  await c.evaluate(`${chip}.click()`);
  await wait(`!!${saving}?.querySelector('input[aria-label="Version name"]')`);
  await c.evaluate(`{ const i = ${saving}.querySelector('input[aria-label="Version name"]'); i.value = 'Smoke version'; i.dispatchEvent(new Event('input')); }`);
  await wait(`!${saving}.querySelector('form button').disabled`);
  await c.evaluate(`${saving}.querySelector('form').requestSubmit()`);
  await wait(`${chip}.textContent.trim() === 'Saved · just now'`);
  const third = await snapshot(pieceId);
  assert.equal(JSON.parse(third.renditions.find(r => r.id === third.piece.canonical_rendition_id).provenance).name, 'Smoke version');
  assert.ok(third.tags.some(t => t.dimension === 'artist' && t.value === 'A synthetic author'));

  // Another device saves the score while this one has edits: not overwritten — a conflict, settled as a copy.
  const older = new Uint8Array(await (await api(`/renditions/${first.piece.canonical_rendition_id}`)).arrayBuffer());
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', older)).toString('hex');
  const elsewhere = await api(`/pieces/${pieceId}/renditions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    expected_revision: third.piece.revision, derived_from: third.piece.canonical_rendition_id, name: null, check: { verdict: 'clean', differences: [], warnings: [] },
    rendition: { filename: 'elsewhere.gp', sha256, content: Buffer.from(older).toString('base64'), producer_version: 'another-device', producer_options: null },
    derived_tags: [{ dimension: 'title', value: `${title} (the tablet's)` }] }) });
  assert.equal(elsewhere.status, 201);
  await c.evaluate(`${editPiece}.click()`);
  await wait(`!!${details}?.querySelector('input')`);
  await field('Subtitle', 'written on the desktop');
  await c.evaluate(`${chip}.click()`);
  await wait(`!!${saving}`);
  await c.evaluate(`[...${saving}.querySelectorAll('button')].find(b => b.textContent === 'Save now').click()`);
  await wait(`${chip}.textContent.trim() === 'Saved on another device · 1 edit here'`);
  await wait(`${saving}.textContent.includes('Keep mine as a copy')`);
  const conflictShot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-save-conflict.png',Buffer.from(conflictShot.result.data,'base64'));
  assert.equal((await snapshot(pieceId)).renditions.length, 4, 'the other device\'s save stands; this one added nothing');
  await c.evaluate(`[...${saving}.querySelectorAll('button')].find(b => b.textContent === 'Keep mine as a copy').click()`);
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash) && location.hash !== '#/piece/${pieceId}'`);
  const copyId = (await c.evaluate('location.hash')).slice('#/piece/'.length);
  await wait(`${heading}?.includes('(copy)')`);
  const copy = await snapshot(copyId);
  assert.equal(copy.piece.source_kind, 'studio');
  assert.ok(copy.tags.some(t => t.dimension === 'subtitle' && t.value === 'written on the desktop'));
  assert.equal(await record(pieceId), null);
  // Navigation while the real export worker is delayed: the old save owns its
  // lock and metadata until it lands, and cannot repaint the new piece's state.
  await c.evaluate(`${editPiece}.click()`);
  await wait(`!!${details}?.querySelector('input')`);
  await field('Title', `${title} (departing)`);
  await field('Subtitle', 'saved while leaving');
  await c.evaluate(`{
    const WorkerBefore = window.Worker;
    window.Worker = class extends WorkerBefore {
      postMessage(message, ...rest) {
        if (message?.cmd === 'mnx-lab:check-storage') {
          window.Worker = WorkerBefore;
          window.releaseSaveCheck = () => super.postMessage(message, ...rest);
        } else super.postMessage(message, ...rest);
      }
    };
  }`);
  await c.evaluate(`${chip}.click()`);
  await wait(`!!${saving}`);
  await c.evaluate(`[...${saving}.querySelectorAll('button')].find(b => b.textContent === 'Save now').click()`);
  await wait(`typeof window.releaseSaveCheck === 'function'`);
  await c.evaluate(`location.hash = '#/piece/${pieceId}'`);
  await wait(`${heading}?.includes("the tablet's")`);
  assert.equal(await c.evaluate(`navigator.locks.query().then(q => q.held.some(l => l.name === 'mnx-studio.piece.${copyId}'))`), true, 'departing save released its lock before the export finished');
  await c.evaluate(`window.releaseSaveCheck()`);
  for (let i = 0; i < 100; i++) {
    if ((await snapshot(copyId)).tags.some(t => t.dimension === 'subtitle' && t.value === 'saved while leaving')) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const departed = await snapshot(copyId);
  assert.ok(departed.tags.some(t => t.dimension === 'subtitle' && t.value === 'saved while leaving'));
  assert.ok(departed.tags.some(t => t.dimension === 'title' && t.value === `${title} (departing)`));
  await wait(`navigator.locks.query().then(q => !q.held.some(l => l.name === 'mnx-studio.piece.${copyId}'))`);
  assert.match(await c.evaluate(heading), /the tablet's/, 'old save changed the new piece heading');
  assert.equal(await c.evaluate(`${chip}.dataset.save`), 'clean', 'old save changed the new piece save state');
  console.log(`Save-pipeline smoke passed: ${pieceId} edited in the Edit piece panel; the unsaved edit recovered from IndexedDB after a reload; Save now → an edit rendition with a 'clean' check and the tags following; undo back to clean; a named version; and another device's save met as a conflict, kept as copy ${copyId}.`);
  if (c.logs.length) throw new Error('Browser console errors: '+c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); await once(chrome,'exit'); await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); }
