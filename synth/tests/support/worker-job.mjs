// Worker side of tests/support/workers.mjs: one job at a time, results posted back.
import {parentPort,workerData} from 'node:worker_threads';
const fn=(await import(workerData.module))[workerData.name];
parentPort.on('message',async({item})=>{
 try{parentPort.postMessage({result:await fn(item)});}
 catch(e){parentPort.postMessage({error:{message:String(e?.message??e),stack:e?.stack}});}
});
