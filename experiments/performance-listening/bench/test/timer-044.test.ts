import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {EXPERIMENT} from '../src/io.ts';
import {compilePerformance} from '../../../../src/audio/performance.ts';
import {rational} from '../../../../src/audio/time.ts';
import {topOfScore} from '../../listen/positions.ts';
import {partIds} from '../../listen/validate.ts';
import {execute043} from '../src/challenger/live043.ts';
import {execute044} from '../src/challenger/live044.ts';
it('isolated harness preserves service calls, payloads and cost including empty feeds',()=>{
 const score=JSON.parse(readFileSync(resolve(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8')),c=compilePerformance(score);if(!c.ok)throw Error('score');
 const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
 const model={predict:(_input:Float32Array,indices:readonly number[])=>{const begin=Math.max(0,Math.min(...indices)-10),length=172-begin;const note=new Float32Array(length*88);for(let k=0;k<length;k++)note[k*88+39]=.9;return {begin,length,note,onset:note,contour:new Float32Array(length*264)};}};
 const run=(f:typeof execute043|typeof execute044)=>{let time=0;return f(model,score,handoff,new Float32Array(19680),{now:()=>++time});};
 const a=run(execute043),b=run(execute044);expect(b.payloads).toEqual(a.payloads);expect(b.record).toEqual(a.record);expect(b.cost).toEqual(a.cost);expect(b.cost.modelCalls).toBe(4);
});
