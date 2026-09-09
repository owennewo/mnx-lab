import {
  MnxGlobalMeasure,
  MnxSequence,
  isGrace,
  isTimedEvent,
  isTremolo,
  isTuplet
} from '../../model/mnx.ts';
import { Primitive, translatePrimitiveY } from '../primitives.ts';
import { glyphBBox } from '../smufl/smufl.ts';
import { computeBoundsSp, type BoundsSp } from '../render/bounds.ts';
import { durationValue, tremoloDuration, tupletDuration, measureHeadingX, type MeasureHeading } from './spacing.ts';
import { chordSymbolDisplay } from '../../model/harmony.ts';
import type { ResolvedSwing, SwingTimelineEntry } from '../../model/swing.ts';

// ---------- Ink-measured placement (core-ink-measured-gaps.md, stage A) ----------

/**
 * The clearance between a thing and the staff it BELONGS to — a label or tempo
 * mark and the bar it names. Small, because proximity is what says "this is
 * about that": the text sits this far above whatever ink the bar already
 * carries over its top staff, stems and beams and brackets included.
 */
export const COHESION_CLEAR_SP = 1;
/**
 * Where the text's bottom ink sits when NOTHING rises above the top line — a
 * bare tab staff, a bar of down-stemmed notes. Not zero: text touching a staff
 * line reads as part of the staff. Replaces the old fixed 2.8sp baseline rise,
 * which was sized for stems that a tab staff never has.
 */
export const TEXT_MIN_RISE_SP = 1.5;
/** Ink this close to the top line is the line itself (staff lines, barline
 *  caps), not content rising above it. */
const ABOVE_LINE_EPS_SP = 0.25;
/**
 * A text clears the ink under its OWN footprint, widened by this on each
 * side — not the whole bar's. A tempo mark at the bar's start has no business
 * climbing over a segno at its end; "what is under me" is the local question,
 * and locality is what keeps the text near its staff.
 */
export const TEXT_SIDE_CLEAR_SP = 0.5;

/**
 * Places a run of just-emitted text primitives (drawn at a provisional y of 0)
 * so their BOTTOM ink sits one cohesion clearance above whatever they would
 * otherwise cover — measured under their real footprint, which is only known
 * once they exist. `bottomInkAtZero` is the run's bottom ink in its own
 * provisional coordinates. Returns the run's top ink after placement.
 */
function placeTextRun(
  primitives: Primitive[],
  firstNew: number,
  bottomInkAtZero: number,
  staffTop: number,
  scan: readonly Primitive[],
  clearAbove: BoundsSp | null | undefined
): BoundsSp | null {
  const run = primitives.slice(firstNew);
  const box = computeBoundsSp(run);
  if (!box) return null;
  const x0 = box.x - TEXT_SIDE_CLEAR_SP;
  const x1 = box.x + box.w + TEXT_SIDE_CLEAR_SP;
  const overlapsHandoff =
    clearAbove != null && clearAbove.x + clearAbove.w >= x0 && clearAbove.x <= x1;
  const bottomInk = Math.min(
    textBottomAbove(scan, x0, x1, staffTop),
    overlapsHandoff ? clearAbove.y - COHESION_CLEAR_SP : Infinity
  );
  const dy = bottomInk - bottomInkAtZero;
  for (const p of run) translatePrimitiveY(p, dy);
  return { ...box, y: box.y + dy };
}

/**
 * The highest ink already drawn over [x0, x1] that rises above `staffTop`,
 * measured through the same SMuFL boxes the crop and `tightenRows` trust — so
 * a stem (a `line`, which a `.y` read cannot see) counts exactly as far as it
 * reaches. `scan` must hold THIS ROW's primitives and no other row's: after a
 * system wrap the x-range repeats, and a geometric floor cannot separate a
 * tall label stack of this row from the hanging ink of the row above once the
 * pads are small — the callers know which primitives they drew for which row,
 * so they say. Null when the space is clear.
 */
