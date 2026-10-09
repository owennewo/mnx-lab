// Studio choosing instruments on the synth's host (roadmap/complete/core-campaign-synth.md,
// Phase 6), in a real browser against the local Worker/D1/R2. The Instruments sheet offers
// the synth's factory designs (read from /synth/), Basic keys and "Import rig…"; a design
// and an imported part rig each reach the player's host as chosen and play; a file that is
// not a part rig says why; and the choice is still there after a reload. The Sound choice
// Light plays the synth at 32 kHz and stays on the device across a reload.
//
// Its own private library, like studio-smoke.mjs. Usage: npm run build:site && node harness/verify/studio-instruments-smoke.mjs
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { devtoolsPort, connect, client, until, STUDIO_STATE, stopChrome } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';
const library = await startLocalLibrary();
const { origin, session } = library;
const title = `Instruments smoke ${Date.now()}`;
const profile = await fs.mkdtemp(`${os.tmpdir()}/mnx-studio-instruments-browser-`);
const files = await fs.mkdtemp(`${os.tmpdir()}/mnx-studio-instruments-files-`);
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900',
  '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  // A part rig as the synth's Export part writes it, with a factory design embedded.
  const presets = JSON.parse(await fs.readFile('synth/web/data/instrument-v2/presets.json', 'utf8'));
  const rigFile = path.join(files, 'smoke.rig.json'), badFile = path.join(files, 'whole-session.rig.json');
  const part = id => ({ id, name: 'Guitar', instrument: { kind: 'plucked', design: presets.find(p => p.id === 'soft-nylon'),
    layout: { strings: [64, 59, 55, 50, 45, 40].map(pitch => ({ pitch })) } }, chain: [{ id: 'echo', type: 'echo', state: 'on', params: {} }],
    strip: { levelDb: -2, pan: 0, mute: false, solo: false, sends: { room: 0.3 } } });
  const setup = parts => ({ contract: 'mnx-sound/2', session: { buses: [{ id: 'room', type: 'room', state: 'on', params: {} }], master: { volumeDb: 0, ceilingDb: -1 } }, parts });
  await fs.writeFile(rigFile, JSON.stringify({ rig: '3.0.0', name: 'Smoke rig', setup: setup([part('g')]) }));
  await fs.writeFile(badFile, JSON.stringify({ rig: '3.0.0', name: 'Two parts', setup: setup([part('g'), part('h')]) }));

  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws, 'open');
  const c = client(ws); await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('DOM.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const wait = expression => until(c, expression, { timeoutMs: 20000, describe: STUDIO_STATE });
  const key = async (code, text) => {
    const base = { code, key: text ?? code, windowsVirtualKeyCode: { ArrowRight: 39 }[code] ?? text?.charCodeAt(0) };
    await c.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text } : {}) });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };
  const app = "document.querySelector('mnx-studio')?.shadowRoot";
  const form = `${app}?.querySelector('mnx-studio-new-piece')?.shadowRoot`;
  const page = `${app}?.querySelector('mnx-studio-piece')`;
  const piece = `${page}?.shadowRoot`;
  const viewer = `${piece}?.querySelector('mnx-document-viewer')`;
  const player = `${piece}?.querySelector('mnx-player')`;
  const backend = `${player}?.session?.backend`;
  const sheet = `${piece}?.querySelector('mnx-studio-instruments')?.shadowRoot`;
  const select = `${sheet}?.querySelector('select[aria-label$="instrument"]')`;
  const options = `[...${select}.options].map(o => o.textContent.trim())`;
  const action = text => `[...${piece}.querySelectorAll('button[slot=actions]')].find(b => (b.getAttribute('aria-label') ?? b.textContent).includes(${JSON.stringify(text)}))`;
  const choose = value => c.evaluate(`{ const s = ${select}; s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); }`);
  const openSheet = async () => { await c.evaluate(`${action('Instruments')}.click()`); await wait(`!!${select} && ${select}.options.length > 4`); };
  /** Play a moment and count the notes the host acknowledges as sounding. */
  const listen = () => c.evaluate(`(async () => {
    // From the top: the editor's cursor, past the notes typed, is where play would start.
    const p = ${player}; p.stop(); await p.play();
    const host = p.session.backend.port.host, heard = new Set();
    const off = host.on('sounding', list => list.forEach(s => heard.add(s.id)));
    await new Promise(r => setTimeout(r, 2500)); off(); p.stop();
    return heard.size;
  })()`);

  await c.send('Network.setCookie', { name: 'CF_Authorization', value: session.browser, url: origin, httpOnly: true, sameSite: 'Lax' });
  await c.send('Page.navigate', { url: origin + '/studio/#/new' }); await c.send('Page.reload');
  await wait(`!!${form}?.querySelector('form')`);
  await c.evaluate(`{ const i = ${form}.querySelector('label input'); i.value = ${JSON.stringify(title)}; i.dispatchEvent(new Event('input')); ${form}.querySelector('form').requestSubmit(); }`);
  await wait(`/^#\\/piece\\/[0-9a-f]{16}$/.test(location.hash)`);
  await wait(`!!${page}.editor && ${viewer}.selection?.cursor != null`);
  await c.evaluate(`${viewer}.focus()`);
  await wait(`${viewer}.selectionInactive === false`);
  // Three frets: something to hear.
  for (const fret of ['3', '5', '7']) { await key(fret.replace(/./, d => `Digit${d}`), fret); await new Promise(r => setTimeout(r, 700)); await key('ArrowRight'); }
  await wait(`(${player}.performance?.sounding.length ?? 0) >= 3`);

  // ── the sheet offers the host's instruments ─────────────────────────────────
  await openSheet();
  await wait(`${options}.includes('Clear steel')`);
  const offered = await c.evaluate(options);
  for (const expected of ['Clear steel', 'Bridge electric', 'Basic keys', 'Import rig…'])
    assert.ok(offered.includes(expected), `the sheet does not offer ${expected}: ${offered.join(' · ')}`);
  assert.equal(await c.evaluate(`${select}.value`), 'design:clear-steel', 'a guitar part does not default to Clear steel');
  assert.match(await c.evaluate(`${sheet}.querySelector('.synth-link').textContent`), /Export part/);
  assert.equal(await c.evaluate(`${sheet}.querySelector('.synth-link a').getAttribute('href')`), '/synth/');

  // A factory design reaches the host.
  await choose('design:bridge-electric');
  await wait(`${backend}.setup.parts[0].instrument.design === 'bridge-electric'`);
  assert.ok(await listen() >= 1, 'Bridge electric played nothing');

  // A part rig, imported from a file, brings its chain.
  const input = await c.send('Runtime.evaluate', { expression: `${sheet}.querySelector('input[type=file][data-part="0"]')` });
  await c.send('DOM.setFileInputFiles', { files: [badFile], objectId: input.result.result.objectId });
  await wait(`/2 parts/.test(${sheet}.querySelector('.note.problem')?.textContent ?? '')`);
  await c.send('DOM.setFileInputFiles', { files: [rigFile], objectId: input.result.result.objectId });
  await wait(`${backend}.routing[0].source === 'rig'`);
  assert.deepEqual(JSON.parse(await c.evaluate(`JSON.stringify(${backend}.setup.parts[0].chain.map(b => b.type))`)), ['echo']);
  assert.equal(await c.evaluate(`${select}.value`), 'rig');
  assert.ok((await c.evaluate(options)).includes('Rig: Smoke rig'));
  assert.equal(await c.evaluate(`!!${sheet}.querySelector('.note.problem')`), false, 'the import problem outlived a good import');
  assert.ok(await listen() >= 1, 'the imported rig played nothing');

  // The retired old player offers nothing.
  assert.ok(!(await c.evaluate(options)).some(o => /^Synth$|Piano|Spanish|Fender|Martin|Shiny/.test(o)), 'old-player sounds are still offered');

  // Back to the rig, then reload: the choice is the person's, kept with the piece.
  await choose('design:soft-nylon');
  await wait(`${backend}.setup.parts[0].instrument.design === 'soft-nylon'`);
  await new Promise(r => setTimeout(r, 1500));
  await c.send('Page.reload');
  await wait(`(${player}?.performance?.sounding.length ?? 0) >= 3`);
  await openSheet();
  await wait(`${select}.value === 'design:soft-nylon'`);

  // ── Light sound: the synth at 32 kHz, kept on this device ───────────────────
  const soundButton = name => `[...${sheet}.querySelectorAll('.quality button')].find(b => b.querySelector('b').textContent === ${JSON.stringify(name)})`;
  const rate = `${backend}?.port?.context?.sampleRate`;
  await c.evaluate(`${soundButton('Light')}.click()`);
  await wait(`${soundButton('Light')}.getAttribute('aria-checked') === 'true'`);
  assert.ok(await listen() >= 1, 'Light played nothing');
  assert.equal(await c.evaluate(rate), 32000, 'Light does not play at 32 kHz');
  await c.send('Page.reload');
  await wait(`(${player}?.performance?.sounding.length ?? 0) >= 3`);
  await openSheet();
  await wait(`${soundButton('Light')}.getAttribute('aria-checked') === 'true'`);
  assert.ok(await listen() >= 1, 'Light played nothing after a reload');
  assert.equal(await c.evaluate(rate), 32000, 'Light was not kept across a reload');
  await c.evaluate(`${soundButton('Full')}.click()`);
  assert.ok(await listen() >= 1, 'Full played nothing');
  assert.notEqual(await c.evaluate(rate), 32000, 'Full still plays at 32 kHz');

  const shot = await c.send('Page.captureScreenshot'); await fs.writeFile('/tmp/mnx-studio-instruments.png', Buffer.from(shot.result.data, 'base64'));
  console.log('Studio instruments smoke passed: the sheet offers the synth’s designs, Basic keys and Import rig…; a design and an imported rig (with its chain) each reach the host and play; the old player’s sounds are gone; a two-part rig is refused with a reason; the choice survives a reload; Light plays at 32 kHz and is kept on the device.');
  if (c.logs.length) throw new Error('Browser console errors: ' + c.logs.join('\n'));
} finally {
  ws?.close(); await stopChrome(chrome);
  await fs.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await fs.rm(files, { recursive: true, force: true });
  await library.close();
}
