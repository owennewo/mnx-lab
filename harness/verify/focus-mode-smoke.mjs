// Document focus mode in a real browser, and the frame chrome's geometry with
// it — the pads' narrow pose rides along at the end, because it is the same
// kind of claim (a box lands where it should) and the same fixture already
// has a frame with its buttons in it.
//
// This is intentionally a smoke test rather than a DOM-shim unit: the contract
// is geometric (one main surface owns the viewport), the viewer repacks through
// ResizeObserver, and shadow-root chrome must actually disappear.
//
// Usage: npm run smoke:focus   (builds first)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'dist/client');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json; charset=utf-8'
};

let failures = 0;
const fail = message => {
  console.error(`  ✗ ${message}`);
  failures++;
};
const pass = message => console.log(`  ✓ ${message}`);
const check = (condition, message) => (condition ? pass(message) : fail(message));
const near = (actual, expected, tolerance = 1.5) => Math.abs(actual - expected) <= tolerance;

function serve(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, rel);
    // A directory serves its index.html; a miss is a 404, as Workers Assets
    // serves the deploy without an SPA fallback.
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(dir) || !fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  );
}

async function devtoolsPort(profileDir) {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 80; attempt++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
      if (port) return Number(port);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Chrome never reported a DevTools port (is CHROME_BIN correct?)');
}

async function connect(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(target => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('could not reach Chrome DevTools');
}

function client(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise(resolve => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.exception?.description ?? 'evaluate threw');
    }
    return result.result?.result?.value;
  };
  return { send, evaluate };
}

