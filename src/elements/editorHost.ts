/**
 * The editor's mount, promoted: bind an `EditorSession` to a
 * `<mnx-document-viewer>` from plain DOM, the way `playbackHost.ts` binds the
 * player (roadmap: core-editor-element-promotion, slice 1 — keyboard only).
 *
 * The editing LOGIC never moved and does not move now: intents, the keymap, the
 * cursor and the session are `src/edit/`, pure and DOM-free. What lived in the
 * workbench's scenario page was the wiring — who hears the keys, who holds the
 * half-typed fret, who turns a session into what the viewer draws — and that is
 * what this is. Slice 1 carries the keyboard's core:
 *
 *   navigation · the selection ladder · fret and pitch entry · durations ·
 *   ties · delete · undo / redo · Escape and Enter's pending pair
 *
 * and deliberately not yet the surfaces that hang off it — the rung inspector
 * and the typed popovers (slices 2–3), the lyric editor, the clipboard, the
 * command palette. Those keys are simply unbound here rather than half-working.
 *
 * **Scope is structural.** The listener is on `scope`, the host's own element,
 * not on `window`: a key reaches the editor because focus is inside it, which
 * is the containment the workbench's window listener could only test for
 * (`keyScope.ts`). Two editors on a page do not fight, and an embed that never
 * binds one pays nothing — nothing in the viewer or the player imports this
 * module, so it is its own chunk behind a dynamic `import()`.
 *
 * The host owns the document's fate. The binding edits in memory and reports:
 * `onChange(document)` whenever the document is a different one (an edit, an
 * undo, a redo), by reference — the same objects `EditHistory` hands back, so
 * a host can tell "back to what I saved" without comparing scores.
 */
import { EditorSession } from '../edit/session.ts';
import type { EditorIntent } from '../edit/intents.ts';
import {
  EDIT_LAYER, NAVIGATION_LAYER, TAB_DIGIT_LAYER, resolveKeyAction, resolveShellAction, strokeOf, type KeymapLayer
} from '../edit/keymap.ts';
import { KEY_DOCS, KEY_GROUP_LABELS, type CheatGroup } from '../edit/keymapDocs.ts';
import { TabDigitResolver } from '../edit/tabDigitResolver.ts';
import { neighbourSystemMeasure } from '../engine/layout/spacing.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { DocumentViewer } from './DocumentViewer.ts';
import { focusWithin, isTextEntry, realTarget } from './keyScope.ts';
import { selectionContextFor } from './editorSelection.ts';
import type { SelectionContext } from './mnxContext.ts';

export interface EditorBindingOptions {
  /** Stamped into the session's traces; '' when the document is not a corpus scenario. */
  documentId?: string;
  /** The document is a different one: an edit, an undo or a redo. The host shows and saves it. */
  onChange(document: MnxStructure): void;
  /** Look, do not touch: navigation still works, nothing mutates. Asked per key, so a host can change its mind. */
  readOnly?(): boolean;
  /** The cursor or the history moved: a host showing either (a key list, an undo button) redraws. */
  onState?(): void;
  /** The viewer is showing some OTHER document (an older version, say): no cursor, no keys, until it is not. */
  suspended?(): boolean;
}

export interface EditorBinding {
  readonly session: EditorSession;
  /** The document as it is now — the very object the history holds. */
  readonly document: MnxStructure;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** An intent from a surface the host owns (a sheet, a button): same funnel as a key. */
  handleIntent(intent: EditorIntent): boolean;
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
  'setPart', 'setStaff', 'jumpNext', 'jumpPrev', 'jumpUp', 'jumpDown'
]);

