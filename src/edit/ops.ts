// The edit seam — deliberately a placeholder (structure-lab). This is the
// point the editor UI and the AI loop are intended to CONVERGE on: today the
// assist loop replaces whole documents; the plan is for it to emit EditOp[]
// instead, and for editor chrome to funnel through applyOp, so undo/redo,
// validation and provenance all live in one place. Three ops prove the shape;
// grow the union as real editing features land.
import type {
  MnxBeam,
  MnxDynamic,
  MnxDynamicValue,
  MnxGlobalMeasure,
  MnxEvent,
  MnxGrace,
  MnxTremolo,
  MnxNote,
  MnxNoteValueBase,
  MnxPart,
  MnxPartMeasure,
  MnxSequence,
  MnxSequenceItem,
  MnxSlur,
  MnxStructure,
  MnxTuningEntry
} from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import type { PartialContainerSpec } from './setupGrammar.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { findNoteAddress, forEachNoteAddress } from '../model/noteWalk.ts';
import { enharmonicSpellings, keyFifthsAt, midiOfSpelling, spellPitch } from './staffSpace.ts';
import {
  addOnsets,
  durationSpan,
  forEachKeyedNote,
  itemSpan,
  onsetLess,
  onsetsEqual,
  type Onset
} from './cursor.ts';
import { capoOf, midiOfPitch, tuningOf } from './tabStrings.ts';

// Note addressing: every `noteId(s)` field accepts a note's real `id` OR its
// synthetic positional key (src/model/noteKeys.ts) — most spec mirrors carry
// no ids, and the cursor must be able to edit them too. Positional ops
// (insert/setDuration) address (measureIndex, onset-as-whole-note-fraction)
// in voice 0 of staff 1 — the entry surface phase 2 defines.
export type EditOp =
  | {
      /** Shift the selected notes (or every note) by a signed semitone count. */
      type: 'transposeSelection';
      semitones: number;
      noteIds?: string[];
    }
  | {
      /** Put one note on (string, fret): sets flat `_x.mnxLab.string`/`fret`
       *  AND the pitch the fingerboard place sounds — the fret is a choice,
       *  the pitch its consequence (string 1 = highest-pitched). */
      type: 'setFret';
      noteId: string;
      string: number;
      fret: number;
    }
  | {
      /** Insert a note at a metric position in voice 0 (an existing event
       *  there gains a chord member; a rest there becomes the note; empty
       *  space gains a new event of `duration`). Pitch derives from
       *  string+fret against the part's tuning. */
      type: 'insertNote';
      measureIndex: number;
      onset: [number, number];
      string: number;
      fret: number;
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Insert a note BY PITCH at a metric position in voice 0 — the
       *  notation projection's entry (spatial cursor + toggle; the
       *  selection-ladder navigation map). Same event/rest/insert mechanics
       *  as `insertNote`; a chord member on the same letter+octave is
       *  replaced (one staff position, one note). No string/fret is written
       *  — tab derives positions from pitch as usual. */
      type: 'insertPitchNote';
      measureIndex: number;
      onset: [number, number];
      pitch: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; alter?: number };
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Remove one note; a now-empty event becomes a rest of the same
       *  duration, so the measure's grid does not shift under the cursor. */
      type: 'deleteNote';
      noteId: string;
    }
  | {
      /** Re-value the voice-0 event at a metric position. */
      type: 'setDuration';
      measureIndex: number;
      onset: [number, number];
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Nudge the voice-0 rest at a metric position vertically —
       *  `rest.staffPosition`, in half-staff-spaces, +up. The §8.11
       *  polymorphic verb: Alt+↑↓ re-pitches a note, repositions a rest. */
      type: 'nudgeRest';
      measureIndex: number;
      onset: [number, number];
      delta: number;
    }
  | {
      /** Tie the note to the SAME pitch in the immediately following event
       *  (same voice, or the next measure's first event); toggles off if the
       *  note is already tied. Mints a deterministic id on the target when it
       *  has none — MNX ties point at note ids. */
      type: 'toggleTie';
      noteId: string;
    }
  | {
      /** Set the time signature on a global measure (persists until changed). */
      type: 'setTimeSignature';
      measureIndex: number;
      /** `display` is the GLYPH, not the meter: common time is 4/4 drawn as
       *  𝄴. The renderer already reads it (`spec/time-signature-glyphs`); it
       *  had no way in. */
      time: { count: number; unit: number; display?: 'common' | 'cut' };
    }
  | {
      /** Declare the part's string tuning (`_x.mnxLab.strings`). */
      type: 'setTuning';
      tuning: MnxTuningEntry[];
    }
  | {
      /** Declare the part's tab staff preference (`_x.mnxLab.tab.staffKind`).
       *  Presentation, but document-level: it gates the tab/both projections
       *  (engine/headless), so the goldens — and the construct-trace verdict
       *  — see it. Discovered by the element-ops exemplar. */
      type: 'setStaffKind';
      kind: 'notation' | 'tab' | 'both';
    }
  | {
      /** Append an empty measure to every part and the global timeline. */
      type: 'appendMeasure';
    }
  | {
      /** Add a part (id/name both optional — an anonymous part is legal
       *  MNX), materializing the document skeleton on demand: construct
       *  traces start from the literal `{}` and genesis is ops, not chrome
       *  (roadmap/complete/core-element-ops-exemplar.md). New part measures
       *  align with the global timeline. */
      type: 'addPart';
      partId?: string;
      name?: string;
    }
  | {
      /** Remove one measure column (the global measure + every part's) —
       *  refused while the bar holds any note, anywhere. The campaign's
       *  anti-cheat rule refined: a CONTAINER may be removed only once it is
       *  empty, so removal never destroys ink implicitly; the bar's own
       *  attributes (time signature, barline) go with their container. */
      type: 'removeMeasure';
      measureIndex: number;
    }
  | {
      /** Remove parts[0] (the entry surface — item 13 owns the rest) —
       *  refused while the part holds any note. Its declarations (name,
       *  tuning, staffKind) go with their container: no tombstones. */
      type: 'removePart';
    }
  // The inherited-attribute pair (campaign item 5,
  // roadmap/inprogress/core-element-ops-clef-key.md). Clef is a PART-measure
  // attribute, key signature a GLOBAL-measure one — the same rung addressing
  // two different owners — and both persist until changed, so removing one
  // reverts the measure to its predecessor's governance rather than to
  // nothing.
  | {
      /** Declare the clef governing this measure onward (parts[0], staff 1). */
      type: 'setClef';
      measureIndex: number;
      sign: string;
      staffPosition?: number;
      octave?: number;
    }
  | {
      /** Drop this measure's clef DECLARATION — the staff keeps drawing a
       *  clef, the predecessor's (or the engine default, which for a
       *  tab-bearing part is the guitar treble-8). Deletes an emptied
       *  `clefs` array with it: no tombstones. */
      type: 'removeClef';
      measureIndex: number;
      /** Which part's clef (campaign item 13b); default the first. */
      partIndex?: number;
      /** Which staff's clef (13c); default the first. */
      staffIndex?: number;
      /** A MID-MEASURE clef is addressed by its onset (spec/clef-changes);
       *  absent means the one governing from the bar's start. */
      onset?: [number, number];
    }
  | {
      /** Declare the key signature governing this measure onward. */
      type: 'setKeySignature';
      measureIndex: number;
      fifths: number;
    }
  | {
      /** Drop this measure's key DECLARATION; the predecessor governs, or C. */
      type: 'removeKeySignature';
      measureIndex: number;
    }
  | {
      /** Drop this measure's time DECLARATION — the third inherited attribute,
       *  and the one that governs the FULL-BAR INVARIANT: the bars it ruled now
       *  answer to the predecessor's meter (or 4/4), so they are re-padded.
       *  Refused when that would leave a bar overfull, since re-padding pops
       *  only rests and shortening a meter under real ink would silently make
       *  an invalid bar (`timeSignatureRemovalFits`). */
      type: 'removeTimeSignature';
      measureIndex: number;
    }
  // The bar-attribute family (campaign item 7,
  // roadmap/inprogress/core-element-ops-bar-attributes.md). Ten kinds that are
  // all one thing — a key on the GLOBAL measure — so they share one verb with
  // a typed payload rather than restating the same shape ten times.
  // Spanners (campaign item 10,
  // roadmap/inprogress/core-element-ops-spanners.md). A slur is ONE object
  // holding both ends: it lives on the start event and names the end EVENT's
  // id, pinning chord members when either end is a chord.
  | {
      /** Slur from one note to another; both are note keys, and the op
       *  resolves them to their events (minting an id on the target when it
       *  has none, as `toggleTie` does for notes). */
      type: 'setSlur';
      fromNoteKey: string;
      toNoteKey: string;
      side?: 'up' | 'down';
    }
  | {
      /** Drop the slur starting at this note — the *reference* removal class,
       *  and the whole object goes, so both ends leave together. With chord
       *  pins the note disambiguates which slur; without them an event carries
       *  at most one. */
      type: 'removeSlur';
      noteKey: string;
    }
  | {
      /** Re-type an existing tie (`crossVoice`, `arpeggio`, `crossJump`) or
       *  make a target-less `lv` tie. `toggleTie` remains the removal half. */
      type: 'setTieVariant';
      noteId: string;
      targetType?: 'nextNote' | 'crossVoice' | 'arpeggio' | 'crossJump';
      lv?: boolean;
    }
  // Lyrics (campaign item 12, roadmap/inprogress/core-element-ops-lyrics.md).
  // A syllable is a key on the EVENT's lyric line; the line's metadata is a
  // key on the document. Two owners, so two pairs — item 7's test.
  | { type: 'setSyllable'; noteKey: string; line: string; text: string; syllableType?: 'start' | 'middle' | 'end' | 'whole' }
  | { type: 'removeSyllable'; noteKey: string; line: string }
  | { type: 'setLyricLine'; line: string; label?: string; lang?: string }
  | { type: 'removeLyricLine'; line: string }
  // Tab technique + fingering (campaign item 9,
  // roadmap/inprogress/core-element-ops-technique.md). Both live under the
  // note's vendor block; technique is the ENTRY side of
  // roadmap/proposed/core-guitar-technique.md, which owns the drawing.
  | { type: 'setTechnique'; noteKey: string; technique: TechniqueChoice }
  | { type: 'removeTechnique'; noteKey: string; kind: TechniqueChoice['kind'] }
  | {
      /** Strip a note's string choice — and its `fret` with it, because the
       *  fret is the CONSEQUENCE of the choice (the model's own rule: string
       *  authoritative, fret validation-only). The note falls back to the
       *  derivation ladder, which is what "no instrument is ever assumed"
       *  means from the other direction. */
      type: 'removeStringAnnotation';
      noteKey: string;
    }
  | { type: 'setFingering'; noteKey: string; hand: 'left' | 'right'; finger: string }
  | { type: 'removeFingering'; noteKey: string }
  // Part declarations (campaign item 13,
  // roadmap/inprogress/core-element-ops-part-declarations.md): five keys on
  // parts[0] that shipped with constructors and no removals. One pair, because
  // they share an owner — item 7's test, third application.
  // The document's presentation layer (campaign item 13b's remainder): a
  // LAYOUT is a tree of staff/group nodes, a SCORE a presentation with its own
  // system breaks. Neither is a declaration, so neither gets a typed grammar
  // here — removal lands now, authoring waits for a surface that can express a
  // tree without pretending a one-line grammar is one.
  | {
      /** Remove a CONTAINER (tuplet, grace, tremolo, space) from a sequence.
       *
       * The campaign's container rule, third application: **removable only
       * once it holds no ink**. Unwrapping — keeping the notes and dropping the
       * grouping — is the tempting reading and it is refused, because it
       * RE-TIMES the music: three eighths written in the time of two become
       * three plain eighths, and the bar overfills. An editor may not reshape
       * time as a side effect of removing a bracket, which is the same rule
       * that refused a time-signature removal that would have reshaped bars.
       */
      type: 'removeContainer';
      measureIndex: number;
      sequenceIndex: number;
      eventIndex: number;
      partIndex?: number;
    }
  // Percussion and the note's accidental display — the tail of kinds that had
  // no verb at all (campaign item 2's board, finally emptied).
  | { type: 'removeKitNote'; noteKey: string }
  | { type: 'removeKitComponent'; partIndex: number; component: string }
  | { type: 'removeSound'; sound: string }
  | {
      /** Force or hide the accidental, and optionally enclose it: the
       *  cautionary form is `show` plus parentheses — one decision in two
       *  fields, because that is how the schema has it. */
      type: 'setAccidentalDisplay';
      noteKey: string;
      show: boolean;
      parenthesized?: boolean;
    }
  | { type: 'removeAccidentalDisplay'; noteKey: string }
  | { type: 'removeLayout'; index: number }
  | { type: 'removeScore'; index: number }
  | { type: 'removeMultimeasureRest'; scoreIndex: number; index: number }
  | { type: 'setPartDeclaration'; declaration: PartDeclaration }
  | {
      type: 'removePartDeclaration';
      kind: PartDeclarationKind;
      /** Which part's declaration (campaign item 13b); default the first. */
      partIndex?: number;
    }
  // Event adornments (campaign item 8,
  // roadmap/inprogress/core-element-ops-adornments.md). TWO pairs, because the
  // owners differ: a marking is a key on the EVENT, while dynamics and
  // directions are positioned entries in PART-MEASURE arrays. Item 7's family
  // test (do they share an owner?) is what splits them.
  | {
      /** One event marking. `attributes` carries the few that are not bare
       *  flags — a breath's symbol, a bow's direction — because the marking
       *  IS its object and an empty one would be a different mark. */
      type: 'setMarking';
      noteKey: string;
      marking: string;
      attributes?: Record<string, string>;
    }
  | { type: 'removeMarking'; noteKey: string; marking: string }
  | {
      /** A dynamic or direction at a metric position in the part measure. */
      type: 'setPositioned';
      measureIndex: number;
      onset: [number, number];
      attribute: PositionedAttribute;
    }
  | {
      type: 'removePositioned';
      measureIndex: number;
      kind: PositionedAttribute['kind'];
      index: number;
    }
  // Rhythm declarations (campaign item 11,
  // roadmap/inprogress/core-element-ops-rhythm-declarations.md) — the ones
  // that leave ink where it is. The containers that SWALLOW ink (tuplet,
  // grace, tremolo) wait for the grid to descend into them.
  | {
      /**
       * Beam a run of events, addressed by CONTENT INDEX and minting the ids
       * the beam will reference.
       *
       * It used to take ids, which the session computed against a throwaway
       * copy so that only `apply` mutated the document — and the minting went
       * with the copy, so beaming id-less events (any document the keyboard
       * built) wrote a beam naming ids that existed nowhere. Found by the
       * first traced beam (campaign item 3's queue). Minting is a document
       * change, so it belongs here, with the write that needs it.
       *
       * Top level only: nested beams are a rendering subdivision with their
       * own gesture to come.
       */
      type: 'setBeam';
      measureIndex: number;
      /** Inclusive content indices of the run; un-timed items are skipped. */
      from: number;
      to: number;
      partIndex?: number;
    }
  | {
      /** Un-beam: the *reference* removal class again — a grouping goes, no
       *  ink moves. An emptied `beams` array goes with its last member.
       *  `path` is the index chain, so a SECONDARY level (a 16th subdivision, a
       *  hook) is addressable as itself: [0] is the first top-level beam, [0,1]
       *  its second nested one. */
      type: 'removeBeam';
      measureIndex: number;
      path: number[];
      partIndex?: number;
    }
  | {
      /**
       * Wrap a run of sequence content in a container — tuplet, grace or
       * tremolo. ONE verb for three kinds, by item 7's family test: they share
       * an owner (a run of one sequence's content) and differ only in the
       * declaration wrapped around it.
       *
       * The mirror of the removal rule, and worth stating because it looks
       * like a contradiction: *removing* a container may not re-time the music
       * (which is why unwrapping is refused), but *wrapping* is an act ON time
       * that was explicitly asked for. Three eighths becoming a triplet
       * shortens the bar, and that is the request, not a side effect — the
       * renderer's bar-duration diagnostic is what tells the author.
       *
       * Addressed by content INDICES, not event ids: wrapping moves items
       * rather than referencing them, so minting ids (as `setBeam` must) would
       * write names the document never asked for.
       */
      type: 'wrapInContainer';
      measureIndex: number;
      sequenceIndex: number;
      /** Inclusive content indices — the run that becomes the container. */
      from: number;
      to: number;
      spec: ContainerSpec;
      partIndex?: number;
    }
  | {
      /**
       * Write the same sound a different way: the next enharmonic spelling,
       * cycling back round. The SOUND is fixed (the MIDI number never moves),
       * so a tab fret and every reference survive — only the letter, the
       * accidental and therefore the staff position change.
       *
       * Cycling rather than choosing, because "the other spelling" has no
       * single answer: C♯ is also D♭ and B♯♯. `spellPitch` picks for the
       * editor; this is how a player overrules it.
       */
      type: 'respellNote';
      noteId: string;
    }
  | {
      /**
       * Respell a run of rests as ONE rest of the given value.
       *
       * The finding this closes said rest durations were "a consequence of
       * padding, not a choice", and that fixing `padMeasureRests` to write one
       * half rest instead of two quarters broke the cursor — because the grid's
       * positions ARE the rest events, so coarse rests delete places to aim.
       * Both facts survive if spelling is a **verb** rather than a policy: the
       * padding keeps writing beat rests (the grid stays fine), and an author
       * who wants the engraver's spelling says so, after the fact.
       *
       * Refused unless the run sums EXACTLY to the value asked for — respelling
       * may not change how long the bar is silent.
       */
      type: 'setRestSpelling';
      measureIndex: number;
      onset: [number, number];
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Insert authored silence. NOT a wrap: a `space` holds no events, so it
       *  shares the containers' shape (a non-event item in content) and none of
       *  their act. Its duration is a rhythmic FRACTION, as the schema has it. */
      type: 'insertSpace';
      measureIndex: number;
      sequenceIndex: number;
      /** Content index to insert before. */
      index: number;
      duration: [number, number];
      partIndex?: number;
    }
  | {
      /** Declare the bar's rest (`sequence.fullMeasure`). Refused on a bar
       *  holding ink: a declaration ABOUT an empty bar must not delete notes
       *  to make room — that is the coarse-op cheating the campaign forbids. */
      type: 'setFullMeasureRest';
      measureIndex: number;
      /** How the rest is drawn when it differs from the meter — a 3/4 bar
       *  rests with a WHOLE rest by convention (`spec/full-measure-rests`). */
      visualDuration?: { base: MnxNoteValueBase; dots?: number };
    }
  | { type: 'removeFullMeasureRest'; measureIndex: number }
  | {
      /** Declare this bar a repeat of the previous `number` bars. */
      type: 'setMeasureRepeat';
      measureIndex: number;
      number: number;
      /** How many times, drawn above or below — `spec/measure-repeats-with-counters`
       *  numbers each repeated bar, and the count is authored, not derived. */
      counter?: { count: number; orient?: 'above' | 'below' };
    }
  | { type: 'removeMeasureRepeat'; measureIndex: number }
  | {
      type: 'setMeasureAttribute';
      measureIndex: number;
      attribute: MeasureAttribute;
    }
  | {
      /** Strip the attribute: the *annotation* removal class, so the key goes
       *  entirely (an emptied `tempos` array with it — no tombstones).
       *  `barline` is the exception the class taxonomy already covers: it is a
       *  MODIFIER, so removing it returns the bar to the default stroke rather
       *  than removing ink. `index` picks one entry of an array-valued
       *  attribute (`tempos`); absent means the first. */
      type: 'removeMeasureAttribute';
      measureIndex: number;
      kind: MeasureAttributeKind;
      index?: number;
    };

