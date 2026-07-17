export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

// ---- Tablature extension v2 (`_x.tab`) — see docs/tab-extension-spec.md ----

export interface MnxTabPosition {
  /** String number; 1 = highest-pitched string. */
  string: number;
  /** Fret number; 0 = open string. */
  fret: number;
}

export interface MnxTabTechnique {
  bend?: {
    type: 'bend' | 'pre-bend';
    amount: number;
    release?: boolean;
  };
  slide?: {
    type: 'shift' | 'legato' | 'slide-in' | 'slide-out';
    direction?: 'up' | 'down';
    target?: string;
  };
  hammerOn?: { target: string };
  pullOff?: { target: string };
  vibrato?: boolean;
}

export interface MnxTabNoteExtension {
  position?: MnxTabPosition;
  technique?: MnxTabTechnique;
  fingering?: {
    hand: 'left' | 'right';
    finger: string;
  };
}

export interface MnxAccidentalDisplay {
  show: boolean;
  force?: boolean;
}

/** A tie from this note to `target` (a note id elsewhere in the document).
 *  `lv: true` with no target is a laissez-vibrer tie (short open hook). */
export interface MnxTie {
  target?: string;
  side?: 'up' | 'down';
  lv?: boolean;
  targetType?: 'nextNote' | 'crossVoice' | 'arpeggio' | 'crossJump';
}

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
  accidentalDisplay?: MnxAccidentalDisplay;
  ties?: MnxTie[];
  _x?: {
    tab?: MnxTabNoteExtension;
  };
}

export interface MnxRest {
  /** Vertical position in half-staff-spaces from the middle line, positive up
   *  (MNX `rest.staffPosition`); absent = the value's default resting place. */
  staffPosition?: number;
}

/** Event-level markings (MNX `event-markings`): articulations + single-note tremolo. */
export interface MnxEventMarkings {
  accent?: object;
  breath?: object;
  softAccent?: object;
  spiccato?: object;
  staccatissimo?: object;
  staccato?: object;
  stress?: object;
  strongAccent?: object;
  tenuto?: object;
  tremolo?: { marks?: number };
  unstress?: object;
}

/** MNX `note-value-base` — the full schema enum (renderer support varies;
 *  durations without a Bravura glyph degrade to fallbacks). */
export type MnxNoteValueBase =
  | 'duplexMaxima' | 'maxima' | 'longa' | 'breve'
  | 'whole' | 'half' | 'quarter' | 'eighth'
  | '16th' | '32nd' | '64th' | '128th' | '256th' | '512th' | '1024th'
  | '2048th' | '4096th';

/** One syllable of one lyric line on an event. `type` start/middle continue
 *  into the next syllable with a hyphen. */
export interface MnxEventLyricLine {
  text: string;
  type?: 'start' | 'middle' | 'end' | 'whole';
}

/** A slur from this event to `target` (an event id). `startNote`/`endNote`
 *  pin the endpoints to specific chord members; `side` forces the curve
 *  direction (default: opposite the start event's stem). */
export interface MnxSlur {
  target: string;
  side?: 'up' | 'down';
  sideEnd?: 'up' | 'down';
  startNote?: string;
  endNote?: string;
  lineType?: string;
}

export interface MnxEvent {
  /** Referenced by beams and slurs. */
  id?: string;
  duration: {
    base: MnxNoteValueBase;
    dots?: number;
  };
  /** Lyrics: line id → syllable (verses stack below the staff). */
  lyrics?: {
    lines?: Record<string, MnxEventLyricLine>;
  };
  markings?: MnxEventMarkings;
  notes?: MnxNote[];
  rest?: MnxRest;
  slurs?: MnxSlur[];
}

/** MNX `grace` container: un-timed events stealing time around a neighbour.
 *  Reference engravings default to the slashed (acciaccatura) form, so render
 *  a slash unless `slash` is explicitly false. */
