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
  MnxLayout,
  MnxEvent,
  MnxFermata,
  MnxGrace,
  MnxTremolo,
  MnxNote,
  MnxNoteValueBase,
  MnxScore,
  MnxPart,
  MnxPartMeasure,
  MnxSequence,
  MnxSequenceItem,
  MnxSlur,
  MnxStructure,
  MnxTuningEntry
} from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import type { SelectionState } from './selection.ts';
import type { SelectionClipEnvelope } from './selectionClip.ts';
import type { PartialContainerSpec } from './setupGrammar.ts';
import { syntheticNoteKey } from '../model/noteKeys.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { parseChordSymbol, renderChordSymbol } from '../model/harmony.ts';
import { findNoteAddress, forEachNoteAddress } from '../model/noteWalk.ts';
import { enharmonicSpellings, keyFifthsAt, midiOfSpelling, spellPitch } from './staffSpace.ts';
import {
  addOnsets,
  durationSpan,
  itemSpan,
  onsetLess,
  onsetsEqual,
  type Onset
} from './cursor.ts';
import { capoOf, defaultStringFor, midiOfPitch, tuningOf } from './tabStrings.ts';

// Note addressing: every `noteId(s)` field accepts a note's real `id` OR its
// synthetic positional key (src/model/noteKeys.ts) — most spec mirrors carry
// no ids, and the cursor must be able to edit them too. Positional ops
// (insert/setDuration) address (measureIndex, onset-as-whole-note-fraction)
// in the part, staff and voice their `EntryTarget` names — the cursor's,
// which is the whole of roadmap/complete/core-entry-surface.md.
/**
 * WHERE A WRITE LANDS — the cursor's part, staff and voice
 * (roadmap/complete/core-entry-surface.md). The cursor addressed all three
 * long before entry could: every REMOVAL verb already followed it, while
 * every writing verb resolved to voice 0 of `parts[0]`, staff 1. This is the
 * address that closes the asymmetry.
 *
 * Every field is optional and absent means the FIRST of its kind — part 0,
 * staff 1, voice 0 — which is exactly what these ops meant before they could
 * say anything else. So an op log written yesterday still says the same
 * thing, the session omits a default rather than spelling it, and no
 * committed trace moves a byte.
 */
export interface EntryTarget {
  partIndex?: number;
  staffIndex?: number;
  voiceIndex?: number;
}

