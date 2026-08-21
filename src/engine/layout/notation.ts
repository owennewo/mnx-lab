import { MnxStructure, MnxEvent, MnxNote, MnxEventMarkings, MnxGrace, MnxLayoutContent, MnxPart, MnxPartMeasure, MnxSequence, MnxTremolo, MnxTuplet, isGrace, isTremolo, isTuplet, isTimedEvent, sequenceItemKind } from '../../model/mnx.ts';
import { emitMeasureDiagnostics, emitPositionedDiagnostics, MeasureIssue } from './diagnostics.ts';
import { validateDocument } from './validate.ts';
import { dynamicGlyph, dynamicLabel } from './dynamics.ts';
import {
  planHorizontal,
  resolveStaffVoices,
  PlanStaff,
  StaffSource,
  ResolvedVoice,
  noteAccidentalGlyph,
  durationValue,
  ActiveClef,
  ClefAt,
  HorizontalPlan,
  PackingInput,
  ACCIDENTAL_SLOT_WIDTH_SP,
  ACCIDENTAL_RIGHT_PAD_SP,
  KEY_SIG_GLYPH_ADVANCE_SP,
  GRACE_NOTE_ADVANCE_SP,
  TREMOLO_NOTE_ADVANCE_SP,
  CORE_SP,
  tremoloDuration,
  tupletDuration,
  tupletColumns
} from './spacing.ts';
import {
  resolveBeamGroups,
  impliedBeamGroup,
  BEAM_LEVELS_BY_BASE,
  WHOLE_NOTE_TICKS,
  BeamEventInfo,
  BeamGroupSpec,
  BeamSegmentSpec,
  BeamHookSpec
} from './beams.ts';
import {
  Primitive, LayoutResult, LayoutDiagnostic, RowBandSp, SpatialIndex, translatePrimitiveY
} from '../primitives.ts';
import { glyphAnchor, glyphBBox } from '../smufl/smufl.ts';
import { emitEndBarline, resolveBarlineType, type BarlineMetrics } from './barlines.ts';
import { anchorY, clampPadDensity, tightenRows } from './verticalDensity.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import {
  anchorAt,
  emitNavigationMarkers,
  emitScoreLabels,
  emitTempoMark,
  measureOnsetXs,
  type OnsetX
} from './scoreText.ts';
import { noteKeyAt } from '../../model/noteWalk.ts';
import {
  TAB_STAFF_HEIGHT_SP,
  emitTabClef,
  emitTabStaffLines,
  emitTabSystemHeader,
  emitTabTimeSig,
  emitTabVoices
} from './tabStaff.ts';
import {
  resolveTabSetup,
  tabPositionContext,
  TabPositionContext,
  PartTabSetups
} from '../tab/guitarPositions.ts';

/**
 * Pure layout for standard 5-line notation. Working in staff spaces, returns
 * primitives for the renderer + a sourceId → location index.
 *
 * Scope:
 *   - 5-line staff with treble/bass clefs, 8vb octave marker
 *   - Time signatures (digits via SMuFL)
 *   - Notes: noteheads (whole/half/black), stems, flags, accidentals, dots, chords, ledger lines
 *   - Rests by duration
 *   - Barlines (regular, final, system-start), mid-system clef/time changes
 *   - Multi-voice with auto stem direction (v1 down, v2 up; single-voice by position)
 *   - Beams: primary + secondary levels and hooks (explicit nested `beams` or
 *     implied from durations), cross-barline groups, split at system breaks
 *   - Slurs & ties: cubic curves between recorded event anchors, split at
 *     system breaks; laissez-vibrer hooks
 *
 * Out of scope (deferred): tuplets, ottava lines.
 */

// ---------- Layout constants (staff spaces) ----------

const STAFF_LINES = 5;
const STAFF_HEIGHT_SP = STAFF_LINES - 1; // 4 sp from top line to bottom line
const STAFF_MIDDLE_Y = STAFF_HEIGHT_SP / 2; // 2 sp from top

const ROW_PAD_TOP_SP = 6;    // extra room for ledger lines / stems above
const ROW_PAD_BOTTOM_SP = 6;
const ROW_HEIGHT_SP = STAFF_HEIGHT_SP + ROW_PAD_TOP_SP + ROW_PAD_BOTTOM_SP;
const INTER_STAFF_GAP_SP = 6; // between staves of a multi-staff part (grand staff)

// Ink-measured staff gaps (roadmap/proposed/core-ink-measured-gaps.md, stage B).
//
// `INTER_STAFF_GAP_SP` is a line-to-line distance, and a reader never sees a
// line-to-line distance: the notation→tab gap full of down-stems and the
// tab→bass gap full of air were both 6sp and read as crowded and as empty. The
// gap that matters is between the INK either side, so the assembler runs
// twice — once with the provisional constant to find out where the ink goes,
// once with each gap set to `ink below + ink above + SEPARATION_CLEAR_SP`,
// floored at `MIN_STAFF_GAP_SP` so two bare staves still stand apart.
// Separation, not cohesion: a tab staff does NOT belong to the notation staff
// above it, which is why this constant is three times the text one.
/** Clear space between one display staff's lowest ink and the next's highest. */
export const SEPARATION_CLEAR_SP = 3;
/** Floor on the line-to-line gap between display staves, ink or no ink. */
export const MIN_STAFF_GAP_SP = 4;
/** Primitives that span staves by construction (barlines, braces) or ARE the
 *  staff (its lines) — not content, and never measured as ink in a gap. */
const STRUCTURAL_CLASSES = new Set(['barline', 'staff-line', 'brace', 'bracket', 'group-label']);
/**
 * The PROBE gap the first pass opens between staves whose gap will be
 * measured. Ink is attributed to the band its anchor is nearest, and at the
 * real gap that is ambiguous — a verse row hanging 7sp under a notation staff
 * is nearer the tab staff below it than the staff it belongs to, and counted
 * as the tab's ink it would stop counting as ink IN the gap at all. At 100sp
 * nothing is ambiguous; and because every extent is measured relative to its
 * own staff's lines, the probe's answer is exactly the real layout's.
 */
const PROBE_GAP_SP = 100;
/** Which display gaps are ink-measured: every one (stage C). Stage B measured
 *  only the gaps adjacent to a tab staff — the staging was a review device
 *  (one golden set per sweep), not a distinction in the rule, which is why the
 *  parameter survives: it documents what the stage was scoped by. */
function isMeasuredGap(d: number, _tabDisplayIndexes: ReadonlySet<number>): boolean {
  return d > 0;
}
const BRACE_DESIGN_HEIGHT_SP = 3.988; // Bravura `brace` bbox height at scale 1
const MARGIN_SP = 2;

const STAFF_LINE_THICKNESS_SP = 0.13;
const LEDGER_LINE_THICKNESS_SP = 0.16;
const STEM_THICKNESS_SP = 0.12;
const BARLINE_THICKNESS_SP = 0.16;
const FINAL_BARLINE_THICK_SP = 0.5;
const FINAL_BARLINE_GAP_SP = 0.3;
const BARLINE_METRICS: BarlineMetrics = {
  thinSp: BARLINE_THICKNESS_SP,
  thickSp: FINAL_BARLINE_THICK_SP,
  gapSp: FINAL_BARLINE_GAP_SP
};

const STEM_LENGTH_SP = 3.5;
const BEAM_THICKNESS_SP = 0.5;
const BEAM_GAP_SP = 0.25;          // clear space between beam levels
const BEAM_MAX_SLANT_SP = 1;       // total rise/fall cap across a group
const BEAM_HOOK_LENGTH_SP = 1;
const NOTEHEAD_WIDTH_SP = 1.18;
const LEDGER_OVERHANG_SP = 0.4; // ledger extends this much beyond notehead each side

const GRACE_SCALE = 0.6;             // grace glyphs relative to full-size
const GRACE_STEM_LENGTH_SP = 2.5;    // shorter than STEM_LENGTH_SP, always up
const GRACE_SLASH_THICKNESS_SP = 0.12;

// Multi-note tremolos: beams floating between the two written notes.
const TREMOLO_BEAM_THICKNESS_SP = 0.45;
const TREMOLO_BEAM_GAP_SP = 0.3;

const DOT_RIGHT_PAD_SP = 0.35;

const ACTIVE_COLOR = 'oklch(0.65 0.22 274)';
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';

const NOTEHEAD_GLYPH_BY_BASE: Record<string, string> = {
  whole: 'noteheadWhole',
  half: 'noteheadHalf',
  quarter: 'noteheadBlack',
  eighth: 'noteheadBlack',
  '16th':'noteheadBlack',
  '32nd':'noteheadBlack'
};

// flags only on unbeamed durations shorter than quarter
const FLAG_GLYPH_BY_BASE_UP: Record<string, string | null> = {
  whole: null, half: null, quarter: null,
  eighth: 'flag8thUp',
  '16th':'flag16thUp',
  '32nd':'flag32ndUp',
  '64th':'flag64thUp',
  '128th':'flag128thUp',
  '256th':'flag256thUp',
  '512th':'flag512thUp',
  '1024th':'flag1024thUp'
};
const FLAG_GLYPH_BY_BASE_DOWN: Record<string, string | null> = {
  whole: null, half: null, quarter: null,
  eighth: 'flag8thDown',
  '16th':'flag16thDown',
  '32nd':'flag32ndDown',
  '64th':'flag64thDown',
  '128th':'flag128thDown',
  '256th':'flag256thDown',
  '512th':'flag512thDown',
  '1024th':'flag1024thDown'
};

// The full Bravura rest family (duplexMaxima and 2048th+ have no glyph and
// fall back to restQuarter at emit time).
const REST_GLYPH_BY_BASE: Record<string, string> = {
  maxima: 'restMaxima',
  longa: 'restLonga',
  breve: 'restDoubleWhole',
  whole: 'restWhole',
  half: 'restHalf',
  quarter: 'restQuarter',
  eighth: 'rest8th',
  '16th':'rest16th',
  '32nd':'rest32nd',
  '64th':'rest64th',
  '128th':'rest128th',
  '256th':'rest256th',
  '512th':'rest512th',
  '1024th':'rest1024th'
};

// Rest y-positions (alphabetic baseline = SMuFL origin) relative to staffTop
// Articulations (MNX event.markings → SMuFL), in stacking order from the
// notehead outward. `tremolo` is a stem decoration, not an articulation, and
// is not handled yet; `spiccato` has no glyph in the bundled Bravura subset.
const ARTICULATIONS: { key: keyof MnxEventMarkings; above: string; below: string; forceAbove?: boolean }[] = [
  { key: 'staccato', above: 'articStaccatoAbove', below: 'articStaccatoBelow' },
  { key: 'staccatissimo', above: 'articStaccatissimoAbove', below: 'articStaccatissimoBelow' },
  { key: 'tenuto', above: 'articTenutoAbove', below: 'articTenutoBelow' },
  { key: 'stress', above: 'articStressAbove', below: 'articStressBelow' },
  { key: 'unstress', above: 'articUnstressAbove', below: 'articUnstressBelow' },
  { key: 'accent', above: 'articAccentAbove', below: 'articAccentBelow' },
  { key: 'softAccent', above: 'articSoftAccentAbove', below: 'articSoftAccentBelow' },
  { key: 'strongAccent', above: 'articMarcatoAbove', below: 'articMarcatoBelow', forceAbove: true }
];

const DYNAMIC_BASELINE_DROP_SP = 3.5; // glyph baseline below the bottom staff line

// ---------- Score text (proposed: roadmap/proposed/spec-score-text.md) ----------
//
// Rehearsal marks and sections are score-wide, so they stack above the TOP
// staff of the system, clear of the tempo row. Directions belong to a part and
// sit just outside their own staff, above or below as `orient` says.
//
// The stacking order is fixed by what each object IS, which is the point of
// typing them: a rehearsal mark reads as the outermost index, the section name
// sits under it, and part-level text sits closest to the notes. Nothing in the
// document says so.
const DIRECTION_SIZE_SP = 1.5;
const DIRECTION_RISE_SP = 2.4; // baseline above the staff's top line
const DIRECTION_DROP_SP = 4.2; // baseline below the staff's bottom line, clearing a ledger note
const DIRECTION_STACK_SP = 1.9; // extra offset per coincident direction

// Repeat barlines and volta brackets.
const REPEAT_DOT_SCALE = 1.2;
// Notation dots straddle the middle line ([1.5, 2.5] on a 4sp staff); the
// six-line tab staff's middle is 2.5sp, so its dots sit at ±0.5 of that.
const TAB_REPEAT_DOT_YS = [2, 3];
const VOLTA_RISE_SP = 3.4;  // bracket line above the top staff line
const VOLTA_HOOK_SP = 1.3;
const VOLTA_THICKNESS_SP = 0.13;

// Ottava (octave-shift) lines: "8va"/"8vb"/… label + dashed extent + end hook.
const OTTAVA_THICKNESS_SP = 0.11;
const OTTAVA_DASH_SP = 0.5;       // dash on-length (equal gap)
const OTTAVA_HOOK_SP = 0.9;       // end hook toward the staff
const OTTAVA_CLEARANCE_SP = 1.2;  // gap above the highest note in the span
const OTTAVA_MIN_RISE_SP = 2.0;   // minimum clearance from the staff edge
const OTTAVA_LABEL_SIZE_SP = 1.8;
const OTTAVA_LABEL_GAP_SP = 2.4;  // dashes begin this far past the label
const OTTAVA_END_EXTEND_SP = 1.0; // line runs a touch past the last note

// Slur & tie curves (tapered fills; thickness = mid-curve width).
const SLUR_THICKNESS_SP = 0.22;
const TIE_THICKNESS_SP = 0.2;
const SLUR_END_PAD_SP = 0.8;   // vertical clearance between notehead and slur end
const TIE_END_PAD_SP = 0.55;   // ties hug the noteheads more closely
const TIE_END_GAP_SP = 0.85;   // tie endpoints sit just outside the noteheads
const LV_TIE_LENGTH_SP = 1.3;  // laissez-vibrer hook length

const REST_Y_BY_BASE: Record<string, number> = {
  maxima: 2,      // spans a line either side of the middle line (glyph y ±1)
  longa: 2,       // same vertical span as maxima
  breve: 2,       // sits on the middle line, filling the space above
  whole: 1,       // hangs from line 2 from top (4th line from bottom)
  half: 2,        // sits on middle line
  quarter: 2,    // centred on middle line
  eighth: 2,
  '16th':2,
  '32nd':2,
  '64th':2,
  '128th':2,
  '256th':2,
  '512th':2,
  '1024th':2
};

// ---------- Pitch → staff y ----------

const STEP_ORDER: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

function diatonicStepIndex(step: string, octave: number): number {
  return octave * 7 + (STEP_ORDER[step.toUpperCase()] ?? 0);
}

/**
 * Map a sounding-pitch (step, octave) to a y-coord on the staff (sp from
 * staffTop). Lower y = higher pitch. Clef.octave compensates so the WRITTEN
 * position appears on the staff at the conventional place.
 */
function pitchToStaffY(step: string, octave: number, clef: ActiveClef): number {
  // MNX stores sounding pitch. Treble 8vb (clef.octave=-1) shifts written +1.
  const writtenOctave = octave - clef.octave;
  const noteIndex = diatonicStepIndex(step, writtenOctave);
  if (clef.sign === 'F') {
    const refIndex = diatonicStepIndex('F', 3); // F3 sits on the 4th line from bottom = y=1
    return 1 - (noteIndex - refIndex) * 0.5;
  }
  // Default: treble. G4 sits on the 2nd line from bottom = y=3
  const refIndex = diatonicStepIndex('G', 4);
  return 3 - (noteIndex - refIndex) * 0.5;
}

function clefGlyph(clef: ActiveClef): string {
  if (clef.sign === 'F') return 'fClef';
  if (clef.octave === -1) return 'gClef8vb';
  if (clef.octave === 1) return 'gClef8va';
  return 'gClef';
}

function clefY(clef: ActiveClef, staffTop: number): number {
  // SMuFL clef glyph origin = the staff line the clef pinches around.
  // Treble (and 8vb/8va variants): G4 line = y=3 from staffTop.
  // Bass: F3 line = y=1.
  if (clef.sign === 'F') return staffTop + 1;
  return staffTop + 3;
}

/** Convention: clef changes are drawn smaller than the system-start clef. */
const CLEF_CHANGE_SCALE = 0.66;

/** The clef in effect at metric onset `t` (whole-note fraction into the bar). */
function clefAt(timeline: readonly ClefAt[], t: number): ActiveClef {
  let active = timeline[0]?.clef ?? { sign: 'G' as const, octave: 0 };
  for (const entry of timeline) {
    if (entry.t <= t + 1e-6) active = entry.clef;
  }
  return active;
}

// ---------- Key signatures ----------

// Vertical positions (sp from staffTop) of the conventional accidental columns
// on a treble staff, in signature order. Other clefs shift the whole pattern.
const SHARP_YS_TREBLE = [0, 1.5, -0.5, 1, 2.5, 0.5, 2]; // F C G D A E B
const FLAT_YS_TREBLE = [2, 0.5, 2.5, 1, 3, 1.5, 3.5];   // B E A D G C F
const KEY_SIG_CLEF_OFFSET: Record<ActiveClef['sign'], number> = { G: 0, F: 1, C: 0.5 };

/**
 * Glyph column for a key signature: |fifths| sharps or flats. A change to C
 * (fifths 0) cancels the outgoing key with naturals at its positions —
 * otherwise the change would be invisible.
 */
function keySignatureGlyphs(fifths: number, cancelFifths: number): { glyph: string; y: number }[] {
  const pattern = fifths !== 0 ? fifths : cancelFifths;
  const ys = pattern > 0 ? SHARP_YS_TREBLE : FLAT_YS_TREBLE;
  const glyph =
    fifths === 0 ? 'accidentalNatural' : fifths > 0 ? 'accidentalSharp' : 'accidentalFlat';
  return ys.slice(0, Math.min(Math.abs(pattern), 7)).map(y => ({ glyph, y }));
}

// ---------- Stem direction ----------

function autoStemDir(staffYs: number[]): 1 | -1 {
  // 1 = up, -1 = down. Convention: notes BELOW middle line stem up, AT or
  // ABOVE middle stem down. For chords, use the extreme furthest from middle.
  let maxDistance = 0;
  let dir: 1 | -1 = -1; // default: down (when distance ties at 0, we choose down)
  for (const y of staffYs) {
    const distance = Math.abs(y - STAFF_MIDDLE_Y);
    if (distance > maxDistance) {
      maxDistance = distance;
      dir = y > STAFF_MIDDLE_Y ? 1 : -1; // below middle → up; above middle → down
    }
  }
  return dir;
}

/**
 * Default stem directions for the voices sharing a staff: when none carry a
 * forced direction and there are at least two, the voice with the highest
 * mean pitch stems up and the others down — the engraving convention.
 * Sequence order is NOT reliable for this: spec/multiple-voices lists the
 * lower voice first, spec/tie-targets the upper.
 */
function rankVoiceStems(voices: ResolvedVoice[], clef: ActiveClef): (1 | -1 | null)[] {
  if (voices.length < 2 || voices.some(v => v.stem !== null)) {
    return voices.map(v => v.stem);
  }
  const meanYs = voices.map(({ seq }) => {
    const ys: number[] = [];
    for (const item of seq.content) {
      if (!isTimedEvent(item)) continue;
      for (const n of item.notes ?? []) ys.push(pitchToStaffY(n.pitch.step, n.pitch.octave, clef));
    }
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Infinity;
  });
  const top = meanYs.indexOf(Math.min(...meanYs));
  return meanYs.map((_, vi) => (vi === top ? 1 : -1));
}

// ---------- Ledger lines ----------

