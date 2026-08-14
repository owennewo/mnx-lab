// Hands-on runner for the viewer-embedded app (`npm run dev:embed-app`).
//
// Two origins, deliberately — the same topology the smoke test uses and the
// same one a real host page has: the artifact is somewhere else. Serving both
// from one root would be more convenient and would hide exactly the class of
// bug this app exists to catch (roadmap/proposed/core-viewer-embedded-app.md).
//
// Prints one URL. Ctrl-C stops both servers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveStatic } from './staticServer.mjs';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const ARTIFACT_DIR = path.join(ROOT, 'dist/embed');
const APP_DIR = path.join(ROOT, 'apps/viewer-embedded');

if (!fs.existsSync(path.join(ARTIFACT_DIR, 'mnx-lab.esm.js'))) {
  console.error('dist/embed is missing — run `npm run build:embed` first.');
  process.exit(1);
}

const artifact = await serveStatic(ARTIFACT_DIR);
const app = await serveStatic(APP_DIR);
const base = `http://127.0.0.1:${artifact.port}`;

console.log(`
  artifact  ${base}            (dist/embed — a stand-in for the CDN)
  host page http://127.0.0.1:${app.port}

  open:  http://127.0.0.1:${app.port}/index.html?base=${encodeURIComponent(base)}

  Two origins on purpose: that is what a real embed faces, and what
  \`npm run smoke:embed\` asserts. Ctrl-C to stop.
`);

const stop = () => {
  artifact.server.close();
  app.server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