/** What a technique key writes. `hammerOn`/`pullOff`/`slide` name the note they
 *  travel to; the rest are flags or curves. */
export type TechniqueChoice =
  /** A bend's shape: straight up by `semitones`, or — with `release` — bent
   *  before the note sounds, held, and let back down
   *  (`lab/tab-techniques/bend-and-release`, the second half of its name). */
  | { kind: 'bend'; semitones?: number; release?: boolean }
  | { kind: 'slide' }
  | { kind: 'hammerOn' }
  | { kind: 'pullOff' }
  | { kind: 'vibrato' }
  | { kind: 'palmMute' }
  | { kind: 'harmonic' };

/** The part's own declarations. `name`/`strings`/`staffKind` keep their
 *  existing setters (`addPart`, `setTuning`, `setStaffKind`) — rewriting them
 *  would disturb recorded traces for no gain — so only the two that never had
 *  one are constructible here. */
/** What a wrap declares. The document shapes, minus the content they hold —
 *  so a spec plus a run is exactly one container object. */
export type ContainerSpec =
  | {
      type: 'tuplet';
      inner: { duration: { base: MnxNoteValueBase; dots?: number }; multiple: number };
      outer: { duration: { base: MnxNoteValueBase; dots?: number }; multiple: number };
      bracket?: 'yes' | 'no' | 'auto';
      showNumber?: 'noNumber' | 'inner' | 'both';
    }
  | { type: 'grace'; graceType?: MnxGrace['graceType']; slash?: boolean }
  | { type: 'tremolo'; marks?: number; outer?: MnxTremolo['outer'] };

export type PartDeclaration = { kind: 'capo'; value: number } | { kind: 'staves'; value: number };

export type PartDeclarationKind = 'name' | 'staves' | 'strings' | 'capo' | 'staffKind';

/** The part-measure adornments: positioned entries sharing an owner, a shape
 *  and a removal — which is why they share a verb. */
export type PositionedAttribute =
  | {
      kind: 'dynamic';
      value?: MnxDynamicValue;
      glyphs?: string[];
      /** A dynamic is not always a letter at a point: MNX types it, and the
       *  corpus uses three of the four (`lab/dynamics/hairpin-and-relative`).
       *  Same object, same owner, so the same verb carries them — item 7's
       *  family test, rather than a hairpin verb and a relative verb. */
      dynamicType?: 'immediate' | 'gradual' | 'relative' | 'accent';
      wedgeType?: 'increasing' | 'decreasing';
      relativeValue?: 'louder' | 'softer';
    }
  | {
      /** `orient` is the side of the staff the words sit on — `above` is the
       *  default a renderer assumes, `below` and `between` are choices the
       *  document has to carry (`lab/score-text/directions-stacked`). */
      kind: 'direction';
      text: string;
      orient?: 'above' | 'below' | 'between';
    }
  /** An octave-shift line: same owner and shape as the other two, so it shares
   *  their verb — item 7's family test, applied once more. `bars` is how many
   *  bars it spans (1 = this one), the same shape item 7 gave a volta's
   *  duration, and the stand-in for a press-navigate-press range gesture. */
  | { kind: 'ottava'; value: 1 | 2 | 3 | -1 | -2 | -3; bars?: number };

