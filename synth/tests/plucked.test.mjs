import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {frameAt} from '../web/contract/index.js';
import {runFixture} from '../web/contract/conformance/runner.js';
import {mono,fundamental,cents} from '../web/contract/conformance/measure.js';
import {migrateDesign,resolveDesign,validateDesign,curveAt,STANDARD_GUITAR,UKULELE,DESIGN_SCHEMA} from '../web/host/instruments/plucked-design.js';
import {planPlucked} from '../web/host/instruments/plucked-plan.js';
import {performanceToNotes} from '../web/host/instruments/plucked-performance.js';
import {hostRender,pooledHostRender} from './support/host-renderer.mjs';
import {setupFor} from './support/plucked-jobs.mjs';
import {inWorkers} from './support/workers.mjs';
import {automation,selectPassage} from '../web/model/performance.js';
import {withInstrumentSetup} from '../web/model/instrument-setup.js';
import {latestPluckEvents} from '../web/model/note-ownership.js';

const read=p=>JSON.parse(fs.readFileSync(p));
const factory=read('web/data/instrument-v2/presets.json'),reference=read('web/data/performance.json');
const deepFreeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(deepFreeze);}return x;};
const fixture=name=>read(`web/contract/fixtures/${name}.json`);
const note=(id,at,duration,pitch,extra={})=>({id,part:'gtr',at,duration,velocity:.7,target:{pitch},...extra});

test('design schema 3: factory designs are register curves on the standard anchors and resolve exactly at them',()=>{
 for(const p of factory){
  const d=migrateDesign(deepFreeze(structuredClone(p)));
  assert.equal(d.schemaVersion,DESIGN_SCHEMA);assert.deepEqual(d.instrument.strings.register,[40,45,50,55,59,64]);assert.deepEqual(d.engine,{id:'guitar-lab',generation:4});
  const slots=resolveDesign(d,STANDARD_GUITAR).preset.instrument.strings;
  assert.deepEqual(slots.map(s=>s.decayScale),d.instrument.strings.decayScale,p.id);assert.deepEqual(slots.map(s=>s.tuningCents),d.instrument.strings.detuneCents,p.id);
  assert.deepEqual(resolveDesign(d).preset,resolveDesign(d,STANDARD_GUITAR).preset,p.id+' default layout');
  assert.deepEqual(migrateDesign(d),d,'idempotent');assert.equal(d.instrument.overrides,undefined);
 }
});

test('design schema 3: curves interpolate in MIDI, clamp outside and step binary properties',()=>{
 assert.equal(curveAt([40,50],[1,2],40),1);assert.equal(curveAt([40,50],[1,2],45),1.5);assert.equal(curveAt([40,50],[1,2],30),1);assert.equal(curveAt([40,50],[1,2],60),2);
 assert.equal(curveAt([40,50],[0,1],44,true),0);assert.equal(curveAt([40,50],[0,1],46,true),1);assert.equal(curveAt([40,50],[0,1],45,true),0,'a tie takes the lower anchor');
});

test('layouts: active strings take the top slots in ascending pitch; the rest are parked and finger-muted',()=>{
 const d=migrateDesign(factory[4]),u=resolveDesign(d,UKULELE);
 assert.deepEqual(u.slots.map(x=>[x.string,x.slot]),[[1,5],[2,3],[3,2],[4,4]],'reentrant ukulele: C E G A in slots 2–5');
 assert.deepEqual(u.parked,[0,1]);assert.ok(u.parked.every(s=>u.preset.instrument.strings[s].freeRinging===0));
 const bass4=resolveDesign(d,{strings:[{pitch:55},{pitch:50},{pitch:45},{pitch:40}],capo:2});assert.deepEqual(bass4.slots.map(x=>x.slot),[5,4,3,2]);assert.equal(bass4.slots[0].capo,2);
 const drop=resolveDesign(d,{strings:[64,59,55,50,45,38].map(pitch=>({pitch}))});
 assert.equal(drop.preset.instrument.strings[0].openMidi,38);assert.equal(drop.preset.instrument.strings[0].decayScale,d.instrument.strings.decayScale[0],'clamped below the lowest anchor');
 assert.throws(()=>resolveDesign(d,{strings:Array(7).fill({pitch:60})}));
});