function ledgerLinesForNote(staffY: number): number[] {
  const out: number[] = [];
  if (staffY < 0) {
    const top = Math.ceil(staffY);
    for (let l = -1; l >= top; l--) out.push(l);
  } else if (staffY > STAFF_HEIGHT_SP) {
    const bottom = Math.floor(staffY);
    for (let l = STAFF_HEIGHT_SP + 1; l <= bottom; l++) out.push(l);
  }
  return out;
}

function unionLedgerLines(staffYs: number[]): Set<number> {
  const set = new Set<number>();
  for (const y of staffYs) for (const l of ledgerLinesForNote(y)) set.add(l);
  return set;
}

// ---------- Public API ----------

export interface LayoutNotationOptions {
  mnx: MnxStructure;
  widthSp: number;
  activeNoteIds?: readonly string[];
  selectedNoteIds?: readonly string[];
  /**
   * Append each tab-bearing part's tab staff to its system (the `both` view):
   * one system walk, native shared barlines. Limitation: documents declaring
   * `scores` skip injection (their layout trees aren't expanded — no such
   * document exists in the corpus or fixtures today).
   */
  includeTabStaves?: boolean;
  /** Viewer-supplied instrument (strings/capo) — overrides each part's own
   *  declaration for the injected tab staves; never written back. */
  tabSetup?: PartTabSetups;
  /** Features the host asked to hide (docs/core-viewer-surface.md, the `hide`
   *  set). Only LAYOUT-side features belong here — hiding lyrics must reclaim
   *  the vertical band they reserve, which CSS cannot do. Emit-side features
   *  (diagnostic badges) are hidden in the element's stylesheet instead; that
   *  split is the test the surface doc applies to every future candidate. */
  hide?: readonly HideableFeature[];
  /** Horizontal density (core-render-density-zoom.md): a multiplier on the
   *  springs — 1 is today's engraving, <1 packs more bars per system. Glyphs
   *  keep their size; only the air between them changes, which is what makes
   *  this independent of zoom. */
  densityH?: number;
  /** Vertical/frame density (core-vertical-density.md): a multiplier on the
   *  fixed whitespace every system reserves — the row pads above and below a
   *  staff, and the page margins — floored by the ink each row actually
   *  contains. 1 is today's engraving and skips the pass entirely. */
  densityPad?: number;
  /** Ink ratio (core-ink-priced-columns.md): the paint's `pxPerSpY/pxPerSp`.
   *  Rigid columns are ink and re-price by it; packing stays square.
   *  1/unset = today's layout, untouched. */
  inkRatio?: number;
  /**
   * HARNESS AID, not a rendering option: lay out with every ink-measured
   * display gap fixed at this width and skip the measured pass. The
   * conformance tests use it to attribute ink to staves unambiguously (the
   * same reason the engine probes) and then check the real layout's gaps
   * against arithmetic they derive themselves. Never set by a renderer.
   */
  displayGapProbeSp?: number;
}

/** What a host may hide. Layout-side members must be honored HERE (space
 *  reflows); emit-side members are listed for one shared vocabulary but are
 *  handled by the element's CSS. */
export type HideableFeature = 'lyrics' | 'badges';

const TITLE_SIZE_SP = 2.4;
const TITLE_GAP_SP = 1.2;

// Lyrics: verse rows stacked below the staff.
const LYRIC_FIRST_BASELINE_DROP_SP = 4.5; // first verse baseline below bottom line
const LYRIC_LINE_SPACING_SP = 2.2;
const LYRIC_SIZE_SP = 1.7;
const LYRIC_DESCENDER_PAD_SP = 0.8;
// Air between the last verse row's descenders and a native tab staff below it
// (the both view's content-driven inter-staff gap).
const TAB_LYRIC_CLEARANCE_SP = 1;

/** All lyric line ids a segment's parts use, in global lineOrder (then sorted). */
function collectLyricLineIds(mnx: MnxStructure, segment: JobSegment): string[] {
  const used = new Set<string>();
  for (const spec of segment.staves) {
    for (const src of spec.sources) {
      for (const pm of src.part.measures) {
        for (const seq of pm.sequences ?? []) {
          for (const item of seq.content) {
            if (!isTimedEvent(item)) continue;
            for (const id of Object.keys(item.lyrics?.lines ?? {})) used.add(id);
          }
        }
      }
    }
  }
  const order = mnx.global.lyrics?.lineOrder ?? [];
  const ordered = order.filter(id => used.has(id));
  const rest = [...used].filter(id => !order.includes(id)).sort();
  return [...ordered, ...rest];
}

/** A run of staves decorated together: bracket/brace + barline style. */
interface JobGroup {
  start: number;
  count: number;
  symbol: 'brace' | 'bracket' | null;
  /** Barlines drawn per staff rather than spanning the group. */
  individualBarlines: boolean;
  /** Decorated ancestors — nested decorations step left of their parents'. */
  depth: number;
  /** Group label ("Flutes"), centred on the group's vertical span. */
  label: string | null;
}

/** One staff arrangement applied to a measure range — a score renders one
 *  segment per run of consecutive systems sharing a layout. */
interface JobSegment {
  staves: PlanStaff[];
  labels: (string | null)[];
  /** Per staff: labels of its merged sources (the stacked "1"/"2"). */
  sourceLabels: (string[] | null)[];
  groups: JobGroup[];
  forcedBreaks: Set<number>;
  /** Measures this segment covers (inclusive); null = the whole document. */
  range: { from: number; to: number } | null;
  /** Plan at least this many measures — set for structure-only documents
   *  whose systems reference measures that don't exist. */
  minMeasures?: number;
}

/** One renderable presentation of the document (an MNX `score`, or the whole
 *  document when none are declared). */
interface ScoreJob {
  title: string | null;
  segments: JobSegment[];
  collapse: { startIndex: number; count: number }[];
  /** Draw doc-level validation badges on this job only (first job). */
  drawValidation: boolean;
}

type StaffLayout = Pick<JobSegment, 'staves' | 'labels' | 'sourceLabels' | 'groups'>;

/** Expands parts into one staff spec per part-staff, grouped per part
 *  (multi-staff parts get a brace) — the no-layout presentation. */
function defaultStaffLayout(parts: MnxPart[]): StaffLayout {
  const staves: PlanStaff[] = [];
  const labels: (string | null)[] = [];
  const sourceLabels: (string[] | null)[] = [];
  const groups: JobGroup[] = [];
  for (const part of parts) {
    let n = Math.max(1, part.staves ?? 1);
    for (const pm of part.measures) {
      for (const seq of pm.sequences ?? []) n = Math.max(n, seq.staff ?? 1);
    }
    groups.push({
      start: staves.length,
      count: n,
      symbol: n > 1 ? 'brace' : null,
      individualBarlines: false,
      depth: 0,
      label: null
    });
    for (let s = 1; s <= n; s++) {
      staves.push({ sources: [{ part, staff: s }] });
      labels.push(null);
      sourceLabels.push(null);
    }
  }
  return { staves, labels, sourceLabels, groups };
}

/** A node's label: explicit `label`, or `labelref` resolved on `part`. */
function resolveLabel(
  node: { label?: string; labelref?: string },
  part: MnxPart | undefined
): string | null {
  if (node.label) return node.label;
  if (node.labelref && part) {
    const v = (part as unknown as Record<string, unknown>)[node.labelref];
    return typeof v === 'string' ? v : part.name ?? null;
  }
  return null;
}

/** Resolves a layout's content tree into staff specs, labels and groups. */
function resolveLayoutTree(
  content: readonly MnxLayoutContent[] | undefined,
  partById: Map<string, MnxPart>,
  out: StaffLayout,
  decorDepth = 0
): void {
  for (const node of content ?? []) {
    if (node.type === 'group') {
      const symbol =
        node.symbol === 'brace' ? 'brace' : node.symbol === 'none' ? null : 'bracket';
      const start = out.staves.length;
      resolveLayoutTree(node.content, partById, out, decorDepth + (symbol ? 1 : 0));
      const count = out.staves.length - start;
      if (count > 0) {
        out.groups.push({
          start,
          count,
          symbol,
          individualBarlines: node.barlineStyle === 'individual',
          depth: decorDepth,
          label: node.label ?? null
        });
      }
      continue;
    }
    const sources: StaffSource[] = [];
    const srcLabels: (string | null)[] = [];
    for (const src of node.sources ?? []) {
      const part = partById.get(src.part);
      if (!part) continue;
      sources.push({ part, staff: src.staff ?? 1, stem: src.stem });
      srcLabels.push(resolveLabel(src, part));
    }
    if (sources.length === 0) continue;
    let label = resolveLabel(node, sources[0].part);
    // A lone source's label serves as the staff label; merged staves keep
    // per-source labels (the stacked "1"/"2" of shared wind staves).
    let perSource: string[] | null = null;
    if (sources.length === 1) {
      label = label ?? srcLabels[0];
    } else if (srcLabels.some(l => l !== null)) {
      perSource = srcLabels.map(l => l ?? '');
    }
    out.staves.push({ sources });
    out.labels.push(label);
    out.sourceLabels.push(perSource);
  }
}

function buildScoreJobs(mnx: MnxStructure): ScoreJob[] {
  const allParts = mnx.parts ?? [];
  if (allParts.length === 0) return [];
  const scores = mnx.scores ?? [];
  if (scores.length === 0) {
    return [{
      title: null,
      segments: [{ ...defaultStaffLayout(allParts), forcedBreaks: new Set(), range: null }],
      collapse: [],
      drawValidation: true
    }];
  }

  const measureIndexById = new Map<string, number>();
  mnx.global.measures.forEach((gm, i) => {
    if (gm?.id) measureIndexById.set(gm.id, i);
  });
  const partById = new Map(allParts.filter(p => p.id).map(p => [p.id!, p]));
  const layoutById = new Map((mnx.layouts ?? []).map(l => [l.id, l]));

  /** Staff arrangement for a layout id (all parts when unknown/absent). */
  const staffLayoutFor = (layoutId: string | undefined): StaffLayout => {
    const layout = layoutId ? layoutById.get(layoutId) : undefined;
    if (!layout) return defaultStaffLayout(allParts);
    const resolved: StaffLayout = { staves: [], labels: [], sourceLabels: [], groups: [] };
    resolveLayoutTree(layout.content, partById, resolved);
    if (!resolved.staves.length) return defaultStaffLayout(allParts);
    // Staves outside any group still need barlines: singleton groups.
    const covered = new Set<number>();
    for (const g of resolved.groups) {
      for (let k = g.start; k < g.start + g.count; k++) covered.add(k);
    }
    for (let s = 0; s < resolved.staves.length; s++) {
      if (!covered.has(s)) {
        resolved.groups.push({
          start: s, count: 1, symbol: null, individualBarlines: false, depth: 0, label: null
        });
      }
    }
    return resolved;
  };

  return scores.map((score, scoreIndex) => {
    // Each system names its layout (falling back to the score's); a run of
    // consecutive systems sharing a layout renders as one segment with its
    // own staves over its measure range. The common single-layout case is
    // one segment over the whole document.
    const rawSystems = (score.pages ?? [])
      .flatMap(p => p.systems ?? [])
      .map(sys => ({
        layoutId: sys.layout ?? score.layout,
        index: measureIndexById.get(sys.measure)
      }));
    let systems = rawSystems.filter(
      (s): s is { layoutId: string | undefined; index: number } => s.index !== undefined
    );
    // Structure-only documents (spec/orchestral-layout): systems reference
    // measures that don't exist and no part has content. Give each system one
    // synthetic empty measure so its staff arrangement still draws.
    let minMeasures: number | undefined;
    if (systems.length === 0 && rawSystems.length > 0 && mnx.global.measures.length === 0) {
      systems = rawSystems.map((s, k) => ({ layoutId: s.layoutId, index: k }));
      minMeasures = rawSystems.length;
    }

    const segments: JobSegment[] = [];
    if (new Set(systems.map(s => s.layoutId)).size <= 1) {
      segments.push({
        ...staffLayoutFor(systems[0]?.layoutId ?? score.layout),
        forcedBreaks: new Set(systems.map(s => s.index).filter(i => i > 0)),
        range: null,
        minMeasures
      });
    } else {
      for (let k = 0; k < systems.length; ) {
        let end = k + 1;
        while (end < systems.length && systems[end].layoutId === systems[k].layoutId) end++;
        const from = k === 0 ? 0 : systems[k].index;
        const to = end < systems.length ? systems[end].index - 1 : Number.MAX_SAFE_INTEGER;
        segments.push({
          ...staffLayoutFor(systems[k].layoutId),
          forcedBreaks: new Set(
            systems.slice(k, end).map(s => s.index).filter(i => i > from)
          ),
          range: { from, to },
          minMeasures
        });
        k = end;
      }
    }

    const collapse = (score.multimeasureRests ?? [])
      .map(r => ({
        startIndex: measureIndexById.get(r.start) ?? -1,
        count: Math.max(1, r.duration ?? 1)
      }))
      .filter(c => c.startIndex >= 0);
    return {
      title: score.name ?? null,
      segments,
      collapse,
      drawValidation: scoreIndex === 0
    };
  });
}

export function layoutNotation(opts: LayoutNotationOptions): LayoutResult {
  const { mnx, widthSp } = opts;
  const activeNoteIds = opts.activeNoteIds ?? [];
  const selectedNoteIds = opts.selectedNoteIds ?? [];

  const primitives: Primitive[] = [];
  const index: SpatialIndex = new Map();
  const diagnostics: LayoutDiagnostic[] = [];

  const jobs = buildScoreJobs(mnx);
  if (jobs.length === 0) {
    const staffTop = MARGIN_SP + ROW_PAD_TOP_SP;
    return {
      primitives, widthSp, heightSp: ROW_HEIGHT_SP + 2 * MARGIN_SP, usedWidthSp: widthSp,
      index, diagnostics, rows: [{ staffTop, staffBottom: staffTop + STAFF_HEIGHT_SP }]
    };
  }

  // Each score renders as its own block (title + segments), stacked
  // vertically; a segment is one staff arrangement over a measure range
  // (per-system layouts give a score several). The single-untitled-job case
  // translates by 0 — byte-identical output.
  let cursorY = 0;
  let usedWidthSp = 0;
  const rows: RowBandSp[] = [];
  const displays: RowBandSp[][] = [];
  // One per laid-out segment: a score with per-system layouts packs each range
  // separately, and a density value is only degenerate when it changes NONE of
  // them.
  const packings: PackingInput[] = [];
  for (const job of jobs) {
    const rs = job.segments.map(segment =>
      renderSegment({
        mnx,
        segment,
        collapse: job.collapse,
        drawValidation: job.drawValidation,
        widthSp,
        activeNoteIds,
        selectedNoteIds,
        index,
        diagnostics,
        includeTabStaves: opts.includeTabStaves === true && (mnx.scores ?? []).length === 0,
        tabSetup: opts.tabSetup,
        hide: opts.hide ?? [],
        densityH: opts.densityH,
        densityPad: opts.densityPad,
        inkRatio: opts.inkRatio,
        displayGapProbeSp: opts.displayGapProbeSp
      })
    );
    const jobUsed = Math.max(...rs.map(r => r.usedWidthSp));
    if (job.title !== null) {
      cursorY += TITLE_SIZE_SP + 1;
      primitives.push({
        kind: 'text',
        text: job.title,
        x: jobUsed / 2,
        y: cursorY,
        font: 'body',
        size: TITLE_SIZE_SP,
        anchor: 'middle',
        className: 'score-title'
      });
      cursorY += TITLE_GAP_SP;
    }
    for (const r of rs) {
      packings.push(r.packing);
      if (cursorY !== 0) {
        for (const p of r.primitives) translatePrimitiveY(p, cursorY);
      }
      primitives.push(...r.primitives);
      for (const band of r.rows) {
        rows.push({ staffTop: band.staffTop + cursorY, staffBottom: band.staffBottom + cursorY });
      }
      for (const bands of r.displays) {
        displays.push(bands.map(b => ({ staffTop: b.staffTop + cursorY, staffBottom: b.staffBottom + cursorY })));
      }
      cursorY += r.heightSp;
    }
    usedWidthSp = Math.max(usedWidthSp, jobUsed);
  }

  // Vertical density last, over the finished score: rows are re-placed against
  // the ink they hold rather than the headroom they reserved. At density 1 the
  // pass returns null and nothing moves — which is what keeps the goldens
  // byte-identical by construction rather than by arithmetic.
  const tightened = tightenRows({
    primitives, rows, heightSp: cursorY, padDensity: clampPadDensity(opts.densityPad)
  });

  return {
    primitives, widthSp, heightSp: tightened?.heightSp ?? cursorY, usedWidthSp, index, diagnostics,
    rows: tightened?.rows ?? rows,
    // Display bands ride with their rows when the density pass moves them.
    displays: tightened
      ? displays.map((bands, r) => {
          const dy = tightened.rows[r].staffTop - rows[r].staffTop;
          return bands.map(b => ({ staffTop: b.staffTop + dy, staffBottom: b.staffBottom + dy }));
        })
      : displays,
    packings
  };
}

interface RenderSegmentArgs {
  mnx: MnxStructure;
  segment: JobSegment;
  collapse: { startIndex: number; count: number }[];
  drawValidation: boolean;
  widthSp: number;
  activeNoteIds: readonly string[];
  selectedNoteIds: readonly string[];
  index: SpatialIndex;
  diagnostics: LayoutDiagnostic[];
  includeTabStaves: boolean;
  tabSetup?: PartTabSetups;
  hide: readonly HideableFeature[];
  densityH?: number;
  densityPad?: number;
  inkRatio?: number;
  displayGapProbeSp?: number;
}

/** One laid-out segment: what `layoutNotation` stacks. */
interface SegmentResult {
  primitives: Primitive[];
  heightSp: number;
  usedWidthSp: number;
  rows: RowBandSp[];
  /** Per row, per display staff (notation staves and injected tab staves in
   *  display order): the band between its top and bottom line. */
  displays: RowBandSp[][];
  /** Display indexes that are injected tab staves. */
  tabDisplayIndexes: Set<number>;
  /** This segment's system-packing input — carried up so a host can ask what
   *  other densities would draw (spacing.ts `densityLadder`). */
  packing: PackingInput;
}

/**
 * Lays a segment out twice when its staff gaps are ink-measured: the first
 * pass, at the provisional gaps, is where the ink turns out to be; the second
 * places each display staff `SEPARATION_CLEAR_SP` clear of the ink above it.
 * Segments with nothing to measure (stage B: no tab staff) return the first
 * pass untouched — byte-identical by construction, not by arithmetic.
 */
function renderSegment(args: RenderSegmentArgs): SegmentResult {
  // A harness asking for the probe itself gets it, and no second pass.
  if (args.displayGapProbeSp !== undefined) return assembleSegment(args, null, args.displayGapProbeSp);
  // The probe opens only the gaps that will be measured; a segment with none
  // (a single staff) lays out at its provisional gaps and returns.
  const probe = assembleSegment(args, null, PROBE_GAP_SP);
  const overrides = measureDisplayGaps(probe, clampPadDensity(args.densityPad));
  return overrides ? assembleSegment(args, overrides, null) : probe;
}

/**
 * Per row, per display: the line-to-line gap above a display staff that keeps
 * `SEPARATION_CLEAR_SP` between the ink of the two bands, or null where the
 * gap stays provisional. Null overall when no gap is measured.
 *
 * Ink is what the first pass drew, measured through the same SMuFL boxes
 * `tightenRows` trusts; a primitive belongs to the band its anchor falls in
 * (midpoints between bands), and structural primitives — barlines, braces,
 * the staff lines — are not ink. Ownership only matters for something that
 * straddles a boundary, and those are exactly the structural ones.
 */
