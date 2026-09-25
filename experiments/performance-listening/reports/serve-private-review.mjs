// Local-only review transport. Serve only the packet and its explicitly named files.
import { createServer } from 'node:http';
import { createReadStream, readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
const [folderArg, portArg = '8741'] = process.argv.slice(2);
if (!folderArg || !/^\d+$/.test(portArg)) throw new Error('Usage: node reports/serve-private-review.mjs <private-review-directory> [port]');
const folder = realpathSync(folderArg), port = Number(portArg);
if (port < 1024 || port > 65535) throw new Error('Port must be 1024–65535');
const packet = JSON.parse(readFileSync(resolve(folder, 'review.json'), 'utf8'));
const files = new Map();
let html = readFileSync(resolve(folder, 'index.html'), 'utf8');
for (const row of packet.rows) {
  for (const file of [row.clip?.path, row.media, row.score.path, row.score.convertedPath].filter(Boolean)) {
    const path = realpathSync(file);
    const route = '/asset/' + files.size;
    files.set(route, path);
    html = html.replaceAll(pathToFileURL(file).href, route);
  }
}
html = html.replaceAll('preload="none"', 'preload="metadata"').replace('</html>', `<p>If your preview cannot play audio, open this page in your regular browser. This server runs only on this laptop.</p><script>document.querySelectorAll('audio').forEach(a=>{a.addEventListener('error',()=>{const p=document.createElement('p');p.textContent='Audio failed to load. Open this localhost page in your regular browser.';a.after(p)});});</script></html>`);
files.set('/review.json', resolve(folder, 'review.json'));
const types = { '.wav': 'audio/wav', '.webm': 'audio/webm', '.json': 'application/json', '.gp': 'application/octet-stream' };
const server = createServer((req, res) => {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers).end(); return; }
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { res.writeHead(403, headers).end(); return; }
  if (req.url === '/') { res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) }); res.end(req.method === 'HEAD' ? undefined : html); return; }
  const file = files.get(req.url);
  if (!file) { res.writeHead(404, headers).end(); return; }
  const size = statSync(file).size;
  let start = 0, end = size - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!match) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
    start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; status = 206;
    if (start > end || start >= size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
  }
  res.writeHead(status, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(extname(file)==='.gp'?{'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(basename(file))}`} : {}), ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
  if (req.method === 'HEAD') res.end(); else createReadStream(file, { start, end }).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log(`Private review: http://127.0.0.1:${port}/ — Ctrl+C to stop`));
