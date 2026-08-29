import {
  MnxStructure,
  MnxNote,
  MnxPart,
  MnxSequence,
  MnxSequenceItem,
  MnxTremolo,
  MnxTuplet,
  isGrace,
  isTremolo,
  isTuplet,
  isTimedEvent,
  sequenceItemKind,
  type MnxGlobalMeasure,
  type MnxPartMeasure
} from '../../model/mnx.ts';
import { dynamicWidthSp } from './dynamics.ts';
import { clampPadDensity } from './verticalDensity.ts';

/**
 * Horizontal spacing — the one place bar widths and note spacing are decided.
 *
 * Model (a simplified springs-and-rods system, after Gourlay / LilyPond):
 *
 *   event column = [leading rigid: accidentals][core rigid: notehead + dots][spring]
 *
 * Spring lengths come from duration via a log2 rule, so a whole note gets more
 * room than a quarter but nowhere near 4x. A measure's natural width is its
 * header prefix (clef/key/time) plus the widest voice's column run. Systems
 * pack greedily into the line width; each row then stretches its springs by a
 * common factor to justify (capped, so sparse rows stay natural rather than
 * stretching one bar across the page).
 *
 * Both layoutNotation and layoutTab consume the SAME plan — that is what keeps
 * the two staves column-aligned in the "both" view. Keep this module free of
 * rendering concerns: it deals in geometry, not glyphs (the one exception is
 * accidental visibility, which both spacing and notation need — it lives here
 * so the two can't drift).
 */

// ---------- Spacing knobs (all horizontal "feel" lives here) ----------

const MARGIN_SP = 2;               // page margin either side of a system
const MIN_PAGE_MARGIN_SP = 0.5;    // floor under `densityPad` (core-vertical-density.md)
const CONTENT_LEFT_PAD_SP = 0.6;
const CONTENT_RIGHT_PAD_SP = 0.8;
const START_BARLINE_PAD_SP = 0.5;
const CLEF_WIDTH_SP = 3;
/**
 * The tab clef's own slot. `6stringTabClef` is 1.64sp of ink against `gClef`'s
 * 2.68, so a tab-only system sized to the notation slot carries 1.36sp it can
 * never fill. 2.0 leaves it the same ~0.35sp of breathing room the notation
 * slot leaves its own glyph — the slot is right-sized, not tightened.
 */
const TAB_CLEF_WIDTH_SP = 2;
/** Floor under every prefix pad `densityPad` scales — visible clearance
 *  between two glyphs, below which they read as touching. */
const MIN_GLYPH_CLEAR_SP = 0.2;
const TIME_SIG_WIDTH_SP = 2.5;
export const KEY_SIG_GLYPH_ADVANCE_SP = 1.0;
const KEY_SIG_RIGHT_PAD_SP = 0.5;

export const ACCIDENTAL_SLOT_WIDTH_SP = 1.0; // one stacked accidental column
export const ACCIDENTAL_RIGHT_PAD_SP = 0.15;

export const CORE_SP = 1.5;        // notehead / fret-number column (rigid)
const DOT_SP = 0.55;               // extra rigid width per augmentation dot
export const GRACE_NOTE_ADVANCE_SP = 1.5; // rigid column per grace note (small scale)
export const TREMOLO_NOTE_ADVANCE_SP = 5; // between a multi-note tremolo's two written notes
const GRACE_RIGHT_PAD_SP = 0.3;    // gap between a grace group and its principal
const MID_CLEF_WIDTH_SP = 2.4;     // rigid column for a mid-measure clef change
const MID_CLEF_LEFT_PAD_SP = 0.3;  // gap between the previous column and the clef
const DYNAMIC_SIDE_PAD_SP = 0.3;   // clearance either side of a dynamic mark
export const REPEAT_START_WIDTH_SP = 2.0; // |: cluster after the prefix glyphs
export const REPEAT_END_EXTRA_SP = 1.4;   // room for the :| dots before the end barline
const MULTIREST_WIDTH_SP = 10;     // content width of a collapsed H-bar measure
const LYRIC_CHAR_WIDTH_SP = 0.95;  // syllable width estimate per character
const LYRIC_SIDE_PAD_SP = 0.35;    // clearance either side of a syllable
const ONSET_EPS = 1e-6;            // float tolerance for metric positions
/** Ideal space after a quarter note, in staff spaces, at density 1 — the unit
 *  the SPACE axis is a multiplier ON, which is why it is exported: a control
 *  printing a percentage should be able to say what of. */
export const QUARTER_SPRING_SP = 2.2;
const MEASURE_LEAD_FACTOR = 0.5;   // barline→first-note spring, as a fraction of
                                   // the first event's spring — it stretches with
                                   // justification like every other gap (the rigid
                                   // CONTENT_LEFT_PAD_SP is the floor)
const MEASURE_TRAIL_FACTOR = 0.5;  // the last event's spring counts at this factor:
                                   // duration space belongs between attacks, and a
                                   // barline isn't an attack — keeps the pre-barline
                                   // gap symmetric with the post-barline lead
const SPRING_LOG_FACTOR = 0.5;     // how strongly duration affects the spring
const MIN_SPRING_SP = 0.8;         // floor for very short notes
export const MAX_STRETCH = 2.5;    // justification cap — beyond this, leave the row ragged
export const MIN_SQUEEZE = 0.35;   // compression floor for overfull rows
const EMPTY_CONTENT_SP = 6;        // content width of a measure with no events

// ---------- Durations ----------

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
 *  carry a plain fraction `[num, den]` instead of a note value. */
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

/** A multi-note tremolo's real metric time: `outer` (duration × multiple)
 *  when present, else the first written note's value (convention: both notes
 *  are written with the tremolo's total duration). */
export function tremoloDuration(t: MnxTremolo): number {
  if (t.outer) return durationValue(t.outer.duration) * (t.outer.multiple ?? 2);
  const first = t.content[0];
  return first ? durationValue(first.duration) : 0.25;
}

/** A tuplet's real metric time: its `outer` value (duration × multiple). */
export function tupletDuration(t: MnxTuplet): number {
  return durationValue(t.outer.duration) * (t.outer.multiple ?? 1);
}

/**
 * Density clamp: enough range to be useful, bounded so a bad value cannot
 * produce a plan the justifier then has to rescue.
 *
 * `MIN_DENSITY` is a LEGIBILITY floor, not a collision floor — and the
 * distinction is load-bearing (core-zoom-density-pad.md, ruling 1). Density
 * scales the springs and never the rigid columns, so no value here can make
 * two glyphs overlap; at the bottom of the range they simply abut. A control
 * offering this axis should show the floor rather than compute one.
 *
 * Exported because the clamp used to be silent: a host asking for 0.2 got 0.5
 * and was never told. A control has to know where the wall is to say it is
 * against it.
 *
 * **Retuned 0.5 → 0.02 on 2026-08-15**, the retune ruling 1 of
 * core-zoom-density-pad.md explicitly reserved for its own evidence rather
 * than letting it ride in on a control. Measured on `twelve-bar-blues` at the
 * workbench's own line width: 0.5 and 0.25 both pack it into three systems,
 * 0.1 into **two**, and 0.02 puts a **seventh bar on the first system**. Each
 * of those is a whole page-turn's worth of music, so the old floor was
 * bounding the *control*, not legibility.
 *
 * 0.02 is where PACKING bottoms out, and that is the number this constant is
 * chosen against: springs shrink, rigid columns do not, so a line ends up
 * holding every bar its notehead columns will fit and no lower value adds
 * another. On `twelve-bar-blues` at 80sp that limit is nine bars on the first
 * system, reached at 0.02 and unchanged at a quarter of it — asserted in
 * `zoom-density.test.ts`.
 *
 * Below that the knob is not inert — and this is the honest reason a floor is
 * still needed rather than none at all. What keeps changing is *raggedness*:
 * once a row's springs are this short they can no longer stretch to the right
 * margin within `MAX_STRETCH`, so tightening further just draws the same bars
 * narrower and leaves more white at the end of the system. The density ladder
 * duly reports those values as distinct, because they are — they simply are
 * not worth offering.
 *
 * The other cost at the bottom is *proportional* notation: springs carry
 * duration, so squeezing them squeezes the difference between a quarter's
 * space and an eighth's. Below ~0.2 that difference stops being legible and
 * rhythm is read from noteheads and beams. That is a trade a reader on a
 * tablet may want to make, and not one a constant should make for them. The
 * collision guarantee is untouched at any value — asserted at the floor and
 * below it in `zoom-density.test.ts`.
 */