/** The ten bar attributes, each carrying exactly what its MNX object needs. */
export type MeasureAttribute =
  | { kind: 'barline'; type: NonNullable<NonNullable<MnxGlobalMeasure['barline']>['type']> }
  | { kind: 'repeatStart' }
  | { kind: 'repeatEnd'; times?: number }
  | { kind: 'ending'; numbers?: number[]; duration?: number; open?: boolean }
  | { kind: 'segno'; at?: 'start' | 'end' }
  | { kind: 'fine'; at?: 'start' | 'end' }
  | { kind: 'jump'; type: 'segno' | 'dsalfine'; at?: 'start' | 'end' }
  | { kind: 'tempo'; bpm: number; base: MnxNoteValueBase }
  | { kind: 'rehearsal'; label: string }
  | { kind: 'section'; label: string };

export type MeasureAttributeKind = MeasureAttribute['kind'];

/** Where each attribute lives on the global measure. `tempo` is the only
 *  array, which is why removal takes an index. */
export const MEASURE_ATTRIBUTE_FIELDS: Record<MeasureAttributeKind, string> = {
  barline: 'barline',
  repeatStart: 'repeatStart',
  repeatEnd: 'repeatEnd',
  ending: 'ending',
  segno: 'segno',
  fine: 'fine',
  jump: 'jump',
  tempo: 'tempos',
  rehearsal: 'rehearsal',
  section: 'section'
};

/** The measure-start position these three carry (mid-bar placement is item
 *  11's onset-addressing work — see the scope boundary). */
const MEASURE_START = { fraction: [0, 1] as [number, number] };

/** Where in the bar a navigation mark sits: `[0, 1]` at the start, `[1, 1]`
 *  at the end (a whole bar's worth in). */
function locationOf(at: 'start' | 'end' | undefined, fallback: 'start' | 'end') {
  return (at ?? fallback) === 'end' ? { fraction: [1, 1] as [number, number] } : MEASURE_START;
}

function measureAttributeValue(attribute: MeasureAttribute): unknown {
  switch (attribute.kind) {
    case 'barline':
      return { type: attribute.type };
    case 'repeatStart':
      return {};
    case 'repeatEnd':
      return attribute.times !== undefined ? { times: attribute.times } : {};
    case 'ending':
      return {
        ...(attribute.numbers ? { numbers: attribute.numbers } : {}),
        ...(attribute.duration !== undefined ? { duration: attribute.duration } : {}),
        ...(attribute.open ? { open: true } : {})
      };
    // The navigation marks are the one family whose POSITION IN THE BAR is
    // part of what they mean: a segno marks the point you return TO (the bar's
    // start), while a jump and a fine are read after the bar has been played
    // (its end). The corpus is not unanimous — `lab/score-text/labels-with-navigation`
    // puts its fine at the start — so the position is offered rather than
    // assumed: `at` says which, and each kind keeps the default it had.
    case 'segno':
      return { location: locationOf(attribute.at, 'start') };
    case 'fine':
      return { location: locationOf(attribute.at, 'start') };
    case 'jump':
      return { type: attribute.type, location: locationOf(attribute.at, 'end') };
    case 'tempo':
      return { bpm: attribute.bpm, value: { base: attribute.base } };
    case 'rehearsal':
    case 'section':
      return { label: attribute.label };
  }
}

function midiOf(note: MnxNote): number {
  const { step, octave, alter = 0 } = note.pitch;
  return midiOfSpelling(step as 'C', octave, alter);
}

function setPitchFromMidi(note: MnxNote, midi: number, fifths = 0, direction: 1 | -1 = 1): void {
  // The policy lives in staffSpace.ts, with the key context it needs (campaign
  // item 6). This used to prefer a natural then a sharp, which made E♭
  // unwritable: transposing E down produced D♯, in every key.
  note.pitch = spellPitch(midi, fifths, direction);
}


