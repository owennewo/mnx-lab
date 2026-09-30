import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { controlLabel, perfectLabel, type PerformanceLabel, validateLabel, writesDeadNotes } from '../src/events/label.ts';
import { expandLabel, expandLabel2, readOracle, readOracle2 } from '../src/events/oracle.ts';
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

  it('version 2: a written dead note played dead is matched, and may ring at its written pitch as a wrong note', () => {
    const oracle = readOracle2(), broken = (id: string, edit: (l: PerformanceLabel) => void) => { const l = expandLabel2(oracle, id); edit(l); return () => validateLabel(l); };
    expect(broken('toyDW-as-written-60', () => {})).not.toThrow();
    expect(broken('toyDW-rang-60', () => {})).not.toThrow();
    expect(broken('toyDW-as-written-60', l => { l.performance.events[2]!.notes[0] = { noteKey: 'n2', outcome: 'dead', onset: 2, end: 2.1 }; })).toThrow(/is matched/);
    expect(broken('toy8-perfect-60', l => { l.performance.events[2]!.notes[0] = { noteKey: 'n2', outcome: 'wrong', onset: 2, end: 3, heardMidi: 64 }; })).toThrow(/names the pitch heard/);
    expect(broken('toy8-perfect-60', l => { l.format = 'performance-label@1'; l.events[2]!.notes[0]!.dead = true; })).toThrow(/version-2 label/);
    expect(broken('toyW-hears-toy8', l => { l.performance.events[0]!.notes[0] = { noteKey: 'w0', outcome: 'matched', onset: 0, end: 1 }; l.performance.events[0]!.onset = 0; })).toThrow(/control plays no note/);
  });

  it('labels a control: every event of the handed score missing, the whole clip unsupported', () => {
    const score = source('w1-two-bar-black-keys.mnx.json'), c = compilePerformance(score);
    if (!c.ok) throw new Error('compile');
    expect(writesDeadNotes(score)).toBe(false);
    const label = controlLabel({ id: 'w', performance: c.performance, score: { path: 'p', sha256: 'x' }, handedQuartersPerMinute: 90, duration: 2,
      audio: null, control: 'wrong-score', extras: [{ onset: 0, end: 1, midi: 60 }], recipe: {}, note: 'test' });
    expect(label.events.map(e => e.notes[0]!.midi)).toEqual([66, 68, 70, 73, 75, 78, 80, 82]);
    expect(label.performance.events.every(p => p.onset === null && p.notes.every(n => n.outcome === 'missing'))).toBe(true);
    expect(label.cursor.segments).toEqual([{ from: 0, uncertainty: 0, state: 'unsupported', truth: null, admissible: [], rule: [] }]);
    expect(() => controlLabel({ id: 's', performance: c.performance, score: { path: 'p', sha256: 'x' }, handedQuartersPerMinute: 90, duration: 2,
      audio: null, control: 'silence', extras: [{ onset: 0, end: 1, midi: 60 }], recipe: {}, note: 'test' })).toThrow(/Silence has no extras/);
  });
});