export interface MnxGrace {
  type: 'grace';
  id?: string;
  content: MnxEvent[];
  graceType?: 'makeTime' | 'stealFollowing' | 'stealPrevious';
  slash?: boolean;
}

/** MNX `tremolo` container: two alternating events, each WRITTEN with the
 *  tremolo's total duration; `marks` = beam/slash count between them, `outer`
 *  = the performed value (duration × multiple = the real metric time). */
export interface MnxTremolo {
  type: 'tremolo';
  id?: string;
  content: MnxEvent[];
  marks?: number;
  outer?: {
    duration: {
      base: MnxNoteValueBase;
      dots?: number;
    };
    multiple?: number;
  };
}

/** MNX `tuplet` container: inner events performed in the time of `outer`
 *  (inner 3×eighth in outer 2×eighth = a triplet). Number/bracket display is
 *  conventional: a number always (unless `showNumber: "noNumber"`), a bracket
 *  unless the whole group is joined by one beam. */
export interface MnxTuplet {
  type: 'tuplet';
  id?: string;
  /** Inner events. (Nested containers aren't modelled — they'd render as
   *  blank columns.) */
  content: MnxEvent[];
  inner: {
    duration: { base: MnxNoteValueBase; dots?: number };
    multiple: number;
  };
  outer: {
    duration: { base: MnxNoteValueBase; dots?: number };
    multiple: number;
  };
  bracket?: 'yes' | 'no' | 'auto';
  showNumber?: 'noNumber' | 'inner' | 'both';
  showValue?: 'noNumber' | 'inner' | 'both';
  orient?: string;
  staff?: number;
}

export type MnxSequenceItem = MnxEvent | MnxGrace | MnxTremolo | MnxTuplet;

export function isGrace(item: MnxSequenceItem): item is MnxGrace {
  return (item as MnxGrace).type === 'grace';
}

export function isTremolo(item: MnxSequenceItem): item is MnxTremolo {
  return (item as MnxTremolo).type === 'tremolo';
}

export function isTuplet(item: MnxSequenceItem): item is MnxTuplet {
  return (item as MnxTuplet).type === 'tuplet';
}

/**
 * Runtime-tolerant classifier for sequence content. Schema-valid documents can
 * carry kinds the renderer doesn't model yet (tuplet, octave-shift, …) — the
 * layout pipeline degrades those to placeholder columns plus a per-measure
 * diagnostic instead of crashing the whole render.
 */
export function sequenceItemKind(
  item: MnxSequenceItem
): 'event' | 'grace' | 'tremolo' | 'tuplet' | 'unknown' {
  if ((item as MnxGrace).type === 'grace') return 'grace';
  if ((item as MnxTremolo).type === 'tremolo') return 'tremolo';
  if ((item as MnxTuplet).type === 'tuplet') return 'tuplet';
  // Anything carrying a duration spaces like an event — e.g. `space` items,
  // which are timed but draw nothing (no notes, no rest). Other un-timed
  // containers (octave-shift, …) are the kinds the model can't place yet.
  return (item as MnxEvent).duration ? 'event' : 'unknown';
}

/** Narrowing form of `sequenceItemKind(item) === 'event'`. */
export function isTimedEvent(item: MnxSequenceItem): item is MnxEvent {
  return sequenceItemKind(item) === 'event';
}

/** MNX `full-measure-rest`: an empty-content sequence resting the whole bar.
 *  Conventionally drawn as a whole rest centred in the measure, any meter. */
export interface MnxFullMeasureRest {
  visualDuration?: {
    base: MnxNoteValueBase;
    dots?: number;
  };
  /** Half-space offset from the middle staff line, positive = up. */
  staffPosition?: number;
}

export interface MnxSequence {
  content: MnxSequenceItem[];
  fullMeasure?: MnxFullMeasureRest;
  staff?: number;
  voice?: string;
}

