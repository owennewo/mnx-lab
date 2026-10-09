// Instrument host core (chain campaign): parts (instrument → insert chain → channel
// strip), return buses fed by the strips' sends, and a master with a limiter. Shared
// by the AudioWorklet processor and offline rendering; no DOM, no clock of its own.
import {CAPABILITIES,DEFAULT_BPM,GESTURES,frameAt,diagnostic,validateSetup,validateNote,validateControl,lower,knownControl,sessionControl,gestureGroups,pitchOrder,gestureTimes} from '../contract/index.js';
import {FaustNode} from './faust-node.js';
import {BLOCK_TYPES,BlockNode,resolveParams,MASTER_PARAMS} from './blocks.js';

const dbToGain=db=>10**(db/20);
const RAMP_SECONDS=.02,DUCK_SECONDS=.01;
// Notes that ended this long ago are forgotten (HostCore.forget).
export const FORGET_SECONDS=2;

// Ordered insert chain of one part. Blocks keep their DSP while their id survives;
// new blocks fade in, removed ones fade out, a reorder dips the part for 2 × 10 ms.
class Chain{
 constructor(host,part){this.host=host;this.part=part;this.nodes=new Map();this.order=[];this.pending=null;}
 configure(blocks,initial,diagnostics){
  const host=this.host,next=[];
  for(const b of blocks){
   const def=BLOCK_TYPES[b.type];
   if(!def||def.role!=='effect'||!host.assets.blocks?.[b.type]){diagnostics.push(diagnostic('unsupported-block',{part:this.part.id,block:b.id,type:b.type}));continue;}
   const {params,problems}=resolveParams(b.type,b.params);
   for(const message of problems)diagnostics.push(diagnostic('invalid-block',{part:this.part.id,block:b.id,message}));
   let node=this.nodes.get(b.id);
   if(node&&node.type!==b.type){this.nodes.delete(b.id);node=null;}
   if(!node){node=new BlockNode(host.assets.blocks[b.type],b.type,host.rate,host.block);this.nodes.set(b.id,node);}
   node.params=params;node.configure(b.state??'on',def.controls(params,{bpm:host.bpm}),{fade:!initial});node.leaving=false;next.push(b.id);
  }
  const keep=new Set(next),survivors=this.order.filter(id=>keep.has(id)),reordered=survivors.join('\n')!==next.filter(id=>this.order.includes(id)).join('\n');
  for(const id of this.order)if(!keep.has(id)){const node=this.nodes.get(id);node.configure('removed',node.controls);node.leaving=true;}
  // Leaving blocks fade out where they were: after their nearest surviving predecessor.
  const order=[...next];
  this.order.forEach((id,i)=>{if(keep.has(id))return;let k=i-1;while(k>=0&&!order.includes(this.order[k]))k--;order.splice(k<0?0:order.indexOf(this.order[k])+1,0,id);});
  if(reordered&&!initial)this.pending=order;else this.order=order;
 }
 // Tempo-synced blocks (echo) follow a tempo change from its frame on.
 retempo(bpm){for(const node of this.nodes.values())if(node.params&&!node.leaving)node.configure(node.state,BLOCK_TYPES[node.type].controls(node.params,{bpm}));}
 render(input,n){
  let x=input;
  for(const id of this.order)x=this.nodes.get(id).render(x,n);
  for(const id of this.order){const node=this.nodes.get(id);if(node.leaving&&node.asleep){this.nodes.delete(id);this.order=this.order.filter(x=>x!==id);}}
  return x;
 }
}

