import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { rational } from '../../../../src/audio/time.ts';
import { topOfScore } from '../../listen/positions.ts';
import { partIds } from '../../listen/validate.ts';
import { EXPERIMENT } from '../src/io.ts';
import { BasicPitchChain } from '../src/challenger/chain.ts';
import { BasicPitchChain2 } from '../src/challenger/chain2.ts';
describe('039 downstream inheritance',()=>{
 it('preserves reports exactly when decoded observations are identical, including rejection',()=>{
   const score=JSON.parse(readFileSync(join(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8')) as MnxStructure;
   const c=compilePerformance(score);if(!c.ok)throw Error('Score failed');
   const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
   for(const pitches of [[60,62,64,65],[24,27],[]]) {
     const observations=pitches.map((midi,i)=>({midi,onset:i,end:i+.8,availableAt:4,confidence:.8}));
     const reports=[new BasicPitchChain(observations),new BasicPitchChain2(observations)].map(chain=>{
       expect(chain.start(score,handoff,{sampleRate:48000,chunkSamples:480}).ok).toBe(true);
       chain.feed(new Float32Array(),4);chain.finish();return chain.assessment();
     });
     expect(reports[1]).toEqual(reports[0]);
   }
 });
});
