/**
 * The editor's mount, promoted: bind an `EditorSession` to a
 * `<mnx-document-viewer>` from plain DOM, the way `playbackHost.ts` binds the
 * player (roadmap: core-editor-element-promotion, slice 1 — keyboard only).
 *
 * The editing LOGIC never moved and does not move now: intents, the keymap, the
 * cursor and the session are `src/edit/`, pure and DOM-free. What lived in the
 * workbench's scenario page was the wiring — who hears the keys, who holds the
 * half-typed fret, who turns a session into what the viewer draws — and that is
 * what this is. The keyboard's core came first (slice 1):
 *
 *   navigation · the selection ladder · fret and pitch entry · durations ·
 *   ties · delete · undo / redo · Escape and Enter's pending pair
 *
 * and then the surfaces that hang off it (slices 2–3), mounted when the host
 * gives the binding somewhere to put them (`overlay`): **Enter** opens the rung
 * inspector over the selection — which is where every setup verb now lives; the
 * Shift+letter popovers retired into it — **Shift+L** the lyric text editor,
 * and copy / cut / paste work when the host supplies a clipboard store. Without
 * an `overlay` those keys stay unbound rather than half-working. The command
 * palette is the workbench's own and is not mounted here.
 *
 * Both shells sit on this — it is the one editor surface. What a HOST keeps is
 * what is genuinely its own, and the options are where it plugs in: which
 * session is in force (`session`; a host that replaces its session disposes and
 * rebinds), the neighbouring document at the top rung (`onEscalate`), inspector
 * words that address the host's state rather than the document (`inspector`),
 * and whether keys typed with nothing focused are the editor's (`claimUnfocused`).
 *
 * **Scope is structural.** The listener is on `scope`, the host's own element,
 * not on `window`: a key reaches the editor because focus is inside it, which
 * is the containment a window listener could only test for (`keyScope.ts`).
 * Two editors on a page do not fight, and an embed that never
 * binds one pays nothing — nothing in the viewer or the player imports this
 * module, so it is its own chunk behind a dynamic `import()`.
 *
 * The host owns the document's fate. The binding edits in memory and reports:
 * `onChange(document)` whenever the document is a different one (an edit, an
 * undo, a redo), by reference — the same objects `EditHistory` hands back, so
 * a host can tell "back to what I saved" without comparing scores.
 */
import { EditorSession } from '../edit/session.ts';
import type { PointerPlacement } from './pointerHitTest.ts';
import type { EditorIntent } from '../edit/intents.ts';
import {
  EDIT_LAYER, NAVIGATION_LAYER, TAB_DIGIT_LAYER, resolveKeyAction, resolveShellAction, strokeOf, type KeymapLayer
} from '../edit/keymap.ts';
import { KEY_DOCS, KEY_GROUP_LABELS, type CheatGroup } from '../edit/keymapDocs.ts';
import { TabDigitResolver } from '../edit/tabDigitResolver.ts';
import { lyricPlanOps, type LyricPlanEdit } from '../edit/lyricText.ts';
import { applyOp } from '../edit/ops.ts';
import type { SelectionClipboardStore } from '../edit/selectionClipboard.ts';
import { copySelectionToStore, cutSelectionToStore, pasteSelectionFromStore } from '../edit/selectionClipboardActions.ts';
import { copySelectionNotice, cutSelectionNotice, deleteSelectionNotice, pasteSelectionNotice, type ClipboardNotice, type RefusalReason } from '../edit/clipboardFeedback.ts';
import { neighbourSystemMeasure } from '../engine/layout/spacing.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { DocumentViewer } from './DocumentViewer.ts';
import { focusUnclaimed, focusWithin, isTextEntry, realTarget } from './keyScope.ts';
import { enclosureFor, selectionContextFor } from './editorSelection.ts';
import { buildInspectorView, type InspectorView } from './inspectorRows.ts';
import { INSPECTOR_REFUSAL, fireFromInspector, inspectorLineIntent, mirrorOverlayAt } from './inspectorMount.ts';
import type { OverlayAnchor } from './overlayPlacement.ts';
import type { RungInspector } from './RungInspector.ts';
import type { LyricTextEditor } from './LyricTextEditor.ts';
import './RungInspector.ts';
import './LyricTextEditor.ts';
import './EditorSurfaces.ts';
import type { SelectionContext } from './mnxContext.ts';
import type { CursorPlayback, PerformedPosition } from './cursorPlayback.ts';
import { CURSOR_LABEL_MS, type CursorLabel } from './CursorLabel.ts';
import './CursorLabel.ts';
import type { PassNotice, PerformedPlace } from '../edit/session.ts';
import { entryStart } from '../edit/performedCursor.ts';
import { barSeekTarget } from '../model/playback.ts';
import { hasRepeatStructure } from '../model/passes.ts';
import { rational, type Rational } from '../model/time.ts';

/** How long a paused cursor rests before the player follows it: held keys make one seek, not one per repeat. */
const SEEK_SETTLE_MS = 150;
/** How long ←/→ while playing wait for another press before the counted bars become one seek. */
const BAR_SEEK_MS = 300;
/** After this cursor seeks, how long a playhead report may still be the old place rather than someone else's seek. */
const OWN_SEEK_GRACE_MS = 800;

