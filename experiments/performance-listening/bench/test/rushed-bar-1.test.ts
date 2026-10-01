import { describe, expect, it } from 'vitest';
import { summarizeBars } from '../src/events/assessment3.ts';
import { beatSample, rushedSample, RUSH_FACTORS, RUSH_TEMPI } from '../src/stages/rushedBar1.ts';

/** The audited evaluator's flag rule (event instruments 3, step 4), restated for the design count. */
const expectedFlag = (b: { eligible: boolean; ratio: number | null }) => {
  if (!b.eligible || b.ratio === null) return 'none';
  const r = b.ratio, near = (x: number) => Math.abs(r - x) <= 1e-12, d = Math.abs(r - 1);
  if (r <= 0.9 || near(0.9)) return 'slow';
  if (r >= 1.1 || near(1.1)) return 'fast';
  return d < 0.05 && Math.abs(d - 0.05) > 1e-12 ? 'none' : 'either';
};

describe('rushed-bar stimulus', () => {
  it('agrees with an independent beat-by-beat integration and shortens only the rushed bar', () => {
    for (const tempo of RUSH_TEMPI) for (const ordinal of [0, 1, 2, 3]) for (const factor of RUSH_FACTORS) {
      for (let q = 0; q <= 16; q++) expect(rushedSample(q, tempo, ordinal, factor)).toBe(beatSample(q, tempo, ordinal, factor));
      const beat = (q: number) => rushedSample(q + 1, tempo, ordinal, factor) - rushedSample(q, tempo, ordinal, factor);
      const steady = Math.round(60 / tempo * 48000);
      for (let q = 0; q < 16; q++) {
        if (Math.floor(q / 4) === ordinal) expect(beat(q)).toBeLessThan(steady);
        else expect(Math.abs(beat(q) - steady)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('gives the pre-registered expected flag counts under endpoint attribution', () => {
    const tally: Record<string, number> = {};
    for (const bars of [2, 4]) for (const tempo of RUSH_TEMPI) for (let ordinal = 0; ordinal < bars; ordinal++) for (const factor of RUSH_FACTORS) {
      const s = (q: number) => rushedSample(q, tempo, ordinal, factor) / 48000;
      const intervals = Array.from({ length: bars * 4 - 1 }, (_, i) => ({ ordinal: Math.floor((i + 1) / 4), quarters: 1, seconds: s(i + 1) - s(i), quartersPerMinute: 60 / (s(i + 1) - s(i)) }));
      for (const b of summarizeBars(Array.from({ length: bars * 4 }, (_, i) => Math.floor(i / 4)), intervals)) tally[expectedFlag(b)] = (tally[expectedFlag(b)] ?? 0) + 1;
    }
    // The pre-registration's 398 `none` bars include the clean parents' 24; the rushed bars give 374.
    expect(tally).toEqual({ fast: 66, either: 40, none: 374 });
  });
});