function measureDisplayGaps(seg: SegmentResult, padK: number): (number | null)[][] | null {
  const { primitives, rows, displays, tabDisplayIndexes } = seg;
  const displayCount = displays[0]?.length ?? 0;
  const measured = (d: number) => isMeasuredGap(d, tabDisplayIndexes);
  if (!Array.from({ length: displayCount }, (_, d) => d).some(measured)) return null;

  const rowBounds = rows.slice(0, -1).map((b, r) => (b.staffBottom + rows[r + 1].staffTop) / 2);
  const rowOf = (y: number) => {
    let r = 0;
    while (r < rowBounds.length && y >= rowBounds[r]) r++;
    return r;
  };
  const buckets: Primitive[][][] = displays.map(bands => bands.map(() => []));
  // Content placed BY the gap rather than by a staff — a `between` direction
  // sits at the gap's midpoint — is not a demand on either side; it is
  // something the gap must be wide enough to hold, collected per gap.
  const gapContent: Primitive[][][] = displays.map(bands => bands.map(() => []));
  for (const p of primitives) {
    const tokens = (p.className ?? '').split(' ');
    if (STRUCTURAL_CLASSES.has(tokens[0])) continue;
    const y = anchorY(p);
    const r = rowOf(y);
    const bands = displays[r];
    if (tokens.includes('direction-between')) {
      let d = 1;
      while (d + 1 < bands.length && y >= bands[d].staffTop) d++;
      gapContent[r][d].push(p);
      continue;
    }
    let d = 0;
    while (d + 1 < bands.length && y >= (bands[d].staffBottom + bands[d + 1].staffTop) / 2) d++;
    buckets[r][d].push(p);
  }

  // The pad axis scales the clearances, not the pads (the doc's ruling 2);
  // floored so a pad of 0 still leaves a visible gap, never overlap.
  const sep = Math.max(1, SEPARATION_CLEAR_SP * padK);
  const minGap = Math.max(1, MIN_STAFF_GAP_SP * padK);
  return displays.map((bands, r) =>
    bands.map((band, d) => {
      if (!measured(d)) return null;
      const upper = bands[d - 1];
      const upperInk = computeBoundsSp(buckets[r][d - 1]);
      const lowerInk = computeBoundsSp(buckets[r][d]);
      const inkBelow = Math.max(0, (upperInk ? upperInk.y + upperInk.h : upper.staffBottom) - upper.staffBottom);
      const inkAbove = Math.max(0, band.staffTop - (lowerInk ? lowerInk.y : band.staffTop));
      // Gap content is centred on the line-to-line gap, so it clears both
      // sides only when the gap is twice the larger ink reach plus its own
      // height, with a clearance on each side.
      const held = computeBoundsSp(gapContent[r][d])?.h ?? 0;
      const forContent = held > 0 ? 2 * Math.max(inkBelow, inkAbove) + 2 * sep + held : 0;
      return Math.max(inkBelow + inkAbove + sep, forContent, minGap);
    })
  );
}

// Left-of-system geometry: nested decorations step left of their parents,
// staff/source labels sit left of all decorations, group labels leftmost.
const DECOR_BASE_SP = 1.2;
const DECOR_STEP_SP = 1.6;
const BRACE_STAFF_GAP_SP = 0.4; // gap between the brace's belly and the staff/start barline
const LABEL_CHAR_SP = 1.0;
const LABEL_PAD_SP = 0.6;

