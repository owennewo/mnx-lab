/** assessment-report@1 and assessment-evaluator@1 (contracts/event-instruments-1.md): the
 * end-of-piece assessment and how it is judged. The expected assessment comes from what
 * sounded and when, never from the cursor segments, sync anchors or a generator's recipe. */
import type { Decision, NoteStatement, ScorePosition } from '../../../listen/contract.ts';
import { samePosition } from '../../../listen/positions.ts';
import { validateRecord } from '../../../listen/validate.ts';
import { eventPositions, type Outcome, type PerformanceLabel, validateLabel } from './label.ts';

export const REPORT_FORMAT = 'assessment-report@1';
export const ASSESSMENT_EVALUATOR = 'assessment-evaluator@1';
/** How far from the player's own tempo a bar must be to expect a flag. Provisional. */
export const THETA = 0.10;

export type Direction = 'slow' | 'fast';
export interface AssessmentReport {
  format: typeof REPORT_FORMAT;
  tempo: {
    overall: number | null;
    intervals: { from: ScorePosition; to: ScorePosition; quartersPerMinute: number }[];
    flags: { ordinal: number; direction: Direction }[];
  };
  notes: Decision[];
}

export interface ExpectedAssessment {
  handed: number;
  overall: number | null;
  intervals: { from: number; to: number; quartersPerMinute: number }[];
  bars: { ordinal: number; quartersPerMinute: number | null; ratio: number | null; expected: Direction | 'none' | 'either' }[];
  notes: { event: number; noteKey: string; outcome: Outcome; heardMidi: number | null }[];
}

export function expectedAssessment(label: PerformanceLabel): ExpectedAssessment {
  validateLabel(label);
  const sounded = label.performance.events.filter(p => p.onset !== null);
  const quarter = (i: number) => label.events[i]!.quarter;
  const tempo = (quarters: number, seconds: number) => 60 * quarters / seconds;
  const pairs = sounded.slice(1).map((b, k) => ({ a: sounded[k]!, b }));
  const intervals = pairs.map(({ a, b }) => ({ from: a.index, to: b.index, quartersPerMinute: tempo(quarter(b.index) - quarter(a.index), b.onset! - a.onset!) }));
  const first = sounded[0], last = sounded.at(-1);
  const overall = sounded.length >= 2 ? tempo(quarter(last!.index) - quarter(first!.index), last!.onset! - first!.onset!) : null;
  const ordinals = [...new Set(label.events.map(e => e.at.ordinal))].sort((a, b) => a - b);
  const bars = ordinals.map((ordinal): ExpectedAssessment['bars'][number] => {
    const ending = pairs.filter(({ b }) => label.events[b.index]!.at.ordinal === ordinal);
    if (!ending.length || overall === null) return { ordinal, quartersPerMinute: null, ratio: null, expected: 'none' };
    const quartersPerMinute = tempo(ending.reduce((s, { a, b }) => s + quarter(b.index) - quarter(a.index), 0), ending.reduce((s, { a, b }) => s + b.onset! - a.onset!, 0));
    const ratio = quartersPerMinute / overall;
    const expected = ratio <= 1 - THETA ? 'slow' : ratio >= 1 + THETA ? 'fast' : Math.abs(ratio - 1) < THETA / 2 ? 'none' : 'either';
    return { ordinal, quartersPerMinute, ratio, expected };
  });
  const notes = label.performance.events.flatMap(p => p.notes.map(n => ({ event: p.index, noteKey: n.noteKey, outcome: n.outcome, heardMidi: n.heardMidi ?? null })));
  return { handed: label.handoff.quartersPerMinute, overall, intervals, bars, notes };
}

