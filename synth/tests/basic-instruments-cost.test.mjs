// Budget (D13 / plan table): a basic part costs at most a quarter of a plucked part. The
// plucked part plays the performed reference take (chain campaign Phase 5: after the
// excitation gating, sparse single notes no longer represent a plucked part's cost).
// Timing-based, so npm test runs this file on its own after the parallel suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HostCore} from '../web/host/host-core.js';
import {hostAssets} from '../web/host/node-assets.js';
import {INSTRUMENTS} from '../web/host/instruments/index.js';
import {referenceSession} from '../web/host/workloads.js';
const fixture=name=>JSON.parse(fs.readFileSync(`web/contract/fixtures/${name}.json`));

// Ratios of the minimum over repeated trials are robust to a uniformly loaded machine.
test('per-part cost: keys and kit ≤ 25 % of one plucked part',()=>{
 const cost=(name,part)=>{const f=typeof name==='string'?fixture(name):name,seconds=f.render.seconds;let best=Infinity;
  for(let trial=0;trial<5;trial++){
   const host=new HostCore({rate:48000,block:128,instruments:INSTRUMENTS,assets:hostAssets()});host.configure(f.setup);host.schedule({notes:f.notes,controls:f.controls??[]});
   const inst=host.parts.get(part).instrument,render=inst.render.bind(inst);let spent=0;inst.render=n=>{const t=performance.now(),y=render(n);spent+=performance.now()-t;return y;};
   const frames=Math.round(seconds*48000);while(host.position<frames)host.render(Math.min(128,frames-host.position));best=Math.min(best,spent/seconds);}
  return best;};
 const r=referenceSession(JSON.parse(fs.readFileSync('web/data/material/guitar-takes.json')),{guitarDesign:'rounded-steel'}),guitar={...r.setup,parts:r.setup.parts.filter(p=>p.id==='guitar').map(p=>({...p,chain:[]}))};
 const plucked=cost({setup:guitar,notes:r.notes.filter(n=>n.part==='guitar'),controls:[],render:{seconds:r.seconds}},'guitar'),k=cost('keys-pedal','keys'),d=cost('kit-chokes','drums');
 console.log(`# cost per audio second: plucked ${plucked.toFixed(1)} ms, keys ${k.toFixed(1)} ms (${(k/plucked).toFixed(3)}), kit ${d.toFixed(1)} ms (${(d/plucked).toFixed(3)})`);
 assert.ok(k/plucked<=.25,`keys ${k/plucked}`);assert.ok(d/plucked<=.25,`kit ${d/plucked}`);
});
