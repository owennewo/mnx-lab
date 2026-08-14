// The editor's intent vocabulary — roadmap/complete/core-editor-input-layer.md.
//
// Intents are the stable middle of the input layer: keymaps (experimental,
// churning) map keys to intents, and the session maps intents to cursor moves
// or EditOps. Trace fixtures are written in intents, NEVER keys, so they
// survive every rebinding and every future emulation preset.
import type { MeasureAttribute, MeasureAttributeKind } from './ops.ts';
import type { MnxTuningEntry } from '../model/mnx.ts';

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
  /** The selection ladder (roadmap/inprogress/core-selection-ladder.md): relax
   *  widens one rung (note → … → score; past the top the MOUNT deselects),
   *  tighten narrows back down the same containment chain. Navigation, not
   *  mutation — the ladder changes what the cursor addresses, never the doc. */
  | { type: 'relaxSelection' }
  | { type: 'tightenSelection' }
  /** The active projection: which SPACE the vertical line addresses (string
   *  vs staff position). Recorded so traces replay navigation faithfully. */
  | { type: 'setProjection'; projection: 'notation' | 'tab' }
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
  /** A fret digit was typed: re-fret the note on the cursor's string, or
   *  INSERT one there (rest / empty space). Consecutive digits on an
   *  unmoved cursor combine into two-digit frets (1,2 → 12). */
  | { type: 'fretDigit'; digit: number }
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
  // Setup-as-ops (roadmap: "setup is ops, not chrome"): document genesis
  // choices flow through the same funnel — undoable, traceable, AI-emittable.
  // Construct traces start from the literal `{}` (core-element-ops-exemplar),
  // so genesis includes the part itself.
  | { type: 'setTimeSignature'; count: number; unit: number }
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
  // The bar-attribute family (campaign item 7): ten kinds, one verb, because
  // they are all one thing — a key on the global measure.
  | { type: 'setMeasureAttribute'; attribute: MeasureAttribute }
  | { type: 'removeMeasureAttribute'; kind: MeasureAttributeKind };

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
  'relaxSelection',
  'tightenSelection',
  'setProjection',
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
