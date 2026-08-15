import {
  MnxGlobalMeasure,
  MnxSequence,
  isGrace,
  isTimedEvent,
  isTremolo,
  isTuplet
} from '../../model/mnx.ts';
import { Primitive } from '../primitives.ts';
import { glyphBBox } from '../smufl/smufl.ts';
import { durationValue, tremoloDuration, tupletDuration } from './spacing.ts';

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
const SCORE_LABEL_BASE_RISE_SP = 2.8; // baseline of the innermost label, above the top staff line
const SCORE_LABEL_GAP_SP = 0.5; // between stacked labels
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
  /** Top of the measure's own row band. The occupied scan must stop here:
   *  after a system wrap the x-range repeats, so an unbounded scan sees the
   *  SYSTEMS ABOVE and climbs the label to the top of the page (the
   *  twelve-bar-blues "Turnaround over bar 1" bug). */
  rowTop: number;
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
  const { gm, m, staffTop, rowTop, primitives } = args;
  if (!gm.rehearsal && !gm.section) return;

  // Labels describe the measure rather than a moment in it, so they align to the
  // barline — which is where engravers put them.
  const labelX = m.x + SCORE_LABEL_INSET_SP;

  const capH = SCORE_LABEL_SIZE_SP * SCORE_LABEL_CAP_RATIO;

  // A score-wide label goes above everything else over this measure — tempo
  // marks, navigation marks, part directions — because it labels the bar as a
  // whole. With the space clear it takes the innermost row rather than floating.
  let occupiedTop = staffTop;
  for (const p of primitives) {
    const py = (p as { y?: number }).y;
    const px = (p as { x?: number }).x;
    if (py === undefined || px === undefined) continue;
    if (px < m.x || px > m.x + m.width || py >= staffTop || py <= rowTop) continue;
    occupiedTop = Math.min(occupiedTop, py - capH);
  }
  const innerY =
    occupiedTop === staffTop
      ? staffTop - SCORE_LABEL_BASE_RISE_SP
      : occupiedTop - SCORE_LABEL_GAP_SP - capH;

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
}


// ---------- Metronome mark ----------

const TEMPO_BASELINE_RISE_SP = 2.7; // above the top staff line

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
  m: { showTimeSig: boolean; timeSigCentreX: number; contentStartX: number };
  staffTop: number;
  primitives: Primitive[];
}

/** Metronome mark above the bar's prefix ("quarter = 200"). */
export function emitTempoMark(args: EmitTempoMarkArgs): void {
  const { gm, m, staffTop, primitives } = args;
  const tempo = (gm.tempos ?? [])[0];
  if (!tempo) return;

  const x0 = m.showTimeSig ? m.timeSigCentreX - 1.25 : m.contentStartX - 1.5;
  const y = staffTop - TEMPO_BASELINE_RISE_SP;
  const metGlyph = METRONOME_GLYPH_BY_BASE[tempo.value.base] ?? 'metNoteQuarterUp';
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
}
