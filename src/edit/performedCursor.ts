// The performed half of the cursor — roadmap/proposed/core-single-cursor.md.
//
// The edit cursor is ONE position: a pass-model entry (which visit of which
// bar) plus the written address inside it. The written address is what every
// walk in `cursor.ts` already computes; this module decides the entry. It is
// pure over the pass model (`model/passes.ts`) and the cursor's written
// measure and onset, so the session's rules are testable without a grid.
//
// Two kinds of move, two rules:
//  - a STEP (←/→, the bar step) continues through the performance: the entry
//    after the one the cursor stands in, whatever bar that is — the repeat
//    start after a `:|` on a pass that is not the last, the second ending on
//    pass two, the coda after a `To Coda`;
//  - a JUMP (a click, go to bar, Home/End, a system step) chooses a visit of
//    the bar it landed in: the current pass when that pass plays it, nearest
//    the current visit, else the bar's first performance — "jumping out of a
//    repeat resets the pass".
// A bar no performance reaches has no entry, and the cursor may still stand
// there WRITTEN-ONLY (`null`): a half-built repeat, a walk that hit its cap,
// the ghost bar past the end.
import type { PassModel, PerformedEntry } from '../model/passes.ts';
import type { Onset } from './cursor.ts';

const before = (a: Onset, b: readonly [number, number]) => a.num * b[1] < b[0] * a.den;

/**
 * May the cursor stand at this onset on this visit? A visit is its bar up to
 * the slice's end (`until`, where a mid-bar jump fires). Its START is not a
 * bound for the cursor: a D.S. to a mid-bar segno arrives while a note that
 * began earlier in the bar is still sounding, and that note is where the
 * cursor stands — the player clamps a seek to the slice itself.
 */
export function entryContains(entry: PerformedEntry, measureIndex: number, onset: Onset): boolean {
  if (entry.measureIndex !== measureIndex) return false;
  if (entry.until && !before(onset, entry.until)) return false;
  return true;
}

/** Every visit that contains this written place, in performance order. */
export function performancesAt(model: PassModel, measureIndex: number, onset: Onset): PerformedEntry[] {
  return model.entries.filter(entry => entryContains(entry, measureIndex, onset));
}

/**
 * The visit a JUMP lands on. The current pass when it plays the place —
 * nearest the current visit, so a D.S. bar with two visits on one pass keeps
 * the one being read — else the place's first performance; null when no
 * performance reaches it.
 */
export function choosePerformance(
  model: PassModel,
  measureIndex: number,
  onset: Onset,
  current: number | null
): number | null {
  const candidates = performancesAt(model, measureIndex, onset);
  if (candidates.length === 0) return null;
  const at = current === null ? undefined : model.entries[current];
  if (at) {
    const same = candidates.filter(entry => entry.iteration === at.iteration);
    if (same.length > 0) {
      return same.reduce((best, entry) =>
        Math.abs(entry.ordinal - at.ordinal) < Math.abs(best.ordinal - at.ordinal) ? entry : best).ordinal;
    }
  }
  return candidates[0].ordinal;
}

/**
 * Where a STEP goes, given where the written walk put the cursor.
 *
 * `landed` is the written walk's answer. When it is still inside the current
 * visit, or inside the visit the performance goes to next, the written walk
 * and the performance agree and the ordinal simply follows. Otherwise the
 * performance goes somewhere the written order does not — and the answer is
 * that next visit, for the caller to land in (its first stop walking forward,
 * its last walking back). `end` means the performance has no further visit in
 * that direction.
 */
export type PerformedStep =
  | { kind: 'follow'; ordinal: number | null }
  | { kind: 'redirect'; entry: PerformedEntry }
  | { kind: 'end' };

export function performedStep(
  model: PassModel,
  current: number | null,
  landed: { measureIndex: number; onset: Onset },
  delta: 1 | -1
): PerformedStep {
  const at = current === null ? undefined : model.entries[current];
  // Written-only: walk written order until a performed bar, then take its first visit.
  if (!at) return { kind: 'follow', ordinal: choosePerformance(model, landed.measureIndex, landed.onset, null) };
  if (entryContains(at, landed.measureIndex, landed.onset)) return { kind: 'follow', ordinal: at.ordinal };
  const next = model.entries[at.ordinal + delta];
  if (!next) return { kind: 'end' };
  if (entryContains(next, landed.measureIndex, landed.onset)) return { kind: 'follow', ordinal: next.ordinal };
  return { kind: 'redirect', entry: next };
}

/**
 * The visit that stands for the old one after the pass model was rebuilt (an
 * edit, an undo): the same bar's same occurrence, else its visit on the same
 * pass, else its first performance, else written-only.
 */
export function remapPerformance(
  previous: PerformedEntry | null,
  model: PassModel,
  measureIndex: number,
  onset: Onset
): number | null {
  const candidates = performancesAt(model, measureIndex, onset);
  if (candidates.length === 0) return null;
  if (previous) {
    // An occurrence counts visits of ONE bar, so it only names the same visit in the same bar.
    const same = (previous.measureIndex === measureIndex
      ? candidates.find(entry => entry.occurrence === previous.occurrence) : undefined)
      ?? candidates.find(entry => entry.iteration === previous.iteration);
    if (same) return same.ordinal;
  }
  return candidates[0].ordinal;
}

/** The onset a visit starts at: its slice's start, or the bar's. */
export function entryStart(entry: PerformedEntry): Onset {
  return entry.from ? { num: entry.from[0], den: entry.from[1] } : { num: 0, den: 1 };
}
