export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

// ---- MNX Lab extensions v5 (`_x.mnxLab`) — see docs/mnx-extensions.md ----
//
// Everything this project carries that W3C MNX v19 cannot express lives under
// ONE vendor key, `mnxLab`. The `_x` sub-key names an agent/vendor/community
// (w3c-cg/mnx#429), not a feature — `_x.tab` (v2) squatted a generic token in a
// shared namespace, so another app writing `_x.tab` for something else would
// have made our own validator reject a legal document.
//
// v5 mirrors the adopted shape drafted in roadmap/proposed/instrument-position.md:
// `string`, `fret` and `fingering` sit FLAT on the vendor dict (peers of `pitch`,
// as they would be on `note`), the part declares `strings[]` + `capo` flat, and
// only `technique` (pending a general articulations proposal) and `staffKind`
// (upstream placement undecided) remain under the `tab` sub-namespace. The
// string is the authoritative choice; the fret derives from string + pitch, and
// a stored fret is validation-only. See roadmap/proposed/derived-positions.md.

/** One control point on a bend curve. */
export interface MnxBendPoint {
  /** Fraction of the note's own duration: 0 = onset, 1 = release. */
  position: number;
  /** Offset from the written pitch in SEMITONES (MNX `pitch.alter` units). */
  alter: number;
}

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
  /** Identified by touching pitch, not touching fret — that covers fretless
   *  instruments and between-fret nodes (w3c-cg/mnx#179). */
  harmonic?: {
    type: 'natural' | 'artificial' | 'pinch' | 'tap' | 'semi' | 'feedback';
    touchingPitch?: MnxPitch;
  };
  palmMute?: boolean;
}

/** note._x.mnxLab.tab — v5 keeps only `technique` here. */
export interface MnxTabNoteExtension {
  technique?: MnxTabTechnique;
}

export interface MnxFingering {
  hand: 'left' | 'right';
  finger: string;
}

