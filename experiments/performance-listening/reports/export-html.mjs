// Reading copies only: never execute a listener or modify recorded evidence.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(here, '001-initial-two-scale.html');
const inputs = [
  ['summary', resolve(here, '001-initial-two-scale.md')],
  ['run', resolve(root, 'runs/g001-clock-harness-v1/report.md')],
  ['inventory', resolve(root, 'research/evidence-inventory.md')],
].map(([id, path]) => ({ id, path, text: readFileSync(path, 'utf8') }));
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function inline(text, source) {
  const tokens = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let html = '', cursor = 0;
  for (const match of text.matchAll(tokens)) {
    html += escape(text.slice(cursor, match.index));
    if (match[1] !== undefined) html += `<code>${escape(match[1])}</code>`;
    else if (match[2] !== undefined) {
      const target = match[3];
      if (/^https?:\/\//.test(target)) html += `<a href="${escape(target)}" rel="noreferrer">${escape(match[2])}</a>`;
      else if (!/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) {
        const [path, hash] = target.split('#');
        const link = relative(here, resolve(dirname(source), path)) + (hash ? `#${hash}` : '');
        html += `<a href="${escape(link)}">${escape(match[2])}</a>`;
      } else throw new Error(`Unsupported link protocol in ${source}`);
    } else html += `<strong>${escape(match[4])}</strong>`;
    cursor = match.index + match[0].length;
  }
  return html + escape(text.slice(cursor));
}

// Deliberately limited to the headings, paragraphs, bullets and tables in our sources.
function markdown(input) {
  const lines = input.text.trim().split(/\r?\n/);
  const render = text => inline(text, input.path);
  const cells = line => line.trim().slice(1, -1).split(/(?<!\\)\|/).map(s => s.trim().replaceAll('\\|', '|'));
  const seen = new Map();
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const heading = /^(#{1,6}) (.+)$/.exec(lines[i]);
    if (heading) {
      const slug = heading[2].toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '');
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      const id = `${input.id}-${slug}${count ? `-${count}` : ''}`;
      const level = Math.min(6, heading[1].length + (input.id === 'summary' ? 0 : 1));
      blocks.push(`<h${level} id="${id}">${render(heading[2])}</h${level}>`);
      i++; continue;
    }
    if (lines[i].startsWith('|')) {
      const headers = cells(lines[i++]);
      if (!/^\|[\s:|\-]+\|$/.test(lines[i] ?? '')) throw new Error(`Missing table separator in ${input.path}`);
      i++;
      const rows = [];
      while (lines[i]?.startsWith('|')) {
        const row = cells(lines[i++]);
        if (row.length !== headers.length) throw new Error(`Table width mismatch in ${input.path}`);
        rows.push(`<tr>${row.map(c => `<td>${render(c)}</td>`).join('')}</tr>`);
      }
      blocks.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(headers.join(', '))}"><table><thead><tr>${headers.map(c => `<th scope="col">${render(c)}</th>`).join('')}</tr></thead><tbody>${rows.join('\n')}</tbody></table></div>`);
      continue;
    }
    if (lines[i].startsWith('- ')) {
      const items = [];
      while (lines[i]?.startsWith('- ')) {
        let item = lines[i++].slice(2);
        while (lines[i]?.startsWith('  ')) item += ' ' + lines[i++].trim();
        items.push(`<li>${render(item)}</li>`);
      }
      blocks.push(`<ul>${items.join('\n')}</ul>`); continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i])) paragraph.push(lines[i++]);
    if (!paragraph.length) throw new Error(`Unsupported block in ${input.path}: ${lines[i]}`);
    blocks.push(`<p>${render(paragraph.join(' '))}</p>`);
  }
  return blocks.join('\n');
}