export function inkTopAbove(
  scan: readonly Primitive[],
  x0: number,
  x1: number,
  staffTop: number
): number | null {
  let top: number | null = null;
  for (const p of scan) {
    const b = computeBoundsSp([p]);
    if (!b) continue;
    if (b.x + b.w < x0 || b.x > x1) continue;
    if (b.y >= staffTop - ABOVE_LINE_EPS_SP) continue;
    top = top === null ? b.y : Math.min(top, b.y);
  }
  return top;
}

/** Where a piece of score text's BOTTOM ink goes: one cohesion clearance above
 *  the bar's ink, or the minimum rise above a clear staff. */
export function textBottomAbove(
  scan: readonly Primitive[],
  x0: number,
  x1: number,
  staffTop: number
): number {
  const inkTop = inkTopAbove(scan, x0, x1, staffTop);
  return inkTop === null ? staffTop - TEXT_MIN_RISE_SP : inkTop - COHESION_CLEAR_SP;
}

/**
 * SCORE TEXT AND SCORE-WIDE MARKS — everything the GLOBAL measure puts above a
 * staff: the metronome mark, the navigation marks (segno / fine / D.S.), and
 * the structural labels (rehearsal mark, section name).
 *
 * These live here rather than in `notation.ts` because none of them belongs to
 * a notation staff. `measure-global` is the container for things that describe
 * the BAR — MNX gives them a `location`, not a `staff` — so a reader looking at
 * a tab staff needs them exactly as much as a reader looking at notation, and
 * for years got none of them because the only code that drew them was the
 * notation layout's.
 *
 * One source, used by `notation.ts` (which also feeds the combined `both`
 * system) and by the standalone `tab.ts` — the same arrangement `tabStaff.ts`
 * has for staff drawing, and for the same reason: two copies would drift.
 *
 * Emission ORDER is load-bearing and the callers must keep it: tempo, then
 * navigation, then labels last. `emitScoreLabels` scans what is already above
 * this measure and stacks above it, so a caller that draws the label first
 * gets a label with a tempo mark on top of it.
 */

// ---------- Metric-position anchoring (dynamics, segno/fine/jump) ----------

export interface OnsetX {
  t: number;
  x: number;
}

/** Onset → column x for the first staff-1 voice — the anchor map for
 *  measure-attached markings with a `position`/`location`. */
export function measureOnsetXs(seq: MnxSequence | undefined, slots: { x: number }[]): OnsetX[] {
  const onsetXs: OnsetX[] = [];
  let t = 0;
  (seq?.content ?? []).forEach((item, idx) => {
    const slot = slots[idx];
    if (slot) onsetXs.push({ t, x: slot.x });
    t += isGrace(item) ? 0 : isTremolo(item) ? tremoloDuration(item) : isTuplet(item) ? tupletDuration(item) : isTimedEvent(item) ? durationValue(item.duration) : 0.25;
  });
  return onsetXs;
}

/** The column at (or first after) a metric position; positions past the last
 *  event anchor at the end barline (right-aligned). */
export function anchorAt(
  onsetXs: OnsetX[],
  t: number,
  m: { x: number; width: number }
): { x: number; anchor: 'middle' | 'end' } {
  const hit = onsetXs.find(o => o.t >= t - 1e-6);
  if (hit) return { x: hit.x, anchor: 'middle' };
  return { x: m.x + m.width, anchor: 'end' };
}

// ---------- Navigation markers (segno / fine / jump) ----------

const NAV_MARKER_RISE_SP = 2.5; // baseline above the top staff line

const JUMP_TEXT: Record<string, string> = {
  segno: 'D.S.',
  dsalfine: 'D.S. al Fine'
};

export interface EmitNavigationMarkersArgs {
  gm: MnxGlobalMeasure;
  m: { voices: { x: number }[][]; x: number; width: number };
  stdSequences: MnxSequence[];
  staffTop: number;
  primitives: Primitive[];
}

/** Segno sign, "fine" and jump text ("D.S." / "D.S. al Fine") above the staff
 *  at their metric location — end-of-bar locations right-align at the barline,
 *  as in the spec's reference engravings. */