/** Pure: returns a new document with the op applied; never mutates `doc`. */
export function applyOp(doc: MnxStructure, op: EditOp): MnxStructure {
  const next = JSON.parse(JSON.stringify(doc)) as MnxStructure;
  switch (op.type) {
    case 'transposeSelection': {
      // Spelling reads the key of the bar the note is IN and the direction of
      // the move (campaign item 6) — both are context the old MIDI→pitch
      // conversion threw away.
      const direction: 1 | -1 = op.semitones < 0 ? -1 : 1;
      if (!op.noteIds || op.noteIds.length === 0) {
        (next.parts ?? []).forEach(part =>
          (part.measures ?? []).forEach((measure, measureIndex) => {
            const fifths = keyFifthsAt(next, measureIndex);
            (measure.sequences ?? []).forEach(seq =>
              (seq.content ?? []).forEach(item => {
                if (!isTimedEvent(item)) return;
                (item.notes ?? []).forEach(note =>
                  setPitchFromMidi(note, midiOf(note) + op.semitones, fifths, direction)
                );
              })
            );
          })
        );
        return next;
      }
      forEachNoteAddress(next, address => {
        if (!op.noteIds!.includes(address.key)) return;
        setPitchFromMidi(
          address.note,
          midiOf(address.note) + op.semitones,
          keyFifthsAt(next, address.measureIndex),
          direction
        );
      });
      return next;
    }
    case 'setFret': {
      const midi = fingerboardMidi(next, op.string, op.fret);
      forEachKeyedNote(next, (note, key) => {
        if (key !== op.noteId) return;
        const x = ((note._x ??= {}).mnxLab ??= {});
        x.string = op.string;
        x.fret = op.fret;
        if (midi !== undefined) setPitchFromMidi(note, midi);
      });
      return next;
    }
    case 'insertNote': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const midi = fingerboardMidi(next, op.string, op.fret);
      if (midi === undefined) return next;
      const note: MnxNote = { pitch: { step: 'C', octave: 4 } };
      setPitchFromMidi(note, midi);
      note._x = { mnxLab: { string: op.string, fret: op.fret } };

      const target: Onset = { num: op.onset[0], den: op.onset[1] };
      const found = eventAtOnset(seq, target);
      if (found?.event) {
        const event = found.event;
        if (event.rest) {
          // A rest is absence, so entry does not inherit its duration: the
          // note takes the PENDING one, and any surplus stays as rest AFTER
          // it (never by shortening in place, which would drag every later
          // event earlier). Campaign item 11b — before this, the second note
          // of a short run always came out as long as the rest it landed on.
          // Longer than the rest it lands on? Eat the FOLLOWING rests to make
          // room — a dotted quarter over beat-rest padding is the ordinary
          // case (campaign item 4), and clamping it to the rest's own value
          // would be exactly the silent clamp this codebase refuses. Ink is
          // never consumed: if a note stands in the way, the entry refuses.
          const eaten = restsCovering(seq, found.index, durationSpan(op.duration));
          if (eaten === null) return next;
          const surplus = subtractOnsets(eaten.span, durationSpan(op.duration));
          seq.content.splice(found.index + 1, eaten.count - 1);
          delete event.rest;
          event.notes = [note];
          event.duration = { ...op.duration };
          if (surplus.num > 0) seq.content.splice(found.index + 1, 0, ...restsSpanning(surplus));
          return next;
        }
        event.notes ??= [];
        // One string, one note: re-entering an occupied string replaces it.
        const existing = event.notes.findIndex(
          n => n._x?.mnxLab?.string === op.string
        );
        if (existing >= 0) event.notes.splice(existing, 1, note);
        else event.notes.push(note);
        return next;
      }
      if (found) {
        seq.content.splice(pastGraceContainers(seq, found.index), 0, {
          duration: { ...op.duration },
          notes: [note]
        });
        // The §8.11 invariant: a touched measure always has content for its
        // full metric duration, so unentered positions are already rests.
        padMeasureRests(next, op.measureIndex);
      }
      return next;
    }
    case 'insertPitchNote': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const note: MnxNote = { pitch: { ...op.pitch } };
      const target: Onset = { num: op.onset[0], den: op.onset[1] };
      const found = eventAtOnset(seq, target);
      if (found?.event) {
        const event = found.event;
        if (event.rest) {
          // Same rule as `insertNote` above (campaign item 11b): a rest is
          // absence, so the note takes the PENDING duration and the surplus
          // stays as rest after it.
          // Longer than the rest it lands on? Eat the FOLLOWING rests to make
          // room — a dotted quarter over beat-rest padding is the ordinary
          // case (campaign item 4), and clamping it to the rest's own value
          // would be exactly the silent clamp this codebase refuses. Ink is
          // never consumed: if a note stands in the way, the entry refuses.
          const eaten = restsCovering(seq, found.index, durationSpan(op.duration));
          if (eaten === null) return next;
          const surplus = subtractOnsets(eaten.span, durationSpan(op.duration));
          seq.content.splice(found.index + 1, eaten.count - 1);
          delete event.rest;
          event.notes = [note];
          event.duration = { ...op.duration };
          if (surplus.num > 0) seq.content.splice(found.index + 1, 0, ...restsSpanning(surplus));
          return next;
        }
        event.notes ??= [];
        // One staff position, one note: same letter+octave replaces.
        const existing = event.notes.findIndex(
          n => n.pitch.step === op.pitch.step && n.pitch.octave === op.pitch.octave
        );
        if (existing >= 0) event.notes.splice(existing, 1, note);
        else event.notes.push(note);
        return next;
      }
      if (found) {
        seq.content.splice(pastGraceContainers(seq, found.index), 0, {
          duration: { ...op.duration },
          notes: [note]
        });
        padMeasureRests(next, op.measureIndex);
      }
      return next;
    }
    case 'deleteNote': {
      let removedNoteId: string | undefined;
      let emptiedEventId: string | undefined;
      let emptied: MnxEvent | undefined;
      forEachEventNote(next, (event, note, key) => {
        if (key !== op.noteId) return;
        removedNoteId = note.id;
        event.notes!.splice(event.notes!.indexOf(note), 1);
        if (event.notes!.length === 0) {
          delete event.notes;
          event.rest = {};
          emptied = event;
          emptiedEventId = event.id;
        }
      });
      // The *reference* removal class: unlink BOTH ends. Nothing may be left
      // pointing at what just went — and an emptied event keeps its id, so a
      // beam over it would not dangle, it would beam a rest.
      if (emptied?.slurs) delete emptied.slurs;
      if (removedNoteId || emptiedEventId) unlinkReferences(next, removedNoteId, emptiedEventId);
      return next;
    }
    case 'setClef': {
      const measure = next.parts?.[0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      const clef = {
        clef: {
          sign: op.sign,
          ...(op.staffPosition !== undefined ? { staffPosition: op.staffPosition } : {}),
          ...(op.octave ? { octave: op.octave } : {})
        }
      };
      // One declaration per measure on the entry surface: overwrite the
      // staff-1 measure-start clef rather than stacking a second.
      const existing = (measure.clefs ?? []).findIndex(
        entry => (entry.staff ?? 1) === 1 && entry.position === undefined
      );
      if (existing >= 0) measure.clefs![existing] = clef;
      else measure.clefs = [...(measure.clefs ?? []), clef];
      return next;
    }
    case 'removeClef': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      const clefs = measure?.clefs;
      if (!measure || !clefs) return next;
      const staff = op.staffIndex ?? 1;
      const sameOnset = (entry: { position?: { fraction: [number, number] } }): boolean => {
        if (!op.onset) return entry.position === undefined;
        if (!entry.position) return false;
        const [n, d] = entry.position.fraction;
        return n * op.onset[1] === op.onset[0] * d;
      };
      const kept = clefs.filter(entry => !((entry.staff ?? 1) === staff && sameOnset(entry)));
      if (kept.length === clefs.length) return next;
      // No tombstone: an emptied array goes with its last member.
      if (kept.length > 0) measure.clefs = kept;
      else delete measure.clefs;
      return next;
    }
    case 'setKeySignature': {
      const measure = next.global?.measures?.[op.measureIndex];
      if (!measure) return next;
      measure.key = { fifths: op.fifths };
      return next;
    }
    case 'removeKeySignature': {
      const measure = next.global?.measures?.[op.measureIndex];
      if (!measure?.key) return next;
      delete measure.key;
      return next;
    }
    case 'setMeasureAttribute': {
      const measure = next.global?.measures?.[op.measureIndex] as
        | Record<string, unknown>
        | undefined;
      if (!measure) return next;
      const field = MEASURE_ATTRIBUTE_FIELDS[op.attribute.kind];
      const value = measureAttributeValue(op.attribute);
      // `tempos` is an array of marks; everything else is a single object.
      if (field === 'tempos') measure.tempos = [value];
      else measure[field] = value;
      return next;
    }
    case 'removeMeasureAttribute': {
      const measure = next.global?.measures?.[op.measureIndex] as
        | Record<string, unknown>
        | undefined;
      if (!measure) return next;
      const field = MEASURE_ATTRIBUTE_FIELDS[op.kind];
      if (field === 'tempos') {
        const tempos = (measure.tempos as unknown[] | undefined) ?? [];
        const kept = tempos.filter((_, i) => i !== (op.index ?? 0));
        // No tombstone: an emptied array goes with its last member.
        if (kept.length > 0) measure.tempos = kept;
        else delete measure.tempos;
        return next;
      }
      delete measure[field];
      return next;
    }
    case 'setDuration': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (found?.event) {
        found.event.duration = { ...op.duration };
        // Shrinking opens a gap at the end (later events slide earlier) —
        // pad it; growing eats trailing rests instead.
        padMeasureRests(next, op.measureIndex);
      }
      return next;
    }
    case 'nudgeRest': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (found?.event?.rest) {
        const position = (found.event.rest.staffPosition ?? 0) + op.delta;
        found.event.rest = { ...found.event.rest, staffPosition: position };
      }
      return next;
    }
    case 'toggleTie': {
      const located = findKeyedNote(next, op.noteId);
      if (!located) return next;
      const { note } = located;
      if (note.ties && note.ties.length > 0) {
        delete note.ties;
        return next;
      }
      const target = tieTarget(next, located);
      if (!target) return next;
      target.id ??= mintNoteId(next);
      note.ties = [{ target: target.id }];
      return next;
    }
    case 'setSlur': {
      const from = findKeyedNote(next, op.fromNoteKey);
      const to = findKeyedNote(next, op.toNoteKey);
      if (!from || !to || from === to) return next;
      const fromEvent = from.event;
      const toEvent = to.event;
      if (fromEvent === toEvent) return next;
      toEvent.id ??= mintEventId(next);
      // Pins name chord members; a single-note event needs none, which is how
      // the corpus writes them (spec/slurs vs slurs-targeting-specific-notes).
      const pinned = (fromEvent.notes?.length ?? 0) > 1 || (toEvent.notes?.length ?? 0) > 1;
      if (pinned) {
        from.note.id ??= mintNoteId(next);
        to.note.id ??= mintNoteId(next);
      }
      const slur: MnxSlur = { target: toEvent.id };
      if (op.side) slur.side = op.side;
      if (pinned) {
        slur.startNote = from.note.id;
        slur.endNote = to.note.id;
      }
      fromEvent.slurs = [...(fromEvent.slurs ?? []), slur];
      return next;
    }
    case 'removeSlur': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const event = located.event;
      if (!event.slurs?.length) return next;
      const kept = event.slurs.filter(slur => !slurStartsAt(slur, event, located.note));
      if (kept.length === event.slurs.length) return next;
      // No tombstone: an emptied array goes with its last member.
      if (kept.length > 0) event.slurs = kept;
      else delete event.slurs;
      return next;
    }
    case 'setTieVariant': {
      const located = findKeyedNote(next, op.noteId);
      if (!located) return next;
      const { note } = located;
      if (op.lv) {
        // An `lv` tie has no target at all — the one-ended member of the family.
        note.ties = [{ lv: true }];
        return next;
      }
      const existing = note.ties?.[0];
      if (!existing) return next;
      if (op.targetType) existing.targetType = op.targetType;
      return next;
    }
    case 'setSyllable': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const event = located.event;
      const lines = ((event.lyrics ??= {}).lines ??= {});
      lines[op.line] = {
        text: op.text,
        ...(op.syllableType ? { type: op.syllableType } : {})
      };
      return next;
    }
    case 'removeSyllable': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const event = located.event;
      const lines = event.lyrics?.lines;
      if (!lines?.[op.line]) return next;
      delete lines[op.line];
      // No tombstones: the emptied line map and its wrapper go too.
      if (Object.keys(lines).length === 0) delete event.lyrics;
      return next;
    }
    case 'setLyricLine': {
      const lyrics = ((next.global as { lyrics?: MnxStructure['global']['lyrics'] }).lyrics ??= {});
      const metadata = (lyrics.lineMetadata ??= {});
      metadata[op.line] = {
        ...(op.label !== undefined ? { label: op.label } : {}),
        ...(op.lang !== undefined ? { lang: op.lang } : {})
      };
      return next;
    }
    case 'removeLyricLine': {
      const lyrics = next.global?.lyrics;
      if (!lyrics?.lineMetadata?.[op.line]) return next;
      delete lyrics.lineMetadata[op.line];
      // `lineOrder` is NOT touched: it is a separate declaration about the same
      // line (where it sits), not part of the label. The sweep caught the first
      // version reordering the verses as a side effect of renaming one.
      if (Object.keys(lyrics.lineMetadata).length === 0) delete lyrics.lineMetadata;
      if (Object.keys(lyrics).length === 0) delete next.global.lyrics;
      return next;
    }
    case 'setTechnique': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const tab = ((((located.note._x ??= {}).mnxLab ??= {}).tab ??= {}) as {
        technique?: Record<string, unknown>;
      });
      const technique = (tab.technique ??= {});
      switch (op.technique.kind) {
        case 'bend':
          // A bend is a CURVE (points in semitones), never a single interval —
          // the shape core-guitar-technique.md settled. The keyboard writes the
          // common one: straight up by a tone over the note's length.
          {
            const alter = op.technique.semitones ?? 2;
            technique.bend = {
              points: op.technique.release
                ? [
                    { position: 0, alter },
                    { position: 0.5, alter },
                    { position: 1, alter: 0 }
                  ]
                : [
                    { position: 0, alter: 0 },
                    { position: 1, alter }
                  ]
            };
          }
          break;
        case 'vibrato':
        case 'palmMute':
          technique[op.technique.kind] = true;
          break;
        case 'harmonic':
          technique.harmonic = { type: 'natural' };
          break;
        default: {
          // hammerOn / pullOff / slide travel to the following note, so they
          // mint its id the way `toggleTie` does.
          const target = tieTarget(next, located);
          if (!target) return next;
          target.id ??= mintNoteId(next);
          technique[op.technique.kind] =
            op.technique.kind === 'slide'
              ? { type: 'legato', target: target.id }
              : { target: target.id };
        }
      }
      return next;
    }
    case 'removeTechnique': {
      const located = findKeyedNote(next, op.noteKey);
      const tab = located?.note._x?.mnxLab?.tab as { technique?: Record<string, unknown> } | undefined;
      if (!located || !tab?.technique?.[op.kind]) return next;
      delete tab.technique[op.kind];
      // No tombstones, all the way up the vendor chain.
      if (Object.keys(tab.technique).length === 0) delete tab.technique;
      if (Object.keys(tab).length === 0) delete located.note._x!.mnxLab!.tab;
      if (Object.keys(located.note._x!.mnxLab!).length === 0) delete located.note._x!.mnxLab;
      if (Object.keys(located.note._x!).length === 0) delete located.note._x;
      return next;
    }
    case 'removeStringAnnotation': {
      const located = findKeyedNote(next, op.noteKey);
      const x = located?.note._x?.mnxLab;
      if (!located || !x || x.string === undefined) return next;
      delete x.string;
      delete x.fret; // the consequence leaves with the choice
      if (Object.keys(x).length === 0) delete located.note._x!.mnxLab;
      if (Object.keys(located.note._x!).length === 0) delete located.note._x;
      return next;
    }
    case 'setFingering': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      ((located.note._x ??= {}).mnxLab ??= {}).fingering = { hand: op.hand, finger: op.finger };
      return next;
    }
    case 'removeFingering': {
      const located = findKeyedNote(next, op.noteKey);
      const x = located?.note._x?.mnxLab;
      if (!located || !x?.fingering) return next;
      delete x.fingering;
      if (Object.keys(x).length === 0) delete located.note._x!.mnxLab;
      if (Object.keys(located.note._x!).length === 0) delete located.note._x;
      return next;
    }
    case 'removeContainer': {
      const seq = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex]?.sequences?.[
        op.sequenceIndex
      ];
      const item = seq?.content?.[op.eventIndex] as { type?: string; content?: MnxEvent[] } | undefined;
      if (!seq || !item?.type) return next;
      // Ink first: a container goes only when it holds none.
      const holdsInk = (item.content ?? []).some(event => (event.notes?.length ?? 0) > 0);
      if (holdsInk) return next;

      seq.content = seq.content.filter((_, i) => i !== op.eventIndex);
      // Pad THIS sequence, not the entry one: a container can live in any
      // voice, and `padMeasureRests` only fills voice 0 — which is how the
      // first version left voice 2 three beats long in a 4/4 bar.
      const { span } = meterOf(next, op.measureIndex);
      const remainder = subtractOnsets(span, voiceFill(seq));
      if (remainder.num > 0) seq.content.push(...restsSpanning(remainder));
      return next;
    }
    case 'removeKitNote': {
      // Kit notes are addressed like notes but live in `kitNotes`; the walk
      // keys them positionally, so the key carries the event's coordinates.
      const match = /^@(?:p(\d+)\.)?m(\d+)\.v(\d+)\.e(\d+)\.k(\d+)$/.exec(op.noteKey);
      if (!match) return next;
      const [, part, measure, voice, event, kit] = match;
      const seqs = (next.parts?.[Number(part || 0)]?.measures?.[Number(measure)]?.sequences ?? [])
        .filter(s2 => (s2.staff ?? 1) === 1);
      const item = seqs[Number(voice)]?.content?.[Number(event)] as
        | { kitNotes?: unknown[] }
        | undefined;
      if (!item?.kitNotes?.[Number(kit)]) return next;
      const kept = item.kitNotes.filter((_, i) => i !== Number(kit));
      if (kept.length > 0) item.kitNotes = kept;
      else delete item.kitNotes;
      return next;
    }
    case 'removeKitComponent': {
      const part = next.parts?.[op.partIndex] as { kit?: Record<string, unknown> } | undefined;
      if (!part?.kit?.[op.component]) return next;
      // A component is what its notes are made of: removable only once nothing
      // plays it. The same guard containers get, for the same reason — the
      // alternative is orphaning ink.
      const played = (part as unknown as { measures?: { sequences?: { content?: unknown[] }[] }[] })
        .measures?.some(measure =>
          (measure.sequences ?? []).some(seq =>
            (seq.content ?? []).some(item =>
              ((item as { kitNotes?: { kitComponent?: string }[] }).kitNotes ?? []).some(
                kitNote => kitNote.kitComponent === op.component
              )
            )
          )
        );
      if (played) return next;
      delete part.kit[op.component];
      if (Object.keys(part.kit).length === 0) delete part.kit;
      return next;
    }
    case 'removeSound': {
      const global = next.global as unknown as { sounds?: Record<string, unknown> };
      if (!global.sounds?.[op.sound]) return next;
      // Likewise: a sound a kit component names is still in use.
      const used = (next.parts ?? []).some(part =>
        Object.values((part as unknown as { kit?: Record<string, { sound?: string }> }).kit ?? {}).some(
          component => component?.sound === op.sound
        )
      );
      if (used) return next;
      delete global.sounds[op.sound];
      if (Object.keys(global.sounds).length === 0) delete global.sounds;
      return next;
    }
    case 'setAccidentalDisplay': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      located.note.accidentalDisplay = {
        show: op.show,
        ...(op.parenthesized ? { enclosure: { symbol: 'parentheses' as const } } : {})
      };
      return next;
    }
    case 'removeAccidentalDisplay': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located?.note.accidentalDisplay) return next;
      // The *annotation* class: the note keeps its pitch, and the renderer
      // goes back to deciding whether an accidental is needed.
      delete located.note.accidentalDisplay;
      return next;
    }
    case 'removeLayout': {
      const layouts = next.layouts;
      if (!layouts?.[op.index]) return next;
      const id = layouts[op.index].id;
      const kept = layouts.filter((_, i) => i !== op.index);
      if (kept.length > 0) next.layouts = kept;
      else delete next.layouts;
      // The *reference* class: a score naming a layout that no longer exists
      // would dangle, and the field is optional — so unlinking means "all
      // parts", which is what a score with no layout has always meant.
      for (const score of next.scores ?? []) {
        if (score.layout === id) delete score.layout;
        for (const page of score.pages ?? [])
          for (const system of page.systems ?? []) if (system.layout === id) delete system.layout;
      }
      return next;
    }
    case 'removeScore': {
      const scores = next.scores;
      if (!scores?.[op.index]) return next;
      const kept = scores.filter((_, i) => i !== op.index);
      if (kept.length > 0) next.scores = kept;
      else delete next.scores;
      return next;
    }
    case 'removeMultimeasureRest': {
      const score = next.scores?.[op.scoreIndex];
      const rests = score?.multimeasureRests;
      if (!score || !rests?.[op.index]) return next;
      const kept = rests.filter((_, i) => i !== op.index);
      if (kept.length > 0) score.multimeasureRests = kept;
      else delete score.multimeasureRests;
      return next;
    }
    case 'setPartDeclaration': {
      const part = next.parts?.[0];
      if (!part) return next;
      if (op.declaration.kind === 'staves') part.staves = op.declaration.value;
      else ((part._x ??= {}).mnxLab ??= {}).capo = op.declaration.value;
      return next;
    }
    case 'removePartDeclaration': {
      const part = next.parts?.[op.partIndex ?? 0];
      if (!part) return next;
      if (op.kind === 'name') delete part.name;
      else if (op.kind === 'staves') delete part.staves;
      else {
        const x = part._x?.mnxLab;
        if (!x) return next;
        if (op.kind === 'strings') {
          delete x.strings;
          // DECLARED CASCADE: a tab view without a fingerboard is not a view,
          // it is a diagnostic. The fingerboard and the preference to show it
          // are one decision, so they leave together — but only when the
          // preference actually asks for tab (`notation` survives fine).
          if (x.tab?.staffKind === 'tab' || x.tab?.staffKind === 'both') {
            delete x.tab.staffKind;
            if (Object.keys(x.tab).length === 0) delete x.tab;
          }
        }
        else if (op.kind === 'capo') delete x.capo;
        else if (x.tab) {
          delete x.tab.staffKind;
          if (Object.keys(x.tab).length === 0) delete x.tab;
        }
        // No tombstones: emptied vendor containers go with their last key.
        if (Object.keys(x).length === 0) delete part._x!.mnxLab;
        if (part._x && Object.keys(part._x).length === 0) delete part._x;
      }
      return next;
    }
    case 'setMarking': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const event = located.event;
      ((event.markings ??= {}) as Record<string, unknown>)[op.marking] = { ...(op.attributes ?? {}) };
      return next;
    }
    case 'removeMarking': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const event = located.event;
      const markings = event.markings as Record<string, unknown> | undefined;
      if (!markings || markings[op.marking] === undefined) return next;
      delete markings[op.marking];
      // No tombstone: an emptied container goes with its last member.
      if (Object.keys(markings).length === 0) delete event.markings;
      return next;
    }
    case 'setPositioned': {
      const measure = next.parts?.[0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      const position = { fraction: [op.onset[0], op.onset[1]] as [number, number] };
      if (op.attribute.kind === 'ottava') {
        // `end` is required by the schema. A typed span stands in for the
        // press-navigate-press range gesture that spanners have and positioned
        // attributes do not yet — the same stand-in item 7 gave volta duration.
        // The end names a bar (this one, or `bars` on), and a keyboard-built
        // document has unnamed bars
        // — so mint here, exactly as `setBeam` mints the event ids it will
        // reference. A reference verb that refuses because its target has no
        // name is a verb that only works on documents somebody else wrote.
        const span = Math.max(1, Math.trunc(op.attribute.bars ?? 1));
        const endIndex = Math.min(
          op.measureIndex + span - 1,
          (next.global?.measures?.length ?? 1) - 1
        );
        const endMeasure = next.global?.measures?.[endIndex];
        if (!endMeasure) return next;
        endMeasure.id ??= mintMeasureId(next);
        const measureId = endMeasure.id;
        measure.ottavas = [
          ...(measure.ottavas ?? []),
          { position, value: op.attribute.value, end: { measure: measureId, position } }
        ];
        return next;
      }
      if (op.attribute.kind === 'dynamic') {
        const entry: MnxDynamic = { position, type: op.attribute.dynamicType ?? 'immediate' };
        if (op.attribute.value) entry.value = op.attribute.value;
        if (op.attribute.glyphs) entry.glyphs = op.attribute.glyphs;
        if (op.attribute.wedgeType) entry.wedgeType = op.attribute.wedgeType;
        if (op.attribute.relativeValue) entry.relativeValue = op.attribute.relativeValue;
        measure.dynamics = [...(measure.dynamics ?? []), entry];
      } else {
        measure.directions = [
          ...(measure.directions ?? []),
          {
            position,
            text: op.attribute.text,
            ...(op.attribute.orient ? { orient: op.attribute.orient } : {})
          }
        ];
      }
      return next;
    }
    case 'removePositioned': {
      const measure = next.parts?.[0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      const record = measure as unknown as Record<string, unknown[] | undefined>;
      const field =
        op.kind === 'dynamic' ? 'dynamics' : op.kind === 'ottava' ? 'ottavas' : 'directions';
      const list = record[field];
      if (!list?.[op.index]) return next;
      const kept = list.filter((_, i) => i !== op.index);
      if (kept.length > 0) record[field] = kept;
      else delete record[field];
      return next;
    }
    case 'setBeam': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      const seq = measure?.sequences?.find(sequence => (sequence.staff ?? 1) === 1);
      if (!measure || !seq) return next;
      const [start, end] = op.from <= op.to ? [op.from, op.to] : [op.to, op.from];
      const events: string[] = [];
      for (let i = start; i <= end && i < seq.content.length; i++) {
        const item = seq.content[i];
        // A grace container is not beamed with its neighbours (the spec's own
        // `beams-inner-grace-notes` says so in a comment), and a rest breaks a
        // beam — both are skipped rather than refused.
        if (!isTimedEvent(item) || (item.notes?.length ?? 0) === 0) continue;
        item.id ??= mintEventId(next);
        events.push(item.id);
      }
      if (events.length < 2) return next;
      measure.beams = [...(measure.beams ?? []), { events }];
      return next;
    }
    case 'removeBeam': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      if (!measure?.beams || op.path.length === 0) return next;
      // Walk to the parent of the beam named by the path, then splice.
      let owner: { beams?: MnxBeam[] } = measure;
      for (const step of op.path.slice(0, -1)) {
        const child = owner.beams?.[step];
        if (!child) return next;
        owner = child;
      }
      const index = op.path[op.path.length - 1];
      if (!owner.beams?.[index]) return next;
      const kept = owner.beams.filter((_, i) => i !== index);
      if (kept.length > 0) owner.beams = kept;
      else delete owner.beams; // no tombstone
      return next;
    }
    case 'wrapInContainer': {
      const seq =
        next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex]?.sequences?.[op.sequenceIndex];
      if (!seq) return next;
      const [start, end] = op.from <= op.to ? [op.from, op.to] : [op.to, op.from];
      const run = seq.content.slice(start, end + 1);
      if (run.length === 0) return next;
      // Only plain events wrap. A container inside a container is a shape the
      // renderer does not model (it would draw blank columns), so this refuses
      // rather than produce ink nobody can read — the guarded-removal habit,
      // pointed forward.
      if (!run.every(item => isTimedEvent(item))) return next;
      const events = run as MnxEvent[];
      if (op.spec.type === 'tremolo' && events.length !== 2) return next;
      seq.content = [
        ...seq.content.slice(0, start),
        buildContainer(op.spec, events),
        ...seq.content.slice(end + 1)
      ];
      // A wrap re-times the bar on purpose, and §8.11's invariant still holds:
      // a touched measure has content for its full metric duration. Padding
      // only fires where the bar came up SHORT (a triplet gives back an
      // eighth), and is a no-op when the wrap restores an exactly-full bar —
      // which is why re-wrapping a corpus container still reproduces it byte
      // for byte.
      padMeasureRests(next, op.measureIndex);
      return next;
    }
    case 'respellNote': {
      const located = findKeyedNote(next, op.noteId);
      if (!located) return next;
      const spellings = enharmonicSpellings(midiOf(located.note));
      const current = spellings.findIndex(
        p =>
          p.step === located.note.pitch.step &&
          p.octave === located.note.pitch.octave &&
          (p.alter ?? 0) === (located.note.pitch.alter ?? 0)
      );
      // A spelling outside the cycle (a triple flat, say) enters it at the
      // front rather than refusing — the verb's job is to offer a way out.
      const spelled = spellings[(current + 1) % spellings.length];
      if (!spelled) return next;
      located.note.pitch = { ...spelled };
      return next;
    }
    case 'setRestSpelling': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (!found?.event?.rest) return next;
      const want = durationSpan(op.duration);
      let span: Onset = { num: 0, den: 1 };
      let end = found.index - 1;
      for (let i = found.index; i < seq.content.length; i++) {
        const item = seq.content[i];
        if (!isTimedEvent(item) || !item.rest) break;
        span = addOnsets(span, itemSpan(item));
        end = i;
        if (!onsetLess(span, want)) break;
      }
      if (!onsetsEqual(span, want)) return next; // no run of rests sums to it
      seq.content.splice(found.index, end - found.index + 1, {
        duration: { ...op.duration },
        rest: {}
      });
      return next;
    }
    case 'insertSpace': {
      const seq =
        next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex]?.sequences?.[op.sequenceIndex];
      if (!seq) return next;
      const [num, den] = op.duration;
      if (!Number.isInteger(num) || !Number.isInteger(den) || num < 1 || den < 1) return next;
      const index = Math.min(Math.max(op.index, 0), seq.content.length);
      const space = { type: 'space', duration: [num, den] } as unknown as MnxSequenceItem;
      // The invariant is the BAR, not the insertion. Landing in rests, the
      // space consumes them — silence for silence, so a full bar stays full
      // (a rest is absence; authored silence is the author saying the absence
      // is deliberate). Landing anywhere else it simply goes in, which is what
      // fills a SHORT bar — the case a space usually exists for.
      const eaten = restsCovering(seq, index, { num, den });
      if (eaten === null) {
        seq.content = [...seq.content.slice(0, index), space, ...seq.content.slice(index)];
        return next;
      }
      const surplus = subtractOnsets(eaten.span, { num, den });
      seq.content = [
        ...seq.content.slice(0, index),
        space,
        ...restsSpanning(surplus),
        ...seq.content.slice(index + eaten.count)
      ];
      return next;
    }
    case 'setFullMeasureRest': {
      const measure = next.parts?.[0]?.measures?.[op.measureIndex];
      const seq = measure?.sequences?.[0];
      if (!seq) return next;
      // Refuse rather than clear: see the op's comment.
      if (seq.content.some(item => isTimedEvent(item) && (item.notes?.length ?? 0) > 0)) return next;
      seq.content = [];
      seq.fullMeasure = op.visualDuration ? { visualDuration: { ...op.visualDuration } } : {};
      return next;
    }
    case 'removeFullMeasureRest': {
      const seq = next.parts?.[0]?.measures?.[op.measureIndex]?.sequences?.[0];
      if (!seq?.fullMeasure) return next;
      delete seq.fullMeasure;
      padMeasureRests(next, op.measureIndex);
      return next;
    }
    case 'setMeasureRepeat': {
      const measure = next.parts?.[0]?.measures?.[op.measureIndex] as
        | (MnxPartMeasure & { measureRepeat?: unknown })
        | undefined;
      if (!measure) return next;
      measure.measureRepeat = {
        number: op.number,
        ...(op.counter
          ? {
              counter: {
                count: op.counter.count,
                ...(op.counter.orient ? { orient: op.counter.orient } : {})
              }
            }
          : {})
      };
      // A repeated bar restates the previous one, so its own content is empty
      // — the same "declaration about the bar" rule `setFullMeasureRest`
      // follows, and what the spec's own examples hold.
      const seq = measure.sequences?.[0];
      if (seq && !seq.content.some(item => isTimedEvent(item) && (item.notes?.length ?? 0) > 0))
        seq.content = [];
      return next;
    }
    case 'removeMeasureRepeat': {
      const measure = next.parts?.[0]?.measures?.[op.measureIndex] as
        | (MnxPartMeasure & { measureRepeat?: { number: number } })
        | undefined;
      if (!measure?.measureRepeat) return next;
      delete measure.measureRepeat;
      return next;
    }
    case 'setTimeSignature': {
      const measure = next.global?.measures?.[op.measureIndex];
      if (!measure) return next;
      measure.time = { ...op.time };
      // The signature persists until the next explicit one — re-establish the
      // full-bar invariant for every measure it now governs.
      for (let i = op.measureIndex; i < next.global.measures.length; i++) {
        if (i > op.measureIndex && next.global.measures[i].time) break;
        padMeasureRests(next, i);
      }
      return next;
    }
    case 'removeTimeSignature': {
      const measure = next.global?.measures?.[op.measureIndex];
      if (!measure?.time) return next;
      // A pure un-declaration (the session guards it with
      // `timeSignatureRemovalFits`), so the bars keep their fill and there is
      // nothing to re-pad — the removal touches one key and nothing else.
      delete measure.time;
      return next;
    }
    case 'setTuning': {
      const part = next.parts?.[0];
      if (!part) return next;
      const x = ((part._x ??= {}).mnxLab ??= {});
      x.strings = op.tuning.map(t => ({ string: t.string, pitch: { ...t.pitch } }));
      return next;
    }
    case 'setStaffKind': {
      const part = next.parts?.[0];
      if (!part) return next;
      const x = ((part._x ??= {}).mnxLab ??= {});
      (x.tab ??= {}).staffKind = op.kind;
      return next;
    }
    case 'appendMeasure': {
      ensureSkeleton(next);
      next.global.measures.push({});
      for (const part of next.parts ?? []) {
        part.measures?.push({ sequences: [{ content: [] }] });
      }
      // New bars arrive pre-filled with beat rests (§8.11: unentered
      // positions ARE rests; the cursor walks them, digits convert them).
      padMeasureRests(next, next.global.measures.length - 1);
      return next;
    }
    case 'addPart': {
      ensureSkeleton(next);
      const part: MnxPart = {
        ...(op.partId !== undefined ? { id: op.partId } : {}),
        ...(op.name !== undefined ? { name: op.name } : {}),
        measures: next.global.measures.map(() => ({ sequences: [{ content: [] }] }))
      };
      next.parts.push(part);
      // Only the entry surface (parts[0]) holds the full-bar invariant.
      if (next.parts.length === 1) {
        for (let i = 0; i < next.global.measures.length; i++) padMeasureRests(next, i);
      }
      return next;
    }
    case 'removeMeasure': {
      if (!next.global?.measures?.[op.measureIndex]) return next;
      if (measureHasInk(next, op.measureIndex)) return next;
      next.global.measures.splice(op.measureIndex, 1);
      for (const part of next.parts ?? []) part.measures?.splice(op.measureIndex, 1);
      return dissolveIfHollow(next);
    }
    case 'removePart': {
      const part = next.parts?.[0];
      if (!part || partHasInk(part)) return next;
      next.parts.shift();
      return dissolveIfHollow(next);
    }
  }
}

