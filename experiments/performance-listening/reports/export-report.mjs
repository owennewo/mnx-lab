// The one exporter for numbered reports: an experiment's summary file plus the run
// summaries it names, as registered in reports.json. Reading copies only: it never
// runs a listener or changes recorded evidence.
//
//   node export-report.mjs [NNN ...] [--check]
//
// With no numbers it renders every registered report.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escape, markdown } from './markdown.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const sha = b => createHash('sha256').update(b).digest('hex');

// A run pins the bytes its sources had at its recorded commit. Verify against that
// commit, so later work on the same files never invalidates an earlier report. Fall
// back to the working tree only when the commit is not in this clone.
function recordedBytes(commit, path) {
  if (commit) {
    try {
      return execFileSync('git', ['show', `${commit}:experiments/performance-listening/${path}`], { cwd: here, maxBuffer: 1 << 26 });
    } catch { /* commit or path absent from this clone */ }
  }
  return readFileSync(resolve(root, path));
}
const css = 'body{margin:0;background:#f3f4ef;color:#21383c;font:16px/1.65 system-ui}main{max-width:1080px;margin:auto;padding:32px}article,details{background:white;border:1px solid #ccd8d1;border-radius:10px;padding:28px;margin:0 0 22px}h1{font-size:2.25rem;line-height:1.2}h2{margin-top:32px}a{color:#14616a}p,li{max-width:90ch}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}td,th{border:1px solid #ccd8d1;padding:10px;text-align:left}th{background:#edf3ee}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f3;padding:16px;font-size:.8rem}code{overflow-wrap:anywhere;font-size:.86em}.banner{padding:18px;background:#f8edce;border-left:5px solid #ad782e}summary{cursor:pointer;font-weight:650}footer{font-size:.85rem}@media(max-width:650px){main{padding:12px}article,details{padding:18px}h1{font-size:1.8rem}}';

function render(entry) {
  const source = { id: 'summary', path: resolve(here, `${entry.slug}.md`) };
  source.text = readFileSync(source.path, 'utf8');
  const evidence = entry.runs.map(id => ({ id, text: readFileSync(resolve(root, 'runs', id, 'summary.json'), 'utf8') }));
  for (const e of evidence) {
    const run = JSON.parse(e.text);
    for (const [path, hash] of Object.entries(run.sourceHashes ?? {})) {
      if (sha(recordedBytes(run.gitCommit, path)) !== hash) throw new Error(`Report ${entry.number}: ${path} does not match its recorded hash`);
    }
  }
  const links = [entry.private, entry.previous].filter(Boolean).map(l => `<a href="${l.href}">${l.label}</a>`).join(' · ');
  const details = evidence.map(e => `<details><summary>${escape(e.id)} — complete aggregate evidence</summary><pre>${escape(e.text)}</pre><p>SHA-256 <code>${sha(e.text)}</code></p></details>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${entry.title}</title><style>${css}</style></head><body><main><article><div class="banner">${entry.banner}</div><p>${links}</p>${markdown(source, here)}</article>${details}<footer>Summary SHA-256 <code>${sha(source.text)}</code>. This report does not rerun or alter an experiment.</footer></main></body></html>\n`;
}

const { reports } = JSON.parse(readFileSync(resolve(here, 'reports.json'), 'utf8'));
const check = process.argv.includes('--check');
const wanted = process.argv.slice(2).filter(a => a !== '--check');
const unknown = wanted.filter(n => !reports.some(r => r.number === n));
if (unknown.length) throw new Error(`Unregistered report: ${unknown.join(', ')}`);
for (const entry of reports.filter(r => !wanted.length || wanted.includes(r.number))) {
  const html = render(entry), output = resolve(here, `${entry.slug}.html`);
  if (check) {
    if (readFileSync(output, 'utf8') !== html) throw new Error(`Report ${entry.number} is stale`);
    console.log(`Report ${entry.number} matches its sources and every recorded source hash.`);
  } else {
    writeFileSync(output, html);
    console.log(`Wrote report ${entry.number}.`);
  }
}
