import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { onlineTimeWarp7, type DecoyTrace } from '../src/candidates/onlineTimeWarp7.ts';
import { onlineTimeWarpWith, V2_CONFIG, type SupportTrace } from '../src/candidates/onlineTimeWarpConfigurable.ts';
import { durationSamples, renderSines, scoreNotes, type RungZeroRecipe } from '../src/ladder/render.ts';
import { execute } from '../src/run/runner.ts';
const score = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: .01 };
const audio = Float32Array.from(renderSines(scoreNotes(score, recipe), recipe), x => x / 32768);
const tempo = { bpm: 60, unit: 'quarter' } as const;
describe('the reversed-reference support comparator', () => {
  it('preserves the local cost multiset while leaving every emitted position on the forward path', () => {
    const frames: DecoyTrace[] = [], forward: SupportTrace[] = [];
    const run = execute(() => onlineTimeWarp7({ trace: f => frames.push(f) }), score, tempo, audio);
    const baseline = execute(() => onlineTimeWarpWith({ ...V2_CONFIG, support: { kind: 'rank', limit: .1 }, alwaysClaim: true, trace: f => forward.push(f) }), score, tempo, audio);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.map(f => f.forward)).toEqual(forward);
    expect(frames.every(f => f.forward.freeCost === f.reverse.freeCost)).toBe(true);
    const positions = run.record.filter(d => d.kind === 'position');
    expect(positions.length).toBeGreaterThan(0);
    for (const d of positions) {
      const old = baseline.record.find(e => e.madeAt === d.madeAt)!;
      expect({ ...d, id: old.id }).toEqual(old);
    }
  }, 60_000);
  it('does not claim silence, including after a sounding prefix', () => {
    const silent = new Float32Array(durationSamples(recipe));
    expect(execute(onlineTimeWarp7, score, tempo, silent).record.every(d => d.kind === 'unsupported')).toBe(true);
    const tail = audio.slice(); tail.fill(0, 3 * 48000);
    const run = execute(onlineTimeWarp7, score, tempo, tail);
    // The 2048-sample window at 12 kHz clears after 171 ms; allow the next hop.
    expect(run.record.filter(d => d.madeAt >= 3.2).every(d => d.kind === 'unsupported')).toBe(true);
  }, 60_000);
  it('rotates decoys over exactly the same frames, and an unrotated reference is unchanged', () => {
    const traceOf = (extra: object) => { const rows: SupportTrace[] = []; execute(() => onlineTimeWarpWith({ ...V2_CONFIG, support: { kind: 'rank', limit: .1 }, alwaysClaim: true, ...extra, trace: f => rows.push(f) }), score, tempo, audio); return rows; };
    const forward = traceOf({});
    expect(traceOf({ referenceRotation: 0 })).toEqual(forward);
    expect(traceOf({ referenceRotation: 1 })).toEqual(forward);
    for (const decoy of [traceOf({ referenceRotation: 3 / 8 }), traceOf({ referenceOrder: 'reverse', referenceRotation: 5 / 8 })]) {
      expect(decoy.map(f => [f.clock, f.freeCost])).toEqual(forward.map(f => [f.clock, f.freeCost]));
      expect(decoy.map(f => f.best)).not.toEqual(forward.map(f => f.best));
    }
  }, 60_000);
});
