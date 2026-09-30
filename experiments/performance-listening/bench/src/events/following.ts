/** following-evaluator@2 (contracts/event-instruments-1.md): the live cursor judged on
 * score events. Exact: both views and the label are piecewise constant, so it integrates
 * over the intervals between their breakpoints, with no grid. */
import { heaviest } from '../../../listen/backend.ts';
import type { Decision } from '../../../listen/contract.ts';
import { liveView } from '../../../listen/liveView.ts';
import { validateRecord } from '../../../listen/validate.ts';
import { comparePositions, DEADLINE, eventPositions, type PerformanceLabel, validateLabel } from './label.ts';

export const FOLLOWING_EVALUATOR = 'following-evaluator@2';
export const CATEGORIES = ['onEvent', 'ahead', 'behind', 'abstained', 'uncovered', 'falseFollowing', 'correctRejection'] as const;
export type Category = typeof CATEGORIES[number];
type Shown = number | 'unsupported' | null;

export interface ViewMeasures {
  seconds: Record<Category | 'pending' | 'indeterminate' | 'answerable' | 'supportedAnswerable', number>;
  onEventFraction: number | null;
  aheadFraction: number | null;
}
export interface FollowingEvaluation {
  evaluator: typeof FOLLOWING_EVALUATOR;
  label: string;
  asDecided: ViewMeasures;
  hindsight: ViewMeasures;
  exposure: { seconds: number; fraction: number | null; longest: number };
  byEvent: { reached: number; of: number; events: { index: number; distinguishableAt: number; delay: number | null; reached: boolean }[] };
  recovery: { recovered: number; of: number; notAssessable: number; cases: { missing: number[]; next: number | null; reached: boolean | null }[] };
  extras: { held: number; moved: number; notAssessable: number };
}

const EPSILON = 1e-9;

/** The hindsight view: the decision about the latest time not after t, whenever it was made. */
export function hindsightView(record: readonly Decision[], t: number): Decision | undefined {
  let shown: Decision | undefined;
  for (const d of record) {
    if (d.kind === 'note' || d.refersTo > t) continue;
    if (!shown || d.refersTo > shown.refersTo || (d.refersTo === shown.refersTo && d.madeAt >= shown.madeAt)) shown = d;
  }
  return shown;
}

