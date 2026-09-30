import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { onlineTimeWarp12, robustTrajectory } from '../src/candidates/onlineTimeWarp12.ts';
import { onlineTimeWarp8 } from '../src/candidates/onlineTimeWarp8.ts';
import { renderSines, scoreNotes, type RungZeroRecipe } from '../src/ladder/render.ts';
import { execute } from '../src/run/runner.ts';
describe('robust causal trajectory', () => {
  it('recovers a non-nominal speed and offset through a brief endpoint excursion', () => {
    const samples = Array.from({ length: 101 }, (_, i) => ({ clock: i * .02, quarter: 3 + 1.2 * i * .02 + (i >= 40 && i <= 45 ? .6 : 0) }));
    const fit = robustTrajectory(samples, 1);
    expect(fit.speed).toBeCloseTo(1.2, 8); expect(fit.quarter).toBeCloseTo(5.4, 8);
  });
  it('preserves the incumbent support states, including a silent tail', () => {
    const score = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
    const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: .01 };
    const audio = Float32Array.from(renderSines(scoreNotes(score, recipe), recipe), x => x / 32768); audio.fill(0, 3 * 48000);
    const tempo = { bpm: 60, unit: 'quarter' } as const;
    const after = execute(() => onlineTimeWarp12(), score, tempo, audio).record;
    const before = execute(() => onlineTimeWarp8(), score, tempo, audio).record;
    expect(after.map(d => [d.madeAt, d.kind])).toEqual(before.map(d => [d.madeAt, d.kind]));
    expect(after.some(d => d.kind === 'position')).toBe(true);
    expect(after.filter(d => d.madeAt >= 3.2).every(d => d.kind === 'unsupported')).toBe(true);
  }, 60000);
});
