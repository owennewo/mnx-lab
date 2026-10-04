import { describe, it, expect } from 'vitest';
import { readObservationOracle2, checkHandCase, faultProbes, legacyChecks } from '../src/challenger/validateObservation2.ts';
import { completedAt, reducePitch, offlineTrim } from '../src/challenger/observation2.ts';
describe('observation-seam@2 frozen hand oracle (independent audit pending)', () => {
  it('reproduces every frozen arithmetic case', () => {
    for (const c of readObservationOracle2()) expect(checkHandCase(c).agrees, c.id).toBe(true);
  });
  it('separates each wrong-rule family and preserves the legacy resampling/grid', () => {
    const cases = readObservationOracle2();
    for (const p of faultProbes(cases)) expect(p.detected, p.family).toBe(true);
    for (const c of legacyChecks(cases)) expect(c.agrees, c.id).toBe(true);
  });
  it('keeps accumulated backlog and clears it during idle delivery', () => {
    let completion = .02;
    completion = completedAt(.01, completion, .01); expect(completion).toBeCloseTo(.03, 12);
    completion = completedAt(.02, completion, .1); expect(completion).toBeCloseTo(.13, 12);
    completion = completedAt(.03, completion, .005); expect(completion).toBeCloseTo(.135, 12);
    completion = completedAt(.2, completion, .04); expect(completion).toBeCloseTo(.24, 12);
  });
  it('rejects malformed measurements/maps and insufficient offline windows', () => {
    expect(() => completedAt(.1, 0, -1)).toThrow();
    expect(() => completedAt(.1, 0, NaN)).toThrow();
    expect(() => reducePitch([.8])).toThrow();
    expect(() => offlineTrim(1323000, 1)).toThrow();
  });
});