const placeKey = (place: PerformedPlace | null) => place ? `${place.ordinal}:${place.onset.num}/${place.onset.den}` : '';
const headKey = (head: PerformedPosition | null) => head ? `${head.ordinal}:${head.offset.num}/${head.offset.den}` : '';
const toPosition = (place: PerformedPlace): PerformedPosition =>
  ({ ordinal: place.ordinal, offset: rational(BigInt(place.onset.num), BigInt(place.onset.den)) });
/** A playhead offset as a grid onset — floored to 1/3840 of a whole note, which is only ever compared with stops. */
const onsetOf = (offset: Rational) => ({ num: Number((offset.num * 3840n) / offset.den), den: 3840 });
const noticeText = (notice: PassNotice) => notice.kind === 'pass' ? `Pass ${notice.pass}` : 'Not played';
const HORIZONTAL_STEPS: Partial<Record<EditorIntent['type'], 1 | -1>> = { nextPosition: 1, prevPosition: -1, jumpNext: 1, jumpPrev: -1 };

export interface EditorBindingOptions {
  /** Stamped into the session's traces; '' when the document is not a corpus scenario. */
  documentId?: string;
  /** The document is a different one: an edit, an undo or a redo. The host shows and saves it. */
  onChange(document: MnxStructure): void;
  /** Look, do not touch: navigation still works, nothing mutates. Asked per key, so a host can change its mind. */
  readOnly?(): boolean;
  /** The cursor or the history moved: a host showing either (a key list, an undo button) redraws. */
  onState?(): void;
  /**
   * Somewhere to put the editor's surfaces: a positioned box over the score
   * pane. Given one, Enter opens the rung inspector at the selection and
   * Shift+L the lyric text editor. The box must be the offset parent the
   * viewer's rects can be measured against — the host's score pane.
   */
  overlay?: HTMLElement;
  /** What the inspector's top crumb calls the document. Asked when it opens. */
  title?(): string;
  /** A document to DRAW without it becoming the document — the lyric editor's live preview; null puts the real one back. */
  onPreview?(document: MnxStructure | null): void;
  /** Where cut and copied selections go. Without one the clipboard keys are unbound. */
  clipboard?: SelectionClipboardStore;
  /** What a copy, cut or paste did, or the precise sentence for why it did not. */
  onNotice?(notice: ClipboardNotice): void;
  /** The viewer is showing some OTHER document (an older version, say): no cursor, no keys, until it is not. */
  suspended?(): boolean;
  /**
   * A session the host already built — a replay from `{}`, a rung carried in
   * from the neighbouring document. The binding adopts it instead of making
   * one, and `document` is not read. A binding holds ONE session for its whole
   * life: a host that replaces its session (revert, replay) disposes the
   * binding and binds the new one.
   */
  session?: EditorSession;
  /**
   * ↑/↓ at the document rung: the neighbouring DOCUMENT, which belongs to the
   * host's collection — the workbench walks its rail, studio would walk the
   * library. It leaves the document entirely, so it is a hook and not an
   * intent: there is nothing for a trace to replay. Unset, the keys do nothing.
   */
  onEscalate?(delta: 1 | -1): void;
  /**
   * An intent was declined, and WHY — so a host can say something useful
   * instead of leaving a keystroke to vanish.
   *
   *  - `read-only` — this piece cannot be edited here at all (another tab holds
   *    it). The mount used to swallow this one entirely: it returned before
   *    reaching the session, so the single most confusing refusal there is —
   *    a cursor sitting exactly where you put it, taking nothing you type —
   *    was the one nothing could report.
   *  - `suspended` — the host is showing some other document, so there is no
   *    session to edit.
   *  - `unavailable` — the session itself declined: a rung this document does
   *    not present, an edit this position cannot take.
   *
   * A host is expected to stay quiet about `unavailable` on NAVIGATION, which
   * is an edge rather than a refusal — walking off the end of the score should
   * not nag.
   */
  onRefused?(intent: EditorIntent, reason: RefusalReason): void;
  /**
   * This editor is the only thing on the page a keystroke could be meant for,
   * so keys typed while NOTHING is focused (the page on load, a click on dead
   * space) are its keys too. Precisely the leniency an embed must not have, so
   * it is opt-in: the binding then also listens on the window, for unclaimed
   * keys and for the causes of a focus change it could not otherwise see.
   */
  claimUnfocused?: boolean;
  /**
   * Words the HOST answers in the rung inspector, beside the editor's own —
   * the workbench's `iteration`, which addresses its pass model and not the
   * document. `extend` adds them to the view; `apply` is offered every typed
   * line first and returns undefined when the line is not the host's, null when
   * it took it, or the sentence that says why not.
   */
  inspector?: {
    extend?(view: InspectorView): InspectorView;
    apply?(word: string | null, text: string, key?: string): string | null | undefined;
  };
  /**
   * The player this cursor IS (roadmap/proposed/core-single-cursor.md). Paused,
   * every settled cursor move seeks it, so Play starts at the cursor — or, with
   * a range or a bar selected, at the selection's first event, which Play
   * collapses to. Playing, nothing is edited (*Pause to edit* beside the
   * playhead), ←/→ seek a whole bar at a time with quick presses counted into
   * one seek, and a pause parks the cursor on the note that was sounding. A
   * move that changes the pass says so beside the cursor. Without one the
   * cursor is the editor's alone, as it always was.
   */
  playback?: CursorPlayback;
}