export function emitNavigationMarkers(args: EmitNavigationMarkersArgs): void {
  const { gm, m, stdSequences, staffTop, primitives } = args;
  if (!gm.segno && !gm.fine && !gm.jump) return;

  const onsetXs = measureOnsetXs(stdSequences[0], m.voices[0] ?? []);
  const y = staffTop - NAV_MARKER_RISE_SP;
  const place = (loc?: { fraction: [number, number] }) => {
    const f = loc?.fraction;
    const t = Array.isArray(f) && f[1] ? f[0] / f[1] : 0;
    return anchorAt(onsetXs, t, m);
  };

  if (gm.segno) {
    const p = place(gm.segno.location);
    primitives.push({
      kind: 'glyph',
      glyph: gm.segno.glyph ?? 'segno',
      x: p.x,
      y,
      anchor: p.anchor,
      ...(gm.segno.color ? { fill: gm.segno.color } : {}),
      className: 'segno'
    });
  }
  if (gm.fine) {
    const p = place(gm.fine.location);
    primitives.push({
      kind: 'text',
      text: 'fine',
      x: p.x,
      y,
      font: 'bodyItalic',
      size: 1.6,
      anchor: p.anchor,
      ...(gm.fine.color ? { fill: gm.fine.color } : {}),
      className: 'fine'
    });
  }
  if (gm.jump) {
    const p = place(gm.jump.location);
    primitives.push({
      kind: 'text',
      text: JUMP_TEXT[gm.jump.type] ?? gm.jump.type,
      x: p.x,
      y,
      font: 'body',
      size: 1.6,
      anchor: p.anchor,
      className: 'jump'
    });
  }
}

// ---------- Score text: rehearsal marks and sections ----------
//
// Rehearsal marks and sections are score-wide, so they stack above the TOP
// staff of the system, clear of the tempo row.
//
// The stacking order is fixed by what each object IS, which is the point of
// typing them: a rehearsal mark reads as the outermost index, the section name
// sits under it, and part-level text sits closest to the notes. Nothing in the
// document says so. (roadmap/proposed/low-priority/spec-score-text.md)
/** The shared em size for rehearsal and section labels. Exported so document
 *  chrome that sits beside the SVG can match the engraving's typography at
 *  the actual on-screen staff scale. */
export const SCORE_LABEL_SIZE_SP = 1.8;
// Body text has no metrics in layout, so the box is drawn around an estimated
// CAP HEIGHT, not the em. Sizing it to the em leaves the ascender/descender
// space inside the box and the letter sits visibly low in it.
/** Exported for the section rung's label chip (workbench-rung-legibility.md):
 *  the overlay boxes the CAP the emitter drew, so the chip and the rehearsal
 *  mark's own box share one vertical extent by construction. */
export const SCORE_LABEL_CAP_RATIO = 0.72;
const SCORE_LABEL_GAP_SP = 0.5; // between the rehearsal box and the section name
const REHEARSAL_PAD_X_SP = 0.5; // box padding around the label
const REHEARSAL_PAD_Y_SP = 0.4;
const REHEARSAL_BOX_THICKNESS_SP = 0.12;
/** Body text has no metrics available in layout (no DOM), so widths are
 *  estimated the same way lyric and staff labels are. */
const DIRECTION_CHAR_SP = 0.62;

export interface EmitScoreLabelsArgs {
  gm: MnxGlobalMeasure;
  m: EmitTempoMarkArgs['m'];
  staffTop: number;
  /** What the label must clear: THIS ROW's primitives drawn so far, and no
   *  other row's. After a system wrap the x-range repeats, so a scan over
   *  everything would see the systems above and climb the label to the top of
   *  the page (the twelve-bar-blues "Turnaround over bar 1" bug); clearance
   *  from the row above is `tightenRows`' job, not the label's. */
  scan: readonly Primitive[];
  /**
   * The box of ink this row's own text pass already placed over the bar —
   * `emitTempoMark`'s return. Handed over explicitly because a tempo mark
   * lifted over a stem can stand taller than the row pad, where a geometric scan took it
   * for the system above and the label would land on top of it. Honoured
   * only where the footprints overlap, like everything else.
   */
  clearAbove?: BoundsSp | null;
  primitives: Primitive[];
}

