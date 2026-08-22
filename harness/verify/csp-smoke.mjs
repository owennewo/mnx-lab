// Does the built workbench actually run under the CSP we deploy?
//
// The policy exists because BYOK put an OpenRouter key in this origin's
// localStorage (core-assist-byok.md): `script-src 'self'` is what stands
// between an injected script and the user's credential. An untested CSP rots
// — the first dependency that wants a CDN, an eval or an inline handler
// breaks the deployed site and nothing here would have said so.
//
// The policy is READ FROM public/_headers, never restated, so this test and
// the deploy cannot drift. Then: serve dist/client with it, load the page in
// headless Chrome, and require three things.
//
//   1. Zero securitypolicyviolation events while the app boots and renders.
//   2. The app really rendered — otherwise a policy that blocks everything
//      would pass by silence.
//   3. The policy is ENFORCED, not merely present: a fetch to an origin the
//      policy does not name must be blocked. (CSP blocks it before the
//      network, so nothing leaves this machine.)
//
// Not part of `npm test`: it needs Chrome and a build, like smoke:embed.
// Run it with `npm run smoke:csp` after `npm run build`.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'dist/client');
const HEADERS_FILE = path.join(ROOT, 'public/_headers');

const fail = message => {
  console.error(`csp smoke FAILED: ${message}`);
  process.exitCode = 1;
};

/** The `/*` rule's headers, exactly as Workers Assets would apply them. */
function deployedHeaders() {
  const lines = fs.readFileSync(HEADERS_FILE, 'utf8').split('\n');
  const headers = {};
  let inRule = false;
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      inRule = line.trim() === '/*';
      continue;
    }
    if (!inRule) continue;
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return headers;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json; charset=utf-8'
};

function serve(dir, headers) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, rel === '/' ? 'index.html' : rel);
    // SPA fallback, matching wrangler's not_found_handling.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    if (!file.startsWith(dir)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { ...headers, 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ── CDP plumbing (no puppeteer: Node's global WebSocket is enough) ──────────
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
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const details = result.result?.exceptionDetails;
    if (details) throw new Error(details.exception?.description ?? 'evaluate threw');
    return result.result?.result?.value;
  };
  return { send, evaluate };
}

// The listener has to be installed BEFORE the document's own scripts run, or
// the violations we care about most (a blocked bundle) happen unobserved.
const COLLECTOR = `
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', e => {
    window.__cspViolations.push({
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: e.blockedURI,
      sample: e.sample || ''
    });
  });
`;

let chrome;
let site;

try {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/client/index.html missing — run `npm run build` first');
  }
  if (!fs.existsSync(path.join(DIST, '_headers'))) {
    throw new Error('dist/client/_headers missing — public/_headers did not reach the build output');
  }

  const headers = deployedHeaders();
  const csp = headers['Content-Security-Policy'];
  if (!csp) throw new Error('public/_headers declares no Content-Security-Policy for /*');
  console.log(`policy under test:\n  ${csp.replace(/; /g, '\n  ')}`);

  // The one directive the whole item depends on. Asserted textually here and
  // proved live below — a policy naming openrouter but not enforced, or
  // enforced but not naming it, both fail.
  if (!/connect-src[^;]*https:\/\/openrouter\.ai/.test(csp)) {
    fail('connect-src does not allow https://openrouter.ai — BYOK cannot reach the model provider');
  }
  if (/script-src[^;]*'unsafe-(inline|eval)'/.test(csp)) {
    fail("script-src carries 'unsafe-inline' or 'unsafe-eval' — the directive protecting the key is void");
  }

  site = await serve(DIST, headers);
  const pageUrl = `http://127.0.0.1:${site.port}/`;
  console.log(`serving dist/client at ${pageUrl}`);

  const profile = fs.mkdtempSync('/tmp/mnx-csp-smoke-');
  chrome = spawn(
    process.env.CHROME_BIN ?? 'google-chrome',
    ['--headless=new', '--remote-debugging-port=0', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' }
  );

  const ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(resolve => ws.addEventListener('open', resolve));
  const cdp = client(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: COLLECTOR });
  await cdp.send('Page.navigate', { url: pageUrl });
  await new Promise(r => setTimeout(r, 6000));

  // 1. Nothing the app does on boot violates the policy.
  const violations = (await cdp.evaluate('JSON.stringify(window.__cspViolations ?? [])')) ?? '[]';
  const parsed = JSON.parse(violations);
  if (parsed.length) {
    for (const v of parsed) console.error(`  violated ${v.directive}: ${v.blocked} ${v.sample}`);
    fail(`${parsed.length} CSP violation(s) while the workbench booted`);
  } else {
    console.log('no CSP violations during boot');
  }

  // 2. It really rendered — silence is not the same as success.
  const rendered = await cdp.evaluate(`
    (() => {
      const app = document.querySelector('mnx-workbench');
      if (!app || app.constructor.name === 'HTMLElement') return null;
      const roots = [app.shadowRoot];
      let seen = 0;
      while (roots.length && seen < 400) {
        const r = roots.shift();
        if (!r) continue;
        seen++;
        if (r.querySelector('svg')) return 'score';
        for (const el of r.querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
      }
      return app.shadowRoot?.textContent?.trim() ? 'shell' : null;
    })()
  `);
  if (!rendered) fail('<mnx-workbench> did not upgrade or rendered nothing — the bundle was probably blocked');
  else console.log(`app rendered (${rendered})`);

  // 3. The policy is live, not decorative: an unnamed origin must be refused.
  const blocked = await cdp.evaluate(`
    (async () => {
      const before = window.__cspViolations.length;
      try { await fetch('https://example.com/csp-probe'); } catch { /* expected */ }
      await new Promise(r => setTimeout(r, 250));
      return window.__cspViolations.slice(before).some(v => String(v.blocked).includes('example.com'));
    })()
  `);
  if (!blocked) fail('a fetch to an origin outside connect-src was NOT blocked — the CSP is not being enforced');
  else console.log('enforcement confirmed: an unnamed origin is refused by connect-src');

  ws.close();
  if (!process.exitCode) console.log('csp smoke OK');
} catch (error) {
  fail(error.message);
} finally {
  chrome?.kill();
  site?.server.close();
}
