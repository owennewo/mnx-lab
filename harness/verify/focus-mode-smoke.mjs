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
    let file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
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
  const zoomPad = pageRoot?.querySelector('mnx-zoom-pad');
  const zoomRoot = zoomPad?.shadowRoot;
  const zoomControl = zoomRoot?.querySelector('.pad');
  const zoomReadout = zoomRoot?.querySelector('.readout');
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
    pageHead: !!pageRoot?.querySelector('.head'),
    panel: !!pageRoot?.querySelector('.panel'),
    zoom: !!zoomPad,
    zoomRect: rect(zoomPad),
    zoomControlRect: rect(zoomControl),
    zoomExpanded: zoomControl?.classList.contains('expanded') ?? false,
    zoomReadoutRect: rect(zoomReadout),
    zoomReadoutOpacity: zoomReadout ? Number(getComputedStyle(zoomReadout).opacity) : null,
    zoomFocusRect: rect(zoomFocus),
    zoomFocusLabel: zoomFocus?.getAttribute('aria-label') ?? null,
    zoomFocusPressed: zoomFocus?.getAttribute('aria-pressed') ?? null,
    popover: !!pageRoot?.querySelector('.popover-layer'),
    focusButton: !!pageRoot?.querySelector('.focus-toggle'),
    appRect: rect(app),
    mainRect: rect(appRoot?.querySelector('main')),
    pageRect: rect(page),
    pageMainRect: rect(pageRoot?.querySelector('.main')),
    viewerRect: rect(viewer),
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
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/client/index.html missing — run `npm run build` first');
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
      "localStorage.setItem('mnx-lab.staff-scale','1.2');"
  });

  const url =
    `http://127.0.0.1:${site.port}/#/scenario/lab/document/twelve-bar-blues?view=both`;
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
  const clickZoomFocus = async () => {
    await cdp.evaluate(
      "document.querySelector('mnx-workbench').shadowRoot" +
        ".querySelector('mnx-scenario-page').shadowRoot" +
        ".querySelector('mnx-zoom-pad').shadowRoot" +
        ".querySelector('.focus-toggle').click()"
    );
    await new Promise(resolve => setTimeout(resolve, 400));
  };
  const hoverZoomFocus = async focusRect => {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: focusRect.x + focusRect.width / 2,
      y: focusRect.y + focusRect.height / 2
    });
    await new Promise(resolve => setTimeout(resolve, 300));
  };
  const movePointer = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  let state = await dump();
  check(state.focusButton, 'normal mode exposes the document-focus button');
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

  await cdp.evaluate(
    "document.querySelector('mnx-workbench').shadowRoot" +
      ".querySelector('mnx-scenario-page').shadowRoot" +
      ".querySelector('.focus-toggle').click()"
  );
  await new Promise(resolve => setTimeout(resolve, 400));
  state = await dump();
  check(state.appFocus && state.pageFocus, 'the normal-mode focus button enters document focus');
  await focusKey();
  state = await dump();
  check(!state.appFocus, 'Ctrl+Alt+F exits focus entered through the button');

  await focusKey();
  state = await dump();
  check(state.appFocus && state.pageFocus, 'Ctrl+Alt+F reflects focus state on shell and page');
  check(
    !state.header && !state.nav && !state.pageHead && !state.panel && state.zoom,
    'focus mode removes the shell panes but retains the document zoom pad'
  );
  check(
    state.zoomRect?.width > 0 && state.zoomRect?.height > 0,
    'the retained zoom pad is visibly laid out in focus mode'
  );
  check(
    state.zoomFocusLabel === 'Exit document focus' && state.zoomFocusPressed === 'true',
    'the zoom pad carries a permanent, state-aware exit from document focus'
  );
  check(
    state.zoomFocusRect.x + state.zoomFocusRect.width <= state.zoomControlRect.x,
    'the document-focus toggle sits to the left of the collapsed zoom mark'
  );
  check(
    near(state.zoomControlRect.width, state.zoomControlRect.height) &&
      state.zoomReadoutRect.width < 1 &&
      state.zoomReadoutOpacity === 0,
    'the off-default zoom control idles as a square with no numeric readout'
  );
  const restingFocusRect = state.zoomFocusRect;
  const restingZoomRect = state.zoomControlRect;
  await hoverZoomFocus(restingFocusRect);
  state = await dump();
  check(
    !state.zoomExpanded &&
      near(state.zoomFocusRect.x, restingFocusRect.x) &&
      near(state.zoomFocusRect.y, restingFocusRect.y) &&
      near(state.zoomControlRect.width, restingZoomRect.width) &&
      near(state.zoomControlRect.height, restingZoomRect.height),
    'hovering the focus toggle neither opens zoom nor moves either control'
  );
  await movePointer(
    state.zoomControlRect.x + state.zoomControlRect.width / 2,
    state.zoomControlRect.y + state.zoomControlRect.height / 2
  );
  state = await dump();
  check(
    state.zoomExpanded && state.zoomReadoutRect.width >= 59 && state.zoomReadoutOpacity === 1,
    'hovering zoom restores the STAFF and SPACE readout'
  );
  await movePointer(0, 0);
  state = await dump();
  check(
    !state.zoomExpanded &&
      near(state.zoomControlRect.width, state.zoomControlRect.height) &&
      state.zoomReadoutRect.width < 1,
    'leaving zoom returns it to the numberless square'
  );
  await clickZoomFocus();
  state = await dump();
  check(
    !state.appFocus && state.zoomFocusLabel === 'Focus document',
    'the zoom-pad control exits document focus without the shortcut'
  );
  await clickZoomFocus();
  state = await dump();
  check(
    state.appFocus && state.zoomFocusLabel === 'Exit document focus',
    'the same zoom-pad control re-enters document focus'
  );
  check(
    state.railPreference === '1' && state.panelPreference === '1',
    'entering focus mode does not mutate remembered pane preferences'
  );
  console.log(
    '  focused geometry',
    JSON.stringify({ viewport: state.viewport, main: state.mainRect, page: state.pageRect,
      pageMain: state.pageMainRect, viewer: state.viewerRect, viewBox: state.viewBox })
  );
  for (const [name, rect] of [
    ['app', state.appRect],
    ['shell main', state.mainRect],
    ['scenario page', state.pageRect],
    ['scenario main', state.pageMainRect],
    ['document viewer', state.viewerRect]
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
    near(state.viewerRect.width, 820) && near(state.viewerRect.height, 520),
    'viewer follows both width and height while focused'
  );
  check(state.viewBox && state.viewBox !== wideViewBox, 'ResizeObserver repacks the rendered document');

  await cdp.evaluate(
    "document.querySelector('mnx-workbench').shadowRoot" +
      ".querySelector('mnx-scenario-page').shadowRoot" +
      ".querySelector('mnx-document-viewer').focus()"
  );
  await press('K', 'KeyK', 75, 8);
  state = await dump();
  check(state.appFocus && state.popover, 'an invoked setup popover remains usable in focus mode');
  await press('Escape', 'Escape', 27);
  state = await dump();
  check(state.appFocus && !state.popover, 'closing the popover returns to focused document-only rest');

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
    "location.hash='#/scenario/lab/document/navigation-playground?view=notation'"
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