/**
 * Draws the measure's score-wide labels above the top staff: the rehearsal mark
 * boxed, the section name plain beneath it.
 *
 * The box is not encoded — it is what a rehearsal mark looks like, and drawing
 * it here rather than reading an `enclosure` attribute is why the document
 * needs no typography at all.
 */
export function emitScoreLabels(args: EmitScoreLabelsArgs): void {
  const { gm, m, staffTop, scan, clearAbove, primitives } = args;
  if (!gm.rehearsal && !gm.section) return;

  // Share the tempo heading edge, clear of the clef and system-start barline.
  const labelX = gm.section ? measureHeadingX(m) : m.x + 0.6;

  const capH = SCORE_LABEL_SIZE_SP * SCORE_LABEL_CAP_RATIO;

  // A score-wide label goes above everything under its footprint — tempo
  // marks, navigation marks, part directions, stems, voltas — because it
  // labels the bar as a whole; and it goes exactly one cohesion clearance
  // above that ink, because it labels THIS bar. Drawn at a provisional
  // baseline of 0 and placed once its real extent is known; the box, when
  // there is one, is the label's bottom ink.
  const firstNew = primitives.length;
  const innerY = 0 - (gm.rehearsal ? REHEARSAL_PAD_Y_SP : 0);

  // Both labels share one row. "[A] Verse" reads as a single statement — the
  // mark indexes the bar and the name says what it is — and vertical space
  // above the staff is the scarcest thing in an engraving, contested by tempo
  // marks, directions, ottavas and voltas. Stacking them spends two rows to say
  // one thing.
  //
  // Nothing in the document asks for this. Placement is derivable because the
  // objects are typed, which is the whole argument for typing them; another
  // renderer stacking them is equally conforming.
  let boxRight: number | null = null;

  if (gm.rehearsal) {
    const label = gm.rehearsal.label;
    const w = label.length * SCORE_LABEL_SIZE_SP * DIRECTION_CHAR_SP + 2 * REHEARSAL_PAD_X_SP;
    const left = labelX - REHEARSAL_PAD_X_SP;
    boxRight = left + w;
    primitives.push({
      kind: 'rect',
      x: left,
      y: innerY - capH - REHEARSAL_PAD_Y_SP,
      w,
      h: capH + 2 * REHEARSAL_PAD_Y_SP,
      stroke: 'currentColor',
      thickness: REHEARSAL_BOX_THICKNESS_SP,
      className: 'rehearsal-box'
    });
    primitives.push({
      kind: 'text',
      text: label,
      x: labelX,
      y: innerY,
      font: 'body',
      size: SCORE_LABEL_SIZE_SP,
      weight: 'bold',
      anchor: 'start',
      ...(gm.rehearsal.color ? { fill: gm.rehearsal.color } : {}),
      className: 'rehearsal-label'
    });
  }

  if (gm.section) {
    // "[A] Verse" reads as one statement, so the name follows the box. A long
    // name simply overhangs, the way an engraver would set it — layout that
    // changes shape based on string length surprises people more than it helps.
    primitives.push({
      kind: 'text',
      text: gm.section.label,
      x: boxRight === null ? labelX : boxRight + SCORE_LABEL_GAP_SP,
      y: innerY,
      font: 'body',
      size: SCORE_LABEL_SIZE_SP,
      weight: 'bold',
      anchor: 'start',
      ...(gm.section.color ? { fill: gm.section.color } : {}),
      className: 'section-label'
    });
  }

  placeTextRun(primitives, firstNew, 0, staffTop, scan, clearAbove);
}


// ---------- Metronome mark ----------

/** SMuFL note glyph for a metronome mark's beat unit. */
const METRONOME_GLYPH_BY_BASE: Record<string, string> = {
  breve: 'metNoteDoubleWhole',
  whole: 'metNoteWhole',
  half: 'metNoteHalfUp',
  quarter: 'metNoteQuarterUp',
  eighth: 'metNote8thUp',
  '16th': 'metNote16thUp',
  '32nd': 'metNote32ndUp',
  '64th': 'metNote64thUp',
  '128th': 'metNote128thUp'
};