test('designs saved by 0.2.0 development builds are brought to the engine generation; anything else unreadable is rejected',()=>{
 const dev={...structuredClone(factory[0]),engine:{id:'guitar-lab',version:'2.0.0',sourceSha256:'48c1ac0578cf907997f7fc292ffa8d8fd537cb11920681ce2f36ddc8a6e7d6e1'},recording:{room:0,drive:0,tone:18000,levelDb:factory[0].recording.levelDb}};
 assert.deepEqual(migrateDesign(dev),factory[0]);
 assert.throws(()=>migrateDesign({...structuredClone(factory[0]),engine:{id:'guitar-lab',generation:2}}),/different guitar engine/);
 assert.throws(()=>migrateDesign({schemaVersion:2,engine:{id:'guitar-lab',version:'2.0.0'}}),/schema 3/);
 const bad=migrateDesign(factory[0]);
 for(const change of [d=>{d.instrument.strings.register[1]=30;},d=>{d.instrument.strings.decayScale.pop();},d=>{d.instrument.strings.freeRinging[0]=.5;},d=>{d.instrument.setup.fret12Cents[0]=99;},
  d=>{d.instrument.overrides={'9':{decayScale:1}};},d=>{d.defaultLayout={strings:[]};},d=>{d.instrument.parameters.decay=999;}]){
  const x=structuredClone(bad);change(x);assert.throws(()=>validateDesign(x));
 }
});

// Generation 3 played a thwack strength through shadow engines; generation 4's attack soak
// replaced it. A design that used the thwack gets the factory soak (and the factory glide if it
// had none); one that did not gets no soak; its own values are otherwise kept.
test('generation 3 designs are brought to the attack soak',()=>{
 const generation3=(thwack,tension)=>{const d=structuredClone(factory[0]);d.engine.generation=3;d.instrument.excitation.thwack=thwack;
  for(const k of ['thwack_soak','thwack_time','thwack_body','thwack_treble'])delete d.instrument.parameters[k];
  d.instrument.setup={...d.instrument.setup,...tension};d.instrument.parameters.decay=7.25;return d;};
 const used=migrateDesign(generation3(.2,{tensionCents:0,tensionSeconds:.045}));
 assert.deepEqual(used.engine,{id:'guitar-lab',generation:4});assert.equal('thwack' in used.instrument.excitation,false);
 assert.deepEqual(['thwack_soak','thwack_time','thwack_body','thwack_treble'].map(k=>used.instrument.parameters[k]),[6,.12,.5,2]);
 assert.deepEqual([used.instrument.setup.tensionCents,used.instrument.setup.tensionSeconds],[12,.12],'the factory glide, where it had none');
 assert.equal(used.instrument.parameters.decay,7.25,'its own values are kept');
 const ownGlide=migrateDesign(generation3(.2,{tensionCents:4,tensionSeconds:.2}));
 assert.deepEqual([ownGlide.instrument.setup.tensionCents,ownGlide.instrument.setup.tensionSeconds],[4,.2],'its own glide is kept');
 const unused=migrateDesign(generation3(0,{tensionCents:0,tensionSeconds:.045}));
 assert.deepEqual([unused.instrument.parameters.thwack_soak,unused.instrument.parameters.thwack_body],[0,0]);
 assert.equal(unused.instrument.setup.tensionCents,0,'no glide added');
});