function assembleSegment(
  args: RenderSegmentArgs,
  /** Per row, per display: a measured line-to-line gap above the display, or
   *  null to keep the provisional one. Null overall = first pass. */
  gapOverrides: (number | null)[][] | null,
  /** Probe pass: open every gap that will be measured to this width. */
  probeGapSp: number | null
): SegmentResult {
  const { mnx, segment, collapse, drawValidation, widthSp, activeNoteIds, selectedNoteIds, index, diagnostics, includeTabStaves, tabSetup, hide, densityH, densityPad, inkRatio } = args;
  const primitives: Primitive[] = [];

  const useAccidentalDisplay = mnx.mnx?.support?.useAccidentalDisplay === true;
  // Staff/source labels, group labels and (nested) group decorations sit left
  // of the system inside an extra inset, so the music shifts right for them.
  // Per staff, source labels ("1"/"2") stack right-aligned at the label edge
  // and the staff label sits left of them.
  const srcLabelW = (s: number) => {
    const src = segment.sourceLabels[s];
    return src ? Math.max(0, ...src.map(l => l.length)) * LABEL_CHAR_SP : 0;
  };
  const staffLabelSpan = (s: number) => {
    const labW = (segment.labels[s]?.length ?? 0) * LABEL_CHAR_SP;
    const srcW = srcLabelW(s);
    return labW && srcW ? labW + 0.4 + srcW : labW || srcW;
  };
  const maxStaffSpan = Math.max(0, ...segment.staves.map((_, s) => staffLabelSpan(s)));
  const groupLabelLen = Math.max(
    0,
    ...segment.groups.map(g => g.label?.length ?? 0)
  );
  const decorated = segment.groups.filter(g => g.symbol !== null);
  const decorWidthSp = decorated.length
    ? DECOR_BASE_SP + Math.max(...decorated.map(g => g.depth)) * DECOR_STEP_SP + 0.5
    : 0;
  const staffLabelW = maxStaffSpan ? maxStaffSpan + LABEL_PAD_SP : 0;
  const groupLabelW = groupLabelLen ? groupLabelLen * LABEL_CHAR_SP + LABEL_PAD_SP : 0;
  const leftInsetSp = decorWidthSp + staffLabelW + groupLabelW;

  // All horizontal decisions (system packing, bar widths, event x positions)
  // come from the shared plan — layoutTab consumes the same one, which is what
  // keeps notation and tab column-aligned in the "both" view.
  const plan = planHorizontal(mnx, widthSp, {
    densityH,
    densityPad,
    inkRatio,
    staves: segment.staves,
    leftInsetSp,
    collapse,
    forcedBreaks: segment.forcedBreaks,
    measureRange: segment.range ?? undefined,
    minMeasures: segment.minMeasures
  });
  const numMeasures = plan.measures.length;

  // ---- Display staves: the plan's notation staves plus, in the `both` view,
  // each tab-bearing part's tab staff appended after its notation staves.
  // The plan and every plan-indexed subsystem (beams, curves, ottavas,
  // dynamics, lyrics, labels) stay blind to tab staves — this overlay owns
  // vertical geometry and the extra emission only. Phase 2 of
  // roadmap/complete/core-both-view-single-system.md.
  const tabParts: MnxPart[] = [];
  if (includeTabStaves && segment.staves.length) {
    const inSegment = new Set<MnxPart>();
    for (const st of segment.staves) for (const src of st.sources) inSegment.add(src.part);
    // A part can bear a tab staff only when its strings are KNOWN — declared
    // in the document or supplied by the viewer override. No instrument is
    // ever assumed. Which known-strings parts bear one:
    //  - a part opting in via staffKind — the document's own hint, or the
    //    override's (an explicitly targeted part shows its fingerboard even
    //    when the document never opted it into tab);
    //  - in a document where NO part declares a preference, every part with
    //    known strings — the view promised tab staves and nothing says whose
    //    (the per-part generalization of the old first-candidate fallback;
    //    kind-less documents make no both goldens, `wantsTab` gates those).
    // If none qualify, the promise cannot be kept and the both view degrades
    // to notation alone.
    const anyDeclaredKind = (mnx.parts ?? []).some(p => {
      const kind = p._x?.mnxLab?.tab?.staffKind;
      return kind === 'both' || kind === 'tab';
    });
    for (const p of mnx.parts ?? []) {
      const kind = resolveTabSetup(tabSetup, p)?.staffKind ?? p._x?.mnxLab?.tab?.staffKind;
      const opted = kind === 'both' || kind === 'tab';
      if (
        inSegment.has(p) &&
        (opted || !anyDeclaredKind) &&
        tabPositionContext(p, tabSetup) !== null
      ) {
        tabParts.push(p);
      }
    }
  }
  const lastPlanStaffOf = new Map<MnxPart, number>();
  segment.staves.forEach((st, s) => {
    for (const src of st.sources) lastPlanStaffOf.set(src.part, s);
  });
  /** Display index per plan staff, staff heights per display staff, and the
   *  injected tab staves (each reading its part's staff-1 plan slots). */
  const displayOfPlan: number[] = [];
  const displayHeights: number[] = [];
  const tabDisplays: {
    part: MnxPart;
    planStaff: number;
    displayIndex: number;
    ctx: TabPositionContext;
  }[] = [];
  const tabByAnchorPlan = new Map<number, number>(); // plan staff -> tab display index
  segment.staves.forEach((_st, s) => {
    displayOfPlan.push(displayHeights.length);
    displayHeights.push(STAFF_HEIGHT_SP);
    for (const part of tabParts) {
      if (lastPlanStaffOf.get(part) !== s) continue;
      const staffOne = segment.staves.findIndex(cand =>
        cand.sources.some(src => src.part === part && src.staff === 1)
      );
      tabDisplays.push({
        part,
        planStaff: staffOne >= 0 ? staffOne : s,
        displayIndex: displayHeights.length,
        // Non-null by construction: tabParts only admits parts with a context.
        ctx: tabPositionContext(part, tabSetup)!
      });
      tabByAnchorPlan.set(s, displayHeights.length);
      displayHeights.push(TAB_STAFF_HEIGHT_SP);
    }
  });
  if (displayHeights.length === 0) {
    displayOfPlan.push(0);
    displayHeights.push(STAFF_HEIGHT_SP);
  }
  const displayCount = displayHeights.length;

  // Beams are resolved part-wide (groups may reference events in a later
  // measure) and split at system breaks. Beamed events defer their stems —
  // collected per run during emission, drawn against the beam line after.
  const beams = buildBeamRuns(mnx, segment, plan);

  // Slur/tie endpoints can live anywhere in the document (later measures,
  // other voices), so emission records every note-carrying event's geometry
  // here and a post-pass draws the curves once all anchors exist.
  const curveAnchors: CurveAnchors = {
    byKey: new Map(),
    byEventId: new Map(),
    byNoteId: new Map()
  };

  // Synthetic note keys encode the walk in model/noteWalk.ts, which now spans
  // every part's staff 1 (campaign item 13b). A staff may synthesize them when
  // it shows exactly one part's staff 1 — and it keys them with THAT part's
  // index, so the cursor and the overlay agree wherever the cursor goes.
  const synthesizePartForStaff = segment.staves.map(staff => {
    if (staff.sources.length !== 1) return null;
    const index = (mnx.parts ?? []).indexOf(staff.sources[0].part);
    // Any staff showing exactly one part's ONE staff can key its notes — the
    // grand staff's lower half included (campaign item 13c).
    return index >= 0 ? { partIndex: index, staffIndex: staff.sources[0].staff ?? 1 } : null;
  });
  const synthesizeKeysForStaff0 = synthesizePartForStaff[0] !== null;

  // Semantic validation (user-fixable, e.g. bar duration arithmetic) — merged
  // into each measure's diagnostic markers alongside renderer-gap issues.
  // Drawn on the first job only, so stacked scores don't repeat the badges.
  type AnchoredIssue = MeasureIssue & {
    at?: { voiceIndex: number; eventIndex: number };
    scope?: 'tab';
  };
  const validationByMeasure = new Map<number, AnchoredIssue[]>();
  if (drawValidation) {
    // Fingerboard checks judge against the same strings the tab staves derive
    // with — including a viewer override — or an unreachable note would
    // vanish with no badge.
    for (const v of validateDocument(mnx, tabSetup)) {
      // `scope: 'tab'` issues are fingerboard constraints — the notation staff
      // engraves those bars correctly, so a badge would be noise UNLESS this
      // system draws the fingerboard too (native tab staves).
      if (v.scope === 'tab' && tabDisplays.length === 0) continue;
      const list = validationByMeasure.get(v.measureIndex) ?? [];
      list.push({
        kind: v.severity === 'warning' ? 'warning' : 'validation',
        message: v.message,
        ...(v.at ? { at: v.at } : {}),
        ...(v.scope ? { scope: v.scope } : {})
      });
      validationByMeasure.set(v.measureIndex, list);
    }
  }

  const numStaves = plan.numStaves;
  // Verse rows hang below the staff their events are on. Their block height
  // drives two things: extra bottom padding when they hang below the system,
  // and (both view) the gap above an injected tab staff.
  // Hiding lyrics is a LAYOUT concern: an empty id list both skips the draw
  // (each syllable looks its line up in this array) and zeroes the reserved
  // band below, so the system closes up instead of leaving a gap.
  const lyricLineIds = hide.includes('lyrics') ? [] : collectLyricLineIds(mnx, segment);
  const lyricBlockSp = lyricLineIds.length
    ? LYRIC_FIRST_BASELINE_DROP_SP +
      (lyricLineIds.length - 1) * LYRIC_LINE_SPACING_SP +
      LYRIC_DESCENDER_PAD_SP
    : 0;
  const tabDisplayIndexes = new Set(tabDisplays.map(td => td.displayIndex));
  // Bottom padding absorbs the verse rows only when they actually hang below
  // the system — with a tab staff at the bottom they sit between the staves,
  // and the gap above it (not the pad below it) is what clears them.
  const lyricExtraSp =
    lyricBlockSp && !tabDisplayIndexes.has(displayCount - 1)
      ? Math.max(0, lyricBlockSp - ROW_PAD_BOTTOM_SP)
      : 0;
  // The PROVISIONAL gap above each display staff — the first pass's frame.
  // Constant between notation staves (the goldens pin that arithmetic); above
  // an injected tab staff it is lyric-aware, so the pass that measures the
  // ink starts from a layout where verse rows already clear the strings.
  const provisionalGapSp = (d: number) =>
    tabDisplayIndexes.has(d)
      ? Math.max(INTER_STAFF_GAP_SP, lyricBlockSp + TAB_LYRIC_CLEARANCE_SP)
      : INTER_STAFF_GAP_SP;
  // The second pass hands back measured gaps PER ROW: a staff gap has to hold
  // along its whole system, and each system's ink is its own.
  const rowCount = Math.max(1, plan.rowCount);
  const gapAboveSp = (row: number, d: number) =>
    gapOverrides?.[row]?.[d] ??
    (probeGapSp !== null && isMeasuredGap(d, tabDisplayIndexes) ? probeGapSp : provisionalGapSp(d));
  // Per row, per display: staff tops as prefix sums — the old uniform
  // arithmetic (s * (STAFF_HEIGHT + GAP)) generalized to mixed staff heights
  // and per-row gaps. Without overrides every row's sums are equal term for
  // term to the old single array, so the goldens cannot move.
  const displayPrefixByRow: number[][] = [];
  const systemHeightByRow: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    const prefix: number[] = [];
    let heightSum = 0;
    let gapSum = 0;
    displayHeights.forEach((h, d) => {
      if (d > 0) gapSum += gapAboveSp(r, d);
      prefix.push(heightSum + gapSum);
      heightSum += h;
    });
    displayPrefixByRow.push(prefix);
    systemHeightByRow.push(ROW_PAD_TOP_SP + heightSum + gapSum + ROW_PAD_BOTTOM_SP + lyricExtraSp);
  }
  const rowBaseOf = (row: number) => {
    let y = MARGIN_SP;
    for (let r = 0; r < row; r++) y += systemHeightByRow[r];
    return y;
  };
  const displayTopOf = (row: number, d: number) =>
    rowBaseOf(row) + ROW_PAD_TOP_SP + displayPrefixByRow[row][d];
  const staffTopOf = (row: number, s: number) => displayTopOf(row, displayOfPlan[s]);

  // Lyric syllables collected per (staff, line) in document order; hyphens
  // join start/middle syllables to their successor after the loop.
  interface LyricSyllable {
    x: number;
    y: number;
    text: string;
    continues: boolean;
  }
  const lyricRuns = new Map<string, LyricSyllable[]>();

  // Ottava lines are a post-pass (they cross measures/system breaks), but their
  // endpoints anchor to note columns — so capture each measure's onset→x maps
  // during the loop when the document has any ottava. Keyed by measure index,
  // one OnsetX[] per staff.
  const ottavaSpans = (mnx.parts ?? []).some(p => (p.measures ?? []).some(pm => pm?.ottavas?.length))
    ? collectOttavaSpans(mnx, segment)
    : [];
  const ottavaOnsets = ottavaSpans.length ? new Map<number, OnsetX[][]>() : null;

  // Where each row's primitives begin in the measure loop — rows are emitted
  // in order — so the text pass can scan exactly one row's ink.
  const rowLoopStart: number[] = [];
  for (let i = 0; i < numMeasures; i++) {
    const m = plan.measures[i];
    if (m.hidden) continue;
    if (rowLoopStart[m.row] === undefined) rowLoopStart[m.row] = primitives.length;
    const staffTops = Array.from({ length: numStaves }, (_, s) => staffTopOf(m.row, s));
    const staffBottoms = staffTops.map(t => t + STAFF_HEIGHT_SP);
    // The system's top staff / overall bottom — barlines span the lot,
    // native tab staves included.
    const staffTop = staffTops[0];
    const sysBottom = displayTopOf(m.row, displayCount - 1) + displayHeights[displayCount - 1];

    // Staff lines, per staff
    for (const top of staffTops) {
      for (let s = 0; s < STAFF_LINES; s++) {
        const lineY = top + s;
        primitives.push({
          kind: 'line',
          x1: m.x, y1: lineY, x2: m.x + m.width, y2: lineY,
          thickness: STAFF_LINE_THICKNESS_SP,
          className: 'staff-line'
        });
      }
    }

    if (m.firstInSystem) {
      // A system-start barline binds MULTIPLE staves into a system; a single
      // staff conventionally has an open left end (as the reference engravings
      // do), so only draw it for grand-staff / multi-part / notation+tab systems.
      if (displayCount > 1) {
        primitives.push({
          kind: 'line',
          x1: m.x, y1: staffTop, x2: m.x, y2: sysBottom,
          thickness: BARLINE_THICKNESS_SP,
          className: 'barline barline-start'
        });
      }
      // Group decorations (brace / bracket) left of the start barline; nested
      // decorations step further left of their parent's, per the reference
      // engravings (the flutes sub-brace sits left of the winds bracket).
      for (const g of segment.groups) {
        if (!g.symbol) continue;
        const top = staffTops[g.start];
        const bottom = staffBottoms[g.start + g.count - 1];
        const gx = m.x - DECOR_BASE_SP - g.depth * DECOR_STEP_SP;
        if (g.symbol === 'brace') {
          // The brace is a font glyph, so it scales in BOTH axes; its belly
          // widens with the staff span. Anchor by the glyph's right ink edge so
          // the gap to the staff stays constant (otherwise a tall grand/organ
          // staff's belly overruns the staff). `bb.x + bb.w` = east ink extent.
          const braceScale = (bottom - top) / BRACE_DESIGN_HEIGHT_SP;
          const bb = glyphBBox('brace');
          const braceRightInk = ((bb?.x ?? 0) + (bb?.w ?? 0.33)) * braceScale;
          primitives.push({
            kind: 'glyph',
            glyph: 'brace',
            x: m.x - g.depth * DECOR_STEP_SP - BRACE_STAFF_GAP_SP - braceRightInk,
            y: bottom,
            scale: braceScale,
            className: 'brace'
          });
        } else {
          const bx = gx - 0.2;
          primitives.push({
            kind: 'rect',
            x: bx, y: top - 0.1, w: 0.5, h: bottom - top + 0.2,
            fill: 'currentColor',
            className: 'bracket'
          });
          primitives.push({ kind: 'glyph', glyph: 'bracketTop', x: bx, y: top - 0.1, className: 'bracket' });
          primitives.push({ kind: 'glyph', glyph: 'bracketBottom', x: bx, y: bottom + 0.1, className: 'bracket' });
        }
      }

      // Staff labels (and stacked per-source labels for merged staves),
      // right-aligned left of all decorations; a staff carrying both puts
      // its label left of the source-label stack ("Oboes 1/2").
      const labelX = m.x - decorWidthSp - LABEL_PAD_SP;
      segment.labels.forEach((label, s) => {
        if (!label) return;
        const srcW = srcLabelW(s);
        primitives.push({
          kind: 'text',
          text: label,
          x: labelX - (srcW ? srcW + 0.4 : 0),
          y: staffTops[s] + STAFF_MIDDLE_Y + 0.6,
          font: 'body',
          size: 1.6,
          anchor: 'end',
          className: 'staff-label'
        });
      });
      segment.sourceLabels.forEach((srcLabels, s) => {
        if (!srcLabels) return;
        srcLabels.forEach((text, k) => {
          if (!text) return;
          // Stack within the staff: source k of n centres on its band.
          const y = staffTops[s] + ((k + 0.5) / srcLabels.length) * STAFF_HEIGHT_SP;
          primitives.push({
            kind: 'text',
            text,
            x: labelX,
            y: y + 0.5,
            font: 'body',
            size: 1.4,
            anchor: 'end',
            className: 'source-label'
          });
        });
      });

      // Group labels sit just left of their OWN group's staff labels — not the
      // system's widest (a group whose staves carry short source labels like
      // "2." would otherwise be shoved far left of its brace) — centred on the
      // group's vertical span.
      for (const g of segment.groups) {
        if (!g.label) continue;
        let ownStaffSpan = 0;
        for (let s = g.start; s < g.start + g.count; s++) {
          ownStaffSpan = Math.max(ownStaffSpan, staffLabelSpan(s));
        }
        const groupLabelX = labelX - (ownStaffSpan ? ownStaffSpan + LABEL_PAD_SP : 0);
        primitives.push({
          kind: 'text',
          text: g.label,
          x: groupLabelX,
          y: (staffTops[g.start] + staffBottoms[g.start + g.count - 1]) / 2 + 0.6,
          font: 'body',
          size: 1.6,
          anchor: 'end',
          className: 'group-label'
        });
      }
    }

    if (m.showClef) {
      for (let s = 0; s < numStaves; s++) {
        const staffClef = m.clefTimelines[s][0].clef;
        primitives.push({
          kind: 'glyph',
          glyph: clefGlyph(staffClef),
          x: m.clefX,
          y: clefY(staffClef, staffTops[s]),
          className: 'clef'
        });
      }
    }

    // Spans a group's barlines: one run for the whole group, or one per staff
    // when the layout asks for individual barlines. A part's native tab staff
    // hangs off its last notation staff, so the group's run extends to it.
    const groupBottom = (g: JobGroup): number => {
      const lastPlan = g.start + g.count - 1;
      const tabDisplay = tabByAnchorPlan.get(lastPlan);
      return tabDisplay !== undefined
        ? displayTopOf(m.row, tabDisplay) + TAB_STAFF_HEIGHT_SP
        : staffBottoms[lastPlan];
    };
    const groupSpans = (g: JobGroup): [number, number][] =>
      g.individualBarlines
        ? Array.from({ length: g.count }, (_, k): [number, number] => [
            staffTops[g.start + k],
            staffBottoms[g.start + k]
          ])
        : [[staffTops[g.start], groupBottom(g)]];

    // Forward repeat |: — thick + thin per group span, dots per staff.
    if (m.repeatStart) {
      const thinX = m.repeatStartX + FINAL_BARLINE_THICK_SP + FINAL_BARLINE_GAP_SP;
      for (const g of segment.groups) {
        for (const [gTop, gBottom] of groupSpans(g)) {
          primitives.push({
            kind: 'rect',
            x: m.repeatStartX, y: gTop,
            w: FINAL_BARLINE_THICK_SP, h: gBottom - gTop,
            fill: 'currentColor',
            className: 'barline repeat-start'
          });
          primitives.push({
            kind: 'line',
            x1: thinX, y1: gTop, x2: thinX, y2: gBottom,
            thickness: BARLINE_THICKNESS_SP,
            className: 'barline repeat-start'
          });
        }
      }
      for (const top of staffTops) {
        for (const dotY of [1.5, 2.5]) {
          primitives.push({
            kind: 'glyph',
            glyph: 'augmentationDot',
            x: thinX + 0.4,
            y: top + dotY,
            scale: REPEAT_DOT_SCALE,
            className: 'repeat-dot'
          });
        }
      }
      // Native tab staves carry their own dots (published tab repeats do),
      // straddling the middle of the six-line staff the way the notation
      // dots straddle the middle line.
      for (const td of tabDisplays) {
        const tabTop = displayTopOf(m.row, td.displayIndex);
        for (const dotY of TAB_REPEAT_DOT_YS) {
          primitives.push({
            kind: 'glyph',
            glyph: 'augmentationDot',
            x: thinX + 0.4,
            y: tabTop + dotY,
            scale: REPEAT_DOT_SCALE,
            className: 'repeat-dot'
          });
        }
      }
    }

    // Mid-measure clef changes, at the column the plan reserved for them.
    for (const cc of m.clefChanges) {
      primitives.push({
        kind: 'glyph',
        glyph: clefGlyph(cc.clef),
        x: cc.x,
        y: clefY(cc.clef, staffTops[cc.staff - 1] ?? staffTop),
        scale: CLEF_CHANGE_SCALE,
        className: 'clef clef-change'
      });
    }

    if (m.showKeySig) {
      for (let s = 0; s < numStaves; s++) {
        const clefShift = KEY_SIG_CLEF_OFFSET[m.clefTimelines[s][0].clef.sign];
        keySignatureGlyphs(m.keyFifths, m.cancelledKeyFifths).forEach((g, idx) => {
          primitives.push({
            kind: 'glyph',
            glyph: g.glyph,
            // The run's advance is ink-priced like the slot the plan reserved
            // for it, so the glyphs fill their column rather than cluster at
            // its left edge under a non-square scale.
            x: m.keySigX + idx * KEY_SIG_GLYPH_ADVANCE_SP * plan.inkRatio,
            y: staffTops[s] + g.y + clefShift,
            className: 'key-sig'
          });
        });
      }
    }

    if (m.showTimeSig) {
      for (const top of staffTops) {
        // `display: common/cut` → a single symbol glyph centred on the middle
        // line, instead of the count/unit numerals.
        if (m.timeSig.display === 'common' || m.timeSig.display === 'cut') {
          primitives.push({
            kind: 'glyph',
            glyph: m.timeSig.display === 'cut' ? 'timeSigCutCommon' : 'timeSigCommon',
            x: m.timeSigCentreX,
            y: top + STAFF_MIDDLE_Y,
            anchor: 'middle',
            className: 'time-sig'
          });
          continue;
        }
        const numY = top + 1; // visual centre of upper half (line 2 from top)
        const denY = top + 3; // visual centre of lower half
        for (const digit of String(m.timeSig.count)) {
          primitives.push({
            kind: 'glyph', glyph: 'timeSig' + digit,
            x: m.timeSigCentreX, y: numY, anchor: 'middle',
            className: 'time-sig-num'
          });
        }
        for (const digit of String(m.timeSig.unit)) {
          primitives.push({
            kind: 'glyph', glyph: 'timeSig' + digit,
            x: m.timeSigCentreX, y: denY, anchor: 'middle',
            className: 'time-sig-den'
          });
        }
      }
    }

    // Voices per staff — the SAME resolution the plan used (multi-source
    // staves merge/split here too). Multimeasure-rest stand-ins carry none.
    const resolvedByStaff: ResolvedVoice[][] = segment.staves.map(spec =>
      m.multiRest ? [] : resolveStaffVoices(spec, i)
    );
    const stdSequences = resolvedByStaff[0].map(v => v.seq);

    // The H-bar multimeasure rest: thick bar with end caps on every staff,
    // count in time-signature digits above.
    if (m.multiRest) {
      const x1 = m.contentStartX + 0.6;
      const x2 = m.x + m.width - 1.0;
      for (const top of staffTops) {
        primitives.push({
          kind: 'rect',
          x: x1, y: top + 1.5, w: x2 - x1, h: 1,
          // The bar spans the measure: its width is x2 − x1, so it has to
          // scale with x or it would stop meeting its own end caps.
          spanW: true,
          fill: 'currentColor',
          className: 'multirest-bar'
        });
        for (const xe of [x1, x2]) {
          primitives.push({
            kind: 'line',
            x1: xe, y1: top + 1, x2: xe, y2: top + 3,
            thickness: 0.25,
            className: 'multirest-cap'
          });
        }
        const digits = String(m.multiRest).split('');
        digits.forEach((d, di) => {
          primitives.push({
            kind: 'glyph',
            glyph: 'timeSig' + d,
            x: (x1 + x2) / 2 + (di - (digits.length - 1) / 2) * 1.9,
            y: top - 0.8,
            anchor: 'middle',
            className: 'multirest-count'
          });
        });
      }
    }

    // Validation issues (user-fixable), the plan's issues (unsupported items),
    // plus anything an individual event throws (forgiving render) — one bad
    // event must not take down the bar. Fingerboard issues attributable to one
    // event draw UNDER that event's column on the (part-0) tab staff; the rest
    // stack in the bar corner.
    const fromValidation = validationByMeasure.get(i) ?? [];
    const tabAnchorTd = tabDisplays.find(td => td.part === mnx.parts?.[0]);
    const anchoredTabIssues = tabAnchorTd
      ? fromValidation.filter(
          v =>
            v.scope === 'tab' &&
            v.at &&
            m.staves[tabAnchorTd.planStaff]?.[v.at.voiceIndex]?.[v.at.eventIndex]
        )
      : [];
    const measureIssues: MeasureIssue[] = [
      ...fromValidation.filter(v => !anchoredTabIssues.includes(v)),
      ...m.issues.map(message => ({ kind: 'render' as const, message }))
    ];
    resolvedByStaff.forEach((staffVoices, s) => {
      // Forced stems (layout sources) win; multiple stem-less voices rank by
      // pitch (upper voice up, rest down); lone voices auto-stem per event.
      const defaultStems = rankVoiceStems(staffVoices, m.clefTimelines[s][0].clef);
      staffVoices.forEach(({ seq: sequence }, voiceIndex) => {
        const stemOverride: 1 | -1 | null = defaultStems[voiceIndex];
        let onset = 0; // metric position within the bar, in whole-note fractions
        sequence.content.forEach((event, eventIndex) => {
          const slot = m.staves[s]?.[voiceIndex]?.[eventIndex];
          if (!slot) return;
          // Pitch math follows the clef in effect at this event's onset (the
          // staff's timeline includes mid-measure changes).
          const eventClef = clefAt(m.clefTimelines[s], onset);
          // Notes under an ottava are written `value` octaves off their sounding
          // pitch. Fold that into a positioning-only clef (the drawn clef glyph
          // is untouched); the bracket itself is drawn by emitOttavas.
          const ottavaShift = ottavaSpans.length ? ottavaShiftAt(ottavaSpans, s, i, onset) : 0;
          const posClef = ottavaShift
            ? { ...eventClef, octave: eventClef.octave + ottavaShift }
            : eventClef;
          onset += isGrace(event) ? 0 : isTremolo(event) ? tremoloDuration(event) : isTuplet(event) ? tupletDuration(event) : isTimedEvent(event) ? durationValue(event.duration) : 0.25;
          try {
            if (isGrace(event)) {
              emitGraceGroup({
                grace: event,
                firstX: slot.x,
                ink: plan.inkRatio,
                staffTop: staffTops[s],
                clef: posClef,
                useAccidentalDisplay,
                keyFifths: m.keyFifths,
                primitives,
                keyFor:
                  synthesizePartForStaff[s] !== null
                    ? (containerIndex, noteIndex) => {
                        const inner = (event as { content?: { notes?: MnxNote[] }[] }).content?.[
                          containerIndex
                        ];
                        const note = inner?.notes?.[noteIndex];
                        return note
                          ? noteKeyAt(
                              note, i, voiceIndex, eventIndex, noteIndex, containerIndex,
                              synthesizePartForStaff[s]!.partIndex,
                              synthesizePartForStaff[s]!.staffIndex
                            )
                          : undefined;
                      }
                    : undefined
              });
              return;
            }
            if (isTremolo(event)) {
              emitTremoloGroup({
                tremolo: event,
                firstX: slot.x,
                ink: plan.inkRatio,
                staffTop: staffTops[s],
                clef: posClef,
                useAccidentalDisplay,
                keyFifths: m.keyFifths,
                primitives,
                keyFor:
                  synthesizePartForStaff[s] !== null
                    ? (containerIndex, noteIndex) => {
                        const inner = (event as { content?: { notes?: MnxNote[] }[] }).content?.[
                          containerIndex
                        ];
                        const note = inner?.notes?.[noteIndex];
                        return note
                          ? noteKeyAt(
                              note, i, voiceIndex, eventIndex, noteIndex, containerIndex,
                              synthesizePartForStaff[s]!.partIndex,
                              synthesizePartForStaff[s]!.staffIndex
                            )
                          : undefined;
                      }
                    : undefined
              });
              return;
            }
            if (isTuplet(event)) {
              emitTupletGroup({
                tuplet: event,
                firstX: slot.x,
                ink: plan.inkRatio,
                staffTop: staffTops[s],
                clef: posClef,
                useAccidentalDisplay,
                keyFifths: m.keyFifths,
                primitives,
                keyFor:
                  synthesizePartForStaff[s] !== null
                    ? (containerIndex, noteIndex) => {
                        const inner = (event as { content?: { notes?: MnxNote[] }[] }).content?.[
                          containerIndex
                        ];
                        const note = inner?.notes?.[noteIndex];
                        return note
                          ? noteKeyAt(
                              note, i, voiceIndex, eventIndex, noteIndex, containerIndex,
                              synthesizePartForStaff[s]!.partIndex,
                              synthesizePartForStaff[s]!.staffIndex
                            )
                          : undefined;
                      }
                    : undefined
              });
              return;
            }
            if (sequenceItemKind(event) === 'unknown') return; // plan already recorded it
            const beamRun = beams.byEventKey.get(`${i}:${s}:${voiceIndex}:${eventIndex}`) ?? null;
            const stem = emitEvent({
              event,
              eventX: slot.x,
              ink: plan.inkRatio,
              staffTop: staffTops[s],
              clef: posClef,
              stemOverride,
              beamDir: beamRun?.dir ?? null,
              useAccidentalDisplay,
              keyFifths: m.keyFifths,
              activeNoteIds,
              selectedNoteIds,
              primitives,
              index,
              measureIndex: i,
              voiceIndex,
              eventIndex,
              row: m.row,
              curveKey: `${i}:${s}:${voiceIndex}:${eventIndex}`,
              curveAnchors,
              // Synthetic keys encode the staff-1 traversal that jsonView
              // mirrors; other staves use real ids only.
              synthesizeKeys: synthesizePartForStaff[s] !== null,
              keyPartIndex: synthesizePartForStaff[s]?.partIndex ?? 0,
              keyStaffIndex: synthesizePartForStaff[s]?.staffIndex ?? 1
            });
            if (beamRun && stem && event.id) beamRun.stems.set(event.id, stem);
            const lyricLines = event.lyrics?.lines;
            if (lyricLines) {
              for (const [lineId, line] of Object.entries(lyricLines)) {
                const verse = lyricLineIds.indexOf(lineId);
                if (verse < 0) continue;
                const key = `${s}:${lineId}`;
                const run = lyricRuns.get(key) ?? [];
                run.push({
                  x: slot.x,
                  y: staffBottoms[s] + LYRIC_FIRST_BASELINE_DROP_SP + verse * LYRIC_LINE_SPACING_SP,
                  text: line.text,
                  continues: line.type === 'start' || line.type === 'middle'
                });
                lyricRuns.set(key, run);
              }
            }
          } catch (e) {
            measureIssues.push({ kind: 'render', message: (e as Error).message });
          }
        });
      });
    });

    // Native tab staves (the `both` view): six lines, TAB clef, tab-style
    // time signature and fret digits — the emission shared with the
    // standalone tab layout (tabStaff.ts), driven by the SAME plan slots as
    // the part's notation staff, so columns align by construction.
    for (const td of tabDisplays) {
      const tabTop = displayTopOf(m.row, td.displayIndex);
      emitTabStaffLines(m.x, m.width, tabTop, primitives);
      // Setup instructions (capo, non-standard tuning letters) on the FIRST
      // bar only — same emission as the standalone tab view.
      if (i === 0) emitTabSystemHeader(td.ctx, m.x, tabTop, primitives);
      if (m.firstInSystem) emitTabClef(m.clefX, tabTop, primitives);
      if (m.showTimeSig) emitTabTimeSig(m.timeSig, m.timeSigCentreX, tabTop, primitives);
      if (!m.multiRest) {
        emitTabVoices({
          voices: resolvedByStaff[td.planStaff]?.map(v => v.seq) ?? [],
          slots: m.staves[td.planStaff] ?? [],
          staffTop: tabTop,
          measureIndex: i,
          activeNoteIds,
          selectedNoteIds,
          // Synthetic keys encode the staff-1-of-first-part traversal jsonView
          // mirrors — the tab staff may reuse them only when its notation
          // sibling is exactly that staff (cross-highlight then works on both).
          synthesizeKeys: td.planStaff === 0 && synthesizeKeysForStaff0,
          primitives,
          index,
          onIssue: message => measureIssues.push({ kind: 'render', message }),
          positionContext: td.ctx
        });
      }
    }

    // End barline — drawn per part group: internal barlines don't bridge the
    // gap between parts (only the system-start barline joins them).
    const isLast = i === numMeasures - 1 || plan.measures.slice(i + 1).every(n => n.hidden);
    const barX = m.x + m.width;
    for (const g of segment.groups) {
      for (const [gTop, gBottom] of groupSpans(g)) {
        if (m.repeatEnd) {
          // Backward repeat :| — dots + thin + thick (doubles as a final barline).
          primitives.push({
            kind: 'rect',
            x: barX - FINAL_BARLINE_THICK_SP, y: gTop,
            w: FINAL_BARLINE_THICK_SP, h: gBottom - gTop,
            fill: 'currentColor',
            className: 'barline repeat-end'
          });
          primitives.push({
            kind: 'line',
            x1: barX - FINAL_BARLINE_THICK_SP - FINAL_BARLINE_GAP_SP,
            y1: gTop,
            x2: barX - FINAL_BARLINE_THICK_SP - FINAL_BARLINE_GAP_SP,
            y2: gBottom,
            thickness: BARLINE_THICKNESS_SP,
            className: 'barline repeat-end'
          });
        } else {
          // The GLOBAL measure owns the barline style; `isLast` only supplies
          // the spec's default when the document is silent about it.
          emitEndBarline({
            type: resolveBarlineType(mnx.global.measures[i]?.barline, isLast),
            x: barX,
            top: gTop,
            bottom: gBottom,
            metrics: BARLINE_METRICS,
            primitives
          });
        }
      }
    }
    if (m.repeatEnd) {
      const dotX = barX - FINAL_BARLINE_THICK_SP - FINAL_BARLINE_GAP_SP - 0.85;
      for (const top of staffTops) {
        for (const dotY of [1.5, 2.5]) {
          primitives.push({
            kind: 'glyph',
            glyph: 'augmentationDot',
            x: dotX,
            y: top + dotY,
            scale: REPEAT_DOT_SCALE,
            className: 'repeat-dot'
          });
        }
      }
      for (const td of tabDisplays) {
        const tabTop = displayTopOf(m.row, td.displayIndex);
        for (const dotY of TAB_REPEAT_DOT_YS) {
          primitives.push({
            kind: 'glyph',
            glyph: 'augmentationDot',
            x: dotX,
            y: tabTop + dotY,
            scale: REPEAT_DOT_SCALE,
            className: 'repeat-dot'
          });
        }
      }
    }
    // Unconventional play counts print above the barline ("4x").
    if (m.repeatEnd) {
      const times = m.repeatEnd.times;
      if (times !== undefined && times !== 2) {
        primitives.push({
          kind: 'text',
          text: `${times}x`,
          x: barX,
          y: staffTop - 1.2,
          font: 'body',
          size: 1.4,
          weight: 'bold',
          anchor: 'end',
          className: 'repeat-times'
        });
      }
    }

    // Full-measure rests (sequence.fullMeasure with empty content): one rest
    // centred in the bar's content span, on the sequence's staff.
    resolvedByStaff.forEach((staffVoices, s) => {
      for (const { seq: sequence } of staffVoices) {
        const fm = sequence.fullMeasure;
        if (!fm || sequence.content.length > 0) continue;
        const base = fm.visualDuration?.base ?? 'whole';
        const y =
          fm.staffPosition !== undefined
            ? STAFF_MIDDLE_Y - fm.staffPosition / 2
            : REST_Y_BY_BASE[base] ?? 1;
        primitives.push({
          kind: 'glyph',
          glyph: REST_GLYPH_BY_BASE[base] ?? 'restWhole',
          x: (m.contentStartX + m.x + m.width) / 2,
          y: staffTops[s] + y,
          anchor: 'middle',
          className: 'rest rest-full-measure'
        });
      }
    });

    if (ottavaOnsets) {
      ottavaOnsets.set(
        i,
        resolvedByStaff.map((voices, s) =>
          measureOnsetXs(voices[0]?.seq, m.staves[s]?.[0] ?? []))
      );
    }

    // Dynamics, per group (anchored via the group's lead part).
    if (!m.multiRest) {
      for (const g of segment.groups) {
        const pm = segment.staves[g.start].sources[0].part.measures[i];
        if (!pm) continue;
        const groupArgs = {
          partMeasure: pm,
          m: { x: m.x, width: m.width, staves: m.staves.slice(g.start, g.start + g.count) },
          sequencesByStaff: resolvedByStaff
            .slice(g.start, g.start + g.count)
            .map(voices => voices.map(v => v.seq)),
          staffBottoms: staffBottoms.slice(g.start, g.start + g.count),
          primitives
        };
        emitDynamics(groupArgs);
        emitDirections({
          ...groupArgs,
          staffTops: staffTops.slice(g.start, g.start + g.count)
        });
      }
    }
    emitNavigationMarkers({
      gm: mnx.global.measures[i] ?? {},
      m,
      stdSequences,
      staffTop,
      primitives
    });
    // The tempo mark and the label row are emitted after the loop — they are
    // placed one clearance above the bar's ink, and the beams, voltas and
    // ottava brackets that ink includes are drawn after the loop too.

    if (anchoredTabIssues.length && tabAnchorTd) {
      const tabBottom = displayTopOf(m.row, tabAnchorTd.displayIndex) + TAB_STAFF_HEIGHT_SP;
      const bySlot = new Map<number, MeasureIssue[]>();
      for (const v of anchoredTabIssues) {
        const slot = m.staves[tabAnchorTd.planStaff][v.at!.voiceIndex][v.at!.eventIndex];
        const key = Math.round(slot.x * 1e4);
        bySlot.set(key, [...(bySlot.get(key) ?? []), v]);
      }
      for (const [key, list] of bySlot) {
        emitPositionedDiagnostics(key / 1e4, tabBottom, list, primitives);
      }
      for (const { at: _at, scope: _scope, ...issue } of anchoredTabIssues) {
        diagnostics.push({ measureIndex: i, ...issue });
      }
    }
    if (measureIssues.length) {
      emitMeasureDiagnostics(m.x, sysBottom, measureIssues, primitives);
      for (const issue of measureIssues) diagnostics.push({ measureIndex: i, ...issue });
    }
  }

  const loopEnd = primitives.length;

  for (const run of beams.runs) emitBeamRun(run, primitives);

  emitSlursAndTies(segment, plan, curveAnchors, primitives);

  // Lyrics: syllables centred under their columns, hyphens joining
  // start/middle syllables to the next one on the same row.
  for (const run of lyricRuns.values()) {
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

  emitEndings(mnx, plan, row => displayTopOf(row, 0), primitives);
  if (ottavaOnsets && ottavaSpans.length) emitOttavas(ottavaSpans, plan, staffTopOf, ottavaOnsets, primitives);

  // The score-wide text row, last of all (core-ink-measured-gaps.md, stage A):
  // a tempo mark and then the labels sit one cohesion clearance above
  // whatever ink the bar already carries over its top staff — beamed stems,
  // voltas and ottava brackets included, which is why this runs here rather
  // than inside the measure loop. Tempo first, so the labels stack over it.
  // Each row's scan: its slice of the measure loop, the post-loop passes'
  // primitives (beams, curves, lyrics, voltas, ottavas) that its band owns by
  // anchor — those sit near their staff, so the midpoint rule is safe for
  // them — and the text this pass has already placed on the row. Never the
  // row above: clearing it is tightenRows' job.
  const textPassStart = primitives.length;
  const rowBoundaries = Array.from({ length: rowCount - 1 }, (_, r) =>
    (displayTopOf(r, displayCount - 1) + displayHeights[displayCount - 1] + displayTopOf(r + 1, 0)) / 2
  );
  const postLoopByRow: Primitive[][] = Array.from({ length: rowCount }, () => []);
  for (const p of primitives.slice(loopEnd, textPassStart)) {
    const y = anchorY(p);
    let r = 0;
    while (r < rowBoundaries.length && y >= rowBoundaries[r]) r++;
    postLoopByRow[r].push(p);
  }
  const rowTextStart: number[] = [];
  for (let i = 0; i < numMeasures; i++) {
    const m = plan.measures[i];
    if (m.hidden) continue;
    if (rowTextStart[m.row] === undefined) rowTextStart[m.row] = primitives.length;
    const gm = mnx.global.measures[i] ?? {};
    const staffTop = staffTopOf(m.row, 0);
    const scan = () => [
      ...primitives.slice(rowLoopStart[m.row] ?? loopEnd, rowLoopStart[m.row + 1] ?? loopEnd),
      ...postLoopByRow[m.row],
      ...primitives.slice(rowTextStart[m.row])
    ];
    const tempoTop = emitTempoMark({ gm, m, staffTop, scan: scan(), primitives });
    emitScoreLabels({ gm, m, staffTop, scan: scan(), clearAbove: tempoTop, primitives });
  }

  const heightSp = 2 * MARGIN_SP + systemHeightByRow.reduce((a, b) => a + b, 0);
  const rows = Array.from({ length: rowCount }, (_, r): RowBandSp => ({
    staffTop: displayTopOf(r, 0),
    staffBottom: displayTopOf(r, displayCount - 1) + displayHeights[displayCount - 1]
  }));
  const displays = Array.from({ length: rowCount }, (_, r) =>
    displayHeights.map((h, d): RowBandSp => ({
      staffTop: displayTopOf(r, d),
      staffBottom: displayTopOf(r, d) + h
    }))
  );

  return {
    primitives, heightSp, usedWidthSp: plan.usedWidthSp, rows, displays, tabDisplayIndexes,
    packing: plan.packing
  };
}