export interface KindCounts { positives: number; detected: number; negatives: number; falseAlarms: number }
export interface AssessmentEvaluation {
  evaluator: typeof ASSESSMENT_EVALUATOR;
  label: string;
  expected: ExpectedAssessment;
  overall: { expected: number | null; reported: number | null; handed: number; error: number | null };
  intervals: { expected: number; matched: number; unreported: number; unexpected: number; maxAbsError: number | null;
    errors: { from: number; to: number; expected: number; reported: number; error: number }[] };
  flags: Record<Direction, KindCounts> & { unplaced: number };
  notes: Record<'missing' | 'dead', KindCounts> & { wrong: KindCounts & { pitchCorrect: number } } & {
    matched: { positives: number; confirmed: number }; unassessed: number; unplaced: number; extraStatements: number;
  };
}

/** A note statement's verdict as a contract outcome; 'extra' is not assessed yet. */
export function outcomeOf(s: NoteStatement): { outcome: Outcome; heardMidi: number | null } | null {
  if (s.verdict === 'extra') return null;
  if (s.verdict === 'missing') return { outcome: 'missing', heardMidi: null };
  if (s.verdict === 'substitution') return s.observed?.midi != null ? { outcome: 'wrong', heardMidi: s.observed.midi } : { outcome: 'dead', heardMidi: null };
  return { outcome: 'matched', heardMidi: null };
}

export function evaluateAssessment(label: PerformanceLabel, report: AssessmentReport): AssessmentEvaluation {
  if (report.format !== REPORT_FORMAT) throw new Error('Unknown assessment report format');
  validateRecord(report.notes);
  const expected = expectedAssessment(label), positions = eventPositions(label);
  const eventAt = (p: ScorePosition) => positions.findIndex(q => samePosition(p, q));

  const relative = (reported: number, truth: number) => reported / truth - 1;
  const overall = { expected: expected.overall, reported: report.tempo.overall, handed: expected.handed,
    error: expected.overall !== null && report.tempo.overall !== null ? relative(report.tempo.overall, expected.overall) : null };

  const reported = new Map<string, number>();
  let unexpected = 0;
  for (const i of report.tempo.intervals) {
    const from = eventAt(i.from), to = eventAt(i.to), key = `${from}>${to}`;
    if (from < 0 || to < 0 || !expected.intervals.some(e => `${e.from}>${e.to}` === key)) unexpected++;
    else reported.set(key, i.quartersPerMinute);
  }
  const errors = expected.intervals.flatMap(e => {
    const r = reported.get(`${e.from}>${e.to}`);
    return r === undefined ? [] : [{ from: e.from, to: e.to, expected: e.quartersPerMinute, reported: r, error: relative(r, e.quartersPerMinute) }];
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
    return { truth: n, said: s ? outcomeOf(s) : null };
  });
  const noteCounts = (kind: Outcome): KindCounts => {
    const c = { positives: 0, detected: 0, negatives: 0, falseAlarms: 0 };
    for (const { truth, said } of judged) {
      const hit = said?.outcome === kind;
      if (truth.outcome === kind) { c.positives++; if (hit) c.detected++; } else { c.negatives++; if (hit) c.falseAlarms++; }
    }
    return c;
  };
  const wrong = { ...noteCounts('wrong'), pitchCorrect: judged.filter(j => j.truth.outcome === 'wrong' && j.said?.outcome === 'wrong' && j.said.heardMidi === j.truth.heardMidi).length };

  return {
    evaluator: ASSESSMENT_EVALUATOR, label: label.id, expected, overall,
    intervals: { expected: expected.intervals.length, matched: errors.length, unreported: expected.intervals.length - errors.length, unexpected,
      maxAbsError: errors.length ? Math.max(...errors.map(e => Math.abs(e.error))) : null, errors },
    flags: { slow: flagCounts('slow'), fast: flagCounts('fast'), unplaced: report.tempo.flags.filter(f => !expected.bars.some(b => b.ordinal === f.ordinal)).length },
    notes: { missing: noteCounts('missing'), wrong, dead: noteCounts('dead'),
      matched: { positives: judged.filter(j => j.truth.outcome === 'matched').length, confirmed: judged.filter(j => j.truth.outcome === 'matched' && j.said?.outcome === 'matched').length },
      unassessed: judged.filter(j => j.said === null).length, unplaced, extraStatements },
  };
}