export type EditOp =
  | {
      /** One user command over a resolved selection. The children are an
       * implementation detail of that command: history, undo and provenance
       * retain this single envelope rather than pretending each member was a
       * separate gesture. */
      type: 'batch';
      ops: EditOp[];
    }
  | {
      /** One already-planned clipboard mutation. The environment-facing
       *  read and every compatibility decision happened before this op was
       *  created; applying it is therefore a pure atomic document swap.
       *
       *  The selection snapshots ride with the durable history entry because
       *  paste has stronger landing semantics than ordinary point edits:
       *  undo restores the target range and redo reselects the result. */
      type: 'pasteSelection';
      document: MnxStructure;
      clipKind: SelectionClipEnvelope['clip']['kind'];
      selectionBefore: SelectionState;
      selectionAfter: SelectionState;
      detachedTargetReferences: number;
    }
  | {
      /** One authoritative, already-captured Cut removal. Clipboard I/O is
       *  complete before this deterministic history entry is created. */
      type: 'cutSelection';
      document: MnxStructure;
      clipKind: SelectionClipEnvelope['clip']['kind'];
      selectionBefore: SelectionState;
      selectionAfter: SelectionState;
      removedMembers: number;
      detachedTargetReferences: number;
    }
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
  | ({
      /** Insert a note at a metric position in the cursor's voice (an
       *  existing event there gains a chord member; a rest there becomes the
       *  note; empty space gains a new event of `duration`). Pitch derives
       *  from string+fret against THAT PART's tuning — a fret is a place on
       *  the fingerboard in front of you, not on part 0's. */
      type: 'insertNote';
      measureIndex: number;
      onset: [number, number];
      string: number;
      fret: number;
      duration: { base: MnxNoteValueBase; dots?: number };
    } & EntryTarget)
  | ({
      /** Insert a note BY PITCH at a metric position in the cursor's voice — the
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
    } & EntryTarget)
  | {
      /** Remove one note; a now-empty event becomes a rest of the same
       *  duration, so the measure's grid does not shift under the cursor. */
      type: 'deleteNote';
      noteId: string;
    }
  | {
      /**
       * Remove an event outright, splicing its time out of the voice — the
       * last step of the guarded-removal ladder, and the exact twin of
       * `insertEvent`.
       *
       * REFUSED while the event holds ink, which is the campaign's anti-cheat
       * rule unchanged: a container may be removed only once it is empty, so
       * removal never destroys ink implicitly. `clearEvent` is what empties
       * it, so Delete on a note-bearing event still clears to a rest and a
       * SECOND Delete takes the rest away. Before this the second press did
       * nothing at all — `clearEvent` on something already a rest is a no-op,
       * and the ladder simply stopped there with no way to say "and now go".
       *
       * The bar underfills, and that is the same ruling `insertEvent` carries
       * pointed the other way: §8.11 belongs to entry, the badge names the
       * state ("underfills the 4/4 bar: notes sum to 3 of 4 beats"), and the
       * author resolves it with the verbs they have.
       */
      type: 'removeEvent';
      event: EventAddress;
    }
  | {
      /** Clear the selected event to an equal-duration rest. This is the
       * event rung's Delete: it removes all event ink and adornments without
       * splicing time out of the voice. */
      type: 'clearEvent';
      event: EventAddress;
    }
  | ({
      /** Re-value the event at a metric position in the cursor's voice. */
      type: 'setDuration';
      measureIndex: number;
      onset: [number, number];
      duration: { base: MnxNoteValueBase; dots?: number };
    } & EntryTarget)
  | ({
      /** Nudge the rest at a metric position in the cursor's voice vertically —
       *  `rest.staffPosition`, in half-staff-spaces, +up. The §8.11
       *  polymorphic verb: Alt+↑↓ re-pitches a note, repositions a rest. */
      type: 'nudgeRest';
      measureIndex: number;
      onset: [number, number];
      delta: number;
    } & EntryTarget)
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
      /** Declare the part's string tuning (`_x.mnxLab.strings`) — on the
       *  part being read (item-13b's widening, one-surface item 7). */
      type: 'setTuning';
      tuning: MnxTuningEntry[];
      partIndex?: number;
    }
  | {
      /** Declare the part's tab staff preference (`_x.mnxLab.tab.staffKind`)
       *  — on the part being read (one-surface item 9's widening).
       *  Presentation, but document-level: it gates the tab/both projections
       *  (engine/headless), so the goldens — and the construct-trace verdict
       *  — see it. Discovered by the element-ops exemplar. */
      type: 'setStaffKind';
      kind: 'notation' | 'tab' | 'both';
      partIndex?: number;
    }
  | ({
      /**
       * Insert an event beside the one at `onset`, in the cursor's voice —
       * the note rung's insert, and the EVENT rung's, which are the same act:
       * a chord has no order, so "after this note" can only mean after it in
       * TIME, which is exactly what ←→ already walks at the note rung.
       *
       * **This one deliberately breaks §8.11.** Every other writing verb keeps
       * a touched bar summing to its meter — entry converts rests, a wrap
       * re-pads, a re-value pads or eats. Insert cannot: making room would
       * mean shortening or deleting music the author did not name, and this
       * codebase refuses to do that silently far more strongly than it insists
       * on a full bar.
       *
       * So the bar is allowed to overfill and the renderer SAYS SO — the
       * duration-mismatch badge already reads "voice 2 overfills the 4/4 bar:
       * notes sum to 5 beats of 4 beats", per voice, and it is the whole
       * warning. The author then resolves it with the verbs they already have
       * (re-value two notes as eighths, say). The invariant is a property of
       * ENTRY, not of the document at rest; an overfull bar is a legible state
       * with a name, not a corruption.
       */
      type: 'insertEvent';
      measureIndex: number;
      onset: [number, number];
      side: 'before' | 'after';
      duration: { base: MnxNoteValueBase; dots?: number };
      pitch: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; alter?: number };
      /** The fingerboard place, when the insert happened in the tab
       *  projection — the string is the choice, so it travels with the note. */
      string?: number;
      fret?: number;
    } & EntryTarget)
  | {
      /**
       * Insert an empty bar beside the cursor's — the positional construct
       * verb `removeMeasure` has always had a twin for and never got
       * (roadmap/proposed/core-rung-insert.md). `appendMeasure` can only
       * reach the end, which is why a pickup bar was unauthorable.
       *
       * The bar is GLOBAL, so it goes into every part's array at the same
       * index; only the cursor's part gets the beat rests, on the same rule
       * `appendMeasure` follows.
       */
      type: 'insertMeasure';
      /** The bar the cursor is on; the new one lands beside it. */
      measureIndex: number;
      side: 'before' | 'after';
      partIndex?: number;
    }
  | {
      /** Append an empty measure to every part and the global timeline.
       *
       *  The bar is GLOBAL; a part's copy of it is not. So the new bar's beat
       *  rests go into the part being written to — appending while reading
       *  part 2 used to pad part 1 and leave the bar under the cursor empty.
       */
      type: 'appendMeasure';
      partIndex?: number;
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
      /** The index the new part TAKES; absent appends, which is what this
       *  verb meant before it could say anything else. Score order is what
       *  the reader sees, so unlike a voice ordinal it is worth addressing. */
      partIndex?: number;
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
      /** Remove one addressed part (the first when omitted) — refused while
       *  the part holds any note. Its declarations (name,
       *  tuning, staffKind) go with their container: no tombstones. */
      type: 'removePart';
      partIndex?: number;
    }
  // The inherited-attribute pair (campaign item 5,
  // roadmap/complete/core-element-ops-clef-key.md). Clef is a PART-measure
  // attribute, key signature a GLOBAL-measure one — the same rung addressing
  // two different owners — and both persist until changed, so removing one
  // reverts the measure to its predecessor's governance rather than to
  // nothing.
  | {
      /** Declare the clef governing this measure onward, on the cursor's part
       *  and staff. `removeClef` has taken both since campaign item 13b; this
       *  half kept writing to `parts[0]`, staff 1, so a grand staff's lower
       *  clef could be un-declared and never declared. */
      type: 'setClef';
      measureIndex: number;
      sign: string;
      staffPosition?: number;
      octave?: number;
      partIndex?: number;
      staffIndex?: number;
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
  // roadmap/complete/core-element-ops-bar-attributes.md). Ten kinds that are
  // all one thing — a key on the GLOBAL measure — so they share one verb with
  // a typed payload rather than restating the same shape ten times.
  // Spanners (campaign item 10,
  // roadmap/complete/core-element-ops-spanners.md). A slur is ONE object
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
      /** Move an existing slur's far end to another note's event, keeping
       *  side/lineType in place — the press-at-the-end EXTEND half of
       *  core-selection-range-grain.md decision 5. `noteKey` names the
       *  slur's START note exactly as `removeSlur` does. */
      type: 'retargetSlur';
      noteKey: string;
      toNoteKey: string;
    }
  | {
      /** Re-type an existing tie (`crossVoice`, `arpeggio`, `crossJump`) or
       *  make a target-less `lv` tie. `toggleTie` remains the removal half. */
      type: 'setTieVariant';
      noteId: string;
      targetType?: 'nextNote' | 'crossVoice' | 'arpeggio' | 'crossJump';
      lv?: boolean;
    }
  // Lyrics (campaign item 12, roadmap/complete/core-element-ops-lyrics.md).
  // A syllable is a key on the EVENT's lyric line; the line's metadata is a
  // key on the document. Two owners, so two pairs — item 7's test.
  | { type: 'setSyllable'; noteKey: string; line: string; text: string; syllableType?: 'start' | 'middle' | 'end' | 'whole' }
  | { type: 'removeSyllable'; noteKey: string; line: string }
  | { type: 'setLyricLine'; line: string; label?: string; lang?: string }
  | { type: 'removeLyricLine'; line: string }
  // Tab technique + fingering (campaign item 9,
  // roadmap/complete/core-element-ops-technique.md). Both live under the
  // note's vendor block; technique is the ENTRY side of
  // roadmap/complete/core-guitar-technique.md, which owns the drawing.
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
  | {
      /** Choose the string a note is played on, KEEPING its pitch — the
       *  inspector's amend of a string pill. The stored `fret` is dropped:
       *  it is the consequence of (pitch, string, tuning) and the renderer
       *  derives it; an unplayable place draws the red badge, never a clamp.
       *  Contrast `setFret`, which chooses (string, fret) and lets the pitch
       *  follow. Nothing here freezes a derived guess: a caller that wants
       *  the string the ladder already chose has nothing to write. */
      type: 'setStringAnnotation';
      noteKey: string;
      string: number;
    }
  | { type: 'setFingering'; noteKey: string; hand: 'left' | 'right'; finger: string }
  | { type: 'removeFingering'; noteKey: string }
  // Part declarations (campaign item 13,
  // roadmap/complete/core-element-ops-part-declarations.md): five keys on
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
  | {
      /** Remove one sequence (the selected voice's bar copy), only when it
       * holds no ink. Rests and empty declarations go with their container. */
      type: 'removeVoiceMeasure';
      partIndex: number;
      measureIndex: number;
      sequenceIndex: number;
    }
  | {
      /**
       * Create a voice in ONE bar of one staff — the construct half of
       * `removeVoiceMeasure`, and the answer to the question that made the
       * entry surface a design item: what does typing into a second voice
       * mean when the bar is already full?
       *
       * The voice arrives **full**, padded to the meter with rests, exactly
       * as `appendMeasure` gives a new bar its beat rests. Three things fall
       * out of that and they are the whole argument:
       *
       * - Every position in the new voice is REAL, so the cursor addresses
       *   the whole bar immediately and each keystroke converts a rest. An
       *   unpadded voice would make beat 3 unreachable until beats 1 and 2
       *   were typed, because the grid's entry ghost belongs to voice 0.
       * - There is therefore **no ghost voice to invent** — the ladder needs
       *   no new vocabulary for "a position with no document behind it",
       *   because the policy never creates one.
       * - The bar is legal the instant it exists: an underfilled voice draws
       *   the duration-mismatch badge on every render, and a verb must never
       *   manufacture the diagnostic that says you made a mistake.
       *
       * Rests you did not type are the price, and the round trip pays it
       * back: Del at the voice rung (`removeVoiceMeasure`) takes the voice
       * away again while it is still rests-only, so nothing is stranded.
       *
       * Per BAR, like its removal twin — the rung is "this voice in this
       * bar", not "this voice everywhere".
       */
      type: 'addVoiceMeasure';
      measureIndex: number;
      partIndex?: number;
      staffIndex?: number;
    }
  | {
      /** Remove the selected staff's part-measure structure, only when that
       * staff holds no ink. A single-staff part drops the whole part-measure;
       * a multi-staff part drops only this staff's sequences and clefs. */
      type: 'removePartMeasure';
      partIndex: number;
      measureIndex: number;
      staffIndex: number;
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
  /** The construct halves of the document's presentation layer
   *  (core-layout-authoring.md). A layout is a TREE and a score a
   *  presentation, so neither has a place in the music to stand at — the
   *  whole value is set at a 0-based index, which is the same addressing the
   *  removal halves have always used. An index past the end APPENDS, so one
   *  op both creates and replaces. */
  | { type: 'setLayout'; index: number; layout: MnxLayout }
  | { type: 'setScore'; index: number; score: MnxScore }
  | { type: 'addMultimeasureRest'; scoreIndex: number; start: string; duration: number }
  | { type: 'removeLayout'; index: number }
  | { type: 'removeScore'; index: number }
  | { type: 'removeMultimeasureRest'; scoreIndex: number; index: number }
  | {
      /** Declare `staves` or `capo` on the cursor's part. Its removal twin
       *  has taken `partIndex` since item 13b. */
      type: 'setPartDeclaration';
      declaration: PartDeclaration;
      partIndex?: number;
    }
  | {
      type: 'removePartDeclaration';
      kind: PartDeclarationKind;
      /** Which part's declaration (campaign item 13b); default the first. */
      partIndex?: number;
    }
  // Event adornments (campaign item 8,
  // roadmap/complete/core-element-ops-adornments.md). TWO pairs, because the
  // owners differ: a marking is a key on the EVENT, while dynamics and
  // directions are positioned entries in PART-MEASURE arrays. Item 7's family
  // test (do they share an owner?) is what splits them.
  | {
      /** One event marking. `attributes` carries the few that are not bare
       *  flags — a breath's symbol, a bow's direction — because the marking
       *  IS its object and an empty one would be a different mark. */
      type: 'setMarking';
      /** Existing point-edit address. */
      noteKey?: string;
      /** Structural address used when a range contains a rest event, which
       * has no note key to borrow. */
      event?: EventAddress;
      marking: string;
      attributes?: Record<string, string>;
    }
  | { type: 'removeMarking'; noteKey?: string; event?: EventAddress; marking: string }
  /** The event's fermata — its own key in MNX, not a marking, so its own
   *  pair; the set is an upsert (one fermata per event). */
  | { type: 'setFermata'; noteKey?: string; event?: EventAddress; fermata: MnxFermata }
  | { type: 'removeFermata'; noteKey?: string; event?: EventAddress }
  | ({
      /** A dynamic or direction at a metric position in the part measure —
       *  on the STAFF the cursor is reading. MNX puts `staff` on the object
       *  itself, and the renderer places by it (`emitDirections`), so a grand
       *  staff's "L.H." had no way to say it belongs to the lower staff. It
       *  is an ADDRESS, not a property of the words, which is why it rides
       *  with the cursor rather than joining `PositionedAttribute`. */
      type: 'setPositioned';
      measureIndex: number;
      onset: [number, number];
      attribute: PositionedAttribute;
    } & EntryTarget)
  | {
      type: 'removePositioned';
      measureIndex: number;
      kind: PositionedAttribute['kind'];
      index: number;
      partIndex?: number;
    }
  // Rhythm declarations (campaign item 11,
  // roadmap/complete/core-element-ops-rhythm-declarations.md) — the ones
  // that leave ink where it is. The containers that SWALLOW ink (tuplet,
  // grace, tremolo) wait for the grid to descend into them.
  | ({
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
    } & EntryTarget)
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
      /** Append one event to an existing beam — the press-at-the-end extend.
       *  The path addresses the beam exactly as `removeBeam` does; the new
       *  member's event id is minted if absent. Refuses across a barline —
       *  a beam lives in one measure. */
      type: 'extendBeam';
      measureIndex: number;
      path: number[];
      partIndex?: number;
      toNoteKey: string;
    }
  | {
      /**
       * A document-level support declaration: `useAccidentalDisplay` says the
       * accidentals are AUTHORED, so the renderer prints what each note asks
       * for and infers nothing; `useBeams` says the same about beams.
       *
       * It is not an element — no ink, no place in the music — so neither
       * harness could see it missing, and `spec/accidentals` turned out to be
       * unbuildable without it: the trace drew one accidental too many, in the
       * one bar where the policy is the whole point.
       */
      type: 'setSupport';
      key: 'useAccidentalDisplay' | 'useBeams';
      value: boolean;
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
      /** Amend a container's PRESENTATION fields in place — tuplet
       *  bracket/showNumber, grace slash/graceType, tremolo marks. Timing
       *  (the ratio) is deliberately not amendable: re-timing is a wrap
       *  request, the same ground on which unwrapping is refused
       *  (one-surface campaign item 8; closes the residue ledger's
       *  `container-properties` row). */
      type: 'setContainerProperties';
      measureIndex: number;
      sequenceIndex: number;
      /** Content index of the container in its sequence. */
      index: number;
      partIndex?: number;
      properties?: ContainerPropertyPatch;
      clear?: ContainerPropertyField[];
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
  | ({
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
    } & EntryTarget)
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
      /** For `tempos` only: which entry (the length appends). */
      index?: number;
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

/** What a technique key writes. `hammerPull`/`slide` name the note they
 *  travel to; the rest are flags or curves. */
export type TechniqueChoice =
  /** A bend as its STOPS (core-bend-stops.md): `alters` in semitones, in
   *  order, the first being where the string is when the note is struck — a
   *  non-zero first stop is a pre-bend, equal neighbours a hold. `weights`
   *  (when present, one per segment) are relative segment lengths; absent,
   *  segments are even. `approx` is READER-ONLY: the stored curve's positions
   *  do not fit small integer weights, so the spelt form is the nearest
   *  approximation and an amend would regularise it. The writer ignores it. */
  | {
      kind: 'bend';
      alters: number[];
      weights?: number[];
      approx?: true;
    }
  | { kind: 'slide' }
  | { kind: 'hammerPull' }
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

export type PartDeclaration =
  | { kind: 'capo'; value: number }
  | { kind: 'staves'; value: number }
  // The rename arm (one-surface item 9): removal existed, the setter never did.
  | { kind: 'name'; value: string };

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
      /** A SMuFL symbol instead of words — the renderer draws either; the
       *  writer could only say text until item 6. */
      glyphs?: string[];
      orient?: 'above' | 'below' | 'between';
    }
  /** An octave-shift line: same owner and shape as the other two, so it shares
   *  their verb — item 7's family test, applied once more. `bars` is how many
   *  bars it spans (1 = this one), the same shape item 7 gave a volta's
   *  duration, and the stand-in for a press-navigate-press range gesture. */
  | { kind: 'ottava'; value: 1 | 2 | 3 | -1 | -2 | -3; bars?: number }
  /** A rolled chord — the same owner (the part measure) and shape (a
   *  rhythmic position) as the others, so the same verb. The span is the
   *  chord under the cursor: its bottom and top note ids, minted if absent,
   *  exactly as `setBeam` mints the event ids it references. */
  | { kind: 'arpeggio'; direction?: 'up' | 'down'; arrow?: boolean }
  | { kind: 'nonArpeggio' };

