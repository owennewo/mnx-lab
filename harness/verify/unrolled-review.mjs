// Static side-by-side evidence and a presentation receipt. Never an approval.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { loadCorpus } from './check-scenarios.mjs';
import { unrolledHash, unrolledState } from './unrolled-evidence.mjs';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const args = process.argv.slice(2);
const outAt = args.indexOf('--output');
const output = path.resolve(outAt < 0 ? 'dist/review/unrolled.html' : args.splice(outAt, 2)[1]);
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { unrolledSvgs } = await server.ssrLoadModule('/harness/helpers/unrolledSvg.ts');
  const { linearizePasses } = await server.ssrLoadModule('/src/model/passes.ts');
  const receipt = { formatVersion: 1, items: {} };
  const sections = [];
  for (const scenario of loadCorpus()) {
    if (args.length && !args.includes(scenario.id)) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8'));
    if (!meta.unrolled) continue;
    const hash = unrolledHash(scenario);
    if (!hash) {
      sections.push(
        `<section><h2>${escape(scenario.id)}</h2><p>Blocked: missing required unrolled engraving.</p></section>`,
      );
      continue;
    }
    const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8'));
    const computed = unrolledSvgs(doc);
    const pairs = [];
    for (const [name, fresh] of Object.entries(computed)) {
      const presented = fs.readFileSync(path.join(scenario.dir, name), 'utf8');
      if (presented !== fresh)
        throw new Error(`${scenario.id}: regenerate stale unrolled output before presentation`);
      const writtenName = name.replace('.unrolled', '');
      const written = fs.readFileSync(path.join(scenario.dir, writtenName), 'utf8');
      pairs.push(
        `<div class="pair"><figure><figcaption>Written · ${escape(writtenName)}</figcaption>${written}</figure><figure><figcaption>Performed order · ${escape(name)}</figcaption>${presented}</figure></div>`,
      );
    }
    const entries = linearizePasses(doc).entries;
    sections.push(
      `<section id="${escape(scenario.id)}"><h2>${escape(meta.title)}</h2><p>${escape(scenario.id)} · ${unrolledState(meta, hash)} · ${hash}</p><p>${escape(meta.description)}</p><p>Written bars in performed order: ${entries.map((e) => `${e.measureIndex + 1}${e.occurrence > 1 ? ` (${e.occurrence}×)` : ''}`).join(' → ')}</p>${pairs.join('')}<details><summary>Exact traversal entries (zero-based measure indexes and ordinals)</summary><pre>${escape(JSON.stringify(entries, null, 2))}</pre></details></section>`,
    );
    receipt.items[scenario.id] = { unrolledHash: hash };
  }
  const font = fs.readFileSync('public/smufl/Bravura.woff2').toString('base64');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unrolled engraving review</title><style>@font-face{font-family:Bravura;src:url(data:font/woff2;base64,${font}) format("woff2")}body{font:15px system-ui;margin:24px;color:#202020;background:#faf9f6}section{border-top:2px solid #888;margin-top:32px;padding-top:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{min-width:0;margin:0;background:white;padding:12px;overflow:auto}figure svg{max-width:100%;height:auto}figcaption{font-size:12px;color:#555;margin-bottom:12px}pre{overflow:auto}.unperformed{opacity:.3}@media(max-width:850px){.pair{grid-template-columns:1fr}}</style><h1>Unrolled engraving review</h1><p>${sections.length} scenarios. Compare bar order with the hand-stated traversal tests; check inherited clef/key at jump targets, occurrence labels only from 2×, and the faded, unperformed notes in partial bars. Repeat signs and endings disappear. Badges identify whole-bar partial entries and ignored written layout constraints. This page does not approve anything.</p>${sections.join('\n')}</html>`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  fs.writeFileSync(`${output}.receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Review: ${output}\nReceipt: ${output}.receipt.json`);
} finally {
  await server.close();
}
