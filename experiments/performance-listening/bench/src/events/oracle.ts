/** Reads event-oracle@1 and expands its shorthand into labels, version-2 records and
 * assessment reports. It computes nothing the oracle is meant to check. */
import { readFileSync } from 'node:fs';
import { rational, toRationalJSON } from '../../../../../src/audio/time.ts';
import type { Decision } from '../../../listen/contract.ts';
import { positionFromJSON, type ScorePositionJSON } from '../../../listen/json.ts';
import { sha } from '../ladder/privateSets.ts';
import { type AssessmentReport, REPORT_FORMAT } from './assessment.ts';
import { LABEL_FORMAT, type PerformanceLabel, type PlayedNote } from './label.ts';

export const ORACLE_DIR = new URL('../../oracle-events/', import.meta.url);

type ScoreShorthand = { at: string; quarter: number; notes: [string, number][] }[];
type NoteOverride = 'missing' | { wrong: number } | { dead: number };
interface LabelShorthand {
  score: string; handed: number; duration: number; resolution: 'event' | 'bar'; note: string;
  played: { e: number; onset?: number; end?: number; missing?: true; notes?: Record<string, NoteOverride> }[];
  distinguishable: (number | null)[];
  extras: [number, number, number | null][];
  segments: { from: number; uncertainty?: number; state?: 'supported' | 'unsupported'; truth: number | null; admissible: number[]; rule: string[] }[];
}
export type RecordShorthand = ([number, number | 'u'] | [number, number, number])[];
export interface ReportShorthand {
  overall: number | null; intervals: [number, number, number][]; flags: [number, 'slow' | 'fast'][];
  notes: { default: 'match' | 'missing'; omit?: string[]; misplace?: Record<string, number> } & Record<string, unknown>;
}
export interface FollowingExpected {
  onEvent?: number; ahead?: number; behind?: number; abstained?: number; uncovered?: number; falseFollowing?: number; correctRejection?: number;
  pending?: number; indeterminate?: number; answerable: number; supportedAnswerable: number;
  exposure?: number; longest?: number; byEvent: [number, number]; delays: (number | null)[];
  recovery?: [number, number, number]; extras?: [number, number, number];
  hindsight: 'same' | Omit<FollowingExpected, 'byEvent' | 'delays' | 'hindsight' | 'exposure' | 'longest' | 'recovery' | 'extras'>;
}
export interface AssessmentExpected {
  overallError: number; intervals: [number, number, number, number, number];
  slow: [number, number, number, number]; fast: [number, number, number, number];
  missing: [number, number, number, number]; wrong: [number, number, number, number, number]; dead: [number, number, number, number];
  matched: [number, number]; unassessed: number; unplaced: number;
}
export interface Oracle {
  format: 'event-oracle@1';
  scores: Record<string, ScoreShorthand>;
  labels: Record<string, LabelShorthand>;
  following: { id: string; title: string; label?: string; labels?: string[]; records: Record<string, { note: string; decisions: RecordShorthand; expected: FollowingExpected }> }[];
  assessment: { id: string; title: string; labels: string[];
    derived: { handed: number; overall: number | null; intervals: [number, number, number][]; bars: [number, number | null, number | null, string][] };
    reports: Record<string, { note: string; report: ReportShorthand; expected: AssessmentExpected }> }[];
}

/** The oracle, refused unless its bytes are the frozen ones. */
export function readOracle(): Oracle {
  const bytes = readFileSync(new URL('oracle.json', ORACLE_DIR));
  const frozen = JSON.parse(readFileSync(new URL('freeze.json', ORACLE_DIR), 'utf8')) as { sha256: string };
  if (sha(bytes) !== frozen.sha256) throw new Error('event-oracle@1 changed since it was frozen');
  return JSON.parse(bytes.toString('utf8')) as Oracle;
}

