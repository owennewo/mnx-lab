// Audio blocks (chain campaign C7–C12): the catalogue of effect and bus types that a
// setup may name, their parameters (ranges, units, defaults, presets) for validation
// and for UIs, and the runtime that runs one compiled block, On or Off.
//
// One law: out = w·dsp(g·in) + (1 − w·g)·in, with g and w ramped over 20 ms. On: g = w = 1.
// Off: g = 0, w = 1 — the input passes unchanged and the effect's tail (echo repeats)
// rings out; after 0.5 s of quiet it is not computed at all (C7, simplified 2026-10-08:
// the former Bypass behaviour, at no cost once quiet). A removed block fades out (w = 0).
import {FaustNode} from './faust-node.js';

const p=(label,min,max,def,extra={})=>({label,min,max,default:def,...extra});
export const ECHO_BEATS=Object.freeze([.25,.5,.75,1,1.5,2]);
export const BLOCK_TYPES=Object.freeze({
 drive:{name:'Drive',role:'effect',hue:'#d08a52',summary:'Saturation with tone and mix',
  params:{gain:p('Gain',0,30,12,{unit:'dB'}),mix:p('Mix',0,1,.7,{unit:'%',scale:100}),tone:p('Tone',600,16000,4000,{unit:'Hz',log:true})},
  presets:{'Warm drive':{gain:12,mix:.7,tone:4000},'Crunch':{gain:22,mix:.9,tone:5500},'Edge':{gain:6,mix:.35,tone:7500}},
  controls:x=>({gain:x.gain,mix:x.mix,tone:x.tone})},
 vibrato:{name:'Vibrato',role:'effect',hue:'#a493e0',summary:'Pitch wobble, depth in cents',
  params:{depth:p('Depth',0,50,10,{unit:'cents'}),mix:p('Mix',0,1,.5,{unit:'%',scale:100}),rate:p('Rate',.2,10,4.5,{unit:'Hz'})},
  presets:{'Gentle':{depth:10,mix:.5,rate:4.5},'Seasick':{depth:30,mix:.7,rate:2},'Shimmer':{depth:6,mix:.4,rate:7}},
  controls:x=>({depth:x.depth,mix:x.mix,rate:x.rate})},
 tremolo:{name:'Tremolo',role:'effect',hue:'#7fb6e8',summary:'Volume wobble',
  params:{depth:p('Depth',0,1,.35,{unit:'%',scale:100}),rate:p('Rate',.2,10,3,{unit:'Hz'})},
  presets:{'Slow tremolo':{depth:.55,rate:3},'Fast flutter':{depth:.3,rate:8}},
  controls:x=>({depth:x.depth,rate:x.rate})},
 echo:{name:'Echo',role:'effect',hue:'#8fd8c4',summary:'Tempo-synced delay, ping-pong',
  params:{mix:p('Mix',0,1,.4,{unit:'%',scale:100}),beats:p('Time',.25,2,.75,{unit:'beats',choices:ECHO_BEATS}),
   feedback:p('Feedback',0,.8,.5,{unit:'%',scale:100}),tone:p('Tone',500,12000,5000,{unit:'Hz',log:true}),pingPong:{label:'Ping-pong',type:'boolean',default:true}},
  presets:{'Dotted echo':{mix:.4,beats:.75,feedback:.5,pingPong:true},'Slapback':{mix:.32,beats:.25,feedback:.12,pingPong:false},'Long repeats':{mix:.35,beats:1,feedback:.65,pingPong:true}},
  controls:(x,{bpm})=>({mix:x.mix,time:Math.min(2,Math.max(.04,60/bpm*x.beats)),feedback:x.feedback,tone:x.tone,ping_pong:x.pingPong?1:0})},
 room:{name:'Room',role:'bus',hue:'#8fd8c4',summary:'Reverb return bus',
  params:{level:p('Mix',0,1,.2,{unit:'%',scale:100}),decay:p('Decay',.2,12,1,{unit:'s',log:true}),predelay:p('Pre-delay',0,100,15,{unit:'ms'}),
   damping:p('Damping',1000,12000,7000,{unit:'Hz',log:true}),width:p('Width',0,1.5,1,{unit:'%',scale:100})},
  presets:{'Studio':{level:.18,decay:.6,predelay:8,damping:8500,width:.8},'Hall':{level:.32,decay:3,predelay:25,damping:6000,width:1.1},'Cathedral':{level:.44,decay:8,predelay:55,damping:4500,width:1.4}},
  controls:x=>({level:x.level,decay:x.decay,predelay:x.predelay,damping:x.damping,width:x.width})},
});
export const EFFECT_TYPES=Object.freeze(Object.keys(BLOCK_TYPES).filter(t=>BLOCK_TYPES[t].role==='effect'));
export const BUS_TYPES=Object.freeze(Object.keys(BLOCK_TYPES).filter(t=>BLOCK_TYPES[t].role==='bus'));
export const BLOCK_STATES=Object.freeze(['on','off']);
export const MASTER_PARAMS=Object.freeze({volumeDb:p('Volume',-60,12,0,{unit:'dB'}),ceilingDb:p('Ceiling',-24,0,-1,{unit:'dBFS'})});