/** Any note in any part's copy of this bar? (Rests are absence, not ink.) */
export function measureHasInk(doc: MnxStructure, measureIndex: number): boolean {
  for (const part of doc.parts ?? []) {
    for (const seq of part.measures?.[measureIndex]?.sequences ?? []) {
      for (const item of seq.content ?? []) {
        if (isTimedEvent(item) && (item.notes?.length ?? 0) > 0) return true;
      }
    }
  }
  return false;
}

/** Any note anywhere in the part? */
export function partHasInk(part: MnxPart): boolean {
  for (const measure of part.measures ?? []) {
    for (const seq of measure.sequences ?? []) {
      for (const item of seq.content ?? []) {
        if (isTimedEvent(item) && (item.notes?.length ?? 0) > 0) return true;
      }
    }
  }
  return false;
}

/** The skeleton follows the content in BOTH directions: ensureSkeleton
 *  materializes it on demand, and a doc left with no parts and no measures
 *  dissolves back to the literal `{}` — the construct start, so the
 *  construct/destruct round trip closes without tombstones. */
function dissolveIfHollow(doc: MnxStructure): MnxStructure {
  const hollow = (doc.parts?.length ?? 0) === 0 && (doc.global?.measures?.length ?? 0) === 0;
  return hollow ? ({} as MnxStructure) : doc;
}

