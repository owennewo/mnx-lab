/** 048 note-only live bridge; graph still computes all outputs and full normalized DSP. */
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
export class IncrementalModel048 {
 private signal=new Int32Array(new SharedArrayBuffer(8));
 private input=new Float32Array(new SharedArrayBuffer(43844*4));
 private output=new Float32Array(new SharedArrayBuffer(172*88*4));
 private worker:Worker;
 constructor(model:string){this.worker=new Worker(new URL('./incrementalWorker048.mjs',import.meta.url),{workerData:{model,signal:this.signal.buffer,input:this.input.buffer,output:this.output.buffer}});this.wait();}
 get sharedOutputBytes(){return this.output.byteLength;}
 private wait(){while(![1,-1].includes(Atomics.load(this.signal,0))){const s=Atomics.load(this.signal,0);assert.notEqual(Atomics.wait(this.signal,0,s,60000),'timed-out','Incremental worker timeout');}assert.equal(Atomics.load(this.signal,0),1,'Incremental worker failed');}
 predict(input:Float32Array,indices:readonly number[]){
  assert.equal(input.length,43844);assert(indices.length&&indices.every(j=>Number.isInteger(j)&&j>=0&&j<172));
  const begin=Math.max(0,Math.min(...indices)-10),length=172-begin;
  this.input.set(input);Atomics.store(this.signal,1,begin);Atomics.store(this.signal,0,2);Atomics.notify(this.signal,0);this.wait();
  return {begin,length,note:this.output.slice(0,length*88)};
 }
 async close(){Atomics.store(this.signal,0,3);Atomics.notify(this.signal,0);await this.worker.terminate();}
}