// The metronome note is TEXT, not a staff note: SMuFL's `met*` glyphs are
// designed to be scaled to the text they sit in, and Gould wants the value a
// little smaller than the notes in the score. Drawn at the full 4-sp music em
// it is a staff-sized head with a full-height stem — visibly heavier than the
// section label above it and the capo line below. Sized to sit between the
// two: section label (1.8 bold) > tempo (1.3 semi-bold) > capo (1.1 semi-bold).
const TEMPO_GLYPH_SCALE = 0.55; // multiplier on the 4-sp em
const TEMPO_TEXT_SIZE_SP = 1.3;
const TEMPO_TEXT_WEIGHT = 600; // matches the capo line
const TEMPO_GLYPH_TEXT_GAP_SP = 0.2; // between the note's right ink and the "="
const TEMPO_DOT_ADVANCE_SP = 0.45; // at scale 1

export interface EmitTempoMarkArgs {
  gm: MnxGlobalMeasure;
  m: MeasureHeading & { width: number };
  staffTop: number;
  /** This row's primitives drawn so far (see `EmitScoreLabelsArgs.scan`). */
  scan: readonly Primitive[];
  primitives: Primitive[];
  /** The bar's onset columns, for a tempo with a `location` (the first
   *  tempo without one sits at the bar's start as it always did). */
  onsetXs?: OnsetX[];
}

/**
 * Metronome mark above the bar's prefix ("quarter = 200"), one cohesion
 * clearance above the bar's ink. Callers emit it AFTER the bar's events,
 * beams and brackets — the mark has to see the stems it must clear.
 *
 * Returns the box of the ink it drew (null when there is no tempo), for the
 * label pass to clear explicitly — see `EmitScoreLabelsArgs.clearAbove`.
 */
export function emitTempoMark(args: EmitTempoMarkArgs): BoundsSp | null {
  const { gm, m, staffTop, scan, primitives, onsetXs } = args;
  const tempos = gm.tempos ?? [];
  if (tempos.length === 0) return null;
  const x0 = measureHeadingX(m);
  let top: BoundsSp | null = null;
  const before = primitives.length;
  // Every mark draws (core-measure-attributes-gaps.md: only the first used
  // to). One without a location sits at the bar's start; one with a location
  // starts at that column — a mid-bar tempo change. Each is its own run, so a
  // later mark clears the earlier ones like any other text over this bar.
  tempos.forEach((tempo, index) => {
    const f = tempo.location?.fraction;
    const t = Array.isArray(f) && f[1] ? f[0] / f[1] : 0;
    const x = tempo.location && onsetXs ? anchorAt(onsetXs, t, m).x - 0.6 : index === 0 ? x0 : x0 + 6 * index;
    const placed = emitOneTempo(tempo, x, staffTop, [...scan, ...primitives.slice(before)], primitives);
    if (placed && (!top || placed.y < top.y)) top = placed;
  });
  return top;
}

function emitOneTempo(
  tempo: NonNullable<MnxGlobalMeasure['tempos']>[number],
  x0: number,
  staffTop: number,
  scan: readonly Primitive[],
  primitives: Primitive[]
): BoundsSp | null {
  const firstNew = primitives.length;
  const metGlyph = METRONOME_GLYPH_BY_BASE[tempo.value.base] ?? 'metNoteQuarterUp';
  // Drawn at a provisional baseline of 0 and placed once its footprint is
  // known. The note glyph's head hangs below the baseline — that is the
  // mark's bottom ink, and it is what meets the clearance.
  const y = 0;
  const scale = TEMPO_GLYPH_SCALE;
  // Every metric read off the glyph box scales with the glyph.
  const belowBaseline = Math.max(0, -(glyphBBox(metGlyph)?.y ?? 0)) * scale;
  primitives.push({ kind: 'glyph', glyph: metGlyph, x: x0, y, scale, className: 'tempo' });
  // Advance past the note glyph's actual right edge (incl. its stem) so the
  // augmentation dots and the "=" never collide with the stem.
  let cursor = x0 + (glyphBBox(metGlyph)?.w ?? 1.33) * scale + TEMPO_GLYPH_TEXT_GAP_SP;
  for (let d = 0; d < (tempo.value.dots ?? 0); d++) {
    primitives.push({ kind: 'glyph', glyph: 'metAugmentationDot', x: cursor, y, scale, className: 'tempo' });
    cursor += TEMPO_DOT_ADVANCE_SP * scale;
  }
  primitives.push({
    kind: 'text',
    text: `= ${tempo.bpm}`,
    x: cursor,
    y,
    font: 'body',
    size: TEMPO_TEXT_SIZE_SP,
    weight: TEMPO_TEXT_WEIGHT,
    className: 'tempo'
  });
  return placeTextRun(primitives, firstNew, belowBaseline, staffTop, scan, null);
}

