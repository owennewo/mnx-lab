// Conformance fixtures: an event log (optionally as ordered batches with cancels)
// plus measurable expectations. Measurement itself lives in the conformance runner.
import {CONTRACT} from '../core.js';
import {ContractError,validateSetup,validateNote,validateControl,sessionControl} from '../validate.js';

const fail=(id,m)=>{throw new ContractError(m,id);};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const num=(x,min,max,id,label)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)fail(id,`${label} must be a number in ${min}–${max}`);};
const str=(x,id,label)=>{if(typeof x!=='string'||!x)fail(id,`${label} must be a non-empty string`);};
// Closed list, versioned with the kit. Each entry: required references, numeric fields [min,max], optional numeric fields.
// Levels in dB are relative to the measured note's own peak unless named dbfs/aboveDb on a part.
//  pitch          tracked f0 (40 ms windows; skips 30 ms after attacks and glides >50 cents/window) over [from,to]
//                 of the note vs nominal pitch, plus the commanded technique curve when curve='commanded':
//                 median |error| ≤ toleranceCents and max ≤ maxCents
//  noNewAttack    rise in >2 kHz energy at the note's onset ≤ maxFluxRatio (0.25) × that of the same note freshly struck
//  decayRatio     time to −40 dB of note ÷ that of reference ≤ max
//  silentWithin   note below belowDb within seconds of its onset
//  sustainedPast  note still above aboveDb, seconds after its written end
//  releasedWithin part below belowDb within seconds of the control (re its level at the control)
//  choked         note below belowDb within seconds of the onset of `by`
//  distinctPieces pairwise feature distance (log spectral centroid, log decay time) ≥ minDistance (1)
//  activeStrings  plucked strings with any excitation or energy = count (parked strings stay silent)
//  partActive     part peak above aboveDb dBFS;   clickFree  part first difference ≤ maxStep
//  onsetAt        the note sounds `seconds` after its written onset (−20 dB re its peak, 1 ms steps, the
//                 other notes at velocity 0, re the same note alone without its gesture), within
//                 toleranceSeconds (3 ms): chord gestures
//  peakBelow      master peak ≤ dbfs;   diagnostic  a diagnostic with code (and note) was emitted;
//  noDiagnostics  nothing at or above severity (default warning) was emitted
export const EXPECTATIONS=Object.freeze({
 pitch:{ref:['note'],enums:{curve:['commanded','nominal']},numbers:{toleranceCents:[0,100],maxCents:[0,200]},optional:{from:[0,1],to:[0,1]}},
 noNewAttack:{ref:['note'],numbers:{},optional:{maxFluxRatio:[0,1]}},
 decayRatio:{ref:['note','reference'],numbers:{max:[0,1]}},
 silentWithin:{ref:['note'],numbers:{seconds:[0,10],belowDb:[-120,0]}},
 sustainedPast:{ref:['note'],numbers:{seconds:[0,30],aboveDb:[-120,0]}},
 releasedWithin:{ref:['control'],numbers:{seconds:[0,10],belowDb:[-120,0]}},
 choked:{ref:['note','by'],numbers:{seconds:[0,1],belowDb:[-120,0]}},
 distinctPieces:{ref:[],numbers:{},optional:{minDistance:[0,10]},list:'notes'},
 activeStrings:{ref:['part'],numbers:{count:[0,6]}},
 partActive:{ref:['part'],numbers:{aboveDb:[-120,0]}},
 clickFree:{ref:[],numbers:{maxStep:[0,2]},optional:{},part:true},
 onsetAt:{ref:['note'],numbers:{seconds:[0,2]},optional:{toleranceSeconds:[0,.1]}},
 peakBelow:{ref:[],numbers:{dbfs:[-60,0]}},
 diagnostic:{ref:[],numbers:{},code:true},
 noDiagnostics:{ref:[],numbers:{},enums:{severity:['info','warning','error']}},
});

// Apply batches in order. Within a batch the cancel comes first (as a seek does):
// notes and controls at or after `from` go; notes that started earlier keep playing,
// because cutting them would rewrite sound already committed. Then notes and controls
// upsert by id. The result is what an all-at-once schedule contains.
export function effectiveEvents(f){
 const notes=new Map(),controls=new Map();
 for(const b of f.batches??[{notes:f.notes??[],controls:f.controls??[]}]){
  const c=b.cancel;
  if(c?.from!==undefined){
   for(const [id,n] of notes)if(n.at>=c.from)notes.delete(id);
   for(const [id,x] of controls)if(x.at>=c.from)controls.delete(id);
  }
  for(const id of c?.ids??[]){notes.delete(id);controls.delete(id);}
  for(const n of b.notes??[])notes.set(n.id,n);
  for(const x of b.controls??[])controls.set(x.id,x);
 }
 const order=(a,b)=>a.at-b.at||(a.id<b.id?-1:a.id>b.id?1:0);
 return {notes:[...notes.values()].sort(order),controls:[...controls.values()].sort(order)};
}

