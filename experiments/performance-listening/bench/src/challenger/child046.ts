/** One frozen listener process; A owns original harness evidence, B does not. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {writeHeapSnapshot} from 'node:v8';
import {readWav} from '../generate/wav.ts';
import {IncrementalModel041} from './incremental041.ts';
import {execute043} from './live043.ts';
import {execute044} from './live044.ts';
import {prefixEqual3} from './streaming3.ts';
import {encode} from '../io.ts';
import {decisionToJSON} from '../../../listen/json.ts';
import {trace046,clock046,handoff046,assess046} from './harness046.ts';
const [configPath,arm]=process.argv.slice(2),config=JSON.parse(readFileSync(configPath!,'utf8'));assert(arm==='A'||arm==='B');
const tracer=trace046(),phases:any[]=[],phase=(name:string,id:string|null,from:number)=>phases.push({name,id,start:from,end:performance.now(),memory:process.memoryUsage(),cpu:process.cpuUsage()});
const evidence={offline:new Map<string,any>(),live:new Map<string,any>(),rows:[] as any[]};
(globalThis as any).__046Evidence=evidence;
let begin=performance.now();
if(arm==='A')for(const e of config.examples){const old=JSON.parse(readFileSync(e.old39.path,'utf8'));evidence.offline.set(e.id,{old,events:JSON.parse(readFileSync(old.observations.decoded.path,'utf8')).events});evidence.live.set(e.id,JSON.parse(readFileSync(e.old41.path,'utf8')));}
phase('preload',null,begin);begin=performance.now();const model=new IncrementalModel041(config.graph);phase('model-load',null,begin);
const directSamples=new Set<string>();let snapshots=0;
const send=async(result:any)=>{if(arm==='A'){begin=performance.now();writeFileSync(`${config.privateDir}/A.${result.id}.${result.kind}.json`,encode(result),{flag:'wx'});phase('write',result.id,begin);}process.send!({type:'execution',result});await new Promise<void>(resolve=>process.once('message',()=>resolve()));};
for(const e of config.examples){
 const score=JSON.parse(readFileSync(e.scorePath,'utf8')),handoff=handoff046(score),audio=readWav(readFileSync(e.audioPath));
 const cutoff=Math.floor(audio.length*.5/480)*480,key=`${e.guitar}:${e.part}`,first=e.kind==='performance'&&!directSamples.has(key);if(first)directSamples.add(key);
 const execute=async(input:Float32Array,kind:string):Promise<ReturnType<typeof execute044>>=>{
  const timer=clock046(input.length),backend={predict:(input:Float32Array,indices:readonly number[])=>{timer.markInference();return model.predict(input,indices);}};
  const cpuBefore=process.cpuUsage(),memoryBefore=process.memoryUsage(),startWall=performance.now();
  const run:ReturnType<typeof execute043>|ReturnType<typeof execute044>=arm==='A'?execute043(backend,score,handoff,input,{now:timer.now}):execute044(backend,score,handoff,input,{now:timer.now});
  const endWall=performance.now(),cpu=process.cpuUsage(cpuBefore),memoryAfter=process.memoryUsage();await tracer.flush();
  phase(kind,e.id,startWall);
  let evaluation:any=null;
  if(kind==='primary'&&arm==='A'){begin=performance.now();evaluation=assess046(score,e,evidence.offline.get(e.id),run.record);evidence.rows.push({id:e.id,label:e.label,following:evaluation.following,assessment:evaluation.assessment});phase('alignment',e.id,begin);}
  const result={id:e.id,arm,kind,pid:process.pid,timeOrigin:performance.timeOrigin,startWall,endWall,trace:timer.finish(),inference:Array.from(timer.inference),gc:tracer.gc.splice(0),cpu,memoryBefore,memoryAfter,payloads:run.payloads,record:run.record.map(decisionToJSON),cost:run.cost,cutoff,evaluation,phases:phases.splice(0),...(arm==='A'?{calls:(run as ReturnType<typeof execute043>).calls}: {})};
  await send(result);return run;
 };
 const primary=await execute(audio,'primary');
 const future=audio.slice();for(let j=cutoff;j<future.length;j++)future[j]=j%2?.125:-.125;
 const replay=await execute(future.subarray(0,cutoff),'prefix-bounded');assert(prefixEqual3(primary.payloads,replay.payloads,cutoff));
 if(first)for(const kind of ['zero','alternating']){const changed=audio.slice();for(let j=cutoff;j<changed.length;j++)changed[j]=kind==='zero'?0:j%2?.125:-.125;const replay=await execute(changed,`prefix-full-${kind}`);assert(prefixEqual3(primary.payloads,replay.payloads,cutoff));}
 // Parent flags observed targets after records are saved; bounded snapshot budget.
 process.send!({type:'example-end',id:e.id,memory:process.memoryUsage(),retained:{offline:evidence.offline.size,live:evidence.live.size,rows:evidence.rows.length}});
 const ack:any=await new Promise(resolve=>process.once('message',resolve));
 if(ack.target&&snapshots<2){begin=performance.now();const path=writeHeapSnapshot(`${config.armDir}/target-${++snapshots}.heapsnapshot`);phase('snapshot',e.id,begin);process.send!({type:'snapshot',id:e.id,path});}
}
await model.close();await tracer.flush();process.send!({type:'done',gcTail:tracer.gc,phases,memory:process.memoryUsage(),retained:{offline:evidence.offline.size,live:evidence.live.size,rows:evidence.rows.length}});tracer.observer.disconnect();process.disconnect!();
