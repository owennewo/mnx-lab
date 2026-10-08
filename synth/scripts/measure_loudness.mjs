// Loudness model of every factory guitar design (chain campaign Phase 4, C11): the
// A-weighted gated loudness of four open plucks on a one-string layout, across a pitch grid. The
// plucked instrument averages the curve over a part's strings to compensate any
// layout, so designs and layouts play at one loudness and the design's Level trims
// around it. Deterministic; tests/loudness.test.mjs checks the file is current.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CONTRACT} from '../web/contract/index.js';
import {renderOffline} from '../web/host/offline.js';
import {hostAssets} from '../web/host/node-assets.js';
import {INSTRUMENTS} from '../web/host/instruments/index.js';
import {LOUDNESS_GRID,gatedLoudness} from '../web/host/instruments/plucked-loudness.js';
const out='web/data/instrument-v2/loudness.json',check=process.argv.includes('--check');
const assets=hostAssets(),presets=assets.instruments.plucked.factory,rate=48000;
export function measure(design,pitch){
 const notes=[0,1,2,3].map(k=>({id:`n${k}`,part:'p',at:.2+k,duration:.9,velocity:.7,target:{pitch}}));
 const setup={contract:CONTRACT,session:{master:{volumeDb:0,ceilingDb:0}},parts:[{id:'p',instrument:{kind:'plucked',design,layout:{strings:[{pitch}]}},strip:{levelDb:0}}]};
 // Uncompensated: the measurement must not depend on the model it produces.
 const r=renderOffline({setup,notes,rate,seconds:4.6,instruments:INSTRUMENTS,assets:{...assets,instruments:{...assets.instruments,plucked:{...assets.instruments.plucked,loudness:null}}}});
 return Math.round(gatedLoudness(r.audio,rate)*100)/100;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const designs=Object.fromEntries(presets.map(p=>[p.id,LOUDNESS_GRID.map(pitch=>measure(p.id,pitch))]));
const model={schema:'synth-loudness/1',method:'A-weighted gated loudness (IEC 61672 A curve, BS.1770-style gates, dB) of four 0.9 s open plucks at velocity 0.7, one-string layout, uncompensated, 48 kHz',
 grid:LOUDNESS_GRID,presetsSha256:crypto.createHash('sha256').update(fs.readFileSync('web/data/instrument-v2/presets.json')).digest('hex'),designs};
const text=JSON.stringify(model,null,1)+'\n';
if(check){if(fs.readFileSync(out,'utf8')!==text)throw Error(`${out} is stale: run node scripts/measure_loudness.mjs`);console.log('loudness model current');}
else{fs.writeFileSync(out,text);console.log(Object.entries(designs).map(([id,c])=>`${id.padEnd(20)} ${c.map(x=>x.toFixed(1)).join(' ')}`).join('\n'));}
}
