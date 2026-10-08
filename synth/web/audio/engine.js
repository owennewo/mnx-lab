// Shared by the AudioWorklet and offline parity tests. No DOM or wall-clock scheduling.
import {FAUST_MATH_IMPORTS as imports} from './math-imports.js';
import {nextPluckControl} from '../model/instrument-controls.js';
import {LEGACY_NOTE_POLICY,LATEST_NOTE_POLICY,validateNotePolicy,NoteOwnershipSchedule} from '../model/note-ownership.js';
import {PreparedNoteOwnershipSchedule} from '../model/prepared-note-ownership.js';
export function controlsFromUI(items,result={}) {
  for(const item of items) {
    if(item.items)controlsFromUI(item.items,result);
    else result[item.label]={...item,min:item.min??0,max:item.max??1};
  }
  return result;
}
export class GuitarEngine {
  constructor(module,meta,rate=48000,block=128,mathImports=imports) {
    this.meta=meta;this.rate=rate;this.block=block;
    this.instance=new WebAssembly.Instance(module,mathImports);this.dsp=this.instance.exports;
    this.controls=controlsFromUI(meta.ui);
    this.inPtr=(Number(meta.size)+15)&~15;this.outPtr=this.inPtr+6*4;
    let cursor=this.outPtr+9*4;
    const required=cursor+15*block*4;
    const missing=Math.ceil((required-this.dsp.memory.buffer.byteLength)/65536);
    if(missing>0)this.dsp.memory.grow(missing);
    const ptrs=new Int32Array(this.dsp.memory.buffer);
    this.inputs=[];this.outputs=[];
    for(let i=0;i<15;i++) {
      ptrs[(i<6?this.inPtr:this.outPtr)/4+(i<6?i:i-6)]=cursor;
      const view=new Float32Array(this.dsp.memory.buffer,cursor,block);
      (i<6?this.inputs:this.outputs).push(view);cursor+=block*4;
    }
    this.result=Array.from({length:9},()=>new Float32Array(block));this.resultChannels=9;
    this.outputSlices=this.outputs.map(output=>Array.from({length:block+1},(_,n)=>output.subarray(0,n)));
    this.stateBytes=new Uint8Array(this.dsp.memory.buffer,0,Number(meta.size));
    this.rng=new Uint32Array(6);this.ramps=new Map();this.nextPluck={};
    this.advanceRamp=(r,key)=>{const t=Math.min(1,(this.position-r.start)/(r.end-r.start));this.set(key,r.from+(r.target-r.from)*t);if(t===1)this.ramps.delete(key);};
    this.reset({},[],1);
  }
  set(key,value) {
    const p=this.controls[key];
    if(!p||!Number.isFinite(value)||value<p.min-1e-5||value>p.max+1e-5)throw new Error(`Invalid DSP control ${key}: ${value}`);
    this.dsp.setParamValue(0,p.index,value);
  }
  get(key) {return this.dsp.getParamValue(0,this.controls[key].index);}
  reset(params,events,seed,eventPolicy=LEGACY_NOTE_POLICY,preparedEvents) {
    validateNotePolicy(eventPolicy);
    const schedule=eventPolicy===LATEST_NOTE_POLICY?(preparedEvents?new PreparedNoteOwnershipSchedule(preparedEvents):new NoteOwnershipSchedule(events)):null;
    this.dsp.init(0,this.rate);this.position=0;this.index=0;this.events=schedule?.events??events;
    this.eventPolicy=eventPolicy;this.noteSchedule=schedule;
    this.ramps.clear();this.nextPluck={};
    for(let i=0;i<6;i++)this.rng[i]=((seed>>>0)^Math.imul(0x9e3779b9,i+1))||1;
    for(const [key,value] of Object.entries(params))this.set(key,value);
  }
  update(params,events,transitionSeconds=.04,preparedEvents) {
    // Compile before mutating controls; a malformed owned plan fails closed.
    const ownedEvents=events&&this.noteSchedule?(preparedEvents&&this.noteSchedule instanceof PreparedNoteOwnershipSchedule?this.noteSchedule.replacePrepared(preparedEvents,this.position):this.noteSchedule.replace(events,this.position)):null;
    for(const [key,target] of Object.entries(params)) {
      if(/^s\d-(frequency|position|hardness|sustain|trigger)$/.test(key))continue;
      if(nextPluckControl(key)){this.nextPluck[key]=target;this.ramps.delete(key);continue;}
      const from=this.get(key);
      if(Math.abs(from-target)>1e-8)this.ramps.set(key,{from,target,start:this.position,end:this.position+Math.max(1,Math.round(this.rate*transitionSeconds))});
      else this.ramps.delete(key);
    }
    if(events) {
      if(ownedEvents){this.events=ownedEvents;this.index=0;return;}
      // Notes already ringing retain their tuning/excitation trajectories.
      const old=this.events.slice(this.index).filter(e=>(e.noteStart??Infinity)<this.position);
      const future=events.filter(e=>e.frame>=this.position&&(e.noteStart??Infinity)>=this.position);
      this.events=[...old,...future].sort((a,b)=>a.frame-b.frame);this.index=0;
    }
  }
  render(count=this.block,sharedNoise) {
    if(count>this.block)throw new Error('Audio block too large');
    let done=0;
    while(done<count) {
      while(this.index<this.events.length&&this.events[this.index].frame<=this.position) {
        const e=this.events[this.index++];
        if(e.key.endsWith('-trigger')&&e.value===1){for(const [k,v] of Object.entries(this.nextPluck))this.set(k,v);this.nextPluck={};this.onPluck?.(e);}
        this.set(e.key,e.value);
      }
      this.ramps.forEach(this.advanceRamp);
      let n=count-done;
      if(this.ramps.size)n=Math.min(n,16);
      if(this.index<this.events.length)n=Math.min(n,this.events[this.index].frame-this.position);
      for(let s=0;s<6;s++) {
        let r=this.rng[s];const input=this.inputs[s];
        if(sharedNoise)input.set(sharedNoise[s].subarray(done,done+n));
        else {for(let j=0;j<n;j++){r^=r<<13;r^=r>>>17;r^=r<<5;input[j]=(r>>>8)/8388608-1;}this.rng[s]=r;}
      }
      this.dsp.compute(0,n,this.inPtr,this.outPtr);
      if(this.diagnosticBlock)this.diagnosticBlock.segments++;
      for(let c=0;c<this.resultChannels;c++)this.result[c].set(this.outputSlices[c][n],done);
      this.onRenderSegment?.(this.result,done,n,this.position);
      done+=n;this.position+=n;
    }
    return this.result;
  }
}
