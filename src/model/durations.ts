// The ONE note-value table. Every consumer of "how long is a `base`" reads
// this file: the layout engine prices columns from it (via
// engine/layout/spacing.ts, which re-exports `durationValue`), and audio
// derives beat times from it. It used to exist twice — spacing.ts held the
// full table while audio carried a six-entry copy that silently played a
// `64th` (or a `breve`) as a quarter — which is why the floor lives in
// `model/` now, below both consumers.

const DURATION_BASE_VALUE: Record<string, number> = {
  duplexMaxima: 16,
  maxima: 8,
  longa: 4,
  breve: 2,
  whole: 1,
  half: 0.5,
  quarter: 0.25,
  eighth: 0.125,
  '16th': 0.0625,
  '32nd': 0.03125,
  '64th': 0.015625,
  '128th': 0.0078125,
  '256th': 0.00390625,
  '512th': 0.001953125,
  '1024th': 0.0009765625,
  '2048th': 0.00048828125,
  '4096th': 0.000244140625
};

/** Duration as a fraction of a whole note, including dots. `space` items
 *  carry a plain fraction `[num, den]` instead of a note value. An unknown
 *  base falls back to a quarter — the same forgiving default the layouts
 *  apply, reachable only by a document the validators already flagged. */
export function durationValue(d: { base: string; dots?: number } | [number, number]): number {
  if (Array.isArray(d)) return d[1] ? d[0] / d[1] : 0.25;
  const base = DURATION_BASE_VALUE[d.base] ?? 0.25;
  let value = base;
  let dotValue = base;
  for (let i = 0; i < (d.dots ?? 0); i++) {
    dotValue /= 2;
    value += dotValue;
  }
  return value;
}