/** A beam over `events`; nested `beams` are one level deeper (16th, 32nd, …).
 *  A nested beam with a single event is a hook ("partial beam"). */
export interface MnxBeam {
  events: string[];
  beams?: MnxBeam[];
  direction?: 'left' | 'right';
}

/** Standard dynamic values (MNX v19 `dynamic-value`, a closed enum). Extended
 *  marks (pppppp, sfz, fp, z, …) no longer fit here and travel in `glyphs`. */
export type MnxDynamicValue =
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'n';

/** A dynamic marking (MNX v19 `dynamic-group`) at a metric position. `type` is
 *  required. A plain dynamic carries a `value` (enum) and/or `glyphs` (explicit
 *  SMuFL names for marks outside the enum). `wedgeType`/`end` describe a hairpin
 *  (crescendo/diminuendo) — not yet rendered; see the renderer gap in
 *  roadmap/inprogress/SPEC_APPROVAL.md. */
export interface MnxDynamic {
  position: {
    fraction: [number, number];
  };
  type: 'immediate' | 'gradual' | 'relative' | 'accent';
  value?: MnxDynamicValue;
  /** Explicit SMuFL glyph names (MNX v19 `smufl-glyph-list`) — used for marks
   *  outside the `value` enum, e.g. ["dynamicSforzato"]. */
  glyphs?: string[];
  /** Hairpin direction; paired with `end`. Renderer gap: not drawn yet. */
  wedgeType?: 'increasing' | 'decreasing';
  end?: {
    fraction: [number, number];
  };
  relativeValue?: 'louder' | 'softer';
  attackValue?: MnxDynamicValue;
  prefix?: string;
  suffix?: string;
  orient?: 'above' | 'auto' | 'below' | 'between';
  staff?: number;
  voice?: string;
}

/** An octave-shift line (MNX `ottava`, part-measure `ottavas`): the notes from
 *  `position` in this measure through `end` (a measure id + metric position)
 *  sound `value` octaves off the written pitch — +1/+2/+3 = 8va/15ma/22ma above,
 *  −1/−2/−3 = below. `orient` overrides the above/below default. */
export interface MnxOttava {
  position: {
    fraction: [number, number];
  };
  end: {
    measure: string;
    position: {
      fraction: [number, number];
    };
  };
  value: 1 | 2 | 3 | -1 | -2 | -3;
  orient?: 'above' | 'below' | 'auto';
  staff?: number;
  voice?: string;
}

export interface MnxPartMeasure {
  beams?: MnxBeam[];
  dynamics?: MnxDynamic[];
  ottavas?: MnxOttava[];
  clefs?: {
    clef: {
      sign: string;
      staffPosition?: number;
      octave?: number;
    };
    /** Metric onset within the measure as a whole-note fraction
     *  [numerator, denominator]; absent = the start of the measure. */
    position?: {
      fraction: [number, number];
    };
    staff?: number;
  }[];
  sequences: MnxSequence[];
}

export interface MnxTuningEntry {
  /** Explicit string number — array order carries no meaning. */
  string: number;
  pitch: MnxPitch;
}

export interface MnxTabPartExtension {
  tuning?: MnxTuningEntry[];
  capo?: number;
  /** The part's preferred presentation; tab-ness is a view, not content. */
  staffKind?: 'notation' | 'tab' | 'both';
}

export interface MnxPart {
  // Optional per the MNX schema — `part` requires only `measures`.
  id?: string;
  name?: string;
  /** Staves this part is notated on (grand staff = 2); default 1. */
  staves?: number;
  measures: MnxPartMeasure[];
  _x?: {
    tab?: MnxTabPartExtension;
  };
}

