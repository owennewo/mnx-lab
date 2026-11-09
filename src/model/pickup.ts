import type { MnxGlobalMeasure } from './mnx.ts';

type Signature = { count: number; unit: number; display?: 'common' | 'cut' };

/**
 * A pickup (anacrusis) bar: the first bar, numbered 0, shorter than the bar
 * after it. The lab stores it at its TRUE length — one beat of 4/4 is `1/4` —
 * so everything that measures time (playback, swing, sync, entry, the
 * underfill check) treats it as the short bar it is. Only what SHOWS or
 * WRITES a signature "steals" the next bar's: engraving draws 4/4 once at the
 * start, and Guitar Pro / MusicXML keep the piece's signature on the bar and
 * mark it a pickup. A first bar numbered 0 that is not shorter is only a
 * numbering choice. roadmap/proposed/core-anacrusis.md.
 *
 * Returns the signature a pickup is shown and written with, or null.
 * `converters/guitarpro-mnx/src/common/pickup.ts` keeps the same rule (the
 * converter packages are standalone).
 */
export function pickupSignature(measures: readonly MnxGlobalMeasure[]): Signature | null {
  const first = measures[0], second = measures[1];
  if (!first || !second || first.number !== 0 || !first.time) return null;
  const next = second.time ?? first.time;
  return first.time.count * next.unit < next.count * first.time.unit
    ? { count: next.count, unit: next.unit, ...(next.display ? { display: next.display } : {}) }
    : null;
}

/**
 * Whether the LAST bar completes a pickup — its signature and the pickup's add
 * up to the one it follows (3/4 after 4/4, behind a 1/4 pickup). Books draw no
 * signature on it: it is simply a short final bar.
 */
export function completesPickup(measures: readonly MnxGlobalMeasure[], index: number, prevailing: Signature): boolean {
  const pickup = pickupSignature(measures);
  const first = measures[0]?.time, own = measures[index]?.time;
  if (!pickup || !first || !own || index !== measures.length - 1 || index < 2) return false;
  if (prevailing.count !== pickup.count || prevailing.unit !== pickup.unit) return false;
  // own + first == prevailing, as fractions of a whole note.
  return (own.count * first.unit + first.count * own.unit) * prevailing.unit === prevailing.count * own.unit * first.unit;
}
