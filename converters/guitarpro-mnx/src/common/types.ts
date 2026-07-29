/**
 * MNX types used by this converter.
 *
 * These MIRROR the canonical definitions in `src/types/mnx.ts`. They are
 * duplicated rather than imported because this is a standalone npm package and
 * TypeScript's `rootDir` will not emit declarations for sources outside it.
 *
 * The duplication is deliberately NOT the safety mechanism — `tests/` validates
 * every document this converter produces against the precompiled JSON Schemas
 * (`worker/generated/validate-mnx.mjs` + `validate-tab.mjs`), which is the real
 * contract and catches drift these interfaces never could. If you extend these,
 * mirror `src/types/mnx.ts` exactly; do not invent shapes here.
 */

export type MnxStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface MnxPitch {
  step: MnxStep;
  octave: number;
  alter?: number;
}

export type MnxNoteValueBase =
  | 'duplexMaxima' | 'maxima' | 'longa' | 'breve'
  | 'whole' | 'half' | 'quarter' | 'eighth'
  | '16th' | '32nd' | '64th' | '128th' | '256th' | '512th' | '1024th'
  | '2048th' | '4096th';

export interface MnxNoteValue {
  base: MnxNoteValueBase;
  dots?: number;
}

// ---- MNX Lab extensions v4 (`_x.mnxLab`) — see docs/mnx-extensions.md ----

export interface MnxTabPosition {
  /** String number; 1 = highest-pitched string. */
  string: number;
  /** Fret number; 0 = open string. */
  fret: number;
}

/** One control point on a bend curve. */
export interface MnxBendPoint {
  /** Fraction of the note's own duration: 0 = onset, 1 = release. */
  position: number;
  /** Offset from the written pitch in SEMITONES (MNX `pitch.alter` units). */
  alter: number;
}

export type MnxHarmonicType =
  | 'natural' | 'artificial' | 'pinch' | 'tap' | 'semi' | 'feedback';

export interface MnxTabTechnique {
  /** A bend as a curve. A pre-bend is a first point at 0 with a non-zero
   *  `alter`; a release is any later point whose `alter` decreases. */
  bend?: { points: MnxBendPoint[] };
  slide?: {
    type: 'shift' | 'legato' | 'slideIn' | 'slideOut';
    direction?: 'up' | 'down';
    target?: string;
  };
  hammerOn?: { target: string };
  pullOff?: { target: string };
  vibrato?: boolean;
  harmonic?: {
    type: MnxHarmonicType;
    touchingPitch?: MnxPitch;
  };
  palmMute?: boolean;
}

/** A chord root or bass note: an MNX pitch minus the octave. */
export interface MnxHarmonyStep {
  step: MnxStep;
  alter?: number;
}

export type MnxHarmonyQuality =
  | 'major' | 'minor' | 'augmented' | 'diminished'
  | 'dominantSeventh' | 'majorSeventh' | 'minorSeventh' | 'diminishedSeventh'
  | 'augmentedSeventh' | 'halfDiminished' | 'majorMinor'
  | 'majorSixth' | 'minorSixth'
  | 'dominantNinth' | 'majorNinth' | 'minorNinth'
  | 'dominantEleventh' | 'majorEleventh' | 'minorEleventh'
  | 'dominantThirteenth' | 'majorThirteenth' | 'minorThirteenth'
  | 'suspendedSecond' | 'suspendedFourth'
  | 'neapolitan' | 'italian' | 'french' | 'german' | 'pedal' | 'power' | 'tristan'
  | 'other' | 'none';

export interface MnxHarmonyDegree {
  value: number;
  alter?: number;
  type: 'add' | 'alter' | 'subtract';
}

/** One chord symbol on the global timeline. No duration — a chord lasts until
 *  the next one. `text` appears only when the source's literal spelling differs
 *  from what a consumer would render from the structure. */
export interface MnxHarmony {
  location: { fraction: [number, number] };
  root?: MnxHarmonyStep;
  quality: MnxHarmonyQuality;
  bass?: MnxHarmonyStep;
  degrees?: MnxHarmonyDegree[];
  text?: string;
}

/** A label on a global measure: `rehearsal` is an index into the score ("A"),
 *  `section` names a formal unit of the piece ("Verse 1"). A property OF the
 *  measure, like `key` and `time` — not positioned within it, because a
 *  rehearsal mark indexes a bar and a section begins at a barline. */
export interface MnxMeasureLabel {
  label: string;
  color?: string;
}

/** A textual or symbolic instruction at a point in a part's measure. Shaped like
 *  `dynamic-group`. Carries no typography. **Proposed, not adopted.** */
export interface MnxDirection {
  position: { fraction: [number, number] };
  text?: string;
  glyphs?: string[];
  orient?: 'above' | 'auto' | 'below' | 'between';
  staff?: number;
  voice?: string;
  color?: string;
}