/**
 * **Ceiling raised 2 → 8 on 2026-08-21, alongside the staff-scale ceiling, for
 * low-vision readers.** The floor's retune note above is about how far the
 * knob keeps *packing*; this end is about how far it keeps *spreading*, and
 * the honest answer is "until a system holds one bar, then no further" — a
 * line cannot hold fewer than one bar, and inside a line the justifier
 * normalizes what density did. So on a long score the top of this range is
 * inert, the ladder reports it as inert, and the pad's arm greys out; on a
 * score short enough to sit against `MAX_STRETCH` it keeps spreading all the
 * way. Both are honest, and neither is a reason for the CONSTANT to stop
 * short of what some score can use. Measured on `twelve-bar-blues` at the
 * workbench's own line width: the old ceiling of 2 left three bars on a
 * system, and 4 is where it reaches one.
 */
export const MIN_DENSITY = 0.02;
export const MAX_DENSITY = 8;

export function clampDensity(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.min(MAX_DENSITY, Math.max(MIN_DENSITY, value));
}

/**
 * Ink-ratio guard: a bad value degrades to square rather than throwing. No
 * range clamp — the ratio is derived by the renderers from two scales the
 * engine already bounded (`clampStaffScale`, the fit), so any finite positive
 * value is one the emitter is genuinely about to draw at.
 */
