/** performance-label@1 (contracts/event-instruments-1.md) and performance-label@2
 * (contracts/event-instruments-2.md): what a performance was, with exact truth. Version 2
 * adds written dead notes and negative controls. The evaluators read labels; they never
 * infer an admissible set. */
import type { Performance } from '../../../../../src/audio/performanceTypes.ts';
import { scorePositionAt } from '../../../../../src/audio/scorePosition.ts';
import { compare } from '../../../../../src/audio/time.ts';
import type { ScorePosition } from '../../../listen/contract.ts';
import { positionFromJSON, positionToJSON, type ScorePositionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';

export const LABEL_FORMAT = 'performance-label@1';
export const LABEL_FORMAT_2 = 'performance-label@2';
export type LabelFormat = typeof LABEL_FORMAT | typeof LABEL_FORMAT_2;
/** The decision deadline, as contract 1 set it and contract 2 keeps it. */
export const DEADLINE = 0.2;

export type Outcome = 'matched' | 'missing' | 'wrong' | 'dead';
/** `dead` (version 2 only): the score writes the note as a dead note; `midi` is its written pitch. */
export interface LabelEvent { index: number; at: ScorePositionJSON; quarter: number; notes: { noteKey: string; midi: number; dead?: true }[] }
export interface PlayedNote { noteKey: string; outcome: Outcome; onset?: number; end?: number; heardMidi?: number }
export interface PlayedEvent { index: number; onset: number | null; distinguishableAt: number | null; notes: PlayedNote[] }
export interface Extra { onset: number; end: number; midi: number | null }
export interface Segment {
  from: number; uncertainty: number; state: 'supported' | 'unsupported';
  truth: number | null; admissible: number[]; rule: string[];
}
export interface PerformanceLabel {
  format: LabelFormat;
  id: string;
  score: { path: string; sha256: string | null };
  handoff: { from: ScorePositionJSON; quartersPerMinute: number };
  duration: number;
  audio: { path: string; sampleRate: number; samples: number; sha256: string } | null;
  events: LabelEvent[];
  performance: { events: PlayedEvent[]; extras: Extra[] };
  cursor: { resolution: 'event' | 'bar'; segments: Segment[] };
  provenance: { kind: 'generated' | 'hand-worked'; recipe?: unknown; note: string };
}

export const comparePositions = (a: ScorePosition, b: ScorePosition): number =>
  a.ordinal !== b.ordinal ? Math.sign(a.ordinal - b.ordinal) : compare(a.metricOffset, b.metricOffset);
export const eventPositions = (label: PerformanceLabel): ScorePosition[] => label.events.map(e => positionFromJSON(e.at));
/** Version 2: a label with no supported segment is a negative control. */
export const isControl = (label: PerformanceLabel): boolean => label.cursor.segments.every(s => s.state === 'unsupported');

const requireThat = (ok: boolean, message: string) => { if (!ok) throw new Error(`${message}`); };
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function validateLabel(label: PerformanceLabel): void {
  const at = (m: string) => `Label ${label.id}: ${m}`;
  requireThat(label.format === LABEL_FORMAT || label.format === LABEL_FORMAT_2, at('unknown format'));
  const version2 = label.format === LABEL_FORMAT_2;
  requireThat(finite(label.duration) && label.duration > 0, at('invalid duration'));
  requireThat(finite(label.handoff.quartersPerMinute) && label.handoff.quartersPerMinute > 0, at('invalid handed tempo'));
  const positions = eventPositions(label);
  label.events.forEach((e, i) => {
    requireThat(e.index === i && e.notes.length > 0 && finite(e.quarter), at(`event ${i} is malformed`));
    requireThat(e.notes.every(n => n.dead === undefined || (version2 && n.dead === true)), at(`event ${i}: only a version-2 label writes dead notes`));
    if (i) requireThat(comparePositions(positions[i - 1]!, positions[i]!) < 0 && label.events[i - 1]!.quarter < e.quarter, at(`event ${i} is out of order`));
  });
  requireThat(label.performance.events.length === label.events.length, at('one played entry per event'));
  let lastOnset = -Infinity;
  label.performance.events.forEach((p, i) => {
    const score = label.events[i]!;
    const keys = (notes: readonly { noteKey: string }[]) => notes.map(n => n.noteKey).sort().join('\n');
    requireThat(p.index === i && p.notes.length === score.notes.length && keys(p.notes) === keys(score.notes), at(`event ${i}'s notes do not match the score`));
    const onsets: number[] = [];
    for (const n of p.notes) {
      const written = score.notes.find(s => s.noteKey === n.noteKey)!;
      if (n.outcome === 'missing') { requireThat(n.onset === undefined && n.end === undefined && n.heardMidi === undefined, at(`${n.noteKey}: a missing note has no timing`)); continue; }
      requireThat(['matched', 'wrong', 'dead'].includes(n.outcome), at(`${n.noteKey}: unknown outcome`));
      requireThat(finite(n.onset) && finite(n.end) && n.onset >= 0 && n.onset < n.end, at(`${n.noteKey}: a sounded note needs onset < end`));
      requireThat(!(written.dead && n.outcome === 'dead'), at(`${n.noteKey}: a dead note the score writes, played dead, is matched`));
      requireThat(n.outcome === 'wrong' ? finite(n.heardMidi) && (written.dead === true || n.heardMidi !== written.midi) : n.heardMidi === undefined, at(`${n.noteKey}: only a wrong note names the pitch heard`));
      onsets.push(n.onset!);
    }
    const onset = onsets.length ? Math.min(...onsets) : null;
    requireThat(p.onset === onset, at(`event ${i}'s onset must be its earliest sounded note`));
    if (onset !== null) { requireThat(onset > lastOnset, at(`event ${i} sounds out of order`)); lastOnset = onset; }
  });
  for (const x of label.performance.extras) requireThat(finite(x.onset) && finite(x.end) && x.onset < x.end && (x.midi === null || finite(x.midi)), at('malformed extra note'));
  const segments = label.cursor.segments;
  requireThat(segments.length > 0 && segments[0]!.from === 0, at('the first segment starts at 0'));
  segments.forEach((s, i) => {
    if (i) requireThat(s.from > segments[i - 1]!.from, at('segments must start in order'));
    requireThat(s.from < label.duration && finite(s.uncertainty) && s.uncertainty >= 0, at(`segment ${i} is malformed`));
    requireThat(s.admissible.every(k => Number.isInteger(k) && k >= 0 && k < label.events.length), at(`segment ${i} admits an unknown event`));
    if (s.state === 'unsupported') requireThat(s.truth === null && s.admissible.length === 0, at(`unsupported segment ${i} has a truth`));
    else requireThat(s.state === 'supported' && (s.truth === null || s.admissible.includes(s.truth)), at(`segment ${i}'s admissible set omits its truth`));
  });
  const sounded = label.performance.events.filter(p => p.onset !== null);
  if (version2 && isControl(label)) requireThat(sounded.length === 0, at('a control plays no note of the handed score'));
  if (label.cursor.resolution === 'event') {
    const supported = segments.filter(s => s.state === 'supported');
    if (supported.length) {
      const starts = sounded.map(p => ({ from: p.onset!, truth: p.index }));
      const expected = sounded.length && sounded[0]!.onset! > 0 ? [{ from: 0, truth: null as number | null }, ...starts] : starts;
      requireThat(segments.length === expected.length && expected.every((e, i) => segments[i]!.from === e.from && segments[i]!.truth === e.truth),
        at('event-resolution segments must start at exactly the sounded onsets, with that event as truth'));
      if (expected[0]?.truth === null) requireThat(segments[0]!.admissible.length === 0, at('nothing is admissible before the first onset'));
    }
  } else requireThat(label.cursor.resolution === 'bar' && segments.every(s => s.truth === null), at('a bar-resolution label has no event truth'));
  label.performance.events.forEach((p, i) => {
    const starting = label.cursor.resolution === 'event' ? segments.find(s => s.state === 'supported' && s.truth === i) : undefined;
    const expected = starting && same(starting.admissible, [i]) ? starting.from : null;
    requireThat(p.distinguishableAt === expected, at(`event ${i}'s distinguishableAt disagrees with the segments`));
  });
}

/** A score's events from Studio's compiled performance: its notes grouped by onset. */
export function scoreEvents(performance: Performance): LabelEvent[] {
  const quartersOf = (r: { num: bigint; den: bigint }) => 4 * Number(r.num) / Number(r.den);
  const byPosition = new Map<number, { position: Performance['sounding'][number]['position']; notes: { noteKey: string; midi: number }[] }>();
  for (const n of performance.sounding) {
    const written = performance.written.find(w => n.writtenIds.includes(w.id));
    if (!written) throw new Error('A sounding note has no written note');
    const q = quartersOf(n.position), group = byPosition.get(q) ?? { position: n.position, notes: [] };
    group.notes.push({ noteKey: written.noteKey, midi: n.midi });
    byPosition.set(q, group);
  }
  const groups = [...byPosition.entries()].sort((a, b) => a[0] - b[0]);
  return groups.map(([quarter, g], index) => {
    const at = scorePositionAt(performance, g.position);
    if (!at.ok) throw new Error(at.diagnostic.message);
    return { index, at: positionToJSON(at.value), quarter, notes: g.notes.sort((a, b) => a.midi - b.midi) };
  });
}

/** Whether an MNX document writes any dead note (`_x.mnxLab.tab.technique.dead`). */
export function writesDeadNotes(score: MnxStructure): boolean {
  return score.parts.some(p => (p.measures ?? []).some(m => JSON.stringify(m).includes('"dead":true')));
}

/** The label of a perfect performance: every note matched at the time it was rendered.
 * It implements no ambiguity rule, so it refuses consecutive events of identical pitches.
 * A sine rendering sounds every note's pitch, so the caller must refuse a score that
 * writes dead notes (`writesDeadNotes`); this labeller never marks one. */
export function perfectLabel(args: {
  id: string; performance: Performance; score: { path: string; sha256: string };
  handedQuartersPerMinute: number; duration: number;
  audio: PerformanceLabel['audio'];
  rendered: readonly { fromSample: number; toSample: number; midi: number; scoreQuarter: number; noteKey: string | null }[];
  sampleRate: number; recipe: unknown; format?: LabelFormat;
}): PerformanceLabel {
  const events = scoreEvents(args.performance);
  const pitches = (e: LabelEvent) => e.notes.map(n => n.midi).join(',');
  events.forEach((e, i) => { if (i && pitches(e) === pitches(events[i - 1]!)) throw new Error('Consecutive identical events need an ambiguity rule this labeller does not implement'); });
  const played: PlayedEvent[] = events.map(e => {
    const notes = e.notes.map(n => {
      const r = args.rendered.find(x => x.noteKey === n.noteKey && x.scoreQuarter === e.quarter);
      if (!r) throw new Error(`Note ${n.noteKey} was not rendered`);
      return { noteKey: n.noteKey, outcome: 'matched' as const, onset: r.fromSample / args.sampleRate, end: r.toSample / args.sampleRate };
    });
    const onset = Math.min(...notes.map(n => n.onset));
    return { index: e.index, onset, distinguishableAt: onset, notes };
  });
  if (args.rendered.length !== played.reduce((s, p) => s + p.notes.length, 0)) throw new Error('Rendered notes and score notes differ');
  const segments: Segment[] = played.map(p => ({ from: p.onset!, uncertainty: 0, state: 'supported', truth: p.index, admissible: [p.index], rule: ['sounded'] }));
  if (segments[0]!.from > 0) segments.unshift({ from: 0, uncertainty: 0, state: 'supported', truth: null, admissible: [], rule: [] });
  const label: PerformanceLabel = {
    format: args.format ?? LABEL_FORMAT, id: args.id, score: args.score,
    handoff: { from: positionToJSON(topOfScore(args.performance)), quartersPerMinute: args.handedQuartersPerMinute },
    duration: args.duration, audio: args.audio, events,
    performance: { events: played, extras: [] },
    cursor: { resolution: 'event', segments },
    provenance: { kind: 'generated', recipe: args.recipe, note: 'Perfect performance: every note matched at its rendered sample boundaries.' },
  };
  validateLabel(label);
  return label;
}

/** A performance-label@2 negative control: the handed score's every event missing, the
 * whole clip unsupported, and whatever sounded listed as extras (none for silence). */
export function controlLabel(args: {
  id: string; performance: Performance; score: { path: string; sha256: string };
  handedQuartersPerMinute: number; duration: number; audio: PerformanceLabel['audio'];
  control: 'silence' | 'wrong-score'; extras: Extra[]; recipe: Record<string, unknown>; note: string;
}): PerformanceLabel {
  if ((args.control === 'silence') !== (args.extras.length === 0)) throw new Error('Silence has no extras; a wrong-score control has the other piece\'s notes');
  const events = scoreEvents(args.performance);
  const label: PerformanceLabel = {
    format: LABEL_FORMAT_2, id: args.id, score: args.score,
    handoff: { from: positionToJSON(topOfScore(args.performance)), quartersPerMinute: args.handedQuartersPerMinute },
    duration: args.duration, audio: args.audio, events,
    performance: {
      events: events.map(e => ({ index: e.index, onset: null, distinguishableAt: null, notes: e.notes.map(n => ({ noteKey: n.noteKey, outcome: 'missing' as const })) })),
      extras: args.extras,
    },
    cursor: { resolution: 'event', segments: [{ from: 0, uncertainty: 0, state: 'unsupported', truth: null, admissible: [], rule: [] }] },
    provenance: { kind: 'generated', recipe: { ...args.recipe, control: args.control }, note: args.note },
  };
  validateLabel(label);
  return label;
}