export interface MnxGlobalMeasure {
  /** Referenced by scores (system starts, multimeasure-rest ranges). */
  id?: string;
  key?: {
    fifths: number;
  };
  time?: {
    count: number;
    unit: number;
    /** Render as a symbol instead of numerals: `common` = 𝄴 (C), `cut` = 𝄵 (¢). */
    display?: 'common' | 'cut';
  };
  barline?: {
    type?: 'regular' | 'dotted' | 'dashed' | 'heavy' | 'double' | 'final'
      | 'heavyLight' | 'heavyHeavy' | 'tick' | 'short' | 'noBarline';
  };
  /** Forward repeat at the start of this measure (`|:`). */
  repeatStart?: object;
  /** Backward repeat at the end of this measure (`:|`); times > 2 prints "Nx". */
  repeatEnd?: {
    times?: number;
  };
  /** Volta bracket starting here, spanning `duration` measures (default 1);
   *  `open` brackets have no closing hook. */
  ending?: {
    duration?: number;
    numbers?: number[];
    open?: boolean;
  };
  /** Segno sign at a metric position; `glyph` may pick a SMuFL variant. */
  segno?: {
    location: {
      fraction: [number, number];
    };
    glyph?: string;
  };
  /** "fine" marking at a metric position. */
  fine?: {
    location: {
      fraction: [number, number];
    };
  };
  /** Jump instruction — MNX v17 knows only D.S. (`segno`) and D.S. al Fine
   *  (`dsalfine`); there is no coda / D.C. vocabulary yet. */
  jump?: {
    type: 'segno' | 'dsalfine';
    location: {
      fraction: [number, number];
    };
  };
  /** Metronome marks ("note = bpm"), drawn above the start of the measure. */
  tempos?: {
    bpm: number;
    value: {
      base: MnxNoteValueBase;
      dots?: number;
    };
    location?: {
      fraction: [number, number];
    };
  }[];
}

/** One node of a layout's content tree: a staff drawing from part sources,
 *  or a (possibly bracketed) group of further nodes. A staff with multiple
 *  sources merges those parts onto one staff — chorded when no stems are
 *  given, voice-split when sources carry `stem` directions. */
export interface MnxLayoutContent {
  type: 'staff' | 'group';
  sources?: {
    part: string;
    staff?: number;
    stem?: 'up' | 'down';
    label?: string;
    labelref?: string;
  }[];
  content?: MnxLayoutContent[];
  /** Staff name shown left of the system. */
  label?: string;
  /** Pull the label from a part property (e.g. "name" / "shortName"). */
  labelref?: string;
  /** Group decoration: bracket/brace left of the group. */
  symbol?: 'bracket' | 'brace' | 'none';
  barlineStyle?: 'regular' | 'individual' | 'noBarline' | 'mensurstrich';
}

export interface MnxLayout {
  id: string;
  content: MnxLayoutContent[];
}

/** An MNX score: one presentation of the document (full score, single part…),
 *  with its own system breaks and multimeasure-rest collapsing. */
export interface MnxScore {
  name?: string;
  /** References a layout id; absent = all parts. */
  layout?: string;
  pages?: {
    systems?: {
      measure: string;
      layout?: string;
    }[];
  }[];
  multimeasureRests?: {
    /** Measure id where the collapsed range starts. */
    start: string;
    /** Number of measures collapsed into the H-bar. */
    duration: number;
    label?: string;
  }[];
}

export interface MnxStructure {
  mnx: {
    version: number;
    support?: {
      useAccidentalDisplay?: boolean;
      useBeams?: boolean;
    };
  };
  global: {
    measures: MnxGlobalMeasure[];
    /** Document-wide lyric line ordering and metadata (labels/languages). */
    lyrics?: {
      lineOrder?: string[];
      lineMetadata?: Record<string, {
        label?: string;
        lang?: string;
      }>;
    };
  };
  layouts?: MnxLayout[];
  scores?: MnxScore[];
  parts: MnxPart[];
}

export interface MnxDocument {
  id: string;
  name: string;
  lastUpdated: number;
  mnxJson: MnxStructure;
}
