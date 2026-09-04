export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

// ---- MNX Lab extensions v6 (`_x.mnxLab`) — see docs/mnx-extensions.md ----

export interface MnxFingering {
  hand: 'left' | 'right';
  finger: string;
}

/** One control point on a bend curve. */
export interface MnxBendPoint {
  /** Fraction of the note's own duration: 0 = onset, 1 = release. */
  position: number;
  /** Offset from the written pitch in SEMITONES (MNX `pitch.alter` units). */
  alter: number;
}

/** A bend as a curve. A pre-bend is a first point at 0 with a non-zero `alter`;
 *  a release is any later point whose `alter` decreases. */
export interface MnxBend {
  points: MnxBendPoint[];
}

export interface MnxSlide {
  type: 'shift' | 'legato' | 'slideIn' | 'slideOut';
  direction?: 'up' | 'down';
  target?: string;
}

export interface MnxHarmonic {
  type: 'natural' | 'artificial' | 'pinch' | 'tap' | 'semi' | 'feedback';
  touchingPitch?: MnxPitch;
}

export interface MnxTabTechnique {
  bend?: MnxBend;
  slide?: MnxSlide;
  /** Hammer-on or pull-off — one adornment (v6); direction implicit in the pitches. */
  hammerPull?: { target: string };
  vibrato?: boolean;
  harmonic?: MnxHarmonic;
  palmMute?: boolean;
}

/** Since v5 only `technique` remains under `tab`. */
export interface MnxTabNoteExtension {
  technique?: MnxTabTechnique;
}

/** The whole vendor dict at note._x.mnxLab — flat shape (v5+). `fret` is
 *  optional and non-authoritative (validation only); converters keep writing
 *  it because the source formats store both. */
export interface MnxNoteExtension {
  string?: number;
  fret?: number;
  fingering?: MnxFingering;
  tab?: MnxTabNoteExtension;
}

/** A chord root or bass note: an MNX pitch minus the octave. */
export interface MnxHarmonyStep {
  step: MnxPitch['step'];
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

/** A tie from the note that carries it to `target`, the note it ties into.
 *  MNX states a tie as a reference on the FIRST note; MusicXML states it as
 *  start/stop markers on a pair, so the target is only knowable once the part
 *  is assembled and ids are final — see `linkSpannerTargets`. */
export interface MnxTie {
  target?: string;
  side?: MnxSlurSide;
}

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
  ties?: MnxTie[];
  accidentalDisplay?: {
    show: boolean;
    enclosure?: {
      symbol: 'parentheses' | 'brackets';
    };
  };
  _x?: {
    mnxLab?: MnxNoteExtension;
  };
}

export interface MnxRest {}

/** One syllable of one lyric line. `start`/`middle` continue into the next
 *  syllable with a hyphen (MusicXML `<syllabic>begin|middle`). */
export interface MnxEventLyricLine {
  text: string;
  type?: 'start' | 'middle' | 'end' | 'whole';
}

/** Lyrics on an event: line id → syllable. Verses stack below the staff. */
export interface MnxEventLyrics {
  lines?: Record<string, MnxEventLyricLine>;
}

/** A written note value: the symbol, not the performed time. */
export interface MnxNoteValue {
  base: string; // e.g. 'whole', 'half', 'quarter', 'eighth', '16th', '32nd'
  dots?: number;
}

export type MnxSlurSide = 'up' | 'down';

/** A slur from the event that carries it to `target`, another event.
 *  `startNote`/`endNote` narrow it to particular chord members; they are
 *  omitted for the ordinary event-to-event case, which is how the spec's own
 *  examples encode a slur between two chords. */
export interface MnxSlur {
  target: string;
  side?: MnxSlurSide;
  startNote?: string;
  endNote?: string;
}

export interface MnxEvent {
  id?: string;
  duration: MnxNoteValue;
  slurs?: MnxSlur[];
  lyrics?: MnxEventLyrics;
  notes?: MnxNote[];
  rest?: MnxRest;
  stemDirection?: 'up' | 'down';
  staff?: number;
}

/** MNX `tuplet` container: `content` performed in the time of `outer`. */
export interface MnxTuplet {
  type: 'tuplet';
  id?: string;
  content: MnxEvent[];
  inner: { duration: MnxNoteValue; multiple: number };
  outer: { duration: MnxNoteValue; multiple: number };
  bracket?: 'yes' | 'no' | 'auto';
  showNumber?: 'noNumber' | 'inner' | 'both';
}

/** MNX `grace` container: un-timed events stealing time around a neighbour. */
export interface MnxGrace {
  type: 'grace';
  id?: string;
  content: MnxEvent[];
  graceType?: 'makeTime' | 'stealFollowing' | 'stealPrevious';
  slash?: boolean;
}

export type MnxSequenceItem = MnxEvent | MnxGrace | MnxTuplet;

export function isGrace(item: MnxSequenceItem): item is MnxGrace {
  return (item as MnxGrace).type === 'grace';
}

