export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

// ---- MNX Lab extensions v4 (`_x.mnxLab`) — see docs/mnx-extensions.md ----

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
  hammerOn?: { target: string };
  pullOff?: { target: string };
  vibrato?: boolean;
  harmonic?: MnxHarmonic;
  palmMute?: boolean;
}

/** v5: only `technique` remains under `tab`. */
export interface MnxTabNoteExtension {
  technique?: MnxTabTechnique;
}

/** The whole vendor dict at note._x.mnxLab — v5 flat shape. `fret` is
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

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
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

export interface MnxEvent {
  id?: string;
  duration: {
    base: string; // e.g. 'whole', 'half', 'quarter', 'eighth', '16th', '32nd'
    dots?: number;
  };
  lyrics?: MnxEventLyrics;
  notes?: MnxNote[];
  rest?: MnxRest;
  stemDirection?: 'up' | 'down';
  staff?: number;
}

export interface MnxSequence {
  content: MnxEvent[];
  voice?: string;
  staff?: number;
}

export interface MnxPartMeasure {
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

/** v5: only `staffKind` remains under `tab`. */
export interface MnxTabPartExtension {
  /** The part's preferred presentation; tab-ness is a view, not content. */
  staffKind?: 'notation' | 'tab' | 'both';
}

/** The whole vendor dict at part._x.mnxLab — v5 flat shape. */
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
   *  objects, not yet adopted — see roadmap/proposed/spec-score-text.md. */
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