export function clampInkRatio(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

// ---------- System packing (shared with the density ladder) ----------

/**
 * One packable measure, captured at density 1: every number the system packer
 * reads, and nothing else.
 *
 * Split out because the packer has a second caller. `densityLadder` re-packs
 * the same score at other densities to find the values that actually change
 * the engraving; doing that by re-planning would mean re-deriving every event
 * column, and doing it with a second copy of the packing arithmetic would mean
 * two implementations of the one thing this module exists to own.
 */
export interface MeasurePack {
  /** Index into `plan.measures` — packable measures are not contiguous. */
  index: number;
  /** Prefix width as the first measure of a system (clef/key/time all shown). */
  prefixFirst: number;
  /** Prefix width mid-system (only what this measure itself declares). */
  prefixRest: number;
  rigid: number;
  /** Σ springs at density 1 — the packer applies the multiplier. */
  spring: number;
  /** Barline→first-event spring at density 1. */
  lead: number;
  repeatExtra: number;
  forcedBreak: boolean;
}

export interface PackingInput {
  measures: MeasurePack[];
  lineWidthSp: number;
  /** Trailing pad after a measure's content. Carried rather than read from the
   *  module constant because `densityPad` scales it, and the packer must use
   *  the same width the placement pass will. Absent ⇒ the unscaled default,
   *  which is what a ladder re-pack at density 1 wants. */
  contentRightPadSp?: number;
}

export interface PackedRow {
  /** Positions within `PackingInput.measures`, in system order. */
  measures: number[];
  /** The row's common spring factor (justification), already clamped. */
  stretch: number;
  /**
   * This row ended because the next bar did not FIT — it holds as much music
   * as the line can take. A row ended by a forced break, and the last row of
   * the score, are not full: they hold what they were given.
   *
   * The distinction is what `MAX_STRETCH` should always have been asking. A
   * full row that cannot reach the margin is not "ragged by choice", it is a
   * justified row being denied its justification.
   */
  full: boolean;
}

/**
 * Greedy system packing plus each row's justification factor — the whole of
 * "which bars land on which line, and how hard are their springs stretched".
 *
 * Arithmetic here is written to match `planHorizontal`'s own passes term for
 * term and in the same order: this function REPLACED that code rather than
 * paralleling it, and the corpus goldens are the assertion that it did so
 * without moving a single coordinate.
 */
export function packSystems(packing: PackingInput, densityH: number): PackedRow[] {
  const packs = packing.measures;
  const lineWidth = packing.lineWidthSp;
  const contentRightPad = packing.contentRightPadSp ?? CONTENT_RIGHT_PAD_SP;

  const rows: { measures: number[]; full: boolean }[] = [];
  let current: number[] = [];
  let currentWidth = 0;
  packs.forEach((m, k) => {
    const content =
      m.lead * densityH + m.rigid + m.spring * densityH + contentRightPad + m.repeatExtra;
    const natural = (current.length === 0 ? m.prefixFirst : m.prefixRest) + content;
    // Which of the two reasons ended the row is recorded, not just that one
    // did: only the overflow reason means the row is FULL.
    const overflows = currentWidth + natural > lineWidth;
    if (current.length > 0 && (overflows || m.forcedBreak)) {
      rows.push({ measures: current, full: overflows });
      current = [];
      currentWidth = m.prefixFirst + content;
    } else {
      currentWidth += natural;
    }
    current.push(k);
  });
  // The score simply ran out: the last row holds what was left, not what fits.
  if (current.length > 0) rows.push({ measures: current, full: false });

  const wanted = rows.map(({ measures, full }) => {
    let rowRigid = 0;
    let rowSpring = 0;
    measures.forEach((k, j) => {
      const m = packs[k];
      rowRigid +=
        (j === 0 ? m.prefixFirst : m.prefixRest) + m.rigid + contentRightPad + m.repeatExtra;
      rowSpring += m.spring * densityH + m.lead * densityH;
    });
    return { measures, full, stretch: rowStretch(lineWidth - rowRigid, rowSpring) };
  });
  const capped = justifyRows(wanted);
  return wanted.map((r, i) => ({ measures: r.measures, stretch: capped[i], full: r.full }));
}

/**
 * The last row may not be stretched looser than the loosest other row on the
 * page (roadmap/complete/core-ragged-last.md).
 *
 * Justification exists to reach the right margin, and a sparse final system
 * cannot: it computes a huge stretch, hits `MAX_STRETCH`, and is drawn at 2.5×
 * the note spacing of every row above it while still stopping short. The cap
 * was keeping one bar from spanning the page; it was not keeping the page
 * consistent. Rather than a `ragged-last` fill threshold — a constant, and a
 * flip point under resize — the ceiling is read off the score itself:
 * `min(computed, max(1, …others))`. Rows that reach the margin at 1.1 set the
 * leftovers at 1.1, which is what "consistent spacing" means.
 *
 * Floored at 1 because compression (stretch < 1) is a necessity the full rows
 * were forced into, not a texture to propagate. Only ever LOWERS a stretch, so
 * `MIN_SQUEEZE` still governs an overfull last row. Scoped to two or more rows:
 * one system is not a page, has nothing to disagree with, and keeps today's
 * justification — which is also what confines the golden churn to
 * multi-system scenarios.
 */
export function capLastRowStretch(stretches: readonly number[]): number[] {
  if (stretches.length < 2) return [...stretches];
  const others = stretches.slice(0, -1);
  const last = stretches[stretches.length - 1];
  return [...others, Math.min(last, Math.max(1, ...others))];
}

/**
 * One row's justification factor.
 *
 * `MAX_STRETCH` exists so that a SPARSE row — one stranded bar — does not
 * spread itself across the page. It was applied to every row, including rows
 * that are packed as tight as the line allows, and on those it is simply
 * wrong: a full row that cannot reach the right margin is a justified row
 * being denied its justification. It showed up as the music getting NARROWER
 * as the reader asked for more space (at staff scales below 100%, where the
 * rigid columns shrink and the springs have to supply more of the line, so the
 * needed stretch crosses 2.5): each time a bar wrapped away, the shortened row
 * still could not stretch to compensate.
 *
 * So the cap now applies only where its own reasoning does — to a row that was
 * given its bars rather than filled with them, which is the last row of a score
 * and any row ended by a forced break. `capLastRowStretch` then refines the
 * last row further, page-relatively.
 *
 * `MIN_SQUEEZE` is unconditional: an overfull row has to compress whatever
 * ended it.
 */
function rowStretch(slack: number, rowSpring: number): number {
  if (rowSpring <= 0) return 1;
  return Math.max(MIN_SQUEEZE, slack / rowSpring);
}

/**
 * The loosest FULL row on the page — the texture the reader is looking at —
 * or null when no row was filled.
 *
 * This is the ceiling for every row that was given its bars rather than filled
 * with them, and it replaces `MAX_STRETCH` in that job wherever a body exists.
 * `MAX_STRETCH` was answering "how far may a stranded bar spread?" with a
 * constant, and a constant cannot know what the rest of the page is doing: on a
 * LOOSE page — a narrow line, or the staff scaled up, where the full rows
 * stretch past 2.5 to reach the margin — the cap made the last system the
 * TIGHTEST thing on the page rather than the loosest, which is the opposite of
 * the failure it was written to prevent. Reading the ceiling off the page
 * cannot invert like that: the leftover row is spaced like the rows above it,
 * ragged at the right, which is what a final system is supposed to look like.
 *
 * It also removes a phantom the density control tripped over. A capped row's
 * `densityH × stretch` moves with density while every full row's is pinned by
 * justification, so at high staff scales the last system was the ONLY thing
 * density could still change — and `densityLadder` dutifully reported a rung
 * every 1%, i.e. a control full of steps that moved one stranded bar at the
 * bottom of a twelve-system page. Reported from use, 2026-08-21:
 * *"horizontal space 18, 14, 10 and 6 look near identical"*. They were.
 */
function bodyStretch(rows: readonly { full: boolean; stretch: number }[]): number | null {
  const full = rows.filter(r => r.full);
  return full.length === 0 ? null : Math.max(...full.map(r => r.stretch));
}

/**
 * Every row's final stretch: full rows get what justification asks for, and
 * the rows that were given their bars get the page's texture as a ceiling,
 * then the page-relative last-row rule on top.
 *
 * Exported-shaped (module-internal) because there are two callers and they
 * MUST agree — `packSystems` for the square path, and `planHorizontal`'s
 * ink-ratio re-run, which redoes the same arithmetic over scaled metrics with
 * the same row membership. Two copies of this rule is exactly the drift this
 * module exists to prevent.
 */
function justifyRows(rows: readonly { full: boolean; stretch: number }[]): number[] {
  const ceiling = bodyStretch(rows) ?? MAX_STRETCH;
  return capLastRowStretch(
    rows.map(r => (r.full ? r.stretch : Math.max(MIN_SQUEEZE, Math.min(r.stretch, ceiling))))
  );
}

// ---------- The density ladder ----------

/**
 * Grid the ladder is scanned on: 1% of the density range. Finer than any step
 * a control offers, so no distinct engraving can hide between two grid points.
 */
const LADDER_GRID = 100;

/** The same grid as a density INCREMENT — exported because a control walking
 *  the ladder needs it to name a run's top edge: run i is
 *  `[ladder[i], ladder[i + 1] - DENSITY_GRID]`. */
export const DENSITY_GRID = 1 / LADDER_GRID;

/**
 * What a density value actually DRAWS, compressed to a string.
 *
 * Two densities engrave identically iff they pack the same bars onto the same
 * lines AND agree on `densityH × stretch` — because every horizontal
 * coordinate downstream is `spring × densityH × stretch`. That product is the
 * whole subtlety, and it is why most density values are invisible: inside the
 * justifier's linear range, `stretch` is inversely proportional to `densityH`,
 * so the product — and therefore the engraving — is *exactly* unchanged.
 * Density only bites where it moves a barline to another system, or where a
 * row is against the `MAX_STRETCH` / `MIN_SQUEEZE` clamp and the proportion
 * breaks.
 *
 * Rounded to 1e-6, i.e. sub-1e-4-staff-space differences count as identical.
 */
export function packingSignature(
  packings: readonly PackingInput[],
  densityH: number
): string {
  return packings
    .map(p =>
      packSystems(p, densityH)
        .map(row => `${row.measures.join(',')}@${(densityH * row.stretch).toFixed(6)}`)
        .join('|')
    )
    .join(';');
}

/**
 * Every density value in `[MIN_DENSITY, MAX_DENSITY]` that engraves this score
 * differently from the one below it — ascending, always starting at
 * `MIN_DENSITY`.
 *
 * This is what lets a control step density and get a visible result every
 * time. Stepping by a fixed percentage does not: on a justified score most of
 * the range is degenerate (see `packingSignature`), so a reader clicks
 * *tighter* three times, sees nothing move, and concludes the control is
 * broken. It isn't — those clicks genuinely changed nothing.
 *
 * A rung is the LOW edge of its run: the tightest value that draws that
 * particular engraving. Cheap enough to compute on demand — it re-packs a
 * ready-made input ~176 times and never re-derives an event column — but a
 * host should cache it per render, since it changes with the viewport.
 */
export function densityLadder(packings: readonly PackingInput[]): number[] {
  const steps: number[] = [];
  let previous: string | null = null;
  for (let n = MIN_DENSITY * LADDER_GRID; n <= MAX_DENSITY * LADDER_GRID; n++) {
    const densityH = n / LADDER_GRID;
    const signature = packingSignature(packings, densityH);
    if (signature !== previous) {
      steps.push(densityH);
      previous = signature;
    }
  }
  return steps;
}

/**
 * Which bars landed on which system row, as MEASURE indices — the packing
 * answering a question about itself.
 *
 * `PackedRow.measures` indexes `PackingInput.measures`, which skips hidden and
 * out-of-range bars, so the ordinals it carries are not measure numbers. The
 * selection ladder's measure rung navigates systems (roadmap/inprogress/
 * core-selection-ladder.md), and `src/edit` may import only `src/model` — so
 * "the score, wrapped into lines" has to reach the editor as data, from the
 * layer that decided the wrap. Reads `packSystems` rather than restating it,
 * for the reason the density ladder does: two copies of the packing arithmetic
 * is exactly what this module exists to prevent.
 */
export function packedRowMeasures(
  packings: readonly PackingInput[],
  densityH: number
): number[][] {
  return packings.flatMap(packing =>
    packSystems(packing, densityH).map(row => row.measures.map(k => packing.measures[k].index))
  );
}

/**
 * The nearest bar one system away, preserving the COLUMN — text-editor line
 * navigation over the bar-wrap grid, which is exactly what the measure rung's
 * ↑↓ means. A shorter neighbouring row clamps to its last bar rather than
 * refusing, the way a cursor lands at the end of a short line.
 *
 * Null when there is no such row (the first system going up, the last going
 * down) or when the measure is in none — a bar the layout never packed is one
 * the reader cannot see, so there is nothing to move from.
 */
export function neighbourSystemMeasure(
  rows: readonly (readonly number[])[],
  measureIndex: number,
  delta: 1 | -1
): number | null {
  const row = rows.findIndex(r => r.includes(measureIndex));
  if (row < 0) return null;
  const target = rows[row + delta];
  if (!target || target.length === 0) return null;
  const column = rows[row].indexOf(measureIndex);
  return target[Math.min(column, target.length - 1)];
}

/** Ideal space after a note: log2 in duration so long notes are compressed. */
function springSp(duration: number): number {
  if (duration <= 0) return MIN_SPRING_SP;
  return Math.max(
    MIN_SPRING_SP,
    QUARTER_SPRING_SP * (1 + SPRING_LOG_FACTOR * Math.log2(duration / 0.25))
  );
}

// ---------- Accidental visibility (shared with the notation renderer) ----------

// Steps altered by sharp keys, in signature order; flat keys take the reverse.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

/** The alteration a key signature applies to a step (e.g. F → +1 in G major). */
export function keyAlterForStep(step: string, fifths: number): number {
  const idx = SHARP_ORDER.indexOf(step.toUpperCase());
  if (fifths > 0) return idx < fifths ? 1 : 0;
  if (fifths < 0) return idx >= SHARP_ORDER.length + fifths ? -1 : 0;
  return 0;
}

function alterGlyph(alter: number): string | null {
  if (alter === 0) return 'accidentalNatural';
  if (alter === 1) return 'accidentalSharp';
  if (alter === -1) return 'accidentalFlat';
  if (alter === 2) return 'accidentalDoubleSharp';
  if (alter === -2) return 'accidentalDoubleFlat';
  return null;
}

/**
 * Decides whether one note shows an accidental, honoring MNX's explicit
 * visibility model: `accidentalDisplay.show` always wins (`true` prints the
 * glyph for the note's alter — a natural when there is none), and a document
 * that declares `support.useAccidentalDisplay` has opted out of renderer
 * inference entirely, so unmarked notes show nothing. The inference fallback
 * shows an accidental iff the alter departs from the key signature (a natural
 * when the key alters the step but the note is unaltered). Within-measure
 * accidental carryover is not modeled yet.
 */
export function noteAccidentalGlyph(
  note: MnxNote,
  useAccidentalDisplay: boolean,
  keyFifths: number
): string | null {
  const show = note.accidentalDisplay?.show;
  if (show === true) return alterGlyph(note.pitch.alter ?? 0);
  if (show === false) return null;
  if (useAccidentalDisplay) return null;
  const alter = note.pitch.alter ?? 0;
  return alter === keyAlterForStep(note.pitch.step, keyFifths) ? null : alterGlyph(alter);
}

// ---------- Tuplet columns (shared with the notation renderer) ----------

export interface TupletColumn {
  /** Accidental room before the notehead. */
  leading: number;
  /** Full column width: leading + core (+ dots) + scaled duration space. */
  advance: number;
}

/**
 * Column geometry of a tuplet's inner events — all rigid (the duration space
 * is pre-scaled by outer/inner, so a quarter inside a triplet still gets more
 * room than its eighths). The renderer places inner notes with the same
 * columns; keep the two in lockstep by computing them only here.
 */
export function tupletColumns(
  t: MnxTuplet,
  useAccidentalDisplay: boolean,
  keyFifths: number
): TupletColumn[] {
  const innerSum = t.content.reduce(
    (sum, e) => sum + (isTimedEvent(e) ? durationValue(e.duration) : 0),
    0
  );
  const scale = innerSum > 0 ? tupletDuration(t) / innerSum : 1;
  return t.content.map(e => {
    if (!isTimedEvent(e)) return { leading: 0, advance: CORE_SP };
    const accidentals = (e.notes ?? []).filter(
      n => noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths) !== null
    ).length;
    const leading = accidentals
      ? accidentals * ACCIDENTAL_SLOT_WIDTH_SP + ACCIDENTAL_RIGHT_PAD_SP
      : 0;
    return {
      leading,
      advance:
        leading +
        CORE_SP +
        (e.duration.dots ?? 0) * DOT_SP +
        springSp(durationValue(e.duration) * scale)
    };
  });
}

