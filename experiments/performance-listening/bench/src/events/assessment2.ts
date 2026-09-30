/** assessment-report@2 and assessment-evaluator@2 (contracts/event-instruments-2.md): the
 * end-of-piece assessment and how it is judged. Version 2 judges bar flags against the
 * player's typical tempo, reports intervals as durations with the approved tolerance,
 * adds the dead verdict, clean examples and what a control's assessment claims. The
 * expected assessment comes from what sounded and when, never from the cursor segments,
 * sync anchors or a generator's recipe. */
import type { Decision, NoteStatement, ScorePosition } from '../../../listen/contract.ts';
import { samePosition } from '../../../listen/positions.ts';
import { validateRecord } from '../../../listen/validate.ts';
import { eventPositions, type Outcome, type PerformanceLabel, validateLabel } from './label.ts';

export const REPORT_FORMAT_2 = 'assessment-report@2';
export const ASSESSMENT_EVALUATOR_2 = 'assessment-evaluator@2';
/** How far from the player's typical tempo a bar must be to expect a flag. */
export const THETA = 0.10;
/** The approved interval tolerance: 10% of the expected duration or 30 ms, whichever is larger. */
export const INTERVAL_RELATIVE = 0.10, INTERVAL_FLOOR_SECONDS = 0.030;
/** Half a weight within this many quarters counts as exactly half. */
const HALF_EPSILON = 1e-9;
/** Float slack on the tolerance comparison only; the oracle keeps clear of the bound. */
const TOLERANCE_SLACK = 1e-12;

export type Direction = 'slow' | 'fast';
export interface AssessmentReport2 {
  format: typeof REPORT_FORMAT_2;
  tempo: {
    overall: number | null;
    intervals: { from: ScorePosition; to: ScorePosition; seconds: number }[];
    flags: { ordinal: number; direction: Direction }[];
  };
  notes: Decision[];
}

export interface ExpectedAssessment2 {
  handed: number;
  overall: number | null;
  typical: number | null;
  intervals: { from: number; to: number; seconds: number; quarters: number; quartersPerMinute: number }[];
  bars: { ordinal: number; quartersPerMinute: number | null; ratio: number | null; expected: Direction | 'none' | 'either' }[];
  notes: { event: number; noteKey: string; outcome: Outcome; heardMidi: number | null }[];
  clean: boolean;
}

/** The median of local tempi weighted by score distance; at an exact half, the mean of the
 * two middle tempi. */
export function typicalTempo(intervals: readonly { quarters: number; quartersPerMinute: number }[]): number | null {
  if (!intervals.length) return null;
  const sorted = [...intervals].sort((a, b) => a.quartersPerMinute - b.quartersPerMinute);
  const half = sorted.reduce((s, i) => s + i.quarters, 0) / 2;
  let accumulated = 0;
  for (let k = 0; k < sorted.length; k++) {
    accumulated += sorted[k]!.quarters;
    if (Math.abs(accumulated - half) <= HALF_EPSILON) return (sorted[k]!.quartersPerMinute + sorted[k + 1]!.quartersPerMinute) / 2;
    if (accumulated > half) return sorted[k]!.quartersPerMinute;
  }
  throw new Error('unreachable: the accumulated weight reaches the whole');
}