/** The part-measure list each positioned kind lives in. */
export const POSITIONED_FIELDS: Record<PositionedAttribute['kind'], 'dynamics' | 'directions' | 'ottavas' | 'arpeggios' | 'nonArpeggios'> = {
  dynamic: 'dynamics',
  direction: 'directions',
  ottava: 'ottavas',
  arpeggio: 'arpeggios',
  nonArpeggio: 'nonArpeggios'
};

/** The bar attributes, each carrying exactly what its MNX object needs. */
export type MeasureAttribute =
  | { kind: 'barline'; type: NonNullable<NonNullable<MnxGlobalMeasure['barline']>['type']> }
  | { kind: 'repeatStart' }
  | { kind: 'repeatEnd'; times?: number }
  | { kind: 'ending'; numbers?: number[]; duration?: number; open?: boolean }
  // `at` is where in the bar the mark sits: the two words, or any fraction
  // of the bar the document can say (core-measure-attributes-gaps.md, item 6
  // — the renderer always honoured `location`, the op could only say the
  // ends). `glyph` is the segno's SMuFL variant, likewise long rendered.
  | { kind: 'segno'; at?: MarkAt; glyph?: string }
  | { kind: 'fine'; at?: MarkAt }
  | ({ kind: 'fermata' } & MnxFermata)
  | { kind: 'number'; value: number }
  | { kind: 'jump'; type: 'segno' | 'dsalfine'; at?: MarkAt }
  | { kind: 'tempo'; bpm: number; base: MnxNoteValueBase; dots?: number; at?: MarkAt }
  | { kind: 'rehearsal'; label: string }
  | { kind: 'section'; label: string }
  /** A chord symbol (`_x.mnxLab.harmonies`, core-chord-symbols.md): typed as
   *  written (`Am7`, `F#m7b5/A`, `N.C.`), stored structured through
   *  `parseChordSymbol` so it transposes; `at` is its moment in the bar. An
   *  array, like `tempos` — `index` names the entry. */
  | { kind: 'harmony'; text: string; at?: MarkAt };

export type MeasureAttributeKind = MeasureAttribute['kind'];

/** A navigation mark's place in its bar: the start, the end, or a fraction. */
export type MarkAt = 'start' | 'end' | [number, number];

/** A timed event's stable structural address. Voices are numbered per staff,
 * matching the cursor, selection resolver and canonical note walk. */
export interface EventAddress {
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
}

/** Where each attribute lives on the global measure. `tempo` is the only
 *  array, which is why removal takes an index. */
export const MEASURE_ATTRIBUTE_FIELDS: Record<MeasureAttributeKind, string> = {
  barline: 'barline',
  repeatStart: 'repeatStart',
  repeatEnd: 'repeatEnd',
  ending: 'ending',
  segno: 'segno',
  fine: 'fine',
  fermata: 'fermata',
  number: 'number',
  jump: 'jump',
  tempo: 'tempos',
  rehearsal: 'rehearsal',
  section: 'section',
  harmony: 'harmonies'
};

/** The measure-start position these three carry (mid-bar placement is item
 *  11's onset-addressing work — see the scope boundary). */
const MEASURE_START = { fraction: [0, 1] as [number, number] };

/** Where in the bar a navigation mark sits: `[0, 1]` at the start, `[1, 1]`
 *  at the end (a whole bar's worth in). */
function locationOf(at: MarkAt | undefined, fallback: 'start' | 'end') {
  if (Array.isArray(at)) return { fraction: [at[0], at[1]] as [number, number] };
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
      return {
        location: locationOf(attribute.at, 'start'),
        ...(attribute.glyph ? { glyph: attribute.glyph } : {})
      };
    case 'fine':
      return { location: locationOf(attribute.at, 'start') };
    case 'fermata': {
      const { kind: _kind, ...fermata } = attribute;
      return fermata;
    }
    case 'number':
      return attribute.value;
    case 'jump':
      return { type: attribute.type, location: locationOf(attribute.at, 'end') };
    case 'tempo':
      return {
        bpm: attribute.bpm,
        value: { base: attribute.base, ...(attribute.dots ? { dots: attribute.dots } : {}) },
        // A tempo without a location sits at the bar's start; `at` names a
        // mid-bar change, and the renderer draws every mark (item 9).
        ...(attribute.at !== undefined ? { location: locationOf(attribute.at, 'start') } : {})
      };
    case 'rehearsal':
    case 'section':
      return { label: attribute.label };
    case 'harmony':
      return {
        location: locationOf(attribute.at, 'start'),
        ...(parseChordSymbol(attribute.text) ?? { quality: 'other', text: attribute.text })
      };
  }
}

/**
 * The reverse of `measureAttributeValue`: the attributes a global measure
 * DECLARES, read back into the typed union. The rung inspector
 * (roadmap/inprogress/workbench-rung-inspector.md) draws its pills from this,
 * so what it shows is exactly what `setMeasureAttribute` could have written —
 * one vocabulary, read and written by the same two functions. `tempos` is the
 * array, so it yields one attribute per entry, in order (removal takes that
 * index).
 */
