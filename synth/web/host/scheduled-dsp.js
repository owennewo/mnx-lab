// A FAUST node driven by sample-accurate control events, as GuitarEngine is: the
// block is split at every event frame. Plans are replaced wholesale; only events at
// or after the current position are kept.
import {FaustNode} from './faust-node.js';
export class ScheduledDsp{
 constructor(module,meta,rate,block){
  this.node=new FaustNode(module,meta,rate,block);this.block=block;this.position=0;this.events=[];this.index=0;
  this.out=Array.from({length:Number(meta.outputs)},()=>new Float32Array(block));
 }
 setEvents(events){this.events=events.filter(e=>e.frame>=this.position);this.index=0;}
 render(n){
  let done=0;
  while(done<n){
   while(this.index<this.events.length&&this.events[this.index].frame<=this.position){const e=this.events[this.index++];this.node.set({[e.key]:e.value});}
   let m=n-done;if(this.index<this.events.length)m=Math.min(m,this.events[this.index].frame-this.position);
   const y=this.node.render([],m);for(let c=0;c<this.out.length;c++)this.out[c].set(y[c].subarray(0,m),done);
   done+=m;this.position+=m;
  }
  return this.out;
 }
}
