// Exhaustive check of the WASM math kernel's ported functions (web/audio/math-kernel.js):
// for every float32 bit pattern, _tanhf(x) must equal Math.fround(Math.tanh(x)) bit for
// bit (any NaN matches any NaN: the hosts throw on non-finite audio). Split across
// worker threads; about a minute on the i7-8750H. `npm run verify:math-kernel`.
import os from 'node:os';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {mathKernel} from '../web/audio/math-kernel.js';
import {FAUST_MATH_IMPORTS} from '../web/audio/math-imports.js';
const CHECKS={_tanhf:x=>Math.fround(Math.tanh(x))};
if(isMainThread){
 const workers=Number(process.env.WORKERS||os.availableParallelism?.()||os.cpus().length),chunk=Math.ceil(2**32/workers),started=Date.now();
 const results=await Promise.all(Array.from({length:workers},(_,i)=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url),{workerData:{from:i*chunk,to:Math.min(2**32,(i+1)*chunk)}});w.on('message',resolve);w.on('error',reject);})));
 const total=Object.fromEntries(Object.keys(CHECKS).map(name=>[name,{checked:0,mismatches:[]}]));
 for(const r of results)for(const [name,x] of Object.entries(r)){total[name].checked+=x.checked;total[name].mismatches.push(...x.mismatches);}
 console.log(JSON.stringify({seconds:(Date.now()-started)/1000,workers,node:process.version,results:total}));
 process.exit(Object.values(total).every(x=>x.checked===2**32&&!x.mismatches.length)?0:1);
}else{
 const k=mathKernel(FAUST_MATH_IMPORTS.env),u=new Uint32Array(1),f=new Float32Array(u.buffer),out={};
 for(const [name,expected] of Object.entries(CHECKS)){
  const fn=k[name],r=out[name]={checked:0,mismatches:[]};
  for(let b=workerData.from;b<workerData.to;b++){
   u[0]=b;const x=f[0],a=fn(x),e=expected(x);r.checked++;
   if(!(Object.is(a,e)||(a!==a&&e!==e))&&r.mismatches.length<20)r.mismatches.push({bits:b.toString(16),got:a,expected:e});
  }
 }
 parentPort.postMessage(out);
}