const provenance = inputs.map(input => `<tr><td><a href="${escape(relative(here, input.path))}">${escape(relative(root, input.path))}</a></td><td><code>${createHash('sha256').update(input.text).digest('hex')}</code></td></tr>`).join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>001 — Initial two-scale assessment · MNX Lab</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202f38;background:#f5f4ef;line-height:1.65;font-size:16px}
*{box-sizing:border-box}body{margin:0}a{color:#1b6367;text-underline-offset:3px}a:hover{color:#143f42}a:focus-visible,summary:focus-visible,.table-wrap:focus-visible{outline:3px solid #b16b28;outline-offset:4px}
header{background:#183c40;color:#fafbf9;padding:30px max(24px,calc((100vw - 1120px)/2));border-bottom:5px solid #bd9963}header p{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.16em}header div{margin-top:8px;font-size:1.2rem}
nav{display:flex;flex-wrap:wrap;gap:10px 24px;margin-bottom:30px;font-size:.95rem}main{max-width:1180px;padding:36px 30px 60px;margin:auto}article,details{background:white;border:1px solid #d7dfdb;border-radius:10px;padding:28px 36px;margin-bottom:24px;min-width:0}h1{font-size:clamp(1.8rem,4vw,2.75rem);line-height:1.16;letter-spacing:-.035em;margin:6px 0 26px;max-width:850px}h2{font-size:1.4rem;margin:36px 0 12px;line-height:1.3}h3{font-size:1.12rem;margin:28px 0 10px}p,li{max-width:85ch}p{margin:14px 0}li{margin:10px 0}article>p:first-of-type{font-size:1.15rem;line-height:1.65;color:#364a50}code{font: .87em ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}strong{font-weight:650}
.badge{display:inline-block;background:#e6f1e9;color:#234e39;border:1px solid #bdd7c5;border-radius:4px;padding:4px 10px;font-size:.85rem;margin:0 0 18px}.note{border-left:3px solid #bd9963;padding-left:14px;color:#526069;font-size:.9rem}.table-wrap{overflow-x:auto;margin:20px 0;border:1px solid #dbe1de;border-radius:5px}table{border-collapse:collapse;width:100%;text-align:left;font-size:.87rem;line-height:1.5}th{background:#eef2ef;color:#34494a;font-weight:650}th,td{padding:12px 14px;border-bottom:1px solid #dbe1de;vertical-align:top;min-width:100px}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#fafbf9}article th:first-child{min-width:175px}article td:nth-child(2){min-width:220px}#evidence td:first-child{min-width:240px}#evidence td{max-width:460px}.provenance td{width:50%}
summary{cursor:pointer;font-size:1.3rem;font-weight:650;line-height:1.4}summary small{display:block;font-size:.9rem;font-weight:400;color:#56676b;margin:8px 0 0 20px}details[open]>summary{border-bottom:1px solid #dbe1de;padding-bottom:22px;margin-bottom:28px}footer{font-size:.85rem;color:#526069;padding:10px 4px}footer h2{font-size:1.1rem}section,details{scroll-margin-top:20px}
@media(max-width:650px){main{padding:24px 14px}article,details{padding:22px 18px}header{padding:24px}th,td{padding:10px}nav{gap:10px 18px}h1{font-size:2rem}.table-wrap{max-width:100%}}
@media print{body{background:white;font-size:10pt}header{background:white;color:#183c40;padding:0 0 15px}main{padding:0;max-width:none}nav,.badge{display:none}article,details{border:0;padding:0;box-shadow:none}table{font-size:8pt}.table-wrap{overflow:visible}th,td{min-width:0!important;padding:6px;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}a{color:inherit}}
</style>
</head>
<body>
<header><p>MNX Lab · Performance listening</p><div>Experiment report 001 · 25 September 2026</div></header>
<main>
<nav aria-label="Report sections"><a href="#overview">Assessment summary</a><a href="#report">Recorded run</a><a href="#evidence">R1 evidence inventory</a><a href="#sources">Source records</a></nav>
<article id="overview"><div class="badge">Instrument check passed</div>
${markdown(inputs[0])}
</article>
<details id="report"><summary>Recorded run: full results<small>Expand for counts, confidence, deadlines, exposure, causality and measured processing cost.</small></summary>
${markdown(inputs[1])}
</details>
<details id="evidence"><summary>R1: real-source evidence inventory<small>Expand for every recording, exclusions, score and sync hashes, and capture opportunities.</small></summary>
${markdown(inputs[2])}
</details>
<footer id="sources"><h2>Source records and provenance</h2><p>This offline reading copy embeds the three documents below. SHA-256 hashes identify exactly which text was rendered. The recorded run remains <code>g001-clock-harness-v1</code>; this presentation does not rerun or revise it.</p>
<div class="table-wrap provenance"><table><thead><tr><th scope="col">Source in this checkout</th><th scope="col">SHA-256</th></tr></thead><tbody>${provenance}</tbody></table></div>
<p class="note">Research-contract-0 remains provisional and not human-approved. This assessment makes no qualification or retention decision. R1 describes the available cache snapshot, not current live availability.</p>
<p><a href="README.md">Report naming and regeneration</a> · <a href="../RESEARCH_LOG.md">Current research state</a></p></footer>
</main>
</body>
</html>
`;
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node reports/export-html.mjs [--check]');
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== html) throw new Error('HTML is stale; run export-html.mjs');
  console.log('Report 001 matches its source documents.');
} else {
  writeFileSync(output, html);
  console.log(`Wrote ${relative(process.cwd(), output)}`);
}
