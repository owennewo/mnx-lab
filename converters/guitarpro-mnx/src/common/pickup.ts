import type { MnxGlobalMeasure } from './types.js';

/**
 * The signature a pickup bar is written with, or null when the first bar is
 * not a pickup. The lab stores a pickup at its true length (one beat of 4/4 is
 * `1/4`) and marks it `number: 0`; Guitar Pro and MusicXML keep the piece's
 * signature on it instead and let the notes say how long it is — so writing
 * one "steals" the next bar's signature. A first bar numbered 0 that is NOT
 * shorter than the next is only a numbering choice.
 *
 * The same rule as `src/model/pickup.ts`, which the engine reads; the
 * converter packages are standalone, so each keeps its own copy.
 * roadmap/proposed/core-anacrusis.md.
 */
export function pickupSignature(measures: readonly MnxGlobalMeasure[]): { count: number; unit: number } | null {
  const first = measures[0], second = measures[1];
  if (!first || !second || first.number !== 0 || !first.time) return null;
  const next = second.time ?? first.time;
  return first.time.count * next.unit < next.count * first.time.unit ? { count: next.count, unit: next.unit } : null;
}
