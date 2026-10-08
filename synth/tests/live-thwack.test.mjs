import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {LiveThwackEngine} from '../web/audio/live-thwack.js';
import {GuitarEngine} from '../web/audio/engine.js';
import {GUITAR_ENGINE,instrumentPlanV2} from '../web/model/instrument-v2.js';
import {enginePlan,factoryPresets} from './support/engine-plan.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),meta=read('web/generated/instrument-v2/guitar.json'),bytes=fs.readFileSync('web/generated/instrument-v2/guitar.wasm'),module=new WebAssembly.Module(bytes);
const presets=factoryPresets(),reference=read('web/data/performance.json');
function score(){const p=structuredClone(reference);p.notes=Array.from({length:6},(_,s)=>({...reference.notes[0],id:s,string:s,fret:0,midi:[40,45,50,55,59,64][s],beat:s*.1,velocity:.85,performed_velocity:.85,onset_frame:Math.round((.06+s*.08)*p.sampleRate),offset_frame:Math.round(.7*p.sampleRate),position_delta:0,hardness_delta:0,intonation_cents:0,attack_bend_cents:0,vibrato_cents:0}));return p;}
const packet=(preset,performance,rate=48000)=>instrumentPlanV2(enginePlan(performance,preset,rate),{preset,rate});
function render(preset,performance,{rate=48000,strength=preset.instrument.excitation.thwack,block=128,live=true,update}={}){
 const plan=packet(preset,performance,rate),e=live?new LiveThwackEngine(module,meta,rate,block):new GuitarEngine(module,meta,rate,block);
 e.reset(plan.params,plan.events,plan.seed,plan.eventPolicy);if(live)e.setThwack(strength);
 const frames=rate,channels=Array.from({length:9},()=>new Float32Array(frames));
 for(let start=0;start<frames;start+=block){if(update&&start>=update.frame&&!update.done){update.apply(e,plan);update.done=true;}const n=Math.min(block,frames-start),x=e.render(n);for(let c=0;c<9;c++){assert.ok(x[c].subarray(0,n).every(Number.isFinite));channels[c].set(x[c].subarray(0,n),start);}}
 return channels;
}
const error=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0)/Math.max(1e-20,a.reduce((s,x)=>s+x*x,0)));
test('live assets are pinned, fixed controls and factory strengths have sensible starting points',()=>{
 assert.equal(meta.liveThwack,true);assert.equal(meta.sourceSha256,GUITAR_ENGINE.sourceSha256);assert.equal(meta.candidateWasmSha256,createHash('sha256').update(bytes).digest('hex'));
 for(const id of ['rounded-steel','soft-nylon','muted-jazz'])assert.equal(presets.find(p=>p.id===id).instrument.excitation.thwack,.05);
 for(const id of ['bridge-electric','bright-metallic'])assert.equal(presets.find(p=>p.id===id).instrument.excitation.thwack,.5);
});
test('zero thwack is bit-identical, internal string trajectories never change, and no sustain is coloured',()=>{
 const performance=score(),plain=render(presets[0],performance,{live:false}),zero=render(presets[0],performance,{strength:0}),treated=render(presets[0],performance,{strength:.5});
 assert.deepEqual(zero,plain);assert.ok(error(plain[0],treated[0])>1e-4);
 for(let c=2;c<9;c++)assert.deepEqual(treated[c],plain[c]);
 for(let i=0;i<plain[0].length;i++)if(!performance.notes.some(n=>i>=n.onset_frame&&i<n.onset_frame+4800))for(let c=0;c<2;c++)assert.equal(treated[c][i],plain[c][i]);
});
test('live thwack survives rapid chord replucks, extreme controls and three sample rates',()=>{
 const performance=score();performance.notes=performance.notes.flatMap((n,s)=>[{...n,onset_frame:Math.round(.06*performance.sampleRate)},{...n,id:10+s,onset_frame:Math.round((.063+s*.003)*performance.sampleRate)}]);
 const preset=structuredClone(presets[8]);preset.instrument.excitation.hardness=40;preset.instrument.parameters.pick_texture=8;
 for(const rate of [44100,48000,96000]){
  const normal=render(preset,performance,{rate,live:false}),treated=render(preset,performance,{rate,strength:1.5});
  for(let c=2;c<9;c++)assert.deepEqual(treated[c],normal[c]);for(let c=0;c<2;c++)assert.deepEqual(treated[c].subarray(Math.ceil(.18*rate)),normal[c].subarray(Math.ceil(.18*rate)));
 }
});
test('strength edits are immediate next-pluck decisions, while active knocks retain their strength',()=>{
 const performance=score();performance.notes=performance.notes.slice(0,1);performance.notes.push({...performance.notes[0],id:2,onset_frame:Math.round(.25*performance.sampleRate)});
 const strong=render(presets[0],performance,{strength:.5}),off=render(presets[0],performance,{strength:0});
 const edited=render(presets[0],performance,{strength:.5,update:{frame:4096,apply:e=>e.setThwack(0)}});
 for(let c=0;c<2;c++){assert.deepEqual(edited[c].subarray(0,12000),strong[c].subarray(0,12000));assert.deepEqual(edited[c].subarray(12000),off[c].subarray(12000));}
});
test('active shadow baselines follow live parameter/event changes without adding a phantom difference',()=>{
 const performance=score(),change={brightness:.15,decay:2,pickup:.25,bridge_transfer:.15};
 const makeUpdate=()=>({frame:4096,apply:(e,plan)=>e.update({...plan.params,...change},plan.events,.04)});
 const normal=render(presets[0],performance,{live:false,update:makeUpdate()}),treated=render(presets[0],performance,{strength:.5,update:makeUpdate()});
 for(let c=2;c<9;c++)assert.deepEqual(treated[c],normal[c]);
 for(let c=0;c<2;c++)assert.deepEqual(treated[c].subarray(27000),normal[c].subarray(27000));
 assert.deepEqual(render(presets[0],performance,{strength:0,update:makeUpdate()}),normal);
});
test('block sizes do not change live transient output',()=>{
 const performance=score();assert.deepEqual(render(presets[0],performance,{strength:.5,block:16}),render(presets[0],performance,{strength:.5}));
});
