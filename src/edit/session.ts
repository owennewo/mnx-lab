// The editor session: intent + (doc, cursor) → cursor move or EditOp.
// This is stage 2 of the input layer (roadmap/complete/core-editor-input-layer.md)
// — DOM-free on purpose, so the workbench mount and the harness replay test
// drive the exact same object. The session records every intent it handles;
// that log IS the trace fixture ("recording is the same stream as undo").
import type { MnxEvent, MnxNote, MnxNoteValueBase, MnxStructure } from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import { isNavigationIntent, MAX_ENTRY_FRET } from './intents.ts';
import type { EditOp, EntryTarget, EventAddress, OpLogEntry } from './ops.ts';
import type { PasteLanding } from './selectionPastePlanner.ts';
import {
  POSITIONED_FIELDS,
  beamRunBetween,
  beamEndingAt,
  beamStartingAt,
  completeContainerSpec,
  entryContentAt,
  eventAtAddress,
  wrapExtent,
  EditHistory,
  hasSlurStartingAt,
  slurEndingAt,
  nextNotePitchPair,
  techniqueAt,
  MEASURE_ATTRIBUTE_FIELDS,
  partHasInk,
  timeSignatureRemovalFits
} from './ops.ts';
import { spannersUnderSelection } from './spannerCoincidence.ts';
import {
  buildGrid,
  clampCursor,
  coincidentSlots,
  cycleSlot,
  eventAtCursor,
  initialCursor,
  isPastEnd,
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
import { syntheticEventKey } from '../model/noteKeys.ts';
import { eventAddressesUnderSelection, eventHoldsInk } from './selectionEvents.ts';
import { capoOf, defaultStringFor, midiOfPitch, tuningOf } from './tabStrings.ts';
import { clefAt, keyFifthsAt, pitchAtStaffPosition, spellPitch } from './staffSpace.ts';
import {
  closureScopeForLevel,
  presentLevels,
  pointSelection,
  relaxLevel,
  resolveSelection,
  sectionStarts,
  containerCoincidence,
  eventMemberKey,
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

/**
 * What a `delete` intent did — the transient notice's raw material.
 *
 * `cleared` is press 1 (`thenRemoves` says whether a press 2 is waiting),
 * `removed` is press 2, and `refused` is the case that used to be silence.
 */
export type DeleteOutcome =
  | { kind: 'cleared'; level: SelectionLevel; notes: number; thenRemoves: boolean }
  | { kind: 'removed'; level: SelectionLevel; members: number }
  | { kind: 'refused'; level: SelectionLevel };

/** RETIRED 2026-08-30 (core-selection-range-grain.md decision 5, by the
 *  user's call): the two-press armed anchor gave way to the model gestures —
 *  a bare press attaches to the NEXT note, a press at a spanner's end
 *  extends it, a range sets the extent. Kept as a doc pointer only. */


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
  private lastDeleteOutcome: DeleteOutcome | null = null;
  /** The armed end of a spanner-in-progress (campaign item 10): a note key, or
   *  null. The keyboard names two places in two presses because the ladder
   *  cannot yet extend laterally; when it can, "slur the selected run" becomes
   *  a second route to the same op rather than a replacement. */
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
    readonly scenarioId: string = '',
    options: {
      /**
       * The rung this session OPENS on, when the host is continuing a ladder
       * gesture that crossed documents rather than opening a new one.
       *
       * The document rung's ↑/↓ is the neighbouring DOCUMENT — a fact about the
       * host, so the mount resolves it (see `escalateToRail`) — and crossing
       * a document boundary builds a new session. Without this the new one
       * opened at `note`, so the second ↑ meant "move a notehead" and walking
       * a collection meant climbing the whole ladder again between every
       * step. Every other rung's arrows already survive their own step:
       * `navigate` ends by re-anchoring at the CURRENT level, which is why
       * the measure rung's system step is repeatable and this one was not.
       *
       * Only pass a rung that structurally exists — `partMeasure`, `measure`
       * and `document` always do (`presentLevels`), which covers every
       * gesture that can cross a document.
       */
      level?: SelectionLevel;
    } = {}
  ) {
    // Deep-copy so later external mutation of the argument can't desync the
    // byte-identical undo-all contract.
    this.initial = JSON.parse(JSON.stringify(doc)) as MnxStructure;
    this.history = new EditHistory(this.initial);
    this.grid = buildGrid(this.initial, 0);
    this.cursorState = initialCursor(this.grid);
    this.selectionState = pointSelection(options.level ?? 'note', this.cursorState);
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

  /** What the last `delete` intent actually did. Delete is the one verb whose
   *  meaning changes between two identical keystrokes, so it has to be able
   *  to say which press this was; any other intent clears it, so a stale
   *  sentence can never be shown for a keystroke that was not a delete. */
  get lastDelete(): DeleteOutcome | null {
    return this.lastDeleteOutcome;
  }

  get resolvedSelection(): ResolvedSelection {
    return resolveSelection(this.doc, this.selectionState, this.activeProjection);
  }

  get projection(): Projection {
    return this.activeProjection;
  }

  /**
   * The cursor is standing on the GHOST BAR past the end of the score
   * (core-rung-insert.md) — a place, not a bar: the document has nothing
   * there and nothing has been written by arriving. The next keystroke that
   * puts something in it materialises the bar and the content as ONE batch.
   */
  get pastEnd(): boolean {
    return isPastEnd(this.grid, this.cursorState);
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
    // Keys the ghost can look up in the rendered SVG to find its COLUMN,
    // best first. Two rules, and the second was learned the hard way:
    //
    //  1. Rests count. A rest-only beat used to offer nothing at all, so the
    //     ghost fell back to interpolating a metric fraction across the bar
    //     and drew itself on the wrong beat (core-rung-insert.md).
    //  2. THE CURSOR'S OWN VOICE WINS, ahead of any note that merely shares
    //     the beat. Voices normally share columns, which is why "any voice"
    //     looked sufficient — but they only share them while they agree about
    //     the bar. Insert one note and this voice has five events where its
    //     neighbour has four; the onsets still line up and the COLUMNS no
    //     longer do. The ghost then anchored to the other voice's note and
    //     drew itself a column away from the rest it was standing on.
    //
    // Within a voice, notes lead: a column with ink anchors more precisely
    // than the rest that shares it.
    const voice = this.cursorState.voiceIndex ?? 0;
    const mine: string[] = [];
    const theirs: string[] = [];
    for (const slot of position?.slots ?? [])
      (slot.voiceIndex === voice ? mine : theirs).push(slot.noteKey);
    for (const event of position?.events ?? []) {
      const address = {
        partIndex: this.cursorState.partIndex ?? 0,
        staffIndex: this.cursorState.staffIndex ?? 1,
        measureIndex: this.cursorState.measureIndex,
        voiceIndex: event.voiceIndex,
        eventIndex: event.eventIndex,
        ...(event.containerIndex === undefined ? {} : { containerIndex: event.containerIndex })
      };
      const resolved = eventAtAddress(this.doc, address);
      if (resolved?.rest)
        (event.voiceIndex === voice ? mine : theirs).push(
          resolved.id ?? syntheticEventKey(address)
        );
    }
    const anchorKeys = [...mine, ...theirs];
    return {
      occupied: !!slotAt(this.grid, this.cursorState, this.activeProjection),
      staffPosition: this.activeProjection === 'notation' ? this.cursorState.line : null,
      string: this.activeProjection === 'tab' ? this.cursorState.line : null,
      anchorKeys
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
    // Delete's outcome describes ONE keystroke, so anything else discards it.
    // A notice that outlived its keystroke would report the previous press.
    if (intent.type !== 'delete') this.lastDeleteOutcome = null;
    if (isNavigationIntent(intent)) return this.navigate(intent);
    // Provenance for the op queue: apply() stamps the intent being handled
    // into the history entry (forward-recorded, never inferred).
    this.applyingIntent = intent;
    switch (intent.type) {
      case 'undo': {
        if (!this.history.canUndo) return false;
        const op = this.history.appliedOps[this.history.appliedOps.length - 1];
        this.history.undo();
        if (op?.type === 'pasteSelection' || op?.type === 'cutSelection')
          this.restoreSelection(op.selectionBefore);
        else this.reindex(true);
        return true;
      }
      case 'redo': {
        if (!this.history.canRedo) return false;
        const op = this.history.futureEntries[0]?.op;
        this.history.redo();
        if (op?.type === 'pasteSelection' || op?.type === 'cutSelection')
          this.restoreSelection(op.selectionAfter);
        else this.reindex(true);
        return true;
      }
      case 'applyPastePlan': {
        const selectionBefore = this.selection;
        const selectionAfter = pasteLandingSelection(
          intent.plan.document,
          intent.plan.landing,
          this.activeProjection
        );
        this.history.apply({
          type: 'pasteSelection',
          document: intent.plan.document,
          clipKind: intent.plan.clipKind,
          selectionBefore,
          selectionAfter,
          detachedTargetReferences: intent.plan.detachedTargetReferences
        }, intent);
        this.restoreSelection(selectionAfter);
        return true;
      }
      case 'applyCutPlan': {
        const selectionBefore = this.selection;
        const selectionAfter = cutLandingSelection(
          intent.plan.document,
          selectionBefore,
          this.activeProjection
        );
        this.history.apply({
          type: 'cutSelection',
          document: intent.plan.document,
          clipKind: intent.plan.clipKind,
          selectionBefore,
          selectionAfter,
          removedMembers: intent.plan.removedMembers,
          detachedTargetReferences: intent.plan.detachedTargetReferences
        }, intent);
        this.restoreSelection(selectionAfter);
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
          delta: Math.sign(intent.semitones),
          ...this.entryTarget
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
      case 'enterFret':
        return this.enterFret(intent.fret);
      case 'toggleNote': {
        // The notation projection's entry action: one (staff position ×
        // beat) cell, one note — remove what is there, else add the key-
        // signature default pitch. It writes into the voice the cursor is
        // READING, so a position that belongs only to other voices refuses:
        // the ink would appear somewhere the player was not looking.
        if (this.activeProjection !== 'notation') return false;
        const slot = slotAt(this.grid, this.cursorState, 'notation');
        if (slot) {
          this.apply({ type: 'deleteNote', noteId: slot.noteKey });
          return true;
        }
        const position = positionAt(this.grid, this.cursorState);
        if (!position || !position.voices.includes(this.cursorState.voiceIndex ?? 0)) return false;
        const clef = clefAt(
          this.doc,
          this.cursorState.measureIndex,
          this.cursorState.partIndex ?? 0,
          this.cursorState.staffIndex ?? 1
        );
        const fifths = keyFifthsAt(this.doc, this.cursorState.measureIndex);
        this.applyEntry({
          type: 'insertPitchNote',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          pitch: pitchAtStaffPosition(clef, this.cursorState.line, fifths),
          duration: { base: this.entryDuration, ...(this.entryDots ? { dots: this.entryDots } : {}) },
          ...this.entryTarget
        });
        return true;
      }
      case 'delete': {
        // Delete belongs to the selected RUNG, not whatever ink happens to be
        // under the cursor. Checking the slot first made Del at measure/score
        // silently remove one note while the enclosure claimed a container.
        //
        // TWO PRESSES, ONE RULE, all the way up the ladder: **press 1 clears
        // what the rung owns, press 2 removes the rung.** The `event` rung has
        // worked this way since the element-ops campaign; this is that rule
        // stated so it covers every rung above it, and the five guarded rungs
        // stop answering a keystroke with silence.
        //
        // THE PRESS COUNTER IS THE DOCUMENT. Press 1 visibly takes the ink
        // away, so press 2 is judged against a genuinely different document by
        // the SAME guards that always refused an inky removal. Nothing
        // remembers how many times you pressed, there is no mode to fall out
        // of, and an interleaved edit, undo or navigation cannot desynchronise
        // a count that was never kept. The guards in `ops.ts` therefore stay
        // exactly where they are — this fork decides which press it is, and
        // they still refuse underneath it.
        //
        // The invariant is restated, not abandoned: a wide command may never
        // destroy ink AND structure in one press. `Cut` remains the deliberate
        // one-press ink-destroyer, and it pays a clipboard for the privilege.
        // roadmap/complete/core-delete-clears-then-removes.md.
        const level = this.selectionState.level;

        // The bottom rung IS ink — there is no structure beneath a note for a
        // second press to remove.
        if (level === 'note') {
          const ops = [...this.selectedNoteKeys].reverse().map(noteKey =>
            /\.k\d+$/.test(noteKey)
              ? { type: 'removeKitNote' as const, noteKey }
              : { type: 'deleteNote' as const, noteId: noteKey }
          );
          const removed = ops.length;
          if (!this.applyDestructive(ops)) return this.refuseDelete(level);
          this.lastDeleteOutcome = { kind: 'cleared', level, notes: removed, thenRemoves: false };
          return true;
        }

        // PRESS 1 — wherever the rung still holds ink, clear it to rests.
        // Time survives, because `clearEvent` keeps the duration: no press
        // ever reshapes a bar or under-fills a voice. That is the courtesy
        // `addVoiceMeasure` already pays on the way in, owed back on the way
        // out — a verb must never manufacture the diagnostic that says you
        // made a mistake.
        const inky = eventAddressesUnderSelection(this.doc, this.resolvedSelection.members)
          .flatMap(address => {
            const event = eventAtAddress(this.doc, address);
            if (!event || !eventHoldsInk(event)) return [];
            return [{ address, notes: (event.notes?.length ?? 0) + EditorSession.kitCount(event) }];
          });
        if (inky.length > 0) {
          const notes = inky.reduce((sum, entry) => sum + entry.notes, 0);
          const ops = inky.map(entry => ({ type: 'clearEvent' as const, event: entry.address }));
          if (!this.applyDestructive(ops)) return this.refuseDelete(level);
          this.lastDeleteOutcome = { kind: 'cleared', level, notes, thenRemoves: true };
          return true;
        }

        // PRESS 2 — the rung holds no ink, so the structure itself goes. Each
        // removal is footprint-exact: it takes only what the selection covers.
        // `removeVoiceMeasure` splices one sequence out of one bar and never
        // touches that voice elsewhere; `removePartMeasure` empties one
        // staff's copy of one bar and never removes the part. That rule is
        // also what forbids removing a whole part from a single part-measure.
        if (level === 'event') {
          // Whole containers go AS containers (core-selection-range-grain.md,
          // the coincidence rule): removing a tuplet's children one by one
          // would leave an empty wrapper nothing on the ladder can address.
          // A range covering all of a container's children removes the
          // container; partial coverage removes the child events themselves.
          // Members arrive in document order, so the reverse walk keeps every
          // splice index valid across both op kinds.
          const coincidence = containerCoincidence(this.doc, this.resolvedSelection.members);
          const wholeByMember = new Map<string, (typeof coincidence.whole)[number]>();
          for (const whole of coincidence.whole) {
            for (const key of whole.memberKeys) wholeByMember.set(key, whole);
          }
          const emitted = new Set<(typeof coincidence.whole)[number]>();
          const ops: EditOp[] = [...this.resolvedSelection.members].reverse().flatMap((member): EditOp[] => {
            if (member.kind !== 'event') return [];
            const whole = wholeByMember.get(eventMemberKey(member));
            if (whole) {
              if (emitted.has(whole)) return [];
              emitted.add(whole);
              return [{
                type: 'removeContainer' as const,
                partIndex: whole.partIndex,
                measureIndex: whole.measureIndex,
                sequenceIndex: whole.sequenceIndex,
                eventIndex: whole.eventIndex
              }];
            }
            return [{ type: 'removeEvent' as const, event: eventAddressOf(member) }];
          });
          return this.finishDeleteRemoval(level, ops);
        }
        if (level === 'voiceMeasure') {
          const ops = [...this.resolvedSelection.members].reverse().flatMap(member =>
            member.kind === 'voiceMeasure'
              ? [{
                  type: 'removeVoiceMeasure' as const,
                  partIndex: member.partIndex,
                  measureIndex: member.measureIndex,
                  sequenceIndex: member.sequenceIndex
                }]
              : []
          );
          return this.finishDeleteRemoval(level, ops);
        }
        if (level === 'partMeasure') {
          // The member is the whole part's bar (core-selection-range-grain.md
          // decision 4), so the removal covers every staff's copy.
          const ops = [...this.resolvedSelection.members].reverse().flatMap(member => {
            if (member.kind !== 'partMeasure') return [];
            const staves = Math.max(1, this.doc.parts?.[member.partIndex]?.staves ?? 1);
            return Array.from({ length: staves }, (_, index) => ({
              type: 'removePartMeasure' as const,
              partIndex: member.partIndex,
              measureIndex: member.measureIndex,
              staffIndex: staves - index
            }));
          });
          return this.finishDeleteRemoval(level, ops);
        }
        // The measure rung's footprint is the whole bar COLUMN across every
        // part — the same one `Cut` uses — so a range removes every bar it
        // covers, highest index first because a splice moves the rest.
        if (level === 'measure') {
          const ops = this.resolvedSelection.members
            .flatMap(member => (member.kind === 'measure' ? [member.measureIndex] : []))
            .sort((a, b) => b - a)
            .map(measureIndex => ({ type: 'removeMeasure' as const, measureIndex }));
          return this.finishDeleteRemoval(level, ops);
        }
        if (level === 'document') {
          // The skeleton dissolves in reverse symmetry with skeleton-on-demand:
          // the empty part first, then the trailing bars it leaves behind.
          const partIndex = this.cursorState.partIndex ?? 0;
          const part = this.doc.parts?.[partIndex];
          if (part && !partHasInk(part)) {
            return this.finishDeleteRemoval(level, [{ type: 'removePart', partIndex }]);
          }
          const last = (this.doc.global?.measures?.length ?? 0) - 1;
          if (!part && last >= 0) {
            return this.finishDeleteRemoval(level, [{ type: 'removeMeasure', measureIndex: last }]);
          }
          return this.refuseDelete(level);
        }
        return this.refuseDelete(level);
      }
      case 'shorterDuration':
      case 'longerDuration': {
        const step = intent.type === 'shorterDuration' ? 1 : -1;
        const ranged = this.stepDurationOverRange(step);
        if (ranged !== null) return ranged;
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
          duration: { base: next, ...(event.duration.dots ? { dots: event.duration.dots } : {}) },
          ...this.entryTarget
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
          duration: { base: event.duration.base, ...(dots ? { dots } : {}) },
          ...this.entryTarget
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
        const partIndex = this.cursorState.partIndex ?? 0;
        const staffIndex = this.cursorState.staffIndex ?? 1;
        this.apply({
          type: 'setClef',
          measureIndex: this.cursorState.measureIndex,
          sign: intent.sign,
          ...(intent.staffPosition !== undefined ? { staffPosition: intent.staffPosition } : {}),
          ...(intent.octave ? { octave: intent.octave } : {}),
          // The staff you are reading gets the clef you typed — `removeClef`
          // below has resolved both of these since item 13b.
          ...(partIndex ? { partIndex } : {}),
          ...(staffIndex !== 1 ? { staffIndex } : {})
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
        // The selected-run form reads an EVENT range (the floor axis moved
        // ranges there). More than one resolved member, not more than one
        // note key: a chord event point has two keys but is one member, and
        // takes the point gesture rather than slurring itself.
        const selected =
          this.selectionState.level === 'event' &&
          this.resolvedSelection.members.length > 1
            ? this.selectedNoteKeys
            : [];
        if (selected.length > 1) {
          const [fromNoteKey, toNoteKey] = [selected[0], selected[selected.length - 1]];
          // Delete from any covered position (core-selection-range-grain.md
          // decision 5): a range WHOLLY covering existing slurs removes them,
          // wherever in the range each slur starts — the coincidence rule's
          // removal half. A slur merely starting at the range's first note
          // keeps the old toggle; otherwise the press creates.
          const covered = spannersUnderSelection(this.doc, this.resolvedSelection.members)
            .slurs.filter(hit => hit.coverage === 'whole' && hit.ownerNoteKey !== null);
          if (covered.length > 0) {
            return this.applyBulk(covered.map(hit => ({
              type: 'removeSlur' as const,
              noteKey: hit.ownerNoteKey!
            })));
          }
          return this.applyBulk([
            hasSlurStartingAt(this.doc, fromNoteKey)
              ? { type: 'removeSlur', noteKey: fromNoteKey }
              : { type: 'setSlur', fromNoteKey, toNoteKey }
          ]);
        }
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // The point gestures (core-selection-range-grain.md decision 5; the
        // two-press anchor retired by the user's call). Order matters: a
        // note can start one slur and end another, and the start's toggle is
        // the older, stronger meaning.
        // 1. A slur already starting here? Toggle it off.
        if (hasSlurStartingAt(this.doc, slot.noteKey)) {
          this.apply({ type: 'removeSlur', noteKey: slot.noteKey });
          return true;
        }
        // 2. A slur ENDING here? Extend it to the next note — press the same
        //    key at the end and the attachment grows (model 2).
        const endingSlur = slurEndingAt(this.doc, slot.noteKey);
        if (endingSlur) {
          const extendTo = this.nextNoteKeyInVoice();
          if (!extendTo) return false;
          const beforeDoc = JSON.stringify(this.doc);
          this.apply({ type: 'retargetSlur', noteKey: endingSlur.ownerNoteKey, toNoteKey: extendTo });
          return JSON.stringify(this.doc) !== beforeDoc;
        }
        // 3. Otherwise slur to the NEXT note (model 1): the end is implied,
        //    the result is visible immediately, and one more press at that
        //    end extends. Long slurs are the range form's job.
        const slurTo = this.nextNoteKeyInVoice();
        if (!slurTo) return false;
        this.apply({ type: 'setSlur', fromNoteKey: slot.noteKey, toNoteKey: slurTo });
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
      case 'setTechnique': {
        // The inspector's amend: set what was typed, whether or not one is
        // there. Refused only when the document does not move (a slide with
        // no note to travel to, a value already in place).
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // The typed word obeys the same physics as the `h` key: a hammer or
        // pull to the SAME fret is refused, not written.
        if (intent.technique.kind === 'hammerPull') {
          const pair = nextNotePitchPair(this.doc, slot.noteKey);
          if (!pair || pair.next === pair.current) return false;
        }
        const before = JSON.stringify(this.doc);
        this.apply({ type: 'setTechnique', noteKey: slot.noteKey, technique: intent.technique });
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
        return true;
      }
      case 'setEventDuration': {
        const event = this.eventUnderCursor();
        const duration = { base: intent.base, ...(intent.dots ? { dots: intent.dots } : {}) };
        if (!event || (event.notes?.length ?? 0) === 0) {
          if (this.entryDuration === intent.base) return false;
          this.entryDuration = intent.base;
          return true;
        }
        if (event.duration.base === intent.base && (event.duration.dots ?? 0) === (intent.dots ?? 0))
          return false;
        this.apply({
          type: 'setDuration',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          duration,
          ...this.entryTarget
        });
        return true;
      }
      case 'toggleTechnique': {
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // hammerPull is ONE adornment (extension v6, the Soundslice
        // convention): the direction is implicit in the two pitches, so
        // nothing is derived or stored — but a hammer or pull to the SAME
        // fret is not a thing fingers can do, so the equal-pitch pair still
        // refuses.
        const kind = intent.kind;
        if (kind === 'hammerPull') {
          const pair = nextNotePitchPair(this.doc, slot.noteKey);
          if (!pair || pair.next === pair.current) return false;
        }
        const existing = techniqueAt(this.doc, slot.noteKey, kind);
        // Shift+S vs S: same slide type toggles OFF; the other retypes in
        // place (an upsert — setTechnique replaces by kind).
        const wantedSlide = kind === 'slide' ? (intent.slideType ?? 'legato') : undefined;
        const existingSlide = kind === 'slide' && existing ? ((existing as { type?: string }).type ?? 'legato') : undefined;
        const retype = kind === 'slide' && existing !== undefined && existingSlide !== wantedSlide;
        const before = JSON.stringify(this.doc);
        this.apply(
          existing && !retype
            ? { type: 'removeTechnique', noteKey: slot.noteKey, kind }
            : {
                type: 'setTechnique',
                noteKey: slot.noteKey,
                // The toggle's bend is the plain 0>full; every other shape is
                // typed as stops through `setTechnique` (core-bend-stops.md).
                technique: (kind === 'bend'
                  ? { kind, alters: [0, 2] }
                  : kind === 'slide'
                    ? { kind, ...(wantedSlide === 'shift' ? { slideType: 'shift' } : {}) }
                    : { kind }) as never
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
      case 'setStringAnnotation': {
        // Only a string the part declares: the fingerboard is the cursor's
        // part's, and a string it does not have is not a place.
        const part = this.doc.parts?.[this.cursorState.partIndex ?? 0];
        if (!tuningOf(part).some(entry => entry.string === intent.string)) return false;
        return this.applyBulk(this.selectedNoteKeys.map(noteKey => ({
          type: 'setStringAnnotation',
          noteKey,
          string: intent.string
        })));
      }
      case 'removeFingering': {
        return this.applyBulk(this.selectedNoteKeys.map(noteKey => ({
          type: 'removeFingering',
          noteKey
        })));
      }
      case 'setPartDeclaration': {
        const partIndex = this.cursorState.partIndex ?? 0;
        if (!this.doc.parts?.[partIndex]) return false;
        this.apply({
          type: 'setPartDeclaration',
          declaration: intent.declaration,
          ...(partIndex ? { partIndex } : {})
        });
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
      // The construct halves (core-layout-authoring.md). Same shape as the
      // removals below: the document is the address, so nothing here consults
      // the cursor, and a no-op rolls its own history entry back.
      case 'setLayout':
      case 'setScore':
      case 'addMultimeasureRest':
      case 'removeLayout':
      case 'removeScore':
      case 'removeMultimeasureRest': {
        const before_ = JSON.stringify(this.doc);
        this.apply(
          intent.type === 'setLayout'
            ? { type: 'setLayout', index: intent.index, layout: intent.layout }
            : intent.type === 'setScore'
              ? { type: 'setScore', index: intent.index, score: intent.score }
              : intent.type === 'addMultimeasureRest'
                ? {
                    type: 'addMultimeasureRest',
                    scoreIndex: intent.scoreIndex,
                    start: intent.start,
                    duration: intent.duration
                  }
                : intent.type === 'removeMultimeasureRest'
                  ? {
                      type: 'removeMultimeasureRest',
                      scoreIndex: intent.scoreIndex,
                      index: intent.index
                    }
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
      case 'setFermata':
      case 'removeFermata': {
        const targets = this.selectedEventAddresses();
        if (targets.length === 0) return false;
        return this.applyBulk(targets.map(event =>
          intent.type === 'setFermata'
            ? { type: 'setFermata' as const, event, fermata: intent.fermata }
            : { type: 'removeFermata' as const, event }
        ));
      }
      case 'setPositioned': {
        const partIndex = this.cursorState.partIndex ?? 0;
        const staffIndex = this.cursorState.staffIndex ?? 1;
        this.apply({
          type: 'setPositioned',
          measureIndex: this.cursorState.measureIndex,
          onset: [this.cursorState.onset.num, this.cursorState.onset.den],
          attribute: intent.attribute,
          // The words go beside the staff you are reading. `between` is the
          // one that belongs to neither, and it says so with `orient` — so it
          // still records the staff it was typed from, which is the one the
          // renderer measures the gap DOWN from.
          ...(partIndex ? { partIndex } : {}),
          ...(staffIndex !== 1 ? { staffIndex } : {})
        });
        return true;
      }
      case 'removePositioned': {
        // Remove the entry at the cursor's own position — "the dynamic here",
        // which is how a player would name it.
        const partIndex_ = this.cursorState.partIndex ?? 0;
        const measure = this.doc.parts?.[partIndex_]?.measures?.[this.cursorState.measureIndex];
        const list = (measure?.[POSITIONED_FIELDS[intent.kind]] ?? []) as { position?: { fraction: [number, number] } }[];
        // The entry HERE: this onset, and this staff — a grand staff's two
        // dynamics at one beat are two entries (core-measure-attributes-gaps.md, bug 2).
        const staffHere = this.cursorState.staffIndex ?? 1;
        const index = list.findIndex(entry => {
          const [num, den] = entry.position?.fraction ?? [0, 1];
          return (
            num * this.cursorState.onset.den === this.cursorState.onset.num * den &&
            ((entry as { staff?: number }).staff ?? 1) === staffHere
          );
        });
        if (index < 0) return false;
        this.apply({
          type: 'removePositioned',
          measureIndex: this.cursorState.measureIndex,
          kind: intent.kind,
          index,
          ...(partIndex_ ? { partIndex: partIndex_ } : {})
        });
        return true;
      }
      case 'toggleBeam': {
        // The event-range run form, exactly as toggleSlur above.
        const selected =
          this.selectionState.level === 'event' &&
          this.resolvedSelection.members.length > 1
            ? this.selectedNoteKeys
            : [];
        if (selected.length > 1) {
          // The same removal half as toggleSlur above: a range wholly
          // covering existing beams un-beams them from any covered position.
          const covered = spannersUnderSelection(this.doc, this.resolvedSelection.members)
            .beams.filter(hit => hit.coverage === 'whole');
          if (covered.length > 0) {
            return this.applyBulk(covered.map(hit => ({
              type: 'removeBeam' as const,
              measureIndex: hit.measureIndex,
              path: hit.path,
              partIndex: hit.partIndex
            })));
          }
          const first = selected[0];
          const existing = beamStartingAt(this.doc, first);
          if (existing) {
            return this.applyBulk([{ type: 'removeBeam', ...existing }]);
          }
          const run = beamRunBetween(this.doc, first, selected[selected.length - 1]);
          if (run) {
            // `run` carries its own part, staff and voice — the beam goes
            // where the notes are, not where the cursor's default was.
            return this.applyBulk([{ type: 'setBeam', ...run }]);
          }
          // A beam cannot cross a voice or bar: fall through to the point
          // gesture at the active edge.
        }
        const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
        if (!slot) return false;
        // The point gestures, mirroring `toggleSlur` above.
        // 1. A beam already starting here? Toggle it off.
        const existing = beamStartingAt(this.doc, slot.noteKey);
        if (existing) {
          this.apply({ type: 'removeBeam', ...existing });
          return true;
        }
        // 2. A beam ENDING here? Extend it by the next note-bearing event
        //    (refused across the barline by the op — a beam lives in one bar).
        const endingBeam = beamEndingAt(this.doc, slot.noteKey);
        if (endingBeam) {
          const extendTo = this.nextNoteKeyInVoice();
          if (!extendTo) return false;
          const beforeDoc = JSON.stringify(this.doc);
          this.apply({ type: 'extendBeam', ...endingBeam, toNoteKey: extendTo });
          return JSON.stringify(this.doc) !== beforeDoc;
        }
        // 3. Otherwise beam to the NEXT note (model 1).
        const beamTo = this.nextNoteKeyInVoice();
        if (!beamTo) return false;
        const pair = beamRunBetween(this.doc, slot.noteKey, beamTo);
        if (!pair) return false;
        this.apply({ type: 'setBeam', ...pair });
        return true;
      }
      case 'setContainerProperties': {
        // The address is the coincidence's: the range that IS the container
        // (core-selection-range-grain.md decision 5, generalized).
        const coincidence = containerCoincidence(this.doc, this.resolvedSelection.members);
        if (!coincidence.exact || coincidence.whole.length !== 1) return false;
        const hit = coincidence.whole[0];
        const before = JSON.stringify(this.doc);
        this.apply({
          type: 'setContainerProperties',
          measureIndex: hit.measureIndex,
          sequenceIndex: hit.sequenceIndex,
          index: hit.eventIndex,
          ...(hit.partIndex ? { partIndex: hit.partIndex } : {}),
          ...(intent.properties ? { properties: intent.properties } : {}),
          ...(intent.clear ? { clear: intent.clear } : {})
        });
        if (JSON.stringify(this.doc) === before) {
          this.history.undo();
          this.reindex();
          return false;
        }
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
          duration: intent.duration,
          ...this.entryTarget
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
          attribute: intent.attribute,
          ...(intent.index !== undefined ? { index: intent.index } : {})
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
            kind: intent.kind,
            ...(intent.index !== undefined ? { index: intent.index } : {})
          } as const];
        });
        return this.applyBulk(ops);
      }
      case 'setTuning': {
        // The cursor's part, not parts[0] — the popover wrote the first part
        // regardless; the inspector's word acts where its pills read.
        const partIndex = this.cursorState.partIndex ?? 0;
        this.apply({ type: 'setTuning', tuning: intent.tuning, ...(partIndex ? { partIndex } : {}) });
        return true;
      }
      case 'appendMeasure': {
        // The bar is global; its beat rests are not. Give them to the part
        // being written to — see the op's declaration.
        const partIndex = this.cursorState.partIndex ?? 0;
        this.apply({ type: 'appendMeasure', ...(partIndex ? { partIndex } : {}) });
        return true;
      }
      case 'insertAtRung':
        return this.insertAtRung(intent.side);
      case 'addVoiceMeasure':
        return this.addVoiceHere();
      case 'addPart': {
        const op: Extract<EditOp, { type: 'addPart' }> = { type: 'addPart' };
        if (intent.partId !== undefined) op.partId = intent.partId;
        if (intent.name !== undefined) op.name = intent.name;
        this.apply(op);
        return true;
      }
      case 'setStaffKind': {
        const partIndex = this.cursorState.partIndex ?? 0;
        this.apply({ type: 'setStaffKind', kind: intent.kind, ...(partIndex ? { partIndex } : {}) });
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

  /** A complete, timer-free fret resolved by the workbench's stage-1 input. */
  private enterFret(fret: number): boolean {
    if (!Number.isInteger(fret) || fret < 0 || fret > MAX_ENTRY_FRET) return false;
    const slot = slotAt(this.grid, this.cursorState, this.activeProjection);
    const note = this.selectedNote();
    // The fingerboard is the CURSOR'S part's — its strings and its capo.
    const part = this.doc.parts?.[this.cursorState.partIndex ?? 0];
    const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
    if (slot && note) {
      // The cursor's line is a string only in the TAB projection: in
      // notation it is a staff position, and reading it as a string wrote
      // `string: 0` when a fret was typed from the inspector there.
      const string = tab
        ? this.cursorState.line
        : note._x?.mnxLab?.string ?? defaultStringFor(note.pitch, tuningOf(part), capoOf(part));
      this.apply({ type: 'setFret', noteId: slot.noteKey, string, fret });
    } else {
      // Nothing on this string at this position: insert. Only meaningful on
      // the fingerboard — in ordinal mode (no tab part) digits need a note.
      if (!tab) return false;
      this.applyEntry({
        type: 'insertNote',
        measureIndex: this.cursorState.measureIndex,
        onset: [this.cursorState.onset.num, this.cursorState.onset.den],
        string: this.cursorState.line,
        fret,
        duration: { base: this.entryDuration, ...(this.entryDots ? { dots: this.entryDots } : {}) },
        ...this.entryTarget
      });
    }
    return true;
  }

  /** How many notes share the cursor's moment and line — more than one means
   *  the address is ambiguous and `cycleSlot` has somewhere to go. */
  get coincidentCount(): number {
    return coincidentSlots(this.grid, this.cursorState, this.activeProjection).length;
  }

  private navigate(intent: EditorIntent): boolean {
    const before = this.cursorState;
    switch (intent.type) {
      // The ladder walk. Presence is computed fresh at the cursor, so absent
      // rungs (no note under a rest, no sections declared) are skipped.
      case 'extendSelection':
        return this.extendSelection(intent.direction);
      case 'closeSelection': {
        // The document rung already denotes the whole document; closing it again is
        // semantically and structurally idempotent.
        if (this.selectionState.level === 'document') return false;
        // The floor axis (core-selection-floor-axis.md): a closure asks for
        // every member of a timeline — a temporal extent — and below the
        // event rung there is none, so Ctrl+A on a notehead closes at the
        // event rung. Without this the multi-notehead selection the floor
        // axis retires would survive behind one key.
        if (this.selectionState.level === 'note') this.setSelectionLevel('event');
        const scope = closureScopeForLevel(this.selectionState.level);
        if (
          this.selectionState.extent.kind === 'closure' &&
          this.selectionState.extent.scope === scope
        ) {
          return false;
        }
        this.selectionState = {
          level: this.selectionState.level,
          // The cursor, not `before`: the note→event re-level above pins the
          // event slot onto the cursor, and the closure's anchor must carry
          // the same address a relax-then-close would have produced.
          anchor: copyCursorAddress(this.cursorState),
          extent: { kind: 'closure', scope }
        };
        return true;
      }
      // The ladder's absolute address. The presence rule lives HERE and only
      // here: a rung this document does not present is a refusal, so callers
      // never have to walk toward one and park at whatever they could reach.
      case 'goToLevel': {
        const present = presentLevels(this.doc, this.grid, before, this.activeProjection);
        if (!present.has(intent.level)) return false;
        if (this.selectionState.level === intent.level) return false;
        this.setSelectionLevel(intent.level);
        return true;
      }
      case 'relaxSelection': {
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
        if (this.selectionState.level === 'note') return false; // the bottom of the ladder
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
      // the fine rungs, bars at the bar rungs, nothing at document.
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
      // The measure and document rungs are resolved by the MOUNT — "the
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
          // The floor axis (core-selection-floor-axis.md): the vertical axis
          // at the floor is note-natured, so ↑/↓ at the event rung descends
          // into the event's noteheads; subsequent presses walk lines at the
          // note rung. The displaced voice jump stays reachable — descend,
          // then Ctrl+↑/↓ (the climb's voice jump at note), or Alt+V.
          case 'event': {
            const position = positionAt(this.grid, before);
            const voice = before.voiceIndex ?? 0;
            const pool = position?.slots.filter(slot => slot.voiceIndex === voice) ?? [];
            if (pool.length === 0) return false; // a rest has no noteheads
            const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
            const lineOf = (slot: (typeof pool)[number]) =>
              tab ? slot.line : slot.staffPosition;
            // Nearest to the carried line; ties break in the pressed
            // direction (down = a larger string number, a smaller staff
            // position) — the descent itself is the semantic step.
            let best = pool[0];
            for (const slot of pool) {
              const dist = Math.abs(lineOf(slot) - before.line);
              const bestDist = Math.abs(lineOf(best) - before.line);
              const towards = (tab === (delta > 0))
                ? lineOf(slot) > lineOf(best)
                : lineOf(slot) < lineOf(best);
              if (dist < bestDist || (dist === bestDist && towards)) best = slot;
            }
            this.cursorState = { ...before, line: lineOf(best) };
            this.reanchorSelection('note');
            return true;
          }
          case 'voiceMeasure':
            if (!this.stepVoice(before, delta)) return false;
            this.reanchorSelection();
            return true;
          case 'partMeasure':
            // ↑↓ walks PARTS: the member is the whole part's bar, and the
            // staff stays a cursor attribute for the finer rungs
            // (core-selection-range-grain.md decision 4).
            if (!this.stepPart(before, delta)) return false;
            this.reanchorSelection();
            return true;
          default:
            return false; // measure/document: the mount's
        }
        break;
      }
      case 'goToMeasure':
        this.cursorState = moveToMeasure(this.grid, before, intent.measureIndex);
        break;
      case 'goToEdge': {
        // The keymap cannot name the last bar, so the EDGE is the intent and
        // the count is read here. `moveToMeasure` clamps and resolves the
        // anchor voice, so both ends land the same way every other jump does.
        const last = (this.doc.global?.measures?.length ?? 0) - 1;
        if (last < 0) return false;
        this.cursorState = moveToMeasure(
          this.grid,
          before,
          intent.edge === 'first' ? 0 : last
        );
        break;
      }
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
            this.cursorState = moveMeasure(this.grid, before, delta);
            break;
          case 'voiceMeasure':
          case 'partMeasure':
          case 'measure':
            this.cursorState = this.sectionStep(before, delta);
            break;
          default:
            return false; // document: no wider horizontal unit to climb to
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
      level === 'event'
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

  private extendSelection(
    direction: 'previous' | 'next' | 'end' | 'sectionStart' | 'sectionEnd'
  ): boolean {
    if (direction === 'sectionStart' || direction === 'sectionEnd') {
      return this.extendToSectionBoundary(direction === 'sectionEnd' ? 1 : -1);
    }
    // The floor axis (core-selection-floor-axis.md): horizontal extent is
    // event-natured, so the note rung has no ranges. The first press
    // performs the re-leveling — one notehead becomes its own ONE event,
    // never two, so the highlight visibly grows from notehead to chord at
    // the moment the semantics change. Only subsequent presses extend.
    // Shift+End re-levels AND extends in the same press: its extent request
    // is already explicit.
    if (this.selectionState.level === 'note') {
      this.setSelectionLevel('event');
      if (direction !== 'end') return true;
    }
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

  /** Ctrl+Shift+←/→ (core-selection-range-grain.md): extend the active edge
   * to the current section's boundary bar — the text editor's select-to-word-
   * edge, with sections as the words. Pressed at the boundary it crosses into
   * the neighbouring section. Bars before the first label form an anonymous
   * span, and with no sections at all the boundary is the piece's ends, so
   * the gesture degrades to Shift+Home/End rather than dying. Bar rungs only:
   * an arrow that does nothing beats one that does something arbitrary. */
  private extendToSectionBoundary(delta: 1 | -1): boolean {
    const level = this.selectionState.level;
    if (level !== 'voiceMeasure' && level !== 'partMeasure' && level !== 'measure') return false;
    const last = (this.doc.global?.measures?.length ?? 0) - 1;
    if (last < 0) return false;
    const at = Math.min(this.cursorState.measureIndex, last);
    // Segment bounds: section starts plus the piece's own ends. A segment is
    // [bound, nextBound), so the boundary bar rightward is nextBound - 1.
    const bounds = [...new Set([0, ...sectionStarts(this.doc), last + 1])]
      .filter(bound => bound >= 0 && bound <= last + 1)
      .sort((a, b) => a - b);
    let target: number;
    if (delta === 1) {
      const hi = bounds.find(bound => bound > at) ?? last + 1;
      target = Math.min(hi - 1, last);
      if (target === at) {
        const next = bounds.find(bound => bound > at + 1) ?? last + 1;
        target = Math.min(next - 1, last);
      }
    } else {
      const lo = [...bounds].reverse().find(bound => bound <= at) ?? 0;
      target = lo;
      if (target === at) target = [...bounds].reverse().find(bound => bound < at) ?? 0;
    }
    if (target === at) return false;
    const anchor = copyCursorAddress(
      this.selectionState.extent.kind === 'closure'
        ? this.cursorState
        : this.selectionState.anchor
    );
    const next = withoutEventPin(moveToMeasure(this.grid, this.cursorState, target));
    if (cursorAddressesEqual(next, this.cursorState)) return false;
    this.cursorState = next;
    this.selectionState = {
      level,
      anchor,
      extent: { kind: 'cursor', cursor: copyCursorAddress(next) }
    };
    return true;
  }

  /** The horizontal RANGE unit. Note and event extension deliberately skip
   * entry ghosts; they select existing notes/events only. Wider rungs follow
   * the same bar units as their bare horizontal navigation. */
  private moveSelectionHorizontal(before: EditorCursor, delta: 1 | -1): EditorCursor {
    const level = this.selectionState.level;
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
        // A RANGE selects things that exist, so the bar past the end is not a
        // member — navigation may stand on the ghost, Shift may not reach it.
        return moveMeasure(this.grid, before, delta, { ghost: false });
      case 'document':
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
      case 'voiceMeasure':
      case 'partMeasure':
      case 'measure':
        return moveMeasure(this.grid, before, delta);
      case 'document':
        return before; // the whole document is selected — nowhere to go
    }
  }

  /** Prev/next section START; prev from mid-section goes to this section's own
   *  start first (the audio-player convention). The bar rungs' Ctrl climb —
   *  sections are a jump/extend unit, not a rung
   *  (core-selection-range-grain.md). */
  private sectionStep(before: EditorCursor, delta: 1 | -1): EditorCursor {
    const starts = sectionStarts(this.doc);
    const target =
      delta === 1
        ? starts.find(s => s > before.measureIndex)
        : [...starts].reverse().find(s => s < before.measureIndex);
    return target === undefined ? before : moveToMeasure(this.grid, before, target);
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
  /** The next note-bearing event in the cursor's voice — the implied end of
   *  the point spanner gestures (models 1 and 2). Rests are stepped over (a
   *  slur or beam needs a note to land on); null when the voice runs out. */
  private nextNoteKeyInVoice(): string | null {
    let cursor = this.cursorState;
    for (let guard = 0; guard < this.grid.positions.length + 1; guard++) {
      const stepped = movePositionInk(this.grid, cursor, 1, 'keep');
      if (cursorAddressesEqual(stepped, cursor)) return null;
      cursor = stepped;
      const slot = positionAt(this.grid, cursor)?.slots.find(
        candidate => candidate.voiceIndex === (cursor.voiceIndex ?? 0)
      );
      if (slot) return slot.noteKey;
    }
    return null;
  }

  /** The part-measure rung's vertical: the next part, first staff — the
   *  member covers all of the part's staves, so walking its staves would
   *  step inside one selection. */
  private stepPart(before: EditorCursor, delta: 1 | -1): boolean {
    const parts = this.doc.parts ?? [];
    const target = (before.partIndex ?? 0) + delta;
    if (target < 0 || target >= parts.length) return false;
    this.grid = buildGrid(this.doc, target, 1);
    if (this.grid.positions.length === 0) return false;
    if (this.activeProjection === 'tab' && this.grid.mode !== 'string') {
      this.activeProjection = 'notation';
    }
    const landed = clampCursor(this.grid, {
      measureIndex: before.measureIndex,
      onset: before.onset,
      line: before.line,
      ...(target ? { partIndex: target } : {})
    });
    // Same landing rule as stepStaff below: the line means a different space
    // per grid, so land on this staff's ink for an honest line and voice.
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

  /**
   * INSERT AT THE RUNG (roadmap/proposed/core-rung-insert.md). One key, its
   * meaning read off the rung the cursor is addressing.
   *
   * The refusals are the interesting half, and they fail for three different
   * reasons — which is why this is a switch and not a lookup:
   *
   *  - `note` already HAS an insert, addressed spatially (a pitch, a string);
   *    a chord is a set, so there is no "before" in it.
   *  - `event` waits on §8.11: inserting into a full bar has to either take
   *    time from the rests or push a beat out, and this codebase decides that
   *    kind of question once, in the open, before it builds the verb.
   *  - `partMeasure`'s staff is a part-level declaration rather than a
   *    member of this bar, so it has no position for a new sibling to take.
   *
   * A refusing rung returns false rather than climbing to a wider one: a key
   * that quietly acts on something bigger than you were addressing is exactly
   * what the ladder exists to prevent.
   */
  private insertAtRung(side: 'before' | 'after'): boolean {
    // GENESIS, at every rung whose insert needs a bar to exist first. An event
    // needs a bar to sit in and a voice needs a bar to fill, so in a score with
    // NO bars those rungs' inserts have nothing to address — and the honest
    // reading of "insert at this rung" becomes the bar itself.
    //
    // This narrows core-rung-insert.md rather than overturning it. That item
    // took the append key away on a good argument — an append is just a
    // position the cursor can travel to — and left `appendMeasure` its tile
    // for the genesis case it knowingly could not express. What it did not
    // foresee is that genesis is now REACHABLE BY DELETING
    // (core-delete-clears-then-removes.md), and there it is a dead end: with
    // zero bars `goToEdge` refuses, the ghost bar past the end does not exist
    // (`buildGrid` withholds it), and the only route left is a popover tile
    // with no keyboard route at all.
    //
    // The SCORE rung keeps its own meaning: its insert is parts, which is
    // coherent with no bars in the document, so `I` there still adds a part.
    if (
      this.selectionState.level !== 'document' &&
      (this.doc.global?.measures?.length ?? 0) === 0
    ) {
      const partIndex = this.cursorState.partIndex ?? 0;
      this.apply({ type: 'appendMeasure', ...(partIndex ? { partIndex } : {}) }, true);
      if ((this.doc.global?.measures?.length ?? 0) === 0) return false;
      this.cursorState = moveToMeasure(this.grid, this.cursorState, 0);
      this.reanchorSelection();
      return true;
    }
    switch (this.selectionState.level) {
      case 'note':
      case 'event':
        // The rung names the SIZE of what you insert, and a note-sized thing
        // in a voice is an event. "Before/after" is time here because time is
        // what ←→ already walks at the note rung.
        return this.insertEventHere(side);
      case 'voiceMeasure':
        // Voices stack by stem direction, not by index, and note keys embed
        // the ordinal — so there is no order for `before` to address.
        return side === 'after' && this.addVoiceHere();
      case 'partMeasure':
        // The rung's own unit is staff-bars, and inserting one of THOSE is
        // still refused — a staff exists for the whole part or not at all
        // (core-rung-insert.md). What `I` means here is the rung BELOW's
        // construct verb, reachable from above because `voiceMeasure`
        // disappears with the last voice and takes its own `I` with it.
        return side === 'after' && this.addVoiceHere();
      case 'measure':
        return this.insertMeasureHere(side);
      case 'document':
        return this.insertPartHere(side);
      default:
        return false;
    }
  }

  /**
   * Re-value EVERY event in a multi-member selection, each stepping from its
   * own value — so a quarter and an eighth become an eighth and a 16th, which
   * is what a ladder means. Returns null when the selection is a point, and
   * the single-event path below takes over unchanged.
   *
   * The half that is not obvious: **the ops go in reverse document order.**
   * `setDuration` addresses an event by its ONSET, and re-valuing one moves
   * every later event's onset — so front-to-back, the second op would address
   * a moment that no longer holds what it was aimed at. Back-to-front nothing
   * moves under the ops still to come. (The delete path learned this first;
   * this is the same rule for the same reason.)
   *
   * Resolving an overfull bar is what this is FOR — insert leaves five beats
   * in a 4/4 bar, you select two of them and shorten, and the bar comes right.
   */
  private stepDurationOverRange(step: 1 | -1): boolean | null {
    const level = this.selectionState.level;
    if (level !== 'note' && level !== 'event') return null;
    const members = this.resolvedSelection.members;
    if (members.length < 2) return null;
    const seen = new Set<string>();
    const ops: EditOp[] = [];
    for (const member of [...members].reverse()) {
      if (member.kind !== 'note' && member.kind !== 'event') continue;
      // Two chord members share one event; re-value it once.
      const key = `${member.partIndex}/${member.staffIndex}/${member.measureIndex}/${member.voiceIndex}/${member.eventIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const event = eventAtAddress(this.doc, eventAddressOf(member));
      if (!event || (event.notes?.length ?? 0) === 0) continue; // a rest is absence
      const next = stepLadder(event.duration.base, step);
      if (next === event.duration.base) continue; // already at the ladder's end
      ops.push({
        type: 'setDuration',
        measureIndex: member.measureIndex,
        onset: [member.onset.num, member.onset.den],
        duration: { base: next, ...(event.duration.dots ? { dots: event.duration.dots } : {}) },
        ...(member.partIndex ? { partIndex: member.partIndex } : {}),
        ...(member.staffIndex !== 1 ? { staffIndex: member.staffIndex } : {}),
        ...(member.voiceIndex ? { voiceIndex: member.voiceIndex } : {})
      });
    }
    return ops.length > 0 ? this.applyBulk(ops) : false;
  }

  /**
   * A note beside this one, in time — and the bar is allowed to overfill,
   * with the duration-mismatch badge as the report (see `insertEvent` in
   * ops.ts for why that is the policy rather than a lapse).
   *
   * The new note takes the cursor's own line, so it arrives where you were
   * looking: a staff position in the notation projection, the string you are
   * standing on in tab. The pending entry duration governs, as it does for
   * every other entry gesture.
   */
  private insertEventHere(side: 'before' | 'after'): boolean {
    const cursor = this.cursorState;
    // No bar, no event. Without this the op applied to nothing and still
    // reported success, pushing a history entry that changed no bytes — an
    // undo that does nothing is worse than a refusal that says so.
    if (!this.doc.global?.measures?.[cursor.measureIndex]) return false;
    const duration = {
      base: this.entryDuration,
      ...(this.entryDots ? { dots: this.entryDots } : {})
    };
    const tab = this.activeProjection === 'tab' && this.grid.mode === 'string';
    let pitch: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; alter?: number };
    let fingerboard: { string?: number; fret?: number } = {};
    if (tab) {
      // On the fingerboard the line is a STRING, not a pitch — so the open
      // string is the honest default, and a digit re-frets it as usual.
      const part = this.doc.parts?.[cursor.partIndex ?? 0];
      const open = tuningOf(part).find(entry => entry.string === cursor.line);
      if (!open) return false;
      // Fret 0 is capo-relative, so the OPEN string sounds the capo's pitch.
      pitch = spellPitch(
        midiOfPitch(open.pitch) + capoOf(part),
        keyFifthsAt(this.doc, cursor.measureIndex)
      );
      fingerboard = { string: cursor.line, fret: 0 };
    } else {
      pitch = pitchAtStaffPosition(
        clefAt(this.doc, cursor.measureIndex, cursor.partIndex ?? 0, cursor.staffIndex ?? 1),
        cursor.line,
        keyFifthsAt(this.doc, cursor.measureIndex)
      );
    }
    this.apply({
      type: 'insertEvent',
      measureIndex: cursor.measureIndex,
      onset: [cursor.onset.num, cursor.onset.den],
      side,
      duration,
      pitch,
      ...fingerboard,
      ...this.entryTarget
    });
    // AND THE CURSOR GOES TO IT. Inserting `before` puts the new note at the
    // onset the cursor already holds, so it is standing on it already;
    // inserting `after` needs one step along this voice's own events, which is
    // exactly where the new one was spliced.
    if (side === 'after') {
      this.cursorState = movePositionInk(this.grid, this.cursorState, 1, 'keep');
      this.reanchorSelection('note');
    }
    return true;
  }

  /** A bar beside this one, and the cursor moves into it — you asked for it
   *  to work in, and it arrives padded, so there is somewhere to type. */
  private insertMeasureHere(side: 'before' | 'after'): boolean {
    const measureIndex = this.cursorState.measureIndex;
    const partIndex = this.cursorState.partIndex ?? 0;
    if (this.pastEnd) {
      // Standing on the ghost bar, `I` is what makes it real — and the SIDE
      // has nothing to name, because before and after a bar that does not
      // exist are the same bar. The rung survives, as it does for every other
      // structural insert.
      this.apply({ type: 'appendMeasure', ...(partIndex ? { partIndex } : {}) }, true);
      this.cursorState = moveToMeasure(this.grid, this.cursorState, measureIndex);
      this.reanchorSelection();
      return true;
    }
    if (!this.doc.global?.measures?.[measureIndex]) return false;
    // THE RUNG SURVIVES. `apply` re-anchors at note by default, which is right
    // for entry — you typed a note, you are addressing a note — and wrong for
    // a structural verb addressed AT a rung: dropping to note would make the
    // second `I` refuse, so inserting two bars would need the ladder walked
    // again between them.
    this.apply({
      type: 'insertMeasure',
      measureIndex,
      side,
      ...(partIndex ? { partIndex } : {})
    }, true);
    const at = side === 'before' ? measureIndex : measureIndex + 1;
    this.cursorState = moveToMeasure(this.grid, this.cursorState, at);
    this.reanchorSelection();
    return true;
  }

  /**
   * A part beside this one, in score order, with the cursor following it into
   * the new one.
   *
   * The landing is done here rather than by delegating to `setPart`, which
   * refuses a move to the index it is already on — and inserting BEFORE gives
   * the new part exactly the index the cursor already holds, so delegating
   * reported the whole insert as failed while the part sat in the document.
   */
  private insertPartHere(side: 'before' | 'after'): boolean {
    if ((this.doc.parts?.length ?? 0) === 0) return false;
    const partIndex = (this.cursorState.partIndex ?? 0) + (side === 'after' ? 1 : 0);
    this.apply({ type: 'addPart', partIndex }, true); // the rung survives, as above
    // A different part is a different grid — the same rebuild `setPart` does.
    this.grid = buildGrid(this.doc, partIndex, 1);
    this.cursorState = {
      ...initialCursor(this.grid),
      ...(partIndex ? { partIndex } : {})
    };
    this.activeProjection = this.grid.mode === 'string' ? 'tab' : 'notation';
    this.reanchorSelection();
    return true;
  }

  /** The voice rung's construct verb, shared by `I` and the tray tile. */
  private addVoiceHere(): boolean {
    const partIndex = this.cursorState.partIndex ?? 0;
    const staffIndex = this.cursorState.staffIndex ?? 1;
    const measureIndex = this.cursorState.measureIndex;
    const measure = this.doc.parts?.[partIndex]?.measures?.[measureIndex];
    if (!measure) return false;
    // The new voice's ordinal ON THIS STAFF — read before the op, because
    // afterwards it is simply the last one.
    const voiceIndex = (measure.sequences ?? []).filter(
      sequence => (sequence.staff ?? 1) === staffIndex
    ).length;
    this.apply({
      type: 'addVoiceMeasure',
      measureIndex,
      ...(partIndex ? { partIndex } : {}),
      ...(staffIndex !== 1 ? { staffIndex } : {})
    });
    // Step into it, at the NOTE rung — unlike the bar and part inserts above,
    // which keep the rung they were fired from. The voice arrived padded so
    // its first position is a real rest, and the point of making a voice is to
    // type into it; a second voice is a rarer want than a second bar.
    const landing = this.grid.positions.find(
      position => position.measureIndex === measureIndex && position.voices.includes(voiceIndex)
    );
    if (landing)
      this.cursorState = clampCursor(this.grid, {
        measureIndex,
        onset: landing.onset,
        line: this.cursorState.line,
        ...(partIndex ? { partIndex } : {}),
        ...(staffIndex !== 1 ? { staffIndex } : {}),
        ...(voiceIndex ? { voiceIndex } : {})
      });
    this.reanchorSelection();
    return true;
  }

  /** Percussion ink is ink too: a kit event holds no `notes`, so the emptiness
   *  test has to ask about both or Delete would remove a drum hit outright. */
  private static kitCount(event: MnxEvent): number {
    return ((event as { kitNotes?: unknown[] }).kitNotes ?? []).length;
  }

  /** Point selections follow ordinary navigation. Range gestures will move
   * only the active extent; until those intents exist, every cursor move is a
   * conventional collapse/re-anchor at the current rung. */
  private reanchorSelection(level: SelectionLevel = this.selectionState.level): void {
    if (level === 'event') {
      this.cursorState = pinEventSlot(this.grid, this.cursorState, this.activeProjection);
    } else {
      this.cursorState = withoutEventPin(this.cursorState);
    }
    this.selectionState = pointSelection(level, this.cursorState);
  }

  /** One command over zero or more resolved members. A multi-member command
   * is one history/log entry, and unlike entry gestures it keeps the range so
   * the tray can immediately report its new active/mixed state. */
  /**
   * WHERE A WRITE LANDS: the cursor's part, staff and voice, as the ops layer
   * wants them (roadmap/complete/core-entry-surface.md).
   *
   * Defaults are OMITTED, not spelled — an `insertNote` in voice 0 of part 0
   * carries no address at all, exactly as it did before entry could go
   * anywhere else. That is what keeps every committed trace fixture and every
   * op-log row byte-identical while the surface underneath them moved.
   */
  private get entryTarget(): EntryTarget {
    const cursor = this.cursorState;
    return {
      ...(cursor.partIndex ? { partIndex: cursor.partIndex } : {}),
      ...(cursor.staffIndex && cursor.staffIndex !== 1 ? { staffIndex: cursor.staffIndex } : {}),
      ...(cursor.voiceIndex ? { voiceIndex: cursor.voiceIndex } : {})
    };
  }

  private applyBulk(ops: EditOp[]): boolean {
    if (ops.length === 0) return false;
    const before = JSON.stringify(this.doc);
    this.apply(ops.length === 1 ? ops[0] : { type: 'batch', ops }, true);
    if (JSON.stringify(this.doc) !== before) return true;
    this.history.undo();
    this.reindex(true);
    return false;
  }

  /** Record a delete that did nothing, so the workbench can SAY so. A
   *  keystroke that produces neither a change nor a sentence is the bug this
   *  whole item started from. */
  private refuseDelete(level: SelectionLevel): false {
    this.lastDeleteOutcome = { kind: 'refused', level };
    return false;
  }

  /** Press 2's shared tail: apply the rung's removal and record what went. */
  private finishDeleteRemoval(level: SelectionLevel, ops: EditOp[]): boolean {
    const members = ops.length;
    if (!this.applyDestructive(ops)) return this.refuseDelete(level);
    this.lastDeleteOutcome = { kind: 'removed', level, members };
    return true;
  }

  private applyDestructive(ops: EditOp[]): boolean {
    const level = this.selectionState.level;
    if (!this.applyBulk(ops)) return false;
    // A REMOVAL MUST NOT PARK YOU PAST THE END OF THE SCORE.
    //
    // The ghost bar is a legal place to stand — that is core-rung-insert.md's
    // whole point, and `clampCursor` honours it — but only when you WALKED
    // there. Deleting the last bar slides it under a cursor that never moved,
    // and out there no rung has a member: the point selection resolves empty,
    // so the repair below relaxed all the way to `document`, where the next
    // ↑/↓ escalates to a different SCORE. Delete the last bar and the ladder
    // fell out from under you.
    //
    // Aim at the last surviving bar instead. A removal in the MIDDLE needs
    // nothing: the bars shift down, so the cursor's index still resolves and
    // it lands on whatever moved into the deleted one's place, which is what
    // it should do.
    if (this.pastEnd) {
      const last = (this.doc.global?.measures?.length ?? 0) - 1;
      if (last >= 0) {
        this.cursorState = moveToMeasure(this.grid, this.cursorState, last);
        // A range whose tail was just consumed has no honest extent left, so
        // this collapses to a point — the same repair a point gets.
        this.reanchorSelection(level);
      }
    }
    const present = presentLevels(
      this.doc,
      this.grid,
      this.cursorState,
      this.activeProjection
    );
    if (present.has(level) && this.resolvedSelection.members.length > 0) return true;
    // A SCORE WITH NO BARS STOPS AT THE BAR RUNG. `measure` holds no member
    // there, so the rule above would climb to `document` — honest by the
    // letter of "relax until something resolves", and wrong here: `document`
    // is where ↑/↓ leaves for another SCORE, and the reader who just deleted
    // their last bar wants to make another one, which is what `I` means at
    // exactly this rung (core-delete-clears-then-removes.md's genesis case).
    //
    // The three structural rungs are ALWAYS present (`presentLevels` hardcodes
    // them) precisely because they are the skeleton rather than content — so
    // an empty one is not an absent one, and stopping on it is the ladder
    // behaving as designed rather than a special case.
    if ((this.doc.global?.measures?.length ?? 0) === 0 && level !== 'document') {
      this.reanchorSelection('measure');
      return true;
    }
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
      return [];
    });
    return [...new Set(indices.length > 0 ? indices : [this.cursorState.measureIndex])];
  }

  /**
   * An entry op, materialising the ghost bar under it when the cursor is
   * standing past the end of the score (core-rung-insert.md).
   *
   * The bar and what lands in it go as ONE `batch`, so undo returns the
   * document byte-identically rather than leaving an orphaned empty bar
   * behind the note it removed. Materialisation is on the KEYSTROKE, never on
   * arrival — the same rule `addVoiceMeasure` follows — which is what lets
   * `→` past the end be pure navigation.
   */
  private applyEntry(op: EditOp): void {
    if (!this.pastEnd) {
      this.apply(op);
      return;
    }
    const partIndex = this.cursorState.partIndex ?? 0;
    this.apply({
      type: 'batch',
      ops: [{ type: 'appendMeasure', ...(partIndex ? { partIndex } : {}) }, op]
    });
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

  /** Restore a history-owned selection snapshot against the history's new
   *  document. Paste is the only operation with this stronger contract;
   *  ordinary edits continue through reindex's cursor-following behavior. */
  private restoreSelection(selection: SelectionState): void {
    const active = selection.extent.kind === 'cursor'
      ? selection.extent.cursor
      : selection.anchor;
    this.grid = buildGrid(
      this.doc,
      active.partIndex ?? 0,
      active.staffIndex ?? 1
    );
    this.cursorState = clampCursor(this.grid, copyCursorAddress(active));
    this.selectionState = cloneSelection(selection);
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
  private eventUnderCursor(): MnxEvent | undefined {
    return eventAtCursor(this.doc, this.grid, this.cursorState, this.activeProjection);
  }
}

/** Resolve a planner's compact structural landing into the durable cursor
 * range history needs. This reads only the materialized result, never the
 * clipboard or the source document. */
function pasteLandingSelection(
  doc: MnxStructure,
  landing: PasteLanding,
  projection: Projection
): SelectionState {
  const anchor = pasteLandingCursor(doc, landing, projection, 'first');
  if (landing.closure) {
    return { level: landing.level, anchor, extent: { kind: 'closure', scope: landing.closure } };
  }
  // The floor axis: a note selection is always exactly one notehead, so a
  // multi-position note landing (a legacy multi-note clip) selects the
  // covering EVENT range rather than resurrecting the retired note range.
  const spansTime =
    landing.measureStart !== landing.measureEnd ||
    landing.onsetStart[0] * landing.onsetEnd[1] !== landing.onsetEnd[0] * landing.onsetStart[1];
  return {
    level: landing.level === 'note' && spansTime ? 'event' : landing.level,
    anchor,
    extent: {
      kind: 'cursor',
      cursor: pasteLandingCursor(doc, landing, projection, 'last')
    }
  };
}

/** Re-resolve Cut's former selection against the removed document, matching
 * applyDestructive's presence rule: retain a surviving rung, otherwise relax
 * to the nearest present ancestor at the clamped active edge. */
function cutLandingSelection(
  doc: MnxStructure,
  before: SelectionState,
  projection: Projection
): SelectionState {
  const active = before.extent.kind === 'cursor' ? before.extent.cursor : before.anchor;
  const partIndex = Math.min(
    active.partIndex ?? 0,
    Math.max(0, doc.parts.length - 1)
  );
  const staffIndex = Math.min(
    active.staffIndex ?? 1,
    Math.max(1, doc.parts[partIndex]?.staves ?? 1)
  );
  const grid = buildGrid(doc, partIndex, staffIndex);
  const { partIndex: _part, staffIndex: _staff, ...activePosition } = active;
  const cursor = clampCursor(grid, {
    ...activePosition,
    ...(partIndex ? { partIndex } : {}),
    ...(staffIndex !== 1 ? { staffIndex } : {})
  });
  const point = before.extent.kind === 'cursor' &&
    cursorAddressesEqual(before.anchor, before.extent.cursor);
  const candidate: SelectionState = point
    ? pointSelection(before.level, cursor)
    : before.extent.kind === 'cursor'
      ? {
          ...cloneSelection(before),
          extent: { kind: 'cursor', cursor: copyCursorAddress(cursor) }
        }
      : cloneSelection(before);
  const present = presentLevels(doc, grid, cursor, projection);
  if (
    present.has(candidate.level) &&
    resolveSelection(doc, candidate, projection).members.length > 0
  ) return candidate;
  const ancestor = relaxLevel(present, candidate.level);
  return pointSelection(ancestor ?? 'document', cursor);
}

function pasteLandingCursor(
  doc: MnxStructure,
  landing: PasteLanding,
  projection: Projection,
  edge: 'first' | 'last'
): EditorCursor {
  const measureIndex = edge === 'first' ? landing.measureStart : landing.measureEnd;
  const tuple = edge === 'first' ? landing.onsetStart : landing.onsetEnd;
  const onset = { num: tuple[0], den: tuple[1] };
  const grid = buildGrid(doc, landing.partIndex, landing.staffIndex);
  const inMeasure = grid.positions.filter(position => position.measureIndex === measureIndex);
  const position = inMeasure.find(candidate => onsetsEqual(candidate.onset, onset)) ??
    (edge === 'first' ? inMeasure[0] : inMeasure[inMeasure.length - 1]) ??
    grid.positions[edge === 'first' ? 0 : grid.positions.length - 1];
  const base: EditorCursor = {
    measureIndex: position?.measureIndex ?? measureIndex,
    onset: position?.onset ?? onset,
    line: grid.mode === 'string' ? 1 : 0,
    ...(landing.partIndex ? { partIndex: landing.partIndex } : {}),
    ...(landing.staffIndex !== 1 ? { staffIndex: landing.staffIndex } : {}),
    ...(landing.voiceIndex ? { voiceIndex: landing.voiceIndex } : {})
  };
  if (!position) return base;

  const voiceSlots = position.slots.filter(slot => slot.voiceIndex === landing.voiceIndex);
  const voiceEvents = position.events.filter(event => event.voiceIndex === landing.voiceIndex);
  const slot = edge === 'first' ? voiceSlots[0] : voiceSlots[voiceSlots.length - 1];
  const event = edge === 'first' ? voiceEvents[0] : voiceEvents[voiceEvents.length - 1];
  const matchedSlot = event
    ? voiceSlots.find(candidate =>
        candidate.eventIndex === event.eventIndex &&
        candidate.containerIndex === event.containerIndex
      ) ?? slot
    : slot;
  if (matchedSlot) {
    base.line = projection === 'tab' && grid.mode === 'string'
      ? matchedSlot.line
      : matchedSlot.staffPosition;
    const sameLine = voiceSlots.filter(candidate =>
      (projection === 'tab' && grid.mode === 'string'
        ? candidate.line === base.line
        : candidate.staffPosition === base.line)
    );
    const slotIndex = sameLine.indexOf(matchedSlot);
    if (slotIndex > 0) base.slotIndex = slotIndex;
  }
  if (event) {
    const eventSlotIndex = position.events.indexOf(event);
    if (eventSlotIndex >= 0) base.eventSlotIndex = eventSlotIndex;
  }
  return base;
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