export function readMeasureAttributes(measure: MnxGlobalMeasure | undefined): MeasureAttribute[] {
  if (!measure) return [];
  const out: MeasureAttribute[] = [];
  // `at` is spelt only when it differs from the kind's own default — the
  // canonical form, so a `segno` written with no `at` reads back as none.
  const at = (
    location: { fraction: [number, number] } | undefined,
    fallback: 'start' | 'end'
  ): { at: MarkAt } | Record<string, never> => {
    if (location === undefined) return {};
    const [num, den] = location.fraction;
    const where: MarkAt = num === 0 ? 'start' : num === den ? 'end' : [num, den];
    return where === fallback ? {} : { at: where };
  };
  if (measure.barline?.type) out.push({ kind: 'barline', type: measure.barline.type });
  if (measure.repeatStart !== undefined) out.push({ kind: 'repeatStart' });
  if (measure.repeatEnd !== undefined)
    out.push({
      kind: 'repeatEnd',
      ...(measure.repeatEnd.times !== undefined ? { times: measure.repeatEnd.times } : {})
    });
  if (measure.ending !== undefined)
    out.push({
      kind: 'ending',
      ...(measure.ending.numbers ? { numbers: measure.ending.numbers } : {}),
      ...(measure.ending.duration !== undefined ? { duration: measure.ending.duration } : {}),
      ...(measure.ending.open ? { open: true } : {})
    });
  if (measure.segno !== undefined)
    out.push({
      kind: 'segno',
      ...at(measure.segno.location, 'start'),
      ...(measure.segno.glyph ? { glyph: measure.segno.glyph } : {})
    });
  if (measure.fine !== undefined) out.push({ kind: 'fine', ...at(measure.fine.location, 'start') });
  if (measure.fermata !== undefined) out.push({ kind: 'fermata', ...measure.fermata });
  if (measure.number !== undefined) out.push({ kind: 'number', value: measure.number });
  if (measure.jump !== undefined)
    out.push({ kind: 'jump', type: measure.jump.type, ...at(measure.jump.location, 'end') });
  for (const tempo of measure.tempos ?? [])
    out.push({
      kind: 'tempo',
      bpm: tempo.bpm,
      base: tempo.value.base,
      ...(tempo.value.dots ? { dots: tempo.value.dots } : {}),
      ...at(tempo.location, 'start')
    });
  for (const harmony of measure._x?.mnxLab?.harmonies ?? [])
    out.push({
      kind: 'harmony',
      text: harmony.text ?? renderChordSymbol(harmony),
      ...at(harmony.location, 'start')
    });
  if (measure.rehearsal?.label !== undefined)
    out.push({ kind: 'rehearsal', label: measure.rehearsal.label });
  if (measure.section?.label !== undefined)
    out.push({ kind: 'section', label: measure.section.label });
  return out;
}

/**
 * The techniques a note DECLARES, read back into `TechniqueChoice` — the
 * reverse of the `setTechnique` writer, for the inspector's pills. A bend
 * curve reads as its stops; segment weights are recovered as the smallest
 * integer ratio (capped at 4), and when the stored positions do not fit one —
 * a curve authored elsewhere — the choice is marked `approx`.
 */
export function readTechniques(note: MnxNote | undefined): TechniqueChoice[] {
  const technique = note?._x?.mnxLab?.tab?.technique;
  if (!technique) return [];
  const out: TechniqueChoice[] = [];
  const bend = technique.bend;
  if (bend && bend.points.length > 0) {
    const points = [...bend.points].sort((a, b) => a.position - b.position);
    // A lone point is not a curve; read it as the rise it means.
    const alters = points.length === 1 ? [0, points[0]!.alter] : points.map(p => p.alter);
    const spans = points.length === 1
      ? [1]
      : points.slice(1).map((p, i) => p.position - points[i]!.position);
    const smallest = Math.min(...spans.filter(d => d > 0));
    const weights = spans.map(d =>
      d <= 0 ? 1 : Math.max(1, Math.min(4, Math.round(d / smallest)))
    );
    // Would the writer, handed these weights, land the points where they are?
    const total = weights.reduce((a, b) => a + b, 0);
    let cum = 0;
    const approx =
      points.length > 1 &&
      points.slice(1).some((p, i) => {
        cum += weights[i]!;
        return Math.abs(cum / total - p.position) > 1e-6;
      });
    out.push({
      kind: 'bend',
      alters,
      ...(weights.some(w => w > 1) ? { weights } : {}),
      ...(approx ? { approx: true } : {})
    });
  }
  for (const kind of ['slide', 'hammerPull', 'vibrato', 'palmMute', 'harmonic'] as const) {
    if (technique[kind] !== undefined && technique[kind] !== false) out.push({ kind });
  }
  return out;
}

/**
 * The positioned attributes at ONE metric position of a part-measure, read
 * back into the typed union with their index in the owning array — the
 * reverse of the `setPositioned` writer, for the inspector's pills.
 */
