// Independent, deterministic test jobs in worker threads. `workerPool(module, name)`
// keeps workers that call the module's export `name` on each item; `inWorkers(module,
// name, items)` maps a list and resolves with the results in item order. Jobs share
// nothing, so sharding cannot change what is checked. TEST_WORKERS caps the pool
// (default: available parallelism; 1 runs every job in this thread).
import os from 'node:os';
import {Worker} from 'node:worker_threads';
export const workerCount=()=>Math.max(1,Number(process.env.TEST_WORKERS||os.availableParallelism?.()||os.cpus().length));
export function workerPool(module,name,{workers=workerCount()}={}){
 module=String(module);
 if(workers<=1){const fn=import(module).then(m=>m[name]);return {run:async item=>(await fn)(item),close:async()=>{}};}
 const idle=[],queue=[],all=[];let closed=false;
 const start=()=>{const w=new Worker(new URL('./worker-job.mjs',import.meta.url),{workerData:{module,name}});w.unref();all.push(w);return w;};
 const dispatch=()=>{
  while(queue.length&&(idle.length||all.length<workers)){
   const w=idle.pop()??start(),{item,resolve,reject}=queue.shift();
   const done=({result,error})=>{w.off('error',fail);idle.push(w);error?reject(Object.assign(Error(error.message),{stack:error.stack})):resolve(result);dispatch();};
   const fail=e=>{w.off('message',done);reject(e);};
   w.once('message',done);w.once('error',fail);w.postMessage({item});
  }
 };
 return {
  run:item=>{if(closed)throw Error('Pool closed');return new Promise((resolve,reject)=>{queue.push({item,resolve,reject});dispatch();});},
  close:()=>{closed=true;return Promise.all(all.map(w=>w.terminate()));},
 };
}
export async function inWorkers(module,name,items,{workers=workerCount()}={}){
 const pool=workerPool(module,name,{workers:Math.min(workers,items.length)});
 try{return await Promise.all(items.map(pool.run));}finally{await pool.close();}
}
