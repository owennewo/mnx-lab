import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escape } from './markdown.mjs';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'..');
const dir=realpathSync(process.argv[2]??''), repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:here,encoding:'utf8'}).trim();
const rel=relative(repo,dir);if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw new Error('Private export must be outside repository');
try{execFileSync('git',['-C',dir,'rev-parse','--show-toplevel'],{stdio:'ignore'});throw new Error('Private export must be outside every git checkout');}catch(e){if(e.status===undefined)throw e;}
const sha=b=>createHash('sha256').update(b).digest('hex');
const ids=['g002a-spectral1-winner-sync-proxy','g002b-spectral2-winner-sync-proxy'];
const runs=ids.map(id=>{
 const pub=JSON.parse(readFileSync(resolve(root,'runs',id,'summary.json'),'utf8'));
 const bytes=readFileSync(resolve(dir,'proxy-winner-v1/runs',id,'evaluations.json'));
 if(sha(bytes)!==pub.privateEvaluationsSha256)throw new Error('Recorded private evaluation changed');
 return {pub,evaluations:JSON.parse(bytes)};
});
const wav=readFileSync(resolve(dir,'F2msc-1872366-four-bars-review.wav'));
const wavHash='be27e20e92f1eb98e94345f1865355d128f529a3330529f60024c22ca7eeeaf1';
if(sha(wav)!==wavHash)throw new Error('Winner WAV changed');
const series=[{name:'Clock @1',points:runs[0].evaluations['clock-follower@1/winner-positive'].points},...runs.map((r,i)=>({name:`Spectral @${i+1}`,points:r.evaluations[`spectral-follower@${i+1}/winner-positive`].points}))];
const duration=9.506958333333333,x=t=>60+t/duration*880,y=(q,lane)=>60+lane*150-q*32;
const lanes=series.map((s,lane)=>{
 let path='',active=false;for(const p of s.points){if(p.quarterResidual===null){active=false;continue;}path+=`${active?'L':'M'}${x(p.time).toFixed(2)},${y(p.quarterResidual,lane).toFixed(2)} `;active=true;}
 const gaps=s.points.filter(p=>p.quarterResidual===null).map(p=>`<rect x="${x(p.time)-2}" y="${y(0,lane)+50}" width="4" height="5" fill="#b46439"/>`).join('');
 return `<text x="60" y="${y(0,lane)-48}" font-size="15" fill="#20383c">${escape(s.name)}</text><rect x="60" y="${y(.25,lane)}" width="880" height="16" fill="#deede3"/><line x1="60" y1="${y(0,lane)}" x2="940" y2="${y(0,lane)}" stroke="#758888"/><text x="6" y="${y(1,lane)+4}" font-size="12">+1 q</text><text x="6" y="${y(-1,lane)+4}" font-size="12">−1 q</text><path d="${path}" stroke="#126a82" stroke-width="2" fill="none"/>${gaps}`;
}).join('');
const ticks=Array.from({length:10},(_,i)=>`<text x="${x(i)}" y="475" text-anchor="middle" font-size="12">${i}s</text>`).join('');
const script=`const series=${JSON.stringify(series).replaceAll('<','\\u003c')};
const player=document.getElementById('audio'), cursor=document.getElementById('cursor'), out=document.getElementById('readout'), graph=document.getElementById('graph');
function update(){const t=player.currentTime;cursor.setAttribute('x1',60+t/player.duration*880||60);cursor.setAttribute('x2',60+t/player.duration*880||60);out.textContent=t.toFixed(2)+' s — '+series.map(s=>{const p=s.points.findLast(p=>p.time<=t);return s.name+': '+(!p?'initial allowance':p.residualSeconds===null?'not following':(p.residualSeconds>=0?'ahead ':'behind ')+Math.round(Math.abs(p.residualSeconds)*1000)+' ms'+(p.agreement?' (within tolerance)':' (outside tolerance)'));}).join(' · ');}
player.addEventListener('timeupdate',update);player.addEventListener('loadedmetadata',update);player.addEventListener('seeked',update);
document.getElementById('speed').addEventListener('change',e=>{player.playbackRate=Number(e.target.value);});
graph.addEventListener('click',e=>{if(!Number.isFinite(player.duration))return;const p=graph.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(graph.getScreenCTM().inverse());player.currentTime=Math.max(0,Math.min(player.duration,(q.x-60)/880*player.duration));update();});
update();`;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>002 · Listen to Winner and compare timing</title><style>body{font:16px/1.6 system-ui;background:#f3f4ef;color:#20383c;margin:0}main{max-width:1000px;margin:auto;padding:28px}article{padding:24px;background:white;border:1px solid #ccd8d1;border-radius:10px}h1{line-height:1.2}audio{width:100%;margin:15px 0}svg{width:100%;height:auto;cursor:crosshair}#readout{min-height:4.8em;background:#edf3ee;padding:15px;font-variant-numeric:tabular-nums}code{overflow-wrap:anywhere}select{font:inherit}summary{cursor:pointer}footer{font-size:.85rem}@media(max-width:650px){main{padding:10px}article{padding:15px}}</style></head><body><main><article><p>Experiment 002 · private recorded evidence · four bars</p><h1>Winner: hear where following is lost</h1><p>Neither spectral candidate passes. This page uses the saved run decisions; it does not run a listener in your browser. The same WAV you reviewed is embedded here, so no server is needed.</p><audio id="audio" controls preload="metadata" src="data:audio/wav;base64,${wav.toString('base64')}"></audio><label>Playback speed <select id="speed"><option value="1">1×</option><option value="0.75">0.75×</option><option value="0.5">0.5×</option></select></label><p id="readout" role="status"></p><h2>Ahead or behind the interpolated sync</h2><p>Above zero: ahead. Below: behind. Green band: ±0.25 quarter-note tolerance. Orange marks and gaps: no position claim. Click the graph to seek, or use the audio controls. The readout shows the latest 50 ms evaluation point.</p><svg id="graph" viewBox="0 0 970 490" role="img" aria-label="Three timing traces comparing the clock and two spectral followers against sync interpolation; spectral followers contain many gaps.">${lanes}${ticks}<line id="cursor" x1="60" x2="60" y1="6" y2="452" stroke="#b84646" stroke-width="2"/></svg><p>Position agreement: clock 88.36%, spectral @1 46.03%, spectral @2 17.99%. Version 2 declines to follow on 147 of 189 points. Lower exposure or smaller residuals among its few claims do not make it successful.</p><p>The reference is linearly interpolated from the original sync.json bar anchors. Small differences can be performance timing, imperfect sync or tracker error; they are not verified musical mistakes. The clock also has residuals because the anchor intervals vary.</p><details><summary>Data and privacy</summary><p>Source WAV SHA-256: <code>${wavHash}</code>. Duration: ${duration} s, 48 kHz mono PCM16. Every embedded trace was checked against the public run's private-evaluation hash. This file contains private audio and per-frame reference information; keep it outside git.</p></details><footer><p>Offline playback uses the browser's native WAV player. Timing traces are saved approximate-development evidence, not microphone qualification.</p></footer></article></main><script>${script}</script></body></html>\n`;
const output=resolve(dir,'002-winner-sync-proxy.html');
if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==html)throw new Error('Private report 002 is stale');console.log('Private report 002 matches hash-checked audio and traces.');}else{writeFileSync(output,html);console.log('Wrote private audio/trace report 002.');}