export interface EditorBinding {
  readonly session: EditorSession;
  /** The document as it is now — the very object the history holds. */
  readonly document: MnxStructure;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Escape put the cursor away; the next intent brings it back. A host drawing the ladder (a HUD, a chip) asks. */
  readonly cursorHidden: boolean;
  /** Will the next keystroke reach this editor? The one predicate behind both the key gate and the dimmed cursor. */
  readonly hasKeyboard: boolean;
  /** An intent from a surface the host owns (a sheet, a button): same funnel as a key. */
  handleIntent(intent: EditorIntent): boolean;
  /** The host drove the SESSION itself (a sweep, a walk through the op queue): end the fret window, show the cursor, report. */
  sessionMoved(): void;
  /** Enter's door, for a host surface that opens it by pointer. Needs an `overlay`. */
  openInspector(): void;
  /** Shift+L's door, for a host's palette. Needs an `overlay`. */
  openLyrics(): void;
  /** A host overlay is taking the keyboard: two surfaces wanting the same keys is one too many. */
  closeSurfaces(): void;
  undo(): boolean;
  redo(): boolean;
  /** Redraw the cursor — after the host changed the view, or took the keyboard away and gave it back. */
  refresh(): void;
  /** What the keyboard can do RIGHT NOW, here: the keymap's meaning table, filtered to the rung, the pane, and the
   *  keys this mount actually binds — so the sheet never advertises a surface that is not mounted yet. */
  keys(): CheatGroup[];
  dispose(): void;
}

const NO_SELECTION: SelectionContext = { activePartId: null, activeMeasureIndex: null, activeVoiceIndex: null, activeEventIndex: null, selectedNoteIds: [] };

/** Navigation never mutates; everything else does. Used to hold a read-only binding to its word. */
const NAVIGATION = new Set<EditorIntent['type']>([
  'nextPosition', 'prevPosition', 'nextMeasure', 'prevMeasure', 'lineDown', 'lineUp', 'goToMeasure', 'goToEdge',
  'relaxSelection', 'tightenSelection', 'goToLevel', 'extendSelection', 'closeSelection', 'setProjection', 'cycleSlot',
  'setPart', 'setStaff', 'jumpNext', 'jumpPrev', 'jumpUp', 'jumpDown', 'goToPointer', 'goToPerformed'
]);

