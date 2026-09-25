import type { GoldenV2 } from '../src/v2/types.ts';
import { rational, type Decision } from '../src/types.ts';
const h='1'.repeat(64);
export function golden(): GoldenV2 { return {
  version:2,set:'oracle-v2',example:'bounded',partition:'development',role:'positive',group:{piece:'oracle',performer:'handwritten',session:'arithmetic'},
  intended:{scoreSha256:h,tempo:{bpm:60,unit:'quarter'},route:[1,2]},audio:{sha256:h,sourceSha256:h,samples:48000,sampleRate:48000,channels:1,cropStartSample:0,timeOrigin:'handwritten zero'},
  provenance:{kind:'handwritten',reviewer:'hand-worked oracle',reviewedOn:'2026-09-25',evidenceSha256:h,independentOfCandidate:true,sourceChecks:{soloGuitar:false,scoreRoute:true,cropTimeOrigin:true,tempoEnvelope:true}},profile:{kind:'handwritten arithmetic'},
  labels:[{start:0,end:1,state:'supported',answerableFrom:0,evidence:'oracle-v2/README.md',method:'observed',truth:{route:1,start:{lower:0,upper:.25},end:{lower:0,upper:.25}},alternatives:[]}],recoveries:[],noteAssessment:null,
}; }
export function position(q:number,madeAt=0,id='p',route=1):Decision {return {id,kind:'position',madeAt,refersTo:0,confidence:1,candidates:[{position:{quarters:rational(Math.round(q*10000),10000),route},weight:1}]};}