export function evaluateFollowing(label: PerformanceLabel, record: readonly Decision[]): FollowingEvaluation {
  validateLabel(label); validateRecord(record);
  const positions = eventPositions(label), segments = label.cursor.segments, duration = label.duration;
  /** Rule 1: the last event whose onset the position has reached; -1 before the first. */
  const shownBy = (d: Decision | undefined): Shown => {
    if (!d) return null;
    if (d.kind === 'unsupported') return 'unsupported';
    if (d.kind !== 'position') return null;
    const p = heaviest(d);
    let index = -1;
    for (let i = 0; i < positions.length && comparePositions(positions[i]!, p) <= 0; i++) index = i;
    return index;
  };
  const firstJudged = segments.find(s => s.state === 'unsupported' || s.admissible.length > 0);
  const pendingEnd = firstJudged ? firstJudged.from + DEADLINE : duration;
  const segmentAt = (t: number) => { let i = 0; while (i + 1 < segments.length && segments[i + 1]!.from <= t) i++; return i; };
  const excluded = (t: number): 'pending' | 'indeterminate' | null =>
    t < pendingEnd ? 'pending' : segments.some(s => s.uncertainty > 0 && Math.abs(t - s.from) <= s.uncertainty) ? 'indeterminate' : null;
  const judge = (t: number, shown: Shown): Category => {
    const i = segmentAt(t), s = segments[i]!;
    if (s.state === 'unsupported') return shown === null ? 'uncovered' : shown === 'unsupported' ? 'correctRejection' : 'falseFollowing';
    if (shown === null) return 'uncovered';
    if (shown === 'unsupported') return 'abstained';
    const admissible = new Set(s.admissible);
    if (i > 0 && t < s.from + DEADLINE) for (const k of segments[i - 1]!.admissible) admissible.add(k);
    if (admissible.has(shown)) return 'onEvent';
    const reference = s.truth ?? Math.max(...s.admissible);
    return shown > reference ? 'ahead' : 'behind';
  };

  const breakpoints = (times: number[]) => {
    const all = [0, duration, pendingEnd, ...times, ...label.performance.extras.map(x => x.onset),
      ...segments.flatMap(s => [s.from, s.from + DEADLINE, s.from - s.uncertainty, s.from + s.uncertainty])]
      .filter(t => t >= 0 && t <= duration).sort((a, b) => a - b);
    return all.filter((t, i) => i === 0 || t - all[i - 1]! > EPSILON);
  };
  type Piece = { from: number; to: number; category: Category | 'pending' | 'indeterminate'; shown: Shown };
  const pieces = (view: (t: number) => Decision | undefined, times: number[]): Piece[] => {
    const points = breakpoints(times), out: Piece[] = [];
    for (let k = 0; k + 1 < points.length; k++) {
      const from = points[k]!, to = points[k + 1]!, middle = (from + to) / 2, shown = shownBy(view(middle));
      out.push({ from, to, shown, category: excluded(middle) ?? judge(middle, shown) });
    }
    return out;
  };
  const measure = (ps: Piece[]): ViewMeasures => {
    const seconds = Object.fromEntries([...CATEGORIES, 'pending', 'indeterminate', 'answerable', 'supportedAnswerable'].map(k => [k, 0])) as ViewMeasures['seconds'];
    for (const p of ps) {
      const length = p.to - p.from;
      seconds[p.category] += length;
      if (p.category !== 'pending' && p.category !== 'indeterminate') {
        seconds.answerable += length;
        if (segments[segmentAt((p.from + p.to) / 2)]!.state === 'supported') seconds.supportedAnswerable += length;
      }
    }
    const of = seconds.supportedAnswerable;
    return { seconds, onEventFraction: of ? seconds.onEvent / of : null, aheadFraction: of ? seconds.ahead / of : null };
  };

  const live = (t: number) => liveView(record, t);
  const livePieces = pieces(live, record.map(d => d.madeAt));
  const hindsightPieces = pieces(t => hindsightView(record, t), record.map(d => d.refersTo));

  let exposure = 0, longest = 0, current = 0;
  for (const p of livePieces) {
    if (p.category === 'ahead' || p.category === 'behind' || p.category === 'falseFollowing') { exposure += p.to - p.from; current += p.to - p.from; longest = Math.max(longest, current); }
    else current = 0;
  }
  const asDecided = measure(livePieces);

  /** The first moment at or after `from` that the live cursor shows event k. */
  const firstShown = (k: number, from: number): number | null => {
    const times = [from, ...record.map(d => d.madeAt).filter(t => t > from)].sort((a, b) => a - b);
    for (const t of times) if (t < duration && shownBy(live(t)) === k) return t;
    return null;
  };
  const events = label.performance.events.filter(p => p.distinguishableAt !== null).map(p => {
    const at = firstShown(p.index, p.distinguishableAt!), delay = at === null ? null : at - p.distinguishableAt!;
    return { index: p.index, distinguishableAt: p.distinguishableAt!, delay, reached: delay !== null && delay <= DEADLINE + EPSILON };
  });
  const reached = new Map(events.map(e => [e.index, e.reached]));

  const cases: FollowingEvaluation['recovery']['cases'] = [];
  const played = label.performance.events;
  for (let i = 0; i < played.length; i++) {
    if (played[i]!.onset !== null || (i > 0 && played[i - 1]!.onset === null)) continue;
    const missing: number[] = [];
    for (let j = i; j < played.length && played[j]!.onset === null; j++) missing.push(j);
    const next = played.find(p => p.index > missing.at(-1)! && p.onset !== null && p.distinguishableAt !== null)?.index ?? null;
    cases.push({ missing, next, reached: next === null ? null : reached.get(next)! });
  }

  let held = 0, moved = 0, notAssessable = 0;
  for (const x of label.performance.extras) {
    const start = livePieces.find(p => p.from <= x.onset + EPSILON && x.onset < p.to - EPSILON);
    if (!start || start.category !== 'onEvent') { notAssessable++; continue; }
    const end = segments.find(s => s.from > x.onset + EPSILON)?.from ?? duration;
    const window = livePieces.filter(p => p.from >= x.onset - EPSILON && p.to <= end + EPSILON && p.category !== 'pending' && p.category !== 'indeterminate');
    if (window.every(p => p.category === 'onEvent')) held++; else moved++;
  }

  return {
    evaluator: FOLLOWING_EVALUATOR, label: label.id, asDecided, hindsight: measure(hindsightPieces),
    exposure: { seconds: exposure, fraction: asDecided.seconds.answerable ? exposure / asDecided.seconds.answerable : null, longest },
    byEvent: { reached: events.filter(e => e.reached).length, of: events.length, events },
    recovery: { recovered: cases.filter(c => c.reached).length, of: cases.filter(c => c.next !== null).length, notAssessable: cases.filter(c => c.next === null).length, cases },
    extras: { held, moved, notAssessable },
  };
}