// ---------- Beams ----------

/** Deferred stem of a beamed event, recorded during emission. */
interface BeamedStem {
  stemX: number;
  /** Notehead end of the stem (absolute y, anchor-corrected). */
  attachY: number;
  /** Extreme notehead centre on the tip side — the ideal tip extends from here. */
  baseTipY: number;
  fill?: string;
  colorClass: string;
}

/** One drawable beam: a group (or the part of it on one system row). */
interface BeamRun {
  dir: 1 | -1;
  /** Member event ids in document order. */
  memberIds: string[];
  segments: BeamSegmentSpec[];
  hooks: BeamHookSpec[];
  /** Filled during event emission. */
  stems: Map<string, BeamedStem>;
}

function buildBeamRuns(
  mnx: MnxStructure,
  segment: JobSegment,
  plan: HorizontalPlan
): { runs: BeamRun[]; byEventKey: Map<string, BeamRun> } {
  const runs: BeamRun[] = [];
  const byEventKey = new Map<string, BeamRun>();

  interface Loc {
    mi: number;
    si: number;
    vi: number;
    ei: number;
    event: MnxEvent;
    /** Forced or pitch-ranked voice stem; null = decide from the run. */
    stem: 1 | -1 | null;
  }

  // Locate events through the SAME voice resolution emission uses (merged
  // chord staves keep the first source's event ids).
  const locById = new Map<string, Loc>();
  const info = new Map<string, BeamEventInfo>();
  const partsSeen = new Set<MnxPart>();
  segment.staves.forEach((spec, si) => {
    for (const src of spec.sources) partsSeen.add(src.part);
    for (let mi = 0; mi < plan.measures.length; mi++) {
      const pm = plan.measures[mi];
      if (!pm || pm.hidden || pm.multiRest) continue;
      const voices = resolveStaffVoices(spec, mi);
      const defaultStems = rankVoiceStems(voices, pm.clefTimelines[si][0].clef);
      voices.forEach((rv, vi) => {
        rv.seq.content.forEach((event, ei) => {
          // Grace containers don't join measure-level beam groups: their inner
          // notes beam among themselves (emitGraceGroup), as in the spec's
          // beams-inner-grace-notes example where the grace sits out the beam.
          // Unknown item kinds (tuplet, tremolo, …) can't carry beams either.
          if (!isTimedEvent(event) || !event.id) return;
          locById.set(event.id, { mi, si, vi, ei, event, stem: defaultStems[vi] });
          info.set(event.id, {
            levels: BEAM_LEVELS_BY_BASE[event.duration.base] ?? 0,
            ticks: Math.round(durationValue(event.duration) * WHOLE_NOTE_TICKS)
          });
        });
      });
    }
  });

  const groups: BeamGroupSpec[] = [];
  for (const part of partsSeen) groups.push(...resolveBeamGroups(part.measures, info));

  // Documents that don't declare support.useBeams leave beaming to the
  // renderer: consecutive beamable note events of a sequence beam together
  // within the conventional metric unit — the half-bar in even simple meters
  // (pairs the spec's reference engravings group eighths into), the beat in
  // odd ones, the dotted quarter in compound time. Measures carrying explicit
  // `beams` stay as encoded, as do events some other measure already beamed.
  if (mnx.mnx?.support?.useBeams !== true) {
    const explicitIds = new Set(groups.flatMap(g => g.eventIds));
    for (const part of partsSeen) {
      part.measures.forEach((pm, mi) => {
        if (pm.beams?.length) return;
        const ts = plan.measures[mi]?.timeSig ?? { count: 4, unit: 4 };
        const beatTicks =
          ts.unit === 8 && ts.count % 3 === 0
            ? (3 * WHOLE_NOTE_TICKS) / 8
            : ts.count % 3 === 0
            ? ts.count * (WHOLE_NOTE_TICKS / ts.unit) // simple triple: whole bar
            : (WHOLE_NOTE_TICKS / ts.unit) * (ts.count % 2 === 0 ? 2 : 1);
        for (const seq of pm.sequences ?? []) {
          let t = 0; // onset in ticks
          let run: string[] = [];
          const flush = () => {
            if (run.length >= 2) groups.push(impliedBeamGroup(run, info));
            run = [];
          };
          for (const item of seq.content) {
            if (isGrace(item)) continue; // graces sit out beams without breaking the run
            if (isTremolo(item) || isTuplet(item)) {
              flush();
              t += Math.round(
                (isTremolo(item) ? tremoloDuration(item) : tupletDuration(item)) * WHOLE_NOTE_TICKS
              );
              continue;
            }
            if (!isTimedEvent(item)) {
              flush();
              continue;
            }
            const beamable =
              !item.rest &&
              (item.notes?.length ?? 0) > 0 &&
              (BEAM_LEVELS_BY_BASE[item.duration.base] ?? 0) >= 1 &&
              !!item.id &&
              !explicitIds.has(item.id);
            if (!beamable) {
              flush();
            } else {
              if (run.length > 0 && t % beatTicks === 0) flush();
              run.push(item.id!);
            }
            t += Math.round(durationValue(item.duration) * WHOLE_NOTE_TICKS);
          }
          flush();
        }
      });
    }
  }

  for (const group of groups) {
    // Members that exist, carry notes, and can hold a beam.
    const members = group.eventIds.filter(id => {
      const loc = locById.get(id);
      return (
        !!loc &&
        !loc.event.rest &&
        (loc.event.notes?.length ?? 0) > 0 &&
        (BEAM_LEVELS_BY_BASE[loc.event.duration.base] ?? 0) >= 1
      );
    });

    // A beam can't span a system break — split and re-beam each side.
    const rowOf = (id: string) => plan.measures[locById.get(id)!.mi].row;
    const rowRuns: string[][] = [];
    let current: string[] = [];
    for (const id of members) {
      if (current.length && rowOf(id) !== rowOf(current[current.length - 1])) {
        rowRuns.push(current);
        current = [];
      }
      current.push(id);
    }
    if (current.length) rowRuns.push(current);

    for (const ids of rowRuns) {
      if (ids.length < 2) continue; // a lone survivor keeps its flag

      // Stem direction: a forced or pitch-ranked voice stem wins; otherwise
      // the note furthest from the middle line across the whole run decides.
      const firstLoc = locById.get(ids[0])!;
      let dir: 1 | -1;
      if (firstLoc.stem !== null) {
        dir = firstLoc.stem;
      } else {
        const ys: number[] = [];
        for (const id of ids) {
          const loc = locById.get(id)!;
          const clef = plan.measures[loc.mi].clefTimelines[loc.si][0].clef;
          for (const n of loc.event.notes ?? []) {
            ys.push(pitchToStaffY(n.pitch.step, n.pitch.octave, clef));
          }
        }
        dir = autoStemDir(ys);
      }

      // Clip secondary segments/hooks to this run; a segment cut down to a
      // single member degrades to a hook pointing back into the group.
      const inRun = new Set(ids);
      const segments: BeamSegmentSpec[] = [];
      const hooks: BeamHookSpec[] = group.hooks.filter(h => inRun.has(h.eventId));
      for (const seg of group.segments) {
        const clipped = seg.eventIds.filter(id => inRun.has(id));
        if (clipped.length >= 2) {
          segments.push({ level: seg.level, eventIds: clipped });
        } else if (clipped.length === 1) {
          hooks.push({
            level: seg.level,
            eventId: clipped[0],
            direction: ids.indexOf(clipped[0]) > 0 ? 'left' : 'right'
          });
        }
      }

      const run: BeamRun = { dir, memberIds: ids, segments, hooks, stems: new Map() };
      runs.push(run);
      for (const id of ids) {
        const loc = locById.get(id)!;
        byEventKey.set(`${loc.mi}:${loc.si}:${loc.vi}:${loc.ei}`, run);
      }
    }
  }

  return { runs, byEventKey };
}


function emitBeamRun(run: BeamRun, primitives: Primitive[]): void {
  const stems = run.memberIds
    .map(id => run.stems.get(id))
    .filter((s): s is BeamedStem => s !== undefined);
  if (stems.length < 2) return;

  const dir = run.dir;
  const idealTip = (s: BeamedStem) => s.baseTipY - dir * STEM_LENGTH_SP;
  const first = stems[0];
  const last = stems[stems.length - 1];
  const span = last.stemX - first.stemX || 1;

  // Beam line: slant follows the outer noteheads (capped), then slides
  // outward until every stem reaches at least full length.
  const slant = Math.max(
    -BEAM_MAX_SLANT_SP,
    Math.min(BEAM_MAX_SLANT_SP, idealTip(last) - idealTip(first))
  );
  const base = (x: number) => idealTip(first) + (slant * (x - first.stemX)) / span;
  const deltas = stems.map(s => idealTip(s) - base(s.stemX));
  const shift = dir === 1 ? Math.min(...deltas) : Math.max(...deltas);
  const lineY = (x: number) => base(x) + shift;
  // Deeper levels stack toward the noteheads.
  const levelY = (x: number, level: number) =>
    lineY(x) + dir * (level - 1) * (BEAM_THICKNESS_SP + BEAM_GAP_SP);

  for (const s of stems) {
    primitives.push({
      kind: 'line',
      x1: s.stemX, y1: s.attachY,
      x2: s.stemX, y2: lineY(s.stemX),
      thickness: STEM_THICKNESS_SP,
      stroke: s.fill,
      className: 'stem' + s.colorClass
    });
  }

  const bar = (xa: number, xb: number, level: number) => {
    primitives.push({
      kind: 'line',
      x1: xa - STEM_THICKNESS_SP / 2, y1: levelY(xa, level),
      x2: xb + STEM_THICKNESS_SP / 2, y2: levelY(xb, level),
      thickness: BEAM_THICKNESS_SP,
      className: 'beam'
    });
  };

  bar(first.stemX, last.stemX, 1);

  const stemXOf = (id: string) => run.stems.get(id)?.stemX;
  for (const seg of run.segments) {
    const xs = seg.eventIds
      .map(stemXOf)
      .filter((x): x is number => x !== undefined);
    if (xs.length >= 2) bar(Math.min(...xs), Math.max(...xs), seg.level);
  }
  for (const hook of run.hooks) {
    const x = stemXOf(hook.eventId);
    if (x === undefined) continue;
    if (hook.direction === 'right') bar(x, x + BEAM_HOOK_LENGTH_SP, hook.level);
    else bar(x - BEAM_HOOK_LENGTH_SP, x, hook.level);
  }
}

// ---------- Slurs & ties ----------

/** Geometry of one emitted note-carrying event, for curve endpoints. */
interface EventCurveAnchor {
  x: number;
  row: number;
  stemDir: 1 | -1;
  /** Absolute notehead-centre y per chord member, in document order. */
  headYs: number[];
}

interface CurveAnchors {
  /** Keyed `${measure}:${staff}:${voice}:${event}` — the emission traversal. */
  byKey: Map<string, EventCurveAnchor>;
  byEventId: Map<string, EventCurveAnchor>;
  byNoteId: Map<string, { anchor: EventCurveAnchor; noteIndex: number }>;
}

/**
 * Draws slur and tie curves between recorded anchors. Slurs live on events
 * (`slurs[].target` = event id, optionally pinned to chord members via
 * `startNote`/`endNote`); ties live on notes (`ties[].target` = note id; `lv`
 * with no target draws a short laissez-vibrer hook). Curve side defaults to
 * opposite the start event's stem. A curve whose endpoints land on different
 * system rows splits at the break: the first half runs out to the end of the
 * start row, the second resumes at the target row's left edge.
 */