export function expectedAssessment2(label: PerformanceLabel): ExpectedAssessment2 {
  validateLabel(label);
  const sounded = label.performance.events.filter(p => p.onset !== null);
  const quarter = (i: number) => label.events[i]!.quarter;
  const tempo = (quarters: number, seconds: number) => 60 * quarters / seconds;
  const pairs = sounded.slice(1).map((b, k) => ({ a: sounded[k]!, b }));
  const intervals = pairs.map(({ a, b }) => {
    const seconds = b.onset! - a.onset!, quarters = quarter(b.index) - quarter(a.index);
    return { from: a.index, to: b.index, seconds, quarters, quartersPerMinute: tempo(quarters, seconds) };
  });
  const first = sounded[0], last = sounded.at(-1);
  const overall = sounded.length >= 2 ? tempo(quarter(last!.index) - quarter(first!.index), last!.onset! - first!.onset!) : null;
  const typical = typicalTempo(intervals);
  const ordinals = [...new Set(label.events.map(e => e.at.ordinal))].sort((a, b) => a - b);
  const bars = ordinals.map((ordinal): ExpectedAssessment2['bars'][number] => {
    const ending = intervals.filter(i => label.events[i.to]!.at.ordinal === ordinal);
    if (!ending.length || typical === null) return { ordinal, quartersPerMinute: null, ratio: null, expected: 'none' };
    const quartersPerMinute = tempo(ending.reduce((s, i) => s + i.quarters, 0), ending.reduce((s, i) => s + i.seconds, 0));
    const ratio = quartersPerMinute / typical;
    const expected = ratio <= 1 - THETA ? 'slow' : ratio >= 1 + THETA ? 'fast' : Math.abs(ratio - 1) < THETA / 2 ? 'none' : 'either';
    return { ordinal, quartersPerMinute, ratio, expected };
  });
  const notes = label.performance.events.flatMap(p => p.notes.map(n => ({ event: p.index, noteKey: n.noteKey, outcome: n.outcome, heardMidi: n.heardMidi ?? null })));
  const clean = notes.every(n => n.outcome === 'matched') && label.performance.extras.length === 0 && bars.every(b => b.expected === 'none');
  return { handed: label.handoff.quartersPerMinute, overall, typical, intervals, bars, notes, clean };
}

export interface KindCounts { positives: number; detected: number; negatives: number; falseAlarms: number }
export interface AssessmentEvaluation2 {
  evaluator: typeof ASSESSMENT_EVALUATOR_2;
  label: string;
  expected: ExpectedAssessment2;
  overall: { expected: number | null; reported: number | null; handed: number; error: number | null };
  intervals: {
    expected: number; matched: number; unreported: number; unexpected: number; within: number;
    maxAbsSeconds: number | null; maxAbsRelative: number | null;
    errors: { from: number; to: number; expected: number; reported: number; seconds: number; relative: number; within: boolean }[];
  };
  flags: Record<Direction, KindCounts> & { unplaced: number };
  notes: Record<'missing' | 'dead', KindCounts> & { wrong: KindCounts & { pitchCorrect: number } } & {
    matched: { positives: number; confirmed: number }; unassessed: number; unplaced: number; extraStatements: number;
  };
  falseFindings: number;
  claimedPlayed: number;
  tempoClaims: number;
  clean: boolean;
}

/** A note statement's verdict as a contract outcome; 'extra' is not assessed yet. A
 * substitution with no pitch is a wrong note whose pitch was not identified. */
export function outcomeOf2(s: NoteStatement): { outcome: Outcome; heardMidi: number | null } | null {
  switch (s.verdict) {
    case 'extra': return null;
    case 'missing': return { outcome: 'missing', heardMidi: null };
    case 'dead': return { outcome: 'dead', heardMidi: null };
    case 'substitution': return { outcome: 'wrong', heardMidi: s.observed?.midi ?? null };
    default: return { outcome: 'matched', heardMidi: null };
  }
}

export const withinTolerance = (expected: number, error: number) =>
  Math.abs(error) <= Math.max(INTERVAL_RELATIVE * expected, INTERVAL_FLOOR_SECONDS) + TOLERANCE_SLACK;

