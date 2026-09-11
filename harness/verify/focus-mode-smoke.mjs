// Document focus mode in a real browser.
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
  // The score pane is the score frame (core-score-frame.md): the focus button
  // is in its top strip, the pads hang pinned under the strip's buttons, and
  // the grips stay on the pane's edges in every mode.
  const frame = pageRoot?.querySelector('mnx-score-frame');
  const frameRoot = frame?.shadowRoot;
  const gripTop = frameRoot?.querySelector('.grip.top');
  const gripBottom = frameRoot?.querySelector('.grip.bottom');
  const stripTop = frameRoot?.querySelector('.strip.top');
  const score = frameRoot?.querySelector('.score');
  const focusButton = pageRoot?.querySelector('button[slot=actions]');
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
    gripTopRect: rect(gripTop),
    gripBottomRect: rect(gripBottom),
    stripOpen: !!stripTop,
    focusButton: !!focusButton,
    focusLabel: focusButton?.textContent.trim() ?? null,
    focusPressed: focusButton?.getAttribute('aria-pressed') ?? null,
    zoom: !!zoomPad,
    zoomPinned: zoomPad?.hasAttribute('pinned') ?? false,
    zoomFocusLabel: zoomFocus?.getAttribute('aria-label') ?? null,
    zoomFocusPressed: zoomFocus?.getAttribute('aria-pressed') ?? null,
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
      "localStorage.setItem('mnx-lab.staff-scale','1.2');" +
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
  const drawOutTop = async () => {
    await cdp.evaluate(`${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelector('.grip.top')?.click()`);
    await new Promise(resolve => setTimeout(resolve, 300));
  };
  const clickFrameFocus = async () => {
    await drawOutTop();
    await cdp.evaluate(`${FRAME}.querySelector('button[slot=actions]').click()`);
    await new Promise(resolve => setTimeout(resolve, 400));
  };
  const openZoom = async () => {
    await drawOutTop();
    await cdp.evaluate(
      `[...${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelectorAll('.strip.top .btn')]` +
        ".find(b => b.textContent.includes('Zoom')).click()"
    );
    await new Promise(resolve => setTimeout(resolve, 300));
  };
  const clickZoomFocus = async () => {
    await cdp.evaluate(
      `${FRAME}.querySelector('mnx-score-frame').shadowRoot` +
        ".querySelector('mnx-zoom-pad').shadowRoot" +
        ".querySelector('.focus-toggle').click()"
    );
    await new Promise(resolve => setTimeout(resolve, 400));
  };

  let state = await dump();
  check(
    state.documentHeading === 'Twelve-bar blues — the realistic navigation instrument',
    'the workbench supplies the scenario name as the document heading fallback'
  );
  check(state.frame, 'the scenario page mounts the score frame');
  check(
    state.gripTopRect?.height > 0 && state.gripBottomRect?.height >= 44 && !state.stripOpen,
    'at rest the frame shows its two grips and no strip'
  );
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

  // The focus button lives in the frame's top strip (2026-09-12), beside Zoom
  // and Settings — the one focus button, in normal mode and inside focus alike.
  await drawOutTop();
  state = await dump();
  check(state.stripOpen && state.focusButton && state.focusLabel === 'Focus', 'the drawn-out top strip exposes the document-focus button');
  await clickFrameFocus();
  state = await dump();
  check(state.appFocus && state.pageFocus, 'the strip\'s focus button enters document focus');
  check(state.focusLabel === 'Unfocus' && state.focusPressed === 'true', 'inside focus the same button reads Unfocus, pressed');
  await focusKey();
  state = await dump();
  check(!state.appFocus, 'Ctrl+Alt+F exits focus entered through the button');

  await focusKey();
  state = await dump();
  check(state.appFocus && state.pageFocus, 'Ctrl+Alt+F reflects focus state on shell and page');
  check(
    !state.header && !state.nav && !state.panel && state.frame,
    'focus mode removes the shell panes but retains the score frame'
  );
  check(
    state.gripBottomRect?.height >= 44 && state.gripBottomRect.y + state.gripBottomRect.height <= state.viewport.height + 1,
    'the pause grip stays on the bottom edge in focus mode'
  );
  check(
    state.stripOpen ? state.focusLabel === 'Unfocus' : state.gripTopRect?.height > 0,
    'focus mode keeps its way out on screen — the strip\'s Unfocus, or the grip that draws it'
  );
  await openZoom();
  state = await dump();
  check(state.zoom && state.zoomPinned, 'Zoom in the strip hangs the pad pinned under its button');
  check(
    state.zoomFocusLabel === 'Exit document focus' && state.zoomFocusPressed === 'true',
    'the pinned zoom pad still carries its state-aware exit from document focus'
  );
  await clickZoomFocus();
  state = await dump();
  check(!state.appFocus, 'the zoom-pad control exits document focus without the shortcut');
  await clickFrameFocus();
  state = await dump();
  check(state.appFocus && state.focusLabel === 'Unfocus', 'the strip\'s button re-enters document focus');
  check(
    state.railPreference === '1' && state.panelPreference === '1',
    'entering focus mode does not mutate remembered pane preferences'
  );
  console.log(
    '  focused geometry',
    JSON.stringify({ viewport: state.viewport, main: state.mainRect, page: state.pageRect,
      pageMain: state.pageMainRect, frame: state.frameRect, viewer: state.viewerRect, viewBox: state.viewBox })
  );
  // The strip is in flow above the pane, so with it drawn out the frame — not
  // the viewer — is what fills the viewport; put it away for the geometry check.
  await cdp.evaluate(`${FRAME}.querySelector('mnx-score-frame').shadowRoot.querySelector('.strip.top .btn.ghost').click()`);
  await new Promise(resolve => setTimeout(resolve, 400));
  state = await dump();
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