/** Genesis: materialize the document skeleton — `{}` is a legal starting
 *  document (construct traces begin there), so the ops that can run on it
 *  create `mnx`/`global`/`parts` on demand, the same `??=` posture
 *  entrySequence takes one level down. */
function ensureSkeleton(doc: MnxStructure): void {
  const d = doc as Partial<MnxStructure>;
  d.mnx ??= { version: 1 };
  d.global ??= { measures: [] };
  d.global.measures ??= [];
  d.parts ??= [];
}

/** Beat-value bases by time-signature unit (and the greedy pad ladder). */
const BASE_BY_UNIT: Record<number, MnxNoteValueBase> = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
  16: '16th',
  32: '32nd',
  64: '64th'
};

const PAD_LADDER: { base: MnxNoteValueBase; span: Onset }[] = (
  [
    ['whole', 1, 1],
    ['half', 1, 2],
    ['quarter', 1, 4],
    ['eighth', 1, 8],
    ['16th', 1, 16],
    ['32nd', 1, 32],
    ['64th', 1, 64]
  ] as [MnxNoteValueBase, number, number][]
).map(([base, num, den]) => ({ base, span: { num, den } }));

/** The meter governing a measure: metric span + the beat value for padding.
 *  MNX time signatures persist until changed; 4/4 before the first one. */
function meterOf(doc: MnxStructure, measureIndex: number): { span: Onset; beatBase: MnxNoteValueBase } {
  let time = { count: 4, unit: 4 };
  const measures = doc.global?.measures ?? [];
  for (let i = 0; i <= measureIndex && i < measures.length; i++) {
    const t = measures[i].time;
    if (t) time = t;
  }
  return {
    span: { num: time.count, den: time.unit },
    beatBase: BASE_BY_UNIT[time.unit] ?? 'quarter'
  };
}

function voiceFill(seq: MnxSequence): Onset {
  let onset: Onset = { num: 0, den: 1 };
  for (const item of seq.content) onset = addOnsets(onset, itemSpan(item));
  return onset;
}

function subtractOnsets(a: Onset, b: Onset): Onset {
  return addOnsets(a, { num: -b.num, den: b.den });
}

/**
 * The §8.11 full-bar invariant for a touched measure: voice 0 always sums to
 * the measure's metric span. Underfull → append beat rests (then smaller
 * values for any tail); overfull → consume trailing RESTS only (real notes
 * are never deleted — a still-overfull bar stays overfull and the renderer's
 * duration-mismatch badge says so).
 */
/** Decompose a span into legal rest events, longest first — the same ladder
 *  `padMeasureRests` uses, factored out so entry can fill a gap IN PLACE. */
/**
 * The run of rests starting at `index` that covers `want`, and how much time
 * they hold. Null when ink (or the end of the bar) gets in the way first —
 * entry may lengthen silence, never overwrite music.
 */
/** Where a new event goes at a content index: AFTER any grace container
 *  sitting there. A grace is un-timed and belongs to the note it precedes
 *  (it steals that note's time), so entering at its onset must put the new
 *  note on the far side of it — otherwise every note entered after a grace
 *  lands in front of it and the grace walks to the end of the bar. */
function pastGraceContainers(seq: MnxSequence, index: number): number {
  let at = index;
  while (at < seq.content.length && (seq.content[at] as { type?: string }).type === 'grace') at++;
  return at;
}

function restsCovering(
  seq: MnxSequence,
  index: number,
  want: Onset
): { count: number; span: Onset } | null {
  let span: Onset = { num: 0, den: 1 };
  for (let i = index; i < seq.content.length; i++) {
    const item = seq.content[i];
    if (!isTimedEvent(item) || !item.rest) break;
    span = addOnsets(span, itemSpan(item));
    if (!onsetLess(span, want)) return { count: i - index + 1, span };
  }
  return null;
}

function restsSpanning(span: Onset): MnxEvent[] {
  const rests: MnxEvent[] = [];
  let remainder = span;
  while (remainder.num > 0) {
    const fit = PAD_LADDER.find(l => !onsetLess(remainder, l.span));
    if (!fit) break; // a sliver finer than the ladder: the badge shows it
    rests.push({ duration: { base: fit.base }, rest: {} });
    remainder = subtractOnsets(remainder, fit.span);
  }
  return rests;
}

function padMeasureRests(doc: MnxStructure, measureIndex: number): void {
  const seq = entrySequence(doc, measureIndex);
  if (!seq || seq.fullMeasure) return; // a full-measure rest is already full
  const { span, beatBase } = meterOf(doc, measureIndex);
  const beat = PAD_LADDER.find(l => l.base === beatBase)?.span ?? { num: 1, den: 4 };

  // Overfull: pop trailing rests while they help.
  while (onsetLess(span, voiceFill(seq))) {
    const last = seq.content[seq.content.length - 1];
    if (!last || !isTimedEvent(last) || !last.rest) break;
    seq.content.pop();
  }

  // Underfull: beat rests first, then the greedy tail.
  let remainder = subtractOnsets(span, voiceFill(seq));
  while (!onsetLess(remainder, beat) && remainder.num > 0) {
    seq.content.push({ duration: { base: beatBase }, rest: {} });
    remainder = subtractOnsets(remainder, beat);
  }
  while (remainder.num > 0) {
    const fit = PAD_LADDER.find(l => !onsetLess(remainder, l.span));
    if (!fit) break; // a sliver finer than the ladder: leave it (badge shows it)
    seq.content.push({ duration: { base: fit.base }, rest: {} });
    remainder = subtractOnsets(remainder, fit.span);
  }
}

interface LocatedNote {
  seq: MnxSequence;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  /** The event that OWNS the note. Carried rather than re-derived from
   *  `seq.content[eventIndex]`, because a container sits at that index and its
   *  inner events do not (campaign item 11b). */
  event: MnxEvent;
  note: MnxNote;
}