// The planner must reproduce the pre-host automation() law event for event, except that
// pitch events after an onset fall on the render quantum grid (planPlucked).
test('planPlucked reproduces automation() + setup law + ownership for plain and humanised takes',()=>{
 const takes=['full','strum','fingerpick','accents'].map(k=>selectPassage(reference,k));
 for(const d of factory)for(const take of takes)for(const rate of [44100,96000]){const p=resolveDesign(d,STANDARD_GUITAR).preset;
  const legacy=automation(take,p,rate),final=Math.max(...legacy.events.filter(e=>e.noteStart===undefined).map(e=>e.frame));
  const expected=latestPluckEvents(withInstrumentSetup({events:legacy.events.filter(e=>e.noteStart!==undefined||e.frame!==final)},{preset:p,performance:take,rate,setup:p.instrument.setup}).events).map(({frame,key,value})=>({frame,key,value}));
  const entries=performanceToNotes(take,{part:'gtr'}).map(n=>{const frame=frameAt(n.at,rate),endFrame=frameAt(n.at+n.duration,rate);return {id:n.id,note:n,lowered:n,primitives:{},frame,endFrame,lengthFrames:endFrame-frame};});
  const {events:all,diagnostics}=planPlucked(entries,resolveDesign(d,STANDARD_GUITAR),rate),events=all.filter(e=>!e.key.endsWith('-excite'));
  const pitch=e=>e.key.endsWith('-frequency'),onsets=new Set(expected.filter(e=>e.key.endsWith('-trigger')&&e.value===1).map(e=>`${e.key[1]}:${e.frame}`));
  const quantum=Math.max(128,Math.round(rate/200/128)*128);
  assert.deepEqual(diagnostics,[]);assert.deepEqual(events.filter(e=>!pitch(e)),expected.filter(e=>!pitch(e)),`${p.id} ${rate}`);
  // Pitch at every onset as before; after it, only on the grid.
  const at=new Map(expected.filter(pitch).map(e=>[`${e.key[1]}:${e.frame}`,e.value]));
  for(const e of events.filter(pitch)){const k=`${e.key[1]}:${e.frame}`;if(onsets.has(k))assert.equal(e.value,at.get(k),`${p.id} onset pitch ${k}`);else assert.equal(e.frame%quantum,0,`${p.id} ${rate} pitch event off the grid at ${e.frame}`);}
  // The excitation is on from every pluck until its attack window ends or the string is plucked again.
  const excite=all.filter(e=>e.key.endsWith('-excite')),plucks=all.filter(e=>e.key.endsWith('-trigger')&&e.value===1);
  for(const t of plucks){const s=t.key.slice(0,2),on=excite.find(e=>e.key===`${s}-excite`&&e.frame===t.frame&&e.value===1);assert.ok(on,`${p.id} excite at ${t.frame}`);
   const next=plucks.find(x=>x.key===t.key&&x.frame>t.frame)?.frame??Infinity,off=excite.find(e=>e.key===`${s}-excite`&&e.value===0&&e.frame>t.frame);
   // An off inside the next pluck's note would cut its attack; the ownership law drops it.
   if(off&&off.frame<next)assert.ok(off.frame-t.frame>=Math.round(.1*rate),'window at least 0.1 s');
   assert.ok(!excite.some(e=>e.key===`${s}-excite`&&e.value===0&&e.frame>=next&&e.frame<next+Math.round(.1*rate)),'no off inside the next attack window');}
 }
});

// A re-plan from the engine's position skips pitch events before it: what it keeps is
// exactly the full plan's events from there on, techniques included.
test('planPlucked from a position plans exactly the full plan\'s events at and after it',()=>{
 const rate=48000,resolved=resolveDesign(factory[0],STANDARD_GUITAR);
 const take=performanceToNotes(selectPassage(reference,'fingerpick'),{part:'gtr'}).slice(0,12);
 const curves=[note('v',.2,.8,52,{techniques:[{type:'vibrato',depthCents:30,rateHz:5}]}),note('b',.5,.6,57,{techniques:[{type:'bend',points:[{at:0,cents:0},{at:1,cents:200}]}]})];
 const entries=[...take,...curves].map(n=>{const frame=frameAt(n.at,rate),endFrame=frameAt(n.at+n.duration,rate);return {id:n.id,note:n,lowered:n,primitives:{},frame,endFrame,lengthFrames:endFrame-frame};});
 const full=planPlucked(entries,resolved,rate).events;
 for(const from of [0,1,9600,24001,48000,Infinity]){
  const later=planPlucked(entries,resolved,rate,undefined,from).events;
  assert.deepEqual(later.filter(e=>e.frame>=from),full.filter(e=>e.frame>=from),`from ${from}`);
  assert.ok(!later.some(e=>e.frame<from&&e.key.endsWith('-frequency')),`no pitch events before ${from}`);
 }
});

