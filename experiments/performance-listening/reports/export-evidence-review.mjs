import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escape, markdown } from './markdown.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const approval = JSON.parse(readFileSync(resolve(root, 'contracts/research-contract-1.approval.json'), 'utf8'));
const contractPath = 'contracts/research-contract-1-draft.md';
const contractHash = createHash('sha256').update(readFileSync(resolve(root, contractPath))).digest('hex');
if (approval.contractId !== 'research-contract-1' || approval.status !== 'approved' ||
    approval.snapshot?.path !== contractPath || approval.snapshot?.sha256 !== contractHash) {
  throw new Error('Contract approval does not match the reviewed snapshot');
}
const sources = [
  ['approval', 'contracts/research-contract-1.md'],
  ['contract', contractPath],
  ['preparation', 'evidence/README.md'],
].map(([id, path]) => ({ id, path: resolve(root, path), text: readFileSync(resolve(root, path), 'utf8') }));
const output = resolve(here, 'real-evidence-review.html');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Four-bar real-evidence preparation · MNX Lab</title>
<style>body{font:16px/1.65 system-ui;color:#20383c;background:#f4f5f0;margin:0}header{background:#183c40;color:white;padding:26px max(24px,calc((100vw - 1060px)/2))}header p{margin:0;letter-spacing:.12em;text-transform:uppercase;font-size:.8rem}main{max-width:1120px;margin:auto;padding:30px}article,details{background:white;border:1px solid #ccd8d1;border-radius:8px;padding:26px 32px;margin:0 0 24px}h1{font-size:2.2rem;line-height:1.2}h2{line-height:1.3;margin:30px 0 15px}h3{margin:24px 0 12px}p,li{max-width:85ch}a{color:#17606a;text-underline-offset:3px}.tag{display:inline-block;border:1px solid #d7b985;background:#fff4dd;padding:4px 12px;border-radius:4px;font-size:.85rem}summary{font-size:1.3rem;font-weight:650;cursor:pointer}details[open]>summary{padding-bottom:20px;border-bottom:1px solid #ccd8d1;margin-bottom:24px}.table-wrap{overflow-x:auto;max-width:100%;margin:18px 0}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{padding:12px;border:1px solid #d8dfda;text-align:left;vertical-align:top;min-width:140px}th{background:#eef3ef}code{font: .85em ui-monospace,monospace;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f3;padding:16px}li{margin:8px 0}footer{font-size:.85rem;color:#516567}a:focus-visible,summary:focus-visible{outline:3px solid #ad782e;outline-offset:4px}@media(max-width:650px){main{padding:16px}article,details{padding:20px}h1{font-size:1.8rem}}@media print{body{background:white}header{background:white;color:#183c40}main{padding:0}article,details{border:0}table{font-size:8pt}th,td{min-width:0;padding:6px}.table-wrap{overflow:visible}}</style></head><body>
<header><p>MNX Lab · Evidence preparation · 25 September 2026</p></header><main>
<article><span class="tag">Contract 1 approved · sync development loop complete</span><h1>Start with four bars</h1>
<p>The Winner Takes It All first, then Dust in the Wind. Local four-bar audio review clips, score links and anchor checks are ready. <a href="002-winner-sync-proxy.html">Experiment 002</a> now records two completed candidate comparisons using the user-directed sync interpolation. Neither candidate passed.</p>
<p><a href="file:///home/williao/dev/mnx-listening-data/real-evidence-01/listen.html">Open the private listening and anchor-review packet</a> on this machine. The audio and scores stay outside the repository.</p>
<h2>The approved scope and gates</h2><ul>
<li>Known start; solo guitar through a microphone on this laptop; timing within 80–120% of the supplied nominal tempo.</li>
<li>Approved gates: at least 95% correct supported positions and 95% correct rejection; 98% decision coverage; at most 5% wrong/false exposure, with no episode over 0.5 s.</li>
<li>A 200 ms decision deadline, at most 10% missed deadlines, p99 processing at most 10 ms per 10 ms audio chunk, and at most 25% of real time overall.</li>
<li>Expand from 4 to 8 to 12 bars only after the applicable gates pass on both pieces, with separately reviewed labels and frozen set versions.</li>
<li>The user confirmed solo guitar and four bars, then directed us to use sync interpolation for initial development. That approximate set is frozen and tested. Independent reserved and microphone acceptance evidence remain necessary for formal retention and qualification.</li></ul>
<p>The user approved the full contract as drafted on 25 September 2026, including recovery, uncertainty, minimum worthwhile improvement, budgets, stopping and the separate Studio integration requirements. The approval record below pins the exact reviewed text; the later development amendment is recorded separately. Manual beat annotation is not a prerequisite for the initial proxy experiment.</p></article>
${sources.map(source => `<details${source.id === 'approval' ? ' open' : ''}><summary>${source.id === 'approval' ? 'Research contract 1 — approval and subsequent development amendment' : source.id === 'contract' ? 'Approved contract — exact reviewed draft (historical wording preserved)' : 'Evidence preparation, findings and reproduction'}</summary>${markdown(source, here)}</details>`).join('\n')}
<footer><h2>Rendered sources</h2>${sources.map(s => `<p><a href="${escape(relative(here, s.path))}">${escape(relative(root, s.path))}</a><br><code>${createHash('sha256').update(s.text).digest('hex')}</code></p>`).join('\n')}<p><a href="../evidence/initial-four-bars-preflight.json">Preflight metadata</a> · <a href="../RESEARCH_LOG.md">Research log</a> · <a href="001-initial-two-scale.html">Experiment 001</a></p></footer>
</main></body></html>\n`;
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node reports/export-evidence-review.mjs [--check]');
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== html) throw new Error('Evidence review HTML is stale');
  console.log('Evidence review matches its sources.');
} else { writeFileSync(output, html); console.log('Wrote real-evidence-review.html'); }
