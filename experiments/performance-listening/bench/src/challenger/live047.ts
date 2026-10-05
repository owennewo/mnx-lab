/** 047 storage variant over the frozen 043 service boundary; evidence after service. */
import assert from 'node:assert/strict';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import type {Decision,Emission,Handoff} from '../../../listen/contract.ts';
import {decisionToJSON} from '../../../listen/json.ts';
import {validateRecord} from '../../../listen/validate.ts';
import {sha256} from '../io.ts';
import {BasicPitchChain} from './chain.ts';
import {StreamingInput047} from './streaming047.ts';
import {selectedFrames,reducePitch,completedAt} from './observation2.ts';
import {IncrementalModel041} from './incremental041.ts';

type Frame={q:number;audioTime:number;deliverySamples:number;deliveryAt:number;availableAt:number;midi:number|null;confidence:number;kind:string};
const DELIVERY={sampleRate:48000,chunkSamples:480};
export function execute047(model:Pick<IncrementalModel041,'predict'>,score:MnxStructure,handoff:Handoff,audio:Float32Array,options:{now?:()=>number;afterService?:(input:Float32Array|null)=>void}={}){
 const now=options.now??(()=>performance.now()); const start=now();
 const state=new StreamingInput047(),chain=new BasicPitchChain();
 assert(chain.start(structuredClone(score),structuredClone(handoff),{...DELIVERY}).ok);state.reset();
 const setup=(now()-start)/1000;
 const record:Decision[]=[],frames:Frame[]=[],payloads:Record<string,unknown>[]=[],calls:Record<string,unknown>[]=[];
 let completion=setup,work=setup,modelCalls=0,maxBacklog=0,maxNeuralFrames=0;calls.push({kind:'start',samples:0,elapsed:setup,completion,frames:[],decisions:[]});
 for(let from=0;from<audio.length;from+=480){
  const until=Math.min(from+480,audio.length),deliveryAt=until/48000,tick=now();
  const chunk=audio.slice(from,until);chain.feed(chunk,deliveryAt);const request=state.feed(chunk),out:Emission[]=[],batch:Frame[]=[];
  let inputHash:string|null=null,indices:number[]=[],cropBegin:number|null=null,cropLength=0;
  if(request){
   const selection=selectedFrames(state.samples,0,state.watermark);indices=selection.indices;
   if(indices.length){
    const maps=model.predict(request.input,indices);cropBegin=maps.begin;cropLength=maps.length;

    for(let k=0;k<indices.length;k++){
     const j=indices[k]!,q=selection.coordinates[k]!,pitch=reducePitch(Array.from(maps.note.subarray((j-maps.begin)*88,(j-maps.begin+1)*88)));
     const frame:Frame={q,audioTime:q/22050,deliverySamples:until,deliveryAt,availableAt:deliveryAt,...pitch};batch.push(frame);
     out.push(...chain.observe({...frame,availableAt:deliveryAt,silent:frame.midi===null}));state.watermark=q;
    }

   }
  }
  const elapsed=(now()-tick)/1000;completion=completedAt(deliveryAt,completion,elapsed);work+=elapsed;maxBacklog=Math.max(maxBacklog,completion-deliveryAt);
  if(indices.length){modelCalls++;maxNeuralFrames=Math.max(maxNeuralFrames,cropLength);}
  options.afterService?.(request?.input??null);
  if(request&&indices.length)inputHash=sha256(Buffer.from(request.input.buffer));
  for(const frame of batch){frame.availableAt=completion;frames.push(frame);payloads.push({...frame});}
  const stamped=out.map(e=>{assert(Number.isFinite(e.refersTo)&&e.refersTo>=0&&e.refersTo<=deliveryAt);return {...e,madeAt:completion} as Decision;});
  record.push(...stamped);payloads.push(...stamped.map(e=>({...decisionToJSON(e),deliverySamples:until})));
  calls.push({kind:'feed',samples:until,elapsed,completion,inputHash,indices,cropBegin,cropLength,frames:batch,decisions:stamped.map(decisionToJSON)});
 }
 const finishStart=now();state.finish();const finish=(now()-finishStart)/1000;completion=completedAt(audio.length/48000,completion,finish);work+=finish;
 calls.push({kind:'finish',samples:audio.length,elapsed:finish,completion,frames:[],decisions:[]});validateRecord(record);
 return {record,frames,payloads,calls,allocations:{...state.allocations},cost:{setup,finish,work,ratio:work/(audio.length/48000),audioSeconds:audio.length/48000,maxBacklog,modelCalls,maxNeuralFrames,provisional:true}};
}
