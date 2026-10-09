// Plucked design schema 3: string properties as register curves keyed by open
// pitch, so a design applies to any layout (D3, D4, D7). A design names its engine
// by id and generation (GUITAR_ENGINE); at an anchor a curve returns its stored value
// with no arithmetic.
import {validateLayout} from '../../contract/index.js';
import {GUITAR_ENGINE,STRING_V2,validatePresetV2} from '../../model/instrument-v2.js';
import {NEUTRAL_SETUP} from '../../model/instrument-setup.js';

export const DESIGN_SCHEMA=3;
export const STRING_SLOTS=6;
// Positional (D3): string 1 is the first tab line, the highest string on a guitar.
export const STANDARD_GUITAR=Object.freeze({strings:Object.freeze([64,59,55,50,45,40].map(pitch=>Object.freeze({pitch}))),capo:0});
export const UKULELE=Object.freeze({strings:Object.freeze([69,64,60,67].map(pitch=>Object.freeze({pitch}))),capo:0});
const CURVES=['detuneCents','decayScale',...Object.keys(STRING_V2)];
const STEPPED=new Set(['freeRinging']);
const RANGES={detuneCents:[-25,25],decayScale:[.4,1.6],...Object.fromEntries(Object.entries(STRING_V2).map(([k,d])=>[k,[d.min,d.max]])),fret12Cents:[-30,30],fret24Cents:[-50,50]};
const copy=x=>JSON.parse(JSON.stringify(x));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

// Linear in MIDI between anchors, clamped outside; exact stored value at an anchor.
// Binary properties take the nearest anchor (the lower one on a tie).
export function curveAt(register,values,pitch,stepped=false){
 const i=register.indexOf(pitch);if(i>=0)return values[i];
 if(pitch<=register[0])return values[0];const last=register.length-1;if(pitch>=register[last])return values[last];
 let j=0;while(register[j+1]<pitch)j++;
 const a=register[j],b=register[j+1];
 if(stepped)return pitch-a<=b-pitch?values[j]:values[j+1];
 return values[j]+(values[j+1]-values[j])*((pitch-a)/(b-a));
}

// Checks a design and returns it, bringing older ones to this engine generation:
// - designs saved by 0.2.0 development builds named the engine by its source hash and
//   carried the guitar's own drive, tone and room (now chain blocks, and zero in every
//   factory design): they become generation 3;
// - generation 3 had a thwack strength (excitation.thwack) played by shadow engines.
//   Generation 4's attack soak replaced it (core-synth-performance step 1): a design that
//   used the thwack gets the factory soak, and the factory glide if it had none; one that
//   did not gets no soak.
const FACTORY_SOAK=Object.freeze({thwack_soak:6,thwack_time:.12,thwack_body:.5,thwack_treble:2});
const NO_SOAK=Object.freeze({...FACTORY_SOAK,thwack_soak:0,thwack_body:0});
const FACTORY_GLIDE=Object.freeze({tensionCents:12,tensionSeconds:.12});
function fromGeneration3(d){
 const {thwack=0,...excitation}=d.instrument.excitation,used=thwack>0,setup=d.instrument.setup;
 return {...d,engine:{id:GUITAR_ENGINE.id,generation:4},instrument:{...d.instrument,excitation,
  parameters:{...(used?FACTORY_SOAK:NO_SOAK),...d.instrument.parameters},
  setup:used&&!(setup?.tensionCents>0)?{...setup,...FACTORY_GLIDE}:setup}};
}
export function migrateDesign(source){
 let d=source;
 if(isObject(d)&&d.schemaVersion===DESIGN_SCHEMA&&d.engine?.id===GUITAR_ENGINE.id&&d.engine.generation===undefined&&isObject(d.recording)){
  d=copy(d);d.engine={id:GUITAR_ENGINE.id,generation:3};d.recording={levelDb:source.recording.levelDb};
 }
 if(isObject(d)&&d.schemaVersion===DESIGN_SCHEMA&&d.engine?.id===GUITAR_ENGINE.id&&d.engine.generation===3&&isObject(d.instrument?.excitation))d=fromGeneration3(copy(d));
 return validateDesign(d);
}
export function validateDesign(d){
 if(!isObject(d)||d.schemaVersion!==DESIGN_SCHEMA)throw Error('Plucked designs need schema 3');
 if(!isObject(d.engine)||d.engine.id!==GUITAR_ENGINE.id||d.engine.generation!==GUITAR_ENGINE.generation||Object.keys(d.engine).length!==2)throw Error(`This design needs a different guitar engine (this one is ${GUITAR_ENGINE.id} generation ${GUITAR_ENGINE.generation})`);
 const s=d.instrument?.strings;
 if(!isObject(s)||!Array.isArray(s.register)||!s.register.length||s.register.some((x,i)=>typeof x!=='number'||x<36||x>76||(i&&x<=s.register[i-1])))throw Error('Invalid register anchors: ascending open pitches 36–76');
 for(const k of CURVES){if(!Array.isArray(s[k])||s[k].length!==s.register.length)throw Error(`Curve ${k} must match the register`);for(const v of s[k])if(typeof v!=='number'||v<RANGES[k][0]||v>RANGES[k][1])throw Error(`Invalid ${k}`);}
 if(s.freeRinging.some(v=>v!==0&&v!==1))throw Error('Free ringing must be 0 or 1');
 const setup=d.instrument.setup;
 for(const k of ['fret12Cents','fret24Cents'])if(!Array.isArray(setup?.[k])||setup[k].length!==s.register.length||setup[k].some(v=>typeof v!=='number'||v<RANGES[k][0]||v>RANGES[k][1]))throw Error(`Invalid setup ${k}`);
 for(const [string,o] of Object.entries(d.instrument.overrides??{})){
  if(!/^[1-6]$/.test(string)||!isObject(o))throw Error('Overrides are keyed by string number 1–6');
  for(const [k,v] of Object.entries(o))if(!RANGES[k]||typeof v!=='number'||v<RANGES[k][0]||v>RANGES[k][1])throw Error(`Invalid override ${string}.${k}`);
 }
 validateLayout(d.defaultLayout,d.id);
 // Parameters, modes, excitation and recording keep the schema-2 rules.
 resolveDesign(d,d.defaultLayout);
 return d;
}