function findKeyedNote(doc: MnxStructure, key: string): LocatedNote | null {
  const address = findNoteAddress(doc, key);
  if (!address) return null;
  return {
    seq: address.sequence,
    measureIndex: address.measureIndex,
    voiceIndex: address.voiceIndex,
    eventIndex: address.eventIndex,
    event: address.event,
    note: address.note
  };
}

function samePitch(a: MnxNote, b: MnxNote): boolean {
  return (
    a.pitch.step === b.pitch.step &&
    a.pitch.octave === b.pitch.octave &&
    (a.pitch.alter ?? 0) === (b.pitch.alter ?? 0)
  );
}

/** The same pitch in the immediately following timed event — this voice's
 *  next event, else the next measure's same-voice first event. */
function tieTarget(doc: MnxStructure, located: LocatedNote): MnxNote | undefined {
  for (let i = located.eventIndex + 1; i < located.seq.content.length; i++) {
    const item = located.seq.content[i];
    if (!isTimedEvent(item)) continue;
    return (item.notes ?? []).find(n => samePitch(n, located.note));
  }
  const nextMeasure = doc.parts?.[0]?.measures?.[located.measureIndex + 1];
  const seq = (nextMeasure?.sequences ?? []).filter(s => (s.staff ?? 1) === 1)[located.voiceIndex];
  for (const item of seq?.content ?? []) {
    if (!isTimedEvent(item)) continue;
    return (item.notes ?? []).find(n => samePitch(n, located.note));
  }
  return undefined;
}

/** A fresh deterministic note id: t1, t2, … skipping anything taken. */
/** The index of the beam whose run STARTS at this note's event, or -1. The
 *  toggle asks before applying, so a no-op never reaches the op queue. */
/**
 * The beam starting at this note's event — **deepest first**, so pressing the
 * beam key peels one subdivision at a time from the inside out: the 32nd level,
 * then the 16th, then the primary. Removing the outer level while a secondary
 * still hung off it would delete a grouping the player can see and did not aim
 * at (campaign item 11's nested-beam gap).
 */
export function beamStartingAt(
  doc: MnxStructure,
  noteKey: string
): { measureIndex: number; path: number[]; partIndex: number } | null {
  const located = findKeyedNote(doc, noteKey);
  if (!located?.event.id) return null;
  const eventId = located.event.id;
  const partIndex = findNoteAddress(doc, noteKey)?.partIndex ?? 0;
  const beams = doc.parts?.[partIndex]?.measures?.[located.measureIndex]?.beams ?? [];

  let best: number[] | null = null;
  const visit = (list: MnxBeam[], prefix: number[]) => {
    list.forEach((beam, index) => {
      const path = [...prefix, index];
      if (beam.events?.[0] === eventId && (best === null || path.length > best.length)) best = path;
      visit(beam.beams ?? [], path);
    });
  };
  visit(beams, []);
  return best === null ? null : { measureIndex: located.measureIndex, path: best, partIndex };
}

/** The event ids of the run from one note's event to another's, minting ids as
 *  it goes — a beam names events, so the run must be nameable. Both ends must
 *  live in the same measure and voice; returns null when they do not. */
/** A spec plus its content, as the document writes it. Optional fields are
 *  omitted rather than defaulted, so a plain `grace` is `{type, content}` —
 *  what `spec/grace-note` actually holds. */
function buildContainer(spec: ContainerSpec, content: MnxEvent[]): MnxSequenceItem {
  if (spec.type === 'tuplet')
    return {
      type: 'tuplet',
      inner: spec.inner,
      outer: spec.outer,
      ...(spec.bracket ? { bracket: spec.bracket } : {}),
      ...(spec.showNumber ? { showNumber: spec.showNumber } : {}),
      content
    } as MnxSequenceItem;
  if (spec.type === 'grace')
    return {
      type: 'grace',
      ...(spec.graceType ? { graceType: spec.graceType } : {}),
      ...(spec.slash === undefined ? {} : { slash: spec.slash }),
      content
    } as MnxSequenceItem;
  return {
    type: 'tremolo',
    ...(spec.marks === undefined ? {} : { marks: spec.marks }),
    ...(spec.outer ? { outer: spec.outer } : {}),
    content
  } as MnxSequenceItem;
}

/** A rhythmic fraction, divided. */
function divideSpan(span: Onset, by: number): Onset {
  return { num: span.num, den: span.den * by };
}

/** The plain (undotted) note value spanning this fraction, if one does. */
function noteValueForSpan(span: Onset): MnxNoteValueBase | null {
  const bases: MnxNoteValueBase[] = [
    'breve', 'whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th', '128th'
  ];
  return bases.find(base => onsetsEqual(durationSpan({ base }), span)) ?? null;
}

/** Fill a typed wrap's blanks from the music it will hold: an unqualified
 *  `3:2` means "at the value under the cursor", and a tremolo's performed
 *  `outer` is its two written events. The parser cannot see the document, so
 *  this is where the spec becomes complete. */
export function completeContainerSpec(
  seq: MnxSequence,
  eventIndex: number,
  partial: PartialContainerSpec
): ContainerSpec | null {
  const item = seq.content[eventIndex];
  if (!isTimedEvent(item)) return null;
  const duration = (item as MnxEvent).duration;
  if (partial.type === 'grace') return { ...partial };
  if (partial.type === 'tremolo') {
    // The two events are each WRITTEN with the tremolo's total duration, and
    // `outer` is what is PERFORMED: duration × multiple = that same total. So
    // the outer value is the written one divided by the count — two written
    // halves are performed as 2 × quarter. Where that division names no note
    // value, `outer` is left out (legal, and `itemSpan` reads the written
    // events instead) rather than invented.
    const performed = noteValueForSpan(divideSpan(durationSpan(duration), 2));
    return {
      type: 'tremolo',
      ...(partial.marks === undefined ? {} : { marks: partial.marks }),
      ...(performed ? { outer: { duration: { base: performed }, multiple: 2 } } : {})
    };
  }
  return {
    type: 'tuplet',
    inner: { multiple: partial.inner.multiple, duration: partial.inner.duration ?? { base: duration.base } },
    outer: { multiple: partial.outer.multiple, duration: partial.outer.duration ?? { base: duration.base } },
    ...(partial.bracket ? { bracket: partial.bracket } : {}),
    ...(partial.showNumber ? { showNumber: partial.showNumber } : {})
  };
}

/**
 * The entry sequence's content index at a metric position — the address for
 * content that may be SILENCE, where there is no note key to name.
 *
 * `containerRunAt` (below) addresses by note key and cannot see a rest; a
 * space is inserted exactly where there is no ink, so it needs this instead.
 */
export function entryContentAt(
  doc: MnxStructure,
  measureIndex: number,
  onset: Onset,
  partIndex = 0,
  voiceIndex = 0,
  staffIndex = 1
): { partIndex: number; sequenceIndex: number; index: number; seq: MnxSequence } | null {
  const measure = doc.parts?.[partIndex]?.measures?.[measureIndex];
  if (!measure) return null;
  // The cursor's VOICE picks the sequence — `spec/tie-targets` puts its space
  // in the second voice of the staff, and an address that always took the
  // first would have written it into the wrong one (the anchor the cursor
  // gained in core-selection-ladder.md, earning its keep).
  const onStaff = (measure.sequences ?? [])
    .map((sequence, index) => ({ sequence, index }))
    .filter(entry => (entry.sequence.staff ?? 1) === staffIndex);
  const chosen = onStaff[voiceIndex] ?? onStaff[0];
  if (!chosen) return null;
  const sequenceIndex = chosen.index;
  const seq = chosen.sequence;
  const found = eventAtOnset(seq, onset);
  if (!found) return null;
  return { partIndex, sequenceIndex, index: found.index, seq };
}

/** Where a wrap starts: the run of content the note at `noteKey` opens, as
 *  indices into its own sequence. Refuses a note already inside a container —
 *  nesting is the shape the renderer does not model. */
export function containerRunAt(
  doc: MnxStructure,
  noteKey: string
): { partIndex: number; measureIndex: number; sequenceIndex: number; eventIndex: number; seq: MnxSequence } | null {
  const address = findNoteAddress(doc, noteKey);
  if (!address || address.containerIndex !== undefined) return null;
  return {
    partIndex: address.partIndex,
    measureIndex: address.measureIndex,
    sequenceIndex: address.sequenceIndex,
    eventIndex: address.eventIndex,
    seq: address.sequence
  };
}

/**
 * How many content items a wrap consumes, starting at `eventIndex`.
 *
 * **The container already knows its own extent, so the gesture does not have to
 * restate it.** A tuplet takes the events that exactly FILL its inner value
 * (3 eighths = an eighth triplet, and also a quarter-plus-eighth, which is what
 * `spec/tuplets` holds); a tremolo takes its two; a grace takes one unless told
 * otherwise. That is why the wrap needs no press-navigate-press anchor: asking
 * for `3 eighth in 2 eighth` has already said how much music is involved.
 *
 * Null = refuse: the run overshoots the inner value, or runs out of bar.
 */
export function wrapExtent(
  seq: MnxSequence,
  eventIndex: number,
  spec: ContainerSpec,
  count?: number
): number | null {
  if (count !== undefined) return countFits(seq, eventIndex, count) ? count : null;
  if (spec.type === 'tremolo') return countFits(seq, eventIndex, 2) ? 2 : null;
  if (spec.type === 'grace') return countFits(seq, eventIndex, 1) ? 1 : null;
  const inner = durationSpan(spec.inner.duration);
  const target = { num: inner.num * spec.inner.multiple, den: inner.den };
  let span: Onset = { num: 0, den: 1 };
  for (let i = eventIndex; i < seq.content.length; i++) {
    const item = seq.content[i];
    if (!isTimedEvent(item)) return null;
    span = addOnsets(span, itemSpan(item));
    if (onsetLess(target, span)) return null; // overshot — the run does not fit
    if (!onsetLess(span, target)) return i - eventIndex + 1;
  }
  return null;
}

function countFits(seq: MnxSequence, eventIndex: number, count: number): boolean {
  if (count < 1 || eventIndex + count > seq.content.length) return false;
  return seq.content.slice(eventIndex, eventIndex + count).every(item => isTimedEvent(item));
}

/** The content range two note keys span, for the beam verb — indices only, so
 *  reading the document cannot change it (the minting happens in the op). */
export function beamRunBetween(
  doc: MnxStructure,
  fromNoteKey: string,
  toNoteKey: string
): { measureIndex: number; from: number; to: number } | null {
  const from = findKeyedNote(doc, fromNoteKey);
  const to = findKeyedNote(doc, toNoteKey);
  if (!from || !to) return null;
  if (from.measureIndex !== to.measureIndex || from.seq !== to.seq) return null;
  const [start, end] =
    from.eventIndex <= to.eventIndex ? [from.eventIndex, to.eventIndex] : [to.eventIndex, from.eventIndex];
  let beamable = 0;
  for (let i = start; i <= end; i++) {
    const item = from.seq.content[i];
    if (isTimedEvent(item) && (item.notes?.length ?? 0) > 0) beamable++;
  }
  return beamable >= 2 ? { measureIndex: from.measureIndex, from: start, to: end } : null;
}

/**
 * Is un-declaring the time signature at `measureIndex` a PURE un-declaration —
 * that is, does the meter that would govern afterwards equal the one declared?
 *
 * The first version asked the weaker question ("would any bar end up
 * overfull?") and planned to re-pad the rest. The corpus refused it twice, for
 * two different reasons, and both say the repair is not ours to make:
 *
 * - `spec/organ-layout` (3/4 → inherited 4/4): `padMeasureRests` only fills the
 *   ENTRY sequence, so the other voices and staves keep their three beats and
 *   the bar reports "voice 2 underfills". Repairing them would mean reshaping
 *   music the ops layer deliberately does not own.
 * - `lab/rhythm/sequence-space`: `itemSpan` counts a `space` as zero, so the
 *   padding mis-measured a bar whose meter had not even changed — the `space`
 *   gap item 11b still owns.
 *
 * So removal is offered exactly where it changes no music: the redundant
 * declaration. Where the meter would really change, refusing is the same
 * "guarded removal" the campaign uses for containers — no silent damage.
 */
