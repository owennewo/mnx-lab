/** Single arm process: no evaluator, labels never enter candidate service. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {PerformanceObserver} from 'node:perf_hooks';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import {rational} from '../../../../../src/audio/time.ts';
import {topOfScore} from '../../../listen/positions.ts';
import {partIds} from '../../../listen/validate.ts';
import {readWav} from '../generate/wav.ts';
import {IncrementalModel041} from './incremental041.ts';
import {execute043} from './live043.ts';
import {execute044} from './live044.ts';
import {encode} from '../io.ts';
const [configPath,arm]=process.argv.slice(2),config=JSON.parse(readFileSync(configPath!,'utf8'));
assert(arm==='A'||arm==='B');
const gc:any[]=[],observer=new PerformanceObserver(items=>{for(const e of items.getEntries())gc.push({start:e.startTime,end:e.startTime+e.duration,duration:e.duration,detail:(e as typeof e & {detail?:unknown}).detail});});observer.observe({entryTypes:['gc']});
const flush=()=>new Promise<void>(resolve=>setImmediate(()=>setImmediate(resolve)));
const sched=()=>readFileSync('/proc/thread-self/schedstat','utf8').trim().split(/\s+/).map(Number);
const model=new IncrementalModel041(config.graph),retained:any[]=[];
for(const e of config.examples){
 const score=JSON.parse(readFileSync(e.scorePath,'utf8')),c=compilePerformance(score);assert(c.ok);
 const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
 const audio=readWav(readFileSync(e.audioPath));const trace=new Float64Array((Math.ceil(audio.length/480)+2)*8),inference=new Set<number>();
 let cursor=0,opening=true,start=0,before:number[]=[],serviceIndex=0;
 const now=()=>{if(opening){before=sched();start=performance.now();opening=false;return start;}
  const end=performance.now(),after=sched();trace.set([start,end,before[0]!,after[0]!,before[1]!,after[1]!,before[2]!,after[2]!],cursor);cursor+=8;serviceIndex++;opening=true;return end;};
 const backend={predict:(input:Float32Array,indices:readonly number[])=>{inference.add(serviceIndex);return model.predict(input,indices);}};
 const cpuBefore=process.cpuUsage(),resourceBefore=process.resourceUsage(),heapBefore=process.memoryUsage(),startWall=performance.now();
 const run=arm==='A'?execute043(backend,score,handoff,audio,{now}):execute044(backend,score,handoff,audio,{now});
 const cpu=process.cpuUsage(cpuBefore),resourceAfter=process.resourceUsage(),heapAfter=process.memoryUsage();await flush();
 const result={id:e.id,arm,pid:process.pid,startWall,endWall:performance.now(),trace:Array.from(trace.subarray(0,cursor)),inference:Array.from(inference),gc:gc.splice(0),cpu,resourceBefore,resourceAfter,heapBefore,heapAfter,payloads:run.payloads,cost:run.cost,...(arm==='A'?{calls:(run as ReturnType<typeof execute043>).calls}: {})};
 if(arm==='A'){retained.push(result);writeFileSync(`${config.privateDir}/A.${e.id}.json`,encode(result),{flag:'wx'});}
 process.send!({type:'example',result});await new Promise<void>(resolve=>process.once('message',()=>resolve()));
}
await model.close();await flush();process.send!({type:'done',gcTail:gc});observer.disconnect();process.disconnect!();