// Design + layout → the schema-2 preset the engine understands, one record per DSP
// slot. Active strings take the top N slots in ascending open pitch (D3); the slots
// below are parked: finger-muted, never plucked, no sympathetic participation (D7).
export function resolveDesign(d,layout=d.defaultLayout){
 validateLayout(layout,d.id);
 const n=layout.strings.length,capo=layout.capo??0,s=d.instrument.strings,setup=d.instrument.setup;
 const rank=layout.strings.map((x,i)=>i).sort((a,b)=>layout.strings[a].pitch-layout.strings[b].pitch||b-a);
 const slots=layout.strings.map((x,i)=>({string:i+1,slot:STRING_SLOTS-n+rank.indexOf(i),pitch:x.pitch,capo}));
 const at=(k,pitch)=>curveAt(s.register,k==='fret12Cents'||k==='fret24Cents'?setup[k]:s[k],pitch,STEPPED.has(k));
 const record=(pitch,string)=>{const o=d.instrument.overrides?.[String(string)]??{},v=k=>o[k]??at(k,pitch);
  return {openMidi:Math.min(76,Math.max(36,Math.round(pitch))),tuningCents:v('detuneCents'),decayScale:v('decayScale'),...Object.fromEntries(Object.keys(STRING_V2).map(k=>[k,v(k)])),
   fret12Cents:v('fret12Cents'),fret24Cents:v('fret24Cents')};};
 const records=Array(STRING_SLOTS),lowest=Math.min(...layout.strings.map(x=>x.pitch));
 for(const x of slots)records[x.slot]=record(x.pitch,x.string);
 const parked=[];for(let i=0;i<STRING_SLOTS-n;i++){parked.push(i);records[i]={...record(lowest),freeRinging:0};}
 const {strings:_,setup:__,overrides:___,...instrument}=copy(d.instrument);
 const preset={schemaVersion:2,id:d.id,name:d.name,family:d.family,description:d.description,factory:d.factory,
  instrument:{...instrument,strings:records.map(({fret12Cents,fret24Cents,...r})=>r),
   setup:{fret12Cents:records.map(r=>r.fret12Cents),fret24Cents:records.map(r=>r.fret24Cents),tensionCents:setup.tensionCents,tensionSeconds:setup.tensionSeconds}},
  recording:copy(d.recording)};
 validatePresetV2(preset);
 return {preset,slots,parked,slotOf:new Map(slots.map(x=>[x.string,x.slot]))};
}
export const isNeutralSetup=s=>s.tensionCents===0&&s.fret12Cents.every(x=>x===0)&&s.fret24Cents.every(x=>x===0);
export {NEUTRAL_SETUP};
