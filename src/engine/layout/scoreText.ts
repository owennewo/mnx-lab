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
import { durationValue, tremoloDuration, tupletDuration } from './spacing.ts';

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
// document says so. (roadmap/proposed/spec-score-text.md)
const SCORE_LABEL_SIZE_SP = 1.8;
const SCORE_LABEL_INSET_SP = 0.6; // from the barline, for a label at the top of the bar
// Body text has no metrics in layout, so the box is drawn around an estimated
// CAP HEIGHT, not the em. Sizing it to the em leaves the ascender/descender
// space inside the box and the letter sits visibly low in it.
const SCORE_LABEL_CAP_RATIO = 0.72;
const SCORE_LABEL_GAP_SP = 0.5; // between the rehearsal box and the section name
const REHEARSAL_PAD_X_SP = 0.5; // box padding around the label
const REHEARSAL_PAD_Y_SP = 0.4;
const REHEARSAL_BOX_THICKNESS_SP = 0.12;
/** Body text has no metrics available in layout (no DOM), so widths are
 *  estimated the same way lyric and staff labels are. */
const DIRECTION_CHAR_SP = 0.62;

export interface EmitScoreLabelsArgs {
  gm: MnxGlobalMeasure;
  m: { x: number; width: number };
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

  // Labels describe the measure rather than a moment in it, so they align to the
  // barline — which is where engravers put them.
  const labelX = m.x + SCORE_LABEL_INSET_SP;

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

export interface EmitTempoMarkArgs {
  gm: MnxGlobalMeasure;
  m: { x: number; width: number; showTimeSig: boolean; timeSigCentreX: number; contentStartX: number };
  staffTop: number;
  /** This row's primitives drawn so far (see `EmitScoreLabelsArgs.scan`). */
  scan: readonly Primitive[];
  primitives: Primitive[];
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
  const { gm, m, staffTop, scan, primitives } = args;
  const tempo = (gm.tempos ?? [])[0];
  if (!tempo) return null;
  const firstNew = primitives.length;

  const x0 = m.showTimeSig ? m.timeSigCentreX - 1.25 : m.contentStartX - 1.5;
  const metGlyph = METRONOME_GLYPH_BY_BASE[tempo.value.base] ?? 'metNoteQuarterUp';
  // Drawn at a provisional baseline of 0 and placed once its footprint is
  // known. The note glyph's head hangs below the baseline — that is the
  // mark's bottom ink, and it is what meets the clearance.
  const y = 0;
  const belowBaseline = Math.max(0, -(glyphBBox(metGlyph)?.y ?? 0));
  primitives.push({ kind: 'glyph', glyph: metGlyph, x: x0, y, className: 'tempo' });
  // Advance past the note glyph's actual right edge (incl. its stem) so the
  // augmentation dots and the "=" never collide with the stem.
  let cursor = x0 + (glyphBBox(metGlyph)?.w ?? 1.33) + 0.4;
  for (let d = 0; d < (tempo.value.dots ?? 0); d++) {
    primitives.push({ kind: 'glyph', glyph: 'metAugmentationDot', x: cursor, y, className: 'tempo' });
    cursor += 0.45;
  }
  primitives.push({
    kind: 'text',
    text: `= ${tempo.bpm}`,
    x: cursor,
    y,
    font: 'body',
    size: 1.6,
    className: 'tempo'
  });
  return placeTextRun(primitives, firstNew, belowBaseline, staffTop, scan, null);
}
