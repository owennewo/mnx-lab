import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {effectsMemoProbe} from '../scripts/wasm_effects_memo_probe.mjs';
import {sha256} from '../scripts/faust.mjs';
import {inactiveKnockGuard} from '../scripts/wasm_inactive_knock_guard.mjs';
import {LiveThwackEngine} from '../web/audio/live-thwack.js';
import {GuitarEngine} from '../web/audio/engine.js';
import {FAUST_MATH_IMPORTS} from '../web/audio/math-imports.js';
import {instrumentPlanV2} from '../web/model/instrument-v2.js';
import {enginePlan,factoryPresets} from './support/engine-plan.mjs';
import {prepareOwnedEvents} from '../web/model/prepared-note-ownership.js';
const read=p=>JSON.parse(fs.readFileSync(p)),original=fs.readFileSync('web/generated/instrument-v2/raw/guitar.wasm'),cached=fs.readFileSync('web/generated/instrument-v2/guitar.wasm');
const meta=read('web/generated/instrument-v2/guitar.json'),cachedMeta=meta,module=new WebAssembly.Module(original),memo=new WebAssembly.Module(cached);
const presets=factoryPresets(),reference=read('web/data/performance.json');
const plan=(p,performance,rate)=>instrumentPlanV2(enginePlan(performance,p,rate),{preset:p,rate});
function same(a,b,n,label){for(let c=0;c<9;c++)assert.ok(Buffer.from(a[c].buffer,a[c].byteOffset,n*4).equals(Buffer.from(b[c].buffer,b[c].byteOffset,n*4)),`${label}, channel ${c}`);}
test('cached live instrument reproduces from the original binary with unchanged ABI and DSP state layout',()=>{
 const guard=inactiveKnockGuard(original),rebuilt=effectsMemoProbe(guard.bytes,{cacheSite:site=>site.loopDepth===0});assert.deepEqual(guard.sites.map(s=>s.string),[0,1,2,3,4,5]);assert.equal(sha256(rebuilt.bytes),sha256(cached),'Rebuilt guitar binary differs from the published one');assert.equal(rebuilt.skippedSites.length,6);assert.ok(rebuilt.skippedSites.every(s=>s.name==='_expf'));assert.equal(cachedMeta.size,meta.size);assert.equal(cachedMeta.sourceSha256,meta.sourceSha256);assert.deepEqual(cachedMeta.ui,meta.ui);
});
test('actual main and shadow audio is bit-identical across all ten voices, rapid chords, extreme attacks, live edits, resets and three rates',()=>{
 const performance=structuredClone(reference);
 performance.notes=Array.from({length:18},(_,i)=>({...reference.notes[0],id:i,string:i%6,fret:i<6?0:i<12?12:24,onset_frame:Math.round((.02+Math.floor(i/6)*.06+(i%6)*.002)*reference.sampleRate),offset_frame:Math.round(.55*reference.sampleRate),performed_velocity:.85,hardness_delta:0,position_delta:0}));
 for(const rate of [44100,48000,96000]){
  const a=new LiveThwackEngine(module,meta,rate),b=new LiveThwackEngine(memo,cachedMeta,rate);
  for(let voice=0;voice<10;voice++){
   const p=structuredClone(presets[voice]);if(voice===8){p.instrument.excitation.hardness=40;p.instrument.parameters.pick_texture=8;}
   const packet=plan(p,performance,rate),prepared=prepareOwnedEvents(packet.events);
   for(const e of [a,b]){e.reset(packet.params,packet.events,packet.seed,packet.eventPolicy,prepared);e.setThwack(voice%2?.5:1.5);}
   let edited=false;
   for(let pos=0;pos<rate*.7;pos+=128){
    if(!edited&&pos>rate*.09){const params={...packet.params,brightness:.12,decay:2,bridge_transfer:.05,pickup:.25};for(const e of [a,b])e.update(params,packet.events,.04,prepared);edited=true;}
    const n=Math.min(128,Math.ceil(rate*.7)-pos);same(a.render(n),b.render(n),n,`rate ${rate}, voice ${voice}, frame ${pos}`);
   }
  }
 }
});
test('all prototype/global control endpoint edits preserve exact audio and zero-thwack trajectories',()=>{
 for(const rate of [44100,48000,96000]){
  const a=new LiveThwackEngine(module,meta,rate),b=new LiveThwackEngine(memo,cachedMeta,rate),packet=plan(presets[8],reference,rate);
  for(const e of [a,b]){e.reset(packet.params,packet.events,packet.seed,packet.eventPolicy);e.setThwack(0);}
  const controls=Object.entries(a.controls).filter(([key])=>!key.endsWith('-trigger')&&!key.startsWith('attack_'));
  for(let block=0;block<controls.length*2;block++){
   const [key,spec]=controls[block%controls.length],value=block<controls.length?spec.min:spec.max;
   for(const e of [a,b])e.set(key,value);
   same(a.render(128),b.render(128),128,`endpoint ${key}, rate ${rate}`);
  }
 }
});
test('coefficient reuse removes repeated imports rather than only relocating work',()=>{
 const totals=[{},{}],imports=totals.map(count=>({env:Object.fromEntries(Object.entries(FAUST_MATH_IMPORTS.env).map(([key,fn])=>[key,(...args)=>{count[key]=(count[key]||0)+1;return fn(...args);}]))}));
 const engines=[new GuitarEngine(module,meta,48000,128,imports[0]),new GuitarEngine(memo,cachedMeta,48000,128,imports[1])];
 const packet=plan(presets[8],reference,48000);for(const e of engines)e.reset(packet.params,[],packet.seed);
 for(let block=0;block<50;block++)same(engines[0].render(128),engines[1].render(128),128,'steady coefficient probe');
 console.log('Original/cached import counts:',JSON.stringify(totals));
 for(const key of ['_expf','_cosf','_tanf','_powf'])assert.ok(totals[1][key]<totals[0][key],JSON.stringify({key,original:totals[0][key],cached:totals[1][key]}));
 assert.ok(totals[1]._sinf<totals[0]._sinf,'inactive knock sine imports removed');
 assert.equal(totals[1]._tanhf,totals[0]._tanhf,'string nonlinearity remains untouched');
});
test('guard rejects changed input and retains full DSP state, active selectors and later-audible body history',()=>{
 const bad=Buffer.from(original);bad[bad.length-1]^=1;assert.throws(()=>inactiveKnockGuard(bad),/Unexpected Engine2 raw binary/);
 const performance=structuredClone(reference);performance.notes=Array.from({length:6},(_,s)=>({...reference.notes[0],id:s,string:s,fret:s*3,onset_frame:Math.round((.02+s*.001)*reference.sampleRate),offset_frame:Math.round(.3*reference.sampleRate),performed_velocity:.85}));
 for(const rate of [44100,48000,96000])for(const block of [16,128])for(const selector of [-1,0,5]){
  const packet=plan(presets[8],performance,rate),a=new GuitarEngine(module,meta,rate,block),b=new GuitarEngine(memo,cachedMeta,rate,block);
  for(const e of [a,b])e.reset({...packet.params,attack_trial:2,attack_string:selector,attack_amount:.15,body_mix:0},packet.events,packet.seed,packet.eventPolicy);
  let changed=false;
  for(let pos=0;pos<rate*.16;pos+=block){
   if(!changed&&pos>=rate*.055){for(const e of [a,b])e.update({...packet.params,body_mix:1},undefined,.04);changed=true;}
   const n=Math.min(block,Math.ceil(rate*.16)-pos);same(a.render(n),b.render(n),n,'all-string/selected knock and radiation on');
   assert.ok(Buffer.from(a.stateBytes).equals(Buffer.from(b.stateBytes)),'entire DSP state remains byte-identical');
  }
 }
});
test('body-enabled shadow attacks and next-pluck strength edits remain bit-identical',()=>{
 const performance=structuredClone(reference);performance.notes=Array.from({length:12},(_,i)=>({...reference.notes[0],id:i,string:i%6,fret:i%6*2,onset_frame:Math.round((.02+Math.floor(i/6)*.065)*reference.sampleRate),offset_frame:Math.round(.3*reference.sampleRate),performed_velocity:.8}));
 for(const rate of [44100,48000,96000]){
  const packet=plan(presets[8],performance,rate),a=new LiveThwackEngine(module,meta,rate),b=new LiveThwackEngine(memo,cachedMeta,rate);
  for(const e of [a,b]){e.reset({...packet.params,body_mix:1},packet.events,packet.seed,packet.eventPolicy);e.setThwack(1.5);}
  for(let pos=0;pos<rate*.3;pos+=128){if(pos>=rate*.05&&pos<rate*.05+128)for(const e of [a,b])e.setThwack(.05);const n=Math.min(128,Math.ceil(rate*.3)-pos);same(a.render(n),b.render(n),n,'body-enabled strength edit');}
 }
});
