import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { compilePerformance } from '../../src/audio/performance.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { segmentsFromBarStarts, staleSegmentBars } from '../../src/model/syncSegments.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { verifySync } from '../../tools/recording-align/verifySync.ts';

// A sync judged as the player would play it, on a synthetic performance of a real scenario: every
// written note heard at the recording's time, one bar every two seconds. The failures are run 9's.
const scenario = (): MnxStructure => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../scenarios/lab/00-document/04-twelve-bar-blues/document.mnx.json'), 'utf8'));
const number = (r: { num: bigint; den: bigint }) => Number(r.num) / Number(r.den);
const BAR = 2, START = 1;
function performed(doc: MnxStructure) {
  const compiled = compilePerformance(doc, linearizePasses(doc));
  if (!compiled.ok) throw new Error('does not compile');
  const { performance } = compiled;
  const wholes = performance.measures.map(m => number(m.metricDuration));
  const cuts = [...wholes.keys(), wholes.length].map(i => START + i * BAR);
  const heard = performance.measures.flatMap((m, i) => performance.sounding
    .filter(s => number(s.position) >= number(m.position) && number(s.position) < number(m.position) + number(m.duration))
    .map(s => ({ start: cuts[i]! + (number(s.position) - number(m.position)) / wholes[i]! * BAR, pitch: s.midi })));
  return { wholes, cuts, heard };
}
const perBar = (wholes: number[], cuts: number[]) => segmentsFromBarStarts(cuts, wholes, wholes.map((_, i) => `Bar ${i + 1}`))!;

it('passes a sync the player plays with the recording', () => {
  const doc = scenario(), { wholes, cuts, heard } = performed(doc);
  const v = verifySync({ document: doc, sync: { syncpoints: null, syncSegments: perBar(wholes, cuts) }, heard });
  expect(v.problems).toEqual([]);
  expect(v.ok).toBe(true);
  expect(v.foundFraction).toBeGreaterThan(0.95);
  expect(v.bars.every(b => b.seconds !== null)).toBe(true);
});

it("fails a sync whose bars changed length under it: named stale, and the bar lines the player would miss", () => {
  // The sync was written while bar 5 held half its length (a placeholder); the bar is now full, as in run 9.
  const doc = scenario(), { wholes, cuts, heard } = performed(doc);
  const shortened = [...wholes]; shortened[4] = shortened[4]! / 2;
  const v = verifySync({ document: doc, sync: { syncpoints: null, syncSegments: perBar(shortened, cuts) }, heard });
  expect(v.ok).toBe(false);
  expect(v.problems.map(p => p.code)).toContain('stale-segments');
  expect(v.problems.find(p => p.code === 'stale-segments')!.bars).toEqual([5]);
  expect(v.problems.find(p => p.code === 'bar-lines')!.bars[0]).toBe(6);
});

it('fails a sync that leaves the recording, with no help from its segments', () => {
  // Plain tuples, every bar line a beat out: nothing says stale, but the notes are not there.
  const doc = scenario(), { wholes, cuts, heard } = performed(doc);
  const syncpoints = wholes.map((_, i) => [i, cuts[i]! + 0.25]).concat([[wholes.length, cuts.at(-1)! + 0.25]]);
  const v = verifySync({ document: doc, sync: { syncpoints }, heard });
  expect(v.ok).toBe(false);
  expect(v.problems.map(p => p.code)).toEqual(['weak-run']);
});

it('does not fail what is legitimate: a recording that stops early, or bars not yet written', () => {
  const doc = scenario(), { wholes, cuts, heard } = performed(doc);
  const early = perBar(wholes.slice(0, 6), cuts.slice(0, 7));
  const stopped = verifySync({ document: doc, sync: { syncpoints: null, syncSegments: early }, heard: heard.filter(h => h.start < cuts[6]!) });
  expect(stopped.problems).toEqual([]);
  expect(stopped.bars.filter(b => b.seconds !== null).length).toBeLessThan(wholes.length + 1);

  // Unwritten bars (rests, in a score half done) have no notes to find: they cannot fail, nor break a run.
  const unwritten = scenario();
  for (const i of [3, 4, 5, 6]) unwritten.parts[0]!.measures![i]!.sequences = [{ voice: 'v1', content: [{ duration: { base: 'whole' }, rest: {} }] }] as never;
  const half = verifySync({ document: unwritten, sync: { syncpoints: null, syncSegments: perBar(wholes, cuts) }, heard });
  expect(half.problems).toEqual([]);

  // The same bars written, and not heard: that is the check's job.
  const missing = verifySync({ document: doc, sync: { syncpoints: null, syncSegments: perBar(wholes, cuts) }, heard: heard.filter(h => h.start < cuts[3]! || h.start >= cuts[7]!) });
  expect(missing.problems.map(p => p.code)).toEqual(['weak-run']);
  expect(missing.problems[0]!.bars).toEqual([4, 5, 6, 7]);
});

it('marks a one-segment-a-bar sync only, and only where a bar no longer matches', () => {
  const made = segmentsFromBarStarts([0, 2, 4, 6], [1, 1, 1], ['Bar 1', 'Bar 2', 'Bar 3'])!;
  const beats = made.segments.map(s => s.beats!);
  expect(staleSegmentBars(made, beats)).toEqual([]);
  expect(staleSegmentBars(made, [beats[0]!, beats[1]! * 1.5, beats[2]!])).toEqual([1]);
  // Fewer bars than the sync has segments: the sync's last bars are gone.
  expect(staleSegmentBars(made, beats.slice(0, 2))).toEqual([2]);
  // A recording that stops early: the score has more bars than the sync, and that is fine.
  expect(staleSegmentBars(made, [...beats, 4])).toEqual([]);
  // Hand-cut segments span bars by design: a beat count is not a bar length.
  const hand = { ...made, segments: made.segments.map((s, i) => ({ ...s, name: `Segment ${i + 1}` })) };
  expect(staleSegmentBars(hand, [beats[0]! * 2, beats[1]!, beats[2]!])).toEqual([]);
});
