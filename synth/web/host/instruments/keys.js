// Basic keys (D9): 16 additive voices, sustain pedal, click-free stealing. Voices are
// allocated in onset order from the whole note set, so batched and all-at-once
// schedules allocate identically. One voice stays spare: when the 16th note would
// sound, the oldest is killed (1.5 ms fade) and the new note takes the spare.
// Each voice is its own DSP instance computed only inside its active windows (onset
// to release plus a tail), split exactly at window edges, so idle voices cost nothing
// and the output does not depend on block size or batching.
import {CAPABILITIES,diagnostic} from '../../contract/index.js';
import {FaustNode} from '../faust-node.js';
import {forgetLeading} from './forget.js';
export const KEY_VOICES=16,KEY_TAIL_SECONDS=.5,KILL_SECONDS=.02;
const byOnset=(a,b)=>a.frame-b.frame||(a.id<b.id?-1:a.id>b.id?1:0);
// Loudness calibration (chain campaign Phase 4): each kind's default material at a 0 dB
// strip lands near a standard guitar's A-weighted loudness (keys within 1 dB; the kit 3 dB
// under, so its kick peaks stay below the master ceiling); the design level trims around it.
export const BASE_LEVEL_DB=Object.freeze({keys:12,kit:8});
export function designLevel(part,kind){
 const d=part.instrument.design,id=typeof d==='string'?d:d?.id;
 if(id!==`basic-${kind==='keys'?'piano':'kit'}`)throw Error(`Unknown ${kind} design ${id}; only the basic design exists`);
 const levelDb=typeof d==='object'&&d.levelDb!==undefined?d.levelDb:0;
 if(typeof levelDb!=='number'||levelDb<-30||levelDb>12)throw Error('Invalid design level');
 return 10**((BASE_LEVEL_DB[kind]+levelDb)/20);
}
// → per voice: control events and active windows [start, end) in frames. `memory` is each
// voice's state after earlier, forgotten notes (forget.js); `state` carries it on.
export function planKeys(entries,controls,rate,memory){
 // A voice's last active window always ends at its busyUntil, so a folded voice carries
 // that window: a steal or a reuse can still cut it as the whole plan would.
 const voices=Array.from({length:KEY_VOICES},(_,i)=>({i,events:[],windows:memory?.[i]?.busyUntil>-Infinity?[[-Infinity,memory[i].busyUntil]]:[],
  busyUntil:-Infinity,note:null,killed:false,start:-Infinity,...memory?.[i]})),diagnostics=[];
 const pedal=[...controls].filter(c=>c.control.type==='sustainPedal').sort((a,b)=>a.frame-b.frame||(a.id<b.id?-1:1));
 for(const v of voices)for(const c of pedal)v.events.push({frame:c.frame,key:'sustain_pedal',value:c.control.value});
 const down=frame=>{let on=false;for(const c of pedal){if(c.frame>frame)break;on=c.control.value>=.5;}return on;};
 const upAfter=frame=>{for(const c of pedal)if(c.frame>frame&&c.control.value<.5)return c.frame;return Infinity;};
 const tail=Math.round(KEY_TAIL_SECONDS*rate),put=(v,frame,key,value)=>v.events.push({frame,key,value});
 for(const e of [...entries].sort(byOnset)){
  const n=e.lowered,f=e.frame;
  if(n.target.pitch===undefined){diagnostics.push(diagnostic('out-of-range',{noteId:e.id,part:n.part,message:'Keys need a pitch target'}));continue;}
  const busy=voices.filter(v=>v.busyUntil>f&&!v.killed);
  if(busy.length>=KEY_VOICES-1){
   const oldest=busy.sort((a,b)=>a.start-b.start||a.i-b.i)[0],end=f+Math.round(KILL_SECONDS*rate);
   put(oldest,f,'gate',0);put(oldest,f,'kill',1);oldest.killed=true;oldest.busyUntil=end;oldest.windows.at(-1)[1]=end;
   diagnostics.push(diagnostic('voice-stolen',{noteId:oldest.note,part:n.part,by:e.id}));
  }
  const v=[...voices].filter(x=>x.busyUntil<=f).sort((a,b)=>a.busyUntil-b.busyUntil||a.i-b.i)[0]??[...voices].sort((a,b)=>a.busyUntil-b.busyUntil||a.i-b.i)[0];
  const letRing=n.techniques?.some(t=>t.type==='letRing'),release=letRing?Infinity:down(e.endFrame)?upAfter(e.endFrame):e.endFrame;
  put(v,f,'kill',0);put(v,f,'damping',e.primitives.damping?.amount??0);put(v,f,'freq',440*2**((n.target.pitch-69)/12));put(v,f,'velocity',n.velocity);put(v,f,'gate',1);
  if(!letRing)put(v,e.endFrame,'gate',0);
  // A voice still fading out of a steal is cut at this onset (its window ends here).
  if(v.windows.length&&v.windows.at(-1)[1]>f)v.windows.at(-1)[1]=f;
  v.windows.push([f,release+tail]);
  Object.assign(v,{busyUntil:release+tail,note:e.id,killed:false,start:f});
 }
 // A gate-off after a steal is moot but harmless. Stable sort keeps same-frame order.
 for(const v of voices)v.events.sort((a,b)=>a.frame-b.frame);
 return {voices:voices.map(({events,windows})=>({events,windows})),diagnostics,state:voices.map(({busyUntil,note,killed,start})=>({busyUntil,note,killed,start}))};
}
class Voice{
 constructor(module,meta,rate,block){this.node=new FaustNode(module,meta,rate,block);this.position=0;this.events=[];this.index=0;this.windows=[];}
 plan({events,windows}){this.events=events.filter(e=>e.frame>=this.position);this.index=0;this.windows=windows.filter(w=>w[1]>this.position);}
 // Adds this voice into out[0..n); idle stretches only apply their events.
 renderInto(out,n){
  let done=0;
  while(done<n){
   while(this.index<this.events.length&&this.events[this.index].frame<=this.position){const e=this.events[this.index++];this.node.set({[e.key]:e.value});}
   while(this.windows.length&&this.windows[0][1]<=this.position)this.windows.shift();
   const w=this.windows[0],active=w&&w[0]<=this.position;
   let m=n-done;if(this.index<this.events.length)m=Math.min(m,this.events[this.index].frame-this.position);
   if(w)m=Math.min(m,(active?w[1]:w[0])-this.position);
   if(active){const y=this.node.render([],m);for(let c=0;c<2;c++){const o=out[c],x=y[c];for(let i=0;i<m;i++)o[done+i]+=x[i];}}
   done+=m;this.position+=m;
  }
 }
}
export class Keys{
 static kind='keys';
 static capabilities=CAPABILITIES.keys;
 constructor({part,rate,block,assets,emit=()=>{}}){
  if(!assets?.keys)throw Error('Keys need the basic keys asset');
  this.rate=rate;this.emit=emit;this.voices=Array.from({length:KEY_VOICES},()=>new Voice(assets.keys.module,assets.keys.meta,rate,block));
  this.out=[new Float32Array(block),new Float32Array(block)];this.entries=new Map();this.controls=new Map();this.reported=new Set();this.configure(part);
 }
 configure(part){this.outputGain=designLevel(part,'keys');}
 apply({notes=[],removed=[],controls=[],removedControls=[]}){
  for(const id of removed)this.entries.delete(id);for(const e of notes)this.entries.set(e.id,e);
  for(const id of removedControls)this.controls.delete(id);for(const c of controls)this.controls.set(c.id,c);
  const {voices,diagnostics}=planKeys([...this.entries.values()],[...this.controls.values()],this.rate,this.memory);
  for(const d of diagnostics){const key=`${d.code}:${d.noteId}`;if(!this.reported.has(key)){this.reported.add(key);this.emit('diagnostic',d);}}
  voices.forEach((p,i)=>this.voices[i].plan(p));
 }
 // Forgotten notes fold into the voices' state once every voice they used is free again
 // (a held pedal or a let-ring note keeps them until then).
 forget(ids){
  forgetLeading(this,ids,()=>[...this.entries.values()],prefix=>{
   const {state}=planKeys(prefix,[...this.controls.values()],this.rate,this.memory);
   if(state.some(v=>v.busyUntil>=this.voices[0].position))return false;
   this.memory=state;
  });
 }
 begin(frame){for(const v of this.voices)v.position=frame;}
 render(n){const [L,R]=this.out;L.fill(0,0,n);R.fill(0,0,n);for(const v of this.voices)v.renderInto(this.out,n);return this.out;}
}
