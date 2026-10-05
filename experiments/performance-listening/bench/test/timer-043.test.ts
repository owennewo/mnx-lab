import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {EXPERIMENT} from '../src/io.ts';
import {compilePerformance} from '../../../../src/audio/performance.ts';
import {rational} from '../../../../src/audio/time.ts';
import {topOfScore} from '../../listen/positions.ts';
import {partIds} from '../../listen/validate.ts';
import {execute043} from '../src/challenger/live043.ts';
import {prefixEqual3} from '../src/challenger/streaming3.ts';
describe('043 service boundary',()=>{
 it('excludes slow evidence hooks without changing service clocks or ordered decisions',()=>{
  const score=JSON.parse(readFileSync(resolve(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8'));
  const c=compilePerformance(score);expect(c.ok).toBe(true);if(!c.ok)throw Error('score');
  const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
  const model={predict:(_input:Float32Array,indices:readonly number[])=>{const begin=Math.max(0,Math.min(...indices)-10),length=172-begin;return {begin,length,note:new Float32Array(length*88),onset:new Float32Array(length*88),contour:new Float32Array(length*264)};}};
  const run=(slow:boolean)=>{let clock=0;return execute043(model,score,handoff,new Float32Array(9600),{now:()=>++clock,afterService:()=>{if(slow)clock+=10000;}});};
  const a=run(false),b=run(true);
  expect(b.cost).toEqual(a.cost);expect(b.calls.map(x=>[x.elapsed,x.completion])).toEqual(a.calls.map(x=>[x.elapsed,x.completion]));
  expect(prefixEqual3(a.payloads,b.payloads,9600)).toBe(true);expect(a.cost.modelCalls).toBe(2);
 });
});