// ---------- The plan ----------

export interface ActiveClef {
  sign: 'G' | 'F' | 'C';
  octave: number; // MNX clef.octave: -1 = sounds 8vb, +1 = sounds 8va
  /** MNX `clef.staffPosition`: half-spaces from the middle line, up positive
   *  — the line the glyph pinches. Absent = the sign's conventional line
   *  (G −2, F +2, C 0), which is what the engine assumed for every clef
   *  before the C clef arrived (core-measure-attributes-gaps.md). */
  staffPosition?: number;
}

export interface EventSlot {
  /** Notehead / fret-column centre, absolute x in sp. */
  x: number;
}

/** A clef taking effect mid-measure, at metric onset `t` (whole-note fraction). */
export interface ClefAt {
  t: number;
  clef: ActiveClef;
}

export interface MeasurePlan {
  row: number;
  firstInSystem: boolean;
  /** Left edge of the measure; the end barline sits at x + width. */
  x: number;
  width: number;
  /** Prefix glyph anchors (only meaningful when the matching show* is true). */
  clefX: number;
  keySigX: number;
  timeSigCentreX: number;
  contentStartX: number;
  clef: ActiveClef;
  showClef: boolean;
  timeSig: { count: number; unit: number; display?: 'common' | 'cut' };
  showTimeSig: boolean;
  keyFifths: number;
  cancelledKeyFifths: number;
  showKeySig: boolean;
  /** Collapsed into a preceding multimeasure rest — draw nothing. */
  hidden: boolean;
  /** This measure stands in for `multiRest` collapsed measures (H-bar). */
  multiRest: number | null;
  /** Per voice (staff-1 sequences, document order), per event: column slot.
   *  Alias of `staves[0]` — staff-1-only consumers (tab) read this. */
  voices: EventSlot[][];
  /** Per staff (0-based), per voice, per event: column slot. */
  staves: EventSlot[][][];
  /**
   * Clefs active through the measure: entry 0 is the start clef (t = 0),
   * later entries are mid-measure changes. An event's effective clef is the
   * last entry at or before its onset. Alias of `clefTimelines[0]`.
   */
  clefTimeline: ClefAt[];
  /** Per staff (0-based) clef timelines. */
  clefTimelines: ClefAt[][];
  /** Where to draw each mid-measure clef change (glyph anchor x); staff is 1-based. */
  clefChanges: { x: number; clef: ActiveClef; staff: number }[];
  /** Forward repeat (`|:`) — drawn at repeatStartX, room already reserved. */
  repeatStart: boolean;
  repeatStartX: number;
  /** Backward repeat (`:|`) at the end barline, with optional play count. */
  repeatEnd: { times?: number } | null;
  /** Content this measure carries that the plan couldn't honour (forgiving
   *  render): unsupported item kinds, or errors swallowed per event. */
  issues: string[];
}

/** A part's contiguous run of staves within the flattened staff list. */
export interface StaffGroup {
  partIndex: number;
  start: number;
  count: number;
}

export interface HorizontalPlan {
  measures: MeasurePlan[];
  rowCount: number;
  /** Total staves per system, flattened across all laid-out parts. */
  numStaves: number;
  /** Which flattened staves belong to which part. */
  staffGroups: StaffGroup[];
  /** Right edge of the widest system plus the page margin, ≤ widthSp. */
  usedWidthSp: number;
  /** This plan's packing input, at density 1 — enough to ask what ANOTHER
   *  density would draw without planning it (`densityLadder`). */
  packing: PackingInput;
  /** The ink ratio this plan was priced at (clamped; 1 = square). Layouts
   *  read it back for the few glyph-run advances they draw inside a column
   *  (the key-signature run), so drawn runs fill the columns priced here. */
  inkRatio: number;
}

/** One contributor to a rendered staff: a part-staff, optionally with a
 *  forced stem direction (layout source `stem`). */
export interface StaffSource {
  part: MnxPart;
  staff: number;
  stem?: 'up' | 'down';
}

/** A rendered staff: one or more sources merged onto the same five lines. */
export interface PlanStaff {
  sources: StaffSource[];
}

/** A voice to draw on a staff: the sequence plus any forced stem direction. */
export interface ResolvedVoice {
  seq: MnxSequence;
  stem: 1 | -1 | null;
}

/**
 * The voices a staff carries in one measure. Multiple stem-less sources whose
 * rhythms align chord-merge into a single voice (the layout "chorded" style);
 * otherwise each source contributes its sequences as separate voices.
 * Both spacing and the renderer call this — they must agree.
 */
export function resolveStaffVoices(spec: PlanStaff, measureIndex: number): ResolvedVoice[] {
  const gathered: ResolvedVoice[] = [];
  for (const src of spec.sources) {
    const pm = src.part.measures[measureIndex] ?? { sequences: [] };
    for (const seq of staffSequencesOf(pm.sequences, src.staff)) {
      gathered.push({ seq, stem: src.stem === 'up' ? 1 : src.stem === 'down' ? -1 : null });
    }
  }
  if (spec.sources.length >= 2 && gathered.length >= 2 && gathered.every(g => g.stem === null)) {
    const merged = tryChordMerge(gathered.map(g => g.seq));
    if (merged) return [{ seq: merged, stem: null }];
  }
  return gathered;
}

/** Column width a syllable needs (the widest of the event's lyric lines). */
function lyricCoreSp(event: { lyrics?: { lines?: Record<string, { text: string }> } }): number {
  const lines = event.lyrics?.lines;
  if (!lines) return 0;
  let w = 0;
  for (const line of Object.values(lines)) {
    w = Math.max(w, line.text.length * LYRIC_CHAR_WIDTH_SP + 2 * LYRIC_SIDE_PAD_SP);
  }
  return w;
}

/** Merges rhythm-aligned sequences into one chorded sequence, or null. */
function tryChordMerge(seqs: MnxSequence[]): MnxSequence | null {
  const n = seqs[0].content.length;
  for (const s of seqs) {
    if (s.content.length !== n || s.fullMeasure) return null;
  }
  const content: MnxSequenceItem[] = [];
  for (let e = 0; e < n; e++) {
    const items = seqs.map(s => s.content[e]);
    const first = items[0];
    if (!isTimedEvent(first) || first.rest) return null;
    const notes = [...(first.notes ?? [])];
    for (const item of items.slice(1)) {
      if (!isTimedEvent(item) || item.rest) return null;
      if (
        item.duration.base !== first.duration.base ||
        (item.duration.dots ?? 0) !== (first.duration.dots ?? 0)
      ) {
        return null;
      }
      notes.push(...(item.notes ?? []));
    }
    content.push({ ...first, notes });
  }
  return { content };
}

