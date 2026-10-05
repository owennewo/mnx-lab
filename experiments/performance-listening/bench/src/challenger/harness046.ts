/** Diagnostic services and bounded evidence helpers; no instrument changes. */
import {readFileSync} from 'node:fs';
import {PerformanceObserver} from 'node:perf_hooks';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import {rational} from '../../../../../src/audio/time.ts';
import {topOfScore} from '../../../listen/positions.ts';
import {partIds,validateRecord} from '../../../listen/validate.ts';
import {decisionToJSON,positionToJSON} from '../../../listen/json.ts';
import {BasicPitchChain2} from './chain2.ts';
import {evaluateAssessment3} from '../events/assessment3.ts';
import {evaluateFollowing} from '../events/following.ts';
import {cursorGates,assessmentGates2} from '../events/gates2.ts';
export const handoff046=(score:any)=>{const c=compilePerformance(score);if(!c.ok)throw Error('Invalid score');return {from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};};
export function assess046(score:any,e:any,old:any,record:any[]){
 const chain=new BasicPitchChain2(old.events);if(!chain.start(score,handoff046(score),{sampleRate:48000,chunkSamples:480}).ok)throw Error('Start');chain.feed(new Float32Array(),e.label.duration);validateRecord(chain.finish().map(d=>({...d,madeAt:e.label.duration})));
 const report=chain.assessment(),serialized={...report,notes:report.notes.map(decisionToJSON),tempo:{...report.tempo,intervals:report.tempo.intervals.map(i=>({...i,from:positionToJSON(i.from),to:positionToJSON(i.to)}))}},assessment=evaluateAssessment3(e.label,report),following=evaluateFollowing(e.label,record);
 return {report:serialized,assessment,following,reportIdentical:JSON.stringify(serialized)===JSON.stringify(old.old.report),cursorFailed:cursorGates(e.label,following).failed,assessmentFailed:assessmentGates2(e.label,assessment).failed};
}
export function trace046(){
 const gc:any[]=[],observer=new PerformanceObserver(items=>{for(const e of items.getEntries())gc.push({start:e.startTime,end:e.startTime+e.duration,duration:e.duration,detail:(e as any).detail});});observer.observe({entryTypes:['gc']});
 return {gc,observer,flush:()=>new Promise<void>(resolve=>setImmediate(()=>setImmediate(resolve)))};
}
export function clock046(samples:number){
 const trace=new Float64Array((Math.ceil(samples/480)+2)*8),inference=new Set<number>();let cursor=0,opening=true,start=0,before:number[]=[],serviceIndex=0;
 const sched=()=>readFileSync('/proc/thread-self/schedstat','utf8').trim().split(/\s+/).map(Number);
 const now=()=>{if(opening){before=sched();start=performance.now();opening=false;return start;}const end=performance.now(),after=sched();trace.set([start,end,before[0]!,after[0]!,before[1]!,after[1]!,before[2]!,after[2]!],cursor);cursor+=8;serviceIndex++;opening=true;return end;};
 return {now,inference,markInference:()=>inference.add(serviceIndex),finish:()=>Array.from(trace.subarray(0,cursor))};
}
export function targets046(d:any){const targets:any[]=[];for(let i=0;i<d.trace.length/8;i++){const [start,end,cpu0,cpu1,wait0,wait1]=d.trace.slice(i*8,i*8+6);if(end-start<50)continue;const overlap=d.gc.reduce((sum:number,g:any)=>sum+Math.max(0,Math.min(end,g.end)-Math.max(start,g.start)),0);targets.push({service:i,samples:i===0?0:Math.min(i*480,Math.round(d.cost.audioSeconds*48000)),inference:d.inference.includes(i),wallMs:end-start,cpuMs:(cpu1-cpu0)/1e6,runqueueMs:(wait1-wait0)/1e6,gcOverlapMs:overlap,explanationFraction:(overlap+(wait1-wait0)/1e6)/(end-start)});}return targets;}
