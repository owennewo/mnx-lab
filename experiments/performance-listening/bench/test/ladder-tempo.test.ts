import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { clockFollower } from '../src/candidates/clockFollower.ts';
import { evaluate } from '../src/evaluate/index.ts';
import { asGolden, gates, ladderGolden, type RungOneRecipe } from '../src/ladder/goldens.ts';
import { mixSines, noteLabels, windowNotes } from '../src/ladder/render.ts';
import { tempoCurve, tempoFollowing, timeMap, type TempoFamily } from '../src/ladder/tempo.ts';
import { execute } from '../src/run/runner.ts';
import { validateGolden } from '../src/validate.ts';
import { value } from '../src/types.ts';

const scale = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const profile = Object.fromEntries(['melodic', 'polyphonic', 'harmonic', 'dynamics', 'rhythm', 'tempo', 'structuralAmbiguity', 'navigation'].map(k => [k, { level: 1, range: 'test' }])) as never;

describe('rung 1 tempo curves', () => {
  it('stay whole BPM inside 80–120% of the handed tempo and are reproducible from the seed', () => {
    for (const family of ['constant', 'ramp', 'drift'] as TempoFamily[]) for (const seed of [1, 2, 101]) {
      const bpms = tempoCurve(family, seed, 101, 32);
      expect(bpms).toHaveLength(32);
      expect(bpms.every(b => Number.isInteger(b) && b >= 81 && b <= 121)).toBe(true);
      expect(tempoCurve(family, seed, 101, 32)).toEqual(bpms);
    }
    expect(new Set(tempoCurve('constant', 1, 101, 32)).size).toBe(1);
  });

  it('labels every eighth note exactly where the renderer puts it', () => {
    const bpms = tempoCurve('ramp', 3, 60, 16), map = timeMap(bpms, 0, 48000), length = map.toSample(8);
    const notes = windowNotes(scale, 0, 8, map.toSample, length, 480);
    const following = tempoFollowing(bpms, 0, 48000, length / 48000, 0.15, 'test');
    const at = (t: number) => { const l = following.find(x => t >= x.start && t <= x.end)!; if (l.state !== 'supported') throw new Error(); return value(l.truth.atStart) + (t - l.start) * value(l.truth.quartersPerSecond); };
    for (const n of notes) expect(at(n.fromSample / 48000)).toBeCloseTo(n.scoreQuarter, 4);
  });

  it('produces goldens the frozen evaluator accepts, on which the clock loses a slow performance', () => {
    const bpms = Array(16).fill(48), map = timeMap(bpms, 0, 48000), length = map.toSample(8), duration = length / 48000;
    const recipe: RungOneRecipe = { renderer: 'score-render@1', rung: 1, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: 0.01, tempo: { family: 'constant', seed: 0, segmentQuarters: 0.5, bpms } };
    const notes = windowNotes(scale, 0, 8, map.toSample, length, 480);
    const golden = ladderGolden({ set: 'test', example: 'positive', recipe, duration, audioSha256: 'test', score: 'scale', notes: noteLabels(notes, recipe), profile, scoreOrigin: 'public s2' });
    golden.labels.following = tempoFollowing(bpms, 0, 48000, duration, 0.15, 'test');
    validateGolden(asGolden(golden));
    const audio = Float32Array.from(mixSines(notes, length, -12, 480, 48000), x => x / 32768);
    const run = execute(clockFollower, scale, { bpm: 60, unit: 'quarter' }, audio);
    const result = gates(evaluate(asGolden(golden), run.record), run.cost, [{ pass: true }]);
    expect(result.supportedCorrect!).toBeLessThan(0.5);
  });
});
