// A self-contained playback copy: no server and no file:// media permissions needed.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const folder=realpathSync(process.argv[2] ?? '/home/williao/dev/mnx-listening-data/real-evidence-01');
for(let at=folder;;at=dirname(at)){
 if(existsSync(resolve(at,'.git')) && (statSync(resolve(at,'.git')).isFile() || existsSync(resolve(at,'.git/HEAD'))))throw new Error('Embedded private audio must stay outside git');
 if(dirname(at)===at)break;
}
const packet=JSON.parse(readFileSync(resolve(folder,'review.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sections=packet.rows.filter(row=>row.clip).map(row=>{
 const bytes=readFileSync(row.clip.path);
 if(createHash('sha256').update(bytes).digest('hex')!==row.clip.sha256)throw new Error('Review clip hash mismatch');
 const uri='data:audio/wav;base64,'+bytes.toString('base64');
 return `<section><h2>${esc(row.title)}</h2><p>First four performed bars · ${(row.clip.samples/48000).toFixed(3)} seconds · review crop, not accepted labels.</p><audio controls preload="metadata" src="${uri}"></audio><p><a href="${uri}" download="${esc(row.piece)}-four-bars.wav">Save this WAV</a> · <a href="${esc(row.remote)}" rel="noreferrer">Original recording</a></p><p>Check whether this is solo guitar, follows the intended first four bars, and starts/ends at the intended boundaries. This check does not establish precise beat timing.</p></section>`;
}).join('\n');
writeFileSync(resolve(folder,'listen.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Four-bar listening review</title><style>body{font:17px/1.6 system-ui;background:#f3f5f2;color:#183c40;max-width:850px;margin:32px auto;padding:20px}section{background:white;border:1px solid #ccd8d1;padding:24px;margin:24px 0;border-radius:8px}audio{width:100%}a{color:#17606a}</style><h1>Listen to the first four bars</h1><p>Audio is embedded in this private file. Open it in your regular browser; no server or network is required to play the clips.</p>${sections}<p>Scores, anchor proposals and source hashes remain in <a href="index.html">the full review packet</a>. Nothing on this page approves source or timing labels.</p></html>\n`);
console.log('Wrote private self-contained listen.html; source audio and review records unchanged.');
