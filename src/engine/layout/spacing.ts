import { ARPEGGIO_ROOM_SP, collectSpanMarks } from './arpeggio.ts';
import { isPartialEntry } from './unrolled.ts';
import type { PerformedEntry } from '../../model/passes.ts';
import { normalizeDisplayOptions, type DisplayOptions } from '../displayOptions.ts';
import { LYRIC_SIZE_SP, selectedLyricLineIds } from './lyricRuns.ts';
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
import { durationValue } from '../../model/durations.ts';
import { containerContent } from '../../model/noteWalk.ts';
import { writtenOctaves } from '../../model/transposition.ts';
import { dynamicWidthSp } from './dynamics.ts';
import { clearanceSpacing } from '../clearance.ts';

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

const CONTENT_LEFT_PAD_SP = 0.6;
const CONTENT_RIGHT_PAD_SP = 0.8;
/**
 * The gap between a system's opening barline and its clef. FIXED, not a
 * Space consumer (2026-09-16): it used to be the content-left pad plus a
 * 0.5sp system-start extra, both on Space lines, so the clef drifted away
 * from the barline as Space grew and touched it at zero. A system's opening
 * is a frame, not air between events, and the reader asked for it to hold
 * still. Mid-system bars keep `CONTENT_LEFT_PAD_SP` on its line.
 */
export const SYSTEM_START_PAD_SP = 1.1;
/** The legacy explicit-clearance frame keeps its historical pair (content-left
 *  plus this system-start extra, both through the frame's own curve). */
const LEGACY_START_BARLINE_PAD_SP = 0.5;
/**
 * Prefix glyph slots are INK plus a spare tail. The ink is the glyph's own
 * width (`gClef` 2.68sp, `6stringTabClef` 1.64sp, a time-signature digit pair
 * ~1.8sp); the tail is air, and air follows Space (`SPACE_LINES`), so at
 * Space 0 the clef, key and time signature abut. The tab clef's slot is
 * right-sized rather than tightened: the notation slot carries 1.36sp the
 * smaller glyph could never fill.
 */
const CLEF_INK_SP = 2.7;
const CLEF_TAIL_SP = 0.3;
const TAB_CLEF_INK_SP = 1.65;
const TAB_CLEF_TAIL_SP = 0.35;
const TIME_SIG_INK_SP = 1.8;
const TIME_SIG_TAIL_SP = 0.7;
export const KEY_SIG_GLYPH_ADVANCE_SP = 1.0;
const KEY_SIG_RIGHT_PAD_SP = 0.5;

export const ACCIDENTAL_SLOT_WIDTH_SP = 1.0; // one stacked accidental column
export const ACCIDENTAL_RIGHT_PAD_SP = 0.15; // air between the accidentals and the notehead

/**
 * Event columns are INK plus AIR, and the air follows Space
 * (`SPACE_LINES.columnAir`, roadmap/inprogress/core-space-units-sp.md). The
 * exported sums are the DEFAULT geometry — what every column is at Space 2.2
 * — and the ink parts are the floor: at Space 0 a notehead column is exactly
 * a notehead wide, so columns still never overlap, they abut. `columnGeometry`
 * resolves the set at a Space; readers take it from the plan, never from
 * these constants, so placement and pricing cannot disagree.
 */
const CORE_INK_SP = 1.2;           // a notehead (noteheadBlack is 1.18sp)
const CORE_AIR_SP = 0.3;
export const CORE_SP = CORE_INK_SP + CORE_AIR_SP; // notehead / fret-number column at the default
const DOT_INK_SP = 0.4;            // the augmentation dot and its gap from the head
const DOT_AIR_SP = 0.15;
const DOT_SP = DOT_INK_SP + DOT_AIR_SP;
const GRACE_INK_SP = 0.9;          // a grace notehead (small scale)
const GRACE_AIR_SP = 0.6;
export const GRACE_NOTE_ADVANCE_SP = GRACE_INK_SP + GRACE_AIR_SP; // column per grace note at the default
export const TREMOLO_NOTE_ADVANCE_SP = 5; // between a multi-note tremolo's two written notes
const GRACE_RIGHT_PAD_SP = 0.3;    // air between a grace group and its principal
const MID_CLEF_WIDTH_SP = 2.4;     // rigid column for a mid-measure clef change
const MID_CLEF_LEFT_PAD_SP = 0.3;  // air between the previous column and the clef
const DYNAMIC_SIDE_PAD_SP = 0.3;   // air either side of a dynamic mark

/** The column geometry the plan priced at, carried on the plan for every
 *  reader that walks a column (tuplet inner notes, grace runs, accidental
 *  offsets). Numbers in staff spaces at ink ratio 1. */
export interface ColumnGeometry {
  core: number;
  grace: number;
  dot: number;
  accidentalRightPad: number;
  graceRightPad: number;
  midClefLeftPad: number;
  dynamicSidePad: number;
  lyricSidePad: number;
}

/** The geometry at the default Space — the constants above, exactly. */
export const DEFAULT_COLUMNS: ColumnGeometry = {
  core: CORE_SP,
  grace: GRACE_NOTE_ADVANCE_SP,
  dot: DOT_SP,
  accidentalRightPad: ACCIDENTAL_RIGHT_PAD_SP,
  graceRightPad: GRACE_RIGHT_PAD_SP,
  midClefLeftPad: MID_CLEF_LEFT_PAD_SP,
  dynamicSidePad: DYNAMIC_SIDE_PAD_SP,
  lyricSidePad: 0.35
};

/** The geometry at a column-air factor (`SpacePolicy.columnAir`): ink plus
 *  air × factor. Identity at 1, by construction rather than by arithmetic. */
export function columnGeometry(air: number): ColumnGeometry {
  if (air === 1) return DEFAULT_COLUMNS;
  return {
    core: CORE_INK_SP + CORE_AIR_SP * air,
    grace: GRACE_INK_SP + GRACE_AIR_SP * air,
    dot: DOT_INK_SP + DOT_AIR_SP * air,
    accidentalRightPad: ACCIDENTAL_RIGHT_PAD_SP * air,
    graceRightPad: GRACE_RIGHT_PAD_SP * air,
    midClefLeftPad: MID_CLEF_LEFT_PAD_SP * air,
    dynamicSidePad: DYNAMIC_SIDE_PAD_SP * air,
    lyricSidePad: DEFAULT_COLUMNS.lyricSidePad * air
  };
}
export const REPEAT_START_WIDTH_SP = 2.0; // |: cluster after the prefix glyphs
export const REPEAT_END_EXTRA_SP = 1.4;   // room for the :| dots before the end barline
const MULTIREST_WIDTH_SP = 10;     // content width of a collapsed H-bar measure
// Syllable width estimate per character, as a fraction of the lyric em — so
// the column tracks the drawn text when the lyric size moves.
const LYRIC_CHAR_WIDTH_SP = LYRIC_SIZE_SP * 0.56;
const LYRIC_SIDE_PAD_SP = DEFAULT_COLUMNS.lyricSidePad; // air either side of a syllable
const ONSET_EPS = 1e-6;            // float tolerance for metric positions
/** Ideal space after a quarter note, in staff spaces, at the default Space —
 *  and the DEFINITION of the Space unit: Space `x` IS the air after a quarter
 *  note, so at `x = QUARTER_SPRING_SP` every spring is its base value
 *  (`SPACE_LINES.spring` is the identity there). Exported so a control can say
 *  what its number is. */
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

// The base-value table lives in model/durations.ts (audio reads it too);
// re-exported here because layout consumers look for it here.
export { durationValue };

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
 * The Space axis, in STAFF SPACES (roadmap/inprogress/core-space-units-sp.md).
 *
 * `x` is the air after a quarter note. The default is `QUARTER_SPRING_SP`
 * (2.2sp), the floor is a true zero, and the ceiling is a calibration choice
 * (see the ladder notes below). Every horizontal consumer of Space is one
 * CLAMPED LINE in `x`, `max(0, m·x + c)`, written here as the pair
 * `{ atZero, atDefault }` — what remains at `x = 0` and what the consumer is at
 * the default — because the intercept vector IS the zero engraving, and that is
 * the thing calibration starts from. A negative `atZero` is a consumer that
 * runs out before the springs do (the clamp holds it at zero from there); a
 * positive one keeps a floor.
 *
 * The floor is a LEGIBILITY floor, not a collision floor — the distinction is
 * load-bearing (core-zoom-density-pad.md ruling 1). Space scales the springs
 * and the discretionary air and never the rigid columns, so no value here can
 * make two glyphs overlap; at zero they simply abut. Its earlier life as a
 * multiplier with a 0.01 floor made the springs effectively zero already; what
 * kept "as tight as possible" out of reach was a 1sp margin floor and a 0.15sp
 * pad floor, both gone with the root curves they lived in.
 *
 * The other cost at the bottom is *proportional* notation: springs carry
 * duration, so squeezing them squeezes the difference between a quarter's
 * space and an eighth's. Below roughly 0.4sp that difference stops being
 * legible and rhythm is read from noteheads and beams — a trade a reader on a
 * tablet may want to make, and not one a constant should make for them. If
 * calibration decides some proportion must survive at zero, that is
 * `SPACE_LINES.spring.atZero > 0`, not a higher floor.
 *
 * **The ceiling** is where a system holds one bar, then no further: a line
 * cannot hold fewer than one bar, and inside a line the justifier normalizes
 * what Space did. On a long score the top of the range is inert, the ladder
 * reports it as inert, and the pad's arm greys out; on a short score it keeps
 * spreading. Measured on `twelve-bar-blues` at the workbench's own line width
 * the multiplier reached one bar per system at 4× ≈ 8.8sp.
 */
export const SPACE_DEFAULT_SP = QUARTER_SPRING_SP;
export const MIN_SPACE_SP = 0;
export const MAX_SPACE_SP = 8;

/** One consumer's response to Space: a clamped line through two named points. */
export interface SpaceLine {
  /** The value at `x = 0` — this consumer's share of the zero engraving. */
  atZero: number;
  /** The value at `x = SPACE_DEFAULT_SP`. */
  atDefault: number;
}

/** `max(0, m·x + c)` for the line through the two points. Written so that the
 *  default evaluates to `atDefault` EXACTLY in floating point when `atZero` is
 *  0 — the ratio `x / SPACE_DEFAULT_SP` is 1 there, not 0.999…, which is what
 *  lets the calibrated default keep byte-stable goldens. */
