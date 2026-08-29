// The editor's intent vocabulary — roadmap/complete/core-editor-input-layer.md.
//
// Intents are the stable middle of the input layer: keymaps (experimental,
// churning) map keys to intents, and the session maps intents to cursor moves
// or EditOps. Trace fixtures are written in intents, NEVER keys, so they
// survive every rebinding and every future emulation preset.
import type {
  MeasureAttribute,
  MeasureAttributeKind,
  PartDeclaration,
  PartDeclarationKind,
  PositionedAttribute,
  TechniqueChoice
} from './ops.ts';
import type {
  MnxFermata, MnxLayout, MnxNoteValueBase, MnxScore, MnxTuningEntry } from '../model/mnx.ts';
import type { PartialContainerSpec } from './setupGrammar.ts';
import type { PastePlan } from './selectionPastePlanner.ts';
import type { CutPlan } from './selectionCutPlanner.ts';
import type { SelectionLevel } from './selection.ts';

/** Shared constraint for resolved tab-entry intents and their stage-1 resolver. */
export const MAX_ENTRY_FRET = 24;

/** Navigation: moves the cursor, never mutates the document. */
export type NavigationIntent =
  | { type: 'nextPosition' }
  | { type: 'prevPosition' }
  | { type: 'nextMeasure' }
  | { type: 'prevMeasure' }
  /** Down/up the vertical axis: strings in a tab part, the note stack else. */
  | { type: 'lineDown' }
  | { type: 'lineUp' }
  /** Jump to a bar (0-based), clamped — the go-to grammar's "12" (survey §3.8). */
  | { type: 'goToMeasure'; measureIndex: number }
  /**
   * Home / End — the first or last bar of the timeline.
   *
   * A keymap cannot name the last bar (it does not know how many there are),
   * so the edge is the intent and the session resolves it. This is what makes
   * "append a bar" an ordinary composition rather than its own verb: End puts
   * you on the last bar, and `I` at the measure rung inserts after it.
   */
  | { type: 'goToEdge'; edge: 'first' | 'last' }
  /** The selection ladder (roadmap/complete/core-selection-ladder.md): relax
   *  widens one rung (note → … → score; past the top the MOUNT deselects),
   *  tighten narrows back down the same containment chain. Navigation, not
   *  mutation — the ladder changes what the cursor addresses, never the doc. */
  | { type: 'relaxSelection' }
  | { type: 'tightenSelection' }
  /** The ladder's ABSOLUTE address (core-rung-addressing.md): go straight to a
   *  named rung, Shift+1..8 and every pointer surface alike. One intent per
   *  gesture, so the trace records the jump the user made rather than the N
   *  relax/tighten steps a walk happened to take — and the presence rule is
   *  enforced ONCE, here: a rung the document does not present is a refusal,
   *  never a walk that parks at whatever it could reach. */
  | { type: 'goToLevel'; level: SelectionLevel }
  /** Abandon an armed spanner anchor without touching the document. Escape's,
   *  and only Escape's: it used to ride inside `relaxSelection`, which meant
   *  Shift+↑ silently spent its first press cancelling instead of widening. */
  | { type: 'dropAnchor' }
  /** Horizontal selection is data too: Shift extends the active edge by the
   * rung's concrete unit (or to its end), while Ctrl/Meta+A records a live
   * closure rather than a frozen list of members. */
  | { type: 'extendSelection'; direction: 'previous' | 'next' | 'end' }
  | { type: 'closeSelection' }
  /** Turn the current derived section into the concrete measure interval it
   * names, so measure-rung commands can act on that range. */
  | { type: 'selectSectionRange' }
  /** The active projection: which SPACE the vertical line addresses (string
   *  vs staff position). Recorded so traces replay navigation faithfully. */
  | { type: 'setProjection'; projection: 'notation' | 'tab' }
  // The coincidence discriminator (core-note-address.md move 2): step between
  // notes that share this moment and line — voices, chord members the tab
  // derivation stacks on one string, and later grace notes.
  | { type: 'cycleSlot' }
  // Move the cursor to another part (campaign item 13b).
  | { type: 'setPart'; partIndex: number }
  | { type: 'setStaff'; staffIndex: number }
  /** The Ctrl climb (selection-ladder navigation map): the direction applied
   *  at the nearest ancestor rung where it means something different, then
   *  descend back. At note level: ←→ = bar jump (notation) / event-skip
   *  (tab), ↑↓ = voice jump. Never crosses the component boundary. */
  | { type: 'jumpNext' }
  | { type: 'jumpPrev' }
  | { type: 'jumpUp' }
  | { type: 'jumpDown' };