// ---------- Chord symbols (`_x.mnxLab.harmonies`) ----------
//
// A chord symbol names the harmony from a moment on, so it sits over that
// moment's column like a dynamic sits under it — closest to the staff of all
// the score text, because a player reads the chord and the notes together;
// the tempo and the labels stack above it (they are emitted after it and scan
// its ink). core-chord-symbols.md.
const HARMONY_SIZE_SP = 1.8;
const HARMONY_LEAD_SP = 0.6; // the symbol starts a touch left of the column

export interface EmitHarmoniesArgs {
  gm: MnxGlobalMeasure;
  m: { voices: { x: number }[][]; x: number; width: number };
  stdSequences: MnxSequence[];
  staffTop: number;
  scan: readonly Primitive[];
  primitives: Primitive[];
}

/** Every chord symbol on the bar, each its own run over its column. */
export function emitHarmonies(args: EmitHarmoniesArgs): void {
  const { gm, m, stdSequences, staffTop, scan, primitives } = args;
  const harmonies = gm._x?.mnxLab?.harmonies ?? [];
  if (harmonies.length === 0) return;
  const onsetXs = measureOnsetXs(stdSequences[0], m.voices[0] ?? []);
  const before = primitives.length;
  for (const harmony of harmonies) {
    const f = harmony.location?.fraction;
    const t = Array.isArray(f) && f[1] ? f[0] / f[1] : 0;
    const p = anchorAt(onsetXs, t, m);
    const firstNew = primitives.length;
    primitives.push({
      kind: 'text',
      text: chordSymbolDisplay(harmony),
      x: p.anchor === 'end' ? p.x : p.x - HARMONY_LEAD_SP,
      y: 0,
      font: 'body',
      size: HARMONY_SIZE_SP,
      weight: 'bold',
      anchor: p.anchor === 'end' ? 'end' : 'start',
      ...(harmony.color ? { fill: harmony.color } : {}),
      className: 'harmony'
    });
    placeTextRun(primitives, firstNew, 0, staffTop, [...scan, ...primitives.slice(before, firstNew)], null);
  }
}

// ---------- Swing marking (`_x.mnxLab.swing`) ----------
//
// A feel is a rhythmic equation — "written like this, played like that" — so
// the mark draws it rather than naming it: the written pair, an `=`, and the
// realisation the ratio implies, under a tuplet bracket when the realisation
// needs one. Naming it ("Swing") is available through the declaration's own
// `text`, because the word is a convention and the ratio is the fact.
//
// It sits in the tempo band, ABOVE the metronome mark, and prints only where
// the feel CHANGES (`model/swing.ts` decides that). A bar restating the feel
// it inherited draws nothing, which is why a Guitar Pro import that stamps
// every bar still engraves the marking once.
const SWING_GLYPH_SCALE = TEMPO_GLYPH_SCALE;
const SWING_TEXT_SIZE_SP = TEMPO_TEXT_SIZE_SP;
const SWING_PAIR_GAP_SP = 0.16; // between the two notes of a group
const SWING_GROUP_GAP_SP = 0.3; // around the "="
const SWING_DOT_ADVANCE_SP = 0.45; // at scale 1, as the tempo mark's dots
const SWING_BRACKET_RISE_SP = 0.3; // bracket over the tallest stem in its group
const SWING_BRACKET_THICKNESS_SP = 0.12;
const SWING_BRACKET_TICK_SP = 0.4;
const SWING_TUPLET_SIZE_SP = 1.0;

