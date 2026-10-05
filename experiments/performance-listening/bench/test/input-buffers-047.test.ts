import {describe,it,expect} from 'vitest';
import {compareInput047,synthetic047} from '../src/challenger/compareInput047.ts';
import {StreamingInput047} from '../src/challenger/streaming047.ts';
import {StreamingInput3} from '../src/challenger/streaming3.ts';
describe('047 storage compatibility',()=>{
 it('preserves physical inputs through irregular deliveries, growth, wraps, reset and invalid input',()=>{
   const s=synthetic047(); expect(s.cases.every(r=>r.parity)).toBe(true); expect(s.resetIsolation).toBe(true);expect(s.invalidBeforeMutation).toBe(true);
 });
 it('keeps one window and bounded regular capacity while rejecting no finite inputs',()=>{
   const x=Float32Array.from({length:200003},(_,i)=>(i%31-15)/16),r=compareInput047(x);
   expect(r.candidate.windowArrays).toBe(1);expect(r.baseline.windowArrays).toBeGreaterThan(30);
   expect(r.candidate.rawArrays).toBe(1);expect(r.candidate.maxRawCapacity).toBe(482);
 });
 it('preserves selected frames and watermark reduction with injected maps',()=>{
   const old=new StreamingInput3(),fresh=new StreamingInput047(),input=new Float32Array(4800),map=new Float32Array(172*88);
   map.fill(.31);old.feed(input);fresh.feed(input);expect(fresh.frames(map)).toEqual(old.frames(map));expect(fresh.watermark).toBe(old.watermark);
 });
});
