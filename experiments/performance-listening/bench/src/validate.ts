import { type Decision, type Golden, type Rational, type Trajectory, value } from './types.ts';
const requireThat = (ok: boolean, message: string): void => { if (!ok) throw new Error(message); };
const nonnegative = (n: number): boolean => Number.isFinite(n) && n >= 0;
function fraction(r: Rational): void {
  requireThat(!!r && Number.isSafeInteger(r.num) && r.num >= 0 && Number.isSafeInteger(r.den) && r.den > 0, 'Invalid rational');
}
function trajectory(t: Trajectory): void {
  fraction(t.atStart); fraction(t.quartersPerSecond);
  requireThat(Number.isSafeInteger(t.route) && t.route > 0, 'Invalid route');
}
/** Semantic invariants supplement the versioned JSON schemas (validated in tests). */
export function validateGolden(g: Golden): void {
  requireThat(g.version === 1 && g.noteAssessment === null, 'Unsupported golden version');
  requireThat(g.audio.sampleRate === 48000 && g.audio.channels === 1 && nonnegative(g.audio.duration) && g.audio.duration > 0, 'Invalid audio');
  let end = 0;
  for (const interval of g.labels.following) {
    requireThat(interval.start === end && nonnegative(interval.end) && interval.end > interval.start, 'Following intervals must be contiguous and ordered');
    requireThat(['supported', 'unsupported', 'unknown'].includes(interval.state), 'Invalid following state');
    if (interval.state !== 'unknown') {
      requireThat(nonnegative(interval.answerableFrom) && interval.answerableFrom <= interval.end, 'Invalid answerability');
      requireThat(Number.isSafeInteger(interval.route) && interval.route > 0, 'Invalid route');
    }
    if (interval.state === 'supported') {
      trajectory(interval.truth);
      requireThat(interval.truth.route === interval.route && interval.admissible.length > 0, 'Invalid truth route / admissibility');
      interval.admissible.forEach(trajectory);
      requireThat(interval.admissible.some(t => t.route === interval.truth.route && value(t.atStart) === value(interval.truth.atStart) && value(t.quartersPerSecond) === value(interval.truth.quartersPerSecond)), 'Truth must be admissible');
    }
    requireThat(interval.precision.kind !== 'bounded' || nonnegative(interval.precision.uncertaintySeconds!), 'Bounded precision needs uncertainty');
    end = interval.end;
  }
  requireThat(end === g.audio.duration, 'Following labels must cover the audio, with unknown tails explicit');
  for (const note of g.labels.notes) {
    requireThat(nonnegative(note.onset) && note.audibleEnd > note.onset && note.audibleEnd <= end, 'Invalid sounding interval');
    fraction(note.scoreDuration);
  }
}
export function validateDecisions(record: readonly Decision[]): void {
  const ids = new Map<string, Decision>();
  let clock = 0;
  for (const d of record) {
    requireThat(typeof d.id === 'string' && d.id.length > 0 && !ids.has(d.id), 'Duplicate or missing decision id');
    requireThat(nonnegative(d.refersTo) && nonnegative(d.madeAt) && d.refersTo <= d.madeAt && d.madeAt >= clock, 'Invalid decision clock');
    if (d.supersedes) requireThat(ids.get(d.supersedes)?.refersTo === d.refersTo, 'Revision must refer to an existing decision at the same time');
    requireThat(['position', 'unsupported', 'note'].includes(d.kind), 'Invalid decision kind');
    if (d.kind === 'position') {
      requireThat(nonnegative(d.confidence) && d.confidence <= 1 && d.candidates.length > 0, 'Invalid confidence / candidates');
      for (const c of d.candidates) {
        fraction(c.position.quarters);
        requireThat(Number.isSafeInteger(c.position.route) && c.position.route > 0 && c.weight > 0 && c.weight <= 1, 'Invalid candidate');
      }
      requireThat(Math.abs(d.candidates.reduce((sum, c) => sum + c.weight, 0) - 1) < 1e-9, 'Weights must sum to one');
    }
    ids.set(d.id, d); clock = d.madeAt;
  }
}
