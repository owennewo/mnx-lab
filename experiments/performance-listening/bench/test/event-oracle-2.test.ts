import { describe, expect, it } from 'vitest';
import { evaluateAssessment2, expectedAssessment2 } from '../src/events/assessment2.ts';
import { evaluateFollowing, type ViewMeasures } from '../src/events/following.ts';
import { assessmentGates, cursorGates } from '../src/events/gates.ts';
import { validateLabel } from '../src/events/label.ts';
import { expandLabel2, expandRecord, expandReport2, type FollowingExpected2, readOracle2 } from '../src/events/oracle.ts';

const oracle = readOracle2();
const SECONDS = 1e-9, TEMPO = 1e-6;
const close = (actual: number | null, expected: number | null, tolerance: number, what: string) => {
  if (expected === null || actual === null) expect(actual, what).toBe(expected);
  else expect(Math.abs(actual - expected), `${what}: ${actual} against ${expected}`).toBeLessThanOrEqual(tolerance);
};
const TIMES = ['onEvent', 'ahead', 'behind', 'abstained', 'uncovered', 'falseFollowing', 'correctRejection', 'pending', 'indeterminate', 'answerable', 'supportedAnswerable'] as const;
const sameView = (view: ViewMeasures, expected: Partial<Record<typeof TIMES[number], number>>, what: string) => {
  for (const k of TIMES) close(view.seconds[k], expected[k] ?? 0, SECONDS, `${what} ${k}`);
};
const sorted = (gates: readonly string[]) => [...gates].sort();

describe('event-oracle@2', () => {
  it('is the frozen file, and every label in it is a valid performance-label@2', () => {
    for (const id of Object.keys(oracle.labels)) {
      const label = expandLabel2(oracle, id);
      expect(label.format, id).toBe('performance-label@2');
      expect(() => validateLabel(label), id).not.toThrow();
    }
  });

  for (const c of oracle.following) for (const [name, r] of Object.entries(c.records)) {
    it(`following-evaluator@2 and stage-gates@1 reproduce ${c.id}-${name}: ${c.title}`, () => {
      const label = expandLabel2(oracle, c.label ?? name), e = evaluateFollowing(label, expandRecord(label, r.decisions)), x: FollowingExpected2 = r.expected;
      sameView(e.asDecided, x, 'as decided');
      if (x.hindsight === 'same') sameView(e.hindsight, e.asDecided.seconds, 'hindsight');
      else sameView(e.hindsight, x.hindsight, 'hindsight');
      close(e.exposure.seconds, x.exposure ?? 0, SECONDS, 'exposure');
      close(e.exposure.longest, x.longest ?? 0, SECONDS, 'longest episode');
      expect([e.byEvent.reached, e.byEvent.of]).toEqual(x.byEvent);
      expect(e.byEvent.events.length).toBe(x.delays.length);
      e.byEvent.events.forEach((ev, i) => close(ev.delay, x.delays[i]!, SECONDS, `delay of event ${ev.index}`));
      expect([e.recovery.recovered, e.recovery.of, e.recovery.notAssessable]).toEqual(x.recovery ?? [0, 0, 0]);
      expect([e.extras.held, e.extras.moved, e.extras.notAssessable]).toEqual(x.extras ?? [0, 0, 0]);
      expect(sorted(cursorGates(label, e).failed)).toEqual(sorted(x.gates));
    });
  }

  for (const c of oracle.assessment) for (const id of c.labels) {
    it(`assessment-evaluator@2 derives ${c.id} from ${id}`, () => {
      const d = expectedAssessment2(expandLabel2(oracle, id));
      expect(d.handed).toBe(c.derived.handed);
      close(d.overall, c.derived.overall, TEMPO, 'overall');
      close(d.typical, c.derived.typical, TEMPO, 'typical');
      expect(d.intervals.map(i => [i.from, i.to])).toEqual(c.derived.intervals.map(([a, b]) => [a, b]));
      d.intervals.forEach((i, k) => {
        close(i.seconds, c.derived.intervals[k]![2], SECONDS, `interval ${i.from}→${i.to} seconds`);
        close(i.quartersPerMinute, c.derived.intervals[k]![3], TEMPO, `interval ${i.from}→${i.to} tempo`);
      });
      expect(d.bars.map(b => [b.ordinal, b.expected])).toEqual(c.derived.bars.map(([o, , , x]) => [o, x]));
      d.bars.forEach((b, k) => { close(b.quartersPerMinute, c.derived.bars[k]![1], TEMPO, `bar ${b.ordinal}`); close(b.ratio, c.derived.bars[k]![2], TEMPO, `bar ${b.ordinal} ratio`); });
      expect(d.clean).toBe(c.derived.clean);
    });
    for (const [name, r] of Object.entries(c.reports)) it(`assessment-evaluator@2 and stage-gates@1 reproduce ${c.id}-${name} on ${id}: ${c.title}`, () => {
      const label = expandLabel2(oracle, id), e = evaluateAssessment2(label, expandReport2(label, r.report)), x = r.expected;
      close(e.overall.error, x.overallError, TEMPO, 'overall error');
      expect([e.intervals.expected, e.intervals.matched, e.intervals.unreported, e.intervals.unexpected, e.intervals.within]).toEqual(x.intervals);
      close(e.intervals.maxAbsSeconds, x.worst[0], SECONDS, 'largest seconds error');
      close(e.intervals.maxAbsRelative, x.worst[1], TEMPO, 'largest relative error');
      const counts = (k: { positives: number; detected: number; negatives: number; falseAlarms: number }) => [k.positives, k.detected, k.negatives, k.falseAlarms];
      expect(counts(e.flags.slow)).toEqual(x.slow);
      expect(counts(e.flags.fast)).toEqual(x.fast);
      expect(counts(e.notes.missing)).toEqual(x.missing);
      expect([...counts(e.notes.wrong), e.notes.wrong.pitchCorrect]).toEqual(x.wrong);
      expect(counts(e.notes.dead)).toEqual(x.dead);
      expect([e.notes.matched.positives, e.notes.matched.confirmed]).toEqual(x.matched);
      expect([e.notes.unassessed, e.notes.unplaced]).toEqual([x.unassessed, x.unplaced]);
      expect([e.falseFindings, e.claimedPlayed, e.tempoClaims, e.clean]).toEqual([x.falseFindings, x.claimedPlayed, x.tempoClaims, x.clean]);
      expect(sorted(assessmentGates(label, e).failed)).toEqual(sorted(x.gates));
    });
  }
});
