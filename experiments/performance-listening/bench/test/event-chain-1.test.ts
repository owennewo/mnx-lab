import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { rational } from '../../../../src/audio/time.ts';
import { topOfScore } from '../../listen/positions.ts';
import { partIds } from '../../listen/validate.ts';
import { sinePitch,alignPitches,EventChain1 } from '../src/listeners/eventChain1.ts';
import { EXPERIMENT } from '../src/io.ts';
const score=JSON.parse(readFileSync(resolve(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8'));
const c=compilePerformance(score); if(!c.ok) throw new Error('Test score invalid');
const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
const delivery={sampleRate:48000,chunkSamples:480};
describe('event-chain@1 components, independent of the stage set',()=>{
  it('hears an ideal A440 and rejects digital silence',()=>{
    const sine=Float32Array.from({length:960},(_,i)=>0.2*Math.sin(2*Math.PI*440*i/48000));
    expect(sinePitch(sine,48000)).toEqual({midi:69,silent:false});
    expect(sinePitch(new Float32Array(960),48000)).toEqual({midi:null,silent:true});
  });
  it('aligns omissions and extras without inventing a pitch match',()=>{
    expect([...alignPitches([60,62,64],[60,70,64])].sort()).toEqual([[0,0],[2,2]]);
    expect(alignPitches([36,40],[60,64]).size).toBe(0);
  });
  it('refuses delivery and a start it cannot honour',()=>{
    expect(new EventChain1().start(score,handoff,{sampleRate:44100,chunkSamples:128}).ok).toBe(false);
    expect(new EventChain1().start(score,{...handoff,parts:[]},delivery).ok).toBe(false);
    expect(new EventChain1().start(score,{...handoff,from:{ordinal:0,metricOffset:rational(1n,4n)}},delivery).ok).toBe(false);
  });
  it('does not advance in silence and claims no tempo or played notes at finish',()=>{
    const listener=new EventChain1();expect(listener.start(score,handoff,delivery).ok).toBe(true);
    const emitted=Array.from({length:30},(_,i)=>listener.feed(new Float32Array(480),(i+1)*0.01)).flat();
    expect(emitted.map(e=>e.kind)).toEqual(['unsupported']);
    const notes=listener.finish();expect(notes.every(n=>n.kind==='note'&&n.verdict==='missing')).toBe(true);
    expect(listener.assessment().tempo).toEqual({overall:null,intervals:[],flags:[]});
  });
});