export function spaceLineAt(line: SpaceLine, x: number): number {
  return Math.max(0, line.atZero + (line.atDefault - line.atZero) * (x / SPACE_DEFAULT_SP));
}

/** The pads that follow Space. Glyph SLOTS are rigid and are not here. */
export type PadKind =
  | 'contentLeft' | 'keySigRight' | 'contentRight'
  | 'clefTail' | 'tabClefTail' | 'timeTail';

/**
 * The calibration table — every horizontal consumer and its two numbers.
 * `spring` is a FACTOR on each duration's base spring (`springSp`), so the
 * line per duration is `base(dur) × spring(x)`: `m` and `c` both shaped by
 * duration, which is what keeps a whole note wider than an eighth at every
 * `x` (including zero, if `atZero` is ever raised above 0). The leading spring
 * is a fixed fraction of the first event's spring (`MEASURE_LEAD_FACTOR`) and
 * so rides the same line. `columnAir` is likewise a FACTOR, on every air
 * constant inside a rigid column (`columnGeometry`): the notehead column's
 * 0.3sp, the dot's, the grace run's, the accidental/grace/clef/dynamic/lyric
 * pads. One row for all of them until calibration wants them apart.
 * `paperPad` is the same kind of factor for the VIEWER's horizontal paper
 * padding — the pixels between the pane edge and the engraving, which are
 * horizontal whitespace like any other and so Space's to remove. Both factor
 * rows are capped at their default (see `spacePolicy`).
 */
export const SPACE_LINES: { spring: SpaceLine; columnAir: SpaceLine; paperPad: SpaceLine; margin: SpaceLine } & Record<PadKind, SpaceLine> = {
  spring: { atZero: 0, atDefault: 1 },
  columnAir: { atZero: 0, atDefault: 1 },
  paperPad: { atZero: 0, atDefault: 1 },
  margin: { atZero: 0, atDefault: 2 },
  contentLeft: { atZero: 0, atDefault: CONTENT_LEFT_PAD_SP },
  keySigRight: { atZero: 0, atDefault: KEY_SIG_RIGHT_PAD_SP },
  contentRight: { atZero: 0, atDefault: CONTENT_RIGHT_PAD_SP },
  clefTail: { atZero: 0, atDefault: CLEF_TAIL_SP },
  tabClefTail: { atZero: 0, atDefault: TAB_CLEF_TAIL_SP },
  timeTail: { atZero: 0, atDefault: TIME_SIG_TAIL_SP }
};

/** What Space resolves to at `x`: the spring factor, the page margin, each
 *  pad, and the (legacy-only) spare tail on clef/time slots. The legacy
 *  explicit-clearance frame produces the same shape (`legacySpacePolicy`), so
 *  the planner and the packer read one interface. */
export interface SpacePolicy {
  spring: number;
  /** Factor on the air inside rigid columns — see `columnGeometry`. */
  columnAir: number;
  /** Factor on a viewer's horizontal paper padding (px, outside the engine). */
  paperPad: number;
  horizontalMargin: number;
  /** A system's opening barline-to-clef gap — fixed under the Space policy. */
  systemStartPad: number;
  pad: (kind: PadKind) => number;
  prefixGroupExtra: number;
}

export function spacePolicy(densityH = SPACE_DEFAULT_SP): SpacePolicy {
  const x = clampSpace(densityH);
  return {
    spring: spaceLineAt(SPACE_LINES.spring, x),
    // Column air follows Space DOWN to zero and stops at its default above
    // it: past the default the springs carry the spread, and a rigid column
    // that kept growing (× the ink ratio, on a low-vision staff) would push
    // a single bar past the pane. The one place a line is capped.
    columnAir: Math.min(1, spaceLineAt(SPACE_LINES.columnAir, x)),
    // Same cap, same reason: above the default the engine's own margin line
    // already widens the page edge, and the paper need not double it.
    paperPad: Math.min(1, spaceLineAt(SPACE_LINES.paperPad, x)),
    horizontalMargin: spaceLineAt(SPACE_LINES.margin, x),
    systemStartPad: SYSTEM_START_PAD_SP,
    pad: kind => spaceLineAt(SPACE_LINES[kind], x),
    prefixGroupExtra: 0
  };
}

const PAD_NORMAL_SP: Record<PadKind, number> = {
  contentLeft: CONTENT_LEFT_PAD_SP,
  keySigRight: KEY_SIG_RIGHT_PAD_SP,
  contentRight: CONTENT_RIGHT_PAD_SP,
  clefTail: CLEF_TAIL_SP,
  tabClefTail: TAB_CLEF_TAIL_SP,
  timeTail: TIME_SIG_TAIL_SP
};
const SLOT_TAILS = new Set<PadKind>(['clefTail', 'tabClefTail', 'timeTail']);

/** An explicit host `clearance`/`densityPad` keeps its historical pad, slot
 *  and margin policy and its column geometry; only the springs follow the
 *  Space line. */
function legacySpacePolicy(densityH: number, clearance?: number, densityPad?: number | null): SpacePolicy {
  const frame = clearanceSpacing(clearance, densityPad);
  return {
    spring: spaceLineAt(SPACE_LINES.spring, clampSpace(densityH)),
    columnAir: 1,
    paperPad: 1,
    horizontalMargin: frame.horizontalMargin,
    systemStartPad: frame.prefixPad(CONTENT_LEFT_PAD_SP) + frame.prefixPad(LEGACY_START_BARLINE_PAD_SP),
    pad: kind => SLOT_TAILS.has(kind) ? PAD_NORMAL_SP[kind] : frame.prefixPad(PAD_NORMAL_SP[kind]),
    prefixGroupExtra: frame.prefixGroupExtra
  };
}

interface PrefixAir { pads: PadKind[]; groups: number }
function prefixAir(air: PrefixAir, policy: SpacePolicy): number {
  return air.pads.reduce((sum, kind) => sum + policy.pad(kind), 0)
    + air.groups * policy.prefixGroupExtra;
}

/** A bad value degrades to the default rather than throwing. Exported because
 *  the clamp used to be silent: a control has to know where the wall is to say
 *  it is against it. */
export function clampSpace(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return SPACE_DEFAULT_SP;
  return Math.min(MAX_SPACE_SP, Math.max(MIN_SPACE_SP, value));
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

/**
 * The design's spacing step, as a MINIMUM rather than the step: with a ladder
 * supplied the walk lands on the first rung at least this far away, so a step
 * never does nothing and never does less than the design asked.
 *
 * Mirrors `SPACE_STEP` in `src/elements/ZoomPad.ts`, which still carries its
 * own copy of this walk. The pad is a tuned, untested control and moving it was
 * not worth the blast radius of a first cut, so the duplication is deliberate
 * and temporary — adopting these functions there is the follow-up recorded in
 * roadmap/inprogress/core-touch-gestures.md.
 */
export const SPACE_STEP_SP = 0.5;

/** Float slack when comparing against ladder rungs (they are 0.01sp grid values). */
const RUNG_EPS = 1e-6;

/**
 * The next spacing value in `dir` — the next value that DRAWS something
 * different — or null when this direction has nothing left to reach.
 *
 * A rung is the low edge of its run, so any value between two rungs engraves
 * what the lower one engraves; stepping to it would be exactly the invisible
 * step this walk exists to skip. Going DOWN, the rung itself is the wrong place
 * to land: a run can be very wide, and its low edge is the far side of it, so
 * landing on the rung turns one step of "a bit tighter" into a collapse. The
 * walk lands on the near side instead. Going up, the rung IS the near side.
 *
 * With no ladder (`null`) it steps a flat `SPACE_STEP_SP` — the caller stays usable
 * when there is nobody to ask.
 */
export function nextDensity(from: number, dir: 1 | -1, ladder: number[] | null): number | null {
  if (!ladder || ladder.length === 0) {
    const next = clampSpace(Math.round((from + dir * SPACE_STEP_SP) * 100) / 100);
    return next === from ? null : next;
  }
  let cur = -1;
  while (cur + 1 < ladder.length && ladder[cur + 1] <= from + RUNG_EPS) cur++;
  if (dir > 0) {
    const ahead = ladder.slice(cur + 1);
    if (ahead.length === 0) return null;
    return ahead.find(v => v - from >= SPACE_STEP_SP - RUNG_EPS) ?? ahead[0];
  }
  const below = ladder.slice(0, Math.max(0, cur));
  if (below.length === 0) return null;
  const rung =
    [...below].reverse().find(v => from - v >= SPACE_STEP_SP - RUNG_EPS) ?? below[below.length - 1];
  const index = ladder.indexOf(rung);
  // The top of that run: one grid step under the next rung up. There is always
  // a next one — `rung` came from strictly below the current run.
  const top = Math.round((ladder[index + 1] - SPACE_GRID_SP) * 100) / 100;
  return Math.max(rung, Math.min(top, Math.round((from - SPACE_STEP_SP) * 100) / 100));
}

/** `steps` rungs from `from`, stopping where the walk runs out. Absolute from a
 *  starting value, so a drag out and back returns to where it started. */
export function walkDensity(
  from: number,
  steps: number,
  dir: 1 | -1,
  ladder: number[] | null
): { value: number; exhausted: boolean } {
  let value = from;
  for (let i = 0; i < steps; i++) {
    const next = nextDensity(value, dir, ladder);
    if (next === null) return { value, exhausted: true };
    value = next;
  }
  return { value, exhausted: false };
}

// ---------- System packing (shared with the density ladder) ----------

/**
 * One packable measure, captured at the spring BASE (the default Space): every
 * number the system packer reads, and nothing else.
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
  /** The part of `rigid` that is column AIR at the default (× ink ratio):
   *  re-priced by `SpacePolicy.columnAir` when a ladder or gesture asks what
   *  another Space would draw. Governing voice only — the same approximation
   *  the springs already make. */
  columnAir?: number;
  /** Σ base springs — the packer applies the Space line's factor. */
  spring: number;
  /** Barline→first-event base spring. */
  lead: number;
  repeatExtra: number;
  forcedBreak: boolean;
}

