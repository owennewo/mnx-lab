// Lyric verse rows, shared between the two layouts. The gathering differs —
// the notation layout collects inside its multi-staff system walk, the
// standalone tab layout inside its single-part measure loop — but the verse
// geometry, the line ordering and the syllable/hyphen emission are ONE set of
// rules, extracted here so the views cannot drift. (The `both` view needs
// nothing: its lyrics anchor to the notation staff, which already draws
// them between the staves.)
import type { MnxStructure } from '../../model/mnx.ts';
import type { Primitive } from '../primitives.ts';

export const LYRIC_FIRST_BASELINE_DROP_SP = 4.5; // first verse baseline below bottom line
export const LYRIC_LINE_SPACING_SP = 2.2;
export const LYRIC_SIZE_SP = 1.7;
export const LYRIC_DESCENDER_PAD_SP = 0.8;
// Air between the last verse row's descenders and a native tab staff below it
// (the both view's content-driven inter-staff gap).
export const TAB_LYRIC_CLEARANCE_SP = 1;

export interface LyricSyllable {
  x: number;
  y: number;
  text: string;
  /** start/middle syllables reach for the next one with a hyphen. */
  continues: boolean;
}

/** The verse-row order for a set of used line ids: global `lineOrder` first,
 *  unlisted ids after, sorted — the renderer's one stacking rule. */
export function orderedLyricLineIds(mnx: MnxStructure, used: ReadonlySet<string>): string[] {
  const order = mnx.global.lyrics?.lineOrder ?? [];
  const ordered = order.filter(id => used.has(id));
  const rest = [...used].filter(id => !order.includes(id)).sort();
  return [...ordered, ...rest];
}

/** Syllables centred under their columns, hyphens joining start/middle
 *  syllables to the next one on the same row. System wrap is implicit: a
 *  hyphen is suppressed when the next syllable sits on another row. */
export function emitLyricRuns(runs: Iterable<LyricSyllable[]>, primitives: Primitive[]): void {
  for (const run of runs) {
    run.forEach((syl, k) => {
      primitives.push({
        kind: 'text',
        text: syl.text,
        x: syl.x,
        y: syl.y,
        font: 'body',
        size: LYRIC_SIZE_SP,
        anchor: 'middle',
        className: 'lyric'
      });
      const next = run[k + 1];
      if (syl.continues && next && next.y === syl.y && next.x > syl.x) {
        primitives.push({
          kind: 'text',
          text: '-',
          x: (syl.x + next.x) / 2,
          y: syl.y,
          font: 'body',
          size: LYRIC_SIZE_SP,
          anchor: 'middle',
          className: 'lyric-hyphen'
        });
      }
    });
  }
}