/** Note values, coarse to fine — stepping this list is how a realisation
 *  halves or doubles a written value. */
const SWING_NOTE_ORDER = [
  'breve', 'whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th', '128th'
];
const stepValue = (base: string, by: number): string | null =>
  SWING_NOTE_ORDER[SWING_NOTE_ORDER.indexOf(base) + by] ?? null;

interface SwingMarkNote {
  base: string;
  dots: number;
}
interface SwingRealisation {
  /** What is written: the pair, twice the unit. */
  written: [SwingMarkNote, SwingMarkNote];
  /** What is played. */
  played: [SwingMarkNote, SwingMarkNote];
  /** Tuplet number over the played group, when the realisation is one. */
  tuplet: number | null;
}

/**
 * The rhythm the ratio realises, or null when no ordinary notation says it.
 *
 * The pair spans two units and is redivided into `first + second` parts, so
 * the parts are notatable exactly when that total is 3 (a triplet: the parts
 * are units, bracketed) or 4 (dyadic: the parts are half-units, and three of
 * them is a dotted unit). 5:3 and its like are real feels with no rhythmic
 * spelling — those print their ratio as words instead of a wrong rhythm.
 */
function swingRealisation(swing: ResolvedSwing): SwingRealisation | null {
  const base = swing.source.unit?.base ?? '';
  if ((swing.source.unit?.dots ?? 0) !== 0) return null;
  if (SWING_NOTE_ORDER.indexOf(base) < 0) return null;
  const written: [SwingMarkNote, SwingMarkNote] = [
    { base, dots: 0 },
    { base, dots: 0 }
  ];
  const total = swing.first + swing.second;
  if (total === 3n) {
    const double = stepValue(base, -1);
    if (!double) return null;
    const part = (share: bigint): SwingMarkNote =>
      share === 2n ? { base: double, dots: 0 } : { base, dots: 0 };
    return { written, played: [part(swing.first), part(swing.second)], tuplet: 3 };
  }
  if (total === 4n) {
    const half = stepValue(base, 1);
    if (!half) return null;
    const part = (share: bigint): SwingMarkNote =>
      share === 3n ? { base, dots: 1 } : { base: half, dots: 0 };
    return { written, played: [part(swing.first), part(swing.second)], tuplet: null };
  }
  return null;
}

/** Draws one note of the equation at `x`, returning the cursor past its ink. */
function emitSwingNote(note: SwingMarkNote, x: number, y: number, primitives: Primitive[]): number {
  const glyph = METRONOME_GLYPH_BY_BASE[note.base] ?? 'metNoteQuarterUp';
  primitives.push({ kind: 'glyph', glyph, x, y, scale: SWING_GLYPH_SCALE, className: 'swing' });
  let cursor = x + (glyphBBox(glyph)?.w ?? 1.33) * SWING_GLYPH_SCALE;
  for (let d = 0; d < note.dots; d++) {
    cursor += SWING_DOT_ADVANCE_SP * SWING_GLYPH_SCALE * 0.4;
    primitives.push({
      kind: 'glyph', glyph: 'metAugmentationDot', x: cursor, y,
      scale: SWING_GLYPH_SCALE, className: 'swing'
    });
    cursor += SWING_DOT_ADVANCE_SP * SWING_GLYPH_SCALE;
  }
  return cursor;
}

/** How far a note's ink reaches above (negative) and below the baseline. */
function swingNoteExtent(note: SwingMarkNote): { top: number; bottom: number } {
  const bb = glyphBBox(METRONOME_GLYPH_BY_BASE[note.base] ?? 'metNoteQuarterUp');
  if (!bb) return { top: -2, bottom: 0.5 };
  return { top: -(bb.y + bb.h) * SWING_GLYPH_SCALE, bottom: -bb.y * SWING_GLYPH_SCALE };
}

