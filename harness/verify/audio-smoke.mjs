// Permanent native-sink OfflineAudioContext smoke; requires google-chrome.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-audio-smoke-'));
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'audio-probe-page',
      configureServer(s) {
        s.middlewares.use('/audio-smoke.html', (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><title>Offline audio smoke</title>');
        });
      },
    },
  ],
});
let chrome, ws;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  chrome = spawn(
    process.env.CHROME_BIN ?? 'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--disable-gpu',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const deadline = Date.now() + 20000;
  let debugging;
  while (Date.now() < deadline) {
    const file = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(file)) {
      debugging = Number(fs.readFileSync(file, 'utf8').split('\n')[0]);
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!debugging) throw new Error('Chrome did not expose its test port.');
  const targets = await (await fetch(`http://127.0.0.1:${debugging}/json`)).json();
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(new Error(`${method} timed out`));
      }, 30000);
      pending.set(key, (m) => {
        clearTimeout(timer);
        resolve(m);
      });
      ws.send(JSON.stringify({ id: key, method, params }));
    });
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/audio-smoke.html` });
  // Wait on the document origin, not a fixed rendering sleep.
  for (let i = 0; i < 100; i++) {
    const r = await send('Runtime.evaluate', {
      expression: 'location.pathname',
      returnByValue: true,
    });
    if (r.result?.result?.value === '/audio-smoke.html') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const response = await send('Runtime.evaluate', {
    expression: 'import("/harness/browser/audio-smoke.ts").then(m=>m.runAudioSmoke())',
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.error || response.result?.exceptionDetails)
    throw new Error(JSON.stringify(response.error ?? response.result.exceptionDetails));
  console.log('Offline audio smoke OK', JSON.stringify(response.result.result.value, null, 2));
} finally {
  ws?.close();
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill('SIGTERM');
    await exited;
  }
  await server.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
