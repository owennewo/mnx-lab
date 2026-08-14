// The editor session: intent + (doc, cursor) → cursor move or EditOp.
// This is stage 2 of the input layer (roadmap/complete/core-editor-input-layer.md)
// — DOM-free on purpose, so the workbench mount and the harness replay test
// drive the exact same object. The session records every intent it handles;
// that log IS the trace fixture ("recording is the same stream as undo").
import type { MnxEvent, MnxNote, MnxNoteValueBase, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import { isNavigationIntent } from './intents.ts';
import type { EditOp, OpLogEntry } from './ops.ts';
import {
  beamRunBetween,
  beamStartingAt,
  EditHistory,
  hasSlurStartingAt,
  MEASURE_ATTRIBUTE_FIELDS,
  measureHasInk,
  partHasInk
} from './ops.ts';
import {
  addOnsets,
  buildGrid,
  clampCursor,
  initialCursor,
  itemSpan,
  moveLine,
  moveMeasure,
  movePosition,
  movePositionInk,
  moveToMeasure,
  onsetLess,
  onsetsEqual,
  positionAt,
  slotAt,
  type EditorCursor,
  type PositionGrid,
  type Projection
} from './cursor.ts';
import { capoOf, defaultStringFor, tuningOf } from './tabStrings.ts';
import { clefAt, keyFifthsAt, pitchAtStaffPosition } from './staffSpace.ts';
import {
  presentLevels,
  relaxLevel,
  sectionStarts,
  selectionNoteKeys,
  tightenLevel,
  type SelectionLevel
} from './selection.ts';

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

  /** The armed end of a spanner-in-progress (campaign item 10): a note key, or
   *  null. The keyboard names two places in two presses because the ladder
   *  cannot yet extend laterally; when it can, "slur the selected run" becomes
   *  a second route to the same op rather than a replacement. */
  private spanAnchorKey: string | null = null;
  /** The intent currently being handled — stamped into history entries by
   *  apply() as the op queue's provenance (forward-recorded at apply time). */
  private applyingIntent: EditorIntent | null = null;
  /** The selection ladder rung (roadmap/inprogress/core-selection-ladder.md). The
   *  cursor is the anchor; the level says how much around it is selected.
   *  Relaxing never moves the cursor, so tighten re-resolves the same
   *  measure/onset/line as relative addresses — the implicit breadcrumb. */
  private level: SelectionLevel = 'note';
  /** Which SPACE the cursor's line addresses (selection-ladder map): the
   *  fingerboard on tab documents by default, else the staff. */
  private activeProjection: Projection;
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
    this.activeProjection = this.grid.mode === 'string' ? 'tab' : 'notation';
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

  /** The op queue with intent provenance, for the workbench's ops panel:
   *  applied (oldest first) and the redo stack (next-to-redo first). */
  get opQueue(): { applied: OpLogEntry[]; future: OpLogEntry[] } {
    return { applied: this.history.appliedEntries, future: this.history.futureEntries };
  }

  /** Every intent handled, including navigation and undo/redo. */
  get intentLog(): EditorIntent[] {
    return [...this.intents];
  }

  get dirty(): boolean {
    return this.history.canUndo;
  }

  get selectionLevel(): SelectionLevel {
    return this.level;
  }

  get projection(): Projection {
    return this.activeProjection;
  }

  /** Selection keys for the highlight overlay: the current rung's footprint —
   *  each level paints exactly the notes its operations can affect. */
  get selectedNoteKeys(): string[] {
    return selectionNoteKeys(this.doc, this.grid, this.cursorState, this.level, this.activeProjection);
  }

  /** The cursor's cell for the overlay's ghost: whether it is occupied, its
   *  line in the active projection's space, and the beat's ink (any voice)
   *  as column anchors. */
  cursorContext(): {
    occupied: boolean;
    staffPosition: number | null;
    string: number | null;
    anchorKeys: string[];
  } {
    const position = positionAt(this.grid, this.cursorState);
    return {
      occupied: !!slotAt(this.grid, this.cursorState, this.activeProjection),
      staffPosition: this.activeProjection === 'notation' ? this.cursorState.line : null,
      string: this.activeProjection === 'tab' ? this.cursorState.line : null,
      anchorKeys: position?.slots.map(s => s.noteKey) ?? []
    };
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
    // Provenance for the op queue: apply() stamps the intent being handled
    // into the history entry (forward-recorded, never inferred).
    this.applyingIntent = intent;
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
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        this.apply({ type: 'toggleTie', noteId: slot.noteKey });
        return true;
      }
      case 'fretDigit':
        return this.fretDigit(intent.digit);
      case 'toggleNote': {
        // The notation projection's entry action: one (staff position ×
        // beat) cell, one note — remove what is there, else add the key-
        // signature default pitch. Entry targets voice 0 (the entry surface),
        // so positions belonging only to other voices refuse.
        if (this.activeProjection !== 'notation') return false;
        const slot = slotAt(this.grid, this.cursorState, 'notation');
        if (slot) {
          this.apply({ type: 'deleteNote', noteId: slot.noteKey });
          return true;
        }
        const position = positionAt(this.grid, this.cursorState);
        if (!position || !position.voices.includes(0)) return false;
        const clef = clefAt(this.doc, this.cursorState.measureIndex);
        const fifths = keyFifthsAt(this.doc, this.cursorState.measureIndex);
        this.apply({
          type: 'insertPitchNote',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          pitch: pitchAtStaffPosition(clef, this.cursorState.line, fifths),
          duration: { base: this.entryDuration }
        });
        return true;
      }
      case 'delete': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (slot) {
          this.apply({ type: 'deleteNote', noteId: slot.noteKey });
          return true;
        }
        // The container rungs' guarded delete (element-ops): a container may
        // be removed only when it holds no ink — Del at the measure rung
        // removes the empty bar, at the score rung the empty part (then the
        // trailing empty bars), and the hollowed skeleton dissolves to {}.
        if (this.level === 'measure') {
          const measureIndex = this.cursorState.measureIndex;
          if (
            !this.doc.global?.measures?.[measureIndex] ||
            measureHasInk(this.doc, measureIndex)
          )
            return false;
          this.apply({ type: 'removeMeasure', measureIndex });
          return true;
        }
        if (this.level === 'score') {
          const part = this.doc.parts?.[0];
          if (part && !partHasInk(part)) {
            this.apply({ type: 'removePart' });
            return true;
          }
          const last = (this.doc.global?.measures?.length ?? 0) - 1;
          if (!part && last >= 0) {
            this.apply({ type: 'removeMeasure', measureIndex: last });
            return true;
          }
          return false;
        }
        return false;
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
      // The inherited-attribute pair (campaign item 5): the cursor's measure
      // is the target, as with setTimeSignature. Clef writes the part
      // measure, key the global one — same rung, two owners.
      case 'setClef': {
        this.apply({
          type: 'setClef',
          measureIndex: this.cursorState.measureIndex,
          sign: intent.sign,
          ...(intent.staffPosition !== undefined ? { staffPosition: intent.staffPosition } : {}),
          ...(intent.octave ? { octave: intent.octave } : {})
        });
        return true;
      }
      case 'removeClef': {
        // Nothing declared here means the measure ALREADY inherits: refuse,
        // rather than pushing an op that changes nothing onto the queue.
        const measure = this.doc.parts?.[0]?.measures?.[this.cursorState.measureIndex];
        const declared = (measure?.clefs ?? []).some(
          entry => (entry.staff ?? 1) === 1 && entry.position === undefined
        );
        if (!declared) return false;
        this.apply({ type: 'removeClef', measureIndex: this.cursorState.measureIndex });
        return true;
      }
      case 'setKeySignature': {
        this.apply({
          type: 'setKeySignature',
          measureIndex: this.cursorState.measureIndex,
          fifths: intent.fifths
        });
        return true;
      }
      case 'removeKeySignature': {
        if (!this.doc.global?.measures?.[this.cursorState.measureIndex]?.key) return false;
        this.apply({ type: 'removeKeySignature', measureIndex: this.cursorState.measureIndex });
        return true;
      }
      // The bar-attribute family (campaign item 7): the cursor's measure is
      // the target, like every other measure-rung attribute.
      // Spanners (campaign item 10): the first session state beyond the
      // cursor and the entry duration — one nullable note key.
      case 'toggleSlur': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // 1. A slur already starting here? Toggle it off.
        if (hasSlurStartingAt(this.doc, slot.noteKey)) {
          this.spanAnchorKey = null;
          this.apply({ type: 'removeSlur', noteKey: slot.noteKey });
          return true;
        }
        // 2. An armed anchor? Complete the slur.
        if (this.spanAnchorKey !== null && this.spanAnchorKey !== slot.noteKey) {
          const from = this.spanAnchorKey;
          this.spanAnchorKey = null;
          this.apply({ type: 'setSlur', fromNoteKey: from, toNoteKey: slot.noteKey });
          return true;
        }
        // 3. Otherwise arm (or disarm, pressing twice in one place).
        this.spanAnchorKey = this.spanAnchorKey === slot.noteKey ? null : slot.noteKey;
        return true;
      }
      case 'toggleBeam': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // 1. A beam already starting here? Toggle it off.
        const existing = beamStartingAt(this.doc, slot.noteKey);
        if (existing) {
          this.spanAnchorKey = null;
          this.apply({ type: 'removeBeam', ...existing });
          return true;
        }
        // 2. An armed anchor? Beam the run between it and here.
        if (this.spanAnchorKey !== null && this.spanAnchorKey !== slot.noteKey) {
          // The run is computed against a COPY: minting ids is a document
          // change, and only `apply` is allowed to make one.
          const probe = JSON.parse(JSON.stringify(this.doc)) as MnxStructure;
          const run = beamRunBetween(probe, this.spanAnchorKey, slot.noteKey);
          this.spanAnchorKey = null;
          if (!run) return false;
          this.apply({ type: 'setBeam', measureIndex: run.measureIndex, eventIds: run.eventIds });
          return true;
        }
        // 3. Otherwise arm (or disarm, pressing twice in one place).
        this.spanAnchorKey = this.spanAnchorKey === slot.noteKey ? null : slot.noteKey;
        return true;
      }
      case 'setFullMeasureRest':
      case 'removeFullMeasureRest':
      case 'setMeasureRepeat':
      case 'removeMeasureRepeat': {
        const measureIndex = this.cursorState.measureIndex;
        const before = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'setMeasureRepeat'
            ? { type: 'setMeasureRepeat', measureIndex, number: intent.number }
            : { type: intent.type, measureIndex }
        );
        // These refuse (a bar holding ink, nothing declared to strip), and a
        // refusal must not leave an op that changed nothing on the queue.
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'setTieVariant': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        this.apply({
          type: 'setTieVariant',
          noteId: slot.noteKey,
          ...(intent.targetType ? { targetType: intent.targetType } : {}),
          ...(intent.lv ? { lv: true } : {})
        });
        return true;
      }
      case 'setMeasureAttribute': {
        this.apply({
          type: 'setMeasureAttribute',
          measureIndex: this.cursorState.measureIndex,
          attribute: intent.attribute
        });
        return true;
      }
      case 'removeMeasureAttribute': {
        // Refuse when the attribute is not there, rather than queueing an op
        // that changes nothing (the same rule as removeClef).
        const measure = this.doc.global?.measures?.[this.cursorState.measureIndex] as
          | Record<string, unknown>
          | undefined;
        const field = MEASURE_ATTRIBUTE_FIELDS[intent.kind];
        if (!measure || measure[field] === undefined) return false;
        this.apply({
          type: 'removeMeasureAttribute',
          measureIndex: this.cursorState.measureIndex,
          kind: intent.kind
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
      case 'addPart': {
        const op: Extract<EditOp, { type: 'addPart' }> = { type: 'addPart' };
        if (intent.partId !== undefined) op.partId = intent.partId;
        if (intent.name !== undefined) op.name = intent.name;
        this.apply(op);
        return true;
      }
      case 'setStaffKind': {
        this.apply({ type: 'setStaffKind', kind: intent.kind });
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

    const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
    const note = this.selectedNote();
    if (slot && note) {
      const string =
        this.grid.mode === 'string'
          ? this.cursorState.line
          : note._x?.mnxLab?.string ??
            defaultStringFor(note.pitch, tuningOf(this.doc.parts?.[0]), capoOf(this.doc.parts?.[0]));
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

  /** The armed spanner anchor, for the HUD and the ops panel. */
  get spanAnchor(): string | null {
    return this.spanAnchorKey;
  }

  private navigate(intent: EditorIntent): boolean {
    const before = this.cursorState;
    switch (intent.type) {
      // The ladder walk. Presence is computed fresh at the cursor, so absent
      // rungs (no note under a rest, no sections declared) are skipped.
      case 'relaxSelection': {
        // Escape drops an armed spanner anchor before it does anything else —
        // the gesture must be abandonable without touching the document.
        if (this.spanAnchorKey !== null) {
          this.spanAnchorKey = null;
          return true;
        }
        const next = relaxLevel(presentLevels(this.doc, this.grid, before, this.activeProjection), this.level);
        if (!next) return false; // at the top — the mount deselects
        this.level = next;
        return true;
      }
      case 'tightenSelection': {
        const next = tightenLevel(presentLevels(this.doc, this.grid, before, this.activeProjection), this.level);
        if (next) {
          this.level = next;
          return true;
        }
        if (this.level === 'note') return false; // the bottom — Enter's input job, later
        // The breadcrumb (the carried line) didn't resolve to a note —
        // moving while relaxed left it pointing at an empty cell. Descend to
        // the NEAREST child instead of refusing (the corresponding-child
        // fallback: history → nearest → first), preferring the anchor
        // voice's notes (the event the selection was showing).
        const position = positionAt(this.grid, before);
        if (!position || position.slots.length === 0) return false;
        const anchorVoice = position.voices.includes(0) ? 0 : position.voices[0];
        const mine = position.slots.filter(s => s.voiceIndex === anchorVoice);
        const pool = mine.length > 0 ? mine : position.slots;
        const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
        let best = pool[0];
        for (const slot of pool) {
          const lineOf = (s: typeof slot) => (tab ? s.line : s.staffPosition);
          const dist = Math.abs(lineOf(slot) - before.line);
          const bestDist = Math.abs(lineOf(best) - before.line);
          // Ties break UPWARD: smaller string number, larger staff position.
          if (
            dist < bestDist ||
            (dist === bestDist && (tab ? slot.line < best.line : slot.staffPosition > best.staffPosition))
          )
            best = slot;
        }
        this.cursorState = { ...before, line: tab ? best.line : best.staffPosition };
        this.level = 'note';
        return true;
      }
      // Bare arrows move by the rung's unit: positions at note/event, bars at
      // the bar rungs, sections at section, nothing at score.
      case 'nextPosition':
        this.cursorState = this.moveHorizontal(before, 1);
        break;
      case 'prevPosition':
        this.cursorState = this.moveHorizontal(before, -1);
        break;
      case 'nextMeasure':
        this.cursorState = moveMeasure(this.grid, before, 1);
        break;
      case 'prevMeasure':
        this.cursorState = moveMeasure(this.grid, before, -1);
        break;
      case 'lineDown':
        this.cursorState = moveLine(this.grid, before, 1, this.activeProjection);
        break;
      case 'lineUp':
        this.cursorState = moveLine(this.grid, before, -1, this.activeProjection);
        break;
      case 'goToMeasure':
        this.cursorState = moveToMeasure(this.grid, before, intent.measureIndex);
        break;
      case 'setProjection': {
        if (intent.projection === this.activeProjection) return false;
        // A doc with no fingerboard has no tab projection to switch to.
        if (intent.projection === 'tab' && this.grid.mode !== 'string') return false;
        // Remap the line into the new space: the selected note carries over;
        // otherwise land on the first note here, else the space's home row.
        const selected =
          slotAt(this.grid, before, this.activeProjection) ??
          positionAt(this.grid, before)?.slots[0];
        this.activeProjection = intent.projection;
        this.cursorState = {
          ...before,
          line:
            intent.projection === 'tab'
              ? selected?.line ?? 1
              : selected?.staffPosition ?? 0
        };
        return true;
      }
      // The Ctrl climb (selection-ladder map): ←→ = bar jump in BOTH
      // projections. The pure rule gave tab an event-skip (its grid walk
      // differs from the event walk on paper), but the note-level hands-on
      // review overruled it: in single-voice music the grid IS the voice's
      // events plus the ghost, so event-skip felt identical to bare → —
      // degenerate in practice, and the climb continues to the bar.
      case 'jumpNext':
      case 'jumpPrev': {
        const delta = intent.type === 'jumpNext' ? 1 : -1;
        this.cursorState = moveMeasure(this.grid, before, delta);
        return this.cursorState !== before;
      }
      case 'jumpUp':
      case 'jumpDown': {
        if (this.level !== 'note') return false;
        const anchor = slotAt(this.grid, before, this.activeProjection)?.voiceIndex ?? 0;
        const target = anchor + (intent.type === 'jumpDown' ? 1 : -1);
        // The voice jump targets the event SOUNDING at the cursor's instant:
        // voices rarely share onsets (an alternating bass against a melody
        // almost never does), so requiring a same-beat onset made the jump
        // feel broken — land on the target voice's event covering the
        // cursor's beat (latest onset at or before it; else its first in
        // the bar).
        const inMeasure = this.grid.positions.filter(
          p => p.measureIndex === before.measureIndex && p.voices.includes(target)
        );
        if (inMeasure.length === 0) return false;
        const covering = [...inMeasure].reverse().find(p => !onsetLess(before.onset, p.onset));
        const targetPos = covering ?? inMeasure[0];
        const slots = targetPos.slots.filter(s => s.voiceIndex === target);
        const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
        this.cursorState = {
          measureIndex: targetPos.measureIndex,
          onset: targetPos.onset,
          line: slots.length > 0 ? nearestSlotLine(slots, before.line, tab) : before.line
        };
        return true;
      }
    }
    return this.cursorState !== before;
  }

  /** One step of horizontal movement in the current rung's unit. */
  private moveHorizontal(before: EditorCursor, delta: 1 | -1): EditorCursor {
    switch (this.level) {
      case 'note':
        // The note row of the navigation map: tab walks the full grid (space,
        // string-sticky); notation walks this voice's ink, landing on the
        // nearest-pitch member (snap-to-ink, the working default).
        return this.activeProjection === 'tab' && this.grid.mode === 'string'
          ? movePosition(this.grid, before, delta)
          : movePositionInk(this.grid, before, delta, this.activeProjection, 'nearest');
      case 'event':
        return movePosition(this.grid, before, delta);
      case 'voiceMeasure':
      case 'partMeasure':
      case 'measure':
        return moveMeasure(this.grid, before, delta);
      case 'section': {
        // Next/previous section START; prev from mid-section goes to the own
        // section's start first (the audio-player convention).
        const starts = sectionStarts(this.doc);
        const target =
          delta === 1
            ? starts.find(s => s > before.measureIndex)
            : [...starts].reverse().find(s => s < before.measureIndex);
        return target === undefined ? before : moveToMeasure(this.grid, before, target);
      }
      case 'score':
        return before; // the whole score is selected — nowhere to go
    }
  }

  private apply(op: EditOp): void {
    // The note under the cursor before the mutation: if it survives, the
    // cursor FOLLOWS it. A transpose that crosses a staff line (C#→D moves
    // the notehead; C→C# does not) must not leave the cursor behind on the
    // now-empty line — same for a tab re-pitch that lands on another string.
    const anchor = slotAt(this.grid, this.cursorState, this.activeProjection)?.noteKey ?? null;
    this.history.apply(op, this.applyingIntent ?? undefined);
    this.reindex();
    if (anchor) {
      const moved = positionAt(this.grid, this.cursorState)?.slots.find(
        s => s.noteKey === anchor
      );
      if (moved) {
        const line = this.activeProjection === 'tab' ? moved.line : moved.staffPosition;
        if (line !== this.cursorState.line) {
          this.cursorState = { ...this.cursorState, line };
        }
      }
    }
    // A mutation acts at the cursor's note/position, so it re-anchors the
    // selection there — typing a fret while a bar is selected must not leave
    // the whole bar reading as "what you just edited".
    this.level = 'note';
  }

  /** The grid derives from the document, so every doc change rebuilds it and
   *  re-anchors the cursor (a removed measure must not strand it). */
  private reindex(): void {
    this.grid = buildGrid(this.doc);
    this.cursorState = clampCursor(this.grid, this.cursorState);
  }

  private selectedNote(): MnxNote | undefined {
    const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
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

/** The slot line nearest `line` in the active space — ties break UPWARD
 *  (smaller string number, larger staff position). */
function nearestSlotLine(
  slots: { line: number; staffPosition: number }[],
  line: number,
  tab: boolean
): number {
  const lineOf = (s: { line: number; staffPosition: number }) => (tab ? s.line : s.staffPosition);
  let best = slots[0];
  for (const slot of slots) {
    const dist = Math.abs(lineOf(slot) - line);
    const bestDist = Math.abs(lineOf(best) - line);
    if (
      dist < bestDist ||
      (dist === bestDist && (tab ? slot.line < best.line : slot.staffPosition > best.staffPosition))
    )
      best = slot;
  }
  return lineOf(best);
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