/** Mutation: becomes an EditOp against the cursor's position/note. */
export type MutationIntent =
  /** A resolved environment boundary, not a contextual `paste` verb. The
   *  complete deterministic result is recorded in traces, so replay never
   *  consults an app clipboard or replans against later state. */
  | { type: 'applyPastePlan'; plan: PastePlan }
  /** The resolved half of Cut after its clipboard write succeeded. Like
   *  paste, traces carry the materialized result rather than replaying an
   *  environment-dependent clipboard command. */
  | { type: 'applyCutPlan'; plan: CutPlan }
  /** A complete fret resolved by the mount's 500 ms digit-composition window:
   *  re-fret the note on the cursor's string, or INSERT one there. */
  | { type: 'enterFret'; fret: number }
  /** The notation projection's entry action: toggle a notehead at the
   *  cursor's (staff position × beat) cell — add the key-signature default
   *  pitch, or remove the note already there. The spatial-entry model of the
   *  selection-ladder navigation map (chords need no mode: the address
   *  disambiguates). */
  | { type: 'toggleNote' }
  /** Delete the note under the cursor (an emptied event becomes a rest). */
  | { type: 'delete' }
  /** Step the value of the event under the cursor (or, on an entry ghost,
   *  the session's pending entry duration) through the duration ladder. */
  | { type: 'shorterDuration' }
  | { type: 'longerDuration' }
  /** Tie the cursor's note to the same pitch in the next event; toggles. */
  | { type: 'toggleTie' }
  /** On a note: re-pitch by semitones. On a REST: nudge `staffPosition` by
   *  the sign — the §8.11 polymorphic verb (one key, per-type meaning). */
  | { type: 'transpose'; semitones: number }
  | { type: 'appendMeasure' }
  /**
   * INSERT AT THE RUNG — one intent, resolved by where the cursor is
   * (roadmap/proposed/core-rung-insert.md). `I` inserts after, `Shift+I`
   * before, and the same key means bar, part or voice depending on the rung,
   * which is the ladder's own promise.
   *
   * A rung with no insert REFUSES rather than falling back to a wider one: a
   * key that quietly acts on something bigger than you were addressing is the
   * failure this whole ladder exists to prevent. Rungs whose siblings have no
   * visible order (a chord is a set, a voice ordinal is identity) take `after`
   * only — there is nothing for `before` to mean.
   */
  | { type: 'insertAtRung'; side: 'before' | 'after' }
  /** Add a voice to the cursor's bar and staff, and MOVE INTO IT. The voice
   *  arrives padded to the meter, so what you step into is a bar of rests
   *  waiting to be typed over — see `addVoiceMeasure` in ops.ts for why that
   *  is the policy and not a convenience. Creating a voice you then have to
   *  find would be half a verb, so the move is part of the intent. */
  | { type: 'addVoiceMeasure' }
  // Setup-as-ops (roadmap: "setup is ops, not chrome"): document genesis
  // choices flow through the same funnel — undoable, traceable, AI-emittable.
  // Construct traces start from the literal `{}` (core-element-ops-exemplar),
  // so genesis includes the part itself.
  | { type: 'setTimeSignature'; count: number; unit: number; display?: 'common' | 'cut' }
  | { type: 'setTuning'; tuning: MnxTuningEntry[] }
  | { type: 'addPart'; partId?: string; name?: string }
  | { type: 'setStaffKind'; kind: 'notation' | 'tab' | 'both' }
  // The inherited-attribute pair (campaign item 5): setting and un-declaring
  // are DIFFERENT intents, because "remove" here means "revert to the
  // predecessor's governance", not "set to nothing".
  | { type: 'setClef'; sign: string; staffPosition?: number; octave?: number }
  | { type: 'removeClef' }
  | { type: 'setKeySignature'; fifths: number }
  | { type: 'removeKeySignature' }
  | { type: 'removeTimeSignature' }
  // The bar-attribute family (campaign item 7): ten kinds, one verb, because
  // they are all one thing — a key on the global measure.
  // `index` addresses the one array, `tempos`: absent, set replaces the
  // first entry and remove strips it — the popover's behaviour; given, it
  // names the entry (an index equal to the length appends). The inspector's
  // `tempo#N` pills are what made the second entry addressable
  // (core-measure-attributes-gaps.md, bug 1).
  | { type: 'setMeasureAttribute'; attribute: MeasureAttribute; index?: number }
  | { type: 'removeMeasureAttribute'; kind: MeasureAttributeKind; index?: number }
  // Spanners (campaign item 10): ONE intent, three meanings decided by
  // session state — remove the slur starting here, complete a pending one, or
  // arm the anchor. Traces record what was pressed, so replay rebuilds the
  // anchor exactly as a player would.
  | { type: 'toggleSlur' }
  // Beams reuse the SAME anchor as slurs (campaign item 11): "press here,
  // press there" is one mechanism whatever the span turns out to mean.
  | { type: 'toggleBeam' }
  // Event adornments (campaign item 8): markings attach to the event under the
  // cursor, dynamics and directions to the cursor's MOMENT in the part.
  // Lyrics (campaign item 12): a syllable at the cursor's note, and the
  // document-level line it belongs to.
  | { type: 'setSyllable'; line: string; text: string; syllableType?: 'start' | 'middle' | 'end' | 'whole' }
  | { type: 'removeSyllable'; line: string }
  | { type: 'setLyricLine'; line: string; label?: string; lang?: string }
  | { type: 'removeLyricLine'; line: string }
  // Tab technique (campaign item 9): one toggle per technique, and `hammerPull`
  // is ONE intent — which of the pair you get is physics, not a choice.
  | {
      type: 'toggleTechnique';
      kind: TechniqueChoice['kind'] | 'hammerPull';
      /** Bend shape, when the surface offers one (`bend 3`, `bend release`). */
      semitones?: number;
      release?: boolean;
    }
  | { type: 'setFingering'; hand: 'left' | 'right'; finger: string }
  | { type: 'removeFingering' }
  | { type: 'removeStringAnnotation' }
  | { type: 'setPartDeclaration'; declaration: PartDeclaration }
  | { type: 'removePartDeclaration'; kind: PartDeclarationKind }
  // Document-level presentation: no cursor involved, the document IS the
  // address (as with lyric lines).
  | { type: 'removeContainer'; sequenceIndex: number; eventIndex: number }
  | { type: 'removeKitNote' }
  | { type: 'removeKitComponent'; component: string }
  | { type: 'removeSound'; sound: string }
  | { type: 'setAccidentalDisplay'; show: boolean; parenthesized?: boolean }
  // Spelling as a player's choice, not the editor's (campaign item 6).
  | { type: 'respellNote' }
  | { type: 'removeAccidentalDisplay' }
  | { type: 'setLayout'; index: number; layout: MnxLayout }
  | { type: 'setScore'; index: number; score: MnxScore }
  | { type: 'addMultimeasureRest'; scoreIndex: number; start: string; duration: number }
  | { type: 'removeLayout'; index: number }
  | { type: 'removeScore'; index: number }
  | { type: 'removeMultimeasureRest'; scoreIndex: number; index: number }
  | { type: 'setMarking'; marking: string; attributes?: Record<string, string> }
  | { type: 'removeMarking'; marking: string }
  | { type: 'setFermata'; fermata: MnxFermata }
  | { type: 'removeFermata' }
  // The inspector's amend of a technique (roadmap/inprogress/workbench-rung-inspector.md):
  // `toggleTechnique` on a present bend REMOVES it, so re-valuing one needs a
  // verb that sets without asking what is there.
  | { type: 'setTechnique'; technique: TechniqueChoice }
  // The inspector's `duration` pill, typed to a value rather than stepped.
  // Same split as the ladder keys: an event with ink is re-valued, a rest or
  // an entry ghost re-values the PENDING entry duration.
  | { type: 'setEventDuration'; base: MnxNoteValueBase; dots?: number }
  | { type: 'setPositioned'; attribute: PositionedAttribute }
  | { type: 'removePositioned'; kind: PositionedAttribute['kind'] }
  // The rhythm-declaration family (campaign item 11b): one wrap for the three
  // containers, an insert for authored silence. The spec arrives PARTIAL — an
  // unqualified `3:2` takes its note value from the event under the cursor —
  // and the session completes it, because the popover grammar is document-free
  // by design.
  | { type: 'wrapInContainer'; spec: PartialContainerSpec; count?: number }
  | { type: 'insertSpace'; duration: [number, number] }
  | { type: 'setRestSpelling'; duration: { base: MnxNoteValueBase; dots?: number } }
  // Dots (campaign item 4). One key, two targets, mirroring the duration
  // ladder exactly: an event with ink is re-valued, and over a rest or an
  // entry ghost the PENDING duration is what changes — because a rest is
  // absence, so there is nothing there to dot.
  | { type: 'toggleDots' }
  // A document-level support declaration — not an element, so it has no rung
  // and no navigation: the document is the address (campaign item 3's queue
  // found `spec/accidentals` unbuildable without it).
  | { type: 'setSupport'; key: 'useAccidentalDisplay' | 'useBeams'; value: boolean }
  | { type: 'setFullMeasureRest'; visualDuration?: { base: MnxNoteValueBase; dots?: number } }
  | { type: 'removeFullMeasureRest' }
  | { type: 'setMeasureRepeat'; number: number; counter?: { count: number; orient?: 'above' | 'below' } }
  | { type: 'removeMeasureRepeat' }
  | { type: 'setTieVariant'; targetType?: 'nextNote' | 'crossVoice' | 'arpeggio' | 'crossJump'; lv?: boolean };

export type HistoryIntent = { type: 'undo' } | { type: 'redo' };

export type EditorIntent = NavigationIntent | MutationIntent | HistoryIntent;

const NAVIGATION_TYPES: ReadonlySet<string> = new Set([
  'nextPosition',
  'prevPosition',
  'nextMeasure',
  'prevMeasure',
  'lineDown',
  'lineUp',
  'goToMeasure',
  'goToEdge',
  'relaxSelection',
  'tightenSelection',
  'goToLevel',
  'dropAnchor',
  'extendSelection',
  'closeSelection',
  'selectSectionRange',
  'setProjection',
  'cycleSlot',
  'setPart',
  'setStaff',
  'jumpNext',
  'jumpPrev',
  'jumpUp',
  'jumpDown'
]);

export function isNavigationIntent(intent: EditorIntent): intent is NavigationIntent {
  return NAVIGATION_TYPES.has(intent.type);
}

export function isHistoryIntent(intent: EditorIntent): intent is HistoryIntent {
  return intent.type === 'undo' || intent.type === 'redo';
}
