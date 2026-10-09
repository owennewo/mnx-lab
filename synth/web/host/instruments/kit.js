// Basic kit (D8, D9): one-shot pieces; closed and pedal hi-hat hits choke the open
// hi-hat (CHOKE_CUTS). Unknown pieces are reported by the host and stay silent.
import {CAPABILITIES,CHOKE_CUTS,PIECES,diagnostic} from '../../contract/index.js';
import {ScheduledDsp} from '../scheduled-dsp.js';
import {designLevel} from './keys.js';
import {forgetLeading} from './forget.js';
const byOnset=(a,b)=>a.frame-b.frame||(a.id<b.id?-1:a.id>b.id?1:0);
// Seconds a piece is computed after a hit: twice its longest decay (−120 dB). The closed
// hi-hat is never gated (dsp/kit-basic.dsp).
export const PIECE_SECONDS=Object.freeze({kick:.9,snare:.5,'side-stick':.1,'tom-high':.9,'tom-mid':1.2,'tom-low':1.6,'hihat-pedal':.1,'hihat-open':1.6,crash:4.8,ride:3.6});
export const GATED=Object.freeze(Object.keys(PIECE_SECONDS));
// `memory`: each piece's last hit before earlier, forgotten notes (forget.js).
export function planKit(entries,rate=48000,memory){
 const events=[],diagnostics=[],last=new Map(memory),hits=new Map(),put=(frame,key,value)=>events.push({frame,key,value});
 for(const e of [...entries].sort(byOnset)){
  const piece=e.lowered.target.piece,f=e.frame;
  if(!PIECES.includes(piece))continue;
  if(f-(last.get(piece)??-Infinity)<2){diagnostics.push(diagnostic('retrigger-conflict',{noteId:e.id,part:e.lowered.part,piece}));continue;}
  last.set(piece,f);
  if(piece==='hihat-open')put(f,'hihat-open-choke',0);
  for(const cut of CHOKE_CUTS[piece]??[])put(f,`${cut}-choke`,1);
  put(f,`${piece}-velocity`,e.lowered.velocity);put(f,`${piece}-trigger`,1);put(f+1,`${piece}-trigger`,0);
  if(PIECE_SECONDS[piece])(hits.get(piece)??hits.set(piece,[]).get(piece)).push(f);
 }
 // On at every hit; off after the piece's window unless it is struck again first.
 for(const [piece,frames] of hits)frames.forEach((f,k)=>{put(f,`${piece}-active`,1);const off=f+Math.round(PIECE_SECONDS[piece]*rate);if(!(frames[k+1]<=off))put(off,`${piece}-active`,0);});
 return {events:events.sort((a,b)=>a.frame-b.frame),diagnostics,state:last};
}
export class Kit{
 static kind='kit';
 static capabilities=CAPABILITIES.kit;
 constructor({part,rate,block,assets,emit=()=>{}}){
  if(!assets?.kit)throw Error('Kit needs the basic kit asset');
  this.emit=emit;this.rate=rate;this.dsp=new ScheduledDsp(assets.kit.module,assets.kit.meta,rate,block);this.entries=new Map();this.reported=new Set();this.configure(part);
  // Gated pieces stay off until their first hit.
  this.dsp.node.set(Object.fromEntries(GATED.map(p=>[`${p}-active`,0])));
 }
 configure(part){this.outputGain=designLevel(part,'kit');}
 apply({notes=[],removed=[]}){
  for(const id of removed)this.entries.delete(id);for(const e of notes)this.entries.set(e.id,e);
  const {events,diagnostics}=planKit([...this.entries.values()],this.rate,this.memory);
  for(const d of diagnostics){const key=`${d.code}:${d.noteId}`;if(!this.reported.has(key)){this.reported.add(key);this.emit('diagnostic',d);}}
  this.dsp.setEvents(events);
 }
 // A forgotten hit folds once its piece's window has closed: the DSP keeps only events to come.
 forget(ids){
  const done=e=>e.frame+Math.round((PIECE_SECONDS[e.lowered.target.piece]??0)*this.rate)+1<this.dsp.position;
  forgetLeading(this,ids,()=>[...this.entries.values()],prefix=>{this.memory=planKit(prefix,this.rate,this.memory).state;},done);
 }
 begin(frame){this.dsp.position=frame;}
 render(n){return this.dsp.render(n);}
}
