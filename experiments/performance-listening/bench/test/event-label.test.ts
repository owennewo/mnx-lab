import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { perfectLabel, type PerformanceLabel, validateLabel } from '../src/events/label.ts';
import { expandLabel, readOracle } from '../src/events/oracle.ts';
import { windowNotes } from '../src/ladder/render.ts';
import { totalQuarters } from '../src/stages/stage1.ts';

const source = (name: string) => JSON.parse(readFileSync(new URL(`../../sources/${name}`, import.meta.url), 'utf8')) as MnxStructure;
const labelOf = (score: MnxStructure, tempo: number) => {
  const c = compilePerformance(score);
  if (!c.ok) throw new Error('compile');
  const quarters = totalQuarters(c.performance), toSample = (q: number) => Math.round(q * 60 / tempo * 48000);
  return perfectLabel({ id: 't', performance: c.performance, score: { path: 'p', sha256: 'x' }, handedQuartersPerMinute: 90, duration: toSample(quarters) / 48000,
    audio: null, rendered: windowNotes(score, 0, quarters, toSample, toSample(quarters), 480), sampleRate: 48000, recipe: null });
};

describe('performance-label@1', () => {
  it('labels a perfect performance with sample-exact onsets and one admissible event at a time', () => {
    const label = labelOf(source('s2-two-bar-scale.mnx.json'), 90);
    expect(label.events.map(e => [e.at.ordinal, `${e.at.metricOffset.num}/${e.at.metricOffset.den}`, e.notes[0]!.midi]))
      .toEqual([[0, '0/1', 60], [0, '1/4', 62], [0, '1/2', 64], [0, '3/4', 65], [1, '0/1', 67], [1, '1/4', 69], [1, '1/2', 71], [1, '3/4', 72]]);
    expect(label.performance.events.map(p => p.onset! * 48000)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map(k => k * 32000));
    expect(label.cursor.segments.map(s => s.admissible)).toEqual([[0], [1], [2], [3], [4], [5], [6], [7]]);
    expect(label.duration).toBeCloseTo(8 * 2 / 3, 12);
  });

  it('refuses repeated identical events, which need an ambiguity rule it does not implement', () => {
    const score = source('s1-one-bar-c4-f4.mnx.json');
    const second = score.parts[0]!.measures[0]!.sequences[0]!.content[1] as { notes: { pitch: { step: string } }[] };
    second.notes[0]!.pitch.step = 'C';
    expect(() => labelOf(score, 90)).toThrow(/ambiguity rule/);
  });

  it('rejects labels whose truth, admissible sets or outcomes are inconsistent', () => {
    const oracle = readOracle(), broken = (edit: (l: PerformanceLabel) => void) => { const l = expandLabel(oracle, 'toy8-dead-e2'); edit(l); return () => validateLabel(l); };
    expect(broken(() => {})).not.toThrow();
    expect(broken(l => { l.cursor.segments[3]!.truth = 2; l.cursor.segments[3]!.admissible = [2, 3]; })).toThrow(/segments must start at exactly the sounded onsets/);
    expect(broken(l => { l.cursor.segments[2]!.admissible = [1]; })).toThrow(/omits its truth/);
    expect(broken(l => { l.performance.events[2]!.distinguishableAt = 2; })).toThrow(/distinguishableAt/);
    expect(broken(l => { l.performance.events[3]!.notes[0] = { noteKey: 'n3', outcome: 'wrong', onset: 3, end: 4, heardMidi: 65 }; })).toThrow(/names the pitch heard/);
    expect(broken(l => { l.performance.events[5]!.onset = 4.5; })).toThrow(/earliest sounded note/);
  });
});
