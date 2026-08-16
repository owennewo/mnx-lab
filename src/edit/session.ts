// The editor session: intent + (doc, cursor) → cursor move or EditOp.
// This is stage 2 of the input layer (roadmap/complete/core-editor-input-layer.md)
// — DOM-free on purpose, so the workbench mount and the harness replay test
// drive the exact same object. The session records every intent it handles;
// that log IS the trace fixture ("recording is the same stream as undo").
import type { MnxEvent, MnxNote, MnxNoteValueBase, MnxStructure } from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import { isNavigationIntent } from './intents.ts';
import type { EditOp, EventAddress, OpLogEntry } from './ops.ts';
import {
  beamRunBetween,
  beamStartingAt,
  completeContainerSpec,
  entryContentAt,
  wrapExtent,
  EditHistory,
  hasSlurStartingAt,
  nextNotePitchPair,
  techniqueAt,
  MEASURE_ATTRIBUTE_FIELDS,
  measureHasInk,
  partHasInk,
  timeSignatureRemovalFits
} from './ops.ts';
import {
  buildGrid,
  clampCursor,
  coincidentSlots,
  cycleSlot,
  eventAtCursor,
  eventSlotAt,
  initialCursor,
  moveLine,
  moveMeasure,
  movePosition,
  movePositionInk,
  moveToMeasure,
  onsetsEqual,
  onsetLess,
  pinEventSlot,
  positionAt,
  slotAt,
  type EditorCursor,
  type Position,
  type PositionGrid,
  type Projection
} from './cursor.ts';
import { capoOf, defaultStringFor, tuningOf } from './tabStrings.ts';
import { clefAt, keyFifthsAt, pitchAtStaffPosition } from './staffSpace.ts';
import {
  closureScopeForLevel,
  presentLevels,
  pointSelection,
  relaxLevel,
  resolveSelection,
  sectionRangeAt,
  sectionStarts,
  tightenLevel,
  type ResolvedSelection,
  type SelectionState,
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
    selection: SelectionState;
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
  /** Dots on the PENDING entry duration (campaign item 4). Separate from the
   *  base because the ladder steps one and the dot key the other, and a
   *  dotted quarter stepping to an eighth stays dotted — as it does in every
   *  editor a player has used. */
  private entryDots = 0;
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
  /** The selection ladder's durable address. Until range gestures land, every
   *  ordinary navigation re-anchors both concrete edges at the cursor; the
   *  resolver already supports reversed intervals and live closures. */
  private selectionState!: SelectionState;
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
    this.grid = buildGrid(this.initial, 0);
    this.cursorState = initialCursor(this.grid);
    this.selectionState = pointSelection('note', this.cursorState);
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

  /** Dots the next entered note will carry. */
  get entryDurationDots(): number {
    return this.entryDots;
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
    return this.selectionState.level;
  }

  get selection(): SelectionState {
    return cloneSelection(this.selectionState);
  }

  get resolvedSelection(): ResolvedSelection {
    return resolveSelection(this.doc, this.selectionState, this.activeProjection);
  }

  get projection(): Projection {
    return this.activeProjection;
  }

  /** Selection keys for the highlight overlay: the current rung's footprint —
   *  each level paints exactly the notes its operations can affect. */
  get selectedNoteKeys(): string[] {
    return this.resolvedSelection.noteKeys;
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
        this.reindex(true);
        return true;
      }
      case 'redo': {
        if (!this.history.canRedo) return false;
        this.history.redo();
        this.reindex(true);
        return true;
      }
      case 'transpose': {
        const keys = this.selectedNoteKeys;
        if (keys.length > 0) {
          return this.applyBulk([
            { type: 'transposeSelection', semitones: intent.semitones, noteIds: keys }
          ]);
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
      case 'respellNote': {
        return this.applyBulk(
          this.selectedNoteKeys.map(noteId => ({ type: 'respellNote', noteId }))
        );
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
          duration: { base: this.entryDuration, ...(this.entryDots ? { dots: this.entryDots } : {}) }
        });
        return true;
      }
      case 'delete': {
        // Delete belongs to the selected RUNG, not whatever ink happens to be
        // under the cursor. Checking the slot first made Del at measure/score
        // silently remove one note while the enclosure claimed a container.
        if (this.selectionState.level === 'note') {
          const ops = [...this.selectedNoteKeys].reverse().map(noteKey =>
            /\.k\d+$/.test(noteKey)
              ? { type: 'removeKitNote' as const, noteKey }
              : { type: 'deleteNote' as const, noteId: noteKey }
          );
          return this.applyDestructive(ops);
        }
        if (this.selectionState.level === 'event') {
          const ops = this.resolvedSelection.members.flatMap(member =>
            member.kind === 'event'
              ? [{ type: 'clearEvent' as const, event: eventAddressOf(member) }]
              : []
          );
          return this.applyDestructive(ops);
        }
        if (this.selectionState.level === 'container') {
          const ops = [...this.resolvedSelection.members].reverse().flatMap(member =>
            member.kind === 'container'
              ? [{
                  type: 'removeContainer' as const,
                  partIndex: member.partIndex,
                  measureIndex: member.measureIndex,
                  sequenceIndex: member.sequenceIndex,
                  eventIndex: member.eventIndex
                }]
              : []
          );
          return this.applyDestructive(ops);
        }
        if (this.selectionState.level === 'voiceMeasure') {
          const ops = this.resolvedSelection.members.flatMap(member =>
            member.kind === 'voiceMeasure'
              ? [{
                  type: 'removeVoiceMeasure' as const,
                  partIndex: member.partIndex,
                  measureIndex: member.measureIndex,
                  sequenceIndex: member.sequenceIndex
                }]
              : []
          );
          return this.applyDestructive(ops);
        }
        if (this.selectionState.level === 'partMeasure') {
          const ops = this.resolvedSelection.members.flatMap(member =>
            member.kind === 'partMeasure'
              ? [{
                  type: 'removePartMeasure' as const,
                  partIndex: member.partIndex,
                  measureIndex: member.measureIndex,
                  staffIndex: member.staffIndex
                }]
              : []
          );
          return this.applyDestructive(ops);
        }
        // The same guarded-removal rule continues outward: Del at the measure
        // rung removes the empty bar, and at score it removes the empty part
        // (then trailing empty bars). No wider command destroys hidden ink.
        if (this.selectionState.level === 'measure') {
          const measureIndex = this.cursorState.measureIndex;
          if (
            !this.doc.global?.measures?.[measureIndex] ||
            measureHasInk(this.doc, measureIndex)
          )
            return false;
          this.apply({ type: 'removeMeasure', measureIndex });
          return true;
        }
        if (this.selectionState.level === 'score') {
          const partIndex = this.cursorState.partIndex ?? 0;
          const part = this.doc.parts?.[partIndex];
          if (part && !partHasInk(part)) {
            this.apply({ type: 'removePart', partIndex });
            return true;
          }
          const last = (this.doc.global?.measures?.length ?? 0) - 1;
          if (!part && last >= 0) {
            this.apply({ type: 'removeMeasure', measureIndex: last });
            return true;
          }
          return false;
        }
        if (this.selectionState.level === 'section') {
          const ops = [...this.resolvedSelection.members].reverse().flatMap(member =>
            member.kind === 'section'
              ? [{
                  type: 'removeMeasureAttribute' as const,
                  measureIndex: member.start,
                  kind: 'section' as const
                }]
              : []
          );
          return this.applyDestructive(ops);
        }
        return false;
      }
      case 'shorterDuration':
      case 'longerDuration': {
        const step = intent.type === 'shorterDuration' ? 1 : -1;
        const event = this.eventUnderCursor();
        // A REST IS ABSENCE (§8.11), so there is nothing there to re-value:
        // the duration keys step the PENDING entry duration over a rest or an
        // entry ghost alike, and only re-value an event that has ink. Before
        // campaign item 11b this re-valued the rest instead, which made a run
        // of short notes unenterable — every rest after the first stayed a
        // quarter, so every note after the first came out a quarter.
        if (!event || (event.notes?.length ?? 0) === 0) {
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
          // Dots survive a re-value: stepping a dotted quarter gives a dotted
          // eighth, not a plain one. The dot is a property of the value the
          // player is writing, and the ladder steps the value.
          duration: { base: next, ...(event.duration.dots ? { dots: event.duration.dots } : {}) }
        });
        return true;
      }
      case 'toggleDots': {
        // The same split the duration ladder makes: ink is re-valued, absence
        // moves the pending duration instead (campaign item 11b's rule, item
        // 4's key). Dotted RESTS are reached by `rest half.` — the spelling
        // verb — for exactly that reason.
        const event = this.eventUnderCursor();
        const cycle = (dots: number) => (dots + 1) % 3;
        if (!event || (event.notes?.length ?? 0) === 0) {
          this.entryDots = cycle(this.entryDots);
          return true;
        }
        const dots = cycle(event.duration.dots ?? 0);
        this.apply({
          type: 'setDuration',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          duration: { base: event.duration.base, ...(dots ? { dots } : {}) }
        });
        return true;
      }
      case 'setTimeSignature': {
        this.apply({
          type: 'setTimeSignature',
          measureIndex: this.cursorState.measureIndex,
          time: {
            count: intent.count,
            unit: intent.unit,
            ...(intent.display ? { display: intent.display } : {})
          }
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
        const partIndex = this.cursorState.partIndex ?? 0;
        const measure = this.doc.parts?.[partIndex]?.measures?.[this.cursorState.measureIndex];
        const staffIndex = this.cursorState.staffIndex ?? 1;
        // The clef governing from the cursor's own position: a mid-measure one
        // when the cursor sits on it, else the bar's own declaration.
        const onset: [number, number] = [this.cursorState.onset.num, this.cursorState.onset.den];
        const here = (measure?.clefs ?? []).find(entry => {
          if ((entry.staff ?? 1) !== staffIndex) return false;
          if (!entry.position) return onset[0] === 0;
          const [n, d] = entry.position.fraction;
          return n * onset[1] === onset[0] * d;
        });
        if (!here) return false;
        this.apply({
          type: 'removeClef',
          measureIndex: this.cursorState.measureIndex,
          partIndex,
          staffIndex,
          ...(here.position ? { onset } : {})
        });
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
      case 'removeTimeSignature': {
        // Refuse rather than make a bar overfull — the same "guarded removal"
        // shape as removeMeasure, for the same reason: no silent damage.
        if (!timeSignatureRemovalFits(this.doc, this.cursorState.measureIndex)) return false;
        this.apply({ type: 'removeTimeSignature', measureIndex: this.cursorState.measureIndex });
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
        const selected = this.selectionState.level === 'note' ? this.selectedNoteKeys : [];
        if (selected.length > 1) {
          const [fromNoteKey, toNoteKey] = [selected[0], selected[selected.length - 1]];
          this.spanAnchorKey = null;
          return this.applyBulk([
            hasSlurStartingAt(this.doc, fromNoteKey)
              ? { type: 'removeSlur', noteKey: fromNoteKey }
              : { type: 'setSlur', fromNoteKey, toNoteKey }
          ]);
        }
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
      case 'setSyllable':
      case 'removeSyllable': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        const before = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'setSyllable'
            ? {
                type: 'setSyllable',
                noteKey: slot.noteKey,
                line: intent.line,
                text: intent.text,
                ...(intent.syllableType ? { syllableType: intent.syllableType } : {})
              }
            : { type: 'removeSyllable', noteKey: slot.noteKey, line: intent.line }
        );
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'setLyricLine':
      case 'removeLyricLine': {
        const before = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'setLyricLine'
            ? {
                type: 'setLyricLine',
                line: intent.line,
                ...(intent.label !== undefined ? { label: intent.label } : {}),
                ...(intent.lang !== undefined ? { lang: intent.lang } : {})
              }
            : { type: 'removeLyricLine', line: intent.line }
        );
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'toggleTechnique': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // Hammer-on vs pull-off is decided by the interval to the next note,
        // because it is decided by the fingers: you hammer UP and pull OFF
        // downward. One key, and the music picks the name.
        const kind =
          intent.kind === 'hammerPull' ? this.hammerOrPull(slot.noteKey) : intent.kind;
        if (!kind) return false;
        const existing = techniqueAt(this.doc, slot.noteKey, kind);
        const before = JSON.stringify(this.doc);
        this.apply(
          existing
            ? { type: 'removeTechnique', noteKey: slot.noteKey, kind }
            : {
                type: 'setTechnique',
                noteKey: slot.noteKey,
                technique: {
                  kind,
                  ...(intent.semitones !== undefined ? { semitones: intent.semitones } : {}),
                  ...(intent.release ? { release: true } : {})
                } as never
              }
        );
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'setFingering': {
        return this.applyBulk(this.selectedNoteKeys.map(noteKey => ({
          type: 'setFingering',
          noteKey,
          hand: intent.hand,
          finger: intent.finger
        })));
      }
      case 'removeStringAnnotation': {
        return this.applyBulk(this.selectedNoteKeys.map(noteKey => ({
          type: 'removeStringAnnotation',
          noteKey
        })));
      }
      case 'removeFingering': {
        return this.applyBulk(this.selectedNoteKeys.map(noteKey => ({
          type: 'removeFingering',
          noteKey
        })));
      }
      case 'setPartDeclaration': {
        if (!this.doc.parts?.[this.cursorState.partIndex ?? 0]) return false;
        this.apply({ type: 'setPartDeclaration', declaration: intent.declaration });
        return true;
      }
      case 'removePartDeclaration': {
        const before = JSON.stringify(this.doc);
        this.apply({
          type: 'removePartDeclaration',
          kind: intent.kind,
          partIndex: this.cursorState.partIndex ?? 0
        });
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'removeContainer': {
        const before_ = JSON.stringify(this.doc);
        this.apply({
          type: 'removeContainer',
          measureIndex: this.cursorState.measureIndex,
          sequenceIndex: intent.sequenceIndex,
          eventIndex: intent.eventIndex,
          partIndex: this.cursorState.partIndex ?? 0
        });
        if (JSON.stringify(this.doc) === before_) {
          this.history.undo();
          this.reindex();
          return false; // holds ink: refused, not silently ignored
        }
        return true;
      }
      case 'setAccidentalDisplay':
      case 'removeAccidentalDisplay': {
        return this.applyBulk(this.selectedNoteKeys.map(noteKey =>
          intent.type === 'setAccidentalDisplay'
            ? {
                type: 'setAccidentalDisplay',
                noteKey,
                show: intent.show,
                ...(intent.parenthesized ? { parenthesized: true } : {})
              }
            : { type: 'removeAccidentalDisplay', noteKey }
        ));
      }
      case 'removeKitNote': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        const was = JSON.stringify(this.doc);
        this.apply({ type: 'removeKitNote', noteKey: slot.noteKey });
        if (JSON.stringify(this.doc) === was) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'removeKitComponent':
      case 'removeSound': {
        const was = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'removeSound'
            ? { type: 'removeSound', sound: intent.sound }
            : {
                type: 'removeKitComponent',
                partIndex: this.cursorState.partIndex ?? 0,
                component: intent.component
              }
        );
        if (JSON.stringify(this.doc) === was) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'removeLayout':
      case 'removeScore':
      case 'removeMultimeasureRest': {
        const before_ = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'removeMultimeasureRest'
            ? { type: 'removeMultimeasureRest', scoreIndex: intent.scoreIndex, index: intent.index }
            : { type: intent.type, index: intent.index }
        );
        if (JSON.stringify(this.doc) === before_) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'setMarking':
      case 'removeMarking': {
        const targets = this.selectedEventAddresses();
        if (targets.length === 0) return false;
        return this.applyBulk(targets.map(event =>
          intent.type === 'setMarking'
            ? {
                type: 'setMarking' as const,
                event,
                marking: intent.marking,
                ...(intent.attributes ? { attributes: intent.attributes } : {})
              }
            : { type: 'removeMarking' as const, event, marking: intent.marking }
        ));
      }
      case 'setPositioned': {
        this.apply({
          type: 'setPositioned',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          attribute: intent.attribute
        });
        return true;
      }
      case 'removePositioned': {
        // Remove the entry at the cursor's own position — "the dynamic here",
        // which is how a player would name it.
        const measure = this.doc.parts?.[0]?.measures?.[this.cursorState.measureIndex];
        const list =
          (intent.kind === 'dynamic'
            ? measure?.dynamics
            : intent.kind === 'ottava'
              ? measure?.ottavas
              : measure?.directions) ?? [];
        const index = list.findIndex(entry => {
          const [num, den] = entry.position?.fraction ?? [0, 1];
          return num * this.cursorState.onset.den === this.cursorState.onset.num * den;
        });
        if (index < 0) return false;
        this.apply({
          type: 'removePositioned',
          measureIndex: this.cursorState.measureIndex,
          kind: intent.kind,
          index
        });
        return true;
      }
      case 'toggleBeam': {
        const selected = this.selectionState.level === 'note' ? this.selectedNoteKeys : [];
        if (selected.length > 1) {
          const first = selected[0];
          const existing = beamStartingAt(this.doc, first);
          if (existing) {
            this.spanAnchorKey = null;
            return this.applyBulk([{ type: 'removeBeam', ...existing }]);
          }
          const run = beamRunBetween(this.doc, first, selected[selected.length - 1]);
          if (run) {
            this.spanAnchorKey = null;
            return this.applyBulk([{
              type: 'setBeam',
              ...run,
              partIndex: this.cursorState.partIndex ?? 0
            }]);
          }
          // A beam cannot cross a voice or bar. Keep the established anchor
          // gesture available at the active edge for an endpoint the selected
          // run cannot express.
        }
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
          // Indices, not ids: the op mints what the beam will reference, so
          // reading the document here cannot change it and the ids the beam
          // names are the ids the document actually carries.
          const run = beamRunBetween(this.doc, this.spanAnchorKey, slot.noteKey);
          this.spanAnchorKey = null;
          if (!run) return false;
          this.apply({
            type: 'setBeam',
            measureIndex: run.measureIndex,
            from: run.from,
            to: run.to,
            partIndex: this.cursorState.partIndex ?? 0
          });
          return true;
        }
        // 3. Otherwise arm (or disarm, pressing twice in one place).
        this.spanAnchorKey = this.spanAnchorKey === slot.noteKey ? null : slot.noteKey;
        return true;
      }
      case 'setRestSpelling': {
        // Addressed by ONSET, not by note key: a rest is absence, so there is
        // no slot under the cursor to name — which is exactly why the cursor
        // can still sit there.
        const before = JSON.stringify(this.doc);
        this.apply({
          type: 'setRestSpelling',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          duration: intent.duration
        });
        return JSON.stringify(this.doc) !== before;
      }
      case 'setSupport': {
        // The document is the address — no navigation, like the part
        // declarations it shares a surface with.
        const before = JSON.stringify(this.doc);
        this.apply({ type: 'setSupport', key: intent.key, value: intent.value });
        return JSON.stringify(this.doc) !== before;
      }
      case 'wrapInContainer':
      case 'insertSpace': {
        // Both address the cursor's own event, in its own sequence — which is
        // why neither needs the press-navigate-press anchor slurs and beams
        // use: the typed declaration already says how much music it takes
        // (`wrapExtent`), and silence is inserted at a point, not over a span.
        // Addressed by ONSET, not by note key: a space is inserted exactly
        // where there is no ink, and a container may wrap rests as readily as
        // notes. `containerRunAt` cannot see either.
        const site = entryContentAt(
          this.doc,
          this.cursorState.measureIndex,
          this.cursorState.onset,
          this.cursorState.partIndex ?? 0,
          this.cursorState.voiceIndex ?? 0,
          this.cursorState.staffIndex ?? 1
        );
        if (!site) return false;
        const before = JSON.stringify(this.doc);
        if (intent.type === 'insertSpace') {
          this.apply({
            type: 'insertSpace',
            partIndex: site.partIndex,
            measureIndex: this.cursorState.measureIndex,
            sequenceIndex: site.sequenceIndex,
            index: site.index,
            duration: intent.duration
          });
        } else {
          const spec = completeContainerSpec(site.seq, site.index, intent.spec);
          if (!spec) return false;
          const extent = wrapExtent(site.seq, site.index, spec, intent.count);
          if (extent === null) return false;
          this.apply({
            type: 'wrapInContainer',
            partIndex: site.partIndex,
            measureIndex: this.cursorState.measureIndex,
            sequenceIndex: site.sequenceIndex,
            from: site.index,
            to: site.index + extent - 1,
            spec
          });
        }
        // The wrap re-times the bar on purpose, so the grid must be rebuilt
        // before the cursor is re-read — `apply` already does that; this only
        // reports whether the document actually moved.
        return JSON.stringify(this.doc) !== before;
      }
      case 'setFullMeasureRest':
      case 'removeFullMeasureRest':
      case 'setMeasureRepeat':
      case 'removeMeasureRepeat': {
        const measureIndex = this.cursorState.measureIndex;
        const before = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'setMeasureRepeat'
            ? {
                type: 'setMeasureRepeat',
                measureIndex,
                number: intent.number,
                ...(intent.counter ? { counter: intent.counter } : {})
              }
            : intent.type === 'setFullMeasureRest'
              ? {
                  type: 'setFullMeasureRest',
                  measureIndex,
                  ...(intent.visualDuration ? { visualDuration: intent.visualDuration } : {})
                }
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
        return this.applyBulk(this.selectedMeasureIndices().map(measureIndex => ({
          type: 'setMeasureAttribute',
          measureIndex,
          attribute: intent.attribute
        })));
      }
      case 'removeMeasureAttribute': {
        // Refuse when the attribute is not there, rather than queueing an op
        // that changes nothing (the same rule as removeClef).
        const field = MEASURE_ATTRIBUTE_FIELDS[intent.kind];
        const ops = this.selectedMeasureIndices().flatMap(measureIndex => {
          const measure = this.doc.global?.measures?.[measureIndex] as
            | Record<string, unknown>
            | undefined;
          return measure?.[field] === undefined ? [] : [{
            type: 'removeMeasureAttribute',
            measureIndex,
            kind: intent.kind
          } as const];
        });
        return this.applyBulk(ops);
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
        cursor: { ...this.cursorState, onset: { ...this.cursorState.onset } },
        selection: this.selection
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
        duration: { base: this.entryDuration, ...(this.entryDots ? { dots: this.entryDots } : {}) }
      });
    }
    this.lastDigit = { anchor, fret };
    return true;
  }

  /** How many notes share the cursor's moment and line — more than one means
   *  the address is ambiguous and `cycleSlot` has somewhere to go. */
  get coincidentCount(): number {
    return coincidentSlots(this.grid, this.cursorState, this.activeProjection).length;
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
      case 'extendSelection':
        return this.extendSelection(intent.direction);
      case 'closeSelection': {
        // The score rung already denotes the whole score; closing it again is
        // semantically and structurally idempotent.
        if (this.selectionState.level === 'score') return false;
        const scope = closureScopeForLevel(this.selectionState.level);
        if (
          this.selectionState.extent.kind === 'closure' &&
          this.selectionState.extent.scope === scope
        ) {
          return false;
        }
        this.selectionState = {
          level: this.selectionState.level,
          anchor: copyCursorAddress(before),
          extent: { kind: 'closure', scope }
        };
        return true;
      }
      case 'selectSectionRange': {
        if (this.selectionState.level !== 'section') return false;
        const range = sectionRangeAt(this.doc, before.measureIndex);
        if (!range || range.end <= range.start) return false;
        const start = moveToMeasure(this.grid, before, range.start);
        const end = moveToMeasure(this.grid, before, range.end - 1);
        this.cursorState = end;
        this.selectionState = {
          level: 'measure',
          anchor: copyCursorAddress(start),
          extent: { kind: 'cursor', cursor: copyCursorAddress(end) }
        };
        return true;
      }
      case 'relaxSelection': {
        // Escape drops an armed spanner anchor before it does anything else —
        // the gesture must be abandonable without touching the document.
        if (this.spanAnchorKey !== null) {
          this.spanAnchorKey = null;
          return true;
        }
        const next = relaxLevel(
          presentLevels(this.doc, this.grid, before, this.activeProjection),
          this.selectionState.level
        );
        if (!next) return false; // at the top — the mount deselects
        this.setSelectionLevel(next);
        return true;
      }
      case 'tightenSelection': {
        const next = tightenLevel(
          presentLevels(this.doc, this.grid, before, this.activeProjection),
          this.selectionState.level
        );
        if (next) {
          this.setSelectionLevel(next);
          return true;
        }
        if (this.selectionState.level === 'note') return false; // the bottom — Enter's input job, later
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
        this.reanchorSelection('note');
        return true;
      }
      // Bare arrows move by the rung's unit: positions/events/containers at
      // the fine rungs, bars at the bar rungs, sections at section, nothing at score.
      case 'nextPosition':
        if (this.collapseHorizontal(1)) return true;
        this.cursorState = this.moveHorizontal(before, 1);
        break;
      case 'prevPosition':
        if (this.collapseHorizontal(-1)) return true;
        this.cursorState = this.moveHorizontal(before, -1);
        break;
      case 'nextMeasure':
        this.cursorState = moveMeasure(this.grid, before, 1);
        break;
      case 'prevMeasure':
        this.cursorState = moveMeasure(this.grid, before, -1);
        break;
      // The vertical axis belongs to the RUNG, not always to the line (the
      // per-level navigation map): the staff/fingerboard at note level, the
      // voice stack at the event/container rungs, the system's staves at part-measure.
      // The measure and score rungs are resolved by the MOUNT — "the
      // neighbouring system" is a fact about the paint and "the next document"
      // one about the host, neither visible from this DOM-free layer, so both
      // arrive here as an already-resolved intent (`goToMeasure`) or not at all.
      case 'lineDown':
      case 'lineUp': {
        const delta = intent.type === 'lineDown' ? 1 : -1;
        switch (this.selectionState.level) {
          case 'note':
            this.cursorState = moveLine(this.grid, before, delta, this.activeProjection);
            break;
          case 'event':
          case 'container':
          case 'voiceMeasure':
            if (!this.stepVoice(before, delta)) return false;
            this.reanchorSelection();
            return true;
          case 'partMeasure':
            if (!this.stepStaff(before, delta)) return false;
            this.reanchorSelection();
            return true;
          default:
            return false; // section: unbound (no honest referent); measure/score: the mount's
        }
        break;
      }
      case 'goToMeasure':
        this.cursorState = moveToMeasure(this.grid, before, intent.measureIndex);
        break;
      case 'setPart': {
        const parts = this.doc.parts ?? [];
        if (intent.partIndex < 0 || intent.partIndex >= parts.length) return false;
        if ((before.partIndex ?? 0) === intent.partIndex) return false;
        // A different part is a different grid: rebuild, then land on its first
        // position rather than pretending the old address means anything here.
        this.grid = buildGrid(this.doc, intent.partIndex, 1);
        this.cursorState = { ...initialCursor(this.grid), partIndex: intent.partIndex };
        this.activeProjection = this.grid.mode === 'string' ? 'tab' : 'notation';
        this.reanchorSelection();
        return true;
      }
      case 'setStaff': {
        const part = this.doc.parts?.[before.partIndex ?? 0];
        const staves = part?.staves ?? 1;
        if (intent.staffIndex < 1 || intent.staffIndex > staves) return false;
        if ((before.staffIndex ?? 1) === intent.staffIndex) return false;
        this.grid = buildGrid(this.doc, before.partIndex ?? 0, intent.staffIndex);
        this.cursorState = {
          ...initialCursor(this.grid),
          ...(before.partIndex ? { partIndex: before.partIndex } : {}),
          staffIndex: intent.staffIndex
        };
        this.activeProjection = this.grid.mode === 'string' ? 'tab' : 'notation';
        this.reanchorSelection();
        return true;
      }
      case 'cycleSlot': {
        const next = cycleSlot(this.grid, before, this.activeProjection);
        if (next === before) return false; // nothing coincident to step to
        this.cursorState = next;
        this.reanchorSelection();
        return true;
      }
      case 'setProjection': {
        if (intent.projection === this.activeProjection) return false;
        // A doc with no fingerboard has no tab projection to switch to.
        if (intent.projection === 'tab' && this.grid.mode !== 'string') return false;
        // Remap BOTH concrete endpoints into the new space. Re-anchoring here
        // would silently discard a range merely because the reader switched
        // between notation and tab.
        const previousProjection = this.activeProjection;
        const mappedCursor = this.remapProjectionCursor(
          before,
          previousProjection,
          intent.projection
        );
        const mappedAnchor = this.remapProjectionCursor(
          this.selectionState.anchor,
          previousProjection,
          intent.projection
        );
        this.activeProjection = intent.projection;
        this.cursorState = mappedCursor;
        this.selectionState = {
          ...this.selectionState,
          anchor: mappedAnchor,
          extent: this.selectionState.extent.kind === 'cursor'
            ? {
                kind: 'cursor',
                cursor: this.remapProjectionCursor(
                  this.selectionState.extent.cursor,
                  previousProjection,
                  intent.projection
                )
              }
            : this.selectionState.extent
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
        // The climb, by rung: at the note rungs the first ancestor whose ←→
        // means something else is the bar; from voice-measure up the bar step
        // is the rung's OWN move, so the climb continues to the section (dead
        // in a document that declares none — the boundary, not a bug).
        switch (this.selectionState.level) {
          case 'note':
          case 'event':
          case 'container':
            this.cursorState = moveMeasure(this.grid, before, delta);
            break;
          case 'voiceMeasure':
          case 'partMeasure':
          case 'measure':
            this.cursorState = this.sectionStep(before, delta);
            break;
          default:
            return false; // section/score: no wider horizontal unit to climb to
        }
        const changed = this.cursorState !== before;
        if (changed) this.reanchorSelection();
        return changed;
      }
      case 'jumpUp':
      case 'jumpDown': {
        const delta = intent.type === 'jumpDown' ? 1 : -1;
        // The same climb on the vertical: the voice at note level, the staves
        // from event and voice-measure (whose own ↑↓ is already the voice
        // step), and at part-measure the system — which the mount resolves,
        // exactly as it does the measure rung's bare ↑↓.
        switch (this.selectionState.level) {
          case 'note':
            if (!this.stepVoice(before, delta)) return false;
            this.reanchorSelection();
            return true;
          case 'event':
          case 'container':
          case 'voiceMeasure':
            if (!this.stepStaff(before, delta)) return false;
            this.reanchorSelection();
            return true;
          default:
            return false;
        }
      }
    }
    const changed = this.cursorState !== before;
    if (changed) this.reanchorSelection();
    return changed;
  }

  private setSelectionLevel(level: SelectionLevel): void {
    const pin = (cursor: EditorCursor) =>
      level === 'event' || level === 'container'
        ? pinEventSlot(this.grid, cursor, this.activeProjection)
        : withoutEventPin(cursor);
    this.cursorState = pin(this.cursorState);
    this.selectionState = {
      ...this.selectionState,
      level,
      anchor: pin(this.selectionState.anchor),
      extent: this.selectionState.extent.kind === 'closure'
        ? { kind: 'closure', scope: closureScopeForLevel(level) }
        : { kind: 'cursor', cursor: pin(this.selectionState.extent.cursor) }
    };
  }

  /** First bare ←/→ collapses a range to that visual edge; only the next
   * press navigates. A closure has no honest edge in a sparse voice, so it
   * collapses at the active cursor. */
  private collapseHorizontal(direction: 1 | -1): boolean {
    if (this.selectionState.extent.kind === 'closure') {
      this.reanchorSelection();
      return true;
    }
    const anchor = this.selectionState.anchor;
    const extent = this.selectionState.extent.cursor;
    if (cursorAddressesEqual(anchor, extent)) return false;
    const order = compareCursorTime(anchor, extent);
    const left = order <= 0 ? anchor : extent;
    const right = order <= 0 ? extent : anchor;
    this.cursorState = copyCursorAddress(direction === -1 ? left : right);
    this.reanchorSelection();
    return true;
  }

  private extendSelection(direction: 'previous' | 'next' | 'end'): boolean {
    // Shift after a live closure starts a fresh concrete range at the active
    // cursor; a closure's sparse scope has no meaningful geometric edge.
    const anchor = copyCursorAddress(
      this.selectionState.extent.kind === 'closure'
        ? this.cursorState
        : this.selectionState.anchor
    );
    let next = this.cursorState;
    if (direction === 'end') {
      const limit = this.grid.positions.length + (this.doc.global?.measures?.length ?? 0) + 2;
      for (let guard = 0; guard < limit; guard++) {
        const candidate = this.moveSelectionHorizontal(next, 1);
        if (cursorAddressesEqual(candidate, next)) break;
        next = candidate;
      }
    } else {
      next = this.moveSelectionHorizontal(next, direction === 'next' ? 1 : -1);
    }
    if (cursorAddressesEqual(next, this.cursorState)) return false;
    this.cursorState = next;
    this.selectionState = {
      level: this.selectionState.level,
      anchor,
      extent: { kind: 'cursor', cursor: copyCursorAddress(next) }
    };
    return true;
  }

  /** The horizontal RANGE unit. Note and event extension deliberately skip
   * entry ghosts; they select existing notes/events only. Wider rungs follow
   * the same bar/section units as their bare horizontal navigation. */
  private moveSelectionHorizontal(before: EditorCursor, delta: 1 | -1): EditorCursor {
    const level = this.selectionState.level;
    if (level === 'container') return this.containerStep(before, delta);
    if (level === 'note' || level === 'event') {
      const at = this.grid.positions.findIndex(position =>
        position.measureIndex === before.measureIndex && onsetsEqual(position.onset, before.onset)
      );
      if (at < 0) return before;
      const voice = before.voiceIndex ?? 0;
      for (let index = at + delta; index >= 0 && index < this.grid.positions.length; index += delta) {
        const position = this.grid.positions[index];
        if (level === 'event') {
          if (!position.events.some(event => event.voiceIndex === voice)) continue;
          return cursorAtPosition(before, position, before.line);
        }
        const notes = position.slots.filter(slot => slot.voiceIndex === voice);
        if (notes.length === 0) continue;
        const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
        const line = nearestSlotLine(notes, before.line, tab);
        return cursorAtPosition(before, position, line);
      }
      return before;
    }
    if (level === 'voiceMeasure') {
      const part = this.doc.parts?.[before.partIndex ?? 0];
      const measureCount = Math.max(
        part?.measures?.length ?? 0,
        this.doc.global?.measures?.length ?? 0
      );
      const staff = before.staffIndex ?? 1;
      const voice = before.voiceIndex ?? 0;
      for (let measureIndex = before.measureIndex + delta;
        measureIndex >= 0 && measureIndex < measureCount;
        measureIndex += delta) {
        const sequences = (part?.measures?.[measureIndex]?.sequences ?? [])
          .filter(sequence => (sequence.staff ?? 1) === staff);
        if (!sequences[voice]) continue;
        const landed = moveToMeasure(this.grid, before, measureIndex);
        const { voiceIndex: _landedVoice, ...position } = landed;
        return {
          ...position,
          ...(voice ? { voiceIndex: voice } : {})
        };
      }
      return before;
    }
    switch (level) {
      case 'partMeasure':
      case 'measure':
        return moveMeasure(this.grid, before, delta);
      case 'section':
        return this.sectionStep(before, delta);
      case 'score':
        return before;
    }
  }

  private remapProjectionCursor(
    cursor: EditorCursor,
    from: Projection,
    to: Projection
  ): EditorCursor {
    const grid = buildGrid(this.doc, cursor.partIndex ?? 0, cursor.staffIndex ?? 1);
    const selected = slotAt(grid, cursor, from) ?? positionAt(grid, cursor)?.slots[0];
    return {
      ...cursor,
      onset: { ...cursor.onset },
      line: to === 'tab' ? selected?.line ?? 1 : selected?.staffPosition ?? 0
    };
  }

  /** One step of horizontal movement in the current rung's unit. */
  private moveHorizontal(before: EditorCursor, delta: 1 | -1): EditorCursor {
    switch (this.selectionState.level) {
      case 'note':
        // The note row of the navigation map: tab walks the full grid (space,
        // string-sticky); notation walks this voice's ink, landing on the
        // nearest-pitch member (snap-to-ink, the working default).
        return this.activeProjection === 'tab' && this.grid.mode === 'string'
          ? movePosition(this.grid, before, delta)
          : movePositionInk(this.grid, before, delta, 'nearest');
      case 'event':
        // "Prev/next event IN THIS VOICE, rests included" — the same walk in
        // both projections. Walking every column instead (which is what this
        // did) stepped onto onsets where the anchor voice has no event, and
        // the event rung has nothing to address there: the slice went blank at
        // a position the cursor had just been told to select.
        return movePositionInk(this.grid, before, delta, 'keep');
      case 'container':
        return this.containerStep(before, delta);
      case 'voiceMeasure':
      case 'partMeasure':
      case 'measure':
        return moveMeasure(this.grid, before, delta);
      case 'section':
        return this.sectionStep(before, delta);
      case 'score':
        return before; // the whole score is selected — nowhere to go
    }
  }

  /** Prev/next section START; prev from mid-section goes to this section's own
   *  start first (the audio-player convention). Shared by the section rung's
   *  bare arrows and the section jump the bar rungs climb to. */
  private sectionStep(before: EditorCursor, delta: 1 | -1): EditorCursor {
    const starts = sectionStarts(this.doc);
    const target =
      delta === 1
        ? starts.find(s => s > before.measureIndex)
        : [...starts].reverse().find(s => s < before.measureIndex);
    return target === undefined ? before : moveToMeasure(this.grid, before, target);
  }

  /** Prev/next authored rhythm container in this staff/voice. Inner events
   * already carry their parent's content index in the grid; this walk merely
   * deduplicates that identity and lands on the target's first child. */
  private containerStep(before: EditorCursor, delta: 1 | -1): EditorCursor {
    const members = resolveSelection(this.doc, {
      level: 'container',
      anchor: copyCursorAddress(before),
      extent: { kind: 'closure', scope: 'voice' }
    }, this.activeProjection).members.filter(member => member.kind === 'container');
    const current = eventSlotAt(this.grid, before, this.activeProjection);
    if (!current || current.containerIndex === undefined) return before;
    const at = members.findIndex(member =>
      member.measureIndex === before.measureIndex &&
      member.voiceIndex === current.voiceIndex &&
      member.eventIndex === current.eventIndex
    );
    const target = members[at + delta];
    if (at < 0 || !target) return before;
    const position = this.grid.positions.find(candidate =>
      candidate.measureIndex === target.measureIndex &&
      candidate.events.some(event =>
        event.voiceIndex === target.voiceIndex &&
        event.eventIndex === target.eventIndex &&
        event.containerIndex !== undefined
      )
    );
    if (!position) return before;
    const targetSlots = position.slots.filter(slot =>
      slot.voiceIndex === target.voiceIndex &&
      slot.eventIndex === target.eventIndex &&
      slot.containerIndex !== undefined
    );
    const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
    const line = targetSlots.length > 0 ? nearestSlotLine(targetSlots, before.line, tab) : before.line;
    const landed = cursorAtPosition(
      { ...before, ...(target.voiceIndex ? { voiceIndex: target.voiceIndex } : {}) },
      position,
      line
    );
    const ordinal = coincidentSlots(this.grid, landed, this.activeProjection).findIndex(slot =>
      slot.voiceIndex === target.voiceIndex &&
      slot.eventIndex === target.eventIndex &&
      slot.containerIndex !== undefined
    );
    const eventSlotIndex = position.events.findIndex(event =>
      event.voiceIndex === target.voiceIndex &&
      event.eventIndex === target.eventIndex &&
      event.containerIndex !== undefined
    );
    return {
      ...landed,
      ...(ordinal > 0 ? { slotIndex: ordinal } : {}),
      ...(eventSlotIndex >= 0 ? { eventSlotIndex } : {})
    };
  }

  /**
   * The voice step — the stack's next unit, and the event rungs' whole vertical
   * axis. Lands on the target voice's event SOUNDING at the cursor's instant
   * (latest onset at or before it, else its first in the bar): voices rarely
   * share onsets, so requiring a same-beat onset made the move feel broken.
   *
   * STOPS at the outermost voice (decided 2026-08-15 with the per-level pass):
   * a wrap across the stack is indistinguishable from a failed press in dense
   * writing, and the doc's own rule is that an arrow doing nothing beats an
   * arrow doing something arbitrary.
   */
  private stepVoice(before: EditorCursor, delta: 1 | -1): boolean {
    const target = (before.voiceIndex ?? 0) + delta;
    if (target < 0) return false;
    const inMeasure = this.grid.positions.filter(
      p => p.measureIndex === before.measureIndex && p.voices.includes(target)
    );
    if (inMeasure.length === 0) return false; // no such voice here — the upper stop
    const covering = [...inMeasure].reverse().find(p => !onsetLess(before.onset, p.onset));
    const targetPos = covering ?? inMeasure[0];
    const slots = targetPos.slots.filter(s => s.voiceIndex === target);
    const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
    this.cursorState = {
      measureIndex: targetPos.measureIndex,
      onset: targetPos.onset,
      // The step is what SETS the anchor voice — ←→ then stays in it.
      ...(target ? { voiceIndex: target } : {}),
      ...(before.partIndex ? { partIndex: before.partIndex } : {}),
      ...(before.staffIndex && before.staffIndex !== 1 ? { staffIndex: before.staffIndex } : {}),
      line: slots.length > 0 ? nearestSlotLine(slots, before.line, tab) : before.line
    };
    return true;
  }

  /**
   * The part-measure rung's vertical: the system's staves in score order —
   * every staff of a part before the next part, because that is the order they
   * are drawn in. Stops at both ends, like the voice step.
   *
   * The BAR is what travels: walking staves must keep reading the same measure,
   * which is the whole point of the rung. The anchor voice does not — voice
   * numbering is per-sequence and means nothing in another part.
   */
  private stepStaff(before: EditorCursor, delta: 1 | -1): boolean {
    const staves = (this.doc.parts ?? []).flatMap((part, partIndex) =>
      Array.from({ length: Math.max(1, part.staves ?? 1) }, (_, k) => ({
        partIndex,
        staffIndex: k + 1
      }))
    );
    const at = staves.findIndex(
      s => s.partIndex === (before.partIndex ?? 0) && s.staffIndex === (before.staffIndex ?? 1)
    );
    const target = at < 0 ? undefined : staves[at + delta];
    if (!target) return false;

    this.grid = buildGrid(this.doc, target.partIndex, target.staffIndex);
    if (this.grid.positions.length === 0) return false;
    // Only FORCE the projection when the one in hand cannot exist here. The
    // map's rule is that arrows never switch projection; notation always
    // exists, so a tab reader arriving at a fingerboard-less staff is the one
    // case that has to move.
    if (this.activeProjection === 'tab' && this.grid.mode !== 'string') {
      this.activeProjection = 'notation';
    }
    const landed = clampCursor(this.grid, {
      measureIndex: before.measureIndex,
      onset: before.onset,
      line: before.line,
      ...(target.partIndex ? { partIndex: target.partIndex } : {}),
      ...(target.staffIndex !== 1 ? { staffIndex: target.staffIndex } : {})
    });
    // The line means a different SPACE in each grid (string number vs staff
    // position), so it cannot simply travel: land on this staff's ink, which
    // also gives the cursor an honest voice to carry.
    const slot = positionAt(this.grid, landed)?.slots[0];
    this.cursorState = slot
      ? {
          ...landed,
          line: this.activeProjection === 'tab' && this.grid.mode === 'string'
            ? slot.line
            : slot.staffPosition,
          ...(slot.voiceIndex ? { voiceIndex: slot.voiceIndex } : {})
        }
      : landed;
    return true;
  }

  /** Point selections follow ordinary navigation. Range gestures will move
   * only the active extent; until those intents exist, every cursor move is a
   * conventional collapse/re-anchor at the current rung. */
  private reanchorSelection(level: SelectionLevel = this.selectionState.level): void {
    if (level === 'event' || level === 'container') {
      this.cursorState = pinEventSlot(this.grid, this.cursorState, this.activeProjection);
    } else {
      this.cursorState = withoutEventPin(this.cursorState);
    }
    this.selectionState = pointSelection(level, this.cursorState);
  }

  /** One command over zero or more resolved members. A multi-member command
   * is one history/log entry, and unlike entry gestures it keeps the range so
   * the tray can immediately report its new active/mixed state. */
  private applyBulk(ops: EditOp[]): boolean {
    if (ops.length === 0) return false;
    const before = JSON.stringify(this.doc);
    this.apply(ops.length === 1 ? ops[0] : { type: 'batch', ops }, true);
    if (JSON.stringify(this.doc) !== before) return true;
    this.history.undo();
    this.reindex(true);
    return false;
  }

  private applyDestructive(ops: EditOp[]): boolean {
    const level = this.selectionState.level;
    if (!this.applyBulk(ops)) return false;
    const present = presentLevels(
      this.doc,
      this.grid,
      this.cursorState,
      this.activeProjection
    );
    if (present.has(level) && this.resolvedSelection.members.length > 0) return true;
    const ancestor = relaxLevel(present, level);
    if (ancestor) this.reanchorSelection(ancestor);
    return true;
  }

  private selectedEventAddresses(): EventAddress[] {
    const addresses = this.resolvedSelection.members.flatMap(member => {
      if (member.kind !== 'note' && member.kind !== 'event') return [];
      return [{
        partIndex: member.partIndex,
        staffIndex: member.staffIndex,
        measureIndex: member.measureIndex,
        voiceIndex: member.voiceIndex,
        eventIndex: member.eventIndex,
        ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
      }];
    });
    const seen = new Set<string>();
    return addresses.filter(address => {
      const key = eventAddressKey(address);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private selectedMeasureIndices(): number[] {
    const indices = this.resolvedSelection.members.flatMap(member => {
      if (member.kind === 'measure') return [member.measureIndex];
      if (member.kind === 'section') return [member.start];
      return [];
    });
    return [...new Set(indices.length > 0 ? indices : [this.cursorState.measureIndex])];
  }

  private apply(op: EditOp, preserveSelection = false): void {
    this.history.apply(op, this.applyingIntent ?? undefined);
    this.reindex(preserveSelection);
    if (!preserveSelection) {
      // Entry and point mutations act at the cursor's note/position, so they
      // re-anchor there. Bulk property commands retain the range in reindex.
      this.reanchorSelection('note');
    }
  }

  /** The grid derives from the document, so every doc change rebuilds it and
   *  re-anchors the cursor (a removed measure must not strand it). */
  private reindex(preserveSelection = false): void {
    const selection = preserveSelection ? cloneSelection(this.selectionState) : null;
    const wasPoint = selection?.extent.kind === 'cursor' &&
      cursorAddressesEqual(selection.anchor, selection.extent.cursor);
    // The note under the active edge before the mutation: if it survives, the
    // cursor follows its new line. This applies equally to apply, undo and
    // redo, which is what lets all three preserve a range honestly.
    const anchor = slotAt(this.grid, this.cursorState, this.activeProjection)?.noteKey ?? null;
    const partIndex = Math.min(
      this.cursorState.partIndex ?? 0,
      Math.max(0, (this.doc.parts?.length ?? 1) - 1)
    );
    const staffIndex = Math.min(
      this.cursorState.staffIndex ?? 1,
      Math.max(1, this.doc.parts?.[partIndex]?.staves ?? 1)
    );
    const { partIndex: _part, staffIndex: _staff, ...position } = this.cursorState;
    this.cursorState = {
      ...position,
      ...(partIndex ? { partIndex } : {}),
      ...(staffIndex !== 1 ? { staffIndex } : {})
    };
    this.grid = buildGrid(
      this.doc,
      partIndex,
      staffIndex
    );
    this.cursorState = clampCursor(this.grid, this.cursorState);
    if (anchor) {
      const moved = positionAt(this.grid, this.cursorState)?.slots.find(
        slot => slot.noteKey === anchor
      );
      if (moved) {
        const line = this.activeProjection === 'tab' ? moved.line : moved.staffPosition;
        this.cursorState = { ...this.cursorState, line };
      }
    }
    if (selection) {
      this.selectionState = wasPoint
        ? pointSelection(selection.level, this.cursorState)
        : selection.extent.kind === 'cursor'
          ? {
              ...selection,
              extent: { kind: 'cursor', cursor: copyCursorAddress(this.cursorState) }
            }
          : selection;
    } else this.reanchorSelection();
  }

  private selectedNote(): MnxNote | undefined {
    const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
    if (!slot) return undefined;
    return eventAtCursor(this.doc, this.grid, this.cursorState, this.activeProjection)?.notes?.[
      slot.noteIndex
    ];
  }

  /** The voice-0 timed event starting exactly at the cursor's onset. */
  /** Hammer-on or pull-off? The interval to the next note decides — up is a
   *  hammer, down a pull. Returns null when there is no next note to travel to. */
  private hammerOrPull(noteKey: string): 'hammerOn' | 'pullOff' | null {
    const pair = nextNotePitchPair(this.doc, noteKey);
    if (!pair) return null;
    return pair.next > pair.current ? 'hammerOn' : 'pullOff';
  }

  private eventUnderCursor(): MnxEvent | undefined {
    return eventAtCursor(this.doc, this.grid, this.cursorState, this.activeProjection);
  }
}

function cloneSelection(selection: SelectionState): SelectionState {
  return {
    level: selection.level,
    anchor: { ...selection.anchor, onset: { ...selection.anchor.onset } },
    extent: selection.extent.kind === 'cursor'
      ? {
          kind: 'cursor',
          cursor: { ...selection.extent.cursor, onset: { ...selection.extent.cursor.onset } }
        }
      : { ...selection.extent }
  };
}

function copyCursorAddress(cursor: EditorCursor): EditorCursor {
  return { ...cursor, onset: { ...cursor.onset } };
}

function withoutEventPin(cursor: EditorCursor): EditorCursor {
  const { eventSlotIndex: _drop, ...rest } = cursor;
  return rest;
}

function eventAddressKey(address: EventAddress): string {
  return [
    address.partIndex,
    address.staffIndex,
    address.measureIndex,
    address.voiceIndex,
    address.eventIndex,
    address.containerIndex ?? -1
  ].join(':');
}

function eventAddressOf(member: {
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
}): EventAddress {
  return {
    partIndex: member.partIndex,
    staffIndex: member.staffIndex,
    measureIndex: member.measureIndex,
    voiceIndex: member.voiceIndex,
    eventIndex: member.eventIndex,
    ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
  };
}

function cursorAddressesEqual(a: EditorCursor, b: EditorCursor): boolean {
  return (
    a.measureIndex === b.measureIndex &&
    onsetsEqual(a.onset, b.onset) &&
    a.line === b.line &&
    a.slotIndex === b.slotIndex &&
    a.eventSlotIndex === b.eventSlotIndex &&
    (a.partIndex ?? 0) === (b.partIndex ?? 0) &&
    (a.staffIndex ?? 1) === (b.staffIndex ?? 1) &&
    (a.voiceIndex ?? 0) === (b.voiceIndex ?? 0)
  );
}

function compareCursorTime(a: EditorCursor, b: EditorCursor): number {
  if (a.measureIndex !== b.measureIndex) return a.measureIndex - b.measureIndex;
  return a.onset.num * b.onset.den - b.onset.num * a.onset.den;
}

function cursorAtPosition(before: EditorCursor, position: Position, line: number): EditorCursor {
  const { slotIndex: _slotIndex, eventSlotIndex: _eventSlotIndex, ...address } = before;
  return {
    ...address,
    measureIndex: position.measureIndex,
    onset: { ...position.onset },
    line
  };
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