export function readPositionedAttributes(
  doc: MnxStructure,
  address: { partIndex: number; staffIndex: number; measureIndex: number },
  onset: [number, number]
): { attribute: PositionedAttribute; index: number }[] {
  const measure = doc.parts?.[address.partIndex]?.measures?.[address.measureIndex];
  if (!measure) return [];
  const here = (entry: { position?: { fraction: [number, number] }; staff?: number }) => {
    const [num, den] = entry.position?.fraction ?? [0, 1];
    return num * onset[1] === onset[0] * den && (entry.staff ?? 1) === address.staffIndex;
  };
  const out: { attribute: PositionedAttribute; index: number }[] = [];
  (measure.dynamics ?? []).forEach((entry, index) => {
    if (!here(entry)) return;
    out.push({
      index,
      attribute: {
        kind: 'dynamic',
        ...(entry.value ? { value: entry.value } : {}),
        ...(entry.glyphs ? { glyphs: entry.glyphs } : {}),
        ...(entry.type !== 'immediate' ? { dynamicType: entry.type } : {}),
        ...(entry.wedgeType ? { wedgeType: entry.wedgeType } : {}),
        ...(entry.relativeValue ? { relativeValue: entry.relativeValue } : {})
      }
    });
  });
  (measure.directions ?? []).forEach((entry, index) => {
    if (!here(entry)) return;
    out.push({
      index,
      attribute: {
        kind: 'direction',
        text: entry.text ?? '',
        ...((entry as { glyphs?: string[] }).glyphs?.length ? { glyphs: (entry as { glyphs?: string[] }).glyphs } : {}),
        ...(entry.orient && entry.orient !== 'auto' ? { orient: entry.orient } : {})
      }
    });
  });
  (measure.arpeggios ?? []).forEach((entry, index) => {
    if (!here(entry)) return;
    out.push({
      index,
      attribute: {
        kind: 'arpeggio',
        ...(entry.direction === 'up' || entry.direction === 'down' ? { direction: entry.direction } : {}),
        ...(entry.arrow ? { arrow: true } : {})
      }
    });
  });
  (measure.nonArpeggios ?? []).forEach((entry, index) => {
    if (here(entry)) out.push({ index, attribute: { kind: 'nonArpeggio' } });
  });
  (measure.ottavas ?? []).forEach((entry, index) => {
    if (!here(entry)) return;
    const endIndex = doc.global?.measures?.findIndex(m => m.id === entry.end?.measure) ?? -1;
    const bars = endIndex >= 0 ? endIndex - address.measureIndex + 1 : 1;
    out.push({
      index,
      attribute: { kind: 'ottava', value: entry.value as 1 | 2 | 3 | -1 | -2 | -3, ...(bars > 1 ? { bars } : {}) }
    });
  });
  return out;
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

/** A measure REFERENCE mints its anchor (the paste planner's rule, applied to
 *  the presentation layer). Scores name measures by id, but a document built
 *  from `{}` has none — so a bar the user names as `m<N>`, meaning the Nth
 *  bar, gets that id if it is carrying none. An id that already exists is
 *  used as it stands, so hand-authored ids are never rewritten. */
function ensureMeasureRef(doc: MnxStructure, ref: string): void {
  if (doc.global?.measures?.some(measure => measure.id === ref)) return;
  const nth = /^m(\d+)$/.exec(ref);
  if (!nth) return;
  const measure = doc.global?.measures?.[Number(nth[1]) - 1];
  if (measure && measure.id === undefined) measure.id = ref;
}

export function applyOp(doc: MnxStructure, op: EditOp): MnxStructure {
  if (op.type === 'batch') return op.ops.reduce(applyOp, doc);
  if (op.type === 'pasteSelection' || op.type === 'cutSelection')
    return JSON.parse(JSON.stringify(op.document)) as MnxStructure;
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
      const address = findNoteAddress(next, op.noteId);
      if (!address) return next;
      // The fingerboard is the OWNING part's: a fret is a place on the strings
      // in front of you, so re-fretting a note in part 2 against part 0's
      // tuning sounded a pitch nobody played.
      const midi = fingerboardMidi(next, op.string, op.fret, address.partIndex);
      const x = ((address.note._x ??= {}).mnxLab ??= {});
      x.string = op.string;
      x.fret = op.fret;
      if (midi !== undefined) setPitchFromMidi(address.note, midi);
      return next;
    }
    case 'insertNote': {
      const seq = entrySequence(next, op.measureIndex, op);
      if (!seq) return next;
      const midi = fingerboardMidi(next, op.string, op.fret, op.partIndex);
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
        // Per VOICE, not per staff: the invariant was written when a staff
        // had one, and a second voice underfilling is the same defect.
        padMeasureRests(next, op.measureIndex, op);
      }
      return next;
    }
    case 'insertPitchNote': {
      const seq = entrySequence(next, op.measureIndex, op);
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
        padMeasureRests(next, op.measureIndex, op);
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
    case 'removeEvent': {
      const address = op.event;
      const event = eventAtAddress(next, address);
      if (!event || eventHasInk(event)) return next; // guarded: empty things only
      const sequences = (
        next.parts?.[address.partIndex]?.measures?.[address.measureIndex]?.sequences ?? []
      ).filter(sequence => (sequence.staff ?? 1) === address.staffIndex);
      const seq = sequences[address.voiceIndex];
      if (!seq) return next;
      if (address.containerIndex === undefined) {
        seq.content.splice(address.eventIndex, 1);
        return next;
      }
      // Inside a tuplet or a tremolo: the CONTAINER owns its own content, and
      // emptying it is `removeContainer`'s job, not ours.
      const inner = (seq.content[address.eventIndex] as { content?: MnxSequenceItem[] }).content;
      if (!inner || inner.length <= 1) return next;
      inner.splice(address.containerIndex, 1);
      return next;
    }
    case 'clearEvent': {
      const event = eventAtAddress(next, op.event);
      if (!event) return next;
      const noteIds = (event.notes ?? []).flatMap(note => note.id ? [note.id] : []);
      const eventId = event.id;
      delete event.notes;
      delete (event as { kitNotes?: unknown[] }).kitNotes;
      delete event.lyrics;
      delete event.markings;
      delete event.slurs;
      event.rest = {};
      for (const noteId of noteIds) unlinkReferences(next, noteId, undefined);
      if (eventId) unlinkReferences(next, undefined, eventId);
      return next;
    }
    case 'setClef': {
      const staffIndex = op.staffIndex ?? 1;
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      const clef = {
        clef: {
          sign: op.sign,
          ...(op.staffPosition !== undefined ? { staffPosition: op.staffPosition } : {}),
          ...(op.octave ? { octave: op.octave } : {})
        },
        // Named only when it is not the default, as the corpus writes it.
        ...(staffIndex === 1 ? {} : { staff: staffIndex })
      };
      // One declaration per measure PER STAFF: overwrite this staff's
      // measure-start clef rather than stacking a second beside it.
      const existing = (measure.clefs ?? []).findIndex(
        entry => (entry.staff ?? 1) === staffIndex && entry.position === undefined
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
      // Without an index the first entry is replaced (what the popover always
      // did); with one, that entry — and the length appends a new mark.
      if (field === 'tempos') {
        const tempos = [...((measure.tempos as unknown[] | undefined) ?? [])];
        const at = Math.min(op.index ?? 0, tempos.length);
        tempos[at] = value;
        measure.tempos = tempos;
      } else if (field === 'harmonies') {
        // The vendor block: `_x.mnxLab.harmonies`, an array like `tempos`.
        const x = ((measure._x ??= {}) as { mnxLab?: { harmonies?: unknown[] } });
        const lab = (x.mnxLab ??= {});
        const harmonies = [...(lab.harmonies ?? [])];
        harmonies[Math.min(op.index ?? 0, harmonies.length)] = value;
        lab.harmonies = harmonies;
      } else measure[field] = value;
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
      if (field === 'harmonies') {
        const x = measure._x as { mnxLab?: { harmonies?: unknown[] } } | undefined;
        const kept = (x?.mnxLab?.harmonies ?? []).filter((_, i) => i !== (op.index ?? 0));
        if (!x?.mnxLab) return next;
        if (kept.length > 0) x.mnxLab.harmonies = kept;
        else {
          // No tombstones: emptied vendor containers go with their last key.
          delete x.mnxLab.harmonies;
          if (Object.keys(x.mnxLab).length === 0) delete x.mnxLab;
          if (Object.keys(x).length === 0) delete measure._x;
        }
        return next;
      }
      delete measure[field];
      return next;
    }
    case 'setDuration': {
      const seq = entrySequence(next, op.measureIndex, op);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (found?.event) {
        found.event.duration = { ...op.duration };
        // Shrinking opens a gap at the end (later events slide earlier) —
        // pad it; growing eats trailing rests instead.
        padMeasureRests(next, op.measureIndex, op);
      }
      return next;
    }
    case 'nudgeRest': {
      const seq = entrySequence(next, op.measureIndex, op);
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
    case 'retargetSlur': {
      const located = findKeyedNote(next, op.noteKey);
      const to = findKeyedNote(next, op.toNoteKey);
      if (!located || !to) return next;
      const event = located.event;
      const slur = (event.slurs ?? []).find(candidate => slurStartsAt(candidate, event, located.note));
      if (!slur || to.event === event) return next;
      to.event.id ??= mintEventId(next);
      slur.target = to.event.id;
      // Re-pin or un-pin the far end to match the new target's shape.
      if (slur.endNote !== undefined || (to.event.notes?.length ?? 0) > 1) {
        to.note.id ??= mintNoteId(next);
        slur.endNote = to.note.id;
      } else {
        delete slur.endNote;
      }
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
          // the shape core-guitar-technique.md settled, written as its stops
          // (core-bend-stops.md). Positions come from the cumulative segment
          // weights; absent weights, segments are even.
          {
            const alters = op.technique.alters;
            if (alters.length < 2) return next;
            const weights = op.technique.weights ?? alters.slice(1).map(() => 1);
            const total = weights.reduce((a, b) => a + b, 0);
            let cum = 0;
            technique.bend = {
              points: alters.map((alter, i) => ({
                position: i === 0 ? 0 : (cum += weights[i - 1] ?? 1) / total,
                alter
              }))
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
          // hammerPull / slide travel to the FOLLOWING note — any pitch;
          // same string preferred (`techniqueTarget`) — minting its id the
          // way `toggleTie` does.
          const target = techniqueTarget(next, located);
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
    case 'setStringAnnotation': {
      const located = findKeyedNote(next, op.noteKey);
      if (!located) return next;
      const x = ((located.note._x ??= {}).mnxLab ??= {});
      x.string = op.string;
      delete x.fret; // derived from the choice, so never stored beside it
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
      const holdsInk = (item.content ?? []).some(event => eventHasInk(event));
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
    case 'addVoiceMeasure': {
      const staffIndex = op.staffIndex ?? 1;
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      measure.sequences ??= [];
      // The new voice is the next ordinal on ITS staff — appending to the raw
      // array cannot disturb the other staff's numbering, which counts its own.
      const voiceIndex = measure.sequences.filter(s => (s.staff ?? 1) === staffIndex).length;
      measure.sequences.push(newSequence(staffIndex));
      // Full from birth — the policy, in one line. See the op's declaration.
      padMeasureRests(next, op.measureIndex, {
        partIndex: op.partIndex,
        staffIndex: op.staffIndex,
        voiceIndex
      });
      return next;
    }
    case 'removeVoiceMeasure': {
      const measure = next.parts?.[op.partIndex]?.measures?.[op.measureIndex];
      const sequence = measure?.sequences?.[op.sequenceIndex];
      if (!measure || !sequence || sequence.content.some(itemHasInk)) return next;
      measure.sequences.splice(op.sequenceIndex, 1);
      return next;
    }
    case 'removePartMeasure': {
      const part = next.parts?.[op.partIndex];
      const measure = part?.measures?.[op.measureIndex];
      if (!part || !measure) return next;
      const onStaff = (measure.sequences ?? []).filter(
        sequence => (sequence.staff ?? 1) === op.staffIndex
      );
      if (onStaff.some(sequence => sequence.content.some(itemHasInk))) return next;
      if ((part.staves ?? 1) <= 1) {
        part.measures![op.measureIndex] = { sequences: [] };
        return next;
      }
      const sequences = (measure.sequences ?? []).filter(
        sequence => (sequence.staff ?? 1) !== op.staffIndex
      );
      measure.sequences = sequences;
      const onOtherStaff = <T extends { staff?: number }>(items: T[] | undefined): T[] | undefined => {
        const kept = (items ?? []).filter(item => (item.staff ?? 1) !== op.staffIndex);
        return kept.length > 0 ? kept : undefined;
      };
      const clefs = (measure.clefs ?? []).filter(clef => (clef.staff ?? 1) !== op.staffIndex);
      if (clefs.length > 0) measure.clefs = clefs;
      else delete measure.clefs;
      const dynamics = (measure.dynamics ?? []).filter(dynamic =>
        (dynamic.staff ?? 1) !== op.staffIndex && dynamic.staffEnd !== op.staffIndex
      );
      if (dynamics.length > 0) measure.dynamics = dynamics;
      else delete measure.dynamics;
      const directions = onOtherStaff(measure.directions);
      if (directions) measure.directions = directions;
      else delete measure.directions;
      const ottavas = onOtherStaff(measure.ottavas);
      if (ottavas) measure.ottavas = ottavas;
      else delete measure.ottavas;
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
    case 'setLayout': {
      const layouts = (next.layouts ??= []);
      // Past the end appends: the grammar counts from 1 and a user naming the
      // next free slot means "make one", not "fail".
      layouts[Math.min(op.index, layouts.length)] = JSON.parse(JSON.stringify(op.layout)) as MnxLayout;
      return next;
    }
    case 'setScore': {
      const scores = (next.scores ??= []);
      const score = JSON.parse(JSON.stringify(op.score)) as MnxScore;
      for (const page of score.pages ?? [])
        for (const system of page.systems ?? []) {
          ensureMeasureRef(next, system.measure);
          for (const change of system.layoutChanges ?? [])
            if (change.location.measure) ensureMeasureRef(next, change.location.measure);
        }
      scores[Math.min(op.index, scores.length)] = score;
      return next;
    }
    case 'addMultimeasureRest': {
      const score = next.scores?.[op.scoreIndex];
      if (!score) return next;
      ensureMeasureRef(next, op.start);
      (score.multimeasureRests ??= []).push({ start: op.start, duration: op.duration });
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
      // The part being read, not the first one — `removePartDeclaration` has
      // taken `partIndex` since item 13b and this half had not caught up.
      const part = next.parts?.[op.partIndex ?? 0];
      if (!part) return next;
      if (op.declaration.kind === 'staves') part.staves = op.declaration.value;
      else if (op.declaration.kind === 'name') part.name = op.declaration.value;
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
      const event = markingEvent(next, op);
      if (!event) return next;
      ((event.markings ??= {}) as Record<string, unknown>)[op.marking] = { ...(op.attributes ?? {}) };
      return next;
    }
    case 'setFermata': {
      const event = markingEvent(next, op);
      if (!event) return next;
      event.fermata = { ...op.fermata };
      return next;
    }
    case 'removeFermata': {
      const event = markingEvent(next, op);
      if (!event || event.fermata === undefined) return next;
      delete event.fermata;
      return next;
    }
    case 'removeMarking': {
      const event = markingEvent(next, op);
      if (!event) return next;
      const markings = event.markings as Record<string, unknown> | undefined;
      if (!markings || markings[op.marking] === undefined) return next;
      delete markings[op.marking];
      // No tombstone: an emptied container goes with its last member.
      if (Object.keys(markings).length === 0) delete event.markings;
      return next;
    }
    case 'setPositioned': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      const position = { fraction: [op.onset[0], op.onset[1]] as [number, number] };
      // Named only when it is not the default, as everywhere else.
      const onStaff = (op.staffIndex ?? 1) === 1 ? {} : { staff: op.staffIndex };
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
          { position, value: op.attribute.value, end: { measure: measureId, position }, ...onStaff }
        ];
        return next;
      }
      if (op.attribute.kind === 'arpeggio' || op.attribute.kind === 'nonArpeggio') {
        // The chord at the cursor: this staff's voice, the timed event at
        // this onset. A rest or an empty slot has nothing to roll.
        const seq = (measure.sequences ?? []).filter(
          sequence => (sequence.staff ?? 1) === (op.staffIndex ?? 1)
        )[op.voiceIndex ?? 0];
        const found = seq ? eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] }) : undefined;
        const chord = found?.event?.notes;
        if (!chord || chord.length === 0) return next;
        // Bottom to top, as MNX spells the span.
        const ordered = [...chord].sort((a, b) => midiOf(a) - midiOf(b));
        for (const note of [ordered[0], ordered[ordered.length - 1]]) note.id ??= mintNoteId(next);
        const span = { start: ordered[0].id!, end: ordered[ordered.length - 1].id! };
        if (op.attribute.kind === 'arpeggio') {
          measure.arpeggios = [
            ...(measure.arpeggios ?? []),
            {
              position,
              span,
              ...(op.attribute.direction ? { direction: op.attribute.direction } : {}),
              ...(op.attribute.arrow ? { arrow: true } : {})
            }
          ];
        } else measure.nonArpeggios = [...(measure.nonArpeggios ?? []), { position, span }];
        return next;
      }
      if (op.attribute.kind === 'dynamic') {
        const entry: MnxDynamic = { position, type: op.attribute.dynamicType ?? 'immediate', ...onStaff };
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
            ...(op.attribute.glyphs?.length ? { glyphs: op.attribute.glyphs } : { text: op.attribute.text }),
            ...(op.attribute.orient ? { orient: op.attribute.orient } : {}),
            ...onStaff
          }
        ];
      }
      return next;
    }
    case 'removePositioned': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      if (!measure) return next;
      const record = measure as unknown as Record<string, unknown[] | undefined>;
      const field = POSITIONED_FIELDS[op.kind];
      const list = record[field];
      if (!list?.[op.index]) return next;
      const kept = list.filter((_, i) => i !== op.index);
      if (kept.length > 0) record[field] = kept;
      else delete record[field];
      return next;
    }
    case 'setBeam': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      // The run's own staff and voice: beaming a grand staff's lower part
      // used to name staff 1's events, or none at all. `beams` itself stays
      // on the PART-measure, where MNX puts it — one list, both staves.
      const seq = (measure?.sequences ?? []).filter(
        sequence => (sequence.staff ?? 1) === (op.staffIndex ?? 1)
      )[op.voiceIndex ?? 0];
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
    case 'extendBeam': {
      const measure = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex];
      const to = findKeyedNote(next, op.toNoteKey);
      if (!measure?.beams || op.path.length === 0 || !to) return next;
      if (to.measureIndex !== op.measureIndex) return next; // one measure per beam
      let owner: { beams?: MnxBeam[] } = measure;
      for (const step of op.path.slice(0, -1)) {
        const child = owner.beams?.[step];
        if (!child) return next;
        owner = child;
      }
      const beam = owner.beams?.[op.path[op.path.length - 1]];
      if (!beam) return next;
      to.event.id ??= mintEventId(next);
      if (beam.events.includes(to.event.id)) return next;
      beam.events = [...beam.events, to.event.id];
      return next;
    }
    case 'setSupport': {
      ensureSkeleton(next);
      const support = (next.mnx.support ??= {});
      if (op.value) support[op.key] = true;
      else {
        delete support[op.key];
        // No tombstone: an emptied declaration goes with its last member.
        if (Object.keys(support).length === 0) delete next.mnx.support;
      }
      return next;
    }
    case 'setContainerProperties': {
      const item = next.parts?.[op.partIndex ?? 0]?.measures?.[op.measureIndex]
        ?.sequences?.[op.sequenceIndex]?.content?.[op.index];
      if (!item || !('type' in item)) return next;
      const patch = op.properties ?? {};
      const clear = new Set(op.clear ?? []);
      if (item.type === 'tuplet') {
        if (patch.bracket !== undefined) item.bracket = patch.bracket;
        if (patch.showNumber !== undefined) item.showNumber = patch.showNumber;
        if (clear.has('bracket')) delete item.bracket;
        if (clear.has('showNumber')) delete item.showNumber;
      } else if (item.type === 'grace') {
        if (patch.slash !== undefined) item.slash = patch.slash;
        if (patch.graceType !== undefined) item.graceType = patch.graceType;
        if (clear.has('slash')) delete item.slash;
        if (clear.has('graceType')) delete item.graceType;
      } else if (item.type === 'tremolo') {
        if (patch.marks !== undefined) item.marks = patch.marks;
        if (clear.has('marks')) delete item.marks;
      }
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
      //
      // It pads THE SEQUENCE THE OP ADDRESSED, which `removeContainer` had to
      // learn inline: a container lives in any voice, and padding voice 0
      // instead left voice 2 three beats long in a 4/4 bar.
      const wrapRemainder = subtractOnsets(meterOf(next, op.measureIndex).span, voiceFill(seq));
      if (wrapRemainder.num > 0) seq.content.push(...restsSpanning(wrapRemainder));
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
      const seq = entrySequence(next, op.measureIndex, op);
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
      const part = next.parts?.[op.partIndex ?? 0];
      if (!part) return next;
      const x = ((part._x ??= {}).mnxLab ??= {});
      x.strings = op.tuning.map(t => ({ string: t.string, pitch: { ...t.pitch } }));
      return next;
    }
    case 'setStaffKind': {
      const part = next.parts?.[op.partIndex ?? 0];
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
      // positions ARE rests; the cursor walks them, digits convert them) —
      // in the part being written to. The bar is global, a part's copy of it
      // is not, so appending from part 2 used to pad part 1's copy and hand
      // the cursor an empty bar.
      padMeasureRests(next, next.global.measures.length - 1, { partIndex: op.partIndex });
      return next;
    }
    case 'addPart': {
      ensureSkeleton(next);
      const part: MnxPart = {
        ...(op.partId !== undefined ? { id: op.partId } : {}),
        ...(op.name !== undefined ? { name: op.name } : {}),
        measures: next.global.measures.map(() => ({ sequences: [{ content: [] }] }))
      };
      if (op.partIndex === undefined) next.parts.push(part);
      else next.parts.splice(Math.min(Math.max(op.partIndex, 0), next.parts.length), 0, part);
      // Only the entry surface (parts[0]) holds the full-bar invariant.
      if (next.parts.length === 1) {
        for (let i = 0; i < next.global.measures.length; i++) padMeasureRests(next, i);
      }
      return next;
    }
    case 'insertEvent': {
      const seq = entrySequence(next, op.measureIndex, op);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (!found) return next;
      const note: MnxNote = { pitch: { ...op.pitch } };
      if (op.string !== undefined)
        note._x = { mnxLab: { string: op.string, ...(op.fret !== undefined ? { fret: op.fret } : {}) } };
      // AFTER means past the event AND past any grace container that follows
      // it — a grace belongs to the note it precedes, so landing in front of
      // one would steal it from its host (the `pastGraceContainers` rule that
      // ordinary entry already follows).
      const at =
        op.side === 'before' || !found.event
          ? found.index
          : pastGraceContainers(seq, found.index + 1);
      seq.content.splice(at, 0, { duration: { ...op.duration }, notes: [note] });
      // NO `padMeasureRests` — see the op's declaration. The bar is allowed to
      // overfill, and the badge is the report.
      return next;
    }
    case 'insertMeasure': {
      const measures = next.global?.measures;
      if (!measures?.[op.measureIndex]) return next;
      // The index the new bar TAKES, against the timeline as it stands now —
      // which is what `widenSpansCovering` has to read, so it runs first.
      const at = op.side === 'before' ? op.measureIndex : op.measureIndex + 1;
      widenSpansCovering(next, at);
      measures.splice(at, 0, {});
      for (const part of next.parts ?? []) part.measures?.splice(at, 0, { sequences: [{ content: [] }] });
      // Beat rests for the part being written to (§8.11), as `appendMeasure`.
      padMeasureRests(next, at, { partIndex: op.partIndex });
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
      const partIndex = op.partIndex ?? 0;
      const part = next.parts?.[partIndex];
      if (!part || partHasInk(part)) return next;
      next.parts.splice(partIndex, 1);
      return dissolveIfHollow(next);
    }
  }
}

