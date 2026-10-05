/** Serial measured service for frozen v2/legacy comparators; evidence outside timers. */
import assert from 'node:assert/strict';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import type {Decision,Handoff,Listener,Emission} from '../../../listen/contract.ts';
import {decisionToJSON} from '../../../listen/json.ts';
import {validateRecord} from '../../../listen/validate.ts';
import {completedAt} from './observation2.ts';
export function executeComparator043(factory:()=>Listener,score:MnxStructure,handoff:Handoff,audio:Float32Array){
 const start=performance.now(),listener=factory();
 assert(listener.start(structuredClone(score),structuredClone(handoff),{sampleRate:48000,chunkSamples:480}).ok);
 const setup=(performance.now()-start)/1000,record:Decision[]=[],payloads:Record<string,unknown>[]=[],calls:Record<string,unknown>[]=[];
 let completion=setup,work=setup,maxBacklog=0;
 calls.push({kind:'start',samples:0,elapsed:setup,completion,decisions:[]});
 const append=(out:Emission[],samples:number)=>{
  const decisions=out.map(e=>({...structuredClone(e),madeAt:completion}) as Decision);
  record.push(...decisions);payloads.push(...decisions.filter(e=>e.kind!=='note').map(e=>({...decisionToJSON(e),deliverySamples:samples})));
  return decisions.map(decisionToJSON);
 };
 for(let from=0;from<audio.length;from+=480){
  const until=Math.min(from+480,audio.length),deliveryAt=until/48000,tick=performance.now();
  const out=listener.feed(audio.slice(from,until),deliveryAt),elapsed=(performance.now()-tick)/1000;
  completion=completedAt(deliveryAt,completion,elapsed);work+=elapsed;maxBacklog=Math.max(maxBacklog,completion-deliveryAt);
  calls.push({kind:'feed',samples:until,elapsed,completion,decisions:append(out,until)});
 }
 const tick=performance.now(),out=listener.finish(),finish=(performance.now()-tick)/1000;
 completion=completedAt(audio.length/48000,completion,finish);work+=finish;
 // Finish-only offline note assessments are not live prefix payloads.
 const final=append(out,audio.length);calls.push({kind:'finish',samples:audio.length,elapsed:finish,completion,decisions:final});validateRecord(record);
 return {listener,record,payloads,calls,cost:{setup,finish,work,ratio:work/(audio.length/48000),audioSeconds:audio.length/48000,maxBacklog,provisional:true}};
}