export interface PlanOptions {
  /** Parts to lay out, stacked top-to-bottom (default: the first part). */
  parts?: MnxPart[];
  /** Explicit staff specs (from a layout) — overrides `parts` expansion. */
  staves?: PlanStaff[];
  /** Extra left room (staff labels / group brackets), inside the margin. */
  leftInsetSp?: number;
  /** Multimeasure-rest collapses: `count` measures from `startIndex` shown as
   *  one H-bar measure (the tail measures become hidden stubs). */
  collapse?: { startIndex: number; count: number }[];
  /** Measure indexes that must start a new system. */
  forcedBreaks?: ReadonlySet<number>;
  /**
   * HORIZONTAL DENSITY (roadmap/complete/core-render-density-zoom.md): a
   * multiplier on the springs — the *stretchy* part of the plan — where 1 is
   * today's engraving, <1 packs more bars per system and >1 opens it out.
   *
   * Springs only, never the rigid columns: a notehead, an accidental stack
   * and a clef occupy the width they occupy at a given staff size, so
   * squeezing THEM would be shrinking the music rather than tightening it.
   * That is what keeps this axis independent of zoom — density changes how
   * much air sits between glyphs; zoom changes how big the glyphs are.
   */
  densityH?: number;
  /**
   * FRAME DENSITY (roadmap/complete/core-vertical-density.md): a multiplier on
   * the fixed whitespace a page reserves rather than on the music inside it.
   * Horizontally that is the page margin either side of a system — the only
   * width on the line that is neither a spring nor a rigid column, and so the
   * only one this axis may touch.
   *
   * Floored at `MIN_PAGE_MARGIN_SP`: a system flush against the viewport edge
   * reads as clipped rather than as tight.
   */
  densityPad?: number;
  /**
   * INK RATIO (roadmap/proposed/core-ink-priced-columns.md): the emitter's
   * `pxPerSpY / pxPerSp` — how much wider than square this plan's glyphs will
   * be DRAWN. Rigid columns are ink (a clef occupies the width it occupies at
   * a given staff size), so under a non-square staff scale they are priced on
   * the ink scale: every rigid ink contribution — cores, accidental slots,
   * dots, grace/tremolo advances, mid-clef columns, the prefix glyph slots —
   * is multiplied by this ratio, and the justifier hands the difference to or
   * takes it from the springs. Air (springs, pads, margins) and spans (the
   * multirest H-bar, `EMPTY_CONTENT_SP`) stay on the horizontal scale.
   *
   * PACKING STAYS SQUARE: line breaks are computed at ratio 1 and only
   * placement re-prices, so bars never jump between systems under the zoom
   * pad's vertical arm (core-zoom-density-pad.md ruling 2's substance). A row
   * whose scaled rigids alone overrun the line degrades the way overfull rows
   * always have — `MIN_SQUEEZE`, then ragged-right overflow — never
   * glyph-on-glyph. 1 (the default) skips every re-pricing branch.
   */
  inkRatio?: number;
  /**
   * What this plan is drawing for. `notation` (the default) reserves the
   * prefix a notation staff needs; `tab` is the STANDALONE tab view, which
   * draws no key signature at all and a narrower clef.
   *
   * Not a cosmetic switch — before it, a tab-only system in one sharp
   * reserved a key-signature column it had nothing to put in, and sized its
   * clef slot for a treble clef. On `twelve-bar-blues` that was 2.86sp of the
   * 10.07sp between the barline and the first fret number.
   *
   * The `both` view does NOT use this: there the tab staff shares a system
   * with a notation staff that really does draw a key signature, and the
   * columns have to agree. Only `layoutTab` passes it, which is exactly the
   * case where there is no notation staff to agree with.
   */
  staffKind?: 'notation' | 'tab';
  /** Only plan measures in [from, to] (inclusive); the rest become hidden
   *  stubs. Lets a score render each per-system layout as its own segment
   *  while plan.measures stays index-aligned with the document. */
  measureRange?: { from: number; to: number };
  /** Plan at least this many measures (synthetic empty bars for
   *  structure-only documents that encode none). */
  minMeasures?: number;
}

interface EventMetrics {
  leading: number; // rigid: mid-measure clefs + accidental columns
  core: number;    // rigid: notehead/fret + dots
  spring: number;  // stretchable: duration space
  /** Set on grace containers: number of inner notes (all rigid, no spring). */
  graceCount?: number;
  /** Mid-measure clefs drawn immediately before this event's column,
   *  referencing the measure's clefTimeline by index. */
  midClefs?: { timelineIndex: number; clef: ActiveClef }[];
}

interface MeasureMetrics {
  clef: ActiveClef;
  clefChanged: boolean;
  timeSig: { count: number; unit: number; display?: 'common' | 'cut' };
  timeSigShow: boolean;
  keyFifths: number;
  cancelledKeyFifths: number;
  keyChanged: boolean;
  /** Per staff (0-based), per voice: event metrics. */
  staves: EventMetrics[][][];
  /** Σ rigid / Σ spring of the governing (widest) voice across all staves. */
  rigid: number;
  spring: number;
  /** Spring between the barline (or prefix glyphs) and the first event. */
  leadingSpring: number;
  clefTimelines: ClefAt[][];
  hasRepeatStart: boolean;
  repeatEnd: { times?: number } | null;
  hidden: boolean;
  multiRest: number | null;
  issues: string[];
}

/** Sequences of one staff (1-based); staff-less sequences belong to staff 1. */
export function staffSequencesOf(
  sequences: MnxSequence[] | undefined,
  staff: number
): MnxSequence[] {
  return (sequences ?? []).filter(seq => (seq.staff ?? 1) === staff);
}

/** Staff-1 sequences — the filter single-staff consumers (tab) draw from. */
export function staffOneSequences(sequences: MnxSequence[] | undefined): MnxSequence[] {
  return staffSequencesOf(sequences, 1);
}

/** Σ springs of a voice, the last event's discounted by MEASURE_TRAIL_FACTOR
 *  (its duration space ends at the barline, not at another attack). */
function voiceSpringSum(voice: EventMetrics[]): number {
  return voice.reduce(
    (sum, e, i) => sum + e.spring * (i === voice.length - 1 ? MEASURE_TRAIL_FACTOR : 1),
    0
  );
}

