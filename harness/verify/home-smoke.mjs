// The home page (/) and the licences and notices page (/notices/) on the built site
// (core-campaign-synth.md, Phase 3). Serves dist/client as Workers Assets would (a directory
// serves its index.html, no SPA fallback) and requires: the home page links studio, the synth,
// the workbench and the notices page; every same-origin link on both pages resolves; the
// notices page lists every licence text. No browser: the pages carry no script.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'dist/client');
const fail = message => { console.error(`home smoke FAILED: ${message}`); process.exitCode = 1; };

const server = http.createServer((req, res) => {
  let file = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200).end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
try {
  const home = await (await fetch(`${base}/`)).text();
  for (const required of ['/studio/', '/synth/', '/workbench/', '/notices/'])
    if (!links(home).includes(required)) fail(`the home page does not link ${required}`);
  const notices = await fetch(`${base}/notices/`);
  if (notices.status !== 200) fail(`/notices/ answered ${notices.status}`);
  const page = await notices.text();
  for (const text of fs.readdirSync(path.join(ROOT, 'public/licenses')).filter(f => f !== 'AGPL-3.0.txt'))
    if (!links(page).includes(`/licenses/${text}`)) fail(`the notices page does not link /licenses/${text}`);
  const local = [...new Set([...links(home), ...links(page)].filter(href => href.startsWith('/')))];
  for (const href of local) {
    const status = (await fetch(base + href)).status;
    if (status !== 200) fail(`${href} answered ${status}`);
  }
  if (!process.exitCode) console.log(`home smoke passed: ${local.length} links resolve from / and /notices/`);
} finally {
  server.close();
}