const DUMP = `(() => {
  const app = document.querySelector('mnx-workbench');
  const appRoot = app?.shadowRoot;
  const page = appRoot?.querySelector('mnx-scenario-page');
  const pageRoot = page?.shadowRoot;
  const viewer = pageRoot?.querySelector('mnx-document-viewer');
  // The score pane is the score frame (core-score-frame.md): its focus mark
  // on the pane's corner IS document focus here, the strips go with it, and
  // the pads hang pinned under the tools row's buttons.
  const frame = pageRoot?.querySelector('mnx-score-frame');
  const frameRoot = frame?.shadowRoot;
  const stripTop = frameRoot?.querySelector('.strip.top');
  const stripBottom = frameRoot?.querySelector('.strip.bottom');
  const score = frameRoot?.querySelector('.score');
  const focusControls = frameRoot?.querySelector('.focus-controls');
  const focusButton = frameRoot?.querySelector('.focus-mark');
  const playButton = frameRoot?.querySelector('.focus-play');
  const zoomPad = frameRoot?.querySelector('mnx-zoom-pad');
  const zoomRoot = zoomPad?.shadowRoot;
  const zoomFocus = zoomRoot?.querySelector('.focus-toggle');
  const rect = element => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const svg = viewer?.shadowRoot?.querySelector('svg');
  const focusItems = typeof app?.commandItems === 'function'
    ? app.commandItems('focus document').map(item => ({ label: item.label, hint: item.hint }))
    : [];
  const browserItems = typeof app?.commandItems === 'function'
    ? app.commandItems('browser fullscreen').map(item => ({ label: item.label, hint: item.hint }))
    : [];
  return JSON.stringify({
    hash: location.hash,
    viewport: { width: innerWidth, height: innerHeight },
    appFocus: app?.hasAttribute('document-focus') ?? false,
    pageFocus: page?.hasAttribute('document-focus') ?? false,
    header: !!appRoot?.querySelector('header'),
    nav: !!appRoot?.querySelector('nav'),
    navDisplay: appRoot?.querySelector('nav')
      ? getComputedStyle(appRoot.querySelector('nav')).display
      : null,
    panel: !!pageRoot?.querySelector('.panel'),
    frame: !!frame,
    frameRect: rect(frame),
    scoreRect: rect(score),
    scoreScrollbar: frame ? Number.parseFloat(getComputedStyle(frame).getPropertyValue('--score-scrollbar')) || 0 : 0,
    strips: !!stripTop && !!stripBottom,
    anyStrip: !!stripTop || !!stripBottom,
    focusControlsRect: rect(focusControls),
    focusControlsOpacity: focusControls ? Number(getComputedStyle(focusControls).opacity) : null,
    focusButton: !!focusButton,
    focusRect: rect(focusButton),
    focusOpacity: focusButton ? Number(getComputedStyle(focusButton).opacity) : null,
    focusShadow: focusButton ? getComputedStyle(focusButton).boxShadow : null,
    focusLabel: focusButton?.getAttribute('aria-label') ?? null,
    focusPressed: focusButton?.getAttribute('aria-pressed') ?? null,
    playButton: !!playButton,
    playRect: rect(playButton),
    playLabel: playButton?.getAttribute('aria-label') ?? null,
    playPressed: playButton?.getAttribute('aria-pressed') ?? null,
    playDisabled: playButton?.disabled ?? null,
    zoom: !!zoomPad,
    zoomPinned: zoomPad?.hasAttribute('pinned') ?? false,
    // The open pad's CARD, not the popover that holds it: in the narrow pose
    // the popover is the strip's width by design, so measuring it would prove
    // nothing about the card that overflowed.
    padRect: rect(frameRoot?.querySelector('.popover > *')?.shadowRoot?.querySelector('.card, .pad')),
    zoomFocus: !!zoomFocus,
    zoomValue: viewer?.zoom ?? null,
    spaceValue: viewer?.densityH ?? null,
    spacingMode: viewer?.spacingMode ?? null,
    inspector: !!pageRoot?.querySelector('mnx-rung-inspector'),
    appRect: rect(app),
    mainRect: rect(appRoot?.querySelector('main')),
    pageRect: rect(page),
    pageMainRect: rect(pageRoot?.querySelector('.main')),
    viewerRect: rect(viewer),
    documentHeading: viewer?.shadowRoot?.querySelector('.document-heading')?.textContent.trim() ?? null,
    viewBox: svg?.getAttribute('viewBox') ?? null,
    railPreference: localStorage.getItem('mnx-lab.rail-hidden'),
    panelPreference: localStorage.getItem('mnx-lab.panel-hidden'),
    fullscreenApi: typeof app?.requestFullscreen === 'function',
    fullscreenStateMatches:
      app?.browserFullscreen === (document.fullscreenElement !== null),
    focusItems,
    browserItems
  });
})()`;

