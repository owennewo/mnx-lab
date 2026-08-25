// The selection overlay, driven in a real browser — the first test this layer
// has ever had, and the reason it needed one: three separate bugs put the
// selection box on the wrong beat, each invisible until the one in front of it
// was fixed (roadmap/complete/core-rung-insert.md).
//
// None of them could be caught headlessly. The overlay is drawn from the
// FINISHED SVG's geometry — `getBBox()` on rendered glyphs — so it needs a
// layout engine, not a DOM shim. Hence Chrome, and hence this being a `smoke:`
// script rather than part of `npm test`: the suite must keep running on a
// machine with no browser.
//
// Usage: npm run smoke:selection   (after npm run build)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'dist/client');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.map': 'application/json; charset=utf-8'
};

let failures = 0;
const fail = message => { console.error(`  ✗ ${message}`); failures++; };
const pass = message => console.log(`  ✓ ${message}`);

function serve(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function devtoolsPort(profileDir) {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 80; attempt++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
      if (port) return Number(port);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome never reported a DevTools port (is CHROME_BIN correct?)');
}

async function connect(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* still starting */ }
    await new Promise(r => setTimeout(r, 250));
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
  const send = (method, params = {}) => new Promise(resolve => {
    const messageId = ++id;
    pending.set(messageId, resolve);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    });
    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.exception?.description ?? 'evaluate threw');
    }
    return result.result?.result?.value;
  };
  return { send, evaluate };
}

/** The score SVG plus the geometry of everything this smoke test asserts on. */
/**
 * The tray's geometry, from inside the shadow root that owns it. Reported in
 * VIEWPORT coordinates, because "does it fit" is a question about the window
 * and nothing else.
 */
const TRAY = `(() => {
  const find = (root, depth) => {
    if (!root || depth > 12) return null;
    const hit = root.querySelector('mnx-selection-tray');
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      const deeper = el.shadowRoot && find(el.shadowRoot, depth + 1);
      if (deeper) return deeper;
    }
    return null;
  };
  const tray = find(document, 0);
  if (!tray) return JSON.stringify({ open: false });
  const box = tray.getBoundingClientRect();
  const grid = tray.shadowRoot?.querySelector('.grid');
  const captions = [...(tray.shadowRoot?.querySelectorAll('.caption') ?? [])]
    .map(el => el.textContent.trim());
  // The cursored tile, measured against the SCROLL PORT it lives in: the
  // cursor is virtual (a class, not focus), so nothing scrolls it into view
  // unless the tray does it by hand.
  const cursor = tray.shadowRoot?.querySelector('.tile.cursor');
  const view = grid?.getBoundingClientRect();
  const cbox = cursor?.getBoundingClientRect();
  return JSON.stringify({
    open: true,
    top: box.top, bottom: box.bottom, height: box.height,
    viewport: window.innerHeight,
    captions,
    grid: grid
      ? { scrollHeight: grid.scrollHeight, clientHeight: grid.clientHeight,
          scrollTop: grid.scrollTop, overflowY: getComputedStyle(grid).overflowY }
      : null,
    cursor: cursor && view && cbox
      ? { label: cursor.getAttribute('aria-label') ?? '',
          top: cbox.top - view.top, bottom: cbox.bottom - view.top,
          portHeight: view.height }
      : null
  });
})()`;

const DUMP = `(() => {
  const svgs = [];
  const walk = (root, depth) => {
    if (!root || depth > 12) return;
    for (const el of root.querySelectorAll('svg')) svgs.push(el);
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
  };
  walk(document, 0);
  const svg = svgs.map(s => ({ s, n: s.querySelectorAll('*').length }))
                  .sort((a, b) => b.n - a.n)[0]?.s;
  if (!svg) return JSON.stringify({ error: 'no score SVG on the page' });
  const box = el => { try { const b = el.getBBox(); return { x: b.x, w: b.width }; } catch { return null; } };
  const ink = sel => [...svg.querySelectorAll(sel)]
    .map(el => ({ cls: el.getAttribute('class'), id: el.getAttribute('data-source-id'), ...box(el) }));
  const view = svg.viewBox.baseVal;
  const staffLines = [...svg.querySelectorAll('line.staff-line')];
  return JSON.stringify({
    selected: ink('.selected'),
    rests: ink('.rest'),
    enclosure: [...svg.querySelectorAll('g[class*=enc-] rect')]
      .map(r => ({ x: +r.getAttribute('x'), w: +r.getAttribute('width') })),
    ghostPanels: [...svg.querySelectorAll('g.cursor-ghost rect[data-ghost-scope]')]
      .map(r => ({
        scope: r.dataset.ghostScope,
        x: +r.getAttribute('x'), w: +r.getAttribute('width'),
        y: +r.getAttribute('y'), h: +r.getAttribute('height')
      })),
    staffLines: staffLines.map(l => ({
      y: l.y1.baseVal.value,
      right: Math.max(l.x1.baseVal.value, l.x2.baseVal.value)
    })),
    viewRight: view.x + view.width
  });
})()`;

