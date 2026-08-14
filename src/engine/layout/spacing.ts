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
  sequenceItemKind
} from '../../model/mnx.ts';
import { dynamicWidthSp } from './dynamics.ts';

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
const CONTENT_LEFT_PAD_SP = 0.6;
const CONTENT_RIGHT_PAD_SP = 0.8;
const START_BARLINE_PAD_SP = 0.5;
const CLEF_WIDTH_SP = 3;
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
const QUARTER_SPRING_SP = 2.2;     // ideal space after a quarter note
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
const MAX_STRETCH = 2.5;           // justification cap — beyond this, leave the row ragged
const MIN_SQUEEZE = 0.35;          // compression floor for overfull rows
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

/** Density clamp: enough range to be useful, bounded so a bad value cannot
 *  produce a plan the justifier then has to rescue. */
const MIN_DENSITY = 0.5;
const MAX_DENSITY = 2;

export function clampDensity(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.min(MAX_DENSITY, Math.max(MIN_DENSITY, value));
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
   * HORIZONTAL DENSITY (roadmap/inprogress/core-render-density-zoom.md): a
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
    return { measures: [], rowCount: 0, numStaves: 1, staffGroups: [], usedWidthSp: widthSp };
  }

  const useAccidentalDisplay = mnx.mnx?.support?.useAccidentalDisplay === true;
  const leftInset = options?.leftInsetSp ?? 0;
  const startX = MARGIN_SP + leftInset;
  const lineWidth = widthSp - 2 * MARGIN_SP - leftInset;
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
          return { t, clef: { sign, octave: oct } };
        })
        .sort((a, b) => a.t - b.t);

      const startClef = measureClefs.find(c => c.t <= ONSET_EPS);
      if (
        startClef &&
        (startClef.clef.sign !== current.sign || startClef.clef.octave !== current.octave)
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

  const prefixWidth = (m: MeasureMetrics, firstInSystem: boolean) => {
    const showClef = firstInSystem || m.clefChanged;
    const showKeySig = (firstInSystem && m.keyFifths !== 0) || m.keyChanged;
    const showTimeSig = m.timeSigShow;
    const keySigCount = showKeySig
      ? Math.abs(m.keyFifths !== 0 ? m.keyFifths : m.cancelledKeyFifths)
      : 0;
    return (
      CONTENT_LEFT_PAD_SP +
      (firstInSystem ? START_BARLINE_PAD_SP : 0) +
      (showClef ? CLEF_WIDTH_SP : 0) +
      (keySigCount ? keySigCount * KEY_SIG_GLYPH_ADVANCE_SP + KEY_SIG_RIGHT_PAD_SP : 0) +
      (showTimeSig ? TIME_SIG_WIDTH_SP : 0) +
      (m.hasRepeatStart ? REPEAT_START_WIDTH_SP : 0)
    );
  };

  // Horizontal density, applied ONCE here — after every spring is computed and
  // before anything reads one (roadmap/inprogress/core-render-density-zoom.md).
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

  // Pass 2 — greedy system packing on natural widths (hidden measures take no
  // slot; forced breaks from a score's `pages.systems` start new rows).
  const rows: number[][] = [];
  let current: number[] = [];
  let currentWidth = 0;
  metrics.forEach((m, i) => {
    if (m.hidden || !inRange(i)) return;
    const content =
      m.leadingSpring + m.rigid + m.spring + CONTENT_RIGHT_PAD_SP +
      (m.repeatEnd ? REPEAT_END_EXTRA_SP : 0);
    const natural = prefixWidth(m, current.length === 0) + content;
    if (current.length > 0 && (currentWidth + natural > lineWidth || forcedBreaks.has(i))) {
      rows.push(current);
      current = [];
      currentWidth = prefixWidth(m, true) + content;
    } else {
      currentWidth += natural;
    }
    current.push(i);
  });
  if (current.length > 0) rows.push(current);

  // Pass 3 — justify each row (stretch springs by a common factor) and place.
  const measures: MeasurePlan[] = new Array(metrics.length);
  rows.forEach((rowIndices, row) => {
    let rowRigid = 0;
    let rowSpring = 0;
    for (const i of rowIndices) {
      const m = metrics[i];
      rowRigid +=
        prefixWidth(m, i === rowIndices[0]) + m.rigid + CONTENT_RIGHT_PAD_SP +
        (m.repeatEnd ? REPEAT_END_EXTRA_SP : 0);
      rowSpring += m.spring + m.leadingSpring;
    }
    const stretch = rowSpring > 0
      ? Math.min(MAX_STRETCH, Math.max(MIN_SQUEEZE, (lineWidth - rowRigid) / rowSpring))
      : 1;

    let x = startX;
    for (const i of rowIndices) {
      const m = metrics[i];
      const firstInSystem = i === rowIndices[0];
      const showClef = firstInSystem || m.clefChanged;
      const showKeySig = (firstInSystem && m.keyFifths !== 0) || m.keyChanged;
      const showTimeSig = m.timeSigShow;
      const keySigCount = showKeySig
        ? Math.abs(m.keyFifths !== 0 ? m.keyFifths : m.cancelledKeyFifths)
        : 0;

      const clefX = x + CONTENT_LEFT_PAD_SP + (firstInSystem ? START_BARLINE_PAD_SP : 0);
      const keySigX = clefX + (showClef ? CLEF_WIDTH_SP : 0);
      const keySigWidth = keySigCount
        ? keySigCount * KEY_SIG_GLYPH_ADVANCE_SP + KEY_SIG_RIGHT_PAD_SP
        : 0;
      const timeSigCentreX = keySigX + keySigWidth + TIME_SIG_WIDTH_SP / 2;
      // A forward repeat (|:) sits between the prefix glyphs and the content.
      const repeatStartX = keySigX + keySigWidth + (showTimeSig ? TIME_SIG_WIDTH_SP : 0);
      // Events start after the stretched leading spring — the same justified
      // breathing room every other gap in the bar gets.
      const contentStartX =
        repeatStartX + (m.hasRepeatStart ? REPEAT_START_WIDTH_SP : 0) +
        m.leadingSpring * stretch;

      const contentWidth = m.rigid + m.spring * stretch;
      const width =
        contentStartX - x + contentWidth + CONTENT_RIGHT_PAD_SP +
        (m.repeatEnd ? REPEAT_END_EXTRA_SP : 0);

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
                  x: cursor + k * MID_CLEF_WIDTH_SP + MID_CLEF_LEFT_PAD_SP,
                  clef: mc.clef,
                  staff: s + 1
                });
              }
            });
            // Grace containers: x is the centre of the FIRST small column;
            // the renderer advances by GRACE_NOTE_ADVANCE_SP per inner note.
            const slotX =
              cursor + e.leading + (e.graceCount ? GRACE_NOTE_ADVANCE_SP : CORE_SP) / 2;
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
        showKeySig,
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
    ? Math.max(...measures.map(m => m.x + m.width)) + MARGIN_SP
    : widthSp;
  return { measures, rowCount: rows.length, numStaves, staffGroups, usedWidthSp };
}
