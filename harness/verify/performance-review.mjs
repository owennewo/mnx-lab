// Static, self-contained /verify page + hash receipt. This never grants approval.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { loadCorpus } from './check-scenarios.mjs';
import { buildQueue } from './verify-scenarios.mjs';
import { performanceHash } from './performance-evidence.mjs';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const cell = (value) =>
  value && typeof value === 'object' && 'num' in value && 'den' in value
    ? `${value.num}/${value.den}`
    : typeof value === 'object'
      ? JSON.stringify(value)
      : (value ?? '');
const table = (label, rows) => {
  if (!rows.length) return `<h3>${label}</h3><p>None.</p>`;
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `<h3>${label} (${rows.length})</h3><div class="scroll"><table><thead><tr>${keys.map((k) => `<th>${escape(k)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((k) => `<td>${escape(cell(row[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
};
const args = process.argv.slice(2);
const outAt = args.indexOf('--output');
const output = path.resolve(outAt >= 0 ? args.splice(outAt, 2)[1] : 'dist/review/performance.html');
const queue = buildQueue();
const wanted = args.length
  ? new Set(args)
  : new Set([...queue.blocked, ...queue.stale, ...queue.neverSeen].map((e) => e.id));
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { parsePerformance } = await server.ssrLoadModule('/src/audio/performance.ts');
  const { exportMidi } = await server.ssrLoadModule('/src/audio/midiFile.ts');
  const receipt = { formatVersion: 1, items: {} };
  const sections = [];
  for (const scenario of loadCorpus().filter((s) => wanted.has(s.id))) {
    const meta = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8'));
    if (!meta.performance) continue;
    const hash = performanceHash(scenario);
    if (!hash) {
      sections.push(
        `<section><h2>${escape(scenario.id)}</h2><p>Blocked: required performance evidence is missing.</p></section>`,
      );
      continue;
    }
    const text = fs.readFileSync(path.join(scenario.dir, 'expected.performance.json'), 'utf8');
    const performance = JSON.parse(text);
    const midi = exportMidi(parsePerformance(text));
    const verdict = JSON.parse(
      fs.readFileSync(path.join(scenario.dir, 'expected.midi.json'), 'utf8'),
    );
    if (
      midi.ok !== verdict.ok ||
      (midi.ok && crypto.createHash('sha256').update(midi.bytes).digest('hex') !== verdict.sha256)
    )
      throw new Error(`${scenario.id}: regenerate stale MIDI evidence before presenting it`);
    const engraving = ['expected.svg', 'expected.tab.svg', 'expected.both.svg']
      .filter((name) => fs.existsSync(path.join(scenario.dir, name)))
      .map(
        (name) =>
          `<figure><figcaption>${escape(name)}</figcaption>${fs.readFileSync(path.join(scenario.dir, name), 'utf8')}</figure>`,
      )
      .join('');
    const midiLink = midi.ok
      ? `<a download="${escape(scenario.id.replaceAll('/', '-'))}.mid" href="data:audio/midi;base64,${Buffer.from(midi.bytes).toString('base64')}">Download MIDI</a>`
      : 'MIDI export refused; diagnostics below.';
    const entry = [...queue.blocked, ...queue.stale, ...queue.neverSeen, ...queue.current].find(
      (e) => e.id === scenario.id,
    );
    sections.push(
      `<section id="${escape(scenario.id)}"><h2>${escape(meta.title)}</h2><p>${escape(scenario.id)} · ${escape(entry?.performanceState ?? 'unknown')} · ${hash}</p><p>${escape(meta.description)}</p>${engraving}<p>${midiLink} · MIDI is a bounded export; written identities do not survive.</p><div class="pair">${table('Written occurrences', performance.written)}${table('Sounding events', performance.sounding)}</div>${table('Voices', performance.voices)}${table('Performed measures', performance.measures)}${table('Tempo (quarter BPM)', performance.tempo)}${table('Source map', performance.sourceMap)}${table('Compiler diagnostics', performance.diagnostics)}${table('MIDI diagnostics', verdict.diagnostics)}${table('MIDI channel allocation', verdict.allocation ?? [])}</section>`,
    );
    receipt.items[scenario.id] = { performanceHash: hash };
  }
  const font = fs.readFileSync('public/smufl/Bravura.woff2').toString('base64');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Performance evidence review</title><style>@font-face{font-family:Bravura;src:url(data:font/woff2;base64,${font}) format("woff2")}body{font:15px system-ui;margin:24px;color:#202020;background:#faf9f6}section{border-top:2px solid #888;margin-top:40px;padding-top:16px}h2{margin-bottom:8px}h3{margin-top:24px}.scroll{overflow:auto;max-height:560px;border:1px solid #ccc}table{border-collapse:collapse;font:12px monospace;white-space:nowrap;width:100%}th,td{padding:7px 10px;border-bottom:1px solid #ddd;text-align:left}th{position:sticky;top:0;background:#eee}figure{overflow:auto;background:white;padding:12px}figure svg{max-width:100%;height:auto}figcaption{font-size:12px;color:#555}.pair{display:grid;grid-template-columns:1fr;gap:8px}a{color:#154daa}</style><h1>Performance evidence review</h1><p>${sections.length} scenarios. Time values are exact whole-note fractions; ordinals are zero-based. Review the engraving and both linked tables. This page does not approve anything.</p>${sections.join('\n')}</html>`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  fs.writeFileSync(`${output}.receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Review: ${output}\nReceipt: ${output}.receipt.json`);
} finally {
  await server.close();
}
