// renderOffline: the host without an AudioContext, in Node or the browser. Batches
// are delivered in order; after each, rendering stops at its `through` minus the
// longest instrument horizon, so batched and all-at-once logs render identically.
import {frameAt} from '../contract/index.js';
import {HostCore} from './host-core.js';

export function renderOffline({setup,notes=[],controls=[],batches,rate=48000,seconds,block=128,instruments,assets}){
 const host=new HostCore({rate,block,instruments,assets}),diagnostics=[],sounding=[];
 host.on('diagnostic',d=>diagnostics.push(d));host.on('sounding',s=>sounding.push(...s));
 host.configure(setup);
 const total=frameAt(seconds,rate),L=new Float32Array(total),R=new Float32Array(total);
 const run=limit=>{
  while(host.position<Math.min(limit,total)){
   const at=host.position,n=Math.min(block,Math.min(limit,total)-at),[l,r]=host.render(n);
   L.set(l.subarray(0,n),at);R.set(r.subarray(0,n),at);
  }
 };
 const list=batches??[{notes,controls}];
 list.forEach((b,k)=>{
  if(b.cancel)host.cancel(b.cancel);
  host.schedule({notes:b.notes??[],controls:b.controls??[],through:b.through});
  // Deliveries fall between whole blocks, as they do in a worklet: the last boundary
  // at or before through − horizon.
  run(k<list.length-1&&b.through!==undefined?Math.floor((frameAt(b.through,rate)-host.horizonFrames)/block)*block:Infinity);
 });
 const frames=host.position;
 const probes=Object.fromEntries([...host.parts.values()].filter(p=>p.instrument?.probe).map(p=>[p.id,p.instrument.probe()]));
 return {audio:[L.subarray(0,frames),R.subarray(0,frames)],frames,diagnostics,sounding,limited:host.limited,labels:labels(host),probes};
}
// Nominal labels from what was scheduled.
function labels(host){
 const out=[];
 for(const part of host.parts.values())for(const e of part.notes.values())out.push({id:e.id,part:part.id,kind:part.kind,onsetFrame:e.frame,endFrame:e.endFrame,
  ...(e.note.target.pitch!==undefined?{pitch:e.note.target.pitch}:{piece:e.note.target.piece}),velocity:e.lowered.velocity,
  techniques:(e.note.techniques??[]).map(t=>({type:t.type,native:part.capabilities.techniques.includes(t.type)}))});
 return out.sort((a,b)=>a.onsetFrame-b.onsetFrame||(a.id<b.id?-1:1));
}