export interface MnxGlobalMeasureExtension {
  harmonies?: MnxHarmony[];
}

export interface MnxTabNoteExtension {
  position?: MnxTabPosition;
  technique?: MnxTabTechnique;
  fingering?: { hand: 'left' | 'right'; finger: string };
}

export interface MnxTuningEntry {
  /** Explicit string number — array order carries no meaning. */
  string: number;
  pitch: MnxPitch;
}

export interface MnxTabPartExtension {
  tuning?: MnxTuningEntry[];
  capo?: number;
  staffKind?: 'notation' | 'tab' | 'both';
}

// ---- Core document ----

export interface MnxTie {
  target?: string;
  side?: 'up' | 'down';
  lv?: boolean;
  targetType?: 'nextNote' | 'crossVoice' | 'arpeggio' | 'crossJump';
}

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
  accidentalDisplay?: { show: boolean; force?: boolean };
  ties?: MnxTie[];
  _x?: { mnxLab?: { tab?: MnxTabNoteExtension } };
}

export interface MnxRest {
  staffPosition?: number;
}

export interface MnxEventMarkings {
  accent?: object;
  staccato?: object;
  tenuto?: object;
  tremolo?: { marks?: number };
}

export interface MnxEventLyricLine {
  text: string;
  type?: 'start' | 'middle' | 'end' | 'whole';
}

export interface MnxEvent {
  id?: string;
  duration: MnxNoteValue;
  lyrics?: { lines?: Record<string, MnxEventLyricLine> };
  markings?: MnxEventMarkings;
  notes?: MnxNote[];
  rest?: MnxRest;
}

export interface MnxTuplet {
  type: 'tuplet';
  id?: string;
  content: MnxEvent[];
  inner: { duration: MnxNoteValue; multiple: number };
  outer: { duration: MnxNoteValue; multiple: number };
  bracket?: 'yes' | 'no' | 'auto';
  showNumber?: 'noNumber' | 'inner' | 'both';
}

export interface MnxGrace {
  type: 'grace';
  id?: string;
  content: MnxEvent[];
  graceType?: 'makeTime' | 'stealFollowing' | 'stealPrevious';
  slash?: boolean;
}

export type MnxSequenceItem = MnxEvent | MnxGrace | MnxTuplet;

/** True for items that occupy metric time and carry a duration. */
export function isTimedEvent(item: MnxSequenceItem): item is MnxEvent {
  const type = (item as MnxGrace | MnxTuplet).type;
  if (type === 'grace' || type === 'tuplet') return false;
  return (item as MnxEvent).duration !== undefined;
}

export interface MnxSequence {
  content: MnxSequenceItem[];
  fullMeasure?: { visualDuration?: MnxNoteValue; staffPosition?: number };
  staff?: number;
  voice?: string;
}

export interface MnxPartMeasure {
  /** Free-text/symbolic instructions for this part. **Proposed**, not adopted. */
  directions?: MnxDirection[];
  clefs?: {
    clef: { sign: string; staffPosition?: number; octave?: number };
    position?: { fraction: [number, number] };
    staff?: number;
  }[];
  sequences: MnxSequence[];
}

export interface MnxPart {
  id?: string;
  name?: string;
  staves?: number;
  measures: MnxPartMeasure[];
  _x?: { mnxLab?: { tab?: MnxTabPartExtension } };
}

export interface MnxGlobalMeasure {
  id?: string;
  key?: { fifths: number };
  time?: { count: number; unit: number; display?: 'common' | 'cut' };
  barline?: { type?: string };
  repeatStart?: object;
  repeatEnd?: { times?: number };
  ending?: { duration?: number; numbers?: number[]; open?: boolean };
  tempos?: {
    bpm: number;
    value: MnxNoteValue;
    location?: { fraction: [number, number] };
  }[];
  /** Rehearsal mark and formal section name. **Proposed** standard MNX
   *  objects, not yet adopted — see roadmap/proposed/score-text.md. */
  rehearsal?: MnxMeasureLabel;
  section?: MnxMeasureLabel;
  /** Vendor extensions: chord symbols, which standard MNX has no concept of at
   *  all. Schema-legal: `_x` is declared in `global-attrs`. */
  _x?: {
    mnxLab?: MnxGlobalMeasureExtension;
  };
}

export interface MnxStructure {
  mnx: {
    version: number;
    support?: { useAccidentalDisplay?: boolean; useBeams?: boolean };
  };
  global: {
    measures: MnxGlobalMeasure[];
    lyrics?: {
      lineOrder?: string[];
      lineMetadata?: Record<string, { label?: string; lang?: string }>;
    };
  };
  parts: MnxPart[];
}