/**
 * THE ONE THING AN INSERT CAN BREAK SILENTLY.
 *
 * Every cross-reference in the model is id-based and therefore survives a
 * splice untouched: ties name `note.id`, slurs and beams name event ids, an
 * ottava's `end.measure` and a score's `systems[].measure` name measure ids.
 * Three fields are not — each is a **bar count anchored at a start bar**, so a
 * bar inserted inside its reach would leave it covering one bar less of the
 * music it was written about, with nothing to say so:
 *
 *   - `ending.duration`          how many bars the volta spans
 *   - `measureRepeat.number`     how many bars are repeated
 *   - `multimeasureRests[].duration`  how many bars collapse into the H-bar
 *
 * A span starting at `s` and lasting `d` covers `s … s+d-1`, so the new bar
 * lands INSIDE it exactly when `s < at <= s+d-1`, and the span grows by one to
 * keep covering the same music. Landing before the start needs nothing (the
 * declaration rides its own measure through the splice) and landing after the
 * end needs nothing either.
 *
 * Read against the PRE-SPLICE timeline, which is why the caller runs this
 * first. The objects are mutated in place, so they survive the splice.
 *
 * `removeMeasure` has the mirror of this gap and does NOT narrow — noted, not
 * fixed here: removal is guarded on ink but not on spans, which is its own
 * question and its own change.
 */