export function bindEditor(scope: HTMLElement, viewer: DocumentViewer, document: MnxStructure, options: EditorBindingOptions): EditorBinding {
  const session = new EditorSession(document, options.documentId ?? '');
  let shown = session.doc;
  let cursorHidden = false;
  let pendingFret: number | null = null;
  let disposed = false;

  const suspended = () => options.suspended?.() ?? false;
  const draw = () => {
    if (disposed) return;
    viewer.selection = suspended() ? NO_SELECTION : selectionContextFor(session, { cursorHidden, pendingFret });
    // A cursor drawn while the keys go elsewhere is a lie about who owns the keyboard.
    viewer.selectionInactive = !focusWithin(scope);
    options.onState?.();
  };
  /** After anything that may have moved the session: report a new document, then redraw. */
  const settle = () => {
    if (session.doc !== shown) { shown = session.doc; options.onChange(shown); }
    draw();
  };
  const readOnly = () => options.readOnly?.() ?? false;
  const dispatch = (intent: EditorIntent): boolean => {
    if (disposed || suspended() || (readOnly() && !NAVIGATION.has(intent.type))) return false;
    const handled = session.handleIntent(intent);
    cursorHidden = false;
    settle();
    return handled;
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
    if (disposed || suspended() || event.defaultPrevented || event.isComposing || isTextEntry(realTarget(event))) return;
    const stroke = strokeOf(event);
    const action = resolveKeyAction(stroke, layers());
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
      return; // Enter with nothing pending opens the rung inspector — slice 3.
    }
    // Any other key ends the fret window first, so "1 then →" is fret 1, not a lost digit.
    if (action || shell) tabDigits.flush();
    if (!action) return; // the clipboard, the lyric editor and the palette are not mounted here yet
    event.preventDefault();
    followProjection();
    let intent: EditorIntent = action;
    // The document rung's ↑/↓ is the neighbouring DOCUMENT, which belongs to the host's collection. Not bound yet.
    if ((intent.type === 'lineUp' || intent.type === 'lineDown') && session.selectionLevel === 'document' && !cursorHidden) return;
    const step = systemStep(intent);
    if (step === null) return;
    if (step) intent = step;
    dispatch(intent);
  };
  const onFocusChange = () => setTimeout(() => { if (!disposed) { if (!focusWithin(scope)) tabDigits.flush(); draw(); } }, 0);

  scope.addEventListener('keydown', onKeyDown);
  scope.addEventListener('focusin', onFocusChange);
  scope.addEventListener('focusout', onFocusChange);
  followProjection();
  draw();

  return {
    session,
    get document() { return session.doc; },
    get canUndo() { return session.canUndo; },
    get canRedo() { return session.canRedo; },
    handleIntent: intent => { tabDigits.flush(); return dispatch(intent); },
    undo: () => { tabDigits.flush(); return dispatch({ type: 'undo' }); },
    redo: () => { tabDigits.flush(); return dispatch({ type: 'redo' }); },
    refresh: () => { followProjection(); draw(); },
    keys: () => {
      const active = layers(), level = session.selectionLevel, projection = session.projection;
      const tabPane = active.includes(TAB_DIGIT_LAYER);
      const bound = (doc: (typeof KEY_DOCS)[number]) => doc.strokes.some(stroke =>
        resolveKeyAction(stroke, active) !== null || resolveShellAction(stroke) === 'abandonPending');
      return KEY_GROUP_LABELS.map(([group, label]) => ({ label, rows: KEY_DOCS
        .filter(doc => doc.group === group && bound(doc) && !(doc.requires === 'tabPane' && !tabPane) && !(doc.requires === 'notationProjection' && projection !== 'notation'))
        .map(doc => ({ keys: doc.keys, meaning: doc.meaning[level] ?? doc.meaning.all ?? '' })).filter(row => row.meaning) }))
        .filter(group => group.rows.length > 0);
    },
    dispose: () => {
      disposed = true;
      tabDigits.cancel();
      scope.removeEventListener('keydown', onKeyDown);
      scope.removeEventListener('focusin', onFocusChange);
      scope.removeEventListener('focusout', onFocusChange);
      viewer.selection = NO_SELECTION;
    }
  };
}