export interface EmitSwingMarkArgs {
  /** This measure's entry from `resolveSwingTimeline`. */
  swing: SwingTimelineEntry | undefined;
  m: EmitTempoMarkArgs['m'];
  staffTop: number;
  scan: readonly Primitive[];
  primitives: Primitive[];
  /** The metronome mark's box, so the feel stacks above it rather than
   *  through it — both marks start at the bar's heading. */
  clearAbove: BoundsSp | null | undefined;
}

/**
 * The feel over the bar that declares it. Returns the box of the ink it drew
 * (null when this bar declares nothing new), for the label pass to clear.
 */
export function emitSwingMark(args: EmitSwingMarkArgs): BoundsSp | null {
  const { swing, m, staffTop, scan, primitives, clearAbove } = args;
  if (!swing?.prints) return null;
  const firstNew = primitives.length;
  const x0 = measureHeadingX(m);
  const y = 0;
  const words = (text: string): BoundsSp | null => {
    primitives.push({
      kind: 'text', text, x: x0, y, font: 'body', size: SWING_TEXT_SIZE_SP,
      weight: TEMPO_TEXT_WEIGHT, className: 'swing'
    });
    return placeTextRun(primitives, firstNew, 0, staffTop, scan, clearAbove);
  };
  // A cancellation resolves to nothing to play, but it is still a marking:
  // the bar where a swing stops has to say so.
  if (!swing.swing) return words(swing.declared?.text ?? 'Straight');
  if (swing.swing.source.text) return words(swing.swing.source.text);
  const realisation = swingRealisation(swing.swing);
  if (!realisation) return words(`Swing ${swing.swing.first}:${swing.swing.second}`);

  const notes = [...realisation.written, ...realisation.played];
  const bottom = Math.max(...notes.map(n => swingNoteExtent(n).bottom), 0);
  let cursor = emitSwingNote(realisation.written[0], x0, y, primitives);
  cursor = emitSwingNote(realisation.written[1], cursor + SWING_PAIR_GAP_SP, y, primitives);
  primitives.push({
    kind: 'text', text: '=', x: cursor + SWING_GROUP_GAP_SP, y, font: 'body',
    size: SWING_TEXT_SIZE_SP, weight: TEMPO_TEXT_WEIGHT, className: 'swing'
  });
  cursor += SWING_GROUP_GAP_SP + SWING_TEXT_SIZE_SP * 0.6 + SWING_GROUP_GAP_SP;
  const playedFrom = cursor;
  cursor = emitSwingNote(realisation.played[0], cursor, y, primitives);
  cursor = emitSwingNote(realisation.played[1], cursor + SWING_PAIR_GAP_SP, y, primitives);
  if (realisation.tuplet !== null)
    emitSwingBracket(realisation, playedFrom, cursor, realisation.tuplet, primitives);
  return placeTextRun(primitives, firstNew, bottom, staffTop, scan, clearAbove);
}

/** The `⌐3¬` over the played group: two rules with the number between them,
 *  ticked down at both ends, clear of the stems it spans. */
function emitSwingBracket(
  realisation: SwingRealisation,
  from: number,
  to: number,
  tuplet: number,
  primitives: Primitive[]
) {
  const top = Math.min(...realisation.played.map(n => swingNoteExtent(n).top));
  const line = top - SWING_BRACKET_RISE_SP;
  const middle = (from + to) / 2;
  const half = SWING_TUPLET_SIZE_SP * 0.45;
  const rule = (x1: number, x2: number) =>
    primitives.push({
      kind: 'line', x1, y1: line, x2, y2: line,
      thickness: SWING_BRACKET_THICKNESS_SP, className: 'swing'
    });
  rule(from, middle - half);
  rule(middle + half, to);
  for (const x of [from, to])
    primitives.push({
      kind: 'line', x1: x, y1: line, x2: x, y2: line + SWING_BRACKET_TICK_SP,
      thickness: SWING_BRACKET_THICKNESS_SP, className: 'swing'
    });
  primitives.push({
    kind: 'text', text: String(tuplet), x: middle, y: line + SWING_TUPLET_SIZE_SP * 0.35,
    font: 'body', size: SWING_TUPLET_SIZE_SP, weight: TEMPO_TEXT_WEIGHT,
    anchor: 'middle', className: 'swing'
  });
}
