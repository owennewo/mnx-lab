// Bounded real desktop editor probe. It never calls an edit operation directly.
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
import { validateRootExt } from '../../worker/generated/validate-extensions.mjs';
import { devtoolsPort, connect, client, waitFor } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';
import { serveStatic } from './staticServer.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const shell = process.env.PITCH_WRITE_SHELL ?? 'workbench';
const fixture = process.env.PITCH_WRITE_FIXTURE ?? '01e-Pitches-ParenthesizedAccidentals';
assert.ok(['workbench', 'studio'].includes(shell));
assert.ok(['01a-Pitches-Pitches', '01e-Pitches-ParenthesizedAccidentals'].includes(fixture));
const out = path.resolve(process.env.PITCH_WRITE_DIR ?? `/tmp/mnx-musicxml-pitch-write-${shell}-${fixture}`);
await fs.mkdir(out, { recursive: true });
const source = path.join(root, 'converters/fixtures/musicxml-suite/xmlFiles', fixture + '.musicxml');
const sourceBytes = await fs.readFile(source);
const hash = value => createHash('sha256').update(value).digest('hex');
const library = shell === 'studio' ? await startLocalLibrary() : null;
const site = shell === 'workbench' ? await serveStatic(path.join(root, 'dist/client')) : null;
const profile = await fs.mkdtemp(`${os.tmpdir()}/mnx-pitch-write-browser-`);
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });
const report = {
  kind: 'implementation-loop agent assessment; real desktop controls, not human verification', fixture, shell,
  sourceSha256: hash(sourceBytes),
  applicationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  captureScriptSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
  viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 }, actions: [], tasks: []
};
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws, 'open');
  const c = client(ws);
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('DOM.enable');
  report.browser = (await c.send('Browser.getVersion')).result;
  await c.send('Emulation.setDeviceMetricsOverride', { ...report.viewport, mobile: false });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const wb = "document.querySelector('mnx-workbench')";
  const page = shell === 'workbench'
    ? `${wb}.shadowRoot.querySelector('mnx-scenario-page')`
    : "document.querySelector('mnx-studio')?.shadowRoot?.querySelector('mnx-studio-piece')";
  const viewer = `${page}.shadowRoot.querySelector('mnx-document-viewer')`;
  const session = `${page}.editor.session`;
  const read = () => c.evaluate(`${session}.doc`);
  const wait = (expression, label) => waitFor(c, expression, label, 30000);
  const shot = async name => {
    const result = await c.send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(out, `${name}.png`), Buffer.from(result.result.data, 'base64'));
  };
  const saveDoc = async (name, document) => fs.writeFile(path.join(out, `${name}.mnx.json`), JSON.stringify(document, null, 2) + '\n');
  const note = document => document.parts[0].measures[0].sequences[0].content[0].notes?.[0];
  const allNotes = document => document.parts.flatMap(part => part.measures.flatMap(measure => measure.sequences.flatMap(sequence => sequence.content.flatMap(event => event.notes ?? []))));
  const check = document => {
    assert.equal(validateMnx(document), true, JSON.stringify(validateMnx.errors));
    if (document._x?.mnxLab) assert.equal(validateRootExt(document._x.mnxLab), true, JSON.stringify(validateRootExt.errors));
  };
  const exact = async document => wait(`JSON.stringify(${session}.doc)===${JSON.stringify(JSON.stringify(document))}`, 'exact document state');
  const key = async (code, value, vk, modifiers = 0) => {
    report.actions.push({ key: value, code, modifiers });
    await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: value, windowsVirtualKeyCode: vk, modifiers });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: value, windowsVirtualKeyCode: vk, modifiers });
  };
  const type = async value => {
    report.actions.push({ typed: value });
    for (const ch of value) {
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
  };
  const inspector = `(()=>{const roots=[document];while(roots.length){const r=roots.shift();const hit=r.querySelector('mnx-rung-inspector');if(hit)return hit;for(const e of r.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}return null;})()`;
  const closeInspector = async () => {
    for (let i = 0; i < 3 && await c.evaluate(`!!(${inspector})`); i++) await key('Escape', 'Escape', 27);
    await c.evaluate(`${viewer}.focus()`);
  };
  const command = async value => {
    await c.evaluate(`${viewer}.focus()`);
    await key('Enter', 'Enter', 13);
    await wait(`!!(${inspector})`, 'note inspector');
    await type(value); await key('Enter', 'Enter', 13);
    if (await c.evaluate(`!!(${inspector})?.shadowRoot?.querySelector('.error')`))
      throw new Error('Inspector refused ' + value + ': ' + await c.evaluate(`(${inspector}).shadowRoot.querySelector('.error').textContent`));
  };
  const history = async (before, after) => {
    await closeInspector(); await key('KeyZ', 'z', 90, 2); await exact(before);
    await key('KeyY', 'y', 89, 2); await exact(after);
  };
  const mutation = async (id, trigger, verify) => {
    const before = await read(); await trigger();
    await wait(`JSON.stringify(${session}.doc)!==${JSON.stringify(JSON.stringify(before))}`, id + ' mutation');
    const after = await read(); check(after); verify(before, after);
    await saveDoc(id, after); await history(before, after);
    report.tasks.push({ id, verdict: 'supported', structuralChange: true, unrelatedData: 'exactly preserved outside the named field/event', undoRedo: 'exact' });
    return after;
  };

  let pieceId, originalId;
  if (shell === 'workbench') {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${site.port}/workbench/` });
    await wait(`!!${wb}?.shadowRoot?.querySelector('#local-file')`, 'Workbench file input');
    const input = await c.send('Runtime.evaluate', { expression: `${wb}.shadowRoot.querySelector('#local-file')` });
    await c.send('DOM.setFileInputFiles', { objectId: input.result.result.objectId, files: [source] });
    await wait(`!!${page}?.editor && !!${viewer}?.shadowRoot?.querySelector('svg')`, 'editable original');
    report.entryPath = 'Open… → original MusicXML';
    await c.send('Browser.grantPermissions', { origin: `http://127.0.0.1:${site.port}`, permissions: ['clipboardReadWrite','clipboardSanitizedWrite'] });
  } else {
    const { origin, session: auth } = library;
    const headers = { Authorization: `Bearer ${library.writeToken}`, 'Cf-Access-Jwt-Assertion': auth.machine };
    const gp = await fs.readFile(path.join(root, 'converters/fixtures/Triplets-and-graces.gp'));
    const id = 'PitchAssessment-' + fixture + '-' + Date.now();
    originalId = id + '-xml';
    const manifest = { expected_revision: null, source: { kind: 'soundslice', id }, renditions: [
      { id: originalId, format: 'musicxml', role: 'original', producer: 'local-assessment', producer_version: null, producer_options: null, filename: fixture + '.musicxml', sha256: hash(sourceBytes), file: 'score' },
      { id: id + '-gp', format: 'gp', role: 'export', producer: 'local-assessment', producer_version: null, producer_options: null, filename: 'seed.gp', sha256: hash(gp), file: 'seed' }
    ], recordings: [], tags: [], canonical: { mode: 'initialize', rendition_id: id + '-gp' }, derived_tags: [{ dimension: 'title', value: fixture, source_ref: 'test' }] };
    const form = new FormData(); form.set('manifest', JSON.stringify(manifest)); form.set('score', new Blob([sourceBytes]), fixture + '.musicxml'); form.set('seed', new Blob([gp]), 'seed.gp');
    const ingested = await fetch(origin + '/api/library/ingest', { method: 'POST', headers, body: form });
    assert.equal(ingested.status, 200, await ingested.clone().text());
    pieceId = (await ingested.json()).snapshot.piece.id;
    await c.send('Network.enable');
    await c.send('Network.setCookie', { name: 'CF_Authorization', value: auth.browser, url: origin, httpOnly: true, sameSite: 'Lax' });
    await c.send('Page.navigate', { url: origin + '/studio/#/piece/' + pieceId });
    await wait(`!!${page}?.editor`, 'Studio GP seed');
    const sheet = `${page}.shadowRoot.querySelector('mnx-studio-save').shadowRoot`;
    await c.evaluate(`${page}.shadowRoot.querySelector('button.save').click()`);
    await wait(`!!${sheet}?.querySelector('[data-version="${originalId}"] button')`, 'original version');
    await c.evaluate(`${sheet}.querySelector('[data-version="${originalId}"] button').click()`);
    await wait(`${page}.viewing?.id===${JSON.stringify(originalId)}`, 'View original');
    await c.evaluate(`[...${sheet}.querySelectorAll('[data-version="${originalId}"] button')].find(b=>b.textContent.trim()==='Make current').click()`);
    const prompt = `${page}.shadowRoot.querySelector('.version-title')`;
    await wait(`!!${prompt}`, 'library title prompt');
    await c.evaluate(`${prompt}.requestSubmit()`);
    await wait(`!!${page}.editor && !${page}.viewing && ${page}.snapshot?.piece.canonical_rendition_id===${JSON.stringify(originalId)}`, 'editable original');
    await c.evaluate(`${page}.shadowRoot.querySelector('button.save').click()`);
    report.entryPath = 'private operator ingest → Saved → Versions → View XML → Make current → Library title';
    report.originalSha256AfterPromotion = hash(Buffer.from(await (await fetch(origin + '/api/library/renditions/' + originalId, { headers: { 'Cf-Access-Jwt-Assertion': auth.browser } })).arrayBuffer()));
    assert.equal(report.originalSha256AfterPromotion, report.sourceSha256);
  }
  await c.evaluate(`${viewer}.focus()`);
  const initial = await read(); check(initial); await saveDoc('initial', initial); await shot('initial');
  report.initialNotes = allNotes(initial).length;
  await key('Enter', 'Enter', 13); await wait(`!!(${inspector})`, 'initial note inspector');
  report.initialInspector = await c.evaluate(`(${inspector}).shadowRoot.textContent`);
  await shot('inspector'); await closeInspector();

  if (fixture.startsWith('01a')) {
    await mutation('change-pitch', () => key('ArrowUp', 'ArrowUp', 38, 1), (before, after) => {
      assert.equal(allNotes(after).length, allNotes(before).length);
      const normalized = structuredClone(after); note(normalized).pitch = note(before).pitch;
      assert.deepEqual(normalized, before);
      assert.notDeepEqual(note(after).pitch, note(before).pitch);
    });
    await mutation('remove-note', () => key('Delete', 'Delete', 46), (before, after) => {
      assert.equal(allNotes(after).length, allNotes(before).length - 1);
      const normalized = structuredClone(after); normalized.parts[0].measures[0].sequences[0].content[0] = before.parts[0].measures[0].sequences[0].content[0];
      assert.deepEqual(normalized, before);
    });
    await mutation('create-note', () => key('KeyN', 'n', 78), (before, after) => {
      assert.equal(allNotes(after).length, allNotes(before).length + 1);
      const normalized = structuredClone(after); normalized.parts[0].measures[0].sequences[0].content[0] = before.parts[0].measures[0].sequences[0].content[0];
      assert.deepEqual(normalized, before);
    });
  } else {
    const restoreAccidental = (document, original) => {
      if (original === undefined) delete note(document).accidentalDisplay;
      else note(document).accidentalDisplay = original;
    };
    await mutation('remove-explicit-accidental', () => command('no accidental'), (before, after) => {
      assert.equal(note(after).accidentalDisplay, undefined);
      const normalized = structuredClone(after); restoreAccidental(normalized, note(before).accidentalDisplay);
      assert.deepEqual(normalized, before);
    });
    await mutation('create-parenthesized-accidental', () => command('accidental parens'), (before, after) => {
      assert.deepEqual(note(after).accidentalDisplay, { show: true, enclosure: { symbol: 'parentheses' } });
      const normalized = structuredClone(after); restoreAccidental(normalized, note(before).accidentalDisplay);
      assert.deepEqual(normalized, before);
    });
    await mutation('change-to-plain-accidental', () => command('accidental show'), (before, after) => {
      assert.deepEqual(note(after).accidentalDisplay, { show: true });
      const normalized = structuredClone(after); restoreAccidental(normalized, note(before).accidentalDisplay);
      assert.deepEqual(normalized, before);
    });
    await mutation('change-back-to-parentheses', () => command('accidental parens'), (before, after) => {
      assert.deepEqual(note(after).accidentalDisplay, { show: true, enclosure: { symbol: 'parentheses' } });
      const normalized = structuredClone(after); restoreAccidental(normalized, note(before).accidentalDisplay);
      assert.deepEqual(normalized, before);
    });
  }
  const final = await read(); await saveDoc('final', final); await shot('final');
  if (shell === 'workbench') {
    const findButton = `(()=>{const roots=[document];while(roots.length){const r=roots.shift();const hit=r.querySelector('button[title="copy the document as JSON"]');if(hit)return hit;for(const e of r.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}return null;})()`;
    await c.evaluate(`(()=>{const roots=[document];while(roots.length){const r=roots.shift();const b=[...r.querySelectorAll('button')].find(b=>b.textContent.trim().toUpperCase()==='JSON');if(b){b.click();return;}for(const e of r.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}})()`);
    await wait(`!!(${findButton})`, 'JSON Copy document'); await c.evaluate(`(${findButton}).click()`);
    const copied = await c.evaluate('navigator.clipboard.readText()'); assert.deepEqual(JSON.parse(copied), final);
    const saved = path.join(out, 'copied.mnx.json'); await fs.writeFile(saved, copied);
    const input = await c.send('Runtime.evaluate', { expression: `${wb}.shadowRoot.querySelector('#local-file')` });
    await c.send('DOM.setFileInputFiles', { objectId: input.result.result.objectId, files: [saved] });
    await wait(`${wb}.localDocument?.fileName==='copied.mnx.json' && !${wb}.openingLocalFile`, 'MNX reopen'); await exact(final);
    report.persistence = { route: 'JSON panel → Copy document → harness file save → Open MNX', verdict: 'exact', scope: 'final edited state' };
  } else {
    const sheet = `${page}?.shadowRoot?.querySelector('mnx-studio-save')?.shadowRoot`;
    if (!await c.evaluate(`!!${sheet}`)) await c.evaluate(`${page}.shadowRoot.querySelector('button.save').click()`);
    await wait(`!!${sheet}`, 'Save sheet');
    await c.evaluate(`[...${sheet}.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save now').click()`);
    await wait(`${page}.snapshot?.piece.canonical_rendition_id!==${JSON.stringify(originalId)} && ${page}.shadowRoot.querySelector('button.save').dataset.save==='clean'`, 'GP checkpoint');
    report.storageLosses = await c.evaluate(`${page}.losses`);
    await shot('gp-checkpoint');
    await c.send('Page.reload'); await wait(`!!${page}?.editor && !${page}.loading`, 'GP reopen');
    const reopened = await read(); await saveDoc('gp-reopened', reopened);
    report.persistence = { route: 'Save now → GP storage → page reload', verdict: JSON.stringify(reopened) === JSON.stringify(final) ? 'exact' : 'lossy',
      beforeNotes: allNotes(final).length, afterNotes: allNotes(reopened).length,
      beforeFirstAccidental: note(final)?.accidentalDisplay ?? null, afterFirstAccidental: note(reopened)?.accidentalDisplay ?? null };
    const { origin, session: auth } = library;
    report.originalSha256AfterCheckpoint = hash(Buffer.from(await (await fetch(origin + '/api/library/renditions/' + originalId, { headers: { 'Cf-Access-Jwt-Assertion': auth.browser } })).arrayBuffer()));
    assert.equal(report.originalSha256AfterCheckpoint, report.sourceSha256);
    // These are separate user-facing Library exports of the saved canonical GP,
    // not exports of the unsaved MusicXML editing document.
    const downloads = path.join(out, 'downloads'); await fs.mkdir(downloads, { recursive: true });
    await c.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    report.libraryExports = [];
    const wbApp = "document.querySelector('mnx-workbench')";
    for (const [format, extension] of [['mnx', '.mnx.json'], ['musicxml', '.musicxml'], ['gp7', '.gp']]) {
      await c.send('Page.navigate', { url: origin + '/studio/#/' });
      const libraryPage = "document.querySelector('mnx-studio')?.shadowRoot?.querySelector('mnx-studio-library')";
      const exportSelect = `${libraryPage}?.shadowRoot?.querySelector('select[aria-label^="Export "]')`;
      await wait(`!!${exportSelect}`, 'Library Export control');
      await c.evaluate(`{const s=${exportSelect};s.value=${JSON.stringify(format)};s.dispatchEvent(new Event('change',{bubbles:true}));}`);
      await wait(`${libraryPage}.exportNotice.includes('Export')`, format + ' export result');
      const notice = await c.evaluate(`${libraryPage}.exportNotice`);
      let file;
      for (let i = 0; i < 200; i++) {
        const names = await fs.readdir(downloads);
        const name = names.find(value => value.endsWith(extension) && !value.endsWith('.crdownload'));
        if (name) { file = path.join(downloads, name); break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(file, format + ' download did not finish');
      const bytes = await fs.readFile(file);
      const row = { format, control: 'Library → Export… → ' + (format === 'gp7' ? 'Guitar Pro 7' : format === 'mnx' ? 'MNX' : 'MusicXML'),
        filename: path.basename(file), sha256: hash(bytes), bytes: bytes.length, notice };
      await c.send('Page.navigate', { url: origin + '/workbench/' });
      await wait(`!!${wbApp}?.shadowRoot?.querySelector('#local-file')`, 'Workbench reopen input');
      const input = await c.send('Runtime.evaluate', { expression: `${wbApp}.shadowRoot.querySelector('#local-file')` });
      await c.send('DOM.setFileInputFiles', { objectId: input.result.result.objectId, files: [file] });
      await wait(`${wbApp}.localDocument?.fileName===${JSON.stringify(path.basename(file))} && !${wbApp}.openingLocalFile`, format + ' reopen');
      row.reopenError = await c.evaluate(`${wbApp}.localFileError || null`);
      if (!row.reopenError) {
        const reopenedExport = await c.evaluate(`${wbApp}.localDocument.document`);
        await saveDoc('export-' + format + '-reopened', reopenedExport);
        row.reopenedNotes = allNotes(reopenedExport).length;
        row.reopenedFirstAccidental = note(reopenedExport)?.accidentalDisplay ?? null;
      }
      report.libraryExports.push(row);
    }
  }
  report.consoleErrors = c.logs; assert.deepEqual(c.logs, []); report.result = 'passed';
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  ws?.close(); chrome.kill(); site?.server.close(); await library?.close();
  try { await fs.rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
}
console.log(JSON.stringify({ fixture, shell, result: report.result, error: report.error, persistence: report.persistence }, null, 2));
