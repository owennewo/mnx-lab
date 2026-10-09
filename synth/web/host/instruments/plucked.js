// The plucked instrument: the Engine2 guitar (live thwack engine) driven by
// contract notes. Designs are schema-3 register curves resolved onto a layout;
// unused DSP slots are parked. Plans are recompiled from the whole note set on
// every change and only events at or after the engine position are handed over,
// which is what makes batched and all-at-once schedules render identically.
import {CAPABILITIES,diagnostic} from '../../contract/index.js';
import {GuitarEngine} from '../../audio/engine.js';
import {LiveThwackEngine} from '../../audio/live-thwack.js';
import {baseControls} from '../../model/presets.js';
import {STRING_V2} from '../../model/instrument-v2.js';
import {LEGACY_NOTE_POLICY} from '../../model/note-ownership.js';
import {migrateDesign,resolveDesign} from './plucked-design.js';
import {planPlucked,gestureEntries} from './plucked-plan.js';
import {layoutCompensationDb,loudnessCurve} from './plucked-loudness.js';
import {forgetLeading} from './forget.js';

const seedOf=id=>{let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h||1;};
export class Plucked{
 static kind='plucked';
 static capabilities=CAPABILITIES.plucked;
 static migrateDesign=migrateDesign;
 constructor({part,rate,block,assets,emit=()=>{}}){
  if(!assets?.guitar)throw Error('Plucked instrument needs the Engine2 guitar asset');
  this.rate=rate;this.block=block;this.emit=emit;this.assets=assets;
  const {module,meta}=assets.guitar;this.engine=new (meta.liveThwack?LiveThwackEngine:GuitarEngine)(module,meta,rate,block);
  this.entries=new Map();this.started=false;this.reported=new Set();this.out=null;this.stringEnergy=new Float64Array(6);
  this.configure(part);
 }
 // Factory designs by id; own designs keep the id of the factory design they came
 // from as `basis`, which selects their loudness curve.
 design(part){
  const d=part.instrument.design;
  if(typeof d==='string'){const factory=this.assets.factory?.find(p=>p.id===d);if(!factory)throw Error(`Unknown plucked design ${d}`);return {...migrateDesign(factory),basis:d};}
  return {...migrateDesign(d),basis:d.basis,source:d.source,trimDb:d.trimDb};
 }
 configure(part){
  const design=this.design(part),resolved=resolveDesign(design,part.instrument.layout??design.defaultLayout),p=resolved.preset;
  const params=baseControls(p);delete params.coupling;
  for(let i=0;i<6;i++){params[`s${i}-sustain`]=0;for(const [k,d] of Object.entries(STRING_V2))params[`s${i}-${d.dsp}`]=p.instrument.strings[i][k];}
  this.resolved=resolved;this.params=params;this.thwack=p.instrument.excitation.thwack;this.seed=part.seed??seedOf(part.id);
  // The design's level, the layout's loudness compensation, then the design's Level trim.
  const layout=part.instrument.layout??design.defaultLayout,trim=Number.isFinite(design.trimDb)?Math.min(24,Math.max(-24,design.trimDb)):0;
  this.compensationDb=layoutCompensationDb(loudnessCurve(this.assets.loudness,design),layout);
  this.outputGain=10**((p.recording.levelDb+this.compensationDb+trim)/20);
  if(this.started){this.engine.update(params,undefined,.04);this.engine.setThwack?.(this.thwack);this.replan();}
  else this.replan();
 }
 apply({notes=[],removed=[]}){
  for(const id of removed)this.entries.delete(id);
  for(const e of notes)this.entries.set(e.id,e);
  this.replan();
 }
 // Notes the host has forgotten fold into `memory`, what the planner carries from note to
 // note (forget.js): the plan of the rest is unchanged, and stays small.
 forget(ids){
  forgetLeading(this,ids,()=>gestureEntries([...this.entries.values()],this.resolved,this.rate,this.memory),
   prefix=>{this.memory=planPlucked(prefix,this.resolved,this.rate,this.memory,Infinity).state;});
 }
 replan(){
  const {events,diagnostics,assigned}=planPlucked(gestureEntries([...this.entries.values()],this.resolved,this.rate,this.memory),this.resolved,this.rate,this.memory,this.started?this.engine.position:-Infinity);this.assigned=assigned;
  for(const d of diagnostics){const key=`${d.code}:${d.noteId}`;if(!this.reported.has(key)){this.reported.add(key);this.emit('diagnostic',d);}}
  // Before the first block the engine loads exactly as processor.js loads a packet.
  // Excitation off until each string's first pluck (the planner gates it per pluck).
  if(!this.started){this.engine.reset({...this.params,...Object.fromEntries([0,1,2,3,4,5].map(s=>[`s${s}-excite`,0]))},events,this.seed,LEGACY_NOTE_POLICY);this.engine.setThwack?.(this.thwack);}
  else this.engine.update({},events);
 }
 // The first rendered host frame: the engine counts in host frames from there.
 begin(frame){this.engine.position=frame;}
 render(n){
  this.started=true;const y=this.engine.render(n);
  // Channels 3–8 are the six string signals: cheap per-slot energy for conformance probes.
  for(let s=0;s<6;s++){const x=y[3+s];let e=0;for(let i=0;i<n;i++)e+=x[i]*x[i];this.stringEnergy[s]+=e;}
  this.out??=[y[0],y[1]];return this.out;
 }
 // Planned onsets: string and frame per note, after chord gestures.
 probe(){return {stringEnergy:[...this.stringEnergy],slots:this.resolved.slots.map(x=>({...x})),parked:[...this.resolved.parked],
  notes:Object.fromEntries([...(this.assigned??new Map()).values()].map(a=>[a.entry.id,{string:a.string,frame:a.entry.frame}]))};}
}