function widenSpansCovering(doc: MnxStructure, at: number): void {
  const covers = (start: number, span: number | undefined): boolean =>
    span !== undefined && start < at && at <= start + span - 1;

  const measures = doc.global?.measures ?? [];
  measures.forEach((measure, start) => {
    const ending = measure.ending;
    if (ending && covers(start, ending.duration)) ending.duration = ending.duration! + 1;
  });

  for (const part of doc.parts ?? []) {
    (part.measures ?? []).forEach((measure, start) => {
      const repeat = (measure as MnxPartMeasure & { measureRepeat?: { number: number } })
        .measureRepeat;
      if (repeat && covers(start, repeat.number)) repeat.number += 1;
    });
  }

  for (const score of doc.scores ?? []) {
    for (const rest of score.multimeasureRests ?? []) {
      const start = measures.findIndex(measure => measure.id === rest.start);
      if (start >= 0 && covers(start, rest.duration)) rest.duration += 1;
    }
  }
}

/** Any pitched or kit ink in any part's copy of this bar? */
export function measureHasInk(doc: MnxStructure, measureIndex: number): boolean {
  for (const part of doc.parts ?? []) {
    for (const seq of part.measures?.[measureIndex]?.sequences ?? []) {
      for (const item of seq.content ?? []) {
        if (itemHasInk(item)) return true;
      }
    }
  }
  return false;
}

/** Any pitched or kit ink anywhere in the part? */
export function partHasInk(part: MnxPart): boolean {
  for (const measure of part.measures ?? []) {
    for (const seq of measure.sequences ?? []) {
      for (const item of seq.content ?? []) {
        if (itemHasInk(item)) return true;
      }
    }
  }
  return false;
}

function eventHasInk(event: MnxEvent): boolean {
  const kitNotes = (event as { kitNotes?: unknown[] }).kitNotes;
  return (event.notes?.length ?? 0) > 0 || (kitNotes?.length ?? 0) > 0;
}

/** Ink inside an authored container is still ink owned by its bar and part. */
function itemHasInk(item: MnxSequenceItem): boolean {
  if (isTimedEvent(item)) return eventHasInk(item);
  const content = (item as { content?: MnxEvent[] }).content ?? [];
  return content.some(event => eventHasInk(event));
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

function padMeasureRests(doc: MnxStructure, measureIndex: number, target: EntryTarget = {}): void {
  const seq = entrySequence(doc, measureIndex, target);
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
  /** Where the note actually lives — carried so the verbs that look at its
   *  NEIGHBOURS (the next bar's same voice) look in the right part and staff
   *  rather than assuming the entry surface's old one. */
  partIndex: number;
  staffIndex: number;
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
    partIndex: address.partIndex,
    staffIndex: address.staffIndex,
    measureIndex: address.measureIndex,
    voiceIndex: address.voiceIndex,
    eventIndex: address.eventIndex,
    event: address.event,
    note: address.note
  };
}

/** Resolve the event-owning side of a marking op. Point edits retain their
 * note-key address; range edits use the structural event address so rests are
 * first-class targets instead of silently dropping out of the command. */
export function eventAtAddress(doc: MnxStructure, address: EventAddress): MnxEvent | null {
  const sequences = doc.parts?.[address.partIndex]?.measures?.[address.measureIndex]?.sequences ?? [];
  const sequence = sequences.filter(seq => (seq.staff ?? 1) === address.staffIndex)[address.voiceIndex];
  const item = sequence?.content?.[address.eventIndex];
  if (!item) return null;
  if (address.containerIndex === undefined) return isTimedEvent(item) ? item : null;
  const content = (item as { content?: unknown[] }).content;
  const inner = content?.[address.containerIndex] as MnxSequenceItem | undefined;
  return inner && isTimedEvent(inner) ? inner : null;
}

function markingEvent(
  doc: MnxStructure,
  op: Extract<EditOp, { type: 'setMarking' | 'removeMarking' | 'setFermata' | 'removeFermata' }>
): MnxEvent | null {
  if (op.event) return eventAtAddress(doc, op.event);
  return op.noteKey ? findKeyedNote(doc, op.noteKey)?.event ?? null : null;
}

function samePitch(a: MnxNote, b: MnxNote): boolean {
  return (
    a.pitch.step === b.pitch.step &&
    a.pitch.octave === b.pitch.octave &&
    (a.pitch.alter ?? 0) === (b.pitch.alter ?? 0)
  );
}

/** The same pitch in the immediately following timed event — this voice's
 *  next event, else the next measure's same-voice first event.
 *
 *  "Same voice" means the note's OWN part and staff: reading part 0 staff 1
 *  for a note that lives elsewhere tied it across to a stranger's music. */
function tieTarget(doc: MnxStructure, located: LocatedNote): MnxNote | undefined {
  for (let i = located.eventIndex + 1; i < located.seq.content.length; i++) {
    const item = located.seq.content[i];
    if (!isTimedEvent(item)) continue;
    return (item.notes ?? []).find(n => samePitch(n, located.note));
  }
  const nextMeasure = doc.parts?.[located.partIndex]?.measures?.[located.measureIndex + 1];
  const seq = (nextMeasure?.sequences ?? []).filter(
    s => (s.staff ?? 1) === located.staffIndex
  )[located.voiceIndex];
  for (const item of seq?.content ?? []) {
    if (!isTimedEvent(item)) continue;
    return (item.notes ?? []).find(n => samePitch(n, located.note));
  }
  return undefined;
}

/** The note a TECHNIQUE travels to: the first timed event after this note in
 *  its own voice (crossing the barline like `tieTarget`), choosing the next
 *  event's note on the SAME STRING when both carry the annotation — a
 *  hammer-on, pull-off or slide is one finger staying on one string — else a
 *  same-pitch note, else the event's first note.
 *
 *  This is deliberately NOT `tieTarget`: a tie connects equal pitches, but a
 *  technique's whole point is travelling between different frets, and
 *  resolving through the tie rule made `h` refuse the canonical ascending
 *  hammer-on while classifying the meaningless equal-fret case as a pull-off
 *  (found hands-on, 2026-08-30). */
