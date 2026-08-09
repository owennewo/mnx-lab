// The editor's intent vocabulary — roadmap/complete/editor-input-layer.md.
//
// Intents are the stable middle of the input layer: keymaps (experimental,
// churning) map keys to intents, and the session maps intents to cursor moves
// or EditOps. Trace fixtures are written in intents, NEVER keys, so they
// survive every rebinding and every future emulation preset.
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
  | { type: 'goToMeasure'; measureIndex: number };

/** Mutation: becomes an EditOp against the cursor's position/note. */
export type MutationIntent =
  /** A fret digit was typed: re-fret the note on the cursor's string, or
   *  INSERT one there (rest / empty space). Consecutive digits on an
   *  unmoved cursor combine into two-digit frets (1,2 → 12). */
  | { type: 'fretDigit'; digit: number }
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
  | { type: 'setTimeSignature'; count: number; unit: number }
  | { type: 'setTuning'; tuning: MnxTuningEntry[] };

export type HistoryIntent = { type: 'undo' } | { type: 'redo' };

export type EditorIntent = NavigationIntent | MutationIntent | HistoryIntent;

const NAVIGATION_TYPES: ReadonlySet<string> = new Set([
  'nextPosition',
  'prevPosition',
  'nextMeasure',
  'prevMeasure',
  'lineDown',
  'lineUp',
  'goToMeasure'
]);

export function isNavigationIntent(intent: EditorIntent): intent is NavigationIntent {
  return NAVIGATION_TYPES.has(intent.type);
}

export function isHistoryIntent(intent: EditorIntent): intent is HistoryIntent {
  return intent.type === 'undo' || intent.type === 'redo';
}