function emitSlursAndTies(
  segment: JobSegment,
  plan: HorizontalPlan,
  anchors: CurveAnchors,
  primitives: Primitive[]
): void {
  // Row edges, for curves split at system breaks.
  const rowRight = new Map<number, number>();
  const rowLeft = new Map<number, number>();
  for (const m of plan.measures) {
    if (m.hidden) continue;
    rowRight.set(m.row, Math.max(rowRight.get(m.row) ?? -Infinity, m.x + m.width));
    rowLeft.set(m.row, Math.min(rowLeft.get(m.row) ?? Infinity, m.contentStartX));
  }

  const curve = (
    x0: number, y0: number, x1: number, y1: number,
    dir: 1 | -1, // -1 bulges up (y grows downward), 1 bulges down
    kind: 'slur' | 'tie'
  ) => {
    const span = Math.max(x1 - x0, 0.8);
    const h = kind === 'slur'
      ? Math.min(0.9 + span * 0.08, 2.2)
      : Math.min(0.45 + span * 0.05, 1.1);
    primitives.push({
      kind: 'curve',
      points: [
        { x: x0, y: y0 },
        { x: x0 + span * 0.3, y: y0 + dir * h },
        { x: x1 - span * 0.3, y: y1 + dir * h },
        { x: x1, y: y1 }
      ],
      thickness: kind === 'slur' ? SLUR_THICKNESS_SP : TIE_THICKNESS_SP,
      taper: true,
      className: kind
    });
  };

  /** One curve, or two halves when the endpoints sit on different rows. */
  const draw = (
    x0: number, y0: number, row0: number,
    x1: number, y1: number, row1: number,
    dir: 1 | -1,
    kind: 'slur' | 'tie'
  ) => {
    if (row0 !== row1) {
      const cutX = Math.max((rowRight.get(row0) ?? x0) - 0.4, x0 + 1.5);
      const resumeX = Math.min((rowLeft.get(row1) ?? x1) + 0.2, x1 - 1.5);
      curve(x0, y0, cutX, y0, dir, kind);
      curve(resumeX, y1, x1, y1, dir, kind);
      return;
    }
    curve(x0, y0, x1, y1, dir, kind);
  };

  segment.staves.forEach((spec, si) => {
    for (let mi = 0; mi < plan.measures.length; mi++) {
      const pm = plan.measures[mi];
      if (!pm || pm.hidden || pm.multiRest) continue;
      resolveStaffVoices(spec, mi).forEach((rv, vi) => {
        rv.seq.content.forEach((item, ei) => {
          if (!isTimedEvent(item)) return;
          const start = anchors.byKey.get(`${mi}:${si}:${vi}:${ei}`);
          if (!start) return;

          for (const slur of item.slurs ?? []) {
            const end = anchors.byEventId.get(slur.target);
            if (!end) continue;
            const side: 'up' | 'down' = slur.side ?? (start.stemDir === 1 ? 'down' : 'up');
            const dir = side === 'up' ? -1 : 1;
            const pad = dir * SLUR_END_PAD_SP;
            // A pinned endpoint (startNote/endNote) anchors at that chord
            // member; otherwise at the outermost notehead on the curve side.
            const headY = (a: EventCurveAnchor, noteId?: string) => {
              const pinned = noteId ? anchors.byNoteId.get(noteId) : undefined;
              if (pinned) return pinned.anchor.headYs[pinned.noteIndex];
              return side === 'up' ? Math.min(...a.headYs) : Math.max(...a.headYs);
            };
            draw(
              start.x + 0.2, headY(start, slur.startNote) + pad, start.row,
              end.x - 0.2, headY(end, slur.endNote) + pad, end.row,
              dir, 'slur'
            );
          }

          (item.notes ?? []).forEach((note, ni) => {
            for (const tie of note.ties ?? []) {
              const noteY = start.headYs[ni];
              if (noteY === undefined) continue;
              const side: 'up' | 'down' = tie.side ?? (start.stemDir === 1 ? 'down' : 'up');
              const dir = side === 'up' ? -1 : 1;
              const pad = dir * TIE_END_PAD_SP;
              if (!tie.target) {
                if (tie.lv) {
                  const x0 = start.x + TIE_END_GAP_SP;
                  curve(x0, noteY + pad, x0 + LV_TIE_LENGTH_SP, noteY + pad, dir, 'tie');
                }
                continue;
              }
              const target = anchors.byNoteId.get(tie.target);
              if (!target) {
                // The tie is encoded but its target isn't renderable (e.g.
                // organ-layout's pedal tie into a never-encoded next bar) —
                // draw the outgoing stub rather than dropping the tie.
                const x0 = start.x + TIE_END_GAP_SP * plan.inkRatio;
                curve(x0, noteY + pad, x0 + LV_TIE_LENGTH_SP, noteY + pad, dir, 'tie');
                continue;
              }
              const targetY = target.anchor.headYs[target.noteIndex] + pad;
              if (tie.targetType === 'crossJump') {
                // A tie across a jump (e.g. into a second ending) draws only
                // the incoming stub at its target — drawing the full curve
                // would span the music skipped by the jump, and the source
                // side already carries the first-time tie.
                const x1 = target.anchor.x - TIE_END_GAP_SP * plan.inkRatio;
                curve(x1 - LV_TIE_LENGTH_SP, targetY, x1, targetY, dir, 'tie');
                continue;
              }
              draw(
                start.x + TIE_END_GAP_SP * plan.inkRatio, noteY + pad, start.row,
                target.anchor.x - TIE_END_GAP_SP * plan.inkRatio, targetY, target.anchor.row,
                dir, 'tie'
              );
            }
          });
        });
      });
    }
  });
}

// ---------- Volta brackets (endings) ----------

/**
 * Draws each global-measure `ending` as a volta bracket: a line above the
 * staff spanning `duration` measures, hooked down at the start (and at the end
 * unless `open`), labelled with its numbers ("1." / "1. 2."). Brackets split
 * at system breaks; only the first segment carries the hook and label.
 */
function emitEndings(
  mnx: MnxStructure,
  plan: HorizontalPlan,
  /** The top staff's top line on a row — rows are no longer a uniform pitch. */
  rowStaffTop: (row: number) => number,
  primitives: Primitive[]
): void {
  (mnx.global.measures ?? []).forEach((gm, i) => {
    const ending = gm?.ending;
    if (!ending || !plan.measures[i]) return;
    const last = Math.min(i + Math.max(1, ending.duration ?? 1) - 1, plan.measures.length - 1);

    let a = i;
    while (a <= last) {
      const row = plan.measures[a].row;
      let b = a;
      while (b + 1 <= last && plan.measures[b + 1].row === row) b++;
      const staffTop = rowStaffTop(row);
      const y = staffTop - VOLTA_RISE_SP;
      const x1 = plan.measures[a].x + 0.1;
      const x2 = plan.measures[b].x + plan.measures[b].width - 0.1;
      primitives.push({
        kind: 'line',
        x1, y1: y, x2, y2: y,
        thickness: VOLTA_THICKNESS_SP,
        className: 'ending'
      });
      if (a === i) {
        primitives.push({
          kind: 'line',
          x1, y1: y, x2: x1, y2: y + VOLTA_HOOK_SP,
          thickness: VOLTA_THICKNESS_SP,
          className: 'ending'
        });
        primitives.push({
          kind: 'text',
          text: (ending.numbers ?? []).map(n => `${n}.`).join(' '),
          x: x1 + 0.5,
          y: y + 1.4,
          font: 'body',
          size: 1.4,
          weight: 'bold',
          className: 'ending-label'
        });
      }
      if (!ending.open && b === last) {
        primitives.push({
          kind: 'line',
          x1: x2, y1: y, x2, y2: y + VOLTA_HOOK_SP,
          thickness: VOLTA_THICKNESS_SP,
          className: 'ending'
        });
      }
      a = b + 1;
    }
  });
}

// ---------- Ottava (octave-shift) lines ----------

/** Topmost y among noteheads drawn in [x1,x2]; falls back to `ceil`. Lets an
 *  8va line clear high ledger notes instead of cutting through them. */
function spanCeiling(primitives: Primitive[], x1: number, x2: number, ceil: number): number {
  let top = ceil;
  for (const p of primitives) {
    if (p.kind === 'glyph' && p.glyph.startsWith('notehead') && p.x >= x1 - 0.5 && p.x <= x2 + 0.5 && p.y < top) {
      top = p.y;
    }
  }
  return top;
}

/** Bottommost y among noteheads in [x1,x2]; falls back to `floor`. */
function spanFloor(primitives: Primitive[], x1: number, x2: number, floor: number): number {
  let bot = floor;
  for (const p of primitives) {
    if (p.kind === 'glyph' && p.glyph.startsWith('notehead') && p.x >= x1 - 0.5 && p.x <= x2 + 0.5 && p.y > bot) {
      bot = p.y;
    }
  }
  return bot;
}

/** "8va" / "8vb" / "15ma" / … for an ottava amount (±1/±2/±3). */
function ottavaLabel(value: number): string {
  const n = [8, 15, 22][Math.abs(value) - 1] ?? 8;
  const suffix = value > 0 ? (Math.abs(value) === 1 ? 'va' : 'ma') : Math.abs(value) === 1 ? 'vb' : 'mb';
  return `${n}${suffix}`;
}

interface OttavaSpan {
  /** Plan staff index. */
  staff: number;
  startIdx: number;
  startT: number;
  endIdx: number;
  endT: number;
  value: number;
  orient?: 'above' | 'below' | 'auto';
}

/** Resolve each part-measure `ottava` to a span keyed by plan staff index and
 *  measure index — the shared source for both the note transposition (in the
 *  render loop) and the bracket overlay (emitOttavas). */
function collectOttavaSpans(
  mnx: MnxStructure,
  segment: { staves: { sources: { part: MnxPart; staff: number }[] }[] }
): OttavaSpan[] {
  const indexById = new Map<string, number>();
  (mnx.global.measures ?? []).forEach((gm, i) => {
    if (gm?.id) indexById.set(gm.id, i);
  });
  // (part, staff) → plan staff index (first staff node that carries it).
  const staffIndexOf = new Map<MnxPart, Map<number, number>>();
  segment.staves.forEach((st, s) => {
    for (const src of st.sources) {
      let byStaff = staffIndexOf.get(src.part);
      if (!byStaff) { byStaff = new Map(); staffIndexOf.set(src.part, byStaff); }
      if (!byStaff.has(src.staff)) byStaff.set(src.staff, s);
    }
  });
  const frac = (f?: [number, number]) => (Array.isArray(f) && f[1] ? f[0] / f[1] : null);

  const spans: OttavaSpan[] = [];
  for (const part of mnx.parts ?? []) {
    const byStaff = staffIndexOf.get(part);
    if (!byStaff) continue; // part not in this segment
    (part.measures ?? []).forEach((pm, startIdx) => {
      for (const ott of pm?.ottavas ?? []) {
        const startT = frac(ott.position?.fraction);
        const endT = frac(ott.end?.position?.fraction);
        if (startT === null || endT === null) continue;
        spans.push({
          staff: byStaff.get(ott.staff ?? 1) ?? 0,
          startIdx,
          startT,
          endIdx: indexById.get(ott.end?.measure ?? '') ?? startIdx,
          endT,
          value: ott.value,
          orient: ott.orient
        });
      }
    });
  }
  return spans;
}

/** The ottava octave shift covering (`staff`, measure `mi`, onset `t`), else 0.
 *  Positive = sounds higher (8va): the written position drops by `value`. */
function ottavaShiftAt(spans: OttavaSpan[], staff: number, mi: number, t: number): number {
  for (const sp of spans) {
    if (sp.staff !== staff) continue;
    const afterStart = mi > sp.startIdx || (mi === sp.startIdx && t >= sp.startT - 1e-6);
    const beforeEnd = mi < sp.endIdx || (mi === sp.endIdx && t <= sp.endT + 1e-6);
    if (afterStart && beforeEnd) return sp.value;
  }
  return 0;
}

/**
 * Draws each ottava span as a labelled dashed octave line: the "8va"/… label at
 * the start position, a dashed extent to the end position (which may be in a
 * later measure), and a hook toward the staff at the end. Above the staff for a
 * positive `value` (or `orient: above`), below for negative; the line clears the
 * highest/lowest note in its span (which the render loop has already shifted).
 * Splits at system breaks, with the label on the first segment, hook on the last.
 */
function emitOttavas(
  spans: OttavaSpan[],
  plan: HorizontalPlan,
  staffTopOf: (row: number, s: number) => number,
  onsets: Map<number, OnsetX[][]>,
  primitives: Primitive[]
): void {
  for (const sp of spans) {
    const s = sp.staff;
    const { startIdx, endIdx, value } = sp;
    if (!plan.measures[startIdx] || !plan.measures[endIdx]) continue;
    const startX = anchorAt(onsets.get(startIdx)?.[s] ?? [], sp.startT, plan.measures[startIdx]).x;
    const endX =
      anchorAt(onsets.get(endIdx)?.[s] ?? [], sp.endT, plan.measures[endIdx]).x + OTTAVA_END_EXTEND_SP;
    const above = sp.orient === 'above' ? true : sp.orient === 'below' ? false : value > 0;

    // Walk the measure span, splitting at system breaks.
    let a = startIdx;
    let first = true;
    while (a <= endIdx) {
      const row = plan.measures[a].row;
      let b = a;
      while (b + 1 <= endIdx && plan.measures[b + 1].row === row) b++;
      const last = b === endIdx;
      const x1 = first ? startX : plan.measures[a].x + 0.1;
      const x2 = last ? endX : plan.measures[b].x + plan.measures[b].width - 0.1;
      const staffTop = staffTopOf(row, s);
      const staffBottom = staffTop + STAFF_HEIGHT_SP;
      const y = above
        ? Math.min(staffTop - OTTAVA_MIN_RISE_SP, spanCeiling(primitives, x1, x2, staffTop) - OTTAVA_CLEARANCE_SP)
        : Math.max(staffBottom + OTTAVA_MIN_RISE_SP, spanFloor(primitives, x1, x2, staffBottom) + OTTAVA_CLEARANCE_SP);

      let lineStart = x1;
      if (first) {
        primitives.push({
          kind: 'text',
          text: ottavaLabel(value),
          x: x1,
          y: above ? y + 0.5 : y + OTTAVA_LABEL_SIZE_SP,
          font: 'bodyItalic',
          size: OTTAVA_LABEL_SIZE_SP,
          weight: 'bold',
          anchor: 'start',
          className: 'ottava-label'
        });
        lineStart = x1 + OTTAVA_LABEL_GAP_SP;
      }
      if (x2 > lineStart) {
        primitives.push({
          kind: 'line',
          x1: lineStart, y1: y, x2, y2: y,
          thickness: OTTAVA_THICKNESS_SP,
          dash: OTTAVA_DASH_SP,
          className: 'ottava'
        });
      }
      if (last) {
        primitives.push({
          kind: 'line',
          x1: x2, y1: y, x2, y2: y + (above ? OTTAVA_HOOK_SP : -OTTAVA_HOOK_SP),
          thickness: OTTAVA_THICKNESS_SP,
          className: 'ottava'
        });
      }
      first = false;
      a = b + 1;
    }
  }
}

// ---------- Dynamics ----------

interface EmitDynamicsArgs {
  partMeasure: MnxPartMeasure;
  m: { staves: { x: number }[][][]; x: number; width: number };
  /** Staff-1-first sequence groups (same filter the plan used). */
  sequencesByStaff: MnxSequence[][];
  staffBottoms: number[];
  primitives: Primitive[];
}

/**
 * Draws the measure's dynamic markings below their staff, each centred on the
 * event column at (or after) its metric position. Mapped values use the SMuFL
 * composite glyphs; anything else renders as italic text so a novel marking
 * still shows up.
 */
function emitDynamics(args: EmitDynamicsArgs): void {
  const { partMeasure, m, sequencesByStaff, staffBottoms, primitives } = args;
  const dynamics = partMeasure.dynamics ?? [];
  if (dynamics.length === 0) return;

  // Onset → column x per staff, from its first voice; built lazily.
  const onsetXsByStaff = new Map<number, OnsetX[]>();
  const onsetXsFor = (s: number) => {
    let xs = onsetXsByStaff.get(s);
    if (!xs) {
      xs = measureOnsetXs(sequencesByStaff[s]?.[0], m.staves[s]?.[0] ?? []);
      onsetXsByStaff.set(s, xs);
    }
    return xs;
  };

  for (const dyn of dynamics) {
    const s = Math.min(Math.max((dyn.staff ?? 1) - 1, 0), staffBottoms.length - 1);
    const f = dyn.position?.fraction;
    if (!Array.isArray(f) || !f[1]) continue;
    const target = f[0] / f[1];
    const onsetXs = onsetXsFor(s);
    // The column at (or first after) the marked position; past the last
    // event, fall back to the end of the measure's content.
    const x =
      onsetXs.find(o => o.t >= target - 1e-6)?.x ??
      (onsetXs.length ? m.x + m.width - 2 : m.x + 2);
    const y = staffBottoms[s] + DYNAMIC_BASELINE_DROP_SP;
    const glyph = dynamicGlyph(dyn);
    if (glyph) {
      primitives.push({
        kind: 'glyph',
        glyph,
        x,
        y,
        anchor: 'middle',
        className: 'dynamic'
      });
    } else {
      const label = dynamicLabel(dyn);
      if (!label) continue;
      primitives.push({
        kind: 'text',
        text: label,
        x,
        y,
        font: 'bodyItalic',
        size: 1.8,
        weight: 'bold',
        anchor: 'middle',
        className: 'dynamic'
      });
    }
  }
}

// ---------- Score text: part directions ----------

interface EmitDirectionsArgs {
  partMeasure: MnxPartMeasure;
  m: { staves: { x: number }[][][]; x: number; width: number };
  sequencesByStaff: MnxSequence[][];
  staffTops: number[];
  staffBottoms: number[];
  primitives: Primitive[];
}

/**
 * Draws a part's directions, each anchored to its column and placed by `orient`.
 *
 * `between` puts the text midway between this staff and the next, which is what
 * a two-way above/below cannot express — it belongs to the part rather than to
 * either staff. With one staff there is no "between", so it falls back to below.
 */
function emitDirections(args: EmitDirectionsArgs): void {
  const { partMeasure, m, sequencesByStaff, staffTops, staffBottoms, primitives } = args;
  const directions = partMeasure.directions ?? [];
  if (directions.length === 0) return;

  const onsetXsByStaff = new Map<number, OnsetX[]>();
  const onsetXsFor = (s: number) => {
    let xs = onsetXsByStaff.get(s);
    if (!xs) {
      xs = measureOnsetXs(sequencesByStaff[s]?.[0], m.staves[s]?.[0] ?? []);
      onsetXsByStaff.set(s, xs);
    }
    return xs;
  };

  // Several directions may share a column; stack them outward from the staff so
  // they cannot overprint. Counted per (staff, orient, column).
  const stackCount = new Map<string, number>();

  for (const dir of directions) {
    const text = dir.text ?? '';
    const glyph = dir.glyphs?.[0];
    if (!text && !glyph) continue;

    const lastStaff = staffBottoms.length - 1;
    const s = Math.min(Math.max((dir.staff ?? 1) - 1, 0), lastStaff);
    const f = dir.position?.fraction;
    if (!Array.isArray(f) || !f[1]) continue;

    const onsetXs = onsetXsFor(s);
    const target = f[0] / f[1];
    const x =
      onsetXs.find(o => o.t >= target - 1e-6)?.x ??
      (onsetXs.length ? m.x + m.width - 2 : m.x + 2);

    const orient = dir.orient ?? 'below';
    const between = orient === 'between' && s < lastStaff;
    const above = orient === 'above';

    const key = `${s}|${between ? 'between' : above ? 'above' : 'below'}|${x.toFixed(3)}`;
    const depth = stackCount.get(key) ?? 0;
    stackCount.set(key, depth + 1);

    const y = between
      ? (staffBottoms[s] + staffTops[s + 1]) / 2 + DIRECTION_SIZE_SP / 2 + depth * DIRECTION_STACK_SP
      : above
        ? staffTops[s] - DIRECTION_RISE_SP - depth * DIRECTION_STACK_SP
        : staffBottoms[s] + DIRECTION_DROP_SP + depth * DIRECTION_STACK_SP;

    primitives.push(
      glyph
        ? {
            kind: 'glyph',
            glyph,
            x,
            y,
            anchor: 'middle',
            ...(dir.color ? { fill: dir.color } : {}),
            // `between` is placed relative to the GAP, not to a staff — the
            // gap measurement has to know (see measureDisplayGaps).
            className: between ? 'direction direction-between' : 'direction'
          }
        : {
            kind: 'text',
            text,
            x,
            y,
            font: 'bodyItalic',
            size: DIRECTION_SIZE_SP,
            anchor: 'middle',
            ...(dir.color ? { fill: dir.color } : {}),
            // `between` is placed relative to the GAP, not to a staff — the
            // gap measurement has to know (see measureDisplayGaps).
            className: between ? 'direction direction-between' : 'direction'
          }
    );
  }
}