let chrome;
let site;
try {
  if (!fs.existsSync(path.join(DIST, 'workbench/index.html'))) {
    throw new Error('dist/client/workbench/index.html missing — run `npm run build` first');
  }
  site = await serve(DIST);
  const profile = fs.mkdtempSync('/tmp/mnx-focus-smoke-');
  chrome = spawn(
    process.env.CHROME_BIN ?? 'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1280,720',
      `--user-data-dir=${profile}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );
  const ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(resolve => ws.addEventListener('open', resolve));
  const cdp = client(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      "localStorage.setItem('mnx-lab.rail-hidden','1');" +
      "localStorage.setItem('mnx-lab.panel-hidden','1');" +
      "localStorage.setItem('mnx-lab.staff-sp','1.2');" +
      "localStorage.setItem('mnx-lab.view','both');"
  });

  const url =
    `http://127.0.0.1:${site.port}/workbench/#/scenario/lab/document/twelve-bar-blues`;
  await cdp.send('Page.navigate', { url });
  await new Promise(resolve => setTimeout(resolve, 6500));

  const dump = async () => JSON.parse(await cdp.evaluate(DUMP));
  const press = async (key, code, keyCode, modifiers = 0, settleMs = 500) => {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', {
        type,
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        modifiers
      });
    }
    await new Promise(resolve => setTimeout(resolve, settleMs));
  };
  const focusKey = () => press('f', 'KeyF', 70, 3);
  const FRAME =
    "document.querySelector('mnx-workbench').shadowRoot" +
    ".querySelector('mnx-scenario-page').shadowRoot";
  const clickFrameFocus = async () => {
    await cdp.evaluate(`${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelector('.focus-mark').click()`);
    await new Promise(resolve => setTimeout(resolve, 400));
  };
  const clickFocusPlay = async () => {
    await cdp.evaluate(`${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelector('.focus-play').click()`);
    await new Promise(resolve => setTimeout(resolve, 400));
  };
  const openZoom = async () => {
    await cdp.evaluate(
      `[...${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelectorAll('.strip.top .btn')]` +
        ".find(b => b.getAttribute('aria-label') === 'Zoom').click()"
    );
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  let state = await dump();
  check(state.documentHeading === null, 'the hidden-title default omits the document heading');
  check(state.frame, 'the scenario page mounts the score frame');
  check(
    state.zoomValue === 1.2 && state.spaceValue === 2 && state.spacingMode === 'fill',
    'saved Staff wins while absent Space and alignment use 2sp and Fill width'
  );
  check(state.strips, 'at rest the frame shows both strips — the tools row and the tray');
  check(
    state.focusButton && state.focusPressed === 'false' && state.focusControlsOpacity < 0.5,
    'the focus mark sits on the pane, faded, not pressed'
  );
  check(
    state.focusRect && state.focusRect.y < 120 && state.focusRect.x + state.focusRect.width > state.viewport.width - 80,
    'the focus mark is at the top right of the pane'
  );
  check(
    state.focusRect && state.scoreRect && near(state.focusRect.y - state.scoreRect.y, 3) &&
      near(state.scoreRect.x + state.scoreRect.width - state.focusRect.x - state.focusRect.width, 3 + state.scoreScrollbar) &&
      near(state.focusRect.width, 40) && near(state.focusRect.height, 36) && state.focusShadow === 'none',
    'the focus mark has a clear 3px inset and trims 2px from each side of its former box'
  );
  check(!state.playButton, 'the full player tray leaves no duplicate play control at rest');
  check(
    state.focusItems.some(item => item.hint === 'Ctrl+Alt+F'),
    'the command palette exposes document focus with its shortcut'
  );
  check(
    !state.fullscreenApi ||
      state.browserItems.some(item => item.hint === 'F11 is browser-owned'),
    'browser fullscreen is a separate discoverable API action when supported'
  );
  check(state.fullscreenStateMatches, 'fullscreenchange state mirrors the browser-owned element');

  // The frame's focus mark (2026-09-15) is the one focus control, in normal
  // mode and inside focus alike; it took over from the strip's Focus button.
  check(state.focusLabel === 'Focus on the score', 'the mark offers to focus on the score');
  await clickFrameFocus();
  state = await dump();
  check(state.appFocus && state.pageFocus, 'the mark enters document focus');
  check(!state.anyStrip, 'focusing takes both strips away');
  check(
    state.focusLabel === 'Show the tools and the player' && state.focusPressed === 'true',
    'inside focus the same mark offers the way back, pressed'
  );
  check(
    state.playButton && !state.playDisabled && state.playLabel === 'Play' &&
      state.playRect.x + state.playRect.width < state.focusRect.x,
    'focus mode adds an enabled Play toggle immediately left of the focus mark'
  );
  await clickFocusPlay();
  state = await dump();
  check(state.playLabel === 'Pause' && state.playPressed === 'true', 'the focus-mode toggle starts playback and becomes Pause');
  await clickFocusPlay();
  state = await dump();
  check(state.playLabel === 'Play' && state.playPressed === 'false', 'the focus-mode toggle pauses playback and becomes Play');
  await focusKey();
  state = await dump();
  check(!state.appFocus && state.strips, 'Ctrl+Alt+F exits focus entered through the mark, and the strips return');

  await focusKey();
  state = await dump();
  check(state.appFocus && state.pageFocus, 'Ctrl+Alt+F reflects focus state on shell and page');
  check(
    !state.header && !state.nav && !state.panel && state.frame,
    'focus mode removes the shell panes but retains the score frame'
  );
  check(
    !state.anyStrip && state.focusRect?.height === 36 && state.focusRect.x + state.focusRect.width <= state.viewport.width - 3,
    'focus mode keeps both compact controls fully inside the pane'
  );
  await clickFrameFocus();
  state = await dump();
  check(!state.appFocus && state.strips, 'the mark leaves document focus');
  await openZoom();
  state = await dump();
  check(state.zoom && state.zoomPinned, 'Zoom in the tools row hangs the pad pinned under its button');
  check(!state.zoomFocus, 'the Zoom panel has no duplicate document-focus control');
  await focusKey();
  state = await dump();
  check(state.appFocus && !state.zoom, 'the focus shortcut enters document focus, and the pad goes with the tools row');
  check(
    state.railPreference === '1' && state.panelPreference === '1',
    'entering focus mode does not mutate remembered pane preferences'
  );
  console.log(
    '  focused geometry',
    JSON.stringify({ viewport: state.viewport, main: state.mainRect, page: state.pageRect,
      pageMain: state.pageMainRect, frame: state.frameRect, viewer: state.viewerRect, viewBox: state.viewBox })
  );
  // Focused, the strips are gone, so the pane — not just the frame — fills the viewport.
  for (const [name, rect] of [
    ['app', state.appRect],
    ['shell main', state.mainRect],
    ['scenario page', state.pageRect],
    ['scenario main', state.pageMainRect],
    ['score frame', state.frameRect],
    ['score pane', state.scoreRect]
  ]) {
    check(
      rect &&
        near(rect.x, 0) &&
        near(rect.y, 0) &&
        near(rect.width, state.viewport.width) &&
        near(rect.height, state.viewport.height),
      `${name} occupies the browser viewport in document focus`
    );
  }
  check(near(state.viewerRect.width, state.viewport.width), 'the document viewer spans the viewport width in document focus');

  const wideViewBox = state.viewBox;
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 820,
    height: 520,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise(resolve => setTimeout(resolve, 1300));
  state = await dump();
  check(
    near(state.viewerRect.width, 820) && near(state.scoreRect.width, 820) && near(state.scoreRect.height, 520),
    'the pane follows both width and height while focused, the viewer its width'
  );
  check(state.viewBox && state.viewBox !== wideViewBox, 'ResizeObserver repacks the rendered document');

  await cdp.evaluate(
    "document.querySelector('mnx-workbench').shadowRoot" +
      ".querySelector('mnx-scenario-page').shadowRoot" +
      ".querySelector('mnx-document-viewer').focus()"
  );
  await press('Enter', 'Enter', 13);
  state = await dump();
  check(state.appFocus && state.inspector, 'an invoked rung inspector remains usable in focus mode');
  await press('Escape', 'Escape', 27);
  state = await dump();
  check(state.appFocus && !state.inspector, 'closing the inspector returns to focused document-only rest');

  await focusKey();
  state = await dump();
  check(
    !state.appFocus &&
      state.header &&
      state.navDisplay === 'none' &&
      !state.panel &&
      state.railPreference === '1' &&
      state.panelPreference === '1',
    'the same shortcut restores the exact prior hidden-pane state'
  );

  await focusKey();
  await press('b', 'KeyB', 66, 2);
  state = await dump();
  check(
    !state.appFocus && state.navDisplay !== 'none' && state.railPreference === '0',
    'Ctrl+B exits focus and reveals the scenario rail immediately'
  );

  await focusKey();
  await press('b', 'KeyB', 66, 3);
  state = await dump();
  check(
    !state.appFocus && state.panel && state.panelPreference === '0',
    'Ctrl+Alt+B exits focus and reveals the document panel immediately'
  );

  await focusKey();
  await cdp.evaluate(
    "location.hash='#/scenario/lab/document/navigation-playground'"
  );
  await new Promise(resolve => setTimeout(resolve, 1200));
  state = await dump();
  check(state.appFocus && state.pageFocus, 'scenario-to-scenario navigation preserves document focus');

  await cdp.evaluate("location.hash='#/'");
  await new Promise(resolve => setTimeout(resolve, 700));
  state = await dump();
  check(!state.appFocus && state.header && state.nav, 'leaving scenario routes exits document focus');

  // ── a pad stays inside the frame at phone width ──
  // A pad hangs from its button's right edge and opens leftward, and in the
  // stacked tools row the spacer puts that edge wherever the host's actions
  // leave it — in studio, on a phone, ~245px in, under a settings card that
  // wants ~300. The difference hung off the LEFT EDGE of the screen, label
  // column first, because the card's own ceiling measured the viewport instead
  // of the room it actually had.
  //
  // The WORKBENCH's row cannot reproduce that symptom: its actions are one
  // icon, so its Settings button keeps enough room, and a wide action slotted
  // in to imitate studio's only wraps to the next line. So the check that
  // discriminates here is the POSE — below 560 a pad hangs from the strip and
  // lands on the frame's gutter, which is what makes the symptom unreachable
  // for any host. The two checks either side of it are the invariant itself,
  // slack in this host and exact in studio's.
  //
  // The workbench is not a phone shell, so the rail and the panel go first:
  // left up they take the width and the frame measures zero, which would let
  // the check below pass on nothing at all. The assertion on the frame's own
  // width is there to make that impossible.
  await cdp.evaluate("location.hash='#/scenario/lab/document/navigation-playground'");
  await new Promise(resolve => setTimeout(resolve, 900));
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise(resolve => setTimeout(resolve, 900));
  state = await dump();
  if (state.railPreference !== '1') await press('b', 'KeyB', 66, 2);
  if (state.panelPreference !== '1') await press('b', 'KeyB', 66, 3);
  await new Promise(resolve => setTimeout(resolve, 600));
  state = await dump();
  check(state.frameRect && state.frameRect.width >= 380, `the frame really is phone-wide ${JSON.stringify(state.frameRect)}`);
  await cdp.evaluate(
    `[...${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelectorAll('.strip.top .btn')]` +
      ".find(b => b.getAttribute('aria-label') === 'Settings').click()"
  );
  await new Promise(resolve => setTimeout(resolve, 400));
  state = await dump();
  check(
    state.padRect &&
      state.frameRect &&
      state.padRect.x >= state.frameRect.x &&
      state.padRect.x + state.padRect.width <= state.frameRect.x + state.frameRect.width,
    `the open settings card stays inside the frame at phone width ${JSON.stringify({ pad: state.padRect, frame: state.frameRect })}`
  );
  // And it is still the card, not a column of it: a fix that squeezed the
  // two-column grid until it fitted would pass the check above.
  check(
    state.padRect && state.padRect.width >= 240,
    `the card keeps its two-column width on a phone ${JSON.stringify(state.padRect)}`
  );
  // The mechanism, not just the symptom: below 560 the pad hangs from the
  // STRIP, so its right edge lands on the frame's gutter rather than on
  // whichever button it was docked under. This is the part no host can undo by
  // putting something wide beside it.
  check(
    state.padRect &&
      state.frameRect &&
      near(state.padRect.x + state.padRect.width, state.frameRect.x + state.frameRect.width - 8, 2),
    `the pad hangs from the strip, at the frame's gutter ${JSON.stringify(state.padRect)}`
  );

  ws.close();
  if (failures) process.exitCode = 1;
  else console.log('focus mode smoke OK');
} catch (error) {
  console.error(`focus mode smoke FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  chrome?.kill();
  site?.server.close();
}