export function validateFixture(f){
 if(!isObject(f)||f.contract!==CONTRACT)fail(undefined,`fixture.contract must be '${CONTRACT}'`);
 if(!isObject(f.fixture))fail(undefined,'fixture.fixture must be an object');
 const id=f.fixture.id;str(id,undefined,'fixture.id');str(f.fixture.description,id,'fixture.description');
 validateSetup(f.setup);const parts=new Set(f.setup.parts.map(p=>p.id));
 if(f.batches!==undefined&&(f.notes!==undefined||f.controls!==undefined))fail(id,'use either batches or notes/controls, not both');
 const batches=f.batches??[{notes:f.notes??[],controls:f.controls??[]}];
 if(!Array.isArray(batches)||!batches.length)fail(id,'batches must be a non-empty array');
 const seen=new Map();let through=-Infinity;
 for(const b of batches){
  if(!isObject(b))fail(id,'batch must be an object');
  const ids=[...(b.notes??[]),...(b.controls??[])].map(x=>x?.id);if(new Set(ids).size!==ids.length)fail(id,'an id appears twice in one batch');
  if(b.through!==undefined){num(b.through,0,86400,id,'batch.through');if(b.through<through)fail(id,'batch.through must not decrease');through=b.through;}
  for(const n of b.notes??[]){validateNote(n);if(!parts.has(n.part))fail(n.id,`unknown part ${n.part}`);seen.set(n.id,n);
   const l=n.techniques?.find(t=>t.type==='legato');if(l){const from=seen.get(l.from);if(!from||from.part!==n.part||!(from.at<n.at))fail(n.id,'legato.from must name an earlier note on the same part');}}
  for(const c of b.controls??[]){validateControl(c);if(!sessionControl(c)&&!parts.has(c.part))fail(c.id,`unknown part ${c.part}`);seen.set(c.id,c);}
  if(b.cancel!==undefined){
   const c=b.cancel;if(!isObject(c)||(c.from===undefined)===(c.ids===undefined))fail(id,'cancel needs exactly one of from or ids');
   if(c.from!==undefined)num(c.from,0,86400,id,'cancel.from');
   if(c.ids!==undefined&&(!Array.isArray(c.ids)||c.ids.some(x=>typeof x!=='string')))fail(id,'cancel.ids must be an array of ids');
  }
 }
 if(!isObject(f.render)||![44100,48000,96000].includes(f.render.rate))fail(id,'render.rate must be 44100, 48000 or 96000');
 num(f.render.seconds,.1,120,id,'render.seconds');
 if(!Array.isArray(f.expect)||!f.expect.length)fail(id,'expect must be a non-empty array');
 const {notes,controls}=effectiveEvents(f),noteIds=new Set(notes.map(n=>n.id)),controlIds=new Set(controls.map(c=>c.id));
 for(const e of f.expect){
  const spec=isObject(e)&&EXPECTATIONS[e.kind];if(!spec)fail(id,`unknown expectation kind ${e?.kind}`);
  for(const r of spec.ref){str(e[r],id,`${e.kind}.${r}`);
   const ok=r==='part'?parts.has(e[r]):r==='control'?controlIds.has(e[r]):noteIds.has(e[r]);if(!ok)fail(id,`${e.kind}.${r} names nothing in the effective event log: ${e[r]}`);}
  for(const [k,[lo,hi]] of Object.entries(spec.numbers))num(e[k],lo,hi,id,`${e.kind}.${k}`);
  for(const [k,[lo,hi]] of Object.entries(spec.optional??{}))if(e[k]!==undefined)num(e[k],lo,hi,id,`${e.kind}.${k}`);
  for(const [k,values] of Object.entries(spec.enums??{}))if(e[k]!==undefined||k==='curve')if(!values.includes(e[k]))fail(id,`${e.kind}.${k} must be one of ${values.join(', ')}`);
  if(spec.list&&(!Array.isArray(e[spec.list])||e[spec.list].length<2||e[spec.list].some(x=>!noteIds.has(x))))fail(id,`${e.kind}.${spec.list} must list at least two notes in the log`);
  if(spec.code)str(e.code,id,'diagnostic.code');
  if(spec.part&&e.part!==undefined&&!parts.has(e.part))fail(id,`${e.kind}.part names no part`);
  if(e.kind==='pitch'&&e.from!==undefined&&e.to!==undefined&&!(e.from<e.to))fail(id,'pitch.from must be before pitch.to');
 }
 return f;
}
