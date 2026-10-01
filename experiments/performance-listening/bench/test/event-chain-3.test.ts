import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { rational } from '../../../../src/audio/time.ts';
import { topOfScore } from '../../listen/positions.ts';
import { partIds } from '../../listen/validate.ts';
import { summarizeBars } from '../src/events/assessment3.ts';
import { EventChain2 } from '../src/listeners/eventChain2.ts';
import { EventChain3, otherBarSummaries } from '../src/listeners/eventChain3.ts';
import { EXPERIMENT } from '../src/io.ts';
import { mixSines, windowNotes } from '../src/ladder/render.ts';
import { writeWav, readWav } from '../src/generate/wav.ts';
import { executeSeam } from '../src/seam/runner.ts';

const delivery = { sampleRate: 48000, chunkSamples: 480 };
const load = (name: string) => JSON.parse(readFileSync(resolve(EXPERIMENT, 'sources', name), 'utf8'));
/** A score played at `tempo`, with every beat of one bar slowed by `factor`. */
function play(score: ReturnType<typeof load>, quarters: number, tempo: number, bar: number | null, factor: number) {
  const seconds = (q: number) => 60/tempo*(q + (bar === null ? 0 : Math.min(4, Math.max(0, q - 4*bar))*(1/factor - 1)));
  const sample = (q: number) => Math.round(seconds(q)*48000), length = sample(quarters);
  const c = compilePerformance(score); if (!c.ok) throw new Error('Invalid test score');
  const handoff = { from: topOfScore(c.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
  const audio = readWav(writeWav(mixSines(windowNotes(score, 0, quarters, sample, length, 480), length, -12, 480, 48000)));
  const two = new EventChain2(), three = new EventChain3();
  return { a: executeSeam(() => two, score, handoff, audio, delivery), b: executeSeam(() => three, score, handoff, audio, delivery), two, three };
}

describe('event-chain@3 other-bars reporting', () => {
  it('computes the audited instrument\'s bar summaries from its own intervals', () => {
    const at = (ordinal: number, quarters: number, seconds: number) => ({ ordinal, quarters, seconds, quartersPerMinute: 60*quarters/seconds });
    const cases = [
      { ordinals: [0, 1, 2, 3], intervals: [at(0, 1, 1), at(0, 1, 1), at(1, 2, 1), at(2, 1, 2), at(3, 1, 1), at(3, 1, .5)] }, // exact-half medians
      { ordinals: [0, 1, 2, 3, 4], intervals: [at(1, 1, 1), at(2, 1, 1), at(3, 1, 2), at(4, 2, 1)] }, // bar 0 has no interval
      { ordinals: [0, 1], intervals: [at(1, 1, 1)] }, // no other contributor
      { ordinals: [0, 1, 2, 3], intervals: [at(0, 1, 1), at(2, 2, 2.2), at(3, 1, 1), at(1, 1, 1)] }, // an omission spans bars 1–2
    ];
    for (const c of cases) {
      const listener = otherBarSummaries(c.ordinals, c.intervals), instrument = summarizeBars(c.ordinals, c.intervals);
      expect(listener).toHaveLength(instrument.length);
      listener.forEach((b, k) => {
        const t = instrument[k]!;
        expect({ ...b, quartersPerMinute: null, reference: null, ratio: null }).toEqual({ ...t, quartersPerMinute: null, reference: null, ratio: null });
        for (const f of ['quartersPerMinute', 'reference', 'ratio'] as const) {
          if (t[f] === null) expect(b[f]).toBeNull(); else expect(b[f]).toBeCloseTo(t[f]!, 12);
        }
      });
    }
  });

  it('keeps @2\'s live record and musical output, and flags only an eligible slowed bar', () => {
    const { a, b, two, three } = play(load('s3-four-bar-melody.mnx.json'), 16, 90, 1, 0.6);
    expect(b.record).toEqual(a.record);
    const old = two.assessment(), report = three.assessment();
    expect(report.notes).toEqual(old.notes);
    expect(report.tempo.intervals).toEqual(old.tempo.intervals);
    expect(report.tempo.overall).toBe(old.tempo.overall);
    expect(report.format).toBe('assessment-report@3');
    expect(report.tempo.bars.every(x => x.eligible && x.otherBars === 3)).toBe(true);
    expect(report.tempo.flags).toEqual([{ ordinal: 1, direction: 'slow' }, { ordinal: 2, direction: 'slow' }]); // bar 2 inherits one slowed interval: 4/(3+1/.6) ≈ .857
  });

  it('reports a two-bar score without any verdict', () => {
    const { b, three } = play(load('s2-two-bar-scale.mnx.json'), 8, 90, 1, 0.5);
    expect(b.started.ok).toBe(true);
    const report = three.assessment();
    expect(report.tempo.flags).toEqual([]);
    expect(report.tempo.bars.map(x => [x.otherBars, x.eligible])).toEqual([[1, false], [1, false]]);
    expect(report.tempo.bars[1]!.ratio).toBeLessThan(0.9); // informative, but ineligible
  });
});
