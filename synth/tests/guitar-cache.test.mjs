// The published guitar is FAUST's raw Engine2 binary (web/generated/instrument-v2/raw) with
// the exact per-site coefficient cache (scripts/wasm_effects_memo_probe.mjs) and nothing
// else: it rebuilds byte for byte, plays bit-identically to the raw binary, and the cache
// removes repeated math imports rather than moving them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {effectsMemoProbe} from '../scripts/wasm_effects_memo_probe.mjs';
import {sha256} from '../scripts/faust.mjs';
import {GuitarEngine} from '../web/audio/engine.js';
import {FAUST_MATH_IMPORTS} from '../web/audio/math-imports.js';
import {instrumentPlanV2} from '../web/model/instrument-v2.js';
import {enginePlan,factoryPresets} from './support/engine-plan.mjs';
import {prepareOwnedEvents} from '../web/model/prepared-note-ownership.js';
const read=p=>JSON.parse(fs.readFileSync(p)),original=fs.readFileSync('web/generated/instrument-v2/raw/guitar.wasm'),cached=fs.readFileSync('web/generated/instrument-v2/guitar.wasm');
const meta=read('web/generated/instrument-v2/guitar.json'),module=new WebAssembly.Module(original),memo=new WebAssembly.Module(cached);
const presets=factoryPresets(),reference=read('web/data/performance.json');
const plan=(p,performance,rate)=>instrumentPlanV2(enginePlan(performance,p,rate),{preset:p,rate});
function same(a,b,n,label){for(let c=0;c<9;c++)assert.ok(Buffer.from(a[c].buffer,a[c].byteOffset,n*4).equals(Buffer.from(b[c].buffer,b[c].byteOffset,n*4)),`${label}, channel ${c}`);}
test('the published guitar rebuilds from the raw binary through the coefficient cache alone',()=>{
 const rebuilt=effectsMemoProbe(original,{cacheSite:site=>site.loopDepth===0});
 assert.equal(sha256(rebuilt.bytes),sha256(cached),'Rebuilt guitar binary differs from the published one');
 assert.deepEqual(rebuilt.skippedSites,[],'no transcendental call is left in the sample loop');
 assert.equal(meta.liveThwack,undefined,'no live thwack engine');
});
test('raw and cached audio are bit-identical across the factory designs, rapid chords, hard plucks, live edits and three rates',()=>{
 const performance=structuredClone(reference);
 performance.notes=Array.from({length:18},(_,i)=>({...reference.notes[0],id:i,string:i%6,fret:i<6?0:i<12?12:24,onset_frame:Math.round((.02+Math.floor(i/6)*.06+(i%6)*.002)*reference.sampleRate),offset_frame:Math.round(.55*reference.sampleRate),performed_velocity:i%3?.85:1,hardness_delta:0,position_delta:0}));
 for(const rate of [44100,48000,96000]){
  const a=new GuitarEngine(module,meta,rate),b=new GuitarEngine(memo,meta,rate);
  for(let voice=0;voice<presets.length;voice++){
   const p=structuredClone(presets[voice]);if(voice===8){p.instrument.excitation.hardness=40;p.instrument.parameters.pick_texture=8;}
   const packet=plan(p,performance,rate),prepared=prepareOwnedEvents(packet.events);
   for(const e of [a,b])e.reset({...packet.params,thwack_body_trim:1.5},packet.events,packet.seed,packet.eventPolicy,prepared);
   let edited=false;
   for(let pos=0;pos<rate*.7;pos+=128){
    if(!edited&&pos>rate*.09){const params={...packet.params,brightness:.12,decay:2,bridge_transfer:.05,pickup:.25,thwack_soak:20,thwack_body:3};for(const e of [a,b])e.update(params,packet.events,.04,prepared);edited=true;}
    const n=Math.min(128,Math.ceil(rate*.7)-pos);same(a.render(n),b.render(n),n,`rate ${rate}, voice ${voice}, frame ${pos}`);
   }
  }
 }
});
test('every control at its endpoints plays bit-identically raw and cached',()=>{
 for(const rate of [44100,48000,96000]){
  const a=new GuitarEngine(module,meta,rate),b=new GuitarEngine(memo,meta,rate),packet=plan(presets[8],reference,rate);
  for(const e of [a,b])e.reset(packet.params,packet.events,packet.seed,packet.eventPolicy);
  const controls=Object.entries(a.controls).filter(([key])=>!key.endsWith('-trigger'));
  for(let block=0;block<controls.length*2;block++){
   const [key,spec]=controls[block%controls.length],value=block<controls.length?spec.min:spec.max;
   for(const e of [a,b])e.set(key,value);
   same(a.render(128),b.render(128),128,`endpoint ${key}, rate ${rate}`);
  }
 }
});
test('coefficient reuse removes repeated imports rather than only relocating work',()=>{
 const totals=[{},{}],imports=totals.map(count=>({env:Object.fromEntries(Object.entries(FAUST_MATH_IMPORTS.env).map(([key,fn])=>[key,(...args)=>{count[key]=(count[key]||0)+1;return fn(...args);}]))}));
 const engines=[new GuitarEngine(module,meta,48000,128,imports[0]),new GuitarEngine(memo,meta,48000,128,imports[1])];
 const packet=plan(presets[8],reference,48000);for(const e of engines)e.reset(packet.params,[],packet.seed);
 for(let block=0;block<50;block++)same(engines[0].render(128),engines[1].render(128),128,'steady coefficient probe');
 for(const key of ['_expf','_cosf','_tanf','_powf'])assert.ok(totals[1][key]<totals[0][key],JSON.stringify({key,original:totals[0][key],cached:totals[1][key]}));
});