class Part{
 constructor(host,setup){
  const {rate,block}=host;this.host=host;this.id=setup.id;this.kind=setup.instrument.kind;
  const Kind=host.instruments.get(this.kind);
  this.capabilities=Kind?.capabilities??CAPABILITIES[this.kind];
  this.instrument=Kind?new Kind({part:setup,rate,block,assets:host.assets.instruments?.[this.kind],emit:host.emit}):null;
  this.chain=new Chain(host,this);this.out=[new Float32Array(block),new Float32Array(block)];
  this.notes=new Map();this.controls=new Map();this.muteEvents=[];this.controlMute=false;
  this.gain=0;this.gainStep=1-Math.exp(-1/(rate*.01));this.mute=1;this.muteStep=1/(rate*.005);this.duck=1;this.duckStep=1/(rate*DUCK_SECONDS);
  this.begun=false;this.sends=new Map();this.peak=0;
 }
 get horizonFrames(){return Math.ceil((this.capabilities?.horizonSeconds??0)*this.host.rate);}
 configure(setup,initial,diagnostics){
  this.setup=setup;
  if(!initial&&this.instrument)this.instrument.configure(setup);
  const strip=setup.strip??{};
  this.targetGain=(this.instrument?.outputGain??1)*dbToGain(strip.levelDb??0);
  if(initial)this.gain=this.targetGain;
  // Balance law: unity on both sides at the centre.
  const pan=strip.pan??0;this.panL=Math.min(1,1-pan);this.panR=Math.min(1,1+pan);
  this.stripMute=!!strip.mute;this.solo=!!strip.solo;
  this.sends=new Map(Object.entries(strip.sends??{}).filter(([,v])=>v>0));
  if(initial)this.mute=this.muteTarget;
  this.chain.configure(setup.chain??[],initial,diagnostics);
 }
 get muteTarget(){return this.stripMute||this.controlMute||(this.host.anySolo&&!this.solo)?0:1;}
 render(n){
  const host=this.host,start=host.position;
  if(!this.begun){this.begun=true;this.instrument.begin?.(start);}
  const [L,R]=this.out,y=this.chain.render(this.instrument.render(n),n);
  let event=this.muteEvents.length&&this.muteEvents[0].frame<start+n?0:-1,target=this.muteTarget;
  const settled=event<0&&this.mute===target&&this.gain===this.targetGain&&this.duck===1&&!this.chain.pending;
  if(settled){const g=this.gain*this.mute,pl=g*this.panL,pr=g*this.panR,[a,b]=y;for(let i=0;i<n;i++){L[i]=a[i]*pl;R[i]=b[i]*pr;}return this.out;}
  for(let i=0;i<n;i++){
   if(event>=0)while(event<this.muteEvents.length&&this.muteEvents[event].frame<=start+i){this.controlMute=!!this.muteEvents[event++].value;target=this.muteTarget;}
   this.gain+=(this.targetGain-this.gain)*this.gainStep;if(Math.abs(this.targetGain-this.gain)<1e-7)this.gain=this.targetGain;
   if(this.mute!==target)this.mute=this.mute<target?Math.min(target,this.mute+this.muteStep):Math.max(target,this.mute-this.muteStep);
   // A pending reorder dips the part, swaps the order at silence, and comes back.
   if(this.chain.pending){this.duck=Math.max(0,this.duck-this.duckStep);if(this.duck===0){this.chain.order=this.chain.pending;this.chain.pending=null;}}
   else if(this.duck<1)this.duck=Math.min(1,this.duck+this.duckStep);
   const g=this.gain*this.mute*this.duck;L[i]=y[0][i]*g*this.panL;R[i]=y[1][i]*g*this.panR;
  }
  if(event>0)this.muteEvents.splice(0,event);
  return this.out;
 }
}