export function timeSignatureRemovalFits(doc: MnxStructure, measureIndex: number): boolean {
  const declared = doc.global?.measures?.[measureIndex]?.time;
  if (!declared) return false;
  const probe = JSON.parse(JSON.stringify(doc)) as MnxStructure;
  delete probe.global.measures[measureIndex].time;
  const after = meterOf(probe, measureIndex).span;
  const before = { num: declared.count, den: declared.unit };
  return before.num * after.den === after.num * before.den;
}

/** The technique of `kind` on this note, if any — asked before applying, so a
 *  toggle never queues an op that changes nothing. */
export function techniqueAt(doc: MnxStructure, noteKey: string, kind: string): unknown {
  const located = findKeyedNote(doc, noteKey);
  const technique = located?.note._x?.mnxLab?.tab?.technique as Record<string, unknown> | undefined;
  return technique?.[kind];
}

/** This note's midi pitch and the following note's — what decides hammer-on
 *  from pull-off (up hammers, down pulls). */
export function nextNotePitchPair(
  doc: MnxStructure,
  noteKey: string
): { current: number; next: number } | null {
  const located = findKeyedNote(doc, noteKey);
  if (!located) return null;
  const target = tieTarget(doc, located);
  if (!target) return null;
  return { current: midiOf(located.note), next: midiOf(target) };
}

/** Does a slur start at this note? The toggle asks BEFORE applying, so a
 *  no-op removal never reaches the op queue (the `removeClef` rule). */
export function hasSlurStartingAt(doc: MnxStructure, noteKey: string): boolean {
  const located = findKeyedNote(doc, noteKey);
  if (!located) return false;
  const event = located.event;
  return (event.slurs ?? []).some(slur => slurStartsAt(slur, event, located.note));
}

/** Does this slur start at `note`? With chord pins the `startNote` names it;
 *  without pins a single-note event's only slur starts at its only note. */
function slurStartsAt(slur: MnxSlur, event: MnxEvent, note: MnxNote): boolean {
  if (slur.startNote !== undefined) return slur.startNote === note.id;
  // Unpinned, the slur belongs to the whole event (spec/slurs-chords carries
  // one on a chord), so it is addressed from the event's FIRST note — the same
  // convention the element walker uses to hand it an owner key.
  return event.notes?.[0] === note;
}

/** A fresh event id, deterministic like `mintNoteId` so replays are stable. */
/** A free `m<n>` for a global measure — the corpus spells them `m1`, `m2`. */
function mintMeasureId(doc: MnxStructure): string {
  const taken = new Set((doc.global?.measures ?? []).map(measure => measure.id).filter(Boolean));
  for (let n = 1; ; n++) {
    const id = `m${n}`;
    if (!taken.has(id)) return id;
  }
}

function mintEventId(doc: MnxStructure): string {
  const taken = new Set<string>();
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const item of seq.content ?? []) {
          const id = (item as { id?: string }).id;
          if (id) taken.add(id);
        }
      }
    }
  }
  for (let n = 1; ; n++) {
    const id = `ev${n}`;
    if (!taken.has(id)) return id;
  }
}

function mintNoteId(doc: MnxStructure): string {
  const taken = new Set<string>();
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const item of seq.content ?? []) {
          for (const note of (item as { notes?: MnxNote[] }).notes ?? []) {
            if (note.id) taken.add(note.id);
          }
        }
      }
    }
  }
  for (let i = 1; ; i++) {
    if (!taken.has(`t${i}`)) return `t${i}`;
  }
}

/** What (string, fret) sounds under the part's (or standard) tuning. */
function fingerboardMidi(doc: MnxStructure, string: number, fret: number): number | undefined {
  const open = tuningOf(doc.parts?.[0]).find(t => t.string === string);
  // Frets are capo-relative, so the sounding pitch includes the capo shift.
  return open ? midiOfPitch(open.pitch) + capoOf(doc.parts?.[0]) + fret : undefined;
}

/** Voice 0 of staff 1 in a part-0 measure — the entry surface. Created on
 *  demand so entry works in measures that never had a sequence. */
function entrySequence(doc: MnxStructure, measureIndex: number): MnxSequence | undefined {
  const measure = doc.parts?.[0]?.measures?.[measureIndex];
  if (!measure) return undefined;
  measure.sequences ??= [];
  const existing = measure.sequences.filter(s => (s.staff ?? 1) === 1)[0];
  if (existing) return existing;
  const created: MnxSequence = { content: [] };
  measure.sequences.push(created);
  return created;
}

/** The timed event starting exactly at `target`, or (event: undefined) with
 *  the content index where a new event at `target` belongs. Returns undefined
 *  when `target` falls INSIDE an item's span — phase 2 does not split events. */
function eventAtOnset(
  seq: MnxSequence,
  target: Onset
): { event?: MnxEvent; index: number } | undefined {
  let onset: Onset = { num: 0, den: 1 };
  for (let index = 0; index < seq.content.length; index++) {
    const item = seq.content[index];
    if (onsetsEqual(onset, target)) {
      return isTimedEvent(item) ? { event: item, index } : { index };
    }
    onset = addOnsets(onset, itemSpan(item));
    if (onsetLess(target, onset)) return undefined; // inside the item just passed
  }
  return onsetsEqual(onset, target) ? { index: seq.content.length } : undefined;
}

/** Like forEachKeyedNote but with the owning event, for structural edits —
 *  the same enumeration (`model/noteWalk.ts`), just handing back more of it. */
function forEachEventNote(
  doc: MnxStructure,
  fn: (event: MnxEvent, note: MnxNote, key: string) => void
): void {
  forEachNoteAddress(doc, address => fn(address.event, address.note, address.key));
}

/**
 * Strip every reference to a note that was just removed, and to an event that
 * just became a rest — the campaign's *reference* removal class ("unlink both
 * ends"), caught corpus-wide by the destructibility sweep
 * (roadmap/inprogress/core-element-ops-destruct-sweep.md). Scans ALL parts:
 * `deleteNote` edits the entry surface, but a tie or slur may point into it
 * from anywhere.
 *
 * The two failure modes are different and both are fixed here: a reference to
 * the note DANGLES (its id resolves to nothing), while a reference to the
 * emptied event goes INKLESS (the id still resolves — to a rest). No
 * tombstones: emptied containers are deleted, never left behind.
 */
function unlinkReferences(
  doc: MnxStructure,
  noteId: string | undefined,
  eventId: string | undefined
): void {
  const pruneBeams = (beams: MnxBeam[] | undefined, top: boolean): MnxBeam[] | undefined => {
    if (!beams || !eventId) return beams;
    const kept = beams
      .map(beam => ({ ...beam, events: (beam.events ?? []).filter(id => id !== eventId) }))
      .map(beam => {
        const nested = pruneBeams(beam.beams, false);
        if (nested && nested.length > 0) beam.beams = nested;
        else delete beam.beams;
        return beam;
      })
      // A beam needs two events to mean anything; a NESTED beam over one is a
      // legal hook (a partial beam), so only the outer level demands two.
      .filter(beam => beam.events.length >= (top ? 2 : 1));
    return kept;
  };

  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      if (measure.beams) {
        const kept = pruneBeams(measure.beams, true);
        if (kept && kept.length > 0) measure.beams = kept;
        else delete measure.beams;
      }
      for (const sequence of measure.sequences ?? []) {
        const visit = (content: MnxSequenceItem[] | undefined): void => {
          for (const item of content ?? []) {
            if (!isTimedEvent(item)) {
              visit((item as { content?: MnxSequenceItem[] }).content);
              continue;
            }
            const event = item as MnxEvent;
            if (event.slurs) {
              const kept = event.slurs
                // A slur onto a rest is not a slur.
                .filter(slur => !eventId || slur.target !== eventId)
                .map(slur => {
                  // The endpoint pins name chord members; the slur itself
                  // survives losing one, it just stops pinning.
                  if (noteId && slur.startNote === noteId) delete slur.startNote;
                  if (noteId && slur.endNote === noteId) delete slur.endNote;
                  return slur;
                });
              if (kept.length > 0) event.slurs = kept;
              else delete event.slurs;
            }
            for (const note of event.notes ?? []) {
              if (noteId && note.ties) {
                const kept = note.ties.filter(tie => tie.target !== noteId);
                if (kept.length > 0) note.ties = kept;
                else delete note.ties;
              }
              const tab = note._x?.mnxLab?.tab;
              if (noteId && tab?.technique) {
                const technique = tab.technique as Record<string, { target?: string } | undefined>;
                for (const [name, value] of Object.entries(technique))
                  // A hammer-on to a note that no longer exists is not a
                  // hammer-on: the technique IS the relationship.
                  if (value && typeof value === 'object' && value.target === noteId)
                    delete technique[name];
                if (Object.keys(technique).length === 0) delete tab.technique;
                if (Object.keys(tab).length === 0) delete note._x!.mnxLab!.tab;
                if (Object.keys(note._x!.mnxLab!).length === 0) delete note._x!.mnxLab;
                if (Object.keys(note._x!).length === 0) delete note._x;
              }
            }
          }
        };
        visit(sequence.content);
      }
    }
  }
}

/** One op-queue entry: the op plus the intent that provoked it — stamped
 *  FORWARD at apply time (never inferred backward), so the ops panel can
 *  reverse-join intent → key/surface through the keymap docs
 *  (roadmap/complete/core-element-ops-exemplar.md, provenance columns). */
export interface OpLogEntry {
  op: EditOp;
  intent?: EditorIntent;
}

/**
 * Undo/redo over applyOp. The history RETAINS the ops it applied — undo
 * history, trace recording, and (later) the AI loop's EditOp[] output are
 * three consumers of one log (roadmap/complete/core-editor-input-layer.md).
 * Snapshots ride along for O(1) undo; the op log is the durable artifact.
 */
export class EditHistory {
  private past: { op: EditOp; intent?: EditorIntent; before: MnxStructure }[] = [];
  private future: { op: EditOp; intent?: EditorIntent; after: MnxStructure }[] = [];

  constructor(private present: MnxStructure) {}

  get current(): MnxStructure {
    return this.present;
  }

  /** The ops currently in effect, oldest first. */
  get appliedOps(): EditOp[] {
    return this.past.map(entry => entry.op);
  }

  /** The applied queue with intent provenance, oldest first. */
  get appliedEntries(): OpLogEntry[] {
    return this.past.map(({ op, intent }) => ({ op, intent }));
  }

  /** The redo stack with intent provenance, next-to-redo first. */
  get futureEntries(): OpLogEntry[] {
    return [...this.future].reverse().map(({ op, intent }) => ({ op, intent }));
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  apply(op: EditOp, intent?: EditorIntent): MnxStructure {
    this.past.push({ op, intent, before: this.present });
    this.present = applyOp(this.present, op);
    this.future = [];
    return this.present;
  }

  undo(): MnxStructure {
    const entry = this.past.pop();
    if (entry) {
      this.future.push({ op: entry.op, intent: entry.intent, after: this.present });
      this.present = entry.before;
    }
    return this.present;
  }

  redo(): MnxStructure {
    const entry = this.future.pop();
    if (entry) {
      this.past.push({ op: entry.op, intent: entry.intent, before: this.present });
      this.present = entry.after;
    }
    return this.present;
  }
}
