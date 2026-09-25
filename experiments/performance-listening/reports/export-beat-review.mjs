import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const folder=realpathSync(process.argv[2] ?? '/home/williao/dev/mnx-listening-data/real-evidence-01');
for(let at=folder;;at=dirname(at)){
 if(existsSync(resolve(at,'.git'))&&(statSync(resolve(at,'.git')).isFile()||existsSync(resolve(at,'.git/HEAD'))))throw new Error('Private audio must stay outside git');
 if(dirname(at)===at)break;
}
const packet=JSON.parse(readFileSync(resolve(folder,'review.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const records=[];
const sections=packet.rows.filter(row=>row.clip).map((row,index)=>{
 const bytes=readFileSync(row.clip.path);
 if(createHash('sha256').update(bytes).digest('hex')!==row.clip.sha256 || bytes.toString('ascii',36,40)!=='data')throw new Error('Review clip differs from canonical WAV');
 const duration=row.clip.samples/48000;
 const anchors=row.anchors.filter(a=>a.bar<=4&&a.offset===0).slice(0,5);
 if(anchors.length!==5 || anchors.some((a,i)=>i>0&&a.scoreQuarter-anchors[i-1].scoreQuarter!==4))throw new Error('This initial review page requires four complete 4/4 bars');
 const suggestions=[];
 for(let q=anchors[0].scoreQuarter;q<=anchors.at(-1).scoreQuarter;q++){
  const i=Math.max(0,anchors.findLastIndex(a=>a.scoreQuarter<q));const a=anchors[i],b=anchors[Math.min(i+1,anchors.length-1)];
  const t=a.seconds+(q-a.scoreQuarter)/(b.scoreQuarter-a.scoreQuarter)*(b.seconds-a.seconds)-row.clip.sourceStartSeconds;
  suggestions.push({quarter:q,suggestedSeconds:Math.max(0,Math.min(duration,t)),observedLowerSeconds:null,observedUpperSeconds:null});
 }
 const wave=[];
 for(let x=0;x<1000;x++){
  let peak=0;for(let n=Math.floor(x*row.clip.samples/1000);n<Math.floor((x+1)*row.clip.samples/1000);n++)peak=Math.max(peak,Math.abs(bytes.readInt16LE(44+2*n)/32768));
  wave.push(`M${x},${60-peak*55}v${peak*110}`);
 }
 records.push({piece:row.piece,recording:row.recording,audioSha256:row.clip.sha256,scoreSha256:row.score.convertedSha256,sourceSha256:row.mediaInfo.sha256,cropStartSample:row.clip.fromSample,samples:row.clip.samples,sampleRate:48000,proposalsOnly:true,beats:suggestions});
 return `<section data-index="${index}"><h2>${esc(row.title)}</h2><audio controls preload="metadata" src="data:audio/wav;base64,${bytes.toString('base64')}"></audio><p><label>Playback speed <select class="speed"><option value="1">Normal</option><option value="0.75">¾ speed</option><option value="0.5">Half speed</option></select></label> <output>0.000 s</output></p><svg viewBox="0 0 1000 120" role="img" aria-label="Audio waveform; click to seek"><path d="${wave.join(' ')}" stroke="#17606a" stroke-width="1"/>${suggestions.map(b=>`<line x1="${1000*b.suggestedSeconds/duration}" x2="${1000*b.suggestedSeconds/duration}" y1="0" y2="120" stroke="#b6b8b2" stroke-dasharray="3 3"/>`).join('')}</svg><p>Grey marks are unverified interpolation suggestions. Click the waveform to seek, listen, then enter conservative lower/upper bounds for each audible beat. Marking the current playback time is only a starting point; it does not establish precision.</p><div class="scroll"><table><thead><tr><th>Quarter / bar</th><th>Suggestion (s)</th><th>Observed lower (s)</th><th>Observed upper (s)</th><th>Seek / mark</th></tr></thead><tbody>${suggestions.map((b,i)=>`<tr data-beat="${i}"><td>${b.quarter} / ${Math.floor(b.quarter/4)+1}${i===suggestions.length-1?' endpoint':''}</td><td>${b.suggestedSeconds.toFixed(3)}</td><td><input class="lower" type="number" min="0" max="${duration}" step="0.001" aria-label="Beat ${i} lower time"></td><td><input class="upper" type="number" min="0" max="${duration}" step="0.001" aria-label="Beat ${i} upper time"></td><td><button class="seek">Seek suggestion</button> <button class="mark">Mark playback time</button></td></tr>`).join('')}</tbody></table></div><label>Evidence for interpolation between these observed beats (or say unknown)<textarea class="interpolation" rows="3"></textarea></label><p><label><input type="checkbox" class="checked"> I independently checked the entered bounds against the audible beat landmarks.</label></p></section>`;
}).join('\n');
const data=JSON.stringify(records).replaceAll('<','\\u003c');
const script=`const sources=${data};
for(const section of document.querySelectorAll('section')){
 const source=sources[+section.dataset.index],audio=section.querySelector('audio');
 section.querySelector('.speed').onchange=e=>audio.playbackRate=+e.target.value;
 audio.ontimeupdate=()=>section.querySelector('output').textContent=audio.currentTime.toFixed(3)+' s';
 section.querySelector('svg').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();audio.currentTime=Math.max(0,Math.min(audio.duration,(e.clientX-r.left)/r.width*audio.duration));};
 for(const row of section.querySelectorAll('tbody tr')){
  const b=source.beats[+row.dataset.beat];row.querySelector('.seek').onclick=()=>audio.currentTime=b.suggestedSeconds;
  row.querySelector('.mark').onclick=()=>{row.querySelector('.lower').value=audio.currentTime.toFixed(3);row.querySelector('.upper').value=audio.currentTime.toFixed(3);};
 }
}
document.querySelector('#save').onclick=()=>{
 const reviewer=document.querySelector('#reviewer').value.trim();if(!reviewer){alert('Enter the reviewer name.');return;}
 const rows=sources.map((source,i)=>{const section=document.querySelector('section[data-index="'+i+'"]');return {...source,reviewer,reviewedAt:new Date().toISOString(),independentListeningCheck:section.querySelector('.checked').checked,interpolationEvidence:section.querySelector('.interpolation').value,beats:source.beats.map((b,j)=>{const tr=section.querySelector('tr[data-beat="'+j+'"]');const get=cls=>tr.querySelector(cls).value===''?null:Number(tr.querySelector(cls).value);return {...b,observedLowerSeconds:get('.lower'),observedUpperSeconds:get('.upper')};})};});
 const blob=new Blob([JSON.stringify({kind:'beat-review-draft',accepted:false,rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='four-bar-beat-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};`;
writeFileSync(resolve(folder,'beat-review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent four-bar beat review</title><style>body{font:16px/1.6 system-ui;background:#f3f5f2;color:#183c40;max-width:1100px;margin:auto;padding:24px}section{background:white;padding:24px;border:1px solid #ccd8d1;border-radius:8px;margin:24px 0}audio,svg,textarea{width:100%}svg{cursor:crosshair;background:#f4f6f2}table{border-collapse:collapse}td,th{padding:10px;border:1px solid #ccd8d1}input[type=number]{width:95px}.scroll{overflow:auto}button{padding:6px;margin:3px}label{display:block}input[type=checkbox]{margin-right:10px}</style><h1>Review beats inside the four bars</h1><p>Winner first. The cached bar times are suggestions, not precise beat labels. Audio is embedded; this page works offline. Unfilled observations stay unknown. Nothing here automatically accepts a label or changes the cached sync data.</p><p>The user has confirmed solo guitar and four bars for both clips. This review is the separate timing check. Use audible landmarks, not a candidate's output. Zero-width bounds are draft markers until justified; include uncertainty from onset ambiguity and clock/crop alignment.</p>${sections}<label>Reviewer <input id="reviewer" autocomplete="name"></label><button id="save">Save draft beat review JSON</button><p>Save alongside the private review files. The draft must still be checked for coverage, precision, tempo and control evidence before a golden can be frozen.</p><script>${script}</script></html>\n`);
console.log('Wrote private beat-review.html with blank observations and embedded audio.');
