import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {resamplePrefix,localFrameTime} from '../src/challenger/native.ts';
import {BasicPitchChain} from '../src/challenger/chain.ts';
import {compilePerformance} from '../../../../src/audio/performance.ts';
import {topOfScore} from '../../listen/positions.ts';
import {partIds} from '../../listen/validate.ts';
import {rational} from '../../../../src/audio/time.ts';
import {EXPERIMENT} from '../src/io.ts';
import type {MnxStructure} from '../../../../src/model/mnx.ts';
describe('challenger observation adapter',()=>{
 it('resampling never reads beyond the delivered prefix and incremental output equals a single prefix',()=>{
   const audio=Array.from({length:4800},(_,i)=>Math.sin(i/37));
   const first=resamplePrefix(audio.slice(0,480),0),whole=resamplePrefix(audio,0);
   expect(first.length).toBe(221);expect(whole.length).toBe(2205);
   expect([...first,...resamplePrefix(audio,first.length)]).toEqual(whole);
   expect(resamplePrefix([...audio.slice(0,480),...audio.slice(480).map(x=>-x)],0).slice(0,first.length)).toEqual(first);
 });
 it('reports all ideal notes and steady tempo, and rejects unrelated pitches without tempo',()=>{
   const score=JSON.parse(readFileSync(join(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8')) as MnxStructure,c=compilePerformance(score);expect(c.ok).toBe(true);if(!c.ok)return;
   const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
   const tokens=[60,62,64,65].map((midi,i)=>({midi,onset:i,end:i+1,availableAt:4,confidence:1}));
   const chain=new BasicPitchChain(tokens);expect(chain.start(score,handoff,{sampleRate:48000,chunkSamples:480}).ok).toBe(true);chain.feed(new Float32Array(),4);chain.finish();
   expect(chain.assessment().notes.map(n=>n.kind==='note'?n.verdict:null)).toEqual(['match','match','match','match']);expect(chain.assessment().tempo.overall).toBe(60);
   const wrong=new BasicPitchChain(tokens.map(t=>({...t,midi:t.midi+24})));wrong.start(score,handoff,{sampleRate:48000,chunkSamples:480});wrong.feed(new Float32Array(),4);wrong.finish();
   expect(wrong.assessment().notes.every(n=>n.kind==='note'&&n.verdict==='missing')).toBe(true);expect(wrong.assessment().tempo.overall).toBeNull();
 });
 it('uses delivery time for live decisions and holds during silence',()=>{
   const score=JSON.parse(readFileSync(join(EXPERIMENT,'sources/s1-one-bar-c4-f4.mnx.json'),'utf8')) as MnxStructure,c=compilePerformance(score);if(!c.ok)throw Error();
   const chain=new BasicPitchChain();chain.start(score,{from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1},{sampleRate:48000,chunkSamples:480});
   const observed=[0,.012,.024].flatMap(audioTime=>chain.observe({audioTime,availableAt:.1,midi:60,confidence:.8,silent:false}));
   expect(observed.at(-1)?.kind).toBe('position');expect(observed.at(-1)?.refersTo).toBe(.1);
   expect(chain.observe({audioTime:.8,availableAt:1,midi:null,confidence:0,silent:true})).toEqual([]);
   expect(localFrameTime(22050-43844,156)).toBeCloseTo(.82276644,8);
 });
});
