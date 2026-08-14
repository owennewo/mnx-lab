// A tiny CORS-enabled static server, shared by the embed smoke test and the
// embed app's dev script so both exercise the SAME topology: the artifact on
// one origin, the host page on another
// (roadmap/proposed/core-viewer-embedded-app.md). Same-origin convenience is
// exactly what let the embed's asset bug survive, so the dev affordance must
// not quietly reintroduce it.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml'
};

/**
 * Serve `dir` on `port` (0 = any free port). CORS is open because a real CDN
 * would send those headers; without them the cross-origin module import fails
 * for a reason that has nothing to do with what we are testing.
 */
export function serveStatic(dir, port = 0) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'access-control-allow-origin': '*'
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
