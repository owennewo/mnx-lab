import type { MnxGlobalMeasure } from './types.js';

/**
 * The signature a pickup bar is written with, or null when the first bar is
 * not a pickup. The lab stores a pickup at its true length (one beat of 4/4 is
 * `1/4`) and marks it `number: 0`; MusicXML keeps the piece's signature on it
 * and marks the measure `number="0" implicit="yes"`, its notes saying how long
 * it is — so writing one "steals" the next bar's signature.
 *
 * The same rule as `src/model/pickup.ts`; the converter packages are
 * standalone, so each keeps its own copy. roadmap/proposed/core-anacrusis.md.
 */
export function pickupSignature(measures: readonly MnxGlobalMeasure[]): { count: number; unit: number; display?: 'common' | 'cut' } | null {
  const first = measures[0], second = measures[1];
  if (!first || !second || first.number !== 0 || !first.time) return null;
  const next = second.time ?? first.time;
  return first.time.count * next.unit < next.count * first.time.unit ? { ...next } : null;
}