/** The viewer's scroll state and where the settled enclosure sits in it —
 *  the geometry behind "the selection stays in view". The SETTLED group, not
 *  the transition: mid-morph the tween's stand-in is still at the geometry
 *  the selection is leaving. */
const IN_VIEW = `(() => {
  const find = (root, depth) => {
    if (!root || depth > 12) return null;
    const hit = root.querySelector('mnx-score-viewer');
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) { const found = find(el.shadowRoot, depth + 1); if (found) return found; }
    }
    return null;
  };
  const viewer = find(document, 0);
  if (!viewer) return JSON.stringify({ error: 'no score viewer on the page' });
  const g = viewer.shadowRoot.querySelector('svg > g.enclosure:not(.enclosure-transition)');
  if (!g) return JSON.stringify({ error: 'nothing is enclosed — no selection to keep in view' });
  const box = g.getBoundingClientRect();
  const view = viewer.getBoundingClientRect();
  return JSON.stringify({
    scrollTop: viewer.scrollTop,
    overflows: viewer.scrollHeight > viewer.clientHeight + 1,
    box: { top: box.top, bottom: box.bottom },
    view: { top: view.top, bottom: view.bottom }
  });
})()`;

let chrome; let site;
try {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/client/index.html missing — run `npm run build` first');
  }
  site = await serve(DIST);
  const profile = fs.mkdtempSync('/tmp/mnx-selection-smoke-');
  chrome = spawn(
    process.env.CHROME_BIN ?? 'google-chrome',
    ['--headless=new', '--remote-debugging-port=0', '--disable-gpu', '--no-sandbox',
     `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' }
  );
  const ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(resolve => ws.addEventListener('open', resolve));
  const cdp = client(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  // A two-voice guitar part beside a bass part, in the combined view — the
  // shape that exposed all three bugs, because its voices stop sharing columns
  // the moment one of them gains an event.
  const url = `http://127.0.0.1:${site.port}/#/scenario/lab/document/twelve-bar-blues?view=both`;
  await cdp.send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 7000));

  const press = async (key, code, keyCode, settleMs = 700) => {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode });
    }
    await new Promise(r => setTimeout(r, settleMs));
  };

  console.log('insert a note, then delete it — the cursor lands on a rest mid-bar');
  await press('i', 'KeyI', 73);
  await press('Delete', 'Delete', 46);

  const state = JSON.parse(await cdp.evaluate(DUMP));
  if (state.error) throw new Error(state.error);

  const rest = state.selected.find(el => /\brest\b/.test(el.cls ?? ''));
  if (!rest) {
    fail('no rest is marked selected — the rest carries no identity, or none was made');
  } else {
    pass(`the rest is selected (${rest.id})`);
    if (state.enclosure.length === 0) fail('no enclosure was drawn at all');
    // THE ASSERTION. Every rect of the enclosure must bracket the rest it is
    // enclosing — on BOTH staves of the combined view, since the tab staff
    // draws no rest of its own and has to borrow its sibling's column.
    for (const [index, rect] of state.enclosure.entries()) {
      const brackets = rect.x <= rest.x + 0.5 && rect.x + rect.w >= rest.x + rest.w - 0.5;
      if (brackets) pass(`enclosure rect ${index} brackets the rest`);
      else fail(
        `enclosure rect ${index} is at ${rect.x.toFixed(1)}…${(rect.x + rect.w).toFixed(1)} ` +
        `but the rest is at ${rest.x.toFixed(1)}…${(rest.x + rest.w).toFixed(1)} ` +
        '— the box is on the wrong beat'
      );
    }
  }
  // THE GHOST BAR PAST THE END. `End` lands on the last bar and `→` walks off
  // the end of the score onto a bar that does not exist — the arrow must
  // ALWAYS do something there, and what it does must be visible. Written from
  // the same lesson as the assertions above: an overlay drawn from the
  // finished SVG's geometry can only be judged in a browser.
  console.log('\nwalk off the end of the score onto the ghost bar');
  await press('End', 'End', 35);
  const beforeGhost = JSON.parse(await cdp.evaluate(DUMP));
  for (let i = 0; i < 40; i++) await press('ArrowRight', 'ArrowRight', 39, 60);
  await new Promise(r => setTimeout(r, 700));

  const past = JSON.parse(await cdp.evaluate(DUMP));
  const panel = past.ghostPanels.find(rect => rect.scope === 'past-end');
  if (!panel) {
    fail('no past-end ghost panel was drawn — `→` past the last bar did nothing visible');
  } else {
    pass('the ghost bar is drawn past the end of the score');
    // It belongs to the RIGHT MARGIN of the LAST system — which is the one
    // the panel spans, and which is SHORTER than the systems above it, because
    // the last system is ragged rather than justified. Measuring against the
    // widest system would pass for the wrong reason.
    const systemRight = Math.max(0, ...past.staffLines
      .filter(line => line.y >= panel.y && line.y <= panel.y + panel.h)
      .map(line => line.right));
    if (panel.x >= systemRight) pass('it sits after the final barline');
    else fail(`the ghost panel starts at ${panel.x.toFixed(1)}, inside the last system (ends ${systemRight.toFixed(1)})`);
    if (panel.w > 0 && panel.x + panel.w <= past.viewRight + 0.5) pass('it stays inside the viewBox');
    else fail(`the ghost panel runs to ${(panel.x + panel.w).toFixed(1)}, past the viewBox edge ${past.viewRight.toFixed(1)}`);
    // It stands on a STAFF — the cursor's own — rather than floating in the
    // margin beside nothing.
    const onStaff = past.staffLines.filter(line => line.y >= panel.y && line.y <= panel.y + panel.h);
    if (onStaff.length >= 2) pass(`it stands on the cursor's staff (${onStaff.length} lines)`);
    else fail(`the ghost panel at y ${panel.y.toFixed(1)}…${(panel.y + panel.h).toFixed(1)} covers no staff`);
  }
  // Arriving on the ghost writes NOTHING: the bar materialises on a keystroke.
  if (past.rests.length === beforeGhost.rests.length) pass('arriving on the ghost changed no music');
  else fail(`the score grew on arrival: ${beforeGhost.rests.length} rests became ${past.rests.length}`);

  // And stepping back into the score clears it — the vacancy is a place the
  // cursor is standing, not a mark left on the page. This also puts a real
  // selection back on screen for the scroll assertions below, which read the
  // live page rather than a fresh load.
  await press('ArrowLeft', 'ArrowLeft', 37);
  const back = JSON.parse(await cdp.evaluate(DUMP));
  if (back.ghostPanels.some(rect => rect.scope === 'past-end')) {
    fail('the ghost bar is still drawn after stepping back into the score');
  } else {
    pass('stepping back into the score clears it');
  }
  // The viewer scrolls itself, so navigating off the visible systems used to
  // leave the reader looking at music they were no longer editing. Both
  // directions: the arithmetic reveals a selection below the fold and one
  // above it through different branches.
  console.log('the selection stays in view while moving about the score');
  const settle = async () => {
    // The scroll is smooth; let it arrive before measuring.
    await new Promise(r => setTimeout(r, 900));
    const state = JSON.parse(await cdp.evaluate(IN_VIEW));
    if (state.error) throw new Error(state.error);
    return state;
  };
  const inView = (state, where) => {
    if (state.box.top >= state.view.top && state.box.bottom <= state.view.bottom) {
      pass(`the selection is on screen ${where}`);
    } else {
      fail(
        `the selection is off screen ${where}: it sits at ` +
        `${state.box.top.toFixed(0)}…${state.box.bottom.toFixed(0)} ` +
        `in a viewport of ${state.view.top.toFixed(0)}…${state.view.bottom.toFixed(0)}`
      );
    }
  };

  // ZOOMED IN, because that is the only condition under which this can go
  // wrong: at the fitted scale the engraving is drawn to the pane it has, so
  // the selection cannot leave a viewport the whole score already fits inside.
  // Raise the staff scale and the paper outgrows the pane — which is exactly
  // when a reader is moving about a score bar by bar and needs the thing they
  // are editing to still be on screen.
  await cdp.evaluate("localStorage.setItem('mnx-lab.staff-scale', '3'); true");
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1400, height: 500, deviceScaleFactor: 1, mobile: false
  });
  await cdp.send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 7000));

  const before = await settle();
  if (!before.overflows) {
    fail('the score fits the viewport — this case asserts nothing about scrolling');
  } else {
    await press('End', 'End', 35);
    const atEnd = await settle();
    if (atEnd.scrollTop <= before.scrollTop) {
      fail(`End reached the last bar but the viewer never scrolled (${atEnd.scrollTop})`);
    } else {
      pass(`the viewer followed the selection down (scrollTop ${atEnd.scrollTop.toFixed(0)})`);
    }
    inView(atEnd, 'at the last bar');

    await press('Home', 'Home', 36);
    const atStart = await settle();
    if (atStart.scrollTop >= atEnd.scrollTop) {
      fail('Home reached the first bar but the viewer never scrolled back');
    } else {
      pass('the viewer followed the selection back up');
    }
    inView(atStart, 'at the first bar');
  }
  // ── the tray fits the window it is drawn in ───────────────────────────
  //
  // Banding the rungs (core-selection-tray-structure-band) turned the note
  // rung from a flat grid of 19 tiles into six captioned bands of 22, and the
  // tray — which had no height bound at all — grew straight off the screen.
  // A layout bug, so a real browser is the only thing that can see it.
  console.log('\nthe command tray fits the window, however many tiles a rung has');
  {
    // Small enough that the tallest rung cannot possibly fit whole.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 520, deviceScaleFactor: 1, mobile: false
    });
    await new Promise(r => setTimeout(r, 800));
    await press('Home', 'Home', 36);
    await press('/', 'Slash', 191, 1200); // the tray's own key

    const tray = JSON.parse(await cdp.evaluate(TRAY));
    if (!tray.open) {
      fail('the tray never opened, so this case asserts nothing');
    } else {
      // THE assertion, and it is checked first so an unbounded tray reports
      // the thing that is actually wrong. Every other line here explains HOW
      // it fits; this one is whether it does.
      if (tray.top < 0 || tray.bottom > tray.viewport) {
        fail(
          `the tray runs off the window: ${tray.top.toFixed(0)}…${tray.bottom.toFixed(0)} ` +
          `(${tray.height.toFixed(0)}px tall) in a window of 0…${tray.viewport}`
        );
      } else {
        pass(`it stays inside the window (${tray.top.toFixed(0)}…${tray.bottom.toFixed(0)})`);
      }
      // …and it fits by SCROLLING, not by the rung happening to be short. The
      // viewport above is small enough that the note rung cannot fit whole, so
      // a panel that is not overflowing means the cap never engaged.
      if (tray.grid?.scrollHeight <= tray.grid?.clientHeight) {
        fail(
          `the panel is not overflowing (${tray.grid?.scrollHeight} in ` +
          `${tray.grid?.clientHeight}) — the height cap never engaged`
        );
      } else {
        pass(`the rung overflows its panel (${tray.grid.scrollHeight} into ${tray.grid.clientHeight})`);
      }
      if (tray.grid && tray.grid.overflowY !== 'auto' && tray.grid.overflowY !== 'scroll') {
        fail(`the tiles are not the scrolling body (overflow-y: ${tray.grid.overflowY})`);
      } else {
        pass('the tiles are the one scrolling body');
      }
      if (tray.captions.length === 0) fail('no band captions — the rung is not banded');
      else pass(`${tray.captions.length} bands drawn (${tray.captions[0]} first)`);
    }

    // ── walking below the fold brings the cursor with it ───────────────
    console.log('\nthe tile cursor stays visible when it walks below the fold');
    {
      const seen = [];
      let offScreen = null;
      // Down the whole rung: 22 tiles at the note rung, far more rows than a
      // 111px port can hold, so this crosses the fold several times.
      for (let step = 0; step < 12 && !offScreen; step++) {
        await press('ArrowDown', 'ArrowDown', 40, 220);
        const at = JSON.parse(await cdp.evaluate(TRAY));
        if (!at.open || !at.cursor) break;
        seen.push(at.grid.scrollTop);
        if (at.cursor.top < -0.5 || at.cursor.bottom > at.cursor.portHeight + 0.5) {
          offScreen = at;
        }
      }
      if (offScreen) {
        fail(
          `the cursor left the panel on “${offScreen.cursor.label}”: ` +
          `${offScreen.cursor.top.toFixed(0)}…${offScreen.cursor.bottom.toFixed(0)} ` +
          `in a port of 0…${offScreen.cursor.portHeight.toFixed(0)}`
        );
      } else if (!seen.some(top => top > 0)) {
        fail('the panel never scrolled — this case never reached the fold');
      } else {
        pass(`the panel followed the cursor down (scrollTop ${Math.max(...seen).toFixed(0)})`);
        pass('the cursored tile stayed inside the panel the whole way');
      }
    }

    // ── and choosing a tile puts it away ────────────────────────────────
    console.log('\nchoosing a tile dismisses the tray');
    await press('Enter', 'Enter', 13, 1200);
    const after = JSON.parse(await cdp.evaluate(TRAY));
    if (after.open) fail('the tray is still up after firing a command');
    else pass('the tray closed, so the score it covers is visible again');
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }
} catch (error) {
  fail(error.message);
} finally {
  chrome?.kill();
  site?.server.close();
}

if (failures > 0) {
  console.error(`\nselection smoke: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nselection smoke: OK');
