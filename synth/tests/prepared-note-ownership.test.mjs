import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NoteOwnershipSchedule,LATEST_NOTE_POLICY} from '../web/model/note-ownership.js';
import {prepareOwnedEvents,PreparedNoteOwnershipSchedule} from '../web/model/prepared-note-ownership.js';
import {GuitarEngine} from '../web/audio/engine.js';
import {instrumentPlanV2} from '../web/model/instrument-v2.js';
import {enginePlan,factoryPresets} from './support/engine-plan.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const presets=factoryPresets(),reference=read('web/data/performance.json');
const plans=presets.map(p=>instrumentPlanV2(enginePlan(reference,p,48000),{preset:p,rate:48000}));
test('page-prepared ownership matches the original compiler through repeated factory/setup edits',()=>{
 const original=new NoteOwnershipSchedule(plans[0].events),prepared=new PreparedNoteOwnershipSchedule(prepareOwnedEvents(plans[0].events));
 assert.deepEqual(prepared.events,original.events);
 for(let position=128;position<plans[0].frames;position+=12032){
  const events=plans[Math.floor(position/12032)%10].events;
  assert.deepEqual(prepared.replacePrepared(prepareOwnedEvents(events),position),original.replace(events,position),`position ${position}`);
 }
});
const owned=(start,stop,hz=100,s=0)=>[{frame:start,key:`s${s}-trigger`,value:1},{frame:start+48,key:`s${s}-trigger`,value:0},{frame:stop,key:`s${s}-sustain`,value:0},...Array.from({length:Math.ceil((stop-start)/100)},(_,i)=>({frame:start+i*100,key:`s${s}-frequency`,value:hz+i}))].map(e=>({...e,noteStart:start}));
const sorted=e=>e.sort((a,b)=>a.frame-b.frame);
test('prepared replacements retain uncut trajectories, prevent resurrection and fail atomically on late edges',()=>{
 const first=sorted([...owned(100,3000),...owned(1000,1200,200)]);
 for(const next of [700,1300,null]){
  const a=new NoteOwnershipSchedule(first),b=new PreparedNoteOwnershipSchedule(prepareOwnedEvents(first));
  const events=sorted([...owned(100,3000,999),...(next===null?[]:owned(next,2500,300))]);
  assert.deepEqual(b.replacePrepared(prepareOwnedEvents(events),500),a.replace(events,500));
 }
 const b=new PreparedNoteOwnershipSchedule(prepareOwnedEvents(first)),before=JSON.stringify(b);
 assert.throws(()=>b.replacePrepared(prepareOwnedEvents(sorted([...owned(100,3000),...owned(140,2500)])),140),/low trigger/);
 assert.equal(JSON.stringify(b),before);
 const a=new NoteOwnershipSchedule(first),future=sorted([...owned(100,3000,999),...owned(1000,1200,999),...owned(2000,2500,400)]);
 assert.deepEqual(b.replacePrepared(prepareOwnedEvents(future),1500),a.replace(future,1500));
});
test('prepared and original live engines are bit-identical through control updates, re-plucks and loop resets',()=>{
 const meta=read('web/generated/instrument-v2/guitar.json'),module=new WebAssembly.Module(fs.readFileSync('web/generated/instrument-v2/guitar.wasm'));
 const a=new GuitarEngine(module,meta),b=new GuitarEngine(module,meta),first=plans[8];
 for(let loop=0;loop<2;loop++){
  a.reset(first.params,first.events,first.seed,LATEST_NOTE_POLICY);b.reset(first.params,first.events,first.seed,LATEST_NOTE_POLICY,prepareOwnedEvents(first.events));
  for(let frame=0;frame<96000;frame+=128){
   if(frame>0&&frame%12032===0){const p=plans[(frame/12032)%10];a.update(p.params,p.events,.04);b.update(p.params,p.events,.04,prepareOwnedEvents(p.events));}
   assert.deepEqual(b.render(128),a.render(128),`loop ${loop}, frame ${frame}`);
  }
 }
});
test('omitting unchanged note plans is bit-identical to repeated full updates during the reference score',()=>{
 const meta=read('web/generated/instrument-v2/guitar.json'),module=new WebAssembly.Module(fs.readFileSync('web/generated/instrument-v2/guitar.wasm'));
 const a=new GuitarEngine(module,meta),b=new GuitarEngine(module,meta),p=plans[8],prepared=prepareOwnedEvents(p.events);
 a.reset(p.params,p.events,p.seed,LATEST_NOTE_POLICY);b.reset(p.params,p.events,p.seed,LATEST_NOTE_POLICY,prepared);
 for(let frame=0;frame<384000;frame+=128){
  if(frame>0&&frame%12032===0){const params={...p.params,brightness:frame%24064?.3:.75};a.update(params,p.events,.04);b.update(params,undefined,.04);}
  assert.deepEqual(b.render(128),a.render(128),`frame ${frame}`);
 }
});
