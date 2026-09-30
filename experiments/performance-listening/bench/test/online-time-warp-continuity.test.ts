import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { continuityPath } from '../src/candidates/onlineTimeWarpContinuityPath.ts';
import { onlineTimeWarpWith, V2_CONFIG } from '../src/candidates/onlineTimeWarpConfigurable.ts';
import { onlineTimeWarp9 } from '../src/candidates/onlineTimeWarp9.ts';
import { renderSines, scoreNotes, type RungZeroRecipe } from '../src/ladder/render.ts';
import { execute } from '../src/run/runner.ts';
const score = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: .01 };
const audio = Float32Array.from(renderSines(scoreNotes(score, recipe), recipe), x => x / 32768);
const tempo = { bpm: 60, unit: 'quarter' } as const;
describe('causal endpoint tempo continuity', () => {
  it('reproduces the old path when the prior has zero weight', () => {
    const before = execute(() => onlineTimeWarpWith(V2_CONFIG), score, tempo, audio).record;
    const after = execute(() => continuityPath(V2_CONFIG, 0), score, tempo, audio).record;
    expect(after).toEqual(before);
  }, 60000);
  it('claims sounding evidence but refuses silence after a sounding prefix', () => {
    const tail = audio.slice(); tail.fill(0, 3 * 48000);
    const run = execute(onlineTimeWarp9, score, tempo, tail).record;
    expect(run.some(d => d.kind === 'position')).toBe(true);
    expect(run.filter(d => d.madeAt >= 3.2).every(d => d.kind === 'unsupported')).toBe(true);
  }, 60000);
});