// A return bus: the sum of the parts' sends through its block. Off stops feeding it (a
// 20 ms ramp) and lets the tail ring out; after 0.5 s of quiet it is not computed.
const QUIET=1e-7,SLEEP_SECONDS=.5;
class Bus{
 constructor(host,setup){this.host=host;this.id=setup.id;this.type=setup.type;this.node=new FaustNode(host.assets.blocks[setup.type].module,host.assets.blocks[setup.type].meta,host.rate,host.block);
  this.input=[new Float32Array(host.block),new Float32Array(host.block)];this.g=0;this.gTarget=0;this.quiet=0;this.step=1/(host.rate*RAMP_SECONDS);this.asleep=true;}
 configure(setup,initial,diagnostics){
  const {params,problems}=resolveParams(this.type,setup.params);
  for(const message of problems)diagnostics.push(diagnostic('invalid-block',{bus:this.id,message}));
  this.params=params;this.controls=BLOCK_TYPES[this.type].controls(params,{bpm:this.host.bpm});this.node.set(this.controls);
  this.gTarget=(setup.state??'on')==='off'?0:1;if(initial)this.g=this.gTarget;
  if(this.gTarget&&this.asleep){this.node.reset(this.controls);this.asleep=false;this.quiet=0;}
 }
 retempo(bpm){this.controls=BLOCK_TYPES[this.type].controls(this.params,{bpm});this.node.set(this.controls);}
 render(n){
  if(this.asleep)return null;
  if(this.g!==1||this.gTarget!==1){const [L,R]=this.input;let g=this.g;for(let i=0;i<n;i++){g=g<this.gTarget?Math.min(this.gTarget,g+this.step):Math.max(this.gTarget,g-this.step);L[i]*=g;R[i]*=g;}this.g=g;}
  const y=this.node.render(this.input,n);
  if(this.gTarget===0&&this.g===0){let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(y[0][i]),Math.abs(y[1][i]));this.quiet=peak<QUIET?this.quiet+n:0;if(this.quiet>=SLEEP_SECONDS*this.host.rate)this.asleep=true;}
  return y;
 }
}

