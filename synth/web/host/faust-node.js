// One compiled FAUST WASM instance with any number of inputs and outputs; the
// same memory layout as web/audio/effects.js (pinned), generalised for the host.
import {controlsFromUI} from '../audio/engine.js';
import {FAUST_MATH_IMPORTS as imports} from '../audio/math-imports.js';
export class FaustNode{
 constructor(module,meta,rate,block=128,mathImports=imports){
  this.dsp=new WebAssembly.Instance(module,mathImports).exports;this.controls=controlsFromUI(meta.ui);this.rate=rate;this.block=block;
  const ins=Number(meta.inputs),outs=Number(meta.outputs);
  this.inPtr=(Number(meta.size)+15)&~15;this.outPtr=this.inPtr+4*ins;let cursor=this.outPtr+4*outs;
  const missing=Math.ceil((cursor+(ins+outs)*block*4-this.dsp.memory.buffer.byteLength)/65536);if(missing>0)this.dsp.memory.grow(missing);
  const ptrs=new Int32Array(this.dsp.memory.buffer);this.inputs=[];this.outputs=[];
  for(let i=0;i<ins+outs;i++){ptrs[(i<ins?this.inPtr/4+i:this.outPtr/4+i-ins)]=cursor;(i<ins?this.inputs:this.outputs).push(new Float32Array(this.dsp.memory.buffer,cursor,block));cursor+=block*4;}
  this.reset();
 }
 reset(params={}){this.dsp.init(0,this.rate);this.set(params);}
 set(params){for(const [k,v] of Object.entries(params)){const p=this.controls[k];if(!p||!Number.isFinite(v)||v<p.min||v>p.max)throw Error(`Invalid control ${k}`);this.dsp.setParamValue(0,p.index,v);}}
 // Inputs are copied in; outputs are views valid until the next render.
 render(inputs,count=this.block){
  if(count>this.block)throw Error('Block too large');
  for(let c=0;c<this.inputs.length;c++)this.inputs[c].set(inputs[c].length===count?inputs[c]:inputs[c].subarray(0,count));
  this.dsp.compute(0,count,this.inPtr,this.outPtr);return this.outputs;
 }
}
