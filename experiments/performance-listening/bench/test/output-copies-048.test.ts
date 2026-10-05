import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {EXPERIMENT} from '../src/io.ts';
import {compilePerformance} from '../../../../src/audio/performance.ts';
import {rational} from '../../../../src/audio/time.ts';
import {topOfScore} from '../../listen/positions.ts';
import {partIds} from '../../listen/validate.ts';
import {execute047} from '../src/challenger/live047.ts';
import type {IncrementalModel041} from '../src/challenger/incremental041.ts';
import {prefixEqual3} from '../src/challenger/streaming3.ts';
describe('048 live note-only bridge compatibility',()=>{
 it('requires no unused maps and excludes output diagnostics from service clocks',()=>{
  const score=JSON.parse(readFileSync(resolve(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8'));
  const c=compilePerformance(score);if(!c.ok)throw Error('score');
  const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
  const model={predict:(_input:Float32Array,indices:readonly number[])=>{const begin=Math.max(0,Math.min(...indices)-10),length=172-begin;return {begin,length,note:new Float32Array(length*88),get onset():Float32Array{throw Error('unused onset read');},get contour():Float32Array{throw Error('unused contour read');}};}};
  const narrow={predict:(_input:Float32Array,indices:readonly number[])=>{const begin=Math.max(0,Math.min(...indices)-10),length=172-begin;return {begin,length,note:new Float32Array(length*88)};}};
  const run=(m:unknown,slow=false)=>{let clock=0;return execute047(m as Pick<IncrementalModel041,'predict'>,score,handoff,new Float32Array(9600),{now:()=>++clock,afterService:()=>{if(slow)clock+=10000;}});};
  const a=run(model),b=run(narrow,true);expect(b.cost).toEqual(a.cost);expect(b.allocations).toEqual(a.allocations);
  expect(prefixEqual3(a.payloads,b.payloads,9600)).toBe(true);expect(a.cost.modelCalls).toBe(2);
 });
});