export class HostCore{
 // `history: false` (the worklet) drops forgotten notes; offline keeps them for labels.
 constructor({rate,block=128,instruments,assets,history=true}){
  this.rate=rate;this.history=history;this.block=block;this.instruments=instruments instanceof Map?instruments:new Map(Object.entries(instruments??{}));this.assets=assets;
  this.listeners=new Map();this.emit=(type,data)=>{for(const fn of this.listeners.get(type)??[])fn(data);};
  this.master=new FaustNode(assets.blocks.master.module,assets.blocks.master.meta,rate,block);
  this.position=0;this.parts=new Map();this.buses=new Map();this.through=-Infinity;this.session={};this.bpm=DEFAULT_BPM;this.tempos=new Map();this.tempoEvents=[];this.anySolo=false;
  this.mix=[new Float32Array(block),new Float32Array(block)];this.output=[new Float32Array(block),new Float32Array(block)];
  this.limited=0;this.blocks=0;this.pendingOnsets=[];this.profiling=null;
 }
 // Cost metering: wall time per part (instrument, chain and strip), per bus and for the
 // master, and per block against the real-time budget. Off unless asked for.
 profile(on=true,clock=globalThis.performance?.now?.bind(globalThis.performance)??Date.now){
  this.profiling=on?{clock,blocks:0,totalMs:0,maximumMs:0,overBudget:0,frames:0,parts:{}}:null;
 }
 profileSnapshot(){
  const p=this.profiling;if(!p)return null;
  const audioSeconds=p.frames/this.rate,parts=Object.fromEntries(Object.entries(p.parts).map(([id,x])=>[id,{kind:x.kind,ms:x.ms,msPerAudioSecond:x.ms/Math.max(1e-9,audioSeconds)}]));
  return {clock:p.clock===Date.now?'Date.now (1 ms)':'performance.now',blocks:p.blocks,audioSeconds,totalMs:p.totalMs,maximumMs:p.maximumMs,overBudget:p.overBudget,budgetMs:this.block/this.rate*1000,realTimeFactor:audioSeconds*1000/Math.max(1e-9,p.totalMs),parts};
 }
 on(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);return ()=>this.listeners.get(type).delete(fn);}
 get seconds(){return this.position/this.rate;}
 get horizonFrames(){let h=0;for(const p of this.parts.values())h=Math.max(h,p.horizonFrames);return h;}

 configure(setup){
  validateSetup(setup);const diagnostics=[],initial=!this.setup;
  this.session=setup.session;
  const m=setup.session.master??{};
  this.master.set({volume:m.volumeDb??MASTER_PARAMS.volumeDb.default,ceiling:m.ceilingDb??MASTER_PARAMS.ceilingDb.default});
  const buses=new Map();
  for(const b of setup.session.buses??[]){
   if(BLOCK_TYPES[b.type]?.role!=='bus'||!this.assets.blocks?.[b.type]){diagnostics.push(diagnostic('unsupported-block',{bus:b.id,type:b.type}));continue;}
   let bus=this.buses.get(b.id);if(!bus||bus.type!==b.type)bus=new Bus(this,b);
   bus.configure(b,initial||!this.buses.has(b.id),diagnostics);buses.set(b.id,bus);
  }
  this.buses=buses;this.anySolo=setup.parts.some(p=>p.strip?.solo);
  const next=new Map();
  for(const p of setup.parts){
   const old=this.parts.get(p.id);
   if(old&&old.kind===p.instrument.kind){old.configure(p,false,diagnostics);next.set(p.id,old);continue;}
   const part=new Part(this,p);next.set(p.id,part);
   if(!part.instrument)diagnostics.push(diagnostic('unsupported-kind',{part:p.id,kind:p.instrument.kind}));
   part.configure(p,true,diagnostics);
  }
  this.parts=next;this.setup=setup;
  return this.report(diagnostics);
 }
 report(diagnostics){for(const d of diagnostics)this.emit('diagnostic',d);return diagnostics;}

 // Upsert notes and controls by id. Anything at or after `committed` (now plus the
 // part's horizon) may change; earlier onsets play as scheduled (D15).
 schedule({notes=[],controls=[],through}={}){
  this.forget();
  const diagnostics=[],changes=new Map(),gestured=new Map(),change=part=>{if(!changes.has(part))changes.set(part,{notes:[],removed:[],controls:[],removedControls:[]});return changes.get(part);};
  const ordered=[...notes].sort((a,b)=>(a?.at??0)-(b?.at??0));
  for(const n of ordered){
   try{validateNote(n);}catch(e){diagnostics.push(diagnostic('invalid-note',{noteId:n?.id,message:e.message}));continue;}
   const part=this.parts.get(n.part);
   if(!part){diagnostics.push(diagnostic('invalid-note',{noteId:n.id,part:n.part,message:`unknown part ${n.part}`}));continue;}
   if(!part.instrument)continue;
   const frame=frameAt(n.at,this.rate),committed=this.position+part.horizonFrames,old=part.notes.get(n.id);
   if(old&&(old.frame<committed||frame<committed)){diagnostics.push(diagnostic('late-edit',{noteId:n.id,part:part.id,at:n.at}));continue;}
   if(!old&&frame<committed)diagnostics.push(diagnostic('late-note',{noteId:n.id,part:part.id,at:n.at}));
   const entry=this.lowerNote(part,n,diagnostics);part.notes.set(n.id,entry);change(part).notes.push(entry);
   this.pendingOnsets.push({frame:entry.frame,part:part.id,id:n.id});
   if(n.gesture){if(!GESTURES.includes(n.gesture.type))diagnostics.push(diagnostic('unknown-gesture',{noteId:n.id,part:part.id,gesture:n.gesture.type}));else (gestured.get(part)??gestured.set(part,new Set()).get(part)).add(n.gesture.id);}
  }
  for(const [part,ids] of gestured)this.timeGestures(part,ids,change(part),diagnostics);
  for(const c of controls){
   try{validateControl(c);}catch(e){diagnostics.push(diagnostic('invalid-control',{controlId:c?.id,message:e.message}));continue;}
   if(sessionControl(c)){this.scheduleTempo(c,diagnostics);continue;}
   const part=this.parts.get(c.part);
   if(!part){diagnostics.push(diagnostic('invalid-control',{controlId:c.id,part:c.part,message:`unknown part ${c.part}`}));continue;}
   if(!knownControl(c)){diagnostics.push(diagnostic('unknown-control',{controlId:c.id,part:part.id,control:c.type}));continue;}
   const frame=frameAt(c.at,this.rate),committed=this.position+part.horizonFrames,old=part.controls.get(c.id);
   if(old&&(old.frame<committed||frame<committed)){diagnostics.push(diagnostic('late-edit',{controlId:c.id,part:part.id,at:c.at}));continue;}
   if(c.type!=='mute'&&!part.capabilities.controls.includes(c.type)){diagnostics.push(diagnostic('dropped',{controlId:c.id,part:part.id,control:c.type}));continue;}
   const entry={id:c.id,frame,control:c};part.controls.set(c.id,entry);
   if(c.type==='mute')this.rebuildMutes(part);else if(part.instrument)change(part).controls.push(entry);
  }
  if(through!==undefined)this.through=Math.max(this.through,through);
  for(const [part,c] of changes)part.instrument.apply(c);
  if(this.pendingOnsets.length)this.pendingOnsets.sort((a,b)=>a.frame-b.frame);
  return this.report(diagnostics);
 }
 // Forgetting. Every batch re-plans an instrument's remembered notes, so remembering every
 // note of a long piece makes each batch cost more than the last until the audio thread
 // misses its deadlines (a skipping guitar some minutes in). Notes that ended
 // FORGET_SECONDS ago, and that no remembered note leads from by legato, go to the
 // instrument's `forget`; it folds them into what its planner carries from note to note,
 // so what it plays is unchanged (tests/forgetting.test.mjs). An instrument without
 // `forget` keeps them. Live, the host drops them too; offline it keeps them for labels.
 forget(){
  const cutoff=this.position-Math.round(FORGET_SECONDS*this.rate);
  for(const part of this.parts.values()){
   if(!part.instrument?.forget)continue;
   part.forgotten??=new Set();
   const old=[],kept=[];
   for(const e of part.notes.values())if(!part.forgotten.has(e.id))(e.endFrame<cutoff?old:kept).push(e);
   if(!old.length)continue;
   const reached=new Set(kept.map(e=>e.id)),stack=[...kept];
   while(stack.length){
    const from=stack.pop().note.techniques?.find(t=>t.type==='legato')?.from,e=from&&part.notes.get(from);
    if(e&&!reached.has(from)){reached.add(from);stack.push(e);}
   }
   const ids=old.filter(e=>!reached.has(e.id)).map(e=>e.id);
   if(!ids.length)continue;
   part.instrument.forget(ids);
   for(const id of ids)if(this.history)part.forgotten.add(id);else part.notes.delete(id);
  }
 }
 // Tempo is session-wide; the commit horizon is the longest part horizon.
 scheduleTempo(c,diagnostics){
  const frame=frameAt(c.at,this.rate),committed=this.position+this.horizonFrames,old=this.tempos.get(c.id);
  if(old&&(old.frame<committed||frame<committed)){diagnostics.push(diagnostic('late-edit',{controlId:c.id,at:c.at}));return;}
  this.tempos.set(c.id,{id:c.id,frame,bpm:c.bpm});this.rebuildTempo();
 }
 // Pending tempo changes in frame order (ties by id); one already due applies at the next frame rendered.
 rebuildTempo(){this.tempoEvents=[...this.tempos.values()].filter(e=>e.frame>=this.position||!e.applied).sort((a,b)=>a.frame-b.frame||(a.id<b.id?-1:1));}
 applyTempo(){
  let changed=false;
  while(this.tempoEvents.length&&this.tempoEvents[0].frame<=this.position){const e=this.tempoEvents.shift();e.applied=true;changed=changed||e.bpm!==this.bpm;this.bpm=e.bpm;}
  if(changed){for(const part of this.parts.values())part.chain.retempo(this.bpm);for(const bus of this.buses.values())bus.retempo(this.bpm);}
 }
 // Chord gestures (C18). Instruments that play them natively (the plucked instrument,
 // in string order) get the notes as written; for the others the host times the
 // members by pitch. A member already inside the commit horizon keeps its timing.
 timeGestures(part,ids,c,diagnostics){
  const native=part.capabilities.gestures??[];
  for(const gid of ids){
   const {groups,mismatched}=gestureGroups([...part.notes.values()].filter(e=>e.note.gesture?.id===gid).map(e=>e.note));
   for(const n of mismatched)diagnostics.push(diagnostic('gesture-mismatch',{noteId:n.id,part:part.id,gesture:gid}));
   const members=groups.get(gid);if(!members||native.includes(members[0].gesture.type))continue;
   if(members[0].gesture.type==='strum')diagnostics.push(diagnostic('approximated',{noteId:members[0].id,part:part.id,technique:'strum',primitives:['onset'],message:'Strum played by pitch: this instrument has no strings'}));
   const committed=this.position+part.horizonFrames;
   for(const [id,t] of gestureTimes(pitchOrder(members,members[0].gesture),members[0].gesture)){
    const old=part.notes.get(id),entry=this.lowerNote(part,{...old.note,...t},[]);entry.note=old.note;
    if(entry.frame===old.frame&&entry.endFrame===old.endFrame)continue;
    if(old.frame<committed&&entry.frame!==old.frame)continue;
    part.notes.set(id,entry);c.notes.push(entry);this.pendingOnsets.push({frame:entry.frame,part:part.id,id});
   }
  }
 }
 lowerNote(part,n,diagnostics){
  const lowered=lower(n,part.capabilities,{resolve:id=>part.notes.get(id)?.note});
  diagnostics.push(...lowered.diagnostics);
  if(part.kind==='kit'&&n.target.piece!==undefined&&!part.capabilities.pieces.includes(n.target.piece))diagnostics.push(diagnostic('unknown-piece',{noteId:n.id,part:part.id,piece:n.target.piece}));
  const frame=frameAt(n.at,this.rate);
  // lengthFrames is the lowered gate that curves are positioned on; endFrame may later be cut.
  const endFrame=Math.max(frame+1,frameAt(n.at+lowered.note.duration,this.rate));
  return {id:n.id,note:n,lowered:lowered.note,primitives:lowered.primitives,frame,endFrame,lengthFrames:endFrame-frame};
 }
 rebuildMutes(part){part.muteEvents=[...part.controls.values()].filter(e=>e.control.type==='mute'&&e.frame>=this.position).sort((a,b)=>a.frame-b.frame).map(e=>({frame:e.frame,value:e.control.value}));}

 // cancel({from}): notes and controls at or after `from` go; started notes keep playing
 // (invariant when `from` is at or after the commit point). cancel({ids}): those go.
 // silence: also cut notes sounding at `from` (or now, for ids): only their gate end
 // moves, so curves keep their timing. A seek/stop, outside the invariance promise.
 cancel({from,ids,silence=false}={}){
  for(const part of this.parts.values()){
   if(!part.instrument)continue;
   const c={notes:[],removed:[],controls:[],removedControls:[]};
   const drop=(entry,frame,cut)=>{
    if(entry.frame>=frame){part.notes.delete(entry.id);c.removed.push(entry.id);return;}
    if(cut&&entry.endFrame>frame){const next={...entry,endFrame:frame,cut:true};part.notes.set(entry.id,next);c.notes.push(next);}
   };
   if(from!==undefined){
    const frame=Math.max(this.position,frameAt(from,this.rate));
    for(const entry of [...part.notes.values()])drop(entry,frame,silence);
    for(const [id,e] of [...part.controls])if(e.frame>=frame){part.controls.delete(id);c.removedControls.push(id);}
   }
   for(const id of ids??[]){
    const entry=part.notes.get(id);if(entry)drop(entry,this.position,silence);
    if(part.controls.get(id)?.frame>=this.position){part.controls.delete(id);c.removedControls.push(id);}
   }
   this.rebuildMutes(part);
   if(c.notes.length||c.removed.length||c.removedControls.length)part.instrument.apply(c);
  }
  const from_=from!==undefined?Math.max(this.position,frameAt(from,this.rate)):Infinity;
  for(const [id,e] of [...this.tempos])if(e.frame>=from_||(ids?.includes(id)&&e.frame>=this.position))this.tempos.delete(id);
  this.rebuildTempo();
  return [];
 }

 // A block is rendered in slices at tempo changes, so they land on their exact frame
 // whatever the block size.
 render(count=this.block){
  if(count>this.block)throw Error('Audio block too large');
  for(let done=0;done<count;){
   this.applyTempo();
   const next=this.tempoEvents[0]?.frame,m=next!==undefined&&next<this.position+count-done?next-this.position:count-done;
   this.renderSlice(m,done);done+=m;
  }
  return this.output;
 }
 renderSlice(count,offset){
  const n=count,start=this.position,[mL,mR]=this.mix,prof=this.profiling,blockStart=prof?.clock();
  mL.fill(0,0,n);mR.fill(0,0,n);
  for(const bus of this.buses.values()){bus.input[0].fill(0,0,n);bus.input[1].fill(0,0,n);}
  for(const part of this.parts.values()){
   if(!part.instrument)continue;
   const t0=prof?.clock(),[l,r]=part.render(n);let pk=part.peak;
   for(let i=0;i<n;i++){mL[i]+=l[i];mR[i]+=r[i];const a=Math.abs(l[i]),b=Math.abs(r[i]);if(a>pk)pk=a;if(b>pk)pk=b;}
   part.peak=pk;
   for(const [id,s] of part.sends){const bus=this.buses.get(id);if(!bus||bus.asleep)continue;const [bl,br]=bus.input;for(let i=0;i<n;i++){bl[i]+=l[i]*s;br[i]+=r[i]*s;}}
   if(prof){const x=prof.parts[part.id]??={kind:part.kind,ms:0};x.ms+=prof.clock()-t0;}
  }
  for(const bus of this.buses.values()){
   const t0=prof?.clock(),wet=bus.render(n);
   if(wet){const [a,b]=wet;for(let i=0;i<n;i++){mL[i]+=a[i];mR[i]+=b[i];}}
   if(prof){const x=prof.parts['bus:'+bus.id]??={kind:'bus',ms:0};x.ms+=prof.clock()-t0;}
  }
  const [oL,oR,gain]=this.master.render(this.mix,n),out=this.output,meter=(this.blocks+1)%12===0;
  let peak=0,energy=0,minGain=1;
  for(let i=0;i<n;i++){
   const a=oL[i],b=oR[i];
   if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Invalid audio; playback stopped.');
   out[0][offset+i]=a;out[1][offset+i]=b;peak=Math.max(peak,Math.abs(a),Math.abs(b));if(gain[i]<minGain)minGain=gain[i];if(meter)energy+=a*a+b*b;
  }
  if(minGain<1)this.limited++;
  this.position+=n;
  if(prof){const ms=prof.clock()-blockStart;prof.blocks++;prof.frames+=n;prof.totalMs+=ms;prof.maximumMs=Math.max(prof.maximumMs,ms);prof.overBudget+=Number(ms>n/this.rate*1000);}
  this.acknowledge(start);
  if(++this.blocks%12===0){
   const parts={};for(const part of this.parts.values()){parts[part.id]=part.peak;part.peak=0;}
   this.emit('meter',{peak,rms:Math.sqrt(energy/(n*2)),gainReductionDb:20*Math.log10(minGain),parts,position:this.position,limited:this.limited,rate:this.rate});
  }
 }
 acknowledge(start){
  const p=this.pendingOnsets;let k=0;
  while(k<p.length&&p[k].frame<this.position)k++;
  if(!k)return;
  const ids=p.slice(0,k).filter(x=>x.frame>=start&&this.parts.get(x.part)?.notes.get(x.id)?.frame===x.frame);
  p.splice(0,k);
  if(ids.length)this.emit('sounding',ids.map(x=>({id:x.id,part:x.part,at:x.frame/this.rate})));
 }
}
