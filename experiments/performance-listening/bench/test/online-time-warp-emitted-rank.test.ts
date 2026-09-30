import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { onlineTimeWarp11, RANK_LIMIT, type WindowedRankTrace } from '../src/candidates/onlineTimeWarp11.ts';
import { acousticAnchoredPath } from '../src/candidates/onlineTimeWarpAcousticAnchorPath.ts';
import { V2_CONFIG } from '../src/candidates/onlineTimeWarpConfigurable.ts';
import { durationSamples, renderSines, scoreNotes, type RungZeroRecipe } from '../src/ladder/render.ts';
import { execute } from '../src/run/runner.ts';
const score = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: .01 };
const audio = Float32Array.from(renderSines(scoreNotes(score, recipe), recipe), x => x / 32768);
const tempo = { bpm: 60, unit: 'quarter' } as const;
describe('support on the emitted trajectory', () => {
  it('claims only positions on the incumbent path, and only while the two-second rank is within the limit', () => {
    const frames: WindowedRankTrace[] = [];
    const run = execute(() => onlineTimeWarp11({ trace: f => frames.push(f) }), score, tempo, audio);
    const baseline = execute(() => acousticAnchoredPath({ ...V2_CONFIG, support: { kind: 'rank', limit: .1 }, alwaysClaim: true }, .02), score, tempo, audio);
    expect(frames.some(f => f.supported)).toBe(true);
    expect(frames.every(f => !f.supported || f.windowRank <= RANK_LIMIT)).toBe(true);
    const positions = run.record.filter(d => d.kind === 'position');
    expect(positions.length).toBeGreaterThan(0);
    for (const d of positions) {
      const old = baseline.record.find(e => e.madeAt === d.madeAt)!;
      expect({ ...d, id: old.id }).toEqual(old);
    }
  }, 60_000);
  it('does not claim silence, including after a sounding prefix', () => {
    const silent = new Float32Array(durationSamples(recipe));
    expect(execute(() => onlineTimeWarp11(), score, tempo, silent).record.every(d => d.kind === 'unsupported')).toBe(true);
    const tail = audio.slice(); tail.fill(0, 3 * 48000);
    const run = execute(() => onlineTimeWarp11(), score, tempo, tail);
    expect(run.record.filter(d => d.madeAt >= 3.2).every(d => d.kind === 'unsupported')).toBe(true);
  }, 60_000);
});