/** The whole vendor dict at note._x.mnxLab. */
export interface MnxNoteExtension {
  /** Which string the note is played on — the performer's authoritative
   *  choice; 1 = highest-pitched string. The fret derives from this + pitch. */
  string?: number;
  /** Optional and NON-AUTHORITATIVE: rendering always derives the fret; a
   *  stored one only cross-checks it. 0 = open string, capo-relative. */
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

/** One chord symbol on the global timeline. Structured (so it transposes) and
 *  literal (so odd spellings survive) — the pattern the CG settled on for
 *  dynamics. No duration: a chord lasts until the next one. */
export interface MnxHarmony {
  location: { fraction: [number, number] };
  root?: MnxHarmonyStep;
  quality: MnxHarmonyQuality;
  bass?: MnxHarmonyStep;
  degrees?: { value: number; alter?: number; type: 'add' | 'alter' | 'subtract' }[];
  /** Display override; present only when the source's literal spelling differs
   *  from what a consumer would render from the structure. */
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

/** A textual or symbolic instruction at a point in a part's measure ("Play 8x",
 *  "let ring"). Shaped like `dynamic-group`: positioned, optionally scoped to a
 *  staff and voice, oriented above/below/between. Carries no typography — how a
 *  direction is set is the renderer's decision. Exactly one of `text`/`glyphs`.
 *  **Proposed, not adopted** — see roadmap/proposed/score-text.md. */
export interface MnxDirection {
  position: { fraction: [number, number] };
  text?: string;
  glyphs?: string[];
  orient?: 'above' | 'auto' | 'below' | 'between';
  staff?: number;
  voice?: string;
  color?: string;
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
    mnxLab?: MnxNoteExtension;
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

/** Standard dynamic values (MNX v27 `dynamic-value`, a closed enum). v24 widened
 *  the range by four (pppp…fffff) and v25 added the extremes (pppppp, ffffff),
 *  so the whole conventional ladder is now first-class. Marks still outside it
 *  (fp, fz, z, …) travel in `glyphs`, and sfz/rfz are expressed structurally as
 *  `type: 'accent'` with `accentPrefix`/`accentSuffix`. */
export type MnxDynamicValue =
  | 'pppppp'
  | 'ppppp'
  | 'pppp'
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'ffff'
  | 'fffff'
  | 'ffffff'
  | 'n';

/** A dynamic marking (MNX v24 `dynamic-group`) at a metric position. `type` is
 *  required. A plain dynamic carries a `value` (enum) and/or `glyphs` (explicit
 *  SMuFL names for marks outside the enum). `wedgeType`/`end` describe a hairpin
 *  (crescendo/diminuendo) — not yet rendered; see the renderer gap in
 *  roadmap/complete/SPEC_APPROVAL.md. */
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
  /** The dynamic held *after* the accent's attack — only valid for
   *  `type: 'accent'`. Replaced v19's `attackValue`, and the two are **not** a
   *  rename: the roles of `value` and this field swapped. An "fp" was
   *  `{attackValue: 'f', value: 'p'}` under v19 and is `{value: 'f',
   *  residualValue: 'p'}` under v24 — so a v19 document still validates while
   *  meaning the opposite dynamic. Anything reading `value` for an accent group
   *  must know which version produced it. */
  residualValue?: MnxDynamicValue;
  /** Accent prefix/suffix (v24): "sfz" is prefix `s` + value `f` + suffix `z`,
   *  "rfz" is prefix `r`. NOTE: the v24 schema's enums for these erroneously
   *  carry literal quote characters, so it rejects `s` and accepts `"s"` —
   *  see docs/mnx-spec-submodule.md. Typed here as the spec *intends*. */
  accentPrefix?: 's' | 'r' | '';
  accentSuffix?: 'z' | '';
  /** Points at the id of the immediately preceding dynamic group, hinting that
   *  the two should render as a single unit. */
  visuallyContinues?: string;
  /** For a hairpin angled across staves: the staff it ends on. */
  staffEnd?: number;
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
  /** Free-text/symbolic instructions for this part. **Proposed, not adopted** —
   *  see roadmap/proposed/score-text.md. */
  directions?: MnxDirection[];
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

/**
 * Standard guitar tuning, as an explicit declaration. NOT a default: since the
 * instrument-neutrality change (roadmap/proposed/derived-positions.md) an
 * absent `strings[]` means "no fingerboard declared" and tab views are
 * unavailable — no consumer silently assumes guitar. This constant exists for
 * the places that DECLARE standard tuning explicitly: the upgrade shim
 * materializing it into older tab documents, importers, presets, tests.
 */
export const STANDARD_GUITAR_STRINGS: readonly MnxTuningEntry[] = [
  { string: 1, pitch: { step: 'E', octave: 4 } },
  { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'E', octave: 2 } }
];

/** part._x.mnxLab.tab — v5 keeps only `staffKind` here. */
export interface MnxTabPartExtension {
  /** The part's preferred presentation; tab-ness is a view, not content. */
  staffKind?: 'notation' | 'tab' | 'both';
}

/** The whole vendor dict at part._x.mnxLab. */
export interface MnxPartExtension {
  /** Sounding pitch of each open string, before the capo. Named `strings`
   *  (not "tuning") because temperament work already claims that word
   *  (w3c-cg/mnx#365). Absent ⇒ standard guitar tuning. */
  strings?: MnxTuningEntry[];
  /** Shifts open-string pitches AND re-origins printed fret numbers. */
  capo?: number;
  tab?: MnxTabPartExtension;
}

export interface MnxPart {
  // Optional per the MNX schema — `part` requires only `measures`.
  id?: string;
  name?: string;
  /** Staves this part is notated on (grand staff = 2); default 1. */
  staves?: number;
  measures: MnxPartMeasure[];
  _x?: {
    mnxLab?: MnxPartExtension;
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
  /** A rehearsal mark: an arbitrary index into the score ("A", "12"). Score-wide,
   *  so it sits beside `segno`/`fine`/`jump` rather than in a part. **Proposed,
   *  not adopted** — validates against `schemas/mnx-schema.proposed.json` only.
   *  See roadmap/proposed/score-text.md. */
  rehearsal?: MnxMeasureLabel;
  /** The formal section beginning here ("Intro", "Verse 1"), extending until the
   *  next one. Separate from `rehearsal` because it states what the music *is*
   *  rather than indexing it. **Proposed, not adopted** — see `rehearsal`. */
  section?: MnxMeasureLabel;
  /** Vendor extensions. `harmonies` are chord symbols; standard MNX has no
   *  harmony concept at all. `_x` is declared in the schema's `global-attrs`.
   *  See docs/mnx-extensions.md. */
  _x?: {
    mnxLab?: {
      harmonies?: MnxHarmony[];
    };
  };
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
