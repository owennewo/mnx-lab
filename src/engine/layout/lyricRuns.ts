// Lyric verse rows, shared between the two layouts. The gathering differs —
// the notation layout collects inside its multi-staff system walk, the
// standalone tab layout inside its single-part measure loop — but the verse
// geometry, the line ordering and the syllable/hyphen emission are ONE set of
// rules, extracted here so the views cannot drift. (The `both` view needs
// nothing: its lyrics anchor to the notation staff, which already draws
// them between the staves.)
import type { MnxStructure } from '../../model/mnx.ts';
import type { DisplayOptions } from '../displayOptions.ts';
import type { Primitive, RowBandSp } from '../primitives.ts';
import { inkEdgesSp } from '../render/bounds.ts';
import { FRET_FONT_SIZE_SP } from './textSizes.ts';

// The FRAME's first-verse drop: what a system provisionally reserves below its
// staff before any ink exists. Where a verse actually lands is measured —
// `emitLyricRuns` places it under the ink its staff carries.
export const LYRIC_FIRST_BASELINE_DROP_SP = 4.5;
export const LYRIC_LINE_SPACING_SP = 2.2;
// The fret digit's size: words and digits read at one weight, and both are
// staff spaces, so a staff-scale change grows them together.
export const LYRIC_SIZE_SP = FRET_FONT_SIZE_SP;
export const LYRIC_DESCENDER_PAD_SP = 0.8;
// Air between the last verse row's descenders and a native tab staff below it
// (the both view's content-driven inter-staff gap).
export const TAB_LYRIC_CLEARANCE_SP = 1;

/** The provisional band a verse stack claims below its staff (the frame). */
export function lyricBlockSpFor(lineCount: number): number {
  return lineCount > 0
    ? LYRIC_FIRST_BASELINE_DROP_SP + (lineCount - 1) * LYRIC_LINE_SPACING_SP + LYRIC_DESCENDER_PAD_SP
    : 0;
}

/** How many lyric lines the document uses anywhere — the row count every
 *  staff's verse stack shares (line ids are document-global). */
export function documentLyricLineCount(mnx: MnxStructure): number {
  const used = new Set<string>();
  for (const part of mnx.parts ?? []) {
    for (const pm of part.measures ?? []) {
      for (const seq of pm.sequences ?? []) {
        for (const item of seq.content ?? []) {
          const record = item as { content?: unknown[]; lyrics?: { lines?: Record<string, unknown> } };
          const events = Array.isArray(record.content) ? record.content : [item];
          for (const event of events) {
            const lines = (event as { lyrics?: { lines?: Record<string, unknown> } }).lyrics?.lines;
            for (const id of Object.keys(lines ?? {})) used.add(id);
          }
        }
      }
    }
  }
  return used.size;
}

export interface LyricSyllable {
  x: number;
  /** Verse row, 0-based, in the stacking order. */
  verse: number;
  /** The system row this syllable's staff belongs to — the row fit's owner. */
  row: number;
  /** The staff this syllable hangs from, in THIS system: its lines, and how
   *  far below them its own ink can reach (halfway to whatever comes next). */
  staffTop: number;
  staffBottom: number;
  bandBottom: number;
  text: string;
  /** start/middle syllables reach for the next one with a hyphen. */
  continues: boolean;
}

/** The verse-row order for a set of used line ids: global `lineOrder` first,
 *  unlisted ids after, sorted — the renderer's one stacking rule. */
export function orderedLyricLineIds(mnx: MnxStructure, used: ReadonlySet<string>): string[] {
  const order = mnx.global.lyrics?.lineOrder ?? [];
  const ordered = [...new Set(order)].filter(id => used.has(id));
  const rest = [...used].filter(id => !order.includes(id)).sort();
  return [...ordered, ...rest];
}

// A verse's ink top above its baseline and reach below it — the same text
// metrics the row fit measures with (render/bounds.ts), so air here is air there.
const LYRIC_PROBE: Primitive = { kind: 'text', text: 'x', x: 0, y: 0, font: 'body', size: LYRIC_SIZE_SP, anchor: 'middle' };
const LYRIC_ASCENT_SP = -inkEdgesSp(LYRIC_PROBE).top;

// A staff's frame — lines, barlines, a group's brace or bracket — and the
// verses themselves never push a verse down. Whole class tokens only: a
// tuplet-bracket under the notes is ink like any other.
const NOT_HANGING_INK = /staff-line|barline|lyric|(^|\s)(brace|bracket)(\s|$)/;

/** Where a primitive hangs from: a line or curve by its TOP (a down-stem starts
 *  at its notehead, a slur under the notes at its ends), anything else by its
 *  anchor. */
function hangY(p: Primitive): number {
  switch (p.kind) {
    case 'line':
      return Math.min(p.y1, p.y2);
    case 'curve':
      return Math.min(...p.points.map(pt => pt.y));
    default:
      return p.y;
  }
}