export function planHorizontal(
  mnx: MnxStructure,
  widthSp: number,
  options?: PlanOptions
): HorizontalPlan {
  const parts = options?.parts ?? (mnx.parts?.[0] ? [mnx.parts[0]] : []);

  // Flattened staves: explicit layout staff specs, or each part contributing
  // its staves in order, recorded as a contiguous group (the renderer draws
  // braces/barlines per group).
  const staffGroups: StaffGroup[] = [];
  let planStaves: PlanStaff[];
  if (options?.staves) {
    planStaves = options.staves;
    staffGroups.push({ partIndex: 0, start: 0, count: planStaves.length });
  } else {
    planStaves = [];
    parts.forEach((part, partIndex) => {
      let n = Math.max(1, part.staves ?? 1);
      for (const pm of part.measures) {
        for (const seq of pm.sequences ?? []) n = Math.max(n, seq.staff ?? 1);
      }
      staffGroups.push({ partIndex, start: planStaves.length, count: n });
      for (let s = 1; s <= n; s++) planStaves.push({ sources: [{ part, staff: s }] });
    });
  }
  if (planStaves.length === 0) {
    return {
      measures: [], rowCount: 0, numStaves: 1, staffGroups: [], usedWidthSp: widthSp,
      packing: { measures: [], lineWidthSp: widthSp }, inkRatio: 1
    };
  }

  const useAccidentalDisplay = mnx.mnx?.support?.useAccidentalDisplay === true;
  const leftInset = options?.leftInsetSp ?? 0;
  const padK = clampPadDensity(options?.densityPad);
  const marginSp = Math.max(MIN_PAGE_MARGIN_SP, MARGIN_SP * padK);
  // The prefix's PADS are whitespace and scale with the frame axis; the glyph
  // SLOTS are rigid and do not (core-zoom-density-pad.md ruling 1 — a clef
  // occupies the width it occupies at a given staff size). This is the line
  // between the two, and it is the whole reason the gap before the first note
  // used to ignore the spacing control entirely: every part of it was on the
  // rigid side, including the parts that were only ever air.
  const pad = (full: number) => Math.max(MIN_GLYPH_CLEAR_SP, full * padK);
  const isTabOnly = options?.staffKind === 'tab';
  const clefWidth = isTabOnly ? TAB_CLEF_WIDTH_SP : CLEF_WIDTH_SP;
  const contentLeftPad = pad(CONTENT_LEFT_PAD_SP);
  const startBarlinePad = pad(START_BARLINE_PAD_SP);
  const keySigRightPad = pad(KEY_SIG_RIGHT_PAD_SP);
  const contentRightPad = pad(CONTENT_RIGHT_PAD_SP);
  const startX = marginSp + leftInset;
  const lineWidth = widthSp - 2 * marginSp - leftInset;
  const forcedBreaks = options?.forcedBreaks ?? new Set<number>();

  // Multimeasure-rest collapses: the start measure becomes an H-bar stand-in,
  // the tail measures hidden stubs.
  const multiRestAt = new Map<number, number>();
  const hiddenIdx = new Set<number>();
  for (const c of options?.collapse ?? []) {
    if (c.count < 2) continue;
    multiRestAt.set(c.startIndex, c.count);
    for (let k = c.startIndex + 1; k < c.startIndex + c.count; k++) hiddenIdx.add(k);
  }
  const range = options?.measureRange;
  const inRange = (i: number) => !range || (i >= range.from && i <= range.to);

  const sourceParts = [...new Set(planStaves.flatMap(st => st.sources.map(src => src.part)))];
  const numStaves = planStaves.length;
  const numMeasures = Math.max(
    mnx.global.measures.length,
    options?.minMeasures ?? 0,
    ...sourceParts.map(p => p.measures.length)
  );

  // A merged staff's clef follows its LAST source: layout sources list voices
  // top-down, and engraving convention gives a shared staff the clef suiting
  // the bottom voice (tenor+bass share a bass-clef staff). MNX itself is
  // silent — neither the layout staff node nor staff-source carries a clef.
  const clefSourceOf = (st: PlanStaff): StaffSource => st.sources[st.sources.length - 1];

  // Pass 1 — per-measure state machine + natural event metrics.
  const clefState: ActiveClef[] = planStaves.map(st => {
    const src = clefSourceOf(st);
    if ((src.part.name ?? '').toLowerCase().includes('guitar')) {
      return { sign: 'G' as const, octave: -1 };
    }
    // An undeclared clef on a lower staff of a multi-staff part defaults to
    // bass — the keyboard/harp grand-staff convention. Declared clefs (the
    // usual case) replace this at measure 0.
    if (src.staff >= 2) return { sign: 'F' as const, octave: 0 };
    return { sign: 'G' as const, octave: 0 };
  });
  let timeSig: { count: number; unit: number; display?: 'common' | 'cut' } = { count: 4, unit: 4 };
  let timeDeclared = false;
  let keyFifths = 0;
  const metrics: MeasureMetrics[] = Array.from({ length: numMeasures }, (_, i) => {
    const globalMeasure = mnx.global.measures[i] ?? {};

    let clefChanged = false;
    // Per flattened staff: all its clefs by metric onset (read from its OWN
    // part's measure). A position-less clef applies at the start of the
    // measure; positioned ones (clef-changes example) take effect mid-bar and
    // get their own small glyph + rigid column.
    const clefTimelines: ClefAt[][] = [];
    for (let s = 0; s < numStaves; s++) {
      const src = clefSourceOf(planStaves[s]);
      const partMeasureOf = src.part.measures[i] ?? { sequences: [] };
      const current = clefState[s];
      const measureClefs: ClefAt[] = (partMeasureOf.clefs ?? [])
        .filter(c => (c.staff ?? 1) === src.staff && c.clef)
        .map(c => {
          const sign = (c.clef.sign ?? 'G').toUpperCase() as ActiveClef['sign'];
          // If MNX omits octave, preserve the current octave when sign matches
          // (so the guitar 8vb default isn't lost to a declaration of plain G).
          const oct = c.clef.octave ?? (sign === current.sign ? current.octave : 0);
          const f = c.position?.fraction;
          const t = Array.isArray(f) && f[1] ? f[0] / f[1] : 0;
          return {
            t,
            clef: {
              sign,
              octave: oct,
              ...(c.clef.staffPosition !== undefined ? { staffPosition: c.clef.staffPosition } : {})
            }
          };
        })
        .sort((a, b) => a.t - b.t);

      const startClef = measureClefs.find(c => c.t <= ONSET_EPS);
      if (
        startClef &&
        (startClef.clef.sign !== current.sign ||
          startClef.clef.octave !== current.octave ||
          startClef.clef.staffPosition !== current.staffPosition)
      ) {
        clefState[s] = startClef.clef;
        if (i > 0) clefChanged = true;
      }
      const timeline: ClefAt[] = [
        { t: 0, clef: clefState[s] },
        ...measureClefs.filter(c => c.t > ONSET_EPS)
      ];
      clefTimelines.push(timeline);
      // The running state for following measures is the LAST clef of this bar.
      clefState[s] = timeline[timeline.length - 1].clef;
    }

    // A time signature draws only where the document declares one (at its
    // first declaration and on changes) — an undeclared meter is not 4/4
    // visually, it is unmarked (e.g. spec/system-layouts encodes none).
    let timeSigChanged = false;
    if (globalMeasure.time) {
      const { count, unit, display } = globalMeasure.time;
      if (!timeDeclared || count !== timeSig.count || unit !== timeSig.unit || display !== timeSig.display) {
        timeSig = { count, unit, display };
        if (i > 0) timeSigChanged = true;
      }
      timeDeclared = true;
    }
    const timeSigShow = (i === 0 && !!globalMeasure.time) || timeSigChanged;

    let keyChanged = false;
    let cancelledKeyFifths = 0;
    if (globalMeasure.key && globalMeasure.key.fifths !== keyFifths) {
      if (i > 0) {
        keyChanged = true;
        cancelledKeyFifths = keyFifths;
      }
      keyFifths = globalMeasure.key.fifths;
    }

    const issues: string[] = [];
    // Measure-level attributes this renderer does not draw yet say so on the
    // bar — the amber badge the rendering contract promises for a gap. Until
    // core-measure-attributes-gaps.md these were recorded only in prose, and
    // a verified empty staff read as a regression the moment something named
    // the attribute. One list, in one place, so "not drawn" is never silent.
    issues.push(...measureLevelGaps(globalMeasure, uniquePartsOf(planStaves).map(part => part.measures?.[i])));
    // Forgiving render: an item the model doesn't understand (or that throws)
    // degrades to a quarter-sized placeholder column and a measure diagnostic
    // — one bad item must not take down the whole score.
    const placeholder = (): EventMetrics => ({
      leading: 0,
      core: CORE_SP,
      spring: springSp(0.25)
    });
    // Dynamics widen their host column (centred under the notehead), so
    // adjacent wide marks (pppppp …) can't collide. Anchoring follows the
    // first staff's first voice — the same one the renderer draws them against.
    const dynamicCols = ((planStaves[0].sources[0].part.measures[i] ?? {}).dynamics ?? [])
      .filter(d => !d.staff || d.staff === 1)
      .map(d => {
        const f = d.position?.fraction;
        return {
          t: Array.isArray(f) && f[1] ? f[0] / f[1] : 0,
          w: dynamicWidthSp(d) + 2 * DYNAMIC_SIDE_PAD_SP
        };
      })
      .sort((a, b) => a.t - b.t);

    const collapsed = hiddenIdx.has(i);
    const multiRest = multiRestAt.get(i) ?? null;

    const staves: EventMetrics[][][] = [];
    for (let s = 0; s < numStaves; s++) {
      if (collapsed || multiRest) {
        // Collapsed measures carry no event columns — the start measure is a
        // fixed-width H-bar stand-in, the tail measures hidden stubs.
        staves.push([]);
        continue;
      }
      const midClefs = clefTimelines[s].slice(1);
      staves.push(
        resolveStaffVoices(planStaves[s], i).map(({ seq }, seqIndex) => {
          let onset = 0; // metric position within the bar, in whole-note fractions
          let nextMidClef = 0;
          let nextDynamic = 0;
          return seq.content.map((event): EventMetrics => {
            // A mid-measure clef takes effect before the first event at/after
            // its onset — that event's column gains the clef's rigid width.
            const midHere: NonNullable<EventMetrics['midClefs']> = [];
            while (nextMidClef < midClefs.length && midClefs[nextMidClef].t <= onset + ONSET_EPS) {
              midHere.push({ timelineIndex: nextMidClef + 1, clef: midClefs[nextMidClef].clef });
              nextMidClef++;
            }
            let dynamicWidth = 0;
            if (s === 0 && seqIndex === 0) {
              while (nextDynamic < dynamicCols.length && dynamicCols[nextDynamic].t <= onset + ONSET_EPS) {
                dynamicWidth = Math.max(dynamicWidth, dynamicCols[nextDynamic].w);
                nextDynamic++;
              }
            }
            const withColumnExtras = (m: EventMetrics): EventMetrics => {
              let out = m;
              if (dynamicWidth > out.core) out = { ...out, core: dynamicWidth };
              if (midHere.length) {
                out = { ...out, leading: out.leading + midHere.length * MID_CLEF_WIDTH_SP, midClefs: midHere };
              }
              return out;
            };
            try {
              if (isGrace(event)) {
                // Grace notes are un-timed: an all-rigid run of small columns
                // glued to the following event.
                return withColumnExtras({
                  leading: 0,
                  core: event.content.length * GRACE_NOTE_ADVANCE_SP + GRACE_RIGHT_PAD_SP,
                  spring: 0,
                  graceCount: event.content.length
                });
              }
              if (isTremolo(event)) {
                // Two written notes share one column (first head at the
                // slot, second TREMOLO_NOTE_ADVANCE_SP later); the real
                // metric time comes from `outer`.
                const dur = tremoloDuration(event);
                onset += dur;
                const accidentals = event.content
                  .flatMap(e => e.notes ?? [])
                  .filter(n => noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths) !== null)
                  .length;
                return withColumnExtras({
                  leading: accidentals
                    ? accidentals * ACCIDENTAL_SLOT_WIDTH_SP + ACCIDENTAL_RIGHT_PAD_SP
                    : 0,
                  core: CORE_SP + TREMOLO_NOTE_ADVANCE_SP,
                  spring: springSp(dur)
                });
              }
              if (isTuplet(event)) {
                // Inner events get rigid columns with pre-scaled duration
                // space (tupletColumns); the real metric time is `outer`.
                onset += tupletDuration(event);
                return withColumnExtras({
                  leading: 0,
                  core: tupletColumns(event, useAccidentalDisplay, keyFifths)
                    .reduce((sum, c) => sum + c.advance, 0),
                  spring: 0
                });
              }
              if (sequenceItemKind(event) === 'unknown') {
                const t = (event as { type?: string }).type;
                issues.push(
                  t ? `unsupported content type "${t}" — not rendered` : 'unrecognized content item — not rendered'
                );
                onset += 0.25; // placeholder occupies a nominal quarter
                return withColumnExtras(placeholder());
              }
              onset += durationValue(event.duration);
              const accidentals = (event.notes ?? []).filter(
                n => noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths) !== null
              ).length;
              return withColumnExtras({
                leading: accidentals
                  ? accidentals * ACCIDENTAL_SLOT_WIDTH_SP + ACCIDENTAL_RIGHT_PAD_SP
                  : 0,
                // Wide syllables widen their column (centred under the note).
                core: Math.max(
                  CORE_SP + (event.duration.dots ?? 0) * DOT_SP,
                  lyricCoreSp(event)
                ),
                spring: springSp(durationValue(event.duration))
              });
            } catch (e) {
              issues.push((e as Error).message);
              onset += 0.25;
              return withColumnExtras(placeholder());
            }
          });
        })
      );
    }

    // The widest voice across ALL staves governs the measure's natural width.
    const allVoices = staves.flat();
    let rigid = multiRest ? MULTIREST_WIDTH_SP : collapsed ? 0 : EMPTY_CONTENT_SP;
    let spring = 0;
    for (const voice of allVoices) {
      const voiceRigid = voice.reduce((sum, e) => sum + e.leading + e.core, 0);
      const voiceSpring = voiceSpringSum(voice);
      if (voiceRigid + voiceSpring > rigid + spring) {
        rigid = voiceRigid;
        spring = voiceSpring;
      }
    }

    // The post-barline gap is a spring like any other, so it scales with the
    // bar's note spacing under justification. All voices share it — the
    // measure has a single event-start column. A leading grace group has no
    // spring of its own, so the gap borrows from the first timed event.
    const leadingSpring =
      MEASURE_LEAD_FACTOR *
      Math.max(0, ...allVoices.map(v => v.find(e => !e.graceCount)?.spring ?? 0));

    return {
      clef: clefTimelines[0][0].clef, clefChanged, timeSig, timeSigShow,
      keyFifths, cancelledKeyFifths, keyChanged,
      staves, rigid, spring, leadingSpring, clefTimelines,
      hasRepeatStart: !!globalMeasure.repeatStart,
      repeatEnd: globalMeasure.repeatEnd ?? null,
      hidden: collapsed,
      multiRest,
      issues
    };
  });

  // How many key-signature glyphs this measure's prefix draws — none ever, on
  // a standalone tab staff.
  const keySigGlyphs = (m: MeasureMetrics, firstInSystem: boolean) => {
    if (isTabOnly) return 0;
    const showKeySig = (firstInSystem && m.keyFifths !== 0) || m.keyChanged;
    if (!showKeySig) return 0;
    return Math.abs(m.keyFifths !== 0 ? m.keyFifths : m.cancelledKeyFifths);
  };

  // The prefix's PADS are air; its glyph SLOTS are ink and scale with the ink
  // ratio (`ink` = 1 for the packing input — packing stays square).
  const prefixWidth = (m: MeasureMetrics, firstInSystem: boolean, ink = 1) => {
    const showClef = firstInSystem || m.clefChanged;
    const showTimeSig = m.timeSigShow;
    const keySigCount = keySigGlyphs(m, firstInSystem);
    return (
      contentLeftPad +
      (firstInSystem ? startBarlinePad : 0) +
      (showClef ? clefWidth * ink : 0) +
      (keySigCount ? keySigCount * KEY_SIG_GLYPH_ADVANCE_SP * ink + keySigRightPad : 0) +
      (showTimeSig ? TIME_SIG_WIDTH_SP * ink : 0) +
      (m.hasRepeatStart ? REPEAT_START_WIDTH_SP * ink : 0)
    );
  };

  // The packer's input, captured BEFORE density is applied — the ladder needs
  // density-1 naturals to ask what any other value would draw.
  const packing: PackingInput = {
    lineWidthSp: lineWidth,
    contentRightPadSp: contentRightPad,
    measures: metrics.flatMap((m, i) =>
      m.hidden || !inRange(i)
        ? []
        : [{
            index: i,
            prefixFirst: prefixWidth(m, true),
            prefixRest: prefixWidth(m, false),
            rigid: m.rigid,
            spring: m.spring,
            lead: m.leadingSpring,
            repeatExtra: m.repeatEnd ? REPEAT_END_EXTRA_SP : 0,
            forcedBreak: forcedBreaks.has(i)
          }]
    )
  };

  // Horizontal density, applied ONCE here — after every spring is computed and
  // before anything reads one (roadmap/complete/core-render-density-zoom.md).
  // Scaling at the source would mean touching four springSp() call sites and
  // trusting them to stay in step; scaling at consumption would desync the
  // per-event cursor from the measure widths, since both read springs
  // independently. One pass over the finished metrics keeps every reader
  // consistent by construction.
  const densityH = clampDensity(options?.densityH);
  if (densityH !== 1) {
    for (const m of metrics) {
      m.spring *= densityH;
      m.leadingSpring *= densityH;
      for (const staff of m.staves) {
        for (const voice of staff) {
          for (const event of voice) event.spring *= densityH;
        }
      }
    }
  }

  // Ink pricing, applied the same way density is — one pass over the finished
  // metrics, after the packing input was captured (packing stays square) and
  // before placement reads anything. Rigid ink scales; air (springs, pads)
  // and spans (the H-bar, EMPTY_CONTENT_SP) do not.
  const inkRatio = clampInkRatio(options?.inkRatio);
  if (inkRatio !== 1) {
    for (const m of metrics) {
      for (const staff of m.staves) {
        for (const voice of staff) {
          for (const event of voice) {
            event.leading *= inkRatio;
            event.core *= inkRatio;
          }
        }
      }
      // Re-derive the governing rigid/spring pair exactly as pass 1 did —
      // the widest voice can legitimately change once rigids re-price.
      let rigid = m.multiRest ? MULTIREST_WIDTH_SP : m.hidden ? 0 : EMPTY_CONTENT_SP;
      let spring = 0;
      for (const voice of m.staves.flat()) {
        const voiceRigid = voice.reduce((sum, e) => sum + e.leading + e.core, 0);
        const voiceSpring = voiceSpringSum(voice);
        if (voiceRigid + voiceSpring > rigid + spring) {
          rigid = voiceRigid;
          spring = voiceSpring;
        }
      }
      m.rigid = rigid;
      m.spring = spring;
    }
  }

  // Pass 2 — greedy system packing on natural widths (hidden measures take no
  // slot; forced breaks from a score's `pages.systems` start new rows), plus
  // each row's justification factor. Both live in packSystems, so the density
  // ladder asks the same question of the same code.
  const packed = packSystems(packing, densityH);
  const rowIndicesOf = (packedRow: PackedRow) =>
    packedRow.measures.map(k => packing.measures[k].index);

  // Row stretches: the packer's square answer, or — under an ink ratio — the
  // same arithmetic re-run over the scaled metrics with the SAME (square) row
  // membership, then capped by the same last-row rule the packer applies.
  // This is where the springs hand width to the grown ink. At ratio 1 the
  // packer's numbers are reused untouched.
  let stretches = packed.map(r => r.stretch);
  if (inkRatio !== 1) {
    stretches = justifyRows(
      packed.map(packedRow => {
        let rowRigid = 0;
        let rowSpring = 0;
        rowIndicesOf(packedRow).forEach((i, j) => {
          const m = metrics[i];
          rowRigid +=
            prefixWidth(m, j === 0, inkRatio) + m.rigid + contentRightPad +
            (m.repeatEnd ? REPEAT_END_EXTRA_SP * inkRatio : 0);
          rowSpring += m.spring + m.leadingSpring;
        });
        // Same rule as the square path, through the same helper — this is the
        // path where the cap actually bit, since ink pricing below 100% staff
        // scale shrinks the rigid columns and pushes the needed stretch up.
        return { full: packedRow.full, stretch: rowStretch(lineWidth - rowRigid, rowSpring) };
      })
    );
  }

  // Pass 3 — place each row at its justified stretch.
  const measures: MeasurePlan[] = new Array(metrics.length);
  packed.forEach((packedRow, row) => {
    const rowIndices = rowIndicesOf(packedRow);
    const stretch = stretches[row];

    let x = startX;
    for (const i of rowIndices) {
      const m = metrics[i];
      const firstInSystem = i === rowIndices[0];
      const showClef = firstInSystem || m.clefChanged;
      const showTimeSig = m.timeSigShow;
      const keySigCount = keySigGlyphs(m, firstInSystem);

      const clefX = x + contentLeftPad + (firstInSystem ? startBarlinePad : 0);
      const keySigX = clefX + (showClef ? clefWidth * inkRatio : 0);
      const keySigWidth = keySigCount
        ? keySigCount * KEY_SIG_GLYPH_ADVANCE_SP * inkRatio + keySigRightPad
        : 0;
      const timeSigCentreX = keySigX + keySigWidth + (TIME_SIG_WIDTH_SP * inkRatio) / 2;
      // A forward repeat (|:) sits between the prefix glyphs and the content.
      const repeatStartX =
        keySigX + keySigWidth + (showTimeSig ? TIME_SIG_WIDTH_SP * inkRatio : 0);
      // Events start after the stretched leading spring — the same justified
      // breathing room every other gap in the bar gets.
      const contentStartX =
        repeatStartX + (m.hasRepeatStart ? REPEAT_START_WIDTH_SP * inkRatio : 0) +
        m.leadingSpring * stretch;

      const contentWidth = m.rigid + m.spring * stretch;
      const width =
        contentStartX - x + contentWidth + contentRightPad +
        (m.repeatEnd ? REPEAT_END_EXTRA_SP * inkRatio : 0);

      // Each voice fills the measure's content span with its own spring factor.
      // Mid-measure clef anchors come from the first voice of the staff that
      // reserved the column (its voices agree on the metric onset).
      const midClefXs = new Map<string, { x: number; clef: ActiveClef; staff: number }>();
      const staves = m.staves.map((staffVoices, s) =>
        staffVoices.map(voice => {
          const voiceRigid = voice.reduce((sum, e) => sum + e.leading + e.core, 0);
          const voiceSpring = voiceSpringSum(voice);
          const voiceStretch = voiceSpring > 0
            ? Math.max(0, (contentWidth - voiceRigid) / voiceSpring)
            : 1;
          let cursor = contentStartX;
          return voice.map((e): EventSlot => {
            (e.midClefs ?? []).forEach((mc, k) => {
              const key = `${s}:${mc.timelineIndex}`;
              if (!midClefXs.has(key)) {
                midClefXs.set(key, {
                  x: cursor + k * MID_CLEF_WIDTH_SP * inkRatio + MID_CLEF_LEFT_PAD_SP,
                  clef: mc.clef,
                  staff: s + 1
                });
              }
            });
            // Grace containers: x is the centre of the FIRST small column;
            // the renderer advances by GRACE_NOTE_ADVANCE_SP per inner note.
            const slotX =
              cursor + e.leading +
              ((e.graceCount ? GRACE_NOTE_ADVANCE_SP : CORE_SP) * inkRatio) / 2;
            cursor += e.leading + e.core + e.spring * voiceStretch;
            return { x: slotX };
          });
        })
      );

      measures[i] = {
        row,
        firstInSystem,
        x,
        width,
        clefX,
        keySigX,
        timeSigCentreX,
        contentStartX,
        clef: m.clef,
        showClef,
        timeSig: m.timeSig,
        showTimeSig,
        keyFifths: m.keyFifths,
        cancelledKeyFifths: m.cancelledKeyFifths,
        showKeySig: keySigCount > 0,
        voices: staves[0] ?? [],
        staves,
        clefTimeline: m.clefTimelines[0],
        clefTimelines: m.clefTimelines,
        clefChanges: [...midClefXs.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([, v]) => v),
        repeatStart: m.hasRepeatStart,
        repeatStartX,
        repeatEnd: m.repeatEnd,
        hidden: false,
        multiRest: m.multiRest,
        issues: m.issues
      };
      x += width;
    }
  });

  // Hidden measures (collapsed tails, out-of-range under measureRange) get
  // zero-width stubs anchored at their neighbour, so plan.measures stays
  // index-aligned with the document's measures.
  for (let i = 0; i < metrics.length; i++) {
    if (measures[i]) continue;
    let anchor = i - 1;
    while (anchor >= 0 && !measures[anchor]) anchor--;
    const at = measures[anchor];
    measures[i] = {
      row: at?.row ?? 0,
      firstInSystem: false,
      x: at ? at.x + at.width : startX,
      width: 0,
      clefX: 0,
      keySigX: 0,
      timeSigCentreX: 0,
      contentStartX: at ? at.x + at.width : startX,
      clef: metrics[i].clefTimelines[0][0].clef,
      showClef: false,
      timeSig: metrics[i].timeSig,
      showTimeSig: false,
      keyFifths: metrics[i].keyFifths,
      cancelledKeyFifths: 0,
      showKeySig: false,
      voices: [],
      staves: metrics[i].staves.map(() => []),
      clefTimeline: metrics[i].clefTimelines[0],
      clefTimelines: metrics[i].clefTimelines,
      clefChanges: [],
      repeatStart: false,
      repeatStartX: 0,
      repeatEnd: null,
      hidden: true,
      multiRest: null,
      issues: []
    };
  }

  const usedWidthSp = measures.length
    ? Math.max(...measures.map(m => m.x + m.width)) + marginSp
    : widthSp;
  return { measures, rowCount: packed.length, numStaves, staffGroups, usedWidthSp, packing, inkRatio };
}


/** The parts a plan's staves draw from, once each, in staff order. */
function uniquePartsOf(planStaves: PlanStaff[]): MnxPart[] {
  const seen = new Set<MnxPart>();
  for (const staff of planStaves) seen.add(staff.sources[staff.sources.length - 1]!.part);
  return [...seen];
}

/**
 * Measure-level attributes the engine does not engrave (yet). Each entry is a
 * renderer-gap issue for the bar. The list IS the census
 * (core-measure-attributes-gaps.md §"not rendered"): remove a line here when
 * the ink arrives, and the badge goes with it.
 */
export function measureLevelGaps(
  globalMeasure: MnxGlobalMeasure | undefined,
  partMeasures: readonly (MnxPartMeasure | undefined)[]
): string[] {
  const gaps: string[] = [];
  if ((globalMeasure?.tempos?.length ?? 0) > 1)
    gaps.push(`${globalMeasure!.tempos!.length} tempo marks — only the first is drawn`);
  if ((globalMeasure?._x?.mnxLab?.harmonies?.length ?? 0) > 0)
    gaps.push('chord symbols (harmonies) — not drawn');
  void partMeasures;
  return gaps;
}