export function bindEditor(scope: HTMLElement, viewer: DocumentViewer, document: MnxStructure, options: EditorBindingOptions): EditorBinding {
  const document_ = scope.ownerDocument;
  const session = options.session ?? new EditorSession(document, options.documentId ?? '');
  let shown = session.doc;
  let cursorHidden = false;
  let pendingFret: number | null = null;
  let disposed = false;
  /** A footprint lit without moving the session: the lyric editor's caret. */
  let preview: { enclosure: ReturnType<typeof enclosureFor>; noteIds: string[] } | null = null;
  let anchor: OverlayAnchor | null = null;
  let paneWidth = 0;
  let inspector: RungInspector | null = null;
  let inspectorError: string | null = null;
  let lyrics: LyricTextEditor | null = null;
  const surfaces = options.overlay ? options.overlay.appendChild(document_.createElement('mnx-editor-surfaces')) : null;
  // ── the cursor as the playhead (core-single-cursor.md) ──
  const playback = options.playback ?? null;
  let playing = playback?.playing ?? false;
  /** ←/→ while playing: the visit the counted presses have reached, until the seek fires. */
  let pendingBar: number | null = null;
  let barTimer: ReturnType<typeof setTimeout> | undefined;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;
  /** Where the player was last put (or found, on a pause) — a settle that names the same place seeks nothing. */
  let lastSought = placeKey(session.playStart);
  let lastSeekAt = 0;
  /** The playhead as last reported: a paused playhead that MOVED, and not by this cursor, takes the cursor with it. */
  let lastHead = headKey(playback?.playhead ?? null);
  let label: CursorLabel | null = null;
  let labelTimer: ReturnType<typeof setTimeout> | undefined;
  /** While playing the playhead is the cursor, so the editor's own is not drawn — except where counted presses are headed. */
  const playingHides = () => playing && pendingBar === null;

  const suspended = () => options.suspended?.() ?? false;
  /** The inspector is ours too; unclaimed focus only for a host that asked for it. */
  const hasKeyboard = () => focusWithin(scope) || (surfaces !== null && focusWithin(surfaces)) || (!!options.claimUnfocused && focusUnclaimed());
  const draw = () => {
    if (disposed) return;
    viewer.selection = suspended() ? NO_SELECTION : selectionContextFor(session, { cursorHidden: cursorHidden || playingHides(), pendingFret, preview });
    // A cursor drawn while the keys go elsewhere is a lie about who owns the keyboard.
    viewer.selectionInactive = !hasKeyboard();
    if (inspector) {
      const built = buildInspectorView(options.title?.() ?? '', session, cursorHidden);
      const view = options.inspector?.extend?.(built) ?? built;
      Object.assign(inspector, { crumbs: view.crumbs, pills: view.pills, words: view.words, secondary: view.secondary, note: view.note, error: inspectorError, anchor });
    }
    options.onState?.();
  };
  /** After anything that may have moved the session: report a new document, redraw, and let the player follow. */
  const settle = (immediate = false) => {
    if (session.doc !== shown) { shown = session.doc; options.onChange(shown); reunite(); }
    draw();
    followCursor(immediate);
  };
  /**
   * An edit replaced the player's performance, and an idle player may come out
   * of that somewhere else (back at the top). Paused, the CURSOR is the truth:
   * the playhead is put back under it, and what the player reports meanwhile
   * is not taken for someone else's seek.
   */
  function reunite() {
    if (!playback || playing) return;
    lastSeekAt = Date.now();
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      seekTimer = undefined;
      const head = playback.playhead, target = session.playStart;
      if (target && head?.ordinal !== target.ordinal) seekNow(target);
    }, SEEK_SETTLE_MS);
  }
  /** Put the player at a performed place now, and remember it was this cursor that did. */
  const seekNow = (place: PerformedPlace | null = session.playStart) => {
    clearTimeout(seekTimer); seekTimer = undefined;
    if (!playback || !place || disposed) return;
    lastSought = placeKey(place); lastSeekAt = Date.now();
    playback.seek(toPosition(place));
  };
  /** Paused, the player follows the cursor once it rests — at once for a press, which names a moment. */
  function followCursor(immediate: boolean) {
    if (!playback || playing || suspended()) return;
    const target = session.playStart;
    if (!target || placeKey(target) === lastSought) return;
    clearTimeout(seekTimer);
    if (immediate) seekNow(target);
    else seekTimer = setTimeout(() => seekNow(), SEEK_SETTLE_MS);
  }
  /** The overlay's coordinates for a viewport rect. */
  const inOverlay = (rect: DOMRect | null): OverlayAnchor | null => {
    const box = options.overlay?.getBoundingClientRect();
    return rect && box ? { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height } : null;
  };
  /** One line beside the cursor — or beside the playhead, which is the cursor while the music plays. */
  const showLabel = (text: string) => {
    if (!surfaces || disposed) return;
    if (!label) { label = document_.createElement('mnx-cursor-label'); surfaces.append(label); }
    label.flash(text, playingHides() ? inOverlay(viewer.playheadRect()) : anchor);
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => { if (label) label.hidden = true; }, CURSOR_LABEL_MS);
  };
  const refusePlaying = (intent: EditorIntent) => {
    showLabel('Pause to edit');
    options.onRefused?.(intent, 'playing');
  };
  /** Stand the cursor where the playhead is, without seeking — the player is already there, to the exact time. */
  const park = (head: PerformedPosition) => {
    const onset = onsetOf(head.offset);
    session.handleIntent({ type: 'goToPerformed', ordinal: head.ordinal, onset: [onset.num, onset.den] });
    lastSought = placeKey(session.playStart);
  };
  /** ←/→ while playing: whole visits, to a visit's start, counted until the presses stop. */
  const barStep = (delta: 1 | -1) => {
    const head = playback?.playhead;
    const model = session.passModel;
    if (!playback || !head || model.entries.length === 0) return;
    const from = model.entries[pendingBar ?? head.ordinal];
    pendingBar = barSeekTarget(model.entries.length, head.ordinal, pendingBar, delta);
    const entry = model.entries[pendingBar];
    const start = entryStart(entry);
    // The cursor shows where the count has got to; the music plays on until the seek.
    session.handleIntent({ type: 'goToPerformed', ordinal: pendingBar, onset: [start.num, start.den] });
    cursorHidden = false;
    draw();
    if (from && from.iteration !== entry.iteration && hasRepeatStructure(session.doc)) showLabel(`Pass ${entry.iteration}`);
    clearTimeout(barTimer);
    barTimer = setTimeout(() => {
      barTimer = undefined;
      const target = pendingBar;
      pendingBar = null;
      const visit = target === null ? undefined : session.passModel.entries[target];
      if (visit) seekNow({ ordinal: visit.ordinal, onset: entryStart(visit) });
      draw();
    }, BAR_SEEK_MS);
  };
  const onPlayback = () => {
    if (disposed || !playback) return;
    const now = playback.playing;
    const head = playback.playhead;
    // A playhead appearing where there was none (a performance just installed)
    // is the player arriving, not the playhead moving.
    const moved = lastHead !== '' && headKey(head) !== lastHead;
    lastHead = headKey(head);
    if (now !== playing) {
      playing = now;
      if (now) {
        tabDigits.flush(); closeInspector(false); closeLyrics(false);
        // A move made just before Play is where Play meant to start.
        if (seekTimer !== undefined) seekNow();
        // Play collapses a range, or a rung wider than the event, to its first event.
        const selection = session.selection;
        const extent = selection.extent.kind === 'cursor' ? selection.extent.cursor : null;
        const point = extent !== null && extent.measureIndex === selection.anchor.measureIndex
          && extent.onset.num * selection.anchor.onset.den === selection.anchor.onset.num * extent.onset.den;
        if (!point || (selection.level !== 'note' && selection.level !== 'event')) {
          const start = session.playStart;
          if (start) session.handleIntent({ type: 'goToPerformed', ordinal: start.ordinal, onset: [start.onset.num, start.onset.den], level: 'note' });
          lastSought = placeKey(session.playStart);
        }
      } else {
        clearTimeout(barTimer); barTimer = undefined;
        const target = pendingBar;
        pendingBar = null;
        const visit = target === null ? undefined : session.passModel.entries[target];
        if (visit) seekNow({ ordinal: visit.ordinal, onset: entryStart(visit) });
        else if (head) park(head);
      }
      draw();
      return;
    }
    // Paused, and the playhead MOVED by something other than this cursor (the
    // tray's rail, the sync bar, an address in the URL): the cursor goes with
    // it — there is one. A report that only repeats the old place (a seek the
    // player refused, a state change) moves nothing.
    if (!now && moved && head && seekTimer === undefined && pendingBar === null
      && Date.now() - lastSeekAt > OWN_SEEK_GRACE_MS && head.ordinal !== session.performedOrdinal) {
      park(head); draw();
    }
  };
  const readOnly = () => options.readOnly?.() ?? false;
  const dispatch = (intent: EditorIntent): boolean => {
    if (disposed) return false;
    // Say WHY, rather than returning quietly. A read-only refusal used to leave
    // this function before anything could observe it, which is why typing a
    // fret into a locked piece did nothing and explained nothing.
    if (suspended()) { options.onRefused?.(intent, 'suspended'); return false; }
    if (playing && playback && !NAVIGATION.has(intent.type)) { refusePlaying(intent); return false; }
    if (readOnly() && !NAVIGATION.has(intent.type)) { options.onRefused?.(intent, 'read-only'); return false; }
    if (playing && playback && intent.type !== 'goToPerformed') {
      // Playing, the playhead is the cursor: a move starts from where the music
      // is, and where it lands is where the music goes.
      const head = playback.playhead;
      if (head) park(head);
      const moved = session.handleIntent(intent);
      const target = session.playStart;
      if (moved && target && (!head || target.ordinal !== head.ordinal || intent.type === 'goToPointer')) seekNow(target);
      if (session.passNotice) showLabel(noticeText(session.passNotice));
      draw();
      return moved;
    }
    const handled = session.handleIntent(intent);
    cursorHidden = false;
    if (playback && session.passNotice) showLabel(noticeText(session.passNotice));
    // Delete is the one verb whose two presses mean different things, so it says which one this was — including
    // when it declined. Everything else that returns false is a navigation edge, where silence is the right answer.
    const deleted = intent.type === 'delete' ? session.lastDelete : null;
    if (deleted) options.onNotice?.(deleteSelectionNotice(deleted));
    if (!handled) options.onRefused?.(intent, 'unavailable');
    settle(intent.type === 'goToPointer');
    return handled;
  };

  /** Undo and redo, in one place: the fret window is flushed first, or a
   *  half-typed digit would commit into the document the undo just restored. */
  const undoAction = () => { tabDigits.flush(); return dispatch({ type: 'undo' }); };
  const redoAction = () => { tabDigits.flush(); return dispatch({ type: 'redo' }); };

  // ── the surfaces: the rung inspector and the lyric text editor ───────────
  const closeInspector = (refocus = true) => {
    if (!inspector) return;
    inspector.remove(); inspector = null; inspectorError = null;
    if (refocus) scope.focus();
    draw();
  };
  /** An intent FROM the inspector: through the same funnel as a key, and the ladder put back on its rung. */
  const fromInspector = (intent: EditorIntent) => {
    if (disposed || suspended() || (readOnly() && !NAVIGATION.has(intent.type))) { inspectorError = 'This piece is read-only here.'; draw(); return; }
    tabDigits.flush();
    cursorHidden = false;
    inspectorError = fireFromInspector(session, intent) ? null : INSPECTOR_REFUSAL;
    settle();
  };
  const openInspector = () => {
    if (!surfaces || inspector || cursorHidden || suspended()) return;
    tabDigits.flush();
    closeLyrics(false);
    followProjection();
    const el = document_.createElement('mnx-rung-inspector');
    el.mirrored = anchor ? mirrorOverlayAt(anchor, paneWidth) : false;
    el.addEventListener('inspector-level', e => fromInspector({ type: (e as CustomEvent<{ direction: string }>).detail.direction === 'relax' ? 'relaxSelection' : 'tightenSelection' }));
    el.addEventListener('inspector-step', e => fromInspector({ type: (e as CustomEvent<{ direction: string }>).detail.direction === 'next' ? 'nextPosition' : 'prevPosition' }));
    el.addEventListener('inspector-extend', e => fromInspector({ type: 'extendSelection', direction: (e as CustomEvent<{ direction: 'previous' | 'next' }>).detail.direction }));
    el.addEventListener('inspector-goto', e => fromInspector((e as CustomEvent<{ intent: EditorIntent }>).detail.intent));
    el.addEventListener('inspector-remove', e => fromInspector((e as CustomEvent<{ intent: EditorIntent }>).detail.intent));
    el.addEventListener('inspector-apply', e => {
      const { word, text, key } = (e as CustomEvent<{ word: string | null; key?: string; text: string }>).detail;
      const hosts = options.inspector?.apply?.(word, text, key);
      if (hosts !== undefined) { inspectorError = hosts; draw(); return; }
      const parsed = inspectorLineIntent(session, word, text, key);
      if ('error' in parsed) { inspectorError = parsed.error; draw(); } else fromInspector(parsed.intent);
    });
    el.addEventListener('inspector-close', () => closeInspector());
    inspector = el;
    draw();
    surfaces.append(el);
  };
  function closeLyrics(refocus = true) {
    if (!lyrics) return;
    lyrics.remove(); lyrics = null; preview = null;
    options.onPreview?.(null);
    if (refocus) scope.focus();
    draw();
  }
  const openLyrics = () => {
    if (!surfaces || lyrics || suspended() || readOnly()) return;
    tabDigits.flush();
    closeInspector(false);
    const el = document_.createElement('mnx-lyric-text-editor');
    const partIndex = session.cursor.partIndex ?? 0;
    Object.assign(el, { doc: session.doc, partIndex, partLabel: session.doc.parts?.[partIndex]?.name ?? '', focusNoteKey: session.selectedNoteKeys[0] ?? '' });
    // Clean parses draw live on a SCRATCH copy, through the very ops the session would use; nothing is edited until Apply.
    el.addEventListener('lyric-editor-edits', e => {
      const { edits } = (e as CustomEvent<{ edits: LyricPlanEdit[] }>).detail;
      options.onPreview?.(edits.length === 0 ? null : lyricPlanOps(edits).reduce(applyOp, session.doc));
    });
    el.addEventListener('lyric-editor-preview', e => {
      const noteIds = (e as CustomEvent<{ noteKeys: string[] }>).detail.noteKeys;
      preview = noteIds.length ? { enclosure: enclosureFor('note'), noteIds } : null;
      draw();
    });
    // The buffer's diff lands as ONE intent: the history records the syllables, never the keystrokes.
    el.addEventListener('lyric-editor-apply', e => {
      const { edits } = (e as CustomEvent<{ edits: LyricPlanEdit[] }>).detail;
      closeLyrics();
      dispatch({ type: 'applyLyricPlan', edits });
    });
    el.addEventListener('lyric-editor-close', () => closeLyrics());
    lyrics = el;
    surfaces.append(el);
  };
  /** The viewer's enclosure rect, in the overlay's own coordinates: where the inspector hangs. */
  const onAnchored = (event: Event) => {
    const rect = (event as CustomEvent<{ rect: DOMRect | null }>).detail.rect;
    const box = options.overlay?.getBoundingClientRect();
    anchor = rect && box ? { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height } : null;
    paneWidth = box?.width ?? 0;
    if (inspector) inspector.anchor = anchor;
    // A label raised by the move that is only now drawn follows the cursor to where it landed.
    if (label && !label.hidden && !playingHides()) label.anchor = anchor;
  };
  const clipboard = async (verb: 'copySelection' | 'cutSelection' | 'pasteSelection') => {
    const store = options.clipboard;
    if (!store || (verb !== 'copySelection' && readOnly())) return;
    const notice = verb === 'copySelection' ? copySelectionNotice(await copySelectionToStore(session, store))
      : verb === 'cutSelection' ? cutSelectionNotice(await cutSelectionToStore(session, store))
      : pasteSelectionNotice(await pasteSelectionFromStore(session, store));
    if (disposed) return;
    options.onNotice?.(notice);
    cursorHidden = false;
    settle();
  };

  const tabDigits = new TabDigitResolver(
    fret => { pendingFret = null; dispatch({ type: 'enterFret', fret }); },
    candidate => { pendingFret = candidate; draw(); }
  );

  /** Digits belong to the pane on screen: frets when a tab pane is visible and the part has strings. */
  const layers = (): KeymapLayer[] => {
    const view = viewer.resolvedView();
    const frets = session.mode === 'string' && (view === 'tab' || view === 'both') && !readOnly();
    return [...(frets ? [TAB_DIGIT_LAYER] : []), NAVIGATION_LAYER, EDIT_LAYER];
  };
  /** Keep the session's projection following the pane: a notation pane addresses the staff, a tab pane the fingerboard. */
  const followProjection = () => {
    const view = viewer.resolvedView();
    const desired = view === 'tab' ? 'tab' : view === 'notation' ? 'notation' : null;
    if (!desired || desired === session.projection || (desired === 'tab' && session.mode !== 'string')) return;
    session.handleIntent({ type: 'setProjection', projection: desired });
  };
  /** Up and down at the bar rungs mean the neighbouring SYSTEM — a fact about the paint, resolved here into a bar. */
  const systemStep = (intent: EditorIntent): EditorIntent | null | undefined => {
    const level = session.selectionLevel;
    const vertical = (level === 'measure' && (intent.type === 'lineUp' || intent.type === 'lineDown'))
      || (level === 'partMeasure' && (intent.type === 'jumpUp' || intent.type === 'jumpDown'));
    if (!vertical || cursorHidden) return undefined;
    const rows = viewer.systemRows();
    if (!rows?.length) return null;
    const target = neighbourSystemMeasure(rows, session.cursor.measureIndex, intent.type === 'lineDown' || intent.type === 'jumpDown' ? 1 : -1);
    return target === null ? null : { type: 'goToMeasure', measureIndex: target };
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // Tab moves focus with no pointer event, so a keydown is also a focus-change cause — re-ask after it settles.
    if (event.code === 'Tab') onFocusChange();
    if (disposed || suspended() || event.defaultPrevented || event.isComposing || isTextEntry(realTarget(event))) return;
    const stroke = strokeOf(event);
    const action = resolveKeyAction(stroke, layers());
    if (playing && playback) {
      // Nothing is written while the music plays: a fret, the inspector, the lyric editor, cut and paste all wait.
      const shellWhilePlaying = resolveShellAction(stroke);
      if (action?.type === 'tabDigit') { event.preventDefault(); refusePlaying({ type: 'enterFret', fret: action.digit }); return; }
      if ((shellWhilePlaying === 'commitPending' && surfaces) || (shellWhilePlaying === 'lyricTextEditor' && surfaces)
        || ((shellWhilePlaying === 'cutSelection' || shellWhilePlaying === 'pasteSelection') && options.clipboard)) {
        event.preventDefault(); refusePlaying({ type: 'undo' }); return;
      }
    }
    if (action?.type === 'tabDigit') {
      event.preventDefault();
      if (session.projection !== 'tab') session.handleIntent({ type: 'setProjection', projection: 'tab' });
      cursorHidden = false;
      tabDigits.push(action.digit);
      return;
    }
    const shell = resolveShellAction(stroke);
    // Escape and Enter walk the pending list: a half-typed fret first, then — Escape only — the cursor itself.
    if (shell === 'abandonPending' || shell === 'commitPending') {
      if (tabDigits.pending !== null) { event.preventDefault(); if (shell === 'commitPending') tabDigits.flush(); else { tabDigits.cancel(); pendingFret = null; draw(); } return; }
      if (shell === 'abandonPending' && !cursorHidden) { event.preventDefault(); cursorHidden = true; draw(); }
      // Enter with nothing pending is the inspector's door — last in the walk, so a half-typed fret never opens one.
      else if (shell === 'commitPending' && surfaces && !cursorHidden) { event.preventDefault(); openInspector(); }
      return;
    }
    if (shell === 'lyricTextEditor' && surfaces) { event.preventDefault(); tabDigits.flush(); openLyrics(); return; }
    if ((shell === 'copySelection' || shell === 'cutSelection' || shell === 'pasteSelection') && options.clipboard) {
      // A live TEXT selection means the person is addressing the prose, not the score.
      const text = document_.getSelection();
      if (shell !== 'pasteSelection' && text && !text.isCollapsed) return;
      event.preventDefault(); tabDigits.flush(); void clipboard(shell);
      return;
    }
    // Any other key ends the fret window first, so "1 then →" is fret 1, not a lost digit.
    if (action || shell) tabDigits.flush();
    if (!action) return; // the command palette is the workbench's own
    event.preventDefault();
    followProjection();
    let intent: EditorIntent = action;
    // The document rung's ↑/↓ is the neighbouring DOCUMENT, which belongs to the host's collection.
    if ((intent.type === 'lineUp' || intent.type === 'lineDown') && session.selectionLevel === 'document' && !cursorHidden) {
      options.onEscalate?.(intent.type === 'lineDown' ? 1 : -1);
      return;
    }
    // Playing, ←/→ count whole bars toward one seek (core-single-cursor.md rule 7).
    const bars = playing && playback ? HORIZONTAL_STEPS[intent.type] : undefined;
    if (bars !== undefined) { barStep(bars); return; }
    const step = systemStep(intent);
    if (step === null) return;
    if (step) intent = step;
    dispatch(intent);
  };
  /**
   * Focus may have moved — re-ask the ownership predicate. Deferred a task, not a microtask: `focusout` and
   * `pointerdown` both fire BEFORE the new element is active, so an immediate read would see the outgoing state.
   * The inspector goes with the keyboard: a surface for acting on the selection with keys it no longer receives
   * is the same lie the dimmed cursor exists to avoid.
   */
  function onFocusChange() {
    setTimeout(() => {
      if (disposed) return;
      if (!hasKeyboard()) { tabDigits.flush(); closeInspector(false); }
      draw();
    }, 0);
  }
  /** A pointer went down somewhere: close the inspector unless it landed inside it. Capture phase and
   *  `composedPath`, so it sees through shadow roots — and nothing is prevented, so the click still lands. */
  const onPointerDown = (event: Event) => {
    if (inspector && !event.composedPath().includes(inspector)) closeInspector(false);
    onFocusChange();
  };
  /** Unclaimed focus: the key never passed through `scope`, so the window hands it over. */
  const onUnclaimedKey = (event: KeyboardEvent) => { if (focusUnclaimed()) onKeyDown(event); };
  /** A click in the combined score chooses which rendering owns subsequent spatial input. Membership is model
   *  state and does not fork: switching projection remaps the selection in place. Not a reason to show a cursor. */
  const onNoteSelected = (event: Event) => {
    const projection = (event as CustomEvent<{ projection?: 'notation' | 'tab' }>).detail.projection;
    if (disposed || suspended() || !projection || projection === session.projection) return;
    tabDigits.flush();
    if (session.handleIntent({ type: 'setProjection', projection })) settle();
  };
  /**
   * A POINTER placed the cursor (core-editor-pointer-placement.md). The viewer
   * measured where it landed; the session decides what that means, because only
   * the grid knows where a cursor may stand.
   *
   * Placement does not gate on the keyboard the way a keystroke does: pointing
   * at a bar is how a reader TAKES the keyboard, so it also reveals a cursor
   * Escape had put away.
   *
   * It goes through `dispatch` like every other intent, which is what makes it
   * work on a READ-ONLY score: placing the cursor is navigation, and a reader
   * who can walk an old version with the arrows can point at it too. Gating
   * this on `readOnly()` instead — as it first did — left a score where the
   * arrows moved and a tap did nothing.
   */
  const onPositionSelected = (event: Event) => {
    if (disposed) return;
    const detail = (event as CustomEvent<PointerPlacement>).detail;
    if (!detail) return;
    tabDigits.flush();
    // Even a refused placement un-hides the cursor: the reader pointed at the
    // score, so showing them where they already are beats showing nothing.
    cursorHidden = false;
    if (!dispatch({
      type: 'goToPointer',
      measureIndex: detail.measureIndex,
      partIndex: detail.partIndex,
      staffIndex: detail.staffIndex,
      line: detail.line,
      projection: detail.projection,
      fraction: detail.fraction,
      ...(detail.noteKey === undefined ? {} : { noteKey: detail.noteKey }),
      ...(detail.columnKey === undefined ? {} : { columnKey: detail.columnKey }),
      ...(detail.ordinal === undefined ? {} : { ordinal: detail.ordinal })
    })) draw();
  };
  const win = document_.defaultView;

  scope.addEventListener('keydown', onKeyDown);
  scope.addEventListener('focusin', onFocusChange);
  scope.addEventListener('focusout', onFocusChange);
  surfaces?.addEventListener('focusin', onFocusChange);
  surfaces?.addEventListener('focusout', onFocusChange);
  viewer.addEventListener('selection-anchored', onAnchored);
  viewer.addEventListener('note-selected', onNoteSelected);
  viewer.addEventListener('position-selected', onPositionSelected);
  // Placement is the host's to grant: a viewer with no editor bound emits nothing and draws no hover ghost.
  viewer.pointerPlacement = true;
  win?.addEventListener('pointerdown', onPointerDown, true);
  if (options.claimUnfocused) {
    // Focus events are the obvious trigger but are not dependable everywhere (headless Chrome delivers none to
    // `window`, even for real clicks, while activeElement updates correctly) — pointerdown above covers clicks.
    win?.addEventListener('keydown', onUnclaimedKey);
    win?.addEventListener('focusin', onFocusChange);
    win?.addEventListener('focusout', onFocusChange);
  }
  const unsubscribe = playback?.subscribe(onPlayback);
  const uncouple = playback?.couple();
  // Bound onto a player that is already somewhere else (an address that named a
  // visit): the cursor starts where the playhead is, not the other way round.
  {
    const head = playback?.playhead;
    if (head && !playing && head.ordinal !== session.performedOrdinal) park(head);
  }
  followProjection();
  draw();

  return {
    session,
    get document() { return session.doc; },
    get canUndo() { return session.canUndo; },
    get canRedo() { return session.canRedo; },
    get cursorHidden() { return cursorHidden; },
    get hasKeyboard() { return hasKeyboard(); },
    sessionMoved: () => { tabDigits.flush(); cursorHidden = false; settle(); },
    openInspector: () => { if (hasKeyboard()) openInspector(); },
    openLyrics,
    closeSurfaces: () => { closeInspector(false); closeLyrics(false); },
    handleIntent: intent => { tabDigits.flush(); return dispatch(intent); },
    undo: () => undoAction(),
    redo: () => redoAction(),
    refresh: () => { tabDigits.flush(); if (suspended()) { closeInspector(false); closeLyrics(false); } else if (readOnly()) closeLyrics(false); followProjection(); draw(); },
    keys: () => {
      const mounted = (shell: ReturnType<typeof resolveShellAction>) => shell === 'abandonPending'
        || (surfaces !== null && (shell === 'commitPending' || shell === 'lyricTextEditor'))
        || (!!options.clipboard && (shell === 'copySelection' || shell === 'cutSelection' || shell === 'pasteSelection'));
      const active = layers(), level = session.selectionLevel, projection = session.projection;
      const tabPane = active.includes(TAB_DIGIT_LAYER);
      const bound = (doc: (typeof KEY_DOCS)[number]) => doc.strokes.some(stroke =>
        resolveKeyAction(stroke, active) !== null || mounted(resolveShellAction(stroke)));
      return KEY_GROUP_LABELS.map(([group, label]) => ({ label, rows: KEY_DOCS
        .filter(doc => doc.group === group && bound(doc) && !(doc.requires === 'tabPane' && !tabPane) && !(doc.requires === 'notationProjection' && projection !== 'notation'))
        .map(doc => ({ keys: doc.keys, meaning: doc.meaning[level] ?? doc.meaning.all ?? '' })).filter(row => row.meaning) }))
        .filter(group => group.rows.length > 0);
    },
    dispose: () => {
      disposed = true;
      tabDigits.cancel();
      clearTimeout(seekTimer); clearTimeout(barTimer); clearTimeout(labelTimer);
      unsubscribe?.(); uncouple?.();
      label = null;
      scope.removeEventListener('keydown', onKeyDown);
      scope.removeEventListener('focusin', onFocusChange);
      scope.removeEventListener('focusout', onFocusChange);
      viewer.removeEventListener('selection-anchored', onAnchored);
      viewer.removeEventListener('note-selected', onNoteSelected);
      viewer.removeEventListener('position-selected', onPositionSelected);
      viewer.pointerPlacement = false;
      win?.removeEventListener('pointerdown', onPointerDown, true);
      win?.removeEventListener('keydown', onUnclaimedKey);
      win?.removeEventListener('focusin', onFocusChange);
      win?.removeEventListener('focusout', onFocusChange);
      inspector = null; lyrics = null;
      surfaces?.remove();
      options.onPreview?.(null);
      viewer.selection = NO_SELECTION;
    }
  };
}