export const defaultParams=type=>Object.fromEntries(Object.entries(BLOCK_TYPES[type].params).map(([k,d])=>[k,d.default]));
// Params with defaults filled in; out-of-range or wrongly typed values are reported
// and replaced (D11 spirit: never throw on a block's contents).
export function resolveParams(type,params={}){
 const def=BLOCK_TYPES[type],out=defaultParams(type),problems=[];
 for(const [k,v] of Object.entries(params??{})){
  const d=def.params[k];
  if(!d){problems.push(`unknown parameter ${k}`);continue;}
  if(d.type==='boolean'){if(typeof v==='boolean')out[k]=v;else problems.push(`${k} must be true or false`);continue;}
  if(typeof v!=='number'||!Number.isFinite(v)){problems.push(`${k} must be a number`);continue;}
  out[k]=Math.min(d.max,Math.max(d.min,v));if(v<d.min||v>d.max)problems.push(`${k} ${v} outside ${d.min}–${d.max}; clamped`);
 }
 return {params:out,problems};
}

const RAMP_SECONDS=.02,QUIET=1e-7,SLEEP_SECONDS=.5;
export class BlockNode{
 constructor(asset,type,rate,block){
  this.type=type;this.rate=rate;this.block=block;this.node=new FaustNode(asset.module,asset.meta,rate,block);
  this.out=[new Float32Array(block),new Float32Array(block)];this.zero=[new Float32Array(block),new Float32Array(block)];this.x=[new Float32Array(block),new Float32Array(block)];
  this.step=1/(rate*RAMP_SECONDS);this.g=0;this.w=0;this.gTarget=0;this.wTarget=0;this.asleep=true;this.quiet=0;this.state='off';this.controls={};
 }
 // fade: false sets the state immediately (a block present from the first render).
 configure(state,controls,{fade=true}={}){
  this.controls=controls;this.node.set(controls);
  if(state!==this.state){
   this.state=state;
   // 'removed' (internal): a block leaving the chain fades its contribution out.
   this.gTarget=state==='on'?1:0;this.wTarget=state==='removed'?0:1;
   if(!fade){this.g=this.gTarget;this.w=this.wTarget;}
   if(state==='on'&&this.asleep)this.wake();
  }
 }
 wake(){this.node.reset(this.controls);this.asleep=false;this.quiet=0;}
 get settled(){return this.g===this.gTarget&&this.w===this.wTarget;}
 // → output channels (the input arrays themselves when the block is asleep).
 render(input,n){
  if(this.asleep)return input;
  const [L,R]=input,[oL,oR]=this.out,step=this.step;
  if(this.settled&&this.w===0){this.asleep=true;return input;}
  let x=input;
  if(this.settled){if(this.g===0)x=this.zero;}
  else{
   x=this.x;let g=this.g;
   for(let i=0;i<n;i++){g=g<this.gTarget?Math.min(this.gTarget,g+step):Math.max(this.gTarget,g-step);x[0][i]=g*L[i];x[1][i]=g*R[i];}
  }
  const [yL,yR]=this.node.render(x,n);
  if(this.settled&&this.g===1&&this.w===1){oL.set(yL.subarray(0,n));oR.set(yR.subarray(0,n));this.quiet=0;return this.out;}
  let g=this.g,w=this.w,peak=0;
  for(let i=0;i<n;i++){
   if(g!==this.gTarget)g=g<this.gTarget?Math.min(this.gTarget,g+step):Math.max(this.gTarget,g-step);
   if(w!==this.wTarget)w=w<this.wTarget?Math.min(this.wTarget,w+step):Math.max(this.wTarget,w-step);
   const dry=1-w*g;oL[i]=w*yL[i]+dry*L[i];oR[i]=w*yR[i]+dry*R[i];peak=Math.max(peak,Math.abs(yL[i]),Math.abs(yR[i]));
  }
  this.g=g;this.w=w;
  // Off and quiet for a while: nothing left to ring, so stop computing.
  if(this.state==='off'&&this.settled){this.quiet=peak<QUIET?this.quiet+n:0;if(this.quiet>=SLEEP_SECONDS*this.rate)this.asleep=true;}
  return this.out;
 }
}
