// Renders the multi-part reference session offline in Node: a target for
// node --cpu-prof and a quick real-time-factor and hash check while optimising.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {renderOffline} from '../web/host/offline.js';
import {hostAssets} from '../web/host/node-assets.js';
import {INSTRUMENTS} from '../web/host/instruments/index.js';
import {HostCore} from '../web/host/host-core.js';
import {referenceSession} from '../web/host/workloads.js';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const rate=48000,trials=Number(process.env.TRIALS||3);
const s=referenceSession(JSON.parse(fs.readFileSync('web/data/material/guitar-takes.json')),{guitarDesign:'rounded-steel'});
let best=Infinity,out;
for(let i=0;i<trials;i++){const t=performance.now();out=renderOffline({setup:s.setup,batches:[{notes:s.notes,controls:s.controls}],rate,seconds:s.seconds,instruments:INSTRUMENTS,assets:hostAssets()});best=Math.min(best,performance.now()-t);}
const h=crypto.createHash('sha256');for(const c of out.audio)h.update(Buffer.from(c.buffer,c.byteOffset,c.byteLength));
const host=new HostCore({rate,block:128,instruments:INSTRUMENTS,assets:hostAssets()});host.configure(s.setup);host.schedule({notes:s.notes,controls:s.controls});host.profile(true);
const frames=Math.round(s.seconds*rate);while(host.position<frames)host.render(Math.min(128,frames-host.position));
const p=host.profileSnapshot();
console.log(`session ${s.seconds.toFixed(1)} s: ${(s.seconds*1000/best).toFixed(2)}× (min ${best.toFixed(0)} ms of ${trials}); total ${(best/s.seconds).toFixed(1)} ms/s; sha256 ${h.digest('hex').slice(0,16)}`);
console.log('per part ms/s',Object.entries(p.parts).map(([id,x])=>`${id} ${x.msPerAudioSecond.toFixed(1)}`).join(', '),`; host ${(p.totalMs/p.audioSeconds).toFixed(1)}`);