test('steady notes measure within ±3 cents on every string, standard and ukulele layouts (pitch tolerance calibration)',()=>{
 for(const [layout,design] of [[STANDARD_GUITAR,'rounded-steel'],[STANDARD_GUITAR,'bridge-electric'],[UKULELE,'soft-nylon']]){
  const notes=layout.strings.flatMap((s,i)=>[0,5].map((fret,k)=>note(`s${i+1}f${fret}`,.2+(2*i+k)*1.2,1,s.pitch+fret,{fingering:{string:i+1,fret}})));
  const out=mono(hostRender({setup:setupFor(design,layout),notes,rate:48000,seconds:notes.length*1.2+1}).audio);
  for(const n of notes){const expected=440*2**((n.target.pitch-69)/12),errors=[];
   for(let t=n.at+.1;t<n.at+.9;t+=.1)errors.push(Math.abs(cents(fundamental(out,48000,expected,[t,t+.04]).hz,expected)));
   errors.sort((a,b)=>a-b);assert.ok(errors[errors.length>>1]<3,`${design} ${n.id}: median ${errors[errors.length>>1].toFixed(2)} cents`);}
 }
});

test('conformance: the plucked technique study and the ukulele fixture pass their measured expectations',async()=>{
 const pool=pooledHostRender();
 try{
  const runs=await Promise.all(['plucked-techniques','ukulele-layout','chord-gestures'].map(async name=>[name,await runFixture(fixture(name),{render:pool.render})]));
  for(const [name,r] of runs)assert.ok(r.pass,`${name}: ${r.results.filter(x=>!x.pass).map(x=>`${x.kind}:${x.note??''} ${JSON.stringify(x)}`).join('; ')}`);
 }finally{await pool.close();}
});

test('mutes, legato and let ring hold on every factory design',async()=>{
 const results=await inWorkers(new URL('./support/plucked-jobs.mjs',import.meta.url),'techniqueHolds',factory.map(p=>p.id));
 factory.forEach((p,i)=>{const {ratio,deadDb,flux,ring,stop,free}=results[i];
  assert.ok(ratio<=.5,`${p.id} palm ratio ${ratio}`);assert.ok(deadDb<=-40,`${p.id} dead`);assert.ok(flux<=.25,`${p.id} legato flux ${flux}`);
  // Let ring, against the same note released at its end (natural decay differs by design).
  // Free-ringing strings are never finger-muted at note-off, so there it only must not cut.
  assert.ok(free?ring>=stop-3:ring-stop>=20,`${p.id} let ring ${ring.toFixed(1)} vs ${stop.toFixed(1)} dB`);});
});

test('techniques render identically all at once, in lookahead batches and across block sizes',()=>{
 const f=fixture('plucked-techniques'),whole=hostRender({setup:f.setup,notes:f.notes,rate:48000,seconds:19});
 const batches=[];for(let t=0;t<19;t+=.25)batches.push({through:t+.25,notes:f.notes.filter(n=>n.at>=t&&n.at<t+.25)});
 for(const other of [hostRender({setup:f.setup,batches,rate:48000,seconds:19}),hostRender({setup:f.setup,notes:f.notes,rate:48000,seconds:19,block:16})])
  for(let c=0;c<2;c++)assert.ok(other.audio[c].every((x,i)=>Object.is(x,whole.audio[c][i])));
});

test('parked strings stay silent; the voice policy, fingering checks and range checks report instead of failing',()=>{
 const u=fixture('ukulele-layout'),r=hostRender({setup:u.setup,notes:u.notes,rate:48000,seconds:8});
 assert.deepEqual(r.probes.uke.parked,[0,1]);assert.ok(r.probes.uke.stringEnergy.slice(0,2).every(e=>e===0),'parked slots carry no energy at all');
 assert.ok(r.probes.uke.stringEnergy.slice(2).every(e=>e>1e-6));
 const notes=[note('a',.1,.5,64),note('b',.1,.5,59),note('c',.1,.5,62),note('d',1,.5,57,{fingering:{string:3,fret:5}}),note('e',2,.5,30),note('f',3,.5,60,{fingering:{string:2,fret:1}}),note('g',3,.5,61,{fingering:{string:2,fret:2}}),note('h',4,.5,64,{fingering:{string:9}})];
 const out=hostRender({setup:setupFor('rounded-steel'),notes,rate:48000,seconds:5}),codes=out.diagnostics.map(d=>`${d.code}:${d.noteId}`).sort();
 assert.deepEqual(codes,['fingering-mismatch:d','fingering-mismatch:h','out-of-range:e','retrigger-conflict:g']);
 const strings=Object.fromEntries(out.labels.map(l=>[l.id,l]));assert.ok(strings.a&&strings.b&&strings.c);
});