function techniqueTarget(doc: MnxStructure, located: LocatedNote): MnxNote | undefined {
  // On a declared fingerboard the search is BY STRING, as far forward as it
  // takes: a hammer-on, pull-off or slide is one finger staying on one
  // string, so an intervening event on another string is skipped, not
  // targeted (found hands-on, 2026-08-30 — `h` grabbed the next event's
  // other-string note). The string is the note's EFFECTIVE one — the
  // annotation when stored, else the derivation ladder's lowest-playable
  // choice (`defaultStringFor`, the renderer's own rule), because a bare
  // note has a string on the page even though the document never wrote it
  // (second hands-on find, same day). Without a fingerboard, the next event
  // decides: same pitch preferred, else its first note.
  const part = doc.parts?.[located.partIndex];
  const tuning = tuningOf(part);
  const capo = capoOf(part);
  const effectiveString = (note: MnxNote): number | undefined =>
    note._x?.mnxLab?.string ??
    (tuning.length > 0 ? defaultStringFor(note.pitch, tuning, capo) : undefined);
  const string = effectiveString(located.note);
  const sequencesOf = (measureIndex: number) =>
    (doc.parts?.[located.partIndex]?.measures?.[measureIndex]?.sequences ?? []).filter(
      s => (s.staff ?? 1) === located.staffIndex
    )[located.voiceIndex];
  if (string !== undefined) {
    const measureCount = doc.parts?.[located.partIndex]?.measures?.length ?? 0;
    for (let measureIndex = located.measureIndex; measureIndex < measureCount; measureIndex++) {
      const seq = measureIndex === located.measureIndex ? located.seq : sequencesOf(measureIndex);
      const from = measureIndex === located.measureIndex ? located.eventIndex + 1 : 0;
      for (let i = from; i < (seq?.content.length ?? 0); i++) {
        const item = seq!.content[i];
        if (!isTimedEvent(item)) continue;
        const sameString = (item.notes ?? []).find(n => effectiveString(n) === string);
        if (sameString) return sameString;
      }
    }
    return undefined;
  }
  const pick = (notes: MnxNote[]): MnxNote | undefined =>
    notes.find(n => samePitch(n, located.note)) ?? notes[0];
  for (let i = located.eventIndex + 1; i < located.seq.content.length; i++) {
    const item = located.seq.content[i];
    if (!isTimedEvent(item)) continue;
    return pick(item.notes ?? []);
  }
  for (const item of sequencesOf(located.measureIndex + 1)?.content ?? []) {
    if (!isTimedEvent(item)) continue;
    return pick(item.notes ?? []);
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
  // A tremolo's two events are each WRITTEN with the tremolo's total duration
  // (the model says so, and both corpus tremolos hold it: halves for a
  // half-long tremolo, wholes for a whole-long one). So the wrap writes that
  // rather than leaving whatever the notes were entered as — the value is a
  // property of the object, not of how the author got there.
  if (spec.type === 'tremolo' && spec.outer) {
    const total = noteValueForSpan({
      num: durationSpan(spec.outer.duration).num * (spec.outer.multiple ?? 2),
      den: durationSpan(spec.outer.duration).den
    });
    if (total) content.forEach(event => (event.duration = { base: total }));
  }
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
  if (partial.type === 'tremolo' && partial.outer)
    return {
      type: 'tremolo',
      ...(partial.marks === undefined ? {} : { marks: partial.marks }),
      outer: partial.outer
    };
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
export type ContainerPropertyField = 'bracket' | 'showNumber' | 'slash' | 'graceType' | 'marks';

/** The amendable (presentation) fields of the three containers. */
export interface ContainerPropertyPatch {
  bracket?: 'yes' | 'no' | 'auto';
  showNumber?: 'noNumber' | 'inner' | 'both';
  slash?: boolean;
  graceType?: 'makeTime' | 'stealFollowing' | 'stealPrevious';
  marks?: number;
}

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
): ({ measureIndex: number; from: number; to: number } & EntryTarget) | null {
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
  return beamable >= 2
    ? {
        measureIndex: from.measureIndex,
        from: start,
        to: end,
        // The run carries its OWN address, so the caller never has to guess
        // it — and defaults stay unspoken, so no committed trace moves.
        ...(from.partIndex ? { partIndex: from.partIndex } : {}),
        ...(from.staffIndex !== 1 ? { staffIndex: from.staffIndex } : {}),
        ...(from.voiceIndex ? { voiceIndex: from.voiceIndex } : {})
      }
    : null;
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
  const target = techniqueTarget(doc, located);
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

/** Does a slur END at this note's event? Returns the start-note key that
 *  `removeSlur`/`retargetSlur` address, so the press-at-the-end gesture can
 *  find its owner (core-selection-range-grain.md decision 5). */
export function slurEndingAt(
  doc: MnxStructure,
  noteKey: string
): { ownerNoteKey: string } | null {
  const located = findKeyedNote(doc, noteKey);
  const targetId = located?.event.id;
  if (!targetId) return null;
  let found: { ownerNoteKey: string } | null = null;
  const visitEvent = (
    event: MnxEvent,
    measureIndex: number,
    voiceIndex: number,
    eventIndex: number,
    inContainer: boolean
  ): void => {
    for (const slur of event.slurs ?? []) {
      if (slur.target !== targetId) continue;
      // The owner key `removeSlur`/`retargetSlur` resolve: an id when the
      // note has one, else the layouts' own synthetic key. The synthetic
      // form encodes the top-level staff-1 walk, so an id-less note inside
      // a container cannot be addressed here and is skipped.
      const owner =
        slur.startNote ??
        event.notes?.[0]?.id ??
        (inContainer ? undefined : syntheticNoteKey(measureIndex, voiceIndex, eventIndex, 0));
      if (owner !== undefined) found = { ownerNoteKey: owner };
    }
  };
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      const measureIndex = part.measures!.indexOf(measure);
      const voiceByStaff = new Map<number, number>();
      for (const sequence of measure.sequences ?? []) {
        const staffIndex = sequence.staff ?? 1;
        const voiceIndex = (voiceByStaff.get(staffIndex) ?? -1) + 1;
        voiceByStaff.set(staffIndex, voiceIndex);
        sequence.content.forEach((item, eventIndex) => {
          if (isTimedEvent(item)) visitEvent(item, measureIndex, voiceIndex, eventIndex, false);
          else for (const child of (item as { content?: MnxSequenceItem[] }).content ?? []) {
            if (isTimedEvent(child)) visitEvent(child, measureIndex, voiceIndex, eventIndex, true);
          }
        });
      }
    }
  }
  return found;
}

/** Does a beam END at this note's event? The removal/extension address, the
 *  mirror of `beamStartingAt` below. */
export function beamEndingAt(
  doc: MnxStructure,
  noteKey: string
): { measureIndex: number; path: number[]; partIndex: number } | null {
  const located = findKeyedNote(doc, noteKey);
  if (!located?.event.id) return null;
  const eventId = located.event.id;
  const partIndex = findNoteAddress(doc, noteKey)?.partIndex ?? 0;
  const beams = doc.parts?.[partIndex]?.measures?.[located.measureIndex]?.beams ?? [];
  let best: number[] | null = null;
  const visit = (list: MnxBeam[], prefix: number[]): void => {
    list.forEach((beam, index) => {
      const path = [...prefix, index];
      const last = beam.events?.[beam.events.length - 1];
      if (last === eventId && (best === null || path.length > best.length)) best = path;
      visit(beam.beams ?? [], path);
    });
  };
  visit(beams, []);
  return best === null ? null : { measureIndex: located.measureIndex, path: best, partIndex };
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

/** What (string, fret) sounds under THIS part's (or standard) tuning. */
function fingerboardMidi(
  doc: MnxStructure,
  string: number,
  fret: number,
  partIndex = 0
): number | undefined {
  const part = doc.parts?.[partIndex];
  const open = tuningOf(part).find(t => t.string === string);
  // Frets are capo-relative, so the sounding pitch includes the capo shift.
  return open ? midiOfPitch(open.pitch) + capoOf(part) + fret : undefined;
}

/**
 * THE ENTRY SURFACE: the sequence a write lands in — `target`'s voice of its
 * staff in its part's copy of this bar. An absent field means the first of
 * its kind, so `entrySequence(doc, m)` still means what it always did.
 *
 * Voice 0 is created on demand, as it always was, and now for a staff that
 * has no sequence yet as well: standing on a grand staff's lower staff and
 * typing must write THERE, not silently into the upper one.
 *
 * A voice BEYOND the first is never a side effect of typing —
 * `addVoiceMeasure` is the verb, and it creates the voice full of rests. That
 * is the whole of the creation policy: entry finds real events wherever the
 * cursor can stand, so it never has to decide what an empty voice means.
 *
 * Voices are counted PER STAFF (as `buildGrid`, `noteWalk` and the selection
 * members count them), so a staff-2 sequence never shifts staff 1's voice
 * numbers — the silent renumbering that would rewrite note keys corpus-wide.
 */
function entrySequence(
  doc: MnxStructure,
  measureIndex: number,
  target: EntryTarget = {}
): MnxSequence | undefined {
  const staffIndex = target.staffIndex ?? 1;
  const voiceIndex = target.voiceIndex ?? 0;
  const measure = doc.parts?.[target.partIndex ?? 0]?.measures?.[measureIndex];
  if (!measure) return undefined;
  measure.sequences ??= [];
  const existing = measure.sequences.filter(s => (s.staff ?? 1) === staffIndex)[voiceIndex];
  if (existing) return existing;
  if (voiceIndex > 0) return undefined;
  measure.sequences.push(newSequence(staffIndex));
  return measure.sequences[measure.sequences.length - 1];
}

/** A sequence on a staff. `staff` is written only when it is not the default
 *  — the corpus omits it for staff 1 and so do we, so a document built by
 *  entry reads like one a person wrote. */
function newSequence(staffIndex: number): MnxSequence {
  return staffIndex === 1 ? { content: [] } : { staff: staffIndex, content: [] };
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
 * (roadmap/complete/core-element-ops-destruct-sweep.md). Scans ALL parts:
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
