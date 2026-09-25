import { expect, it } from 'vitest';
import { anchorLimits } from '../src/v2/anchor-limits.ts';
it('shows why exact four-beat bar anchors alone do not establish 80% precision coverage',()=>{
 const r=anchorLimits([{seconds:0,quarter:0},{seconds:2,quarter:4}],2);
 expect(r.maximumAnswerableFractionUnderAssumptions).toBeCloseTo(.3125,12);
 expect(r.bars[0]!.maxHalfWidthQuarters).toBeCloseTo(.4,12);
});
it('shows that exact beat anchors narrow the interior envelope and rejects impossible rates',()=>{
 expect(anchorLimits([{seconds:0,quarter:0},{seconds:.5,quarter:1}],2).maximumAnswerableFractionUnderAssumptions).toBe(1);
 expect(()=>anchorLimits([{seconds:0,quarter:0},{seconds:.5,quarter:4}],2)).toThrow(/tempo envelope/);
});