export function isTuplet(item: MnxSequenceItem): item is MnxTuplet {
  return (item as MnxTuplet).type === 'tuplet';
}

/** True for items that occupy metric time and carry a duration. */
export function isTimedEvent(item: MnxSequenceItem): item is MnxEvent {
  const type = (item as MnxGrace | MnxTuplet).type;
  if (type === 'grace' || type === 'tuplet') return false;
  return (item as MnxEvent).duration !== undefined;
}

export interface MnxSequence {
  content: MnxSequenceItem[];
  voice?: string;
  staff?: number;
}

/**
 * One beam, at one level.
 *
 * MNX nests: the top level is the primary beam, `beams` inside it are the
 * secondary beams over sub-runs of the same events, and so on. A nested beam
 * holding ONE event with a `direction` is a hook — MusicXML's `forward hook`
 * (right) and `backward hook` (left).
 *
 * A group lives on the measure of its FIRST event and may name events in later
 * measures, which is how the spec encodes a beam across a barline.
 */
export interface MnxBeam {
  events: string[];
  beams?: MnxBeam[];
  direction?: 'left' | 'right';
}

export interface MnxPartMeasure {
  /** Beam groups starting in this measure. */
  beams?: MnxBeam[];
  /** Free-text/symbolic instructions for this part. **Proposed**, not adopted. */
  directions?: MnxDirection[];
  clefs?: {
    clef: {
      sign: string;
      staffPosition?: number;
      octave?: number;
    };
  }[];
  sequences: MnxSequence[];
}

export interface MnxTuningEntry {
  /** Explicit string number — array order carries no meaning. */
  string: number;
  pitch: MnxPitch;
}

/** Standard guitar tuning as an EXPLICIT declaration. Not a default: an
 *  absent `strings[]` means no fingerboard, so the importer must write this
 *  out whenever the source is tab without its own staff-tuning. */
export const STANDARD_GUITAR_STRINGS: MnxTuningEntry[] = [
  { string: 1, pitch: { step: 'E', octave: 4 } },
  { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'E', octave: 2 } }
];

/** Since v5 only `staffKind` remains under `tab`. */
export interface MnxTabPartExtension {
  /** The part's preferred presentation; tab-ness is a view, not content. */
  staffKind?: 'notation' | 'tab' | 'both';
}

/** The whole vendor dict at part._x.mnxLab — flat shape (v5+). */
export interface MnxPartExtension {
  /** Sounding open-string pitches, before the capo. Absent ⇒ no fingerboard
   *  declared (no consumer assumes an instrument). */
  strings?: MnxTuningEntry[];
  capo?: number;
  tab?: MnxTabPartExtension;
}

export interface MnxPart {
  id: string;
  name: string;
  staves?: number;
  measures: MnxPartMeasure[];
  transposition?: {
    interval: {
      halfSteps: number;
      staffDistance?: number;
    };
  };
  _x?: {
    mnxLab?: MnxPartExtension;
  };
}

export interface MnxGlobalMeasure {
  key?: {
    fifths: number;
  };
  time?: {
    count: number;
    unit: number;
  };
  barline?: {
    type?: 'regular' | 'dotted' | 'dashed' | 'heavy' | 'double' | 'final'
      | 'heavyLight' | 'heavyHeavy' | 'tick' | 'short' | 'noBarline';
  };
  /** Forward repeat at the start of this measure (`|:`). */
  repeatStart?: object;
  /** Backward repeat at the end of this measure (`:|`); `times` = total plays. */
  repeatEnd?: {
    times?: number;
  };
  /** Volta bracket starting here, spanning `duration` measures (default 1);
   *  `open` brackets have no closing hook (MusicXML `discontinue`). */
  ending?: {
    duration?: number;
    numbers?: number[];
    open?: boolean;
  };
  /** Metronome marks ("note = bpm"), drawn above the start of the measure. */
  tempos?: {
    bpm: number;
    value: { base: string; dots?: number };
    location?: { fraction: [number, number] };
  }[];
  /** Rehearsal mark and formal section name. **Proposed** standard MNX
   *  objects, not yet adopted — see roadmap/proposed/low-priority/spec-score-text.md. */
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
    /**
     * What this document states rather than leaves to be inferred.
     *
     * Without `useAccidentalDisplay`, a renderer works out for itself which
     * accidentals to print; with it, `accidentalDisplay` on the notes is the
     * whole answer. `useBeams` says the same about `beams`. MusicXML always
     * states both explicitly — `<accidental>` and `<beam>` ARE the statement —
     * so an import that read them has to say so, or the renderer will
     * second-guess the source.
     */
    support?: {
      useAccidentalDisplay?: boolean;
      useBeams?: boolean;
    };
  };
  global: {
    measures: MnxGlobalMeasure[];
    /** Document-wide lyric line ordering and metadata (verse order, labels). */
    lyrics?: {
      lineOrder?: string[];
      lineMetadata?: Record<string, { label?: string; lang?: string }>;
    };
  };
  parts: MnxPart[];
}
