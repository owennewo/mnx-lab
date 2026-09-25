import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escape, markdown } from './markdown.mjs';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'..');
const ids=['g003-recognition-at-sync'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const source={id:'summary',path:resolve(here,'003-recognition-at-sync.md')};source.text=readFileSync(source.path,'utf8');
const evidence=ids.map(id=>({id,text:readFileSync(resolve(root,'runs',id,'summary.json'),'utf8')}));
for(const e of evidence){const run=JSON.parse(e.text);for(const [path,hash] of Object.entries(run.sourceHashes))if(sha(readFileSync(resolve(root,path)))!==hash)throw new Error(`Recorded source changed: ${path}`);}
const css='body{margin:0;background:#f3f4ef;color:#21383c;font:16px/1.65 system-ui}main{max-width:1080px;margin:auto;padding:32px}article,details{background:white;border:1px solid #ccd8d1;border-radius:10px;padding:28px;margin:0 0 22px}h1{font-size:2.25rem;line-height:1.2}h2{margin-top:32px}a{color:#14616a}p,li{max-width:90ch}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}td,th{border:1px solid #ccd8d1;padding:10px;text-align:left}th{background:#edf3ee}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f3;padding:16px;font-size:.8rem}code{overflow-wrap:anywhere;font-size:.86em}.banner{padding:18px;background:#f8edce;border-left:5px solid #ad782e}summary{cursor:pointer;font-weight:650}footer{font-size:.85rem}@media(max-width:650px){main{padding:12px}article,details{padding:18px}h1{font-size:1.8rem}}';
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>003 · Recognition at supplied sync</title><style>${css}</style></head><body><main><article><div class="banner">Diagnostic complete · weak positive recognition and ambiguous nearby positions</div><p><a href="file:///home/williao/dev/mnx-listening-data/real-evidence-01/003-recognition-at-sync.html">Open private audio and similarity traces</a> · <a href="002-winner-sync-proxy.html">Experiment 002</a></p>${markdown(source,here)}</article>${evidence.map(e=>`<details><summary>${escape(e.id)} — complete aggregate evidence</summary><pre>${escape(e.text)}</pre><p>SHA-256 <code>${sha(e.text)}</code></p></details>`).join('')}<footer>Summary SHA-256 <code>${sha(source.text)}</code>. This report does not rerun or alter an experiment.</footer></main></body></html>\n`;
const output=resolve(here,'003-recognition-at-sync.html');
if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==html)throw new Error('Report 003 is stale');console.log('Report 003 matches sources and all recorded source hashes.');}else{writeFileSync(output,html);console.log('Wrote report 003.');}
