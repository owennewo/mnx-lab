import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { clockFollower } from '../src/candidates/clockFollower.ts';
import { evaluate } from '../src/evaluate/index.ts';
import { execute } from '../src/run/runner.ts';
import { validateGolden } from '../src/validate.ts';
import { asGolden, gates, ladderGolden } from '../src/ladder/goldens.ts';
import { durationSamples, maxPolyphony, noteLabels, renderSines, scoreNotes, type RenderedNote, type RungZeroRecipe } from '../src/ladder/render.ts';

const scale = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: 60, fromQuarter: 0, toQuarter: 8, sampleRate: 48000, peakDbfs: -12, rampSeconds: 0.01 };
const profile = Object.fromEntries(['melodic', 'polyphonic', 'harmonic', 'dynamics', 'rhythm', 'tempo', 'structuralAmbiguity', 'navigation']
  .map(k => [k, { level: 1, range: 'test' }])) as never;

describe('score-render@1 rung 0', () => {
  it('places every score note at sample-exact score timing', () => {
    const notes = scoreNotes(scale, recipe);
    expect(notes.map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(notes.map(n => n.fromSample)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map(q => q * 48000));
    expect(notes.every(n => n.toSample - n.fromSample === 48000)).toBe(true);
    expect(durationSamples(recipe)).toBe(8 * 48000);
    expect(maxPolyphony(notes)).toBe(1);
  });

  it('cuts notes at the window end and keeps only notes that start inside it', () => {
    const window = { ...recipe, fromQuarter: 1, toQuarter: 2.5 };
    const notes = scoreNotes(scale, window);
    expect(notes.map(n => [n.midi, n.fromSample, n.toSample])).toEqual([[62, 0, 48000], [64, 48000, 72000]]);
  });

  it('never clips: the level per note is the peak shared by the largest chord', () => {
    const note = (fromSample: number, toSample: number, midi: number): RenderedNote =>
      ({ fromSample, toSample, midi, hz: 440 * 2 ** ((midi - 69) / 12), scoreQuarter: 0, scoreDuration: { num: 1, den: 1 }, noteKey: null });
    const chord = [note(0, 48000, 48), note(0, 48000, 52), note(24000, 96000, 55)];
    expect(maxPolyphony(chord)).toBe(3);
    expect(maxPolyphony([note(0, 100, 60), note(100, 200, 62)])).toBe(1);
    const pcm = renderSines(chord, { ...recipe, toQuarter: 2 });
    const peak = Math.max(...Array.from(pcm, Math.abs)) / 32767;
    expect(peak).toBeLessThanOrEqual(10 ** (-12 / 20) + 1e-4);
    expect(peak).toBeGreaterThan(0.1);
  });

  it('judges a rendered score with the frozen evaluator: the clock follows it and fails the wrong-score control', () => {
    const notes = scoreNotes(scale, recipe), labels = noteLabels(notes, recipe);
    const duration = durationSamples(recipe) / 48000;
    const pcm = Float32Array.from(renderSines(notes, recipe), x => x / 32768);
    const common = { set: 'test', recipe, duration, audioSha256: 'test', score: 'scale', notes: labels, profile, scoreOrigin: 'public s2' };
    const positive = ladderGolden({ ...common, example: 'positive' }), wrong = ladderGolden({ ...common, example: 'wrong-score' });
    for (const g of [positive, wrong]) validateGolden(asGolden(g));
    const run = execute(clockFollower, scale, { bpm: 60, unit: 'quarter' }, pcm);
    const clean = [{ pass: true }];
    const followed = gates(evaluate(asGolden(positive), run.record), run.cost, clean);
    expect(followed.supportedCorrect).toBe(1);
    expect(followed.exposureFraction).toBe(0);
    expect(followed.failed.filter(k => !['sustained', 'chunkP99'].includes(k))).toEqual([]);
    const control = gates(evaluate(asGolden(wrong), run.record), run.cost, clean);
    expect(control.unsupportedRejection).toBe(0);
    expect(control.failed).toEqual(expect.arrayContaining(['unsupportedRejection', 'exposure', 'longestExposure', 'deadline']));
  });
});