/**
 * Places the verse rows, then emits them: syllables centred under their
 * columns, hyphens joining start/middle syllables to the next one on the same
 * row (a system wrap suppresses the hyphen).
 *
 * A staff's verses sit under the deepest ink that staff carries IN THAT
 * SYSTEM — stems, ledger lines, dynamics, hairpins, slurs, an octave clef's
 * figure — with `airSp` between that ink (or the bottom line, when nothing
 * hangs there) and the first verse's ink top; later verses follow at
 * LYRIC_LINE_SPACING_SP. One baseline per staff per system, so a verse reads
 * level. `airSp` is the clearance control's `lyricInk`: at the tight end a
 * verse all but touches the system that owns it. Run it after everything else
 * a staff hangs below itself has been emitted. Returns the system row each
 * verse primitive belongs to: the row fit's ownership, a fact rather than a
 * guess from geometry — a verse can hang deeper than the frame reserved.
 */
export function emitLyricRuns(
  runs: Iterable<LyricSyllable[]>,
  primitives: Primitive[],
  airSp: number
): Map<Primitive, number> {
  const all = [...runs];
  const owners = new Map<Primitive, number>();
  const firstBaseline = new Map<number, number>();
  for (const run of all) {
    for (const syl of run) {
      if (firstBaseline.has(syl.staffBottom)) continue;
      let deepest = syl.staffBottom;
      for (const p of primitives) {
        if (NOT_HANGING_INK.test(p.className ?? '')) continue;
        const y = hangY(p);
        if (y < syl.staffTop || y >= syl.bandBottom) continue;
        deepest = Math.max(deepest, inkEdgesSp(p).bottom);
      }
      firstBaseline.set(syl.staffBottom, deepest + airSp + LYRIC_ASCENT_SP);
    }
  }
  for (const run of all) {
    run.forEach((syl, k) => {
      const y = firstBaseline.get(syl.staffBottom)! + syl.verse * LYRIC_LINE_SPACING_SP;
      const syllable: Primitive = {
        kind: 'text',
        text: syl.text,
        x: syl.x,
        y,
        font: 'body',
        size: LYRIC_SIZE_SP,
        anchor: 'middle',
        className: 'lyric'
      };
      primitives.push(syllable);
      owners.set(syllable, syl.row);
      const next = run[k + 1];
      if (syl.continues && next && next.staffBottom === syl.staffBottom && next.verse === syl.verse && next.x > syl.x) {
        const hyphen: Primitive = {
          kind: 'text',
          text: '-',
          x: (syl.x + next.x) / 2,
          y,
          font: 'body',
          size: LYRIC_SIZE_SP,
          anchor: 'middle',
          className: 'lyric-hyphen'
        };
        primitives.push(hyphen);
        owners.set(hyphen, syl.row);
      }
    });
  }
  return owners;
}

/**
 * How far any verse reaches below the bottom line of the system it hangs
 * from — the reservation the row fit needs so its midpoint attribution never
 * files a verse with the system below. Measured, because placement is.
 */
export function lyricReachBelowRows(primitives: readonly Primitive[], rows: readonly RowBandSp[]): number {
  let reach = 0;
  for (const p of primitives) {
    if (p.kind !== 'text' || !/lyric/.test(p.className ?? '')) continue;
    let r = -1;
    while (r + 1 < rows.length && rows[r + 1].staffBottom < p.y) r++;
    if (r < 0 || (r + 1 < rows.length && p.y > rows[r + 1].staffTop)) continue;
    reach = Math.max(reach, inkEdgesSp(p).bottom - rows[r].staffBottom);
  }
  return reach;
}

/** Traverse event containers without changing the document or its verse IDs. */
export function documentLyricLineIds(mnx: MnxStructure): string[] {
  const used = new Set<string>();
  const visit = (item: unknown): void => {
    if (!item || typeof item !== 'object') return;
    const record = item as { content?: unknown[]; lyrics?: { lines?: Record<string, { text?: string }> } };
    for (const [id, line] of Object.entries(record.lyrics?.lines ?? {})) {
      if (line.text?.trim()) used.add(id);
    }
    for (const child of record.content ?? []) visit(child);
  };
  for (const part of mnx.parts ?? []) for (const measure of part.measures ?? []) {
    for (const sequence of measure.sequences ?? []) visit(sequence);
  }
  return orderedLyricLineIds(mnx, used);
}

/** undefined means preserve all historical rows; [] means allocate none. */
export function selectedLyricLineIds(mnx: MnxStructure, display: DisplayOptions): string[] | undefined {
  if (display.lyrics === 'hide') return [];
  const used = documentLyricLineIds(mnx);
  if (used.length === 0) return [];
  if (display.lyrics !== 'current') return undefined;
  const selected = display.selectedVerse ?? used[0];
  return selected && used.includes(selected) ? [selected] : [];
}
