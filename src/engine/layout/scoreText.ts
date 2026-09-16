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
import { durationValue, tremoloDuration, tupletDuration, measureHeadingX, ONSET_TEXT_LEAD_SP, type MeasureHeading } from './spacing.ts';
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
export function placeTextRun(
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

/** Onset → column x for one voice. */
function voiceOnsetXs(seq: MnxSequence | undefined, slots: { x: number }[]): OnsetX[] {
  const onsetXs: OnsetX[] = [];
  let t = 0;
  (seq?.content ?? []).forEach((item, idx) => {
    const slot = slots[idx];
    if (slot) onsetXs.push({ t, x: slot.x });
    t += isGrace(item) ? 0 : isTremolo(item) ? tremoloDuration(item) : isTuplet(item) ? tupletDuration(item) : isTimedEvent(item) ? durationValue(item.duration) : 0.25;
  });
  return onsetXs;
}

/**
 * Onset → column x over EVERY voice on a staff, in time order — the anchor
 * map for measure-attached markings with a `position`/`location`. The union
 * matters: a marking at a position only a second voice sounds (the "I" of
 * "I got a kind…", on the bass voice's upbeat) has a column of its own, and
 * a map read off the first voice alone snapped it forward to the next
 * first-voice column, on top of whatever that column carried.
 *
 * Columns are onset-aligned across voices, so two voices at one onset share
 * an x; the first voice's is kept where they differ within tolerance.
 */
export function measureOnsetXs(seqs: readonly (MnxSequence | undefined)[], slotsByVoice: readonly { x: number }[][]): OnsetX[] {
  const merged: OnsetX[] = [];
  seqs.forEach((seq, v) => {
    for (const o of voiceOnsetXs(seq, slotsByVoice[v] ?? [])) {
      if (!merged.some(m => Math.abs(m.t - o.t) < 1e-6)) merged.push(o);
    }
  });
  return merged.sort((a, b) => a.t - b.t);
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

  const onsetXs = measureOnsetXs(stdSequences, m.voices);
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
// In staff spaces like every other text, so it scales with the staff; kept a
// step above the lyric/fret size (1.25) and the tempo text (1.3) rather than
// towering over them.
export const SCORE_LABEL_SIZE_SP = 1.5;
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
// two: section label (1.5 bold) > tempo (1.3 semi-bold) > capo (1.1 semi-bold).
const TEMPO_GLYPH_SCALE = 0.55; // multiplier on the 4-sp em
const TEMPO_TEXT_SIZE_SP = 1.3;
const TEMPO_TEXT_WEIGHT = 600; // matches the capo line
const TEMPO_GLYPH_TEXT_GAP_SP = 0.2; // between the note's right ink and the "="
const TEMPO_DOT_ADVANCE_SP = 0.45; // at scale 1

interface TempoRun extends BoundsSp {
  /** Baseline shared by the metronome glyph and its text. */
  baseline: number;
  /** Placement bottom: notehead ink, while text uses its baseline as before. */
  bottomInk: number;
  /** First primitive of this measure's tempo run in the output array. */
  firstPrimitive: number;
}

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
export function emitTempoMark(args: EmitTempoMarkArgs): TempoRun | null {
  const { gm, m, staffTop, scan, primitives, onsetXs } = args;
  const tempos = gm.tempos ?? [];
  if (tempos.length === 0) return null;
  const x0 = measureHeadingX(m);
  let top: Omit<TempoRun, 'firstPrimitive'> | null = null;
  let groupBottom = -Infinity;
  const before = primitives.length;
  // Every mark draws (core-measure-attributes-gaps.md: only the first used
  // to). One without a location sits at the bar's start; one with a location
  // starts at that column — a mid-bar tempo change. Each is its own run, so a
  // later mark clears the earlier ones like any other text over this bar.
  for (const [index, tempo] of tempos.entries()) {
    const f = tempo.location?.fraction;
    const t = Array.isArray(f) && f[1] ? f[0] / f[1] : 0;
    const anchored = !!(tempo.location && onsetXs);
    const x = anchored ? anchorAt(onsetXs!, t, m).x : index === 0 ? x0 : x0 + 6 * index;
    const placed = emitOneTempo(tempo, x, anchored ? -ONSET_TEXT_LEAD_SP : 0, staffTop, [...scan, ...primitives.slice(before)], primitives);
    if (placed) {
      groupBottom = Math.max(groupBottom, placed.bottomInk);
      if (!top || placed.y < top.y) top = placed;
    }
  }
  return top ? { ...top, bottomInk: groupBottom, firstPrimitive: before } : null;
}

function emitOneTempo(
  tempo: NonNullable<MnxGlobalMeasure['tempos']>[number],
  x0: number,
  lead: number,
  staffTop: number,
  scan: readonly Primitive[],
  primitives: Primitive[]
): Omit<TempoRun, 'firstPrimitive'> | null {
  const firstNew = primitives.length;
  const metGlyph = METRONOME_GLYPH_BY_BASE[tempo.value.base] ?? 'metNoteQuarterUp';
  // Drawn at a provisional baseline of 0 and placed once its footprint is
  // known. The note glyph's head hangs below the baseline — that is the
  // mark's bottom ink, and it is what meets the clearance.
  const y = 0;
  const scale = TEMPO_GLYPH_SCALE;
  // Every metric read off the glyph box scales with the glyph.
  const belowBaseline = Math.max(0, -(glyphBBox(metGlyph)?.y ?? 0)) * scale;
  // x0 is the mark's position; everything after it is ink laid out from it,
  // so it rides in `dx` and keeps its spacing under a non-square scale.
  primitives.push({ kind: 'glyph', glyph: metGlyph, x: x0, dx: lead, y, scale, className: 'tempo' });
  // Advance past the note glyph's actual right edge (incl. its stem) so the
  // augmentation dots and the "=" never collide with the stem.
  let cursor = lead + (glyphBBox(metGlyph)?.w ?? 1.33) * scale + TEMPO_GLYPH_TEXT_GAP_SP;
  for (let d = 0; d < (tempo.value.dots ?? 0); d++) {
    primitives.push({ kind: 'glyph', glyph: 'metAugmentationDot', x: x0, dx: cursor, y, scale, className: 'tempo' });
    cursor += TEMPO_DOT_ADVANCE_SP * scale;
  }
  primitives.push({
    kind: 'text',
    text: `= ${tempo.bpm}`,
    x: x0,
    dx: cursor,
    y,
    font: 'body',
    size: TEMPO_TEXT_SIZE_SP,
    weight: TEMPO_TEXT_WEIGHT,
    className: 'tempo'
  });
  const placed = placeTextRun(primitives, firstNew, belowBaseline, staffTop, scan, null);
  const first = primitives[firstNew];
  if (!placed || first.kind !== 'glyph') return null;
  const baseline = first.y;
  return { ...placed, baseline, bottomInk: baseline + belowBaseline };
}

// ---------- Chord symbols (`_x.mnxLab.harmonies`) ----------
//
// A chord symbol names the harmony from a moment on, so it sits over that
// moment's column like a dynamic sits under it — closest to the staff of all
// the score text, because a player reads the chord and the notes together;
// the tempo and the labels stack above it (they are emitted after it and scan
// its ink). core-chord-symbols.md.
const HARMONY_SIZE_SP = 1.8;

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
  const onsetXs = measureOnsetXs(stdSequences, m.voices);
  const before = primitives.length;
  for (const harmony of harmonies) {
    const f = harmony.location?.fraction;
    const t = Array.isArray(f) && f[1] ? f[0] / f[1] : 0;
    const p = anchorAt(onsetXs, t, m);
    const firstNew = primitives.length;
    primitives.push({
      kind: 'text',
      text: chordSymbolDisplay(harmony),
      x: p.anchor === 'end' ? p.x : p.x - ONSET_TEXT_LEAD_SP,
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
// It sits in the tempo band, on the metronome mark's baseline, and prints only where
// the feel CHANGES (`model/swing.ts` decides that). A bar restating the feel
// it inherited draws nothing, which is why a Guitar Pro import that stamps
// every bar still engraves the marking once.
const SWING_GLYPH_SCALE = TEMPO_GLYPH_SCALE;
const SWING_TEXT_SIZE_SP = TEMPO_TEXT_SIZE_SP;
const SWING_PAIR_GAP_SP = 0.16; // between the two notes of a group
const SWING_BEAMED_PAIR_GAP_SP = 0.9; // between beamed notes, which have no flag to space them
// Beam metrics at scale 1, from Bravura's engravingDefaults; scaled with the glyph.
const SWING_STEM_THICKNESS_SP = 0.12;
const SWING_BEAM_THICKNESS_SP = 0.5;
const SWING_BEAM_GAP_SP = 0.25;
const SWING_BEAM_HOOK_SP = 1.1; // a level only one note carries
const SWING_GROUP_GAP_SP = 0.3; // around the "="
const SWING_DOT_ADVANCE_SP = 0.45; // at scale 1, as the tempo mark's dots
const SWING_BRACKET_RISE_SP = 0.3; // bracket over the tallest stem in its group
/** Between the metronome mark's right ink and the feel that follows it. */
export const SWING_AFTER_TEMPO_GAP_SP = 0.75;
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

// The whole mark is ink laid out from one position, the bar's heading `ox`:
// every distance within it is an INK OFFSET and rides in `dx`, so the notes,
// beams and bracket keep their shape under a non-square scale.

/** Draws one note of the equation at ink offset `dx` from `ox`, returning the
 *  offset past its ink. */
function emitSwingNote(
  note: SwingMarkNote,
  ox: number,
  dx: number,
  y: number,
  primitives: Primitive[],
  glyph = METRONOME_GLYPH_BY_BASE[note.base] ?? 'metNoteQuarterUp'
): number {
  primitives.push({ kind: 'glyph', glyph, x: ox, dx, y, scale: SWING_GLYPH_SCALE, className: 'swing' });
  let cursor = dx + (glyphBBox(glyph)?.w ?? 1.33) * SWING_GLYPH_SCALE;
  for (let d = 0; d < note.dots; d++) {
    cursor += SWING_DOT_ADVANCE_SP * SWING_GLYPH_SCALE * 0.4;
    primitives.push({
      kind: 'glyph', glyph: 'metAugmentationDot', x: ox, dx: cursor, y,
      scale: SWING_GLYPH_SCALE, className: 'swing'
    });
    cursor += SWING_DOT_ADVANCE_SP * SWING_GLYPH_SCALE;
  }
  return cursor;
}

/** Beams a note carries when joined to a neighbour: its flag count. */
const swingBeams = (note: SwingMarkNote): number =>
  Math.max(0, SWING_NOTE_ORDER.indexOf(note.base) - SWING_NOTE_ORDER.indexOf('quarter'));

/**
 * One pair of the equation at `x`, returning the cursor past its ink. Two
 * flagged values are beamed, as the rhythm would be written in the bar: black
 * stemmed heads with the beams across their stem tops, a shared level running
 * the full span and a level only one note has hooking in toward the other.
 */
function emitSwingPair(
  pair: [SwingMarkNote, SwingMarkNote],
  ox: number,
  dx: number,
  y: number,
  primitives: Primitive[]
): number {
  const beams = pair.map(swingBeams);
  if (beams[0] === 0 || beams[1] === 0) {
    const cursor = emitSwingNote(pair[0], ox, dx, y, primitives);
    return emitSwingNote(pair[1], ox, cursor + SWING_PAIR_GAP_SP, y, primitives);
  }
  const bb = glyphBBox('metNoteQuarterUp') ?? { x: 0, y: -0.564, w: 1.328, h: 3.316 };
  const s = SWING_GLYPH_SCALE;
  // The glyph's stem is its right edge.
  const stemX = (noteDx: number) => noteDx + (bb.x + bb.w - SWING_STEM_THICKNESS_SP / 2) * s;
  const stem0 = stemX(dx);
  let cursor = emitSwingNote(pair[0], ox, dx, y, primitives, 'metNoteQuarterUp');
  const dx1 = cursor + SWING_BEAMED_PAIR_GAP_SP;
  const stem1 = stemX(dx1);
  cursor = emitSwingNote(pair[1], ox, dx1, y, primitives, 'metNoteQuarterUp');
  const thickness = SWING_BEAM_THICKNESS_SP * s;
  const half = (SWING_STEM_THICKNESS_SP * s) / 2;
  const hook = Math.min(SWING_BEAM_HOOK_SP * s, (stem1 - stem0) / 2);
  const bar = (xa: number, xb: number, level: number) => {
    const lineY = y - (bb.y + bb.h) * s + thickness / 2 + (level - 1) * (thickness + SWING_BEAM_GAP_SP * s);
    primitives.push({
      kind: 'line', x1: ox, dx1: xa - half, y1: lineY, x2: ox, dx2: xb + half, y2: lineY,
      thickness, className: 'swing'
    });
  };
  for (let level = 1; level <= Math.max(...beams); level++) {
    if (level <= Math.min(...beams)) bar(stem0, stem1, level);
    else if (beams[0] >= level) bar(stem0, stem0 + hook, level);
    else bar(stem1 - hook, stem1, level);
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
  /** The metronome mark's box. The feel FOLLOWS it on the same line — tempo,
   *  then feel, one statement about how the bar goes — so with a tempo the
   *  feel starts past the mark's right ink rather than at the bar's heading.
   *  Handed on as the clearance too, for the case where the two still
   *  overlap in x (they should not) rather than as the thing to stack over. */
  clearAbove: TempoRun | BoundsSp | null | undefined;
}

/**
 * The feel over the bar that declares it. Returns the box of the ink it drew
 * (null when this bar declares nothing new), for the label pass to clear.
 */
export function emitSwingMark(args: EmitSwingMarkArgs): BoundsSp | null {
  const { swing, m, staffTop, scan, primitives, clearAbove } = args;
  if (!swing?.prints) return null;
  const firstNew = primitives.length;
  const x0 = clearAbove ? clearAbove.x + clearAbove.w + SWING_AFTER_TEMPO_GAP_SP : measureHeadingX(m);
  const y = 0;
  const tempoRun = clearAbove && 'baseline' in clearAbove && 'firstPrimitive' in clearAbove
    ? clearAbove as TempoRun
    : null;
  const finish = (bottomInkAtZero: number): BoundsSp | null => {
    if (!tempoRun) return placeTextRun(primitives, firstNew, bottomInkAtZero, staffTop, scan, clearAbove);

    // Tempo + feel are one heading statement. Put the feel on the tempo's
    // baseline first, then lift the WHOLE statement if the feel's wider
    // footprint encounters taller musical ink. Moving only the feel is the
    // bug this grouping prevents.
    for (const p of primitives.slice(firstNew)) translatePrimitiveY(p, tempoRun.baseline);
    const group = primitives.slice(tempoRun.firstPrimitive);
    const groupSet = new Set(group);
    const box = computeBoundsSp(group);
    if (!box) return null;
    const targetBottom = textBottomAbove(
      scan.filter(p => !groupSet.has(p)),
      box.x - TEXT_SIDE_CLEAR_SP,
      box.x + box.w + TEXT_SIDE_CLEAR_SP,
      staffTop
    );
    const currentBottom = Math.max(tempoRun.bottomInk, tempoRun.baseline + bottomInkAtZero);
    const dy = Math.min(0, targetBottom - currentBottom);
    if (dy !== 0) for (const p of group) translatePrimitiveY(p, dy);
    return { ...box, y: box.y + dy };
  };
  const words = (text: string): BoundsSp | null => {
    primitives.push({
      kind: 'text', text, x: x0, y, font: 'body', size: SWING_TEXT_SIZE_SP,
      weight: TEMPO_TEXT_WEIGHT, className: 'swing'
    });
    return finish(0);
  };
  // A cancellation resolves to nothing to play, but it is still a marking:
  // the bar where a swing stops has to say so.
  if (!swing.swing) return words(swing.declared?.text ?? 'Straight');
  if (swing.swing.source.text) return words(swing.swing.source.text);
  const realisation = swingRealisation(swing.swing);
  if (!realisation) return words(`Swing ${swing.swing.first}:${swing.swing.second}`);

  const notes = [...realisation.written, ...realisation.played];
  const bottom = Math.max(...notes.map(n => swingNoteExtent(n).bottom), 0);
  let cursor = emitSwingPair(realisation.written, x0, 0, y, primitives);
  primitives.push({
    kind: 'text', text: '=', x: x0, dx: cursor + SWING_GROUP_GAP_SP, y, font: 'body',
    size: SWING_TEXT_SIZE_SP, weight: TEMPO_TEXT_WEIGHT, className: 'swing'
  });
  cursor += SWING_GROUP_GAP_SP + SWING_TEXT_SIZE_SP * 0.6 + SWING_GROUP_GAP_SP;
  const playedFrom = cursor;
  cursor = emitSwingPair(realisation.played, x0, cursor, y, primitives);
  if (realisation.tuplet !== null)
    emitSwingBracket(realisation, x0, playedFrom, cursor, realisation.tuplet, primitives);
  return finish(bottom);
}

/** The `⌐3¬` over the played group: two rules with the number between them,
 *  ticked down at both ends, clear of the stems it spans. */
function emitSwingBracket(
  realisation: SwingRealisation,
  ox: number,
  from: number,
  to: number,
  tuplet: number,
  primitives: Primitive[]
) {
  const top = Math.min(...realisation.played.map(n => swingNoteExtent(n).top));
  const line = top - SWING_BRACKET_RISE_SP;
  const middle = (from + to) / 2;
  const half = SWING_TUPLET_SIZE_SP * 0.45;
  const rule = (dx1: number, dx2: number) =>
    primitives.push({
      kind: 'line', x1: ox, dx1, y1: line, x2: ox, dx2, y2: line,
      thickness: SWING_BRACKET_THICKNESS_SP, className: 'swing'
    });
  rule(from, middle - half);
  rule(middle + half, to);
  for (const dx of [from, to])
    primitives.push({
      kind: 'line', x1: ox, dx1: dx, y1: line, x2: ox, dx2: dx, y2: line + SWING_BRACKET_TICK_SP,
      thickness: SWING_BRACKET_THICKNESS_SP, className: 'swing'
    });
  primitives.push({
    kind: 'text', text: String(tuplet), x: ox, dx: middle, y: line + SWING_TUPLET_SIZE_SP * 0.35,
    font: 'body', size: SWING_TUPLET_SIZE_SP, weight: TEMPO_TEXT_WEIGHT,
    anchor: 'middle', className: 'swing'
  });
}
