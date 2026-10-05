import { describe, it, expect } from 'vitest';
import { oracle5, check5, inherited5, probes5 } from '../src/challenger/seam5.ts';
describe('seam5 additional frozen finish and safe-length cases; independent audit required', () => {
 it('reproduces every new observable hand answer', () => {
  for (const c of oracle5()) { const result=check5(c);expect(result.agrees,`${c.id}: ${JSON.stringify(result.actual)}`).toBe(true); }
 });
 it('retains all declared inherited answers and representation layers', () => {
  for (const c of inherited5()) expect(c.agrees,c.id).toBe(true);
 });
 it('detects prohibited tail flush, backdating, history aliasing and unsafe lengths', () => {
  for (const p of probes5()) expect(p.detected,p.fault).toBe(true);
 });
});