export function evaluateAssessment2(label: PerformanceLabel, report: AssessmentReport2): AssessmentEvaluation2 {
  if (report.format !== REPORT_FORMAT_2) throw new Error('Unknown assessment report format');
  validateRecord(report.notes);
  if (!report.tempo.intervals.every(i => Number.isFinite(i.seconds) && i.seconds > 0)) throw new Error('An interval reports a positive, finite duration');
  const expected = expectedAssessment2(label), positions = eventPositions(label);
  const eventAt = (p: ScorePosition) => positions.findIndex(q => samePosition(p, q));

  const overall = { expected: expected.overall, reported: report.tempo.overall, handed: expected.handed,
    error: expected.overall !== null && report.tempo.overall !== null ? report.tempo.overall / expected.overall - 1 : null };

  const reported = new Map<string, number>();
  let unexpected = 0;
  for (const i of report.tempo.intervals) {
    const from = eventAt(i.from), to = eventAt(i.to), key = `${from}>${to}`;
    if (from < 0 || to < 0 || !expected.intervals.some(e => `${e.from}>${e.to}` === key)) unexpected++;
    else reported.set(key, i.seconds);
  }
  const errors = expected.intervals.flatMap(e => {
    const r = reported.get(`${e.from}>${e.to}`);
    if (r === undefined) return [];
    const seconds = r - e.seconds;
    return [{ from: e.from, to: e.to, expected: e.seconds, reported: r, seconds, relative: r / e.seconds - 1, within: withinTolerance(e.seconds, seconds) }];
  });

  const flagged = new Set(report.tempo.flags.map(f => `${f.ordinal}:${f.direction}`));
  const flagCounts = (direction: Direction): KindCounts => {
    const c = { positives: 0, detected: 0, negatives: 0, falseAlarms: 0 };
    for (const bar of expected.bars) {
      const hit = flagged.has(`${bar.ordinal}:${direction}`);
      if (bar.expected === direction) { c.positives++; if (hit) c.detected++; }
      else if (bar.expected !== 'either') { c.negatives++; if (hit) c.falseAlarms++; }
    }
    return c;
  };

  const placed = new Map<string, NoteStatement>();
  let unplaced = 0, extraStatements = 0;
  for (const d of report.notes) {
    if (d.kind !== 'note') continue;
    if (d.verdict === 'extra') { extraStatements++; continue; }
    const event = eventAt(d.at);
    if (event < 0 || !label.events[event]!.notes.some(n => n.noteKey === d.noteKey)) { unplaced++; continue; }
    placed.set(`${event}:${d.noteKey}`, d);
  }
  const judged = expected.notes.map(n => {
    const s = placed.get(`${n.event}:${n.noteKey}`);
    return { truth: n, said: s ? outcomeOf2(s) : null };
  });
  const noteCounts = (kind: Outcome): KindCounts => {
    const c = { positives: 0, detected: 0, negatives: 0, falseAlarms: 0 };
    for (const { truth, said } of judged) {
      const hit = said?.outcome === kind;
      if (truth.outcome === kind) { c.positives++; if (hit) c.detected++; } else { c.negatives++; if (hit) c.falseAlarms++; }
    }
    return c;
  };
  const wrong = { ...noteCounts('wrong'), pitchCorrect: judged.filter(j => j.truth.outcome === 'wrong' && j.said?.outcome === 'wrong' && j.said.heardMidi !== null && j.said.heardMidi === j.truth.heardMidi).length };
  const slow = flagCounts('slow'), fast = flagCounts('fast'), missing = noteCounts('missing'), dead = noteCounts('dead');

  return {
    evaluator: ASSESSMENT_EVALUATOR_2, label: label.id, expected, overall,
    intervals: {
      expected: expected.intervals.length, matched: errors.length, unreported: expected.intervals.length - errors.length, unexpected,
      within: errors.filter(e => e.within).length,
      maxAbsSeconds: errors.length ? Math.max(...errors.map(e => Math.abs(e.seconds))) : null,
      maxAbsRelative: errors.length ? Math.max(...errors.map(e => Math.abs(e.relative))) : null,
      errors,
    },
    flags: { slow, fast, unplaced: report.tempo.flags.filter(f => !expected.bars.some(b => b.ordinal === f.ordinal)).length },
    notes: { missing, wrong, dead,
      matched: { positives: judged.filter(j => j.truth.outcome === 'matched').length, confirmed: judged.filter(j => j.truth.outcome === 'matched' && j.said?.outcome === 'matched').length },
      unassessed: judged.filter(j => j.said === null).length, unplaced, extraStatements },
    falseFindings: slow.falseAlarms + fast.falseAlarms + missing.falseAlarms + wrong.falseAlarms + dead.falseAlarms,
    claimedPlayed: judged.filter(j => j.said !== null && j.said.outcome !== 'missing').length,
    tempoClaims: (report.tempo.overall !== null ? 1 : 0) + report.tempo.intervals.length + report.tempo.flags.length,
    clean: expected.clean,
  };
}
