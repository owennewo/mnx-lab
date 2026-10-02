import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
export const WINDOW=43844, RATE=22050, FRAMES=172;
export class NativeModel {
  private signal=new Int32Array(new SharedArrayBuffer(4));
  private input=new Float32Array(new SharedArrayBuffer(WINDOW*4));
  private output=new Float32Array(new SharedArrayBuffer(FRAMES*440*4));
  private worker:Worker;
  constructor(model:string) {
    this.worker=new Worker(new URL('./nativeWorker.mjs',import.meta.url),{workerData:{model, signal:this.signal.buffer,input:this.input.buffer,output:this.output.buffer}});
    this.wait();
  }
  private wait() {
    while (![1,-1].includes(Atomics.load(this.signal,0))) {
      const s=Atomics.load(this.signal,0);
      assert.notEqual(Atomics.wait(this.signal,0,s,60000),'timed-out','Native worker timeout');
    }
    assert.equal(Atomics.load(this.signal,0),1,'Native worker failed');
  }
  predict(x:Float32Array) {
    assert.equal(x.length,WINDOW); this.input.set(x); Atomics.store(this.signal,0,2); Atomics.notify(this.signal,0); this.wait();
    return {note:this.output.slice(0,FRAMES*88),onset:this.output.slice(FRAMES*88,FRAMES*176),contour:this.output.slice(FRAMES*176)};
  }
  async close(){Atomics.store(this.signal,0,3);Atomics.notify(this.signal,0);await this.worker.terminate();}
}
/** Causal interpolation: output j exists only after floor(j*48000/22050)+1 is delivered. */
export function resamplePrefix(audio:readonly number[], from:number):number[] {
  const values:number[]=[];
  for(let j=from; ;j++) {const p=j*48000/RATE,k=Math.floor(p),f=p-k;if(k+1>=audio.length)break; values.push(audio[k]!*(1-f)+audio[k+1]!*f);}
  return values;
}
export const localFrameTime=(start:number,j:number)=>(start+j*256)/RATE;
