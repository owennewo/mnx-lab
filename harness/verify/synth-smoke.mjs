// The synth's shell, built and served as deployed (core-campaign-synth.md, Phase 2).
//
// Serves dist/client with the `/*` headers from public/_headers — the deployed CSP,
// read from the file, never restated — and runs the synth's own app flows
// (synth/tests/app-browser.mjs: lanes, effects, pieces and examples, Inspect checks in
// the Worker, saving, phone width, storage failures) against /synth/. The flows fail on
// any page error, and a CSP refusal is one, so this also proves the policy admits the
// synth's WebAssembly, AudioWorklet and Worker. Needs Chrome and `npm run build:site`.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'dist/client');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml'
};

/** The `/*` rule's headers, exactly as Workers Assets would apply them. */
function deployedHeaders() {
  const headers = {};
  let inRule = false;
  for (const line of fs.readFileSync(path.join(ROOT, 'public/_headers'), 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    if (!/^\s/.test(line)) { inRule = line.trim() === '/*'; continue; }
    const colon = line.indexOf(':');
    if (inRule && colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return headers;
}

function serve(headers) {
  const server = http.createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { ...headers, 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const chrome = process.env.CHROME_BIN && path.isAbsolute(process.env.CHROME_BIN)
  ? process.env.CHROME_BIN
  : execFileSync('which', [process.env.CHROME_BIN ?? 'google-chrome'], { encoding: 'utf8' }).trim();
const playwright = createRequire(path.join(ROOT, 'synth/package.json')).resolve('playwright-core').replace(/index\.js$/, 'index.mjs');

if (!fs.existsSync(path.join(DIST, 'synth/index.html'))) throw new Error('dist/client/synth/index.html missing — run `npm run build:site` first');
const headers = deployedHeaders();
if (!/'wasm-unsafe-eval'/.test(headers['Content-Security-Policy'] ?? '')) throw new Error("the deployed CSP does not admit WebAssembly ('wasm-unsafe-eval')");
const server = await serve(headers);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'synth-smoke-'));
try {
  const flows = spawn(process.execPath, [path.join(ROOT, 'synth/tests/app-browser.mjs')], {
    cwd: path.join(ROOT, 'synth'), stdio: 'inherit',
    env: { ...process.env, STUDIO_URL: `http://127.0.0.1:${server.address().port}/synth`, PLAYWRIGHT_MODULE: playwright, CHROME_PATH: chrome, APP_TEST_OUTPUT: out }
  });
  const code = await new Promise(resolve => flows.on('close', resolve));
  if (code !== 0) { console.error('synth smoke FAILED'); process.exitCode = 1; }
  else console.log('synth smoke passed: the app flows run on the built /synth/ under the deployed CSP');
} finally {
  server.close();
  fs.rmSync(out, { recursive: true, force: true });
}
