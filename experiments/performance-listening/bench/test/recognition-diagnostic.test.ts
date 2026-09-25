import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { frames,templates,similarity,frontier,WINDOW,RATE } from '../src/diagnostic/features.ts';
const score=JSON.parse(readFileSync(new URL('../../contracts/handwritten.score.mnx.json',import.meta.url),'utf8'));
it('uses the exact causal analysis cadence and window center; later samples cannot change features',()=>{
 const audio=Float32Array.from({length:24000},(_,i)=>.2*Math.sin(2*Math.PI*261.625565*i/48000));
 for(const version of [1,2] as const){
  const a=frames(audio,version),changed=audio.slice();changed.fill(.7,12000);const b=frames(changed,version);
  expect(a[0]!.clock).toBe(.19);expect(a[1]!.clock).toBe(.21);expect(a[0]!.center).toBeCloseTo(.19-WINDOW/RATE/2,12);
  expect(b.filter(f=>f.clock<=.25)).toEqual(a.filter(f=>f.clock<=.25));
  expect(similarity(templates(score,version)[0]!,a[0]!.feature)).toBeGreaterThan(.65);
  expect(frames(new Float32Array(24000),version).every(f=>f.rms===0&&f.feature.every(v=>v===0))).toBe(true);
 }
});
it('cannot manufacture separation by splitting tied scores or accepting silent frames',()=>{
 const tied=Array.from({length:20},()=>({positive:.8,wrong:.8,dust:.8,audible:true}));
 expect(frontier(tied).best.positive).toBe(0);
 const separated=tied.map(()=>({positive:.9,wrong:.3,dust:.4,audible:true}));
 expect(frontier(separated).best).toMatchObject({positive:1,wrong:0,dust:0});
 expect(frontier(separated.map(r=>({...r,audible:false}))).best.positive).toBe(0);
});
