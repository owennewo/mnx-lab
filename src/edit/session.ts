// The editor session: intent + (doc, cursor) → cursor move or EditOp.
// This is stage 2 of the input layer (roadmap/inprogress/editor-input-layer.md)
// — DOM-free on purpose, so the workbench mount and the harness replay test
// drive the exact same object. The session records every intent it handles;
// that log IS the trace fixture ("recording is the same stream as undo").
import type { MnxEvent, MnxNote, MnxNoteValueBase, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import { isNavigationIntent } from './intents.ts';
import type { EditOp } from './ops.ts';
import { EditHistory } from './ops.ts';
import {
  addOnsets,
  buildGrid,
  clampCursor,
  initialCursor,
  itemSpan,
  moveLine,
  moveMeasure,
  movePosition,
  moveToMeasure,
  onsetsEqual,
  slotAt,
  type EditorCursor,
  type PositionGrid
} from './cursor.ts';
import { capoOf, defaultStringFor, tuningOf } from './tabStrings.ts';

/** The on-disk shape of harness/fixtures/edit-traces/<name>.json. */
export interface TraceFixture {
  /** Corpus scenario id supplying the starting document (the corpus is the
   *  score library — fixtures never copy scores). */
  scenario: string;
  intents: EditorIntent[];
  expect: {
    doc: MnxStructure;
    cursor: EditorCursor;
  };
}

/** The step ladder `-`/`=` walk. Dots are dropped on re-value (phase 2). */
const DURATION_LADDER: MnxNoteValueBase[] = [
  'whole',
  'half',
  'quarter',
  'eighth',
  '16th',
  '32nd',
  '64th'
];

const MAX_FRET = 24;

export class EditorSession {
  private history: EditHistory;
  private grid: PositionGrid;
  private cursorState: EditorCursor;
  private intents: EditorIntent[] = [];
  /** Duration a fresh entry event gets; `-`/`=` on an entry ghost step it. */
  private entryDuration: MnxNoteValueBase = 'quarter';
  /** Digit-combining anchor: consecutive fret digits on an unmoved cursor
   *  combine (1,2 → 12) — deterministic, no timers, so traces replay. */
  private lastDigit: { anchor: string; fret: number } | null = null;
  readonly initial: MnxStructure;

  constructor(
    doc: MnxStructure,
    /** Corpus scenario id, stamped into traces; '' for non-corpus documents. */
    readonly scenarioId: string = ''
  ) {
    // Deep-copy so later external mutation of the argument can't desync the
    // byte-identical undo-all contract.
    this.initial = JSON.parse(JSON.stringify(doc)) as MnxStructure;
    this.history = new EditHistory(this.initial);
    this.grid = buildGrid(this.initial);
    this.cursorState = initialCursor(this.grid);
  }

  get doc(): MnxStructure {
    return this.history.current;
  }

  get cursor(): EditorCursor {
    return this.cursorState;
  }

  get positions(): PositionGrid {
    return this.grid;
  }

  get mode(): PositionGrid['mode'] {
    return this.grid.mode;
  }

  get entryDurationBase(): MnxNoteValueBase {
    return this.entryDuration;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** Ops currently in effect — shrinks on undo, regrows on redo. */
  get appliedOps(): EditOp[] {
    return this.history.appliedOps;
  }

  /** Every intent handled, including navigation and undo/redo. */
  get intentLog(): EditorIntent[] {
    return [...this.intents];
  }

  get dirty(): boolean {
    return this.history.canUndo;
  }

  /** Selection keys for the highlight overlay: the note under the cursor. */
  get selectedNoteKeys(): string[] {
    const slot = slotAt(this.grid, this.cursorState);
    return slot ? [slot.noteKey] : [];
  }

  /**
   * Handle one intent. Navigation moves the cursor; mutation funnels through
   * applyOp via the history; undo/redo walk the history. Returns false when
   * the intent changed nothing (cursor at an edge, nothing to act on) — such
   * intents are still recorded, because a trace must replay the session
   * exactly as it happened, no-ops included.
   */
  handleIntent(intent: EditorIntent): boolean {
    this.intents.push(intent);
    if (intent.type !== 'fretDigit') this.lastDigit = null;
    if (isNavigationIntent(intent)) return this.navigate(intent);
    switch (intent.type) {
      case 'undo': {
        if (!this.history.canUndo) return false;
        this.history.undo();
        this.reindex();
        return true;
      }
      case 'redo': {
        if (!this.history.canRedo) return false;
        this.history.redo();
        this.reindex();
        return true;
      }
      case 'transpose': {
        const keys = this.selectedNoteKeys;
        if (keys.length > 0) {
          this.apply({ type: 'transposeSelection', semitones: intent.semitones, noteIds: keys });
          return true;
        }
        // §8.11's polymorphic verb: on a rest, the vertical axis is
        // `staffPosition` (half-staff-spaces, +up), one step per press.
        const event = this.eventUnderCursor();
        if (!event?.rest) return false;
        this.apply({
          type: 'nudgeRest',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          delta: Math.sign(intent.semitones)
        });
        return true;
      }
      case 'toggleTie': {
        const slot = slotAt(this.grid, this.cursorState);
        if (!slot) return false;
        this.apply({ type: 'toggleTie', noteId: slot.noteKey });
        return true;
      }
      case 'fretDigit':
        return this.fretDigit(intent.digit);
      case 'delete': {
        const slot = slotAt(this.grid, this.cursorState);
        if (!slot) return false;
        this.apply({ type: 'deleteNote', noteId: slot.noteKey });
        return true;
      }
      case 'shorterDuration':
      case 'longerDuration': {
        const step = intent.type === 'shorterDuration' ? 1 : -1;
        const event = this.eventUnderCursor();
        if (!event) {
          // Entry ghost: step the pending entry duration (session state, not
          // an op — it exists only until the next insert consumes it).
          const next = stepLadder(this.entryDuration, step);
          if (next === this.entryDuration) return false;
          this.entryDuration = next;
          return true;
        }
        const next = stepLadder(event.duration.base, step);
        if (next === event.duration.base) return false;
        this.apply({
          type: 'setDuration',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          duration: { base: next }
        });
        return true;
      }
      case 'setTimeSignature': {
        this.apply({
          type: 'setTimeSignature',
          measureIndex: this.cursorState.measureIndex,
          time: { count: intent.count, unit: intent.unit }
        });
        return true;
      }
      case 'setTuning': {
        this.apply({ type: 'setTuning', tuning: intent.tuning });
        return true;
      }
      case 'appendMeasure': {
        this.apply({ type: 'appendMeasure' });
        return true;
      }
    }
  }

  /** The trace of this session so far, as a paste-ready fixture. */
  trace(): TraceFixture {
    return {
      scenario: this.scenarioId,
      intents: this.intentLog,
      expect: {
        doc: JSON.parse(JSON.stringify(this.doc)) as MnxStructure,
        cursor: { ...this.cursorState, onset: { ...this.cursorState.onset } }
      }
    };
  }

  /**
   * A typed fret digit — the heart of tab entry. On the cursor's string:
   * an existing note is re-fretted, a rest or empty space gains a note
   * (insert). A second digit on an unmoved cursor combines to a two-digit
   * fret by undoing and re-applying — deterministic, so traces replay it.
   */
  private fretDigit(digit: number): boolean {
    const anchor = `${this.cursorState.measureIndex}:${this.cursorState.onset.num}/${this.cursorState.onset.den}:${this.cursorState.line}`;
    let fret = digit;
    if (this.lastDigit && this.lastDigit.anchor === anchor) {
      const combined = this.lastDigit.fret * 10 + digit;
      if (combined <= MAX_FRET) {
        this.history.undo();
        this.reindex();
        fret = combined;
      }
    }

    const slot = slotAt(this.grid, this.cursorState);
    const note = this.selectedNote();
    if (slot && note) {
      const string =
        this.grid.mode === 'string'
          ? this.cursorState.line
          : note._x?.mnxLab?.string ??
            defaultStringFor(note.pitch, tuningOf(this.doc.parts[0]), capoOf(this.doc.parts[0]));
      this.apply({ type: 'setFret', noteId: slot.noteKey, string, fret });
    } else {
      // Nothing on this string at this position: insert. Only meaningful on
      // the fingerboard — in ordinal mode (no tab part) digits need a note.
      if (this.grid.mode !== 'string') return false;
      this.apply({
        type: 'insertNote',
        measureIndex: this.cursorState.measureIndex,
        onset: [this.cursorState.onset.num, this.cursorState.onset.den],
        string: this.cursorState.line,
        fret,
        duration: { base: this.entryDuration }
      });
    }
    this.lastDigit = { anchor, fret };
    return true;
  }

  private navigate(intent: EditorIntent): boolean {
    const before = this.cursorState;
    switch (intent.type) {
      case 'nextPosition':
        this.cursorState = movePosition(this.grid, before, 1);
        break;
      case 'prevPosition':
        this.cursorState = movePosition(this.grid, before, -1);
        break;
      case 'nextMeasure':
        this.cursorState = moveMeasure(this.grid, before, 1);
        break;
      case 'prevMeasure':
        this.cursorState = moveMeasure(this.grid, before, -1);
        break;
      case 'lineDown':
        this.cursorState = moveLine(this.grid, before, 1);
        break;
      case 'lineUp':
        this.cursorState = moveLine(this.grid, before, -1);
        break;
      case 'goToMeasure':
        this.cursorState = moveToMeasure(this.grid, before, intent.measureIndex);
        break;
    }
    return this.cursorState !== before;
  }

  private apply(op: EditOp): void {
    this.history.apply(op);
    this.reindex();
  }

  /** The grid derives from the document, so every doc change rebuilds it and
   *  re-anchors the cursor (a removed measure must not strand it). */
  private reindex(): void {
    this.grid = buildGrid(this.doc);
    this.cursorState = clampCursor(this.grid, this.cursorState);
  }

  private selectedNote(): MnxNote | undefined {
    const slot = slotAt(this.grid, this.cursorState);
    if (!slot) return undefined;
    const measure = this.doc.parts[0]?.measures?.[this.cursorState.measureIndex];
    const sequences = (measure?.sequences ?? []).filter(s => (s.staff ?? 1) === 1);
    const item = sequences[slot.voiceIndex]?.content[slot.eventIndex];
    return (item as { notes?: MnxNote[] })?.notes?.[slot.noteIndex];
  }

  /** The voice-0 timed event starting exactly at the cursor's onset. */
  private eventUnderCursor(): MnxEvent | undefined {
    const measure = this.doc.parts[0]?.measures?.[this.cursorState.measureIndex];
    const seq = (measure?.sequences ?? []).filter(s => (s.staff ?? 1) === 1)[0];
    if (!seq) return undefined;
    let onset = { num: 0, den: 1 };
    for (const item of seq.content) {
      if (onsetsEqual(onset, this.cursorState.onset)) {
        return isTimedEvent(item) ? item : undefined;
      }
      onset = addOnsets(onset, itemSpan(item));
    }
    return undefined;
  }
}

function stepLadder(base: MnxNoteValueBase, step: 1 | -1): MnxNoteValueBase {
  const index = DURATION_LADDER.indexOf(base);
  if (index < 0) return base; // exotic values don't step (phase 2)
  const next = Math.min(Math.max(index + step, 0), DURATION_LADDER.length - 1);
  return DURATION_LADDER[next];
}

/** Replay a trace's intents over a starting document — what the harness
 *  replay test and any future "load recording" affordance both use. */
export function replayIntents(
  doc: MnxStructure,
  intents: EditorIntent[],
  scenarioId = ''
): EditorSession {
  const session = new EditorSession(doc, scenarioId);
  for (const intent of intents) session.handleIntent(intent);
  return session;
}