// ---------- Grace notes ----------

interface EmitGraceGroupArgs {
  grace: MnxGrace;
  /** Centre of the first grace-note column (the plan reserves
   *  GRACE_NOTE_ADVANCE_SP per inner note). */
  firstX: number;
  /** The plan's ink ratio: every glyph-relative x offset in the cluster
   *  (head, stem, ledger, accidental, dot) is ink and scales by it. */
  ink: number;
  staffTop: number;
  clef: ActiveClef;
  useAccidentalDisplay: boolean;
  keyFifths: number;
  primitives: Primitive[];
  /** Selection key for the note at (raw index in the container's content,
   *  note index) — container content is addressable now (campaign item 11b),
   *  and the RAW index is what `model/noteWalk.ts` counts. */
  keyFor?: (containerIndex: number, noteIndex: number) => string | undefined;
}

/**
 * Draws an MNX grace container: small noteheads (GRACE_SCALE). A single grace
 * note keeps the traditional always-up stem with flag + acciaccatura slash;
 * a beamed group follows the normal pitch-based stem rule and is slashed
 * through its first stem — both defaults mirror the spec's own reference
 * engravings (grace-note / beams-inner-grace-notes vs beams-grace-notes),
 * and `slash: false` opts out. Groups beam their own notes, never the
 * principal.
 */
function emitGraceGroup(args: EmitGraceGroupArgs): void {
  const { grace, firstX, ink, staffTop, clef, useAccidentalDisplay, keyFifths, primitives, keyFor } = args;
  const rawIndex = new Map<MnxEvent, number>(grace.content.map((e, i) => [e, i]));
  const inner = grace.content.filter(e => !e.rest && (e.notes?.length ?? 0) > 0);
  if (inner.length === 0) return;

  const beamed = inner.length >= 2;
  const headW = NOTEHEAD_WIDTH_SP * GRACE_SCALE;

  // Stem direction: groups by the pitch rule (note furthest from the middle
  // line decides), single graces always up — matching the spec engravings.
  const allYs = inner.flatMap(e =>
    (e.notes ?? []).map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef))
  );
  const dir: 1 | -1 = beamed ? autoStemDir(allYs) : 1;

  interface GraceStem {
    x: number;
    attachY: number;
    /** Extreme notehead centre on the tip side. */
    tipBaseY: number;
    levels: number;
  }
  const stems: GraceStem[] = [];

  inner.forEach((event, j) => {
    const x = firstX + j * GRACE_NOTE_ADVANCE_SP * ink;
    const notes = event.notes!;
    const staffYs = notes.map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef));
    const headGlyph = NOTEHEAD_GLYPH_BY_BASE[event.duration.base] ?? 'noteheadBlack';

    for (const ly of unionLedgerLines(staffYs)) {
      primitives.push({
        kind: 'line',
        x1: x - (headW / 2) * ink - LEDGER_OVERHANG_SP * GRACE_SCALE * ink,
        y1: staffTop + ly,
        x2: x + (headW / 2) * ink + LEDGER_OVERHANG_SP * GRACE_SCALE * ink,
        y2: staffTop + ly,
        thickness: LEDGER_LINE_THICKNESS_SP,
        className: 'ledger-line grace'
      });
    }

    notes.forEach((n, idx) => {
      const accGlyph = noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths);
      if (accGlyph) {
        primitives.push({
          kind: 'glyph',
          glyph: accGlyph,
          x: x - (headW / 2) * ink - ACCIDENTAL_SLOT_WIDTH_SP * GRACE_SCALE * ink,
          y: staffTop + staffYs[idx],
          scale: GRACE_SCALE,
          className: 'accidental grace'
        });
      }
      const graceKey = keyFor?.(rawIndex.get(event) ?? 0, idx);
      primitives.push({
        kind: 'glyph',
        glyph: headGlyph,
        x: x - (headW / 2) * ink,
        y: staffTop + staffYs[idx],
        scale: GRACE_SCALE,
        className: 'notehead grace',
        ...(graceKey ? { sourceId: graceKey } : {})
      });
    });

    const anchor =
      dir === 1
        ? glyphAnchor(headGlyph, 'stemUpSE') ?? { x: NOTEHEAD_WIDTH_SP, y: 0.168 }
        : glyphAnchor(headGlyph, 'stemDownNW') ?? { x: 0, y: -0.168 };
    const stemX = x - (headW / 2) * ink + anchor.x * GRACE_SCALE * ink;
    const attachY =
      staffTop + (dir === 1 ? Math.max(...staffYs) : Math.min(...staffYs)) - anchor.y * GRACE_SCALE;
    const tipBaseY = staffTop + (dir === 1 ? Math.min(...staffYs) : Math.max(...staffYs));

    if (beamed) {
      stems.push({
        x: stemX,
        attachY,
        tipBaseY,
        levels: BEAM_LEVELS_BY_BASE[event.duration.base] ?? 1
      });
      return;
    }

    const tipY = tipBaseY - dir * GRACE_STEM_LENGTH_SP;
    primitives.push({
      kind: 'line',
      x1: stemX, y1: tipY, x2: stemX, y2: attachY,
      thickness: STEM_THICKNESS_SP,
      className: 'stem grace'
    });
    const flagGlyph = FLAG_GLYPH_BY_BASE_UP[event.duration.base];
    if (flagGlyph) {
      primitives.push({
        kind: 'glyph',
        glyph: flagGlyph,
        x: stemX,
        y: tipY,
        scale: GRACE_SCALE,
        className: 'flag grace'
      });
    }
    if (grace.slash !== false) {
      const midY = tipY + 1.1; // crossing the stem through the flag
      primitives.push({
        kind: 'line',
        x1: stemX - 0.45 * ink, y1: midY + 0.55,
        x2: stemX + 0.85 * ink, y2: midY - 0.55,
        thickness: GRACE_SLASH_THICKNESS_SP,
        className: 'grace-slash'
      });
    }
  });

  if (!beamed || stems.length < 2) return;

  // Mini beam for the group — same shape as emitBeamRun, in the group's dir.
  const idealTip = (s: GraceStem) => s.tipBaseY - dir * GRACE_STEM_LENGTH_SP;
  const first = stems[0];
  const last = stems[stems.length - 1];
  const span = last.x - first.x || 1;
  const maxSlant = BEAM_MAX_SLANT_SP * GRACE_SCALE;
  const slant = Math.max(-maxSlant, Math.min(maxSlant, idealTip(last) - idealTip(first)));
  const base = (x: number) => idealTip(first) + (slant * (x - first.x)) / span;
  const deltas = stems.map(s => idealTip(s) - base(s.x));
  const shift = dir === 1 ? Math.min(...deltas) : Math.max(...deltas);
  const lineY = (x: number) => base(x) + shift;
  const beamThickness = BEAM_THICKNESS_SP * GRACE_SCALE;
  const levelY = (x: number, level: number) =>
    lineY(x) + dir * (level - 1) * (beamThickness + BEAM_GAP_SP * GRACE_SCALE);

  for (const s of stems) {
    primitives.push({
      kind: 'line',
      x1: s.x, y1: s.attachY,
      x2: s.x, y2: lineY(s.x),
      thickness: STEM_THICKNESS_SP,
      className: 'stem grace'
    });
  }

  const bar = (xa: number, xb: number, level: number) => {
    primitives.push({
      kind: 'line',
      x1: xa - STEM_THICKNESS_SP / 2, y1: levelY(xa, level),
      x2: xb + STEM_THICKNESS_SP / 2, y2: levelY(xb, level),
      thickness: beamThickness,
      className: 'beam grace'
    });
  };
  bar(first.x, last.x, 1);
  const maxLevels = Math.max(...stems.map(s => s.levels));
  for (let level = 2; level <= maxLevels; level++) {
    for (let j = 0; j < stems.length - 1; j++) {
      if (stems[j].levels >= level && stems[j + 1].levels >= level) {
        bar(stems[j].x, stems[j + 1].x, level);
      }
    }
  }

  // The spec's reference engravings slash beamed groups through the first
  // stem (acciaccatura by default); `slash: false` opts out.
  if (grace.slash !== false) {
    const midY = (lineY(first.x) + first.attachY) / 2;
    primitives.push({
      kind: 'line',
      x1: first.x - 0.55, y1: midY + 0.7,
      x2: first.x + 0.75, y2: midY - 0.7,
      thickness: GRACE_SLASH_THICKNESS_SP,
      className: 'grace-slash'
    });
  }
}

// ---------- Multi-note tremolos ----------

interface EmitTremoloGroupArgs {
  tremolo: MnxTremolo;
  /** Centre of the first written note's column (the plan reserves
   *  TREMOLO_NOTE_ADVANCE_SP between the pair). */
  firstX: number;
  /** The plan's ink ratio: every glyph-relative x offset in the cluster
   *  (head, stem, ledger, accidental, dot) is ink and scales by it. */
  ink: number;
  staffTop: number;
  clef: ActiveClef;
  useAccidentalDisplay: boolean;
  keyFifths: number;
  primitives: Primitive[];
  /** Selection key for the note at (raw index in the container's content,
   *  note index) — container content is addressable now (campaign item 11b),
   *  and the RAW index is what `model/noteWalk.ts` counts. */
  keyFor?: (containerIndex: number, noteIndex: number) => string | undefined;
}

/**
 * Draws an MNX multi-note tremolo: its two written notes (each carrying the
 * tremolo's total duration) with `marks` beams floating between them —
 * between the stems when the notes are stemmed, between the noteheads for
 * whole notes. Stem direction follows the pair's combined pitches.
 */
function emitTremoloGroup(args: EmitTremoloGroupArgs): void {
  const { tremolo, firstX, ink, staffTop, clef, useAccidentalDisplay, keyFifths, primitives, keyFor } = args;
  const rawIndex = new Map<MnxEvent, number>(tremolo.content.map((e, i) => [e, i]));
  const inner = tremolo.content.filter(e => (e.notes?.length ?? 0) > 0).slice(0, 2);
  if (inner.length === 0) return;

  const allYs = inner.flatMap(e =>
    (e.notes ?? []).map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef))
  );
  const dir = autoStemDir(allYs);

  interface WrittenNote {
    x: number;
    stemX: number | null;
    /** Outermost notehead centre on the stems' side — the beam channel
     *  runs parallel to the line through these. */
    headY: number;
  }
  const written: WrittenNote[] = [];

  inner.forEach((event, j) => {
    const x = firstX + j * TREMOLO_NOTE_ADVANCE_SP * ink;
    const notes = event.notes!;
    const staffYs = notes.map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef));
    const headGlyph = NOTEHEAD_GLYPH_BY_BASE[event.duration.base] ?? 'noteheadBlack';
    const hasStem = headGlyph !== 'noteheadWhole';

    for (const ly of unionLedgerLines(staffYs)) {
      primitives.push({
        kind: 'line',
        x1: x - (NOTEHEAD_WIDTH_SP / 2) * ink - LEDGER_OVERHANG_SP * ink,
        y1: staffTop + ly,
        x2: x + (NOTEHEAD_WIDTH_SP / 2) * ink + LEDGER_OVERHANG_SP * ink,
        y2: staffTop + ly,
        thickness: LEDGER_LINE_THICKNESS_SP,
        className: 'ledger-line'
      });
    }

    notes.forEach((n, idx) => {
      const tremoloKey = keyFor?.(rawIndex.get(event) ?? 0, idx);
      const accGlyph = noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths);
      if (accGlyph) {
        primitives.push({
          kind: 'glyph',
          glyph: accGlyph,
          x: x - (NOTEHEAD_WIDTH_SP / 2) * ink - ACCIDENTAL_SLOT_WIDTH_SP * ink,
          y: staffTop + staffYs[idx],
          className: 'accidental'
        });
      }
      primitives.push({
        kind: 'glyph',
        glyph: headGlyph,
        x: x - (NOTEHEAD_WIDTH_SP / 2) * ink,
        y: staffTop + staffYs[idx],
        className: 'notehead',
        ...(tremoloKey ? { sourceId: tremoloKey } : {})
      });
    });

    const outerHeadY =
      staffTop + (dir === 1 ? Math.min(...staffYs) : Math.max(...staffYs));
    if (!hasStem) {
      written.push({ x, stemX: null, headY: outerHeadY });
      return;
    }
    const anchor =
      dir === 1
        ? glyphAnchor(headGlyph, 'stemUpSE') ?? { x: NOTEHEAD_WIDTH_SP, y: 0.168 }
        : glyphAnchor(headGlyph, 'stemDownNW') ?? { x: 0, y: -0.168 };
    const stemX = x - (NOTEHEAD_WIDTH_SP / 2) * ink + anchor.x * ink;
    const attachY =
      staffTop + (dir === 1 ? Math.max(...staffYs) : Math.min(...staffYs)) - anchor.y;
    const tipY =
      staffTop + (dir === 1 ? Math.min(...staffYs) : Math.max(...staffYs)) - dir * STEM_LENGTH_SP;
    primitives.push({
      kind: 'line',
      x1: stemX, y1: Math.min(attachY, tipY), x2: stemX, y2: Math.max(attachY, tipY),
      thickness: STEM_THICKNESS_SP,
      className: 'stem'
    });
    written.push({ x, stemX, headY: outerHeadY });
  });

  if (written.length < 2) return;

  const marks = Math.min(5, Math.max(1, tremolo.marks ?? 3));
  const [a, b] = written;
  const stemmed = a.stemX !== null && b.stemX !== null;
  // The beams run between the two written notes at the FULL slope of the
  // line through their noteheads, inset clear of heads and stems, and (when
  // stemmed) nudged toward the stems' side of that line.
  const inset = stemmed ? 1.2 : 1.6;
  const xA = stemmed ? Math.max(a.x + inset * ink, a.stemX! + 0.4 * ink) : a.x + inset * ink;
  const xB = stemmed ? Math.min(b.x - inset * ink, b.stemX! - 0.4 * ink) : b.x - inset * ink;
  const lineY = (x: number) =>
    a.headY + ((b.headY - a.headY) * (x - a.x)) / (b.x - a.x || 1);
  const nudge = stemmed ? -dir * 0.6 : 0;
  for (let k = 0; k < marks; k++) {
    const off = (k - (marks - 1) / 2) * (TREMOLO_BEAM_THICKNESS_SP + TREMOLO_BEAM_GAP_SP);
    primitives.push({
      kind: 'line',
      x1: xA, y1: lineY(xA) + nudge + off,
      x2: xB, y2: lineY(xB) + nudge + off,
      thickness: TREMOLO_BEAM_THICKNESS_SP,
      className: 'tremolo-beam'
    });
  }
}

// ---------- Tuplets ----------

const TUPLET_BRACKET_THICKNESS_SP = 0.13;
const TUPLET_HOOK_SP = 0.8;        // bracket end hooks, pointing at the staff
const TUPLET_NUMBER_SIZE_SP = 1.7;
const TUPLET_NUMBER_GAP_SP = 1.1;  // bracket gap either side of the number

interface EmitTupletGroupArgs {
  tuplet: MnxTuplet;
  /** Centre of the first inner column's core (the plan reserved
   *  tupletColumns() widths for the whole group). */
  firstX: number;
  /** The plan's ink ratio: every glyph-relative x offset in the cluster
   *  (head, stem, ledger, accidental, dot) is ink and scales by it. */
  ink: number;
  staffTop: number;
  clef: ActiveClef;
  useAccidentalDisplay: boolean;
  keyFifths: number;
  primitives: Primitive[];
  /** Selection key for the note at (raw index in the container's content,
   *  note index) — container content is addressable now (campaign item 11b),
   *  and the RAW index is what `model/noteWalk.ts` counts. */
  keyFor?: (containerIndex: number, noteIndex: number) => string | undefined;
}

/**
 * Draws an MNX tuplet: its inner events at the plan's pre-scaled columns,
 * beamed among themselves when every member is beamable (eighths or shorter)
 * — in which case the number sits on the beam and no bracket draws — else
 * flagged individually under a hooked bracket below the group with the
 * `inner.multiple` number in a gap, as in the spec's reference engraving.
 */