export interface PackingInput {
  spacingMode?: 'natural' | 'fill';
  measures: MeasurePack[];
  lineWidthSp: number;
  /** Available width after the first system (part-name gutter can change). */
  subsequentLineWidthSp?: number;
  /** Trailing pad after a measure's content. Carried rather than read from the
   *  module constant because Clearance resolves it, and the packer must use
   *  the same width the placement pass will. Absent ⇒ the default. */
  contentRightPadSp?: number;
  /** Re-price discretionary horizontal air when a ladder/gesture changes Space.
   * `spaceSp` is the Space this snapshot was priced at; prefix descriptors
   * align with measures; all data survives worker cloning. */
  space?: { spaceSp: number; prefixes: { first: PrefixAir; rest: PrefixAir }[] };
}

/** Reuse measured ink and springs while resolving the new horizontal padding. */
function packingAtSpace(packing: PackingInput, densityH: number): PackingInput {
  if (!packing.space || packing.space.spaceSp === densityH) return packing;
  const old = spacePolicy(packing.space.spaceSp);
  const next = spacePolicy(densityH);
  const marginDelta = 2 * (old.horizontalMargin - next.horizontalMargin);
  const airDelta = next.columnAir - old.columnAir;
  return {
    ...packing,
    space: { ...packing.space, spaceSp: densityH },
    lineWidthSp: packing.lineWidthSp + marginDelta,
    ...(packing.subsequentLineWidthSp === undefined ? {} : {
      subsequentLineWidthSp: packing.subsequentLineWidthSp + marginDelta
    }),
    contentRightPadSp: next.pad('contentRight'),
    measures: packing.measures.map((m, i) => {
      const air = packing.space!.prefixes[i];
      return { ...m,
        rigid: m.rigid + (m.columnAir ?? 0) * airDelta,
        prefixFirst: m.prefixFirst + prefixAir(air.first, next) - prefixAir(air.first, old),
        prefixRest: m.prefixRest + prefixAir(air.rest, next) - prefixAir(air.rest, old)
      };
    })
  };
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
  packing = packingAtSpace(packing, densityH);
  const springFactor = spacePolicy(densityH).spring;
  const packs = packing.measures;
  const widthAt = (row: number) => row === 0 ? packing.lineWidthSp : packing.subsequentLineWidthSp ?? packing.lineWidthSp;
  const contentRightPad = packing.contentRightPadSp ?? CONTENT_RIGHT_PAD_SP;

  const rows: { measures: number[]; full: boolean }[] = [];
  let current: number[] = [];
  let currentWidth = 0;
  packs.forEach((m, k) => {
    const content =
      m.lead * springFactor + m.rigid + m.spring * springFactor + contentRightPad + m.repeatExtra;
    const natural = (current.length === 0 ? m.prefixFirst : m.prefixRest) + content;
    // Which of the two reasons ended the row is recorded, not just that one
    // did: only the overflow reason means the row is FULL.
    const overflows = currentWidth + natural > widthAt(rows.length);
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

  const wanted = rows.map(({ measures, full }, row) => {
    let rowRigid = 0;
    let rowSpring = 0;
    measures.forEach((k, j) => {
      const m = packs[k];
      rowRigid +=
        (j === 0 ? m.prefixFirst : m.prefixRest) + m.rigid + contentRightPad + m.repeatExtra;
      rowSpring += m.spring * springFactor + m.lead * springFactor;
    });
    return { measures, full, stretch: rowStretch(widthAt(row) - rowRigid, rowSpring) };
  });
  const capped = justifyRows(wanted, packing.spacingMode);
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
 * Shared by every packing call, including the spacing-control ladder.
 */
function justifyRows(rows: readonly { full: boolean; stretch: number }[], mode?: 'natural' | 'fill'): number[] {
  // Natural rows retain their springs; only overfull rows need compression.
  if (mode === 'natural') return rows.map(row => Math.min(1, row.stretch));
  const ceiling = bodyStretch(rows) ?? MAX_STRETCH;
  return capLastRowStretch(
    rows.map(r => (r.full ? r.stretch : Math.max(MIN_SQUEEZE, Math.min(r.stretch, ceiling))))
  );
}

// ---------- The density ladder ----------

/**
 * Grid the ladder is scanned on: 0.01sp of Space. Finer than any step a
 * control offers, so no distinct engraving can hide between two grid points.
 */
const LADDER_GRID = 100;

/** The same grid as a Space INCREMENT — exported because a control walking
 *  the ladder needs it to name a run's top edge: run i is
 *  `[ladder[i], ladder[i + 1] - SPACE_GRID_SP]`. */
export const SPACE_GRID_SP = 1 / LADDER_GRID;

/**
 * What a density value actually DRAWS, compressed to a string.
 *
 * Two Space values engrave identically iff they pack the same bars onto the
 * same lines AND agree on `springFactor × stretch` — because every horizontal
 * coordinate downstream is `spring × springFactor × stretch`. That product is
 * the whole subtlety, and it is why most values are invisible: inside the
 * justifier's linear range, `stretch` is inversely proportional to the spring
 * factor, so the product — and therefore the engraving — is *exactly* unchanged.
 * With legacy fixed whitespace, density only bites where packing changes or
 * stretch reaches a clamp. The default Space policy also changes margins and
 * prefix/bar padding; include those resolved widths in the signature.
 *
 * Rounded to 1e-6, i.e. sub-1e-4-staff-space differences count as identical.
 */
export function packingSignature(
  packings: readonly PackingInput[],
  densityH: number
): string {
  return packings
    .map(p => {
      const resolved = packingAtSpace(p, densityH);
      const air = p.space ? `${resolved.lineWidthSp.toFixed(6)}:${resolved.contentRightPadSp?.toFixed(6)}:` +
        resolved.measures.map(m => `${m.prefixFirst.toFixed(6)},${m.prefixRest.toFixed(6)},${m.rigid.toFixed(6)}`).join('/') : '';
      const springFactor = spacePolicy(densityH).spring;
      return air + packSystems(resolved, densityH)
        .map(row => `${row.measures.join(',')}@${(springFactor * row.stretch).toFixed(6)}`)
        .join('|');
    })
    .join(';');
}

/**
 * Every Space value in `[MIN_SPACE_SP, MAX_SPACE_SP]` that engraves this score
 * differently from the one below it — ascending, always starting at
 * `MIN_SPACE_SP`.
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
  for (let n = MIN_SPACE_SP * LADDER_GRID; n <= MAX_SPACE_SP * LADDER_GRID; n++) {
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
 * core-selection-ladder.md), and `src/edit` may import { normalizeDisplayOptions, type DisplayOptions } from '../displayOptions.ts';
import only `src/model` — so
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
 * Decides whether one note shows an accidental when judged ALONE — against the
 * key signature, with nothing carried from earlier in the bar. Honors MNX's
 * explicit visibility model: `accidentalDisplay.show` always wins (`true`
 * prints the glyph for the note's alter — a natural when there is none), and a
 * document that declares `support.useAccidentalDisplay` has opted out of
 * renderer inference entirely, so unmarked notes show nothing. Layouts ask the
 * measure's `AccidentalResolver` instead; this is its fallback for a note the
 * resolver never walked.
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

/** Which accidental glyph (if any) a note of one measure prints. */
export type AccidentalResolver = (note: MnxNote) => string | null;

/** Each accidental glyph's vertical ink above and below its anchor, in staff
 *  spaces (Bravura's bounding boxes). */
const ACCIDENTAL_INK: Record<string, { above: number; below: number }> = {
  accidentalFlat: { above: 1.756, below: 0.7 },
  accidentalDoubleFlat: { above: 1.748, below: 0.7 },
  accidentalSharp: { above: 1.4, below: 1.392 },
  accidentalNatural: { above: 1.364, below: 1.34 },
  accidentalDoubleSharp: { above: 0.508, below: 0.5 }
};
const ACCIDENTAL_INK_FALLBACK = { above: 1.8, below: 1.4 };
/** Air two accidentals keep between them when they share a column. */
const ACCIDENTAL_STACK_GAP_SP = 0.15;
const DIATONIC_STEP: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Which column each of a chord's accidentals takes: 0 hugs the noteheads, each
 * further column one `ACCIDENTAL_SLOT_WIDTH_SP` out; -1 for a note that prints
 * none. Top to bottom, each takes the nearest column where its ink clears every
 * accidental already there — so accidentals a seventh apart share one, and a
 * six-flat chord needs two or three columns instead of six.
 *
 * Positions are diatonic steps, never staff y: the step distance between two
 * notes is the same in every clef, so the plan (which knows no clef) and the
 * notation staff (which does) reach the same answer.
 */
export function accidentalColumns(
  notes: readonly MnxNote[],
  accidentalOf: AccidentalResolver
): { column: number[]; count: number } {
  const column = notes.map(() => -1);
  const marked = notes
    .map((note, index) => ({ index, glyph: accidentalOf(note), step: note.pitch.octave * 7 + (DIATONIC_STEP[note.pitch.step] ?? 0) }))
    .filter((entry): entry is { index: number; glyph: string; step: number } => entry.glyph !== null)
    .sort((a, b) => b.step - a.step || a.index - b.index);
  const columns: { glyph: string; step: number }[][] = [];
  for (const entry of marked) {
    const ink = ACCIDENTAL_INK[entry.glyph] ?? ACCIDENTAL_INK_FALLBACK;
    let c = 0;
    for (; c < columns.length; c++) {
      const clear = columns[c].every(other => {
        const otherInk = ACCIDENTAL_INK[other.glyph] ?? ACCIDENTAL_INK_FALLBACK;
        const distance = Math.abs(other.step - entry.step) * 0.5;
        const [upper, lower] = other.step > entry.step ? [otherInk, ink] : [ink, otherInk];
        return distance >= upper.below + lower.above + ACCIDENTAL_STACK_GAP_SP;
      });
      if (clear) break;
    }
    (columns[c] ??= []).push(entry);
    column[entry.index] = c;
  }
  return { column, count: columns.length };
}

/** The rigid room a chord's accidentals take left of its noteheads. */
export function accidentalLeadingSp(notes: readonly MnxNote[], accidentalOf: AccidentalResolver, columns: ColumnGeometry = DEFAULT_COLUMNS): number {
  const { count } = accidentalColumns(notes, accidentalOf);
  return count ? count * ACCIDENTAL_SLOT_WIDTH_SP + columns.accidentalRightPad : 0;
}

/** A tab staff draws no accidentals, so a tab-only plan reserves none: the
 *  resolver both the plan and `tab.ts` price columns with. */
export const NO_ACCIDENTALS: AccidentalResolver = () => null;

/**
 * The accidentals one measure prints, decided ONCE for every layout that reads
 * them: spacing prices the columns, notation draws the glyphs and the tab walk
 * steps over the same widths, so all three must get the same answer.
 *
 * `accidentalDisplay` and `support.useAccidentalDisplay` behave as in
 * `noteAccidentalGlyph`. Otherwise the common-practice rule:
 *   - an accidental holds to the barline at its staff position (step + octave,
 *     on that staff of that part, across voices), so a note prints one iff its alter differs
 *     from what is in force there — the last alter written, else the key's;
 *   - a tie continuation never restates its accidental and puts nothing in
 *     force: across a barline it carries the tied alteration, and a later
 *     untied note at that position must state it again.
 * Notes are judged in onset order, a grace group just ahead of its onset.
 * Ottavas and mid-bar clef changes are not modeled: the position is the
 * sounding step + octave.
 */
export function measureAccidentals(
  partMeasures: readonly (MnxPartMeasure | undefined)[],
  keyFifths: number,
  useAccidentalDisplay: boolean,
  tieTargets: ReadonlySet<string>
): AccidentalResolver {
  const entries: { note: MnxNote; staff: string; onset: number; grace: boolean; order: number }[] = [];
  const add = (notes: MnxNote[] | undefined, staff: string, onset: number, grace: boolean) => {
    for (const note of notes ?? []) entries.push({ note, staff, onset, grace, order: entries.length });
  };
  partMeasures.forEach((pm, part) => {
    for (const seq of pm?.sequences ?? []) {
      const staff = `${part}:${seq.staff ?? 1}`; // parts never share a staff
      let onset = 0;
      for (const item of seq.content ?? []) {
        if (isGrace(item)) {
          for (const e of item.content) if (isTimedEvent(e)) add(e.notes, staff, onset, true);
        } else if (isTremolo(item)) {
          for (const e of item.content) if (isTimedEvent(e)) add(e.notes, staff, onset, false);
          onset += tremoloDuration(item);
        } else if (isTuplet(item)) {
          const innerSum = item.content.reduce(
            (sum, e) => sum + (isTimedEvent(e) ? durationValue(e.duration) : 0),
            0
          );
          const scale = innerSum > 0 ? tupletDuration(item) / innerSum : 1;
          let at = onset;
          for (const e of item.content) {
            if (!isTimedEvent(e)) continue;
            add(e.notes, staff, at, false);
            at += durationValue(e.duration) * scale;
          }
          onset += tupletDuration(item);
        } else if (isTimedEvent(item)) {
          add(item.notes, staff, onset, false);
          onset += durationValue(item.duration);
        } else {
          onset += 0.25; // the layouts' placeholder quarter
        }
      }
    }
  });
  entries.sort((a, b) =>
    Math.abs(a.onset - b.onset) > ONSET_EPS
      ? a.onset - b.onset
      : Number(b.grace) - Number(a.grace) || a.order - b.order
  );

  const inForce = new Map<string, number>();
  const glyphs = new Map<MnxNote, string | null>();
  for (const { note, staff } of entries) {
    const alter = note.pitch.alter ?? 0;
    const position = `${staff}:${note.pitch.step.toUpperCase()}${note.pitch.octave}`;
    const tiedInto = note.id !== undefined && tieTargets.has(note.id);
    const show = note.accidentalDisplay?.show;
    let glyph: string | null;
    if (show === true) glyph = alterGlyph(alter);
    else if (show === false || useAccidentalDisplay || tiedInto) glyph = null;
    else {
      const expected = inForce.get(position) ?? keyAlterForStep(note.pitch.step, keyFifths);
      glyph = alter === expected ? null : alterGlyph(alter);
    }
    glyphs.set(note, glyph);
    if (!tiedInto) inForce.set(position, alter);
  }
  return note =>
    glyphs.has(note) ? glyphs.get(note) ?? null : noteAccidentalGlyph(note, useAccidentalDisplay, keyFifths);
}

/** Every tie that lands on a note: its target id, and the id of the note it
 *  leaves when that note has one. */
function forEachTieTarget(
  mnx: MnxStructure,
  visit: (target: string, origin: string | undefined) => void
): void {
  const walk = (items: readonly MnxSequenceItem[] | undefined, depth: number) => {
    if (depth > 32) return;
    for (const item of items ?? []) {
      const inner = containerContent(item);
      if (inner) {
        walk(inner, depth + 1);
        continue;
      }
      if (!isTimedEvent(item)) continue;
      for (const note of item.notes ?? []) {
        for (const tie of note.ties ?? []) if (tie.target) visit(tie.target, note.id);
      }
    }
  };
  for (const part of mnx.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) walk(seq.content, 0);
    }
  }
}

/** Ids of every note a tie lands on — continuations, which never restate an accidental. */
export function tieTargetIds(mnx: MnxStructure): Set<string> {
  const targets = new Set<string>();
  forEachTieTarget(mnx, target => targets.add(target));
  return targets;
}

/** Each tie continuation's origin: target id → the id of the note it continues.
 *  A tab staff leaves a continuation's digit out (`tabStaff.ts`). */
export function tieOrigins(mnx: MnxStructure): Map<string, string> {
  const origins = new Map<string, string>();
  forEachTieTarget(mnx, (target, origin) => {
    if (origin !== undefined) origins.set(target, origin);
  });
  return origins;
}

// ---------- Tuplet columns (shared with the notation renderer) ----------

export interface TupletColumn {
  /** Accidental room before the notehead. */
  leading: number;
  /** Full column width: leading + core (+ dots) + scaled duration space. */
  advance: number;
  /** The column AIR inside `advance` at the default geometry (for re-pricing). */
  air: number;
}

/**
 * Column geometry of a tuplet's inner events — all rigid (the duration space
 * is pre-scaled by outer/inner, so a quarter inside a triplet still gets more
 * room than its eighths). The renderer places inner notes with the same
 * columns; keep the two in lockstep by computing them only here.
 */
export function tupletColumns(t: MnxTuplet, accidentalOf: AccidentalResolver, columns: ColumnGeometry = DEFAULT_COLUMNS): TupletColumn[] {
  const innerSum = t.content.reduce(
    (sum, e) => sum + (isTimedEvent(e) ? durationValue(e.duration) : 0),
    0
  );
  const scale = innerSum > 0 ? tupletDuration(t) / innerSum : 1;
  return t.content.map(e => {
    if (!isTimedEvent(e)) return { leading: 0, advance: columns.core, air: CORE_AIR_SP };
    const leading = accidentalLeadingSp(e.notes ?? [], accidentalOf, columns);
    const dots = e.duration.dots ?? 0;
    return {
      leading,
      advance:
        leading +
        columns.core +
        dots * columns.dot +
        springSp(durationValue(e.duration) * scale),
      air: (leading ? ACCIDENTAL_RIGHT_PAD_SP : 0) + CORE_AIR_SP + dots * DOT_AIR_SP
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
  /** MNX `clef.glyph`: an explicit SMuFL glyph — drawn as given. */
  glyph?: string;
  /** MNX `clef.showOctave`: false hides the octave figure. */
  showOctave?: boolean;
  color?: string;
  /** Octaves the PART is written above sounding (`model/transposition.ts`;
   *  guitar 1). Moves noteheads as `octave` does, but belongs to the part,
   *  not the clef, so it draws no octave figure. */
  writtenOctaves?: number;
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
  /** Present only in performed order; array position is geometry, this is written identity. */
  entry?: PerformedEntry;
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
  /** The column geometry this plan priced at (`columnGeometry` of the Space
   *  policy's column-air factor). Every reader that walks a column — tuplet
   *  inner notes, grace runs, accidental offsets — takes it from here. */
  columns: ColumnGeometry;
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
function lyricCoreSp(event: { lyrics?: { lines?: Record<string, { text: string }> } }, selected: readonly string[] | undefined, columns: ColumnGeometry): number {
  const lines = event.lyrics?.lines;
  if (!lines) return 0;
  let w = 0;
  for (const [id, line] of Object.entries(lines)) {
    if (selected && !selected.includes(id)) continue;
    w = Math.max(w, line.text.length * LYRIC_CHAR_WIDTH_SP + 2 * columns.lyricSidePad);
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
  entries?: PerformedEntry[];
  display?: DisplayOptions;
  lyricLineIds?: readonly string[];
  /** Parts to lay out, stacked top-to-bottom (default: the first part). */
  parts?: MnxPart[];
  /** Explicit staff specs (from a layout) — overrides `parts` expansion. */
  staves?: PlanStaff[];
  /** Extra left room (staff labels / group brackets), inside the margin. */
  leftInsetSp?: number;
  subsequentLeftInsetSp?: number;
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
  spacingMode?: 'natural' | 'fill';
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
  /** The column AIR inside leading + core at the default geometry — what a
   *  ladder re-price at another Space moves. `airPre` is the part left of the
   *  column centre (in `leading` and the first half of the core), so the
   *  cross-voice merge can carry air along its longest path. */
  air: number;
  airPre: number;
  spring: number;  // stretchable: duration space
  /** Metric position within the bar (whole-note fraction) — the shared
   *  column identity for the cross-voice merge. Absent on grace containers,
   *  which are un-timed and keep private columns glued to their successor. */
  onset?: number;
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
  /** The column air inside that voice's `rigid`, at the default geometry. */
  columnAir: number;
  /** Spring between the barline (or prefix glyphs) and the first event. */
  leadingSpring: number;
  clefTimelines: ClefAt[][];
  hasRepeatStart: boolean;
  repeatEnd: { times?: number } | null;
  /** The measure's declared end-barline type, for the `:||:` question below. */
  barlineType: string | undefined;
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

// ---------- Onset-aligned columns across voices ----------
//
// Voices used to be spaced INDEPENDENTLY — each its own cursor walk, its own
// justification stretch. Same-onset events across voices (and staves, and
// parts) lined up only when the voices' rigid-and-spring demands happened to
// be proportional; an accidental in one voice skewed the others by ~1sp, and
// a wide lyric syllable inverted x-order against onset-order outright — a
// note drawn AFTER one it sounds before.
//
// The merge is the classic engraving model: every distinct onset in the bar
// is ONE shared column. Anchors at the same onset share an x by
// construction; consecutive columns must clear each other's widest rigid
// halves (so a sharp or a wide syllable in ANY voice makes room in all of
// them); and each voice's own [post + spring + pre] demands run as chain
// constraints between its consecutive entries. Anchor positions are the
// longest path over those constraints, and the bar's justification stretch
// is solved so the merged width lands exactly on the width the packer gave.
//
// Single-voice measures keep the legacy walk verbatim, and a multi-voice
// measure whose merged positions coincide with the legacy ones (within
// 1e-6) emits the LEGACY floats — alignment that was already right stays
// byte-identical in the goldens rather than churning by arithmetic order.

interface MergedVoice {
  staff: number;
  voice: number;
  entries: EventMetrics[];
}

interface MergedEdge {
  /** Column air along this edge at the default geometry (see `EventMetrics.air`). */
  air: number;
  from: number; // -1 = the bar's content start
  to: number;
  rigid: number;
  spring: number;
}

interface MergedModel {
  /** Anchor x per (flattened voice, entry), relative to content start, plus
   *  the merged content width, at one justification stretch. */
  solve(stretch: number): { anchors: number[][]; width: number; air: number };
  /** The same anchors with the stretch SOLVED so the merged width lands on
   *  `width` exactly — parametric (no bisection), so positions respond to
   *  width with the same smooth linear arithmetic the legacy walk has, and
   *  the engraving stays a pure function of the packing signature. */
  solveFor(width: number): { anchors: number[][]; width: number };
  voices: MergedVoice[];
}

function halfCoreSp(e: EventMetrics, ink: number, columns: ColumnGeometry): number {
  return ((e.graceCount ? columns.grace : columns.core) * ink) / 2;
}

/** Null when fewer than two voices carry entries — the legacy walk owns the
 *  single-voice case, floats and all. */
function mergedModelOf(staves: EventMetrics[][][], ink: number, columns: ColumnGeometry): MergedModel | null {
  const voices: MergedVoice[] = [];
  staves.forEach((staff, staffIndex) =>
    staff.forEach((entries, voiceIndex) => {
      if (entries.length > 0) voices.push({ staff: staffIndex, voice: voiceIndex, entries });
    })
  );
  if (voices.length < 2) return null;

  // Shared columns: the distinct onsets, EPS-grouped.
  const allOnsets = voices
    .flatMap(v => v.entries.map(e => e.onset))
    .filter((t): t is number => t !== undefined)
    .sort((a, b) => a - b);
  const nodeOnsets: number[] = [];
  for (const t of allOnsets) {
    if (nodeOnsets.length === 0 || t - nodeOnsets[nodeOnsets.length - 1] > ONSET_EPS) nodeOnsets.push(t);
  }
  const sharedNodeOf = (t: number): number => {
    let lo = 0;
    let hi = nodeOnsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (nodeOnsets[mid] < t - ONSET_EPS) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // Nodes: shared columns, then one private node per grace container (glued
  // to its successor by its own chain edges only), then the content end.
  let nodeCount = nodeOnsets.length;
  const entryNode: number[][] = voices.map(v =>
    v.entries.map(e => (e.onset !== undefined ? sharedNodeOf(e.onset) : nodeCount++))
  );
  const endNode = nodeCount++;

  // The widest rigid halves at each shared column, across every voice.
  const maxPre = new Array<number>(nodeOnsets.length).fill(0);
  const maxPost = new Array<number>(nodeOnsets.length).fill(0);
  // The air inside the winning half, so a re-price at another Space can move
  // the merged width by what its longest path actually carries.
  const maxPreAir = new Array<number>(nodeOnsets.length).fill(0);
  const maxPostAir = new Array<number>(nodeOnsets.length).fill(0);
  voices.forEach((v, vi) =>
    v.entries.forEach((e, k) => {
      if (e.onset === undefined) return;
      const node = entryNode[vi][k];
      const pre = e.leading + halfCoreSp(e, ink, columns);
      const post = e.core - halfCoreSp(e, ink, columns);
      if (pre > maxPre[node]) { maxPre[node] = pre; maxPreAir[node] = e.airPre; }
      if (post > maxPost[node]) { maxPost[node] = post; maxPostAir[node] = e.air - e.airPre; }
    })
  );

  const edges: MergedEdge[] = [];
  // Chain constraints: each voice's own column arithmetic, between its
  // consecutive entries — exactly the legacy cursor walk, as inequalities.
  voices.forEach((v, vi) => {
    let prev: { node: number; e: EventMetrics } | null = null;
    v.entries.forEach((e, k) => {
      const node = entryNode[vi][k];
      const pre = e.leading + halfCoreSp(e, ink, columns);
      if (prev === null) {
        edges.push({ from: -1, to: node, rigid: pre, air: e.airPre, spring: 0 });
      } else {
        edges.push({
          from: prev.node,
          to: node,
          rigid: prev.e.core - halfCoreSp(prev.e, ink, columns) + pre,
          air: prev.e.air - prev.e.airPre + e.airPre,
          spring: prev.e.spring
        });
      }
      prev = { node, e };
    });
    if (prev !== null) {
      const last = prev as { node: number; e: EventMetrics };
      edges.push({
        from: last.node,
        to: endNode,
        rigid: last.e.core - halfCoreSp(last.e, ink, columns),
        air: last.e.air - last.e.airPre,
        spring: last.e.spring * MEASURE_TRAIL_FACTOR
      });
    }
  });
  // Ordering constraints: a later column clears the widest rigid halves
  // between it and the one before — the cross-voice guarantee that x stays
  // monotone in onset whatever any single voice demands.
  for (let j = 1; j < nodeOnsets.length; j++) {
    edges.push({ from: j - 1, to: j, rigid: maxPost[j - 1] + maxPre[j], air: maxPostAir[j - 1] + maxPreAir[j], spring: 0 });
  }
  if (nodeOnsets.length > 0) {
    const last = nodeOnsets.length - 1;
    edges.push({ from: last, to: endNode, rigid: maxPost[last], air: maxPostAir[last], spring: 0 });
  }

  // Longest path by relaxation over (rigid, spring) PAIRS compared at one
  // stretch: the graph is a DAG (edges follow onset and entry order) and
  // tiny, so passes-until-stable is simplest and safe. Carrying the pair
  // instead of a scalar is what lets `solveFor` solve the stretch exactly.
  const relax = (stretch: number) => {
    const rigidAt = new Array<number>(nodeCount).fill(0);
    const springAt = new Array<number>(nodeCount).fill(0);
    const airAt = new Array<number>(nodeCount).fill(0);
    for (let pass = 0; pass < nodeCount + 1; pass++) {
      let moved = false;
      for (const edge of edges) {
        const fromRigid = edge.from === -1 ? 0 : rigidAt[edge.from];
        const fromSpring = edge.from === -1 ? 0 : springAt[edge.from];
        const fromAir = edge.from === -1 ? 0 : airAt[edge.from];
        const rigid = fromRigid + edge.rigid;
        const spring = fromSpring + edge.spring;
        if (rigid + spring * stretch > rigidAt[edge.to] + springAt[edge.to] * stretch + 1e-12) {
          rigidAt[edge.to] = rigid;
          springAt[edge.to] = spring;
          airAt[edge.to] = fromAir + edge.air;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return { rigidAt, springAt, airAt };
  };
  const anchorsFrom = (rigidAt: number[], springAt: number[], stretch: number, airAt: number[] = []) => ({
    anchors: voices.map((v, vi) =>
      v.entries.map((_, k) => rigidAt[entryNode[vi][k]] + springAt[entryNode[vi][k]] * stretch)
    ),
    width: rigidAt[endNode] + springAt[endNode] * stretch,
    air: airAt[endNode] ?? 0
  });

  const solve = (stretch: number) => {
    const { rigidAt, springAt, airAt } = relax(stretch);
    return anchorsFrom(rigidAt, springAt, stretch, airAt);
  };

  const solveFor = (width: number) => {
    // Parametric critical path: at the current stretch the end node carries
    // the binding (rigid, spring) pair; solving that pair for `width` and
    // re-relaxing converges in a few steps (the path set is finite and
    // monotone in stretch). Positions come out LINEAR in width per regime —
    // no bisection quantization to cross a rounding boundary.
    let stretch = 0;
    let state = relax(stretch);
    for (let iter = 0; iter < 12; iter++) {
      const rigid = state.rigidAt[endNode];
      const spring = state.springAt[endNode];
      const next = spring > 1e-12 ? Math.max(0, (width - rigid) / spring) : stretch;
      const settled = Math.abs(next - stretch) < 1e-12;
      stretch = next;
      state = relax(stretch);
      if (settled) break;
    }
    return anchorsFrom(state.rigidAt, state.springAt, stretch);
  };

  return { solve, solveFor, voices };
}

/** The merged natural (rigid, spring-at-1) pair — what packing must reserve
 *  when the cross-voice constraints bind beyond the widest single voice. */
function mergedNaturalWidth(
  staves: EventMetrics[][][],
  ink: number,
  columns: ColumnGeometry
): { rigid: number; spring: number; air: number } | null {
  const model = mergedModelOf(staves, ink, columns);
  if (!model) return null;
  const natural = model.solve(0);
  const atOne = model.solve(1).width;
  return { rigid: natural.width, spring: Math.max(0, atOne - natural.width), air: natural.air };
}

export function planHorizontal(
  mnx: MnxStructure,
  widthSp: number,
  options?: PlanOptions
): HorizontalPlan {
  const display = normalizeDisplayOptions(options?.display);
  const lyricLineIds = options?.lyricLineIds ?? selectedLyricLineIds(mnx, display);
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
      packing: { measures: [], lineWidthSp: widthSp }, columns: DEFAULT_COLUMNS, inkRatio: 1
    };
  }

  const useAccidentalDisplay = mnx.mnx?.support?.useAccidentalDisplay === true;
  const tieTargets = tieTargetIds(mnx);
  const leftInset = options?.leftInsetSp ?? 0;
  const subsequentLeftInset = options?.subsequentLeftInsetSp ?? leftInset;
  const densityH = clampSpace(options?.densityH);
  // Explicit legacy clearance and densityPad retain their independent policy.
  const followsSpace = display.clearance === undefined && options?.densityPad == null;
  const clearance = followsSpace ? spacePolicy(densityH)
    : legacySpacePolicy(densityH, options?.display?.clearance, options?.densityPad);
  const marginSp = clearance.horizontalMargin;
  // The prefix's PADS follow Space (or an explicit legacy frame override);
  // glyph SLOTS are rigid and do not (core-zoom-density-pad.md ruling 1 — a clef
  // occupies the width it occupies at a given staff size). This is the line
  // between the two, and it is the whole reason the gap before the first note
  // used to ignore the spacing control entirely: every part of it was on the
  // rigid side, including the parts that were only ever air.
  const pad = clearance.pad;
  const columns = columnGeometry(clearance.columnAir);
  const isTabOnly = options?.staffKind === 'tab';
  const arpeggioStarts = new Set(
    [...collectSpanMarks(mnx.parts ?? [])].filter(([, marks]) => marks.arpeggio).map(([id]) => id)
  );
  // Glyph ink scales with the ink ratio; the slot's spare tail is air and
  // follows Space (or the legacy frame's group extra).
  const clefSlot = (ink: number) => (isTabOnly ? TAB_CLEF_INK_SP : CLEF_INK_SP) * ink
    + pad(isTabOnly ? 'tabClefTail' : 'clefTail') + clearance.prefixGroupExtra;
  const timeSlot = (ink: number) => TIME_SIG_INK_SP * ink + pad('timeTail') + clearance.prefixGroupExtra;
  const contentLeftPad = pad('contentLeft');
  const keySigRightPad = pad('keySigRight');
  const contentRightPad = pad('contentRight');
  const startX = marginSp + leftInset;
  const lineWidth = widthSp - 2 * marginSp - leftInset;
  const forcedBreaks = options?.entries ? new Set<number>() : options?.forcedBreaks ?? new Set<number>();

  // Multimeasure-rest collapses: the start measure becomes an H-bar stand-in,
  // the tail measures hidden stubs.
  const multiRestAt = new Map<number, number>();
  const hiddenIdx = new Set<number>();
  for (const c of (options?.entries ? [] : options?.collapse) ?? []) {
    if (c.count < 2) continue;
    multiRestAt.set(c.startIndex, c.count);
    for (let k = c.startIndex + 1; k < c.startIndex + c.count; k++) hiddenIdx.add(k);
  }
  const range = options?.entries ? undefined : options?.measureRange;
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
    const written = writtenOctaves(src.part);
    // A part that states its octave transposition carries the octave there,
    // never also in the clef. Only a part that is silent falls back to its
    // NAME: one called guitar is drawn 8vb.
    if (!written && (src.part.name ?? '').toLowerCase().includes('guitar')) {
      return { sign: 'G' as const, octave: -1 };
    }
    const part = written ? { writtenOctaves: written } : {};
    // An undeclared clef on a lower staff of a multi-staff part defaults to
    // bass — the keyboard/harp grand-staff convention. Declared clefs (the
    // usual case) replace this at measure 0.
    if (src.staff >= 2) return { sign: 'F' as const, octave: 0, ...part };
    return { sign: 'G' as const, octave: 0, ...part };
  });
  let timeSig: { count: number; unit: number; display?: 'common' | 'cut' } = { count: 4, unit: 4 };
  let timeDeclared = false;
  let keyFifths = 0;
  const writtenMetrics: MeasureMetrics[] = Array.from({ length: numMeasures }, (_, i) => {
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
      const written = writtenOctaves(src.part);
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
              ...(c.clef.staffPosition !== undefined ? { staffPosition: c.clef.staffPosition } : {}),
              ...(c.clef.glyph ? { glyph: c.clef.glyph } : {}),
              ...(c.clef.showOctave !== undefined ? { showOctave: c.clef.showOctave } : {}),
              ...(c.clef.color ? { color: c.clef.color } : {}),
              ...(written ? { writtenOctaves: written } : {})
            }
          };
        })
        .sort((a, b) => a.t - b.t);

      const startClef = measureClefs.find(c => c.t <= ONSET_EPS);
      // Any visible difference is a change: the sign, the octave, the line —
      // and the glyph, the octave figure and the colour, which the census
      // found were never compared, so a bar restating the sign with a new
      // glyph kept the old one.
      if (
        startClef &&
        (startClef.clef.sign !== current.sign ||
          startClef.clef.octave !== current.octave ||
          startClef.clef.staffPosition !== current.staffPosition ||
          startClef.clef.glyph !== current.glyph ||
          startClef.clef.showOctave !== current.showOctave ||
          startClef.clef.color !== current.color)
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

    // Spacing prices the accidental columns with this; notation and tab build the
    // same resolver for the same measure (measureAccidentals is deterministic).
    // The STANDALONE tab view draws no accidentals, so it prices none — the
    // same reasoning as its missing key-signature column. Priced anyway, a
    // chord spelled with six flats pushed its digits a quarter of the bar in.
    const accidentalOf = isTabOnly ? NO_ACCIDENTALS : measureAccidentals(
      uniquePartsOf(planStaves).map(part => part.measures?.[i]),
      keyFifths,
      useAccidentalDisplay,
      tieTargets
    );

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
      core: columns.core,
      air: CORE_AIR_SP,
      airPre: CORE_AIR_SP / 2,
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
          w: dynamicWidthSp(d) + 2 * columns.dynamicSidePad
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
      const midClefs = display.clefs === 'hide' ? [] : clefTimelines[s].slice(1);
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
            const columnOnset = onset;
            const withColumnExtras = (m: EventMetrics): EventMetrics => {
              let out = m;
              // A governing dynamic replaces the column's own air with its two
              // side pads — the re-pricing approximation follows the winner.
              if (dynamicWidth > out.core) out = { ...out, core: dynamicWidth, air: out.air - CORE_AIR_SP + 2 * DYNAMIC_SIDE_PAD_SP };
              if (midHere.length) {
                out = { ...out, leading: out.leading + midHere.length * MID_CLEF_WIDTH_SP, midClefs: midHere };
              }
              // Un-timed grace containers keep no onset — they are private
              // columns glued to their successor, not shared-column members.
              if (out.graceCount === undefined) out = { ...out, onset: columnOnset };
              return out;
            };
            try {
              if (isGrace(event)) {
                // Grace notes are un-timed: an all-rigid run of small columns
                // glued to the following event.
                return withColumnExtras({
                  leading: 0,
                  core: event.content.length * columns.grace + columns.graceRightPad,
                  air: event.content.length * GRACE_AIR_SP + GRACE_RIGHT_PAD_SP,
                  airPre: GRACE_AIR_SP / 2,
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
                  .filter(n => accidentalOf(n) !== null)
                  .length;
                return withColumnExtras({
                  leading: accidentals
                    ? accidentals * ACCIDENTAL_SLOT_WIDTH_SP + columns.accidentalRightPad
                    : 0,
                  core: columns.core + TREMOLO_NOTE_ADVANCE_SP,
                  air: (accidentals ? ACCIDENTAL_RIGHT_PAD_SP : 0) + CORE_AIR_SP,
                  airPre: (accidentals ? ACCIDENTAL_RIGHT_PAD_SP : 0) + CORE_AIR_SP / 2,
                  spring: springSp(dur)
                });
              }
              if (isTuplet(event)) {
                if (event.content.some(child => !isTimedEvent(child))) issues.push('nested tuplet content — child geometry not rendered');
                // Inner events get rigid columns with pre-scaled duration
                // space (tupletColumns); the real metric time is `outer`.
                onset += tupletDuration(event);
                const inner = tupletColumns(event, accidentalOf, columns);
                return withColumnExtras({
                  leading: 0,
                  core: inner.reduce((sum, c) => sum + c.advance, 0),
                  air: inner.reduce((sum, c) => sum + c.air, 0),
                  airPre: CORE_AIR_SP / 2,
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
              // A syllable is CENTRED on the note, but the anchor sits a
              // fixed half-core from the column start — so lyric width added
              // only to `core` lands entirely to the RIGHT of the note, and
              // the centred text spills back over the previous column
              // (found on "extraordinarily"). Split the requirement around
              // the anchor instead: half into leading, half into core — the
              // same total rigid width, redistributed, so bar widths and
              // wrapping cannot move; only the wide event's own anchor does.
              const lyricW = lyricCoreSp(event, lyricLineIds, columns);
              // A rolled chord's wave sits left of its ink; without room it
              // lands on the previous column.
              const arpeggio = (event.notes ?? []).some(n => n.id !== undefined && arpeggioStarts.has(n.id));
              const accidentalLeading = accidentalLeadingSp(event.notes ?? [], accidentalOf, columns);
              const dots = event.duration.dots ?? 0;
              const headCore = columns.core + dots * columns.dot;
              // The air the column carries: a governing syllable's two side
              // pads replace the head's own air (the re-pricing follows the
              // winner, the same approximation the governing voice makes).
              const lyricGoverns = lyricW > headCore;
              return withColumnExtras({
                leading: accidentalLeading + (arpeggio ? ARPEGGIO_ROOM_SP : 0) + Math.max(0, (lyricW - columns.core) / 2),
                core: Math.max(headCore, (columns.core + lyricW) / 2),
                air: (accidentalLeading ? ACCIDENTAL_RIGHT_PAD_SP : 0)
                  + (lyricGoverns ? 2 * LYRIC_SIDE_PAD_SP : CORE_AIR_SP + dots * DOT_AIR_SP),
                airPre: (accidentalLeading ? ACCIDENTAL_RIGHT_PAD_SP : 0)
                  + (lyricGoverns ? LYRIC_SIDE_PAD_SP : CORE_AIR_SP / 2),
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

    // The widest voice across ALL staves governs the measure's natural width
    // — raised by the merged cross-voice constraints when they bind (a
    // mixed path through shared onset columns can be longer than any single
    // voice's chain; without this the bar would overflow its packed width).
    const allVoices = staves.flat();
    let rigid = multiRest ? MULTIREST_WIDTH_SP : collapsed ? 0 : EMPTY_CONTENT_SP;
    let spring = 0;
    let columnAir = 0;
    for (const voice of allVoices) {
      const voiceRigid = voice.reduce((sum, e) => sum + e.leading + e.core, 0);
      const voiceSpring = voiceSpringSum(voice);
      if (voiceRigid + voiceSpring > rigid + spring) {
        rigid = voiceRigid;
        spring = voiceSpring;
        columnAir = voice.reduce((sum, e) => sum + e.air, 0);
      }
    }
    {
      const merged = mergedNaturalWidth(staves, 1, columns);
      if (merged && (merged.rigid > rigid + 1e-6 || merged.rigid + merged.spring > rigid + spring + 1e-6)) {
        if (merged.rigid > rigid) columnAir = merged.air;
        rigid = Math.max(rigid, merged.rigid);
        spring = Math.max(spring, merged.spring);
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
      staves, rigid, spring, columnAir, leadingSpring, clefTimelines,
      hasRepeatStart: !!globalMeasure.repeatStart,
      repeatEnd: globalMeasure.repeatEnd ?? null,
      barlineType: globalMeasure.barline?.type,
      hidden: collapsed,
      multiRest,
      issues
    };
  });

  // Resolve inheritance in written order first, then price each visit independently.
  // These are layout metrics, never copied or rewritten MNX measures/references.
  const metrics = options?.entries ? options.entries.map((entry, index) => {
    const source = writtenMetrics[entry.measureIndex];
    if (!source) throw new RangeError(`Unknown performed measure ${entry.measureIndex}`);
    const m = structuredClone(source);
    const previous = index ? writtenMetrics[options.entries![index - 1].measureIndex] : undefined;
    m.clefChanged = !!previous && m.clefTimelines.some((timeline, staff) =>
      JSON.stringify(timeline[0].clef) !== JSON.stringify(previous.clefTimelines[staff].at(-1)?.clef));
    m.timeSigShow = previous ? JSON.stringify(m.timeSig) !== JSON.stringify(previous.timeSig)
      : mnx.global.measures.slice(0, entry.measureIndex + 1).some(gm => !!gm.time);
    m.keyChanged = !!previous && m.keyFifths !== previous.keyFifths;
    m.cancelledKeyFifths = m.keyChanged ? previous!.keyFifths : 0;
    m.hasRepeatStart = false;
    m.repeatEnd = null;
    if (isPartialEntry(mnx, entry)) m.issues.push('partial performed entry — whole written bar shown; unperformed notes marked');
    if (options.collapse?.length) m.issues.push('unrolled view ignores written multi-measure-rest collapse');
    if (options.forcedBreaks?.size || options.measureRange) m.issues.push('unrolled view ignores written layout breaks');
    return m;
  }) : writtenMetrics;

  // How many key-signature glyphs this measure's prefix draws — none ever, on
  // a standalone tab staff.
  const keySigGlyphs = (m: MeasureMetrics, firstInSystem: boolean) => {
    if (isTabOnly || display.clefs === 'hide') return 0;
    const showKeySig = (firstInSystem && m.keyFifths !== 0) || m.keyChanged;
    if (!showKeySig) return 0;
    return Math.abs(m.keyFifths !== 0 ? m.keyFifths : m.cancelledKeyFifths);
  };

  // A FORWARD REPEAT IS A BARLINE. When its bar draws no prefix glyph, the
  // `|:` opens the bar and there is nothing for the content pad to hold it off
  // — an ordinary barline is what it replaces, not something it follows. Left
  // padded, the cluster peeled away from the barline as clearance grew (the
  // pad triples across the ladder), which read as a repeat belonging to
  // neither bar.
  const bareRepeat = (m: MeasureMetrics, firstInSystem: boolean) =>
    m.hasRepeatStart &&
    !(display.clefs !== 'hide' && (firstInSystem || m.clefChanged)) &&
    !(display.timeSignatures !== 'hide' && m.timeSigShow) &&
    keySigGlyphs(m, firstInSystem) === 0;

  /** Ink the PREVIOUS bar closes with that a `|:` cannot stand in for: another
   *  repeat (`:||:`) or a declared barline that means something (a double bar
   *  at a section end). Both clusters draw, so both need their own room. */
  const previousClosesWithInk = (index: number): boolean => {
    const previous = metrics[index - 1];
    if (!previous) return false;
    return (
      previous.repeatEnd !== null ||
      (previous.barlineType !== undefined && previous.barlineType !== 'regular')
    );
  };

  // Use the same padding decision in packing and final placement.
  const prefixLeftPad = (m: MeasureMetrics, firstInSystem: boolean, index: number) =>
    // A bar opening a system has the previous bar's barline a row away, so
    // only a mid-system neighbour can contest the space.
    bareRepeat(m, firstInSystem) && (firstInSystem || !previousClosesWithInk(index))
      ? 0
      : firstInSystem ? clearance.systemStartPad : contentLeftPad;

  // The prefix's PADS are air; its glyph SLOTS are ink and scale with the ink
  // ratio (the packing snapshot is updated after ink pricing).
  const prefixWidth = (m: MeasureMetrics, firstInSystem: boolean, index: number, ink = 1) => {
    const showClef = display.clefs !== 'hide' && (firstInSystem || m.clefChanged);
    const showTimeSig = display.timeSignatures !== 'hide' && m.timeSigShow;
    const keySigCount = keySigGlyphs(m, firstInSystem);
    return (
      prefixLeftPad(m, firstInSystem, index) +
      (showClef ? clefSlot(ink) : 0) +
      (keySigCount ? keySigCount * KEY_SIG_GLYPH_ADVANCE_SP * ink + keySigRightPad : 0) +
      (showTimeSig ? timeSlot(ink) : 0) +
      (m.hasRepeatStart ? REPEAT_START_WIDTH_SP * ink : 0)
    );
  };

  const airFor = (m: MeasureMetrics, first: boolean, index: number): PrefixAir => {
    const clef = display.clefs !== 'hide' && (first || m.clefChanged);
    const time = display.timeSignatures !== 'hide' && m.timeSigShow;
    return {
      pads: [
        // A system's opening pad is fixed (`SYSTEM_START_PAD_SP`), so only a
        // mid-system bar carries a content-left pad to re-price.
        ...(first || (bareRepeat(m, first) && !previousClosesWithInk(index))
          ? [] : ['contentLeft' as const]),
        ...(keySigGlyphs(m, first) ? ['keySigRight' as const] : []),
        // The glyph slots' spare tails are air too (`clefSlot`/`timeSlot`).
        ...(clef ? [isTabOnly ? 'tabClefTail' as const : 'clefTail' as const] : []),
        ...(time ? ['timeTail' as const] : [])
      ],
      groups: Number(clef) + Number(time)
    };
  };

  // The packer's input, captured BEFORE the Space line is applied to the
  // springs — the ladder needs base naturals to ask what any other value would
  // draw.
  const packing: PackingInput = {
    spacingMode: options?.spacingMode,
    lineWidthSp: lineWidth,
    ...(options?.subsequentLeftInsetSp === undefined ? {} : { subsequentLineWidthSp: widthSp - 2 * marginSp - subsequentLeftInset }),
    contentRightPadSp: contentRightPad,
    ...(followsSpace ? { space: { spaceSp: densityH, prefixes: metrics.flatMap((m, i) =>
      m.hidden || !inRange(i) ? [] : [{ first: airFor(m, true, i), rest: airFor(m, false, i) }]) } } : {}),
    measures: metrics.flatMap((m, i) =>
      m.hidden || !inRange(i)
        ? []
        : [{
            index: i,
            prefixFirst: prefixWidth(m, true, i),
            prefixRest: prefixWidth(m, false, i),
            rigid: m.rigid,
            columnAir: m.columnAir,
            spring: m.spring,
            lead: m.leadingSpring,
            repeatExtra: m.repeatEnd ? REPEAT_END_EXTRA_SP : 0,
            forcedBreak: forcedBreaks.has(i)
          }]
    )
  };

  // Ink pricing, applied the same way density is — one pass over the finished
  // metrics, after the baseline packing input was captured and
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
      let columnAir = 0;
      for (const voice of m.staves.flat()) {
        const voiceRigid = voice.reduce((sum, e) => sum + e.leading + e.core, 0);
        const voiceSpring = voiceSpringSum(voice);
        if (voiceRigid + voiceSpring > rigid + spring) {
          rigid = voiceRigid;
          spring = voiceSpring;
          // Ink scales leading and core, air included.
          columnAir = voice.reduce((sum, e) => sum + e.air, 0) * inkRatio;
        }
      }
      const merged = mergedNaturalWidth(m.staves, inkRatio, columns);
      if (merged && (merged.rigid > rigid + 1e-6 || merged.rigid + merged.spring > rigid + spring + 1e-6)) {
        // Merged edges are built from ink-scaled halves, so their air is
        // already at this ratio.
        if (merged.rigid > rigid) columnAir = merged.air * inkRatio;
        rigid = Math.max(rigid, merged.rigid);
        spring = Math.max(spring, merged.spring);
      }
      m.rigid = rigid;
      m.spring = spring;
      m.columnAir = columnAir;
    }
  }

  // Packing and placement must price the same ink. Springs are still base
  // values here, so the snapshot stays reusable by the ladder at any Space.
  if (inkRatio !== 1) {
    for (const entry of packing.measures) {
      const m = metrics[entry.index];
      entry.prefixFirst = prefixWidth(m, true, entry.index, inkRatio);
      entry.prefixRest = prefixWidth(m, false, entry.index, inkRatio);
      entry.rigid = m.rigid;
      entry.columnAir = m.columnAir;
      entry.spring = m.spring;
      entry.lead = m.leadingSpring;
      entry.repeatExtra = m.repeatEnd ? REPEAT_END_EXTRA_SP * inkRatio : 0;
    }
  }

  // The Space line, applied to the springs ONCE here — after every spring is
  // computed, after the packing snapshot has captured the base values, and
  // before anything reads one (roadmap/complete/core-render-density-zoom.md).
  // Scaling at the source would mean touching four springSp() call sites and
  // trusting them to stay in step; scaling at consumption would desync the
  // per-event cursor from the measure widths, since both read springs
  // independently. One pass over the finished metrics keeps every reader
  // consistent by construction — and because it runs last, nothing ever has
  // to divide by the factor, which is what lets Space reach zero.
  const springFactor = clearance.spring;
  if (springFactor !== 1) {
    for (const m of metrics) {
      m.spring *= springFactor;
      m.leadingSpring *= springFactor;
      for (const staff of m.staves) {
        for (const voice of staff) {
          for (const event of voice) event.spring *= springFactor;
        }
      }
    }
  }

  // Pass 2 — greedy system packing on natural widths (hidden measures take no
  // slot; forced breaks from a score's `pages.systems` start new rows), plus
  // each row's justification factor. Both live in packSystems, so the density
  // ladder asks the same question of the same code.
  const packed = packSystems(packing, densityH);
  const rowIndicesOf = (packedRow: PackedRow) =>
    packedRow.measures.map(k => packing.measures[k].index);

  const stretches = packed.map(r => r.stretch);

  // Pass 3 — place each row at its justified stretch.
  const measures: MeasurePlan[] = new Array(metrics.length);
  packed.forEach((packedRow, row) => {
    const rowIndices = rowIndicesOf(packedRow);
    const stretch = stretches[row];

    let x = row === 0 ? startX : marginSp + subsequentLeftInset;
    for (const i of rowIndices) {
      const m = metrics[i];
      const firstInSystem = i === rowIndices[0];
      const showClef = display.clefs !== 'hide' && (firstInSystem || m.clefChanged);
      const showTimeSig = display.timeSignatures !== 'hide' && m.timeSigShow;
      const keySigCount = keySigGlyphs(m, firstInSystem);

      const clefX = x + prefixLeftPad(m, firstInSystem, i);
      const keySigX = clefX + (showClef ? clefSlot(inkRatio) : 0);
      const keySigWidth = keySigCount
        ? keySigCount * KEY_SIG_GLYPH_ADVANCE_SP * inkRatio + keySigRightPad
        : 0;
      // The glyph sits centred in ink + tail (the legacy group extra trails it).
      const timeSigCentreX = keySigX + keySigWidth + (TIME_SIG_INK_SP * inkRatio + pad('timeTail')) / 2;
      // A forward repeat (|:) sits between the prefix glyphs and the content.
      const repeatStartX =
        keySigX + keySigWidth + (showTimeSig ? timeSlot(inkRatio) : 0);
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
      // Legacy per-voice walk — the single-voice truth, and the byte-
      // stability reference for multi-voice bars the merge leaves in place.
      // Grace containers: x is the centre of the FIRST small column; the
      // renderer advances by GRACE_NOTE_ADVANCE_SP per inner note.
      const legacyAt = (start: number, width: number) => m.staves.map(staffVoices =>
        staffVoices.map(voice => {
          const voiceRigid = voice.reduce((sum, e) => sum + e.leading + e.core, 0);
          const voiceSpring = voiceSpringSum(voice);
          const voiceStretch = voiceSpring > 0
            ? Math.max(0, (width - voiceRigid) / voiceSpring)
            : 1;
          let cursor = start;
          return voice.map(e => {
            const colStart = cursor;
            const slotX =
              cursor + e.leading +
              ((e.graceCount ? columns.grace : columns.core) * inkRatio) / 2;
            cursor += e.leading + e.core + e.spring * voiceStretch;
            return { x: slotX, colStart };
          });
        })
      );
      const legacy = legacyAt(contentStartX, contentWidth);

      // The onset-aligned overlay: shared columns across every voice and
      // staff of the bar, at a stretch solved against the packed width.
      const model = mergedModelOf(m.staves, inkRatio, columns);
      const mergedAt = (start: number, width: number) => {
        const solved = model!.solveFor(width);
        const anchorsBy = new Map<string, number[]>();
        model!.voices.forEach((v, vi) => anchorsBy.set(`${v.staff}:${v.voice}`, solved.anchors[vi]));
        return m.staves.map((staffVoices, sIdx) =>
          staffVoices.map((voice, vIdx) => {
            const anchors = anchorsBy.get(`${sIdx}:${vIdx}`);
            return voice.map((e, k) => {
              if (!anchors) return legacyAt(start, width)[sIdx][vIdx][k];
              // Snapped to 1e-9: the packer's cursor carries ~1e-14 float
              // noise across densities, and merged anchors are dyadic-clean
              // values that land exactly on rounding half-way points — the
              // combination flips a printed digit between densities that
              // must engrave identically. Half a nanospace is far below
              // anything drawable; determinism is not.
              const x = Math.round((start + anchors[k]) * 1e9) / 1e9;
              const half = ((e.graceCount ? columns.grace : columns.core) * inkRatio) / 2;
              return { x, colStart: x - e.leading - half };
            });
          })
        );
      };
      // Adopted only when it MOVES something — decided ONCE, at the bar's
      // natural width, so the choice cannot flip with the row's density (the
      // engraving must stay a pure function of the packing signature, which
      // is the density ladder's whole contract). A bar whose voices already
      // agree keeps the legacy floats, so its goldens cannot churn.
      let chosen = legacy;
      if (model) {
        const naturalWidth = m.rigid + m.spring;
        const legacyNat = legacyAt(0, naturalWidth);
        const mergedNat = mergedAt(0, naturalWidth);
        const moved = mergedNat.some((sv, si) =>
          sv.some((vv, vi) => vv.some((slot, ki) => Math.abs(slot.x - legacyNat[si][vi][ki].x) > 1e-6))
        );
        if (moved) chosen = mergedAt(contentStartX, contentWidth);
      }

      const staves = m.staves.map((staffVoices, s) =>
        staffVoices.map((voice, v) =>
          voice.map((e, k): EventSlot => {
            const placed = chosen[s][v][k];
            (e.midClefs ?? []).forEach((mc, j) => {
              const key = `${s}:${mc.timelineIndex}`;
              if (!midClefXs.has(key)) {
                midClefXs.set(key, {
                  x: placed.colStart + j * MID_CLEF_WIDTH_SP * inkRatio + columns.midClefLeftPad,
                  clef: mc.clef,
                  staff: s + 1
                });
              }
            });
            return { x: placed.x };
          })
        )
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

  if (options?.entries) measures.forEach((measure, i) => { measure.entry = options.entries![i]; });

  const usedWidthSp = measures.length
    ? Math.max(...measures.map(m => m.x + m.width)) + marginSp
    : widthSp;
  return { measures, rowCount: packed.length, numStaves, staffGroups, usedWidthSp, packing, columns, inkRatio };
}


/** The parts a plan's staves draw from, once each, in staff order. */
function uniquePartsOf(planStaves: PlanStaff[]): MnxPart[] {
  const seen = new Set<MnxPart>();
  for (const staff of planStaves) seen.add(staff.sources[staff.sources.length - 1]!.part);
  return [...seen];
}

/**
 * Measure-level attributes the engine does not engrave. The list IS the
 * census (core-measure-attributes-gaps.md §"not rendered"): a line here is a
 * renderer-gap badge on the bar, and it is removed when the ink arrives. It
 * emptied on 2026-08-29 with chord symbols (core-chord-symbols.md) — the seam
 * stays so the next undrawn attribute has somewhere to be declared.
 */
export function measureLevelGaps(
  globalMeasure: MnxGlobalMeasure | undefined,
  partMeasures: readonly (MnxPartMeasure | undefined)[]
): string[] {
  void globalMeasure;
  void partMeasures;
  return [];
}

/** Shared text gutter sizing for part names; unnamed parts claim no space. */
export function instrumentLabelInset(names: readonly (string | null)[]): number {
  const length = Math.max(0, ...names.map(name => name?.length ?? 0));
  return length ? length * LABEL_CHAR_SP + LABEL_PAD_SP : 0;
}

export const LABEL_CHAR_SP = 1.0;
export const LABEL_PAD_SP = 0.6;

/** What a heading mark's placement needs to know about its bar. */
export type MeasureHeading = Pick<MeasurePlan, 'contentStartX' | 'x' | 'voices'>;

/**
 * Where text that starts AT a column starts: this far left of the column's
 * centre, which is the black notehead's left edge. One value for every such
 * text — a heading mark over the first note, a chord symbol, a direction, a
 * mid-bar tempo — so they share an edge. Two leads read as two alignments:
 * the heading row used to lead by 1.5sp, which put "Intro" and the tempo over
 * the first note's accidental while the direction under them started at the
 * notehead's centre (the Soundslice comparison, 2026-09-15).
 */
export const ONSET_TEXT_LEAD_SP = 0.6;
/** How far a heading mark leads the ink it belongs to. */
const HEADING_LEAD_SP = ONSET_TEXT_LEAD_SP;

/**
 * Where a bar's heading marks start — the metronome mark, the swing marking,
 * the section/rehearsal labels, the tab capo line.
 *
 * All of them lead the bar's FIRST ONSET by `HEADING_LEAD_SP` — the notehead's
 * left edge, the same edge every other text at a column starts from — and
 * never start before the content anchor. The anchor is what keeps the mark off the prefix:
 * with a clef, a key or a time signature on show it sits just past them, and
 * at a forward repeat it already clears the whole `|:` cluster and its dots.
 * The onset is what keeps the mark on the music: with the prefix hidden (or
 * simply absent, as in every mid-piece bar) `contentStartX` is a stretched
 * leading spring away from the first note, and a mark leading IT floated in the
 * empty left of the bar — on a mid-system bar, where the spring is short, it
 * crossed the barline and read as belonging to the bar before.
 *
 * The time signature used to be an exception — the mark led the numerals'
 * centre, and so started over or even before them — which read as the heading
 * belonging to the prefix rather than to the bar's music. It leads the first
 * note now, like every other bar.
 *
 * `m.x` is a floor, never a placement: a heading mark cannot precede its own
 * barline whatever the geometry.
 */
export function measureHeadingX(m: MeasureHeading): number {
  const onsets = (m.voices ?? []).map(voice => voice[0]?.x).filter((x): x is number => x !== undefined);
  // An empty bar draws no onset to lead, so the content anchor stands in.
  const lead = onsets.length ? Math.min(...onsets) - HEADING_LEAD_SP : m.contentStartX;
  return Math.max(m.x, m.contentStartX, lead);
}

/**
 * True when the NEXT measure's forward repeat supplies THIS measure's end
 * barline. `|:` opens with a thick stroke standing exactly where the ordinary
 * barline would go, so drawing both doubles the ink at the boundary — and a
 * repeat that follows its own barline is not what a repeat looks like.
 *
 * Keyed on the rendered neighbour, so performed order (where a bar's successor
 * is whatever the traversal reached next) asks the same question as written.
 */
export function repeatStartSuppliesBarline(
  measures: readonly MeasurePlan[],
  index: number
): boolean {
  const measure = measures[index];
  const next = measures[index + 1];
  if (!measure || !next || next.hidden) return false;
  if (next.row !== measure.row) return false; // a row away is not a boundary
  return Boolean(next.repeatStart) && next.repeatStartX === next.x;
}
