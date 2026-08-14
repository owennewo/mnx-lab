// Smoke test for the EMBED build face (roadmap/proposed/core-viewer-embedded-app.md).
// The sibling of lib-smoke.mjs: that one proves `mnx-lab/engine` renders in
// Node, this one proves `dist/embed/mnx-lab.js` renders in a BROWSER, on a
// host page that does nothing but include it.
//
// TWO ORIGINS, ON PURPOSE. The artifact is served from one port and the host
// page from another, because same-origin is the trap `embed.html` fell into:
// it is served from the workbench's own origin, where `/smufl` happens to
// exist, so it could never catch the component fetching its metadata from the
// HOST's root. Under two origins that bug fails loudly — which is the whole
// point of this file.
//
// SMOKE, NOT GOLDEN. Never compare against expected.svg: the corpus goldens
// are computed at a fixed WIDTH_SP viewport while a browser embed goes through
// fitPxPerSp, so exact match is the wrong oracle and would manufacture false
// demotions. Structural assertions only.
//
// Run: npm run smoke:embed  (builds the artifact first)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const ARTIFACT_DIR = path.join(ROOT, 'dist/embed');
const APP_DIR = path.join(ROOT, 'apps/viewer-embedded');

const fail = message => {
  console.error(`embed smoke FAILED: ${message}`);
  process.exitCode = 1;
};

// ── CDP plumbing (no puppeteer: Node's global WebSocket is enough) ──────────
/** Chrome writes the port it actually bound to into the profile directory —
 *  read it rather than guessing, so a busy port can never flake the test. */
async function devtoolsPort(profileDir) {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 60; attempt++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
      if (port) return Number(port);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome never reported a DevTools port (is CHROME_BIN correct?)');
}

async function connect(port) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* chrome still starting */
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('could not reach Chrome DevTools');
}

function client(ws) {
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    // Console errors and uncaught exceptions are failures: a host page that
    // has to tolerate red console noise has not really been served.
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      logs.push(message.params.args.map(a => a.value ?? a.description).join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      logs.push(message.params.exceptionDetails.exception?.description ?? 'exception');
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
    const details = result.result?.exceptionDetails;
    if (details) throw new Error(details.exception?.description ?? 'evaluate threw');
    return result.result?.result?.value;
  };
  return { send, evaluate, logs };
}

// ── The test ────────────────────────────────────────────────────────────────
const chromeBin = process.env.CHROME_BIN ?? 'google-chrome';
let chrome;
let artifact;
let host;

try {
  execFileSync('node', ['-e', '0']); // sanity: node works
  if (!fs.existsSync(path.join(ARTIFACT_DIR, 'mnx-lab.esm.js'))) {
    throw new Error('dist/embed/mnx-lab.esm.js missing — run npm run build:embed');
  }
  if (!fs.existsSync(path.join(ARTIFACT_DIR, 'smufl/glyphnames.json'))) {
    throw new Error(
      'dist/embed/smufl/ missing — the artifact must ship its own assets (vite.embed.config.ts)'
    );
  }

  artifact = await serveStatic(ARTIFACT_DIR);
  host = await serveStatic(APP_DIR);
  const artifactBase = `http://127.0.0.1:${artifact.port}`;
  const pageUrl = `http://127.0.0.1:${host.port}/index.html?base=${encodeURIComponent(artifactBase)}`;
  console.log(`artifact origin ${artifactBase} · host origin http://127.0.0.1:${host.port}`);

  const profile = fs.mkdtempSync('/tmp/mnx-embed-smoke-');
  chrome = spawn(
    chromeBin,
    [
      '--headless=new',
      '--remote-debugging-port=0', // 0 = let the OS pick; read it back below
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${profile}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  const wsUrl = await connect(await devtoolsPort(profile));
  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  const cdp = client(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: pageUrl });
  await new Promise(r => setTimeout(r, 6000));

  // 1. The custom element upgraded — the artifact loaded and registered.
  const upgraded = await cdp.evaluate(
    `!!customElements.get('mnx-score-viewer') && document.getElementById('viewer').constructor.name !== 'HTMLElement'`
  );
  if (!upgraded) fail('<mnx-score-viewer> did not upgrade (artifact failed to load/register)');

  // 2. SMuFL resolved FROM THE ARTIFACT'S OWN ORIGIN. The host serves no
  // /smufl, so a rendered stave proves the self-locating base worked.
  const svg = await cdp.evaluate(`
    (() => {
      const v = document.getElementById('viewer');
      const svg = v?.shadowRoot?.querySelector('svg');
      if (!svg) return null;
      return JSON.stringify({
        viewBox: svg.getAttribute('viewBox') ?? '',
        glyphs: svg.querySelectorAll('text').length,
        lines: svg.querySelectorAll('line, rect').length
      });
    })()
  `);
  if (!svg) {
    fail('no SVG rendered inside the viewer');
  } else {
    const { viewBox, glyphs, lines } = JSON.parse(svg);
    if (!viewBox || viewBox.split(/\s+/).length !== 4) fail(`viewBox missing or malformed: "${viewBox}"`);
    if (glyphs < 5) fail(`too few glyphs rendered (${glyphs}) — SMuFL metadata probably did not load`);
    if (lines < 5) fail(`too few staff primitives (${lines})`);
    console.log(`rendered: viewBox="${viewBox}", ${glyphs} glyphs, ${lines} staff primitives`);
  }

  // 3. The font was registered BY THE ARTIFACT — the host page declares none.
  const fontRegistered = await cdp.evaluate(
    `[...document.fonts].some(f => f.family === 'Bravura')`
  );
  if (!fontRegistered) fail('Bravura was not registered by the artifact (host declares no @font-face)');

  // 4. Two viewers on one page — the case nothing else covers.
  const second = await cdp.evaluate(`
    (async () => {
      const first = document.getElementById('viewer');
      const clone = document.createElement('mnx-score-viewer');
      clone.style.height = '300px';
      document.querySelector('main').append(clone);
      clone.mnxDoc = first.mnxDoc;
      await new Promise(r => setTimeout(r, 1500));
      return {
        rendered: !!clone.shadowRoot?.querySelector('svg'),
        fonts: [...document.fonts].filter(f => f.family === 'Bravura').length
      };
    })()
  `);
  if (!second?.rendered) fail('a second viewer on the same page did not render');
  if (second && second.fonts > 1) fail(`Bravura registered ${second.fonts} times — registration is not idempotent`);

  // 5. No console errors anywhere in the run.
  if (cdp.logs.length > 0) fail(`console errors: ${cdp.logs.slice(0, 3).join(' | ')}`);

  ws.close();
  if (!process.exitCode) console.log('embed smoke OK');
} catch (error) {
  fail(error.message);
} finally {
  chrome?.kill();
  artifact?.server.close();
  host?.server.close();
}
