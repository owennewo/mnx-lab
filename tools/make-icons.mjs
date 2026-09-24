// Rasterizes public/app-icons/icon.svg into the PNGs the manifest names.
//
// The PNGs are DERIVED and committed: git is the database here, and a build
// must not need Chrome. Rerun with `npm run update:icons` after touching the
// SVG and let `git diff -- public/app-icons/` be the review.
//
// Chrome is the rasterizer for the same reason harness/render/render-png.ts
// uses it — it is already required for the browser smokes, so this adds no
// dependency. One screenshot per size at device-scale-factor 1, so the output
// is exactly the size the manifest claims.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'public/app-icons');
const SOURCE = path.join(DIR, 'icon.svg');

/** name → edge in CSS px. apple-touch-icon is iOS's, which ignores the manifest. */
const SIZES = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon-180.png': 180,
};

const svg = fs.readFileSync(SOURCE, 'utf8');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-icons-'));

try {
  for (const [name, size] of Object.entries(SIZES)) {
    // CSS beats the SVG's own width/height attributes, so the source is used
    // verbatim — an earlier version stripped those attributes with a regex and
    // took the background rect's size with them, producing a white icon.
    const html = `<!doctype html><meta charset="utf-8"><style>
html,body { margin:0; padding:0; }
svg { display:block; width:${size}px; height:${size}px; }
</style>${svg}`;
    const page = path.join(scratch, `${name}.html`);
    const out = path.join(DIR, name);
    fs.writeFileSync(page, html);
    execFileSync(
      process.env.CHROME_BIN ?? 'google-chrome',
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--window-size=${size},${size}`,
        `--screenshot=${out}`,
        page,
      ],
      { stdio: 'ignore' },
    );
    console.log(`${path.relative(ROOT, out)}  ${size}x${size}`);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
