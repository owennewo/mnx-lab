// Guitar Pro's triplet feel ↔ `_x.mnxLab.swing`.
//
// GP names seven feels; every one of them is a ratio on a unit, which is what
// the extension stores (and what MusicXML's `<swing>` stores — alphaTab's own
// MusicXML importer maps `first`/`second` onto these same seven names, so the
// table below is the one both formats already agree on). Storing GP's name
// instead would be storing an opinion about the ratio.
//
// The played durations are the cross-check: alphaTab renders `Triplet8th` as a
// quarter-triplet plus an eighth-triplet (2:1 of the pair), `Dotted8th` as a
// dotted eighth plus a sixteenth (3:1), and `Scottish8th` as a sixteenth plus a
// dotted eighth (1:3) — the same three ratios, at either unit.
import type { MnxLabSwing, MnxNoteValueBase } from './types.ts';

export type GpTripletFeel =
  | 'NoTripletFeel'
  | 'Triplet8th'
  | 'Triplet16th'
  | 'Dotted8th'
  | 'Dotted16th'
  | 'Scottish8th'
  | 'Scottish16th';

const TABLE: Record<string, { ratio: [number, number]; base: MnxNoteValueBase }> = {
  Triplet8th: { ratio: [2, 1], base: 'eighth' },
  Triplet16th: { ratio: [2, 1], base: '16th' },
  Dotted8th: { ratio: [3, 1], base: 'eighth' },
  Dotted16th: { ratio: [3, 1], base: '16th' },
  Scottish8th: { ratio: [1, 3], base: 'eighth' },
  Scottish16th: { ratio: [1, 3], base: '16th' }
};

/** A GPIF `<TripletFeel>` token as a swing declaration. `NoTripletFeel` and an
 *  unknown token both give the straight declaration, which is meaningful: it
 *  CANCELS a feel a previous bar established. */
export function swingFromTripletFeel(token: string | null | undefined): MnxLabSwing {
  const entry = TABLE[(token ?? '').trim()];
  return entry
    ? { ratio: entry.ratio, unit: { base: entry.base } }
    : { ratio: [1, 1], unit: { base: 'eighth' } };
}

/** The GPIF token for a swing declaration, or null when the ratio has no name
 *  in Guitar Pro's vocabulary — a 5:3 feel is expressible here and not there. */
export function tripletFeelFromSwing(swing: MnxLabSwing | undefined): GpTripletFeel | null {
  if (!swing) return null;
  const [first, second] = swing.ratio ?? [];
  if (first === second) return 'NoTripletFeel';
  if ((swing.unit?.dots ?? 0) !== 0) return null;
  for (const [token, entry] of Object.entries(TABLE))
    if (entry.ratio[0] === first && entry.ratio[1] === second && entry.base === swing.unit?.base)
      return token as GpTripletFeel;
  return null;
}

/** How a swing declaration reads in a warning. */
export function describeSwing(swing: MnxLabSwing): string {
  const unit = swing.unit?.base ?? '?';
  return `${swing.ratio?.[0]}:${swing.ratio?.[1]} on the ${unit}`;
}