function emitTupletGroup(args: EmitTupletGroupArgs): void {
  const { tuplet, firstX, ink, staffTop, clef, useAccidentalDisplay, keyFifths, primitives, keyFor } = args;
  const cols = tupletColumns(tuplet, useAccidentalDisplay, keyFifths);
  const events = tuplet.content;
  if (events.length === 0) return;

  const fullyBeamed =
    events.length >= 2 &&
    events.every(
      e =>
        isTimedEvent(e) &&
        !e.rest &&
        (e.notes?.length ?? 0) > 0 &&
        (BEAM_LEVELS_BY_BASE[e.duration.base] ?? 0) >= 1
    );
  const groupYs = events.flatMap(e =>
    isTimedEvent(e) ? (e.notes ?? []).map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef)) : []
  );
  const groupDir = autoStemDir(groupYs);

  interface InnerStem {
    x: number;
    attachY: number;
    baseTipY: number;
  }
  const beamStems: InnerStem[] = [];
  let lowestY = staffTop + STAFF_HEIGHT_SP; // bracket clearance (max y seen)
  // The inner columns are rigid ink, priced by the plan at the same ratio —
  // the walk here has to agree with it term for term.
  let colStart = firstX - (CORE_SP / 2) * ink;
  let lastX = firstX;

  events.forEach((event, j) => {
    const col = cols[j] ?? { leading: 0, advance: CORE_SP };
    const x = colStart + col.leading * ink + (CORE_SP / 2) * ink;
    colStart += col.advance * ink;
    lastX = x;
    if (!isTimedEvent(event)) return;

    const base = event.duration.base;
    if (event.rest) {
      // `rest.staffPosition` (half-spaces from the middle line, +up) overrides
      // the value's default resting place — same convention as full-measure rests.
      const restY =
        event.rest.staffPosition !== undefined
          ? STAFF_MIDDLE_Y - event.rest.staffPosition / 2
          : REST_Y_BY_BASE[base] ?? 2;
      primitives.push({
        kind: 'glyph',
        glyph: REST_GLYPH_BY_BASE[base] ?? 'restQuarter',
        x,
        y: staffTop + restY,
        anchor: 'middle',
        className: 'rest'
      });
      return;
    }
    const notes = event.notes ?? [];
    if (notes.length === 0) return;
    const staffYs = notes.map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef));
    const headGlyph = NOTEHEAD_GLYPH_BY_BASE[base] ?? 'noteheadBlack';
    const hasStem = headGlyph !== 'noteheadWhole';
    const dir = fullyBeamed ? groupDir : autoStemDir(staffYs);

    for (const ly of unionLedgerLines(staffYs)) {
      primitives.push({
        kind: 'line',
        x1: x - (NOTEHEAD_WIDTH_SP / 2) * ink - LEDGER_OVERHANG_SP * ink,
        y1: staffTop + ly,
        x2: x + (NOTEHEAD_WIDTH_SP / 2) * ink + LEDGER_OVERHANG_SP * ink,
        y2: staffTop + ly,
        thickness: LEDGER_LINE_THICKNESS_SP,
        className: 'ledger-line'
      });
    }
    notes.forEach((n, idx) => {
      const accGlyph = noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths);
      if (accGlyph) {
        primitives.push({
          kind: 'glyph',
          glyph: accGlyph,
          x: x - (NOTEHEAD_WIDTH_SP / 2) * ink - ACCIDENTAL_SLOT_WIDTH_SP * ink,
          y: staffTop + staffYs[idx],
          className: 'accidental'
        });
      }
      primitives.push({
        kind: 'glyph',
        glyph: headGlyph,
        x: x - (NOTEHEAD_WIDTH_SP / 2) * ink,
        y: staffTop + staffYs[idx],
        className: 'notehead',
        ...(keyFor?.(j, idx) ? { sourceId: keyFor(j, idx)! } : {})
      });
      for (let d = 0; d < (event.duration.dots ?? 0); d++) {
        const yDot = Math.round(staffYs[idx]) === staffYs[idx] ? staffYs[idx] - 0.5 : staffYs[idx];
        primitives.push({
          kind: 'glyph',
          glyph: 'augmentationDot',
          x: x + (NOTEHEAD_WIDTH_SP / 2) * ink + DOT_RIGHT_PAD_SP * ink + d * 0.4 * ink,
          y: staffTop + yDot,
          className: 'dot'
        });
      }
    });
    lowestY = Math.max(lowestY, staffTop + Math.max(...staffYs));

    if (!hasStem) return;
    const anchor =
      dir === 1
        ? glyphAnchor(headGlyph, 'stemUpSE') ?? { x: NOTEHEAD_WIDTH_SP, y: 0.168 }
        : glyphAnchor(headGlyph, 'stemDownNW') ?? { x: 0, y: -0.168 };
    const stemX = x - (NOTEHEAD_WIDTH_SP / 2) * ink + anchor.x * ink;
    const attachY =
      staffTop + (dir === 1 ? Math.max(...staffYs) : Math.min(...staffYs)) - anchor.y;
    const baseTipY = staffTop + (dir === 1 ? Math.min(...staffYs) : Math.max(...staffYs));
    if (fullyBeamed) {
      beamStems.push({ x: stemX, attachY, baseTipY });
      return;
    }
    const tipY = baseTipY - dir * STEM_LENGTH_SP;
    primitives.push({
      kind: 'line',
      x1: stemX, y1: Math.min(attachY, tipY), x2: stemX, y2: Math.max(attachY, tipY),
      thickness: STEM_THICKNESS_SP,
      className: 'stem'
    });
    lowestY = Math.max(lowestY, Math.max(attachY, tipY));
    const flagGlyph = dir === 1 ? FLAG_GLYPH_BY_BASE_UP[base] : FLAG_GLYPH_BY_BASE_DOWN[base];
    if (flagGlyph) {
      primitives.push({ kind: 'glyph', glyph: flagGlyph, x: stemX, y: tipY, className: 'flag' });
    }
  });

  const number = tuplet.showNumber === 'noNumber' ? null : String(tuplet.inner.multiple);

  // Fully-beamed group: mini beam over its own stems; the number rides the
  // beam and no bracket draws (the beam plays that role).
  if (fullyBeamed && beamStems.length >= 2) {
    const dir = groupDir;
    const idealTip = (st: InnerStem) => st.baseTipY - dir * STEM_LENGTH_SP;
    const first = beamStems[0];
    const last = beamStems[beamStems.length - 1];
    const span = last.x - first.x || 1;
    const slant = Math.max(
      -BEAM_MAX_SLANT_SP,
      Math.min(BEAM_MAX_SLANT_SP, idealTip(last) - idealTip(first))
    );
    const base = (x: number) => idealTip(first) + (slant * (x - first.x)) / span;
    const deltas = beamStems.map(st => idealTip(st) - base(st.x));
    const shift = dir === 1 ? Math.min(...deltas) : Math.max(...deltas);
    const lineY = (x: number) => base(x) + shift;
    for (const st of beamStems) {
      primitives.push({
        kind: 'line',
        x1: st.x, y1: st.attachY, x2: st.x, y2: lineY(st.x),
        thickness: STEM_THICKNESS_SP,
        className: 'stem'
      });
    }
    primitives.push({
      kind: 'line',
      x1: first.x - STEM_THICKNESS_SP / 2, y1: lineY(first.x),
      x2: last.x + STEM_THICKNESS_SP / 2, y2: lineY(last.x),
      thickness: BEAM_THICKNESS_SP,
      className: 'beam'
    });
    if (number) {
      const midX = (first.x + last.x) / 2;
      primitives.push({
        kind: 'text',
        text: number,
        x: midX,
        y: lineY(midX) + (dir === 1 ? -0.8 : 2.2),
        font: 'bodyItalic',
        size: TUPLET_NUMBER_SIZE_SP,
        weight: 'bold',
        anchor: 'middle',
        className: 'tuplet-number'
      });
    }
    return;
  }

  // Bracketed group: hooked bracket below (clear of noteheads and stems),
  // number in a gap at its centre — per the reference engraving.
  if (tuplet.bracket === 'no') return;
  const x1 = firstX - 1.0;
  const x2 = lastX + 1.0;
  const y = lowestY + 1.4;
  const midX = (x1 + x2) / 2;
  for (const [xa, xb] of [
    [x1, midX - TUPLET_NUMBER_GAP_SP],
    [midX + TUPLET_NUMBER_GAP_SP, x2]
  ]) {
    if (xb > xa) {
      primitives.push({
        kind: 'line',
        x1: xa, y1: y, x2: xb, y2: y,
        thickness: TUPLET_BRACKET_THICKNESS_SP,
        className: 'tuplet-bracket'
      });
    }
  }
  for (const xe of [x1, x2]) {
    primitives.push({
      kind: 'line',
      x1: xe, y1: y, x2: xe, y2: y - TUPLET_HOOK_SP,
      thickness: TUPLET_BRACKET_THICKNESS_SP,
      className: 'tuplet-bracket'
    });
  }
  if (number) {
    primitives.push({
      kind: 'text',
      text: number,
      x: midX,
      y: y + 0.55,
      font: 'bodyItalic',
      size: TUPLET_NUMBER_SIZE_SP,
      weight: 'bold',
      anchor: 'middle',
      className: 'tuplet-number'
    });
  }
}

// ---------- Event emission ----------

interface EmitEventArgs {
  event: MnxEvent;
  eventX: number;
  /** The plan's ink ratio (core-ink-priced-columns.md): the column centre is
   *  a musical position, but every offset FROM it — half a notehead, the stem
   *  anchor, ledger overhang, accidental and dot clearances — is ink, and ink
   *  grows with the vertical scale. Scaling them keeps the stem on the head
   *  and the ledger under it at any staff scale. */
  ink: number;
  staffTop: number;
  clef: ActiveClef;
  stemOverride: 1 | -1 | null;
  /** Set when the event is in a beam run: forces stem direction and defers
   *  the stem (returned, not emitted) so it can be drawn to the beam line. */
  beamDir: 1 | -1 | null;
  useAccidentalDisplay: boolean;
  keyFifths: number;
  activeNoteIds: readonly string[];
  selectedNoteIds: readonly string[];
  primitives: Primitive[];
  index: SpatialIndex;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  /** System row, recorded on curve anchors (curves split between rows). */
  row: number;
  /** This event's key in the curve-anchor registry. */
  curveKey: string;
  curveAnchors: CurveAnchors;
  /** Staff-1 events synthesize positional note keys (the walk in
   *  model/noteWalk.ts); other staves use real note ids only. */
  synthesizeKeys: boolean;
  /** Which part those keys belong to (campaign item 13b). */
  keyPartIndex?: number;
  /** Which staff of it (13c). */
  keyStaffIndex?: number;
}

/** Returns the deferred stem when the event is beamed, else null. */
function emitEvent(args: EmitEventArgs): BeamedStem | null {
  const {
    event, eventX, ink, staffTop, clef, stemOverride, beamDir, useAccidentalDisplay, keyFifths,
    activeNoteIds, selectedNoteIds,
    primitives, index, measureIndex, voiceIndex, eventIndex,
    row, curveKey, curveAnchors, synthesizeKeys, keyPartIndex, keyStaffIndex
  } = args;

  const base = event.duration.base;
  const dots = event.duration.dots ?? 0;

  // ---- Rest ----
  if (event.rest) {
    const glyph = REST_GLYPH_BY_BASE[base] ?? 'restQuarter';
    // `rest.staffPosition` (half-spaces from the middle line, +up) overrides the
    // value's default resting place — same convention as full-measure rests.
    const positioned = event.rest.staffPosition !== undefined;
    const yOffset = positioned
      ? STAFF_MIDDLE_Y - event.rest.staffPosition! / 2
      : REST_Y_BY_BASE[base] ?? 2;
    primitives.push({
      kind: 'glyph',
      glyph,
      x: eventX,
      y: staffTop + yOffset,
      anchor: 'middle',
      className: 'rest'
    });
    // Augmentation dots for rests (just above the rest's centre)
    for (let d = 0; d < dots; d++) {
      primitives.push({
        kind: 'glyph',
        glyph: 'augmentationDot',
        x: eventX + 0.7 * ink + d * 0.3 * ink,
        y: staffTop + (positioned ? yOffset - 0.5 : base === 'whole' ? 1 : 1.5),
        className: 'dot'
      });
    }
    return null;
  }

  // ---- Notes ----
  if (!event.notes || event.notes.length === 0) return null;

  const notes = event.notes;
  const noteheadGlyph = NOTEHEAD_GLYPH_BY_BASE[base] ?? 'noteheadBlack';
  // Centre by the glyph's real width — the whole note (1.688) is wider than the
  // black/half notehead (NOTEHEAD_WIDTH_SP), so a fixed offset would shift it off
  // its column and its ledger line.
  const headW = glyphBBox(noteheadGlyph)?.w ?? NOTEHEAD_WIDTH_SP;
  // Per-note selection keys: the note's id, or a synthesized positional key
  // for id-less documents (see src/utils/noteKeys.ts) so selection and the
  // note↔document cross-highlight work across the whole corpus.
  const noteIds = notes.map((n, idx) =>
    synthesizeKeys
      ? noteKeyAt(
          n, measureIndex, voiceIndex, eventIndex, idx, undefined, keyPartIndex ?? 0, keyStaffIndex ?? 1
        )
      : n.id
  );
  const primaryNoteId = noteIds.find((id): id is string => id !== undefined);

  // Pitch → staff y for each chord member
  const staffYs = notes.map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef));

  // Event-level highlight for the geometry chord members share (ledger
  // lines, stem); noteheads and accidentals color per NOTE below, so the
  // editor's one-note cursor stays visible inside a chord.
  const isActive = noteIds.some(id => id !== undefined && activeNoteIds.includes(id));
  const isSelected = noteIds.some(id => id !== undefined && selectedNoteIds.includes(id));
  const fill = isActive ? ACTIVE_COLOR : isSelected ? SELECTED_COLOR : undefined;
  const colorClass = isActive ? ' active' : isSelected ? ' selected' : '';
  const noteFill = (idx: number): string | undefined => {
    const id = noteIds[idx];
    if (id === undefined) return undefined;
    return activeNoteIds.includes(id) ? ACTIVE_COLOR
      : selectedNoteIds.includes(id) ? SELECTED_COLOR
      : undefined;
  };
  const noteColorClass = (idx: number): string => {
    const id = noteIds[idx];
    if (id === undefined) return '';
    return activeNoteIds.includes(id) ? ' active' : selectedNoteIds.includes(id) ? ' selected' : '';
  };

  // Stem direction — a beam run's shared direction trumps everything.
  const eventStemDir = (event as { stemDirection?: 'up' | 'down' }).stemDirection;
  const stemDir: 1 | -1 = beamDir !== null
    ? beamDir
    : stemOverride !== null
    ? stemOverride
    : eventStemDir === 'up' ? 1
    : eventStemDir === 'down' ? -1
    : autoStemDir(staffYs);
  const hasStem = noteheadGlyph !== 'noteheadWhole';

  // Record this event's geometry for the slur/tie post-pass.
  const curveAnchor: EventCurveAnchor = {
    x: eventX,
    row,
    stemDir,
    headYs: staffYs.map(y => staffTop + y)
  };
  curveAnchors.byKey.set(curveKey, curveAnchor);
  if (event.id) curveAnchors.byEventId.set(event.id, curveAnchor);
  notes.forEach((n, idx) => {
    if (n.id) curveAnchors.byNoteId.set(n.id, { anchor: curveAnchor, noteIndex: idx });
  });

  // Ledger lines
  const ledgerYs = unionLedgerLines(staffYs);
  for (const ly of ledgerYs) {
    primitives.push({
      kind: 'line',
      x1: eventX - (headW / 2) * ink - LEDGER_OVERHANG_SP * ink,
      y1: staffTop + ly,
      x2: eventX + (headW / 2) * ink + LEDGER_OVERHANG_SP * ink,
      y2: staffTop + ly,
      thickness: LEDGER_LINE_THICKNESS_SP,
      stroke: fill,
      className: 'ledger-line'
    });
  }

  // Accidentals (left of the notehead column)
  const accidentalEntries = notes
    .map((n, idx) => ({
      glyph: noteAccidentalGlyph(n, useAccidentalDisplay, keyFifths),
      staffY: staffYs[idx],
      noteIdx: idx
    }))
    .filter(e => e.glyph);
  const accidentalsToLeft = accidentalEntries.length;
  accidentalEntries.forEach((acc, idx) => {
    const offset = (accidentalsToLeft - idx) * ACCIDENTAL_SLOT_WIDTH_SP + ACCIDENTAL_RIGHT_PAD_SP;
    primitives.push({
      kind: 'glyph',
      glyph: acc.glyph!,
      x: eventX - (NOTEHEAD_WIDTH_SP / 2) * ink - offset * ink,
      y: staffTop + acc.staffY,
      fill: noteFill(acc.noteIdx),
      className: 'accidental' + noteColorClass(acc.noteIdx)
    });
  });

  // Noteheads
  notes.forEach((_n, idx) => {
    const y = staffTop + staffYs[idx];
    primitives.push({
      kind: 'glyph',
      glyph: noteheadGlyph,
      // The scaled ink stays centred on the column: the plan priced the
      // column at the same ratio, so the centre is where the ink belongs.
      x: eventX - (headW / 2) * ink,
      y,
      fill: noteFill(idx),
      className: 'notehead' + noteColorClass(idx),
      sourceId: noteIds[idx]
    });
  });

  // Stem
  let deferredStem: BeamedStem | null = null;
  if (hasStem) {
    const minStaffY = Math.min(...staffYs);
    const maxStaffY = Math.max(...staffYs);
    // SMuFL anchors are y-positive-UP relative to the glyph origin; our staff
    // coords are y-positive-down, so anchor.y is subtracted. The rotated-oval
    // noteheads attach below centre on the NW side and above centre on the SE
    // side — applying the sign wrong leaves the stem poking past the head.
    let stemX: number;
    let attachY: number;  // notehead end of the stem
    let baseTipY: number; // extreme notehead centre on the tip side
    if (stemDir === 1) {
      // up: from right of lowest notehead (highest y in our coords) upward
      const anchor = glyphAnchor(noteheadGlyph, 'stemUpSE') ?? { x: NOTEHEAD_WIDTH_SP, y: 0.168 };
      stemX = eventX - (NOTEHEAD_WIDTH_SP / 2) * ink + anchor.x * ink;
      attachY = staffTop + maxStaffY - anchor.y;
      baseTipY = staffTop + minStaffY;
    } else {
      // down: from left of highest notehead downward
      const anchor = glyphAnchor(noteheadGlyph, 'stemDownNW') ?? { x: 0, y: -0.168 };
      stemX = eventX - (NOTEHEAD_WIDTH_SP / 2) * ink + anchor.x * ink;
      attachY = staffTop + minStaffY - anchor.y;
      baseTipY = staffTop + maxStaffY;
    }
    const tipY = baseTipY - stemDir * STEM_LENGTH_SP;

    // Single-note tremolo: `marks` slashes through the stem (the SMuFL
    // combining glyphs are designed centred on the stem).
    const tremoloMarks = event.markings?.tremolo
      ? Math.min(5, Math.max(1, event.markings.tremolo.marks ?? 3))
      : 0;
    if (tremoloMarks) {
      // Bravura's tremolo glyphs are ink-centred on their origin — drawing
      // at the stem x with the default anchor centres them on the stem.
      primitives.push({
        kind: 'glyph',
        glyph: `tremolo${tremoloMarks}`,
        x: stemX,
        y: (attachY + tipY) / 2,
        fill,
        className: 'tremolo' + colorClass
      });
    }

    if (beamDir !== null) {
      // Beamed: the run draws the stem out to the shared beam line.
      deferredStem = { stemX, attachY, baseTipY, fill, colorClass };
    } else {
      primitives.push({
        kind: 'line',
        x1: stemX, y1: stemDir === 1 ? tipY : attachY,
        x2: stemX, y2: stemDir === 1 ? attachY : tipY,
        thickness: STEM_THICKNESS_SP,
        stroke: fill,
        className: 'stem' + colorClass
      });

      // Flag (only on unbeamed flagged durations)
      const flagGlyph = stemDir === 1
        ? FLAG_GLYPH_BY_BASE_UP[base]
        : FLAG_GLYPH_BY_BASE_DOWN[base];
      if (flagGlyph) {
        primitives.push({
          kind: 'glyph',
          glyph: flagGlyph,
          x: stemX,
          y: tipY,
          fill,
          className: 'flag' + colorClass
        });
      }
    }
  }

  // A stemless note (whole) carries its tremolo slashes above the notehead.
  if (!hasStem && event.markings?.tremolo) {
    const marks = Math.min(5, Math.max(1, event.markings.tremolo.marks ?? 3));
    primitives.push({
      kind: 'glyph',
      glyph: `tremolo${marks}`,
      x: eventX,
      y: staffTop + Math.min(...staffYs) - 1.8,
      fill,
      className: 'tremolo' + colorClass
    });
  }

  // Augmentation dots (one per dot, in the space adjacent to each notehead)
  if (dots > 0) {
    notes.forEach((_n, idx) => {
      const y = staffYs[idx];
      // place dot in adjacent space (not on a line)
      const isOnLine = Math.round(y) === y;
      const dotY = isOnLine ? y - 0.5 : y;
      for (let d = 0; d < dots; d++) {
        primitives.push({
          kind: 'glyph',
          glyph: 'augmentationDot',
          x: eventX + (NOTEHEAD_WIDTH_SP / 2) * ink + DOT_RIGHT_PAD_SP * ink + d * 0.4 * ink,
          y: staffTop + dotY,
          fill,
          className: 'dot'
        });
      }
    });
  }

  // Articulations — on the side opposite the stem, stacking outward from the
  // extreme notehead, snapped off staff lines; strongAccent always sits above.
  if (event.markings) {
    let yAbove = Math.min(...staffYs) - 1;
    let yBelow = Math.max(...staffYs) + 1;
    for (const art of ARTICULATIONS) {
      if (!event.markings[art.key]) continue;
      const above = art.forceAbove || stemDir === -1;
      let y = above ? yAbove : yBelow;
      if (y >= 0 && y <= STAFF_HEIGHT_SP && Number.isInteger(y)) {
        y += above ? -0.5 : 0.5;
      }
      primitives.push({
        kind: 'glyph',
        glyph: above ? art.above : art.below,
        x: eventX,
        y: staffTop + y,
        anchor: 'middle',
        fill,
        className: 'articulation' + colorClass
      });
      if (above) yAbove = y - 1;
      else yBelow = y + 1;
    }
  }

  // Index
  if (primaryNoteId) {
    index.set(primaryNoteId, { measureIndex, voiceIndex, eventIndex });
    for (const id of noteIds) {
      if (id !== undefined && !index.has(id)) {
        index.set(id, { measureIndex, voiceIndex, eventIndex });
      }
    }
  }

  return deferredStem;
}
