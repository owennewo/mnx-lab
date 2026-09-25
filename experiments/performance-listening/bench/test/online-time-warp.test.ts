import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { onlineTimeWarp1 } from '../src/candidates/onlineTimeWarp1.ts';
import { onlineTimeWarp2 } from '../src/candidates/onlineTimeWarp2.ts';
import { evaluate } from '../src/evaluate/index.ts';
import { asGolden, gates, ladderGolden } from '../src/ladder/goldens.ts';
import { durationSamples, noteLabels, renderSines, scoreNotes, type RungZeroRecipe } from '../src/ladder/render.ts';
import { execute } from '../src/run/runner.ts';
import type { Decision } from '../src/types.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../sources/${name}`, import.meta.url), 'utf8')) as MnxStructure;
const scale = read('s2-two-bar-scale.mnx.json'), oneBar = read('s1-one-bar-c4-f4.mnx.json');
const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: 0.01 };
const profile = Object.fromEntries(['melodic', 'polyphonic', 'harmonic', 'dynamics', 'rhythm', 'tempo', 'structuralAmbiguity', 'navigation'].map(k => [k, { level: 1, range: 'test' }])) as never;
const notes = scoreNotes(scale, recipe), duration = durationSamples(recipe) / 48000;
const audio = Float32Array.from(renderSines(notes, recipe), x => x / 32768);
const golden = (example: 'positive' | 'silence') => asGolden(ladderGolden({ set: 'test', example, recipe, duration, audioSha256: 'test', score: 'scale', notes: noteLabels(notes, recipe), profile, scoreOrigin: 'public s2' }));

for (const [name, follower] of [['online-time-warp@1', onlineTimeWarp1], ['online-time-warp@2', onlineTimeWarp2]] as const) describe(name, () => {
  it('follows a rendered score at the handed tempo', () => {
    const run = execute(follower, scale, { bpm: 60, unit: 'quarter' }, audio);
    const result = gates(evaluate(golden('positive'), run.record), run.cost, [{ pass: true }]);
    expect(result.supportedCorrect).toBeGreaterThanOrEqual(0.95);
    expect(result.exposureFraction).toBe(0);
  });

  it('reports unsupported for silence and for audio that is not the handed score', () => {
    const silent = execute(follower, scale, { bpm: 60, unit: 'quarter' }, new Float32Array(audio.length));
    expect(silent.record.every(d => d.kind === 'unsupported')).toBe(true);
    const other = execute(follower, oneBar, { bpm: 60, unit: 'quarter' }, audio.slice(4 * 48000));
    const claims = other.record.filter(d => d.kind === 'position').length / other.record.length;
    expect(claims).toBeLessThan(0.2);
  });

  it('decides from the prefix alone', () => {
    const tempo = { bpm: 60, unit: 'quarter' } as const, cut = 3 * 48000;
    const changed = audio.slice(); changed.fill(0.1, cut);
    const prefix = (r: Decision[]) => JSON.stringify(r.filter(d => d.madeAt <= cut / 48000));
    expect(prefix(execute(follower, scale, tempo, changed).record)).toBe(prefix(execute(follower, scale, tempo, audio).record));
  });
});
