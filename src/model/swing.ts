// Swing resolution: which feel is in force in which bar, and what the printed
// marking says. The floor for both consumers — the engraver draws the marking
// from here (`engine/layout/scoreText.ts`) and the performance compiler builds
// its warp from here (`audio/swing.ts`) — so neither can disagree with the
// other about where a feel starts.
import type { MnxGlobalMeasure, MnxLabSwing } from './mnx.ts';

/** A resolved feel, ratio reduced and unit priced in whole notes. */
export interface ResolvedSwing {
  /** Played proportion of the first note of the pair. */
  first: bigint;
  /** Played proportion of the second. */
  second: bigint;
  /** The pair's unit as a fraction of a whole note, e.g. `[1n, 8n]`. */
  unit: readonly [bigint, bigint];
  /** The declaration this resolves, for the printed marking. */
  source: MnxLabSwing;
}

const BASE_VALUE: Record<string, readonly [bigint, bigint]> = {
  breve: [2n, 1n],
  whole: [1n, 1n],
  half: [1n, 2n],
  quarter: [1n, 4n],
  eighth: [1n, 8n],
  '16th': [1n, 16n],
  '32nd': [1n, 32n],
  '64th': [1n, 64n],
  '128th': [1n, 128n]
};

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

/**
 * A declaration in its canonical form, or `null` when it is straight or
 * unusable. Both cases mean the same thing to every consumer — play it as
 * written — so a malformed ratio degrades the way an unsupported element
 * degrades in the layouts, rather than failing the document.
 */
export function resolveSwing(swing: MnxLabSwing | undefined): ResolvedSwing | null {
  if (!swing) return null;
  const [rawFirst, rawSecond] = swing.ratio ?? [];
  if (!Number.isSafeInteger(rawFirst) || !Number.isSafeInteger(rawSecond)) return null;
  if (rawFirst <= 0 || rawSecond <= 0) return null;
  let first = BigInt(rawFirst);
  let second = BigInt(rawSecond);
  const divisor = gcd(first, second);
  first /= divisor;
  second /= divisor;
  if (first === second) return null; // 1:1 — straight, and how a swing is cancelled.
  const base = BASE_VALUE[swing.unit?.base ?? ''];
  if (!base) return null;
  const dots = swing.unit?.dots ?? 0;
  if (!Number.isSafeInteger(dots) || dots < 0 || dots > 8) return null;
  // A dotted unit is (2^(d+1) − 1) / 2^d of the base — the same arithmetic as
  // `model/time.ts`, in bigints because a pair grid must be exact.
  const unit: [bigint, bigint] = [
    base[0] * ((1n << BigInt(dots + 1)) - 1n),
    base[1] * (1n << BigInt(dots))
  ];
  const scale = gcd(unit[0], unit[1]);
  return { first, second, unit: [unit[0] / scale, unit[1] / scale], source: swing };
}

export interface SwingTimelineEntry {
  /** The feel in force for this measure, straight when null. */
  swing: ResolvedSwing | null;
  /** What THIS measure declared, when it declared anything. Kept because a
   *  cancellation resolves to null and an engraver still has to print it. */
  declared?: MnxLabSwing;
  /** True when this measure declares a feel differing from the one it
   *  inherited — the one place the marking is printed. */
  prints: boolean;
}

/**
 * One pass over the global measures: the feel in force in each, and whether
 * each is a change worth printing. A declaration persists until another
 * measure declares one, so a document states a feel where it CHANGES. Guitar
 * Pro writes its `TripletFeel` on every bar and prints it once; this is the
 * same idea with the repetition removed.
 */
export function resolveSwingTimeline(measures: readonly MnxGlobalMeasure[]): SwingTimelineEntry[] {
  let current: ResolvedSwing | null = null;
  return measures.map(measure => {
    const declared = measure?._x?.mnxLab?.swing;
    if (!declared) return { swing: current, prints: false };
    const resolved = resolveSwing(declared);
    const prints = !sameSwing(resolved, current);
    current = resolved;
    return { swing: current, declared, prints };
  });
}

/** The feel in force in each measure, without the print decisions. */
export function swingByMeasure(measures: readonly MnxGlobalMeasure[]): (ResolvedSwing | null)[] {
  return resolveSwingTimeline(measures).map(entry => entry.swing);
}

export function sameSwing(a: ResolvedSwing | null, b: ResolvedSwing | null): boolean {
  if (!a || !b) return !a && !b;
  return (
    a.first === b.first &&
    a.second === b.second &&
    a.unit[0] === b.unit[0] &&
    a.unit[1] === b.unit[1] &&
    (a.source.text ?? '') === (b.source.text ?? '')
  );
}