/** "ordinal:num/den", reduced to Studio's canonical JSON. */
const position = (at: string): ScorePositionJSON => {
  const [ordinal, offset] = at.split(':'), [num, den] = offset!.split('/');
  return { ordinal: Number(ordinal), metricOffset: toRationalJSON(rational(BigInt(num!), BigInt(den!))) };
};

export function expandLabel(oracle: Oracle, id: string): PerformanceLabel {
  const s = oracle.labels[id];
  if (!s) throw new Error(`No oracle label ${id}`);
  const score = oracle.scores[s.score]!;
  const events = score.map((e, index) => ({ index, at: position(e.at), quarter: e.quarter, notes: e.notes.map(([noteKey, midi]) => ({ noteKey, midi })) }));
  const played = s.played.map((p, index) => {
    if (p.e !== index) throw new Error(`Oracle label ${id} lists events out of order`);
    const notes: PlayedNote[] = events[index]!.notes.map(({ noteKey }) => {
      if (p.missing) return { noteKey, outcome: 'missing' };
      const o = p.notes?.[noteKey];
      if (o === undefined) return { noteKey, outcome: 'matched', onset: p.onset!, end: p.end! };
      if (o === 'missing') return { noteKey, outcome: 'missing' };
      if ('wrong' in o) return { noteKey, outcome: 'wrong', onset: p.onset!, end: p.end!, heardMidi: o.wrong };
      return { noteKey, outcome: 'dead', onset: p.onset!, end: o.dead };
    });
    return { index, onset: p.missing ? null : p.onset!, distinguishableAt: s.distinguishable[index]!, notes };
  });
  return {
    format: LABEL_FORMAT, id, score: { path: `oracle:${s.score}`, sha256: null },
    handoff: { from: events[0]!.at, quartersPerMinute: s.handed }, duration: s.duration, audio: null, events,
    performance: { events: played, extras: s.extras.map(([onset, end, midi]) => ({ onset, end, midi })) },
    cursor: { resolution: s.resolution, segments: s.segments.map(g => ({ from: g.from, uncertainty: g.uncertainty ?? 0, state: g.state ?? 'supported', truth: g.truth, admissible: g.admissible, rule: g.rule })) },
    provenance: { kind: 'hand-worked', note: s.note },
  };
}

export function expandRecord(label: PerformanceLabel, decisions: RecordShorthand): Decision[] {
  return decisions.map((d, k) => {
    const [madeAt, what, refersTo = madeAt] = d as [number, number | 'u', number?];
    const common = { id: `oracle-${k}`, refersTo, madeAt };
    return what === 'u' ? { ...common, kind: 'unsupported' as const }
      : { ...common, kind: 'position' as const, confidence: 1, candidates: [{ at: positionFromJSON(label.events[what]!.at), weight: 1 }] };
  });
}

export function expandReport(label: PerformanceLabel, r: ReportShorthand): AssessmentReport {
  const at = (index: number) => positionFromJSON(label.events[index]!.at);
  const notes: Decision[] = [];
  for (const e of label.events) for (const { noteKey } of e.notes) {
    if (r.notes.omit?.includes(noteKey)) continue;
    const o = (r.notes[noteKey] ?? r.notes.default) as 'match' | 'missing' | ['substitution', number | null];
    const verdict = Array.isArray(o) ? 'substitution' as const : o;
    notes.push({ id: `note-${noteKey}`, kind: 'note', refersTo: label.duration, madeAt: label.duration, verdict,
      at: at(r.notes.misplace?.[noteKey] ?? e.index), noteKey,
      observed: Array.isArray(o) ? { onset: null, end: null, midi: o[1], string: null } : null,
      timingErrorSeconds: null, durationErrorSeconds: null, confidence: 1 });
  }
  return { format: REPORT_FORMAT, notes, tempo: { overall: r.overall,
    intervals: r.intervals.map(([from, to, quartersPerMinute]) => ({ from: at(from), to: at(to), quartersPerMinute })),
    flags: r.flags.map(([ordinal, direction]) => ({ ordinal, direction })) } };
}
