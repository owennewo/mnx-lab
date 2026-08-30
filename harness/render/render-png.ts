// Renders an MNX document to PNG through this project's own layout + SVG
// pipeline. Used to produce reference engravings for spec example documents
// (see docs/mnx-spec-submodule.md) and for eyeballing a scenario in isolation.
//
// The engraving is entirely ours: layout → primitives → SVG is the same code
// path the app uses. Headless Chrome only rasterizes the finished SVG, and the
// viewport is sized to the drawing so the PNG is cropped to the music.
//
// Usage:
//   npx tsx harness/render/render-png.ts <document.mnx.json> <out.png> [--px-per-sp N]
//   npx tsx harness/render/render-png.ts --all <dir-of-scenarios> <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { computePrimitives, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import { renderSvgToString } from '../helpers/svgString.ts';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { fitPxPerSp } from '../../src/engine/render/svg.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CROP_PAD_SP = 1.5;
const PAD_PX = 12;

/** The spec's own display hints are not part of the music. */
function stripDocsAnnotations(node: any): any {
  if (Array.isArray(node)) node.forEach(stripDocsAnnotations);
  else if (node && typeof node === 'object') {
    if (node._x) {
      delete node._x.mnxdocs;
      if (!Object.keys(node._x).length) delete node._x;
    }
    Object.values(node).forEach(stripDocsAnnotations);
  }
  return node;
}

export function renderToPng(inPath: string, outPath: string, pxPerSpBase = 14): void {
  const doc = stripDocsAnnotations(JSON.parse(fs.readFileSync(inPath, 'utf8')));
  const computed = computePrimitives(doc);
  const usedWidthSp = planHorizontal(doc, WIDTH_SP).usedWidthSp;
  const pxPerSp = fitPxPerSp(WIDTH_SP * pxPerSpBase, usedWidthSp, pxPerSpBase);
  const viewBoxSp = computeBoundsSp(computed.notation.primitives, CROP_PAD_SP) ?? undefined;
  const svg = renderSvgToString({ ...computed.notation, widthSp: usedWidthSp, pxPerSp, viewBoxSp });

  const font = fs.readFileSync(path.join(ROOT, 'public/smufl/Bravura.woff2')).toString('base64');
  const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Bravura'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html,body { margin:0; padding:0; background:#fff; }
:root { --font-family-sans: Georgia, 'Times New Roman', serif; }
#w { display:inline-block; padding:${PAD_PX}px; background:#fff; }
svg { display:block; }
</style><div id="w">${svg}</div>`;

  const dim = (attr: string) => Number(new RegExp(`\\b${attr}="([\\d.]+)"`).exec(svg)?.[1] ?? 0);
  const w = Math.ceil(dim('width')) + PAD_PX * 2;
  const h = Math.ceil(dim('height')) + PAD_PX * 2;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpHtml = outPath.replace(/\.png$/, '.html');
  fs.writeFileSync(tmpHtml, html);
  execFileSync(
    'google-chrome',
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--default-background-color=ffffff',
      '--force-device-scale-factor=2',
      `--window-size=${w},${h}`,
      `--screenshot=${outPath}`,
      tmpHtml
    ],
    { stdio: 'ignore' }
  );
  fs.unlinkSync(tmpHtml);
  console.log(`${path.relative(ROOT, outPath)}  ${w * 2}x${h * 2}`);
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  const [, dir, outDir] = args;
  for (const entry of fs.readdirSync(dir).sort()) {
    const score = path.join(dir, entry, 'document.mnx.json');
    if (fs.existsSync(score)) renderToPng(score, path.join(outDir, `${entry}.png`));
  }
} else if (args.length >= 2) {
  const idx = args.indexOf('--px-per-sp');
  renderToPng(args[0], args[1], idx >= 0 ? Number(args[idx + 1]) : 14);
} else {
  console.error('usage: render-png.ts <document.mnx.json> <out.png> | --all <dir> <out-dir>');
  process.exit(1);
}
