// The declarative keymap — roadmap/complete/core-editor-input-layer.md.
//
// Bindings are DATA, not keydown switches: rebinding a key edits this table
// and nothing else, and future emulation presets ("Like Guitar Pro") are
// alternative tables. Nothing outside this file may interpret a KeyboardEvent.
//
// DECIDED (research §6.3): bindings match `KeyboardEvent.code` — the physical
// key, which survives AZERTY/QWERTZ (an AZERTY fret entry must not require
// Shift). The cost is that mnemonic letters follow the physical QWERTY
// position rather than the printed letter; revisit only with the emulation-
// preset work, alongside Flat-style layout detection.
//
// Layer discipline (survey §6.1, adopted): DIGITS ARE OWNED BY THE PANE —
// they mean frets in a tab pane (and, later, durations in a notation pane,
// views in the review shell). The mount point picks which layers are active;
// this module only defines them. Bare arrows never mutate (survey §3.2).
import type { EditorIntent } from './intents.ts';
import { SELECTION_LADDER, type SelectionLevel } from './selection.ts';

/** The rungs Shift+1..8 address, in ladder order (narrowest first). Derived,
 *  never retyped: adding a rung to the ladder gives it a digit, and the
 *  keymap-docs join then demands a documentation row for it. */
export const LADDER_JUMP_LEVELS: readonly SelectionLevel[] = SELECTION_LADDER;

/** A physical tab digit stops at stage 1; it is deliberately not an EditorIntent. */
export type TabDigitAction = { type: 'tabDigit'; digit: number };
export type KeyAction = EditorIntent | TabDigitAction;

/** What a binding matches on. Unlisted modifiers must be UP. */
export interface KeyStroke {
  code: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyBinding extends KeyStroke {
  intent: KeyAction;
}

export interface KeymapLayer {
  name: string;
  bindings: KeyBinding[];
}

/** Cursor movement — pure sense-0, active everywhere a score is on screen. */
export const NAVIGATION_LAYER: KeymapLayer = {
  name: 'navigation',
  bindings: [
    { code: 'ArrowRight', intent: { type: 'nextPosition' } },
    { code: 'ArrowLeft', intent: { type: 'prevPosition' } },
    // Horizontal selection: Shift moves only the active edge; Shift+End
    // reaches the last concrete member. Ctrl/Meta+A is a live rung-preserving
    // closure, not a snapshot of whichever ids exist today.
    { code: 'ArrowRight', shift: true, intent: { type: 'extendSelection', direction: 'next' } },
    { code: 'ArrowLeft', shift: true, intent: { type: 'extendSelection', direction: 'previous' } },
    { code: 'End', shift: true, intent: { type: 'extendSelection', direction: 'end' } },
    // Ctrl+Shift+←/→ — select-to-word-edge with sections as the words
    // (core-selection-range-grain.md): bar rungs only, boundary then across.
    { code: 'ArrowRight', ctrl: true, shift: true, intent: { type: 'extendSelection', direction: 'sectionEnd' } },
    { code: 'ArrowLeft', ctrl: true, shift: true, intent: { type: 'extendSelection', direction: 'sectionStart' } },
    // Home / End — the timeline's ends, and the reason `Shift+M` is gone: an
    // "append" key was a special case for a position the cursor can simply go
    // to. End then `I` is the same act, spelled out of parts that already
    // exist (core-rung-insert.md).
    { code: 'Home', intent: { type: 'goToEdge', edge: 'first' } },
    { code: 'End', intent: { type: 'goToEdge', edge: 'last' } },
    { code: 'KeyA', ctrl: true, intent: { type: 'closeSelection' } },
    { code: 'KeyA', meta: true, intent: { type: 'closeSelection' } },
    // The Ctrl climb (selection-ladder navigation map): the arrow applied at
    // the nearest ancestor rung where it means something different. At note
    // level ←→ = bar jump / tab event-skip, ↑↓ = voice jump.
    { code: 'ArrowRight', ctrl: true, intent: { type: 'jumpNext' } },
    { code: 'ArrowLeft', ctrl: true, intent: { type: 'jumpPrev' } },
    { code: 'ArrowUp', ctrl: true, intent: { type: 'jumpUp' } },
    { code: 'ArrowDown', ctrl: true, intent: { type: 'jumpDown' } },
    // Down/up the vertical axis: strings in a tab part, the note stack else.
    { code: 'ArrowDown', intent: { type: 'lineDown' } },
    { code: 'ArrowUp', intent: { type: 'lineUp' } },
    // The selection ladder, RELATIVE: Shift+↑/↓ steps one rung. It completes
    // both families — Shift+arrows reshape the selection, laterally along the
    // rung and vertically across rungs (widening to the parent IS vertical
    // extension in a containment model) — and every modifier on ↑↓ does
    // something vertical (bare = line, Ctrl = climb, Alt = transpose, Shift =
    // rung). Polarity is the ladder's own: up widens toward document, down
    // narrows toward note.
    //
    // These were Escape/Enter's fluency alias until core-rung-addressing.md;
    // they are now the only relative binding. Escape and Enter left the ladder
    // because the reflex they were competing with — back out of what I am in —
    // is older and stronger than any semantic argument for widening, so
    // reaching for Escape kept moving a selection nobody asked to move. They
    // are shell actions now (see SHELL_BINDINGS): abandon and commit.
    { code: 'ArrowUp', shift: true, intent: { type: 'relaxSelection' } },
    { code: 'ArrowDown', shift: true, intent: { type: 'tightenSelection' } },
    // The selection ladder, ABSOLUTE: Shift+1..8 jumps straight to a rung,
    // in SELECTION_LADDER order — 1 = `note`, the tightest thing you can
    // select, 8 = `document`. The tray draws its column widest-first, so the
    // digits count UP it rather than down; that is why the tray PRINTS them
    // beside the rungs (core-rung-addressing.md 8) instead of leaving the
    // reader to infer a direction. Data order wins over drawn order because
    // it is the one that survives a rung being added at either end.
    //
    // Shift+digit is the last unclaimed global tier: Ctrl/⌘+digit and Alt+digit
    // are browser tab selection and are NOT preventable, Alt+letter reaches the
    // menu accelerators, Ctrl+letter is claimed across most of the alphabet,
    // and the bare letters are spent on the technique and adornment dialects.
    // The `code` discipline makes the STROKE layout-proof; the label must name
    // the position ("Shift+1"), never the glyph — shifted Digit1 prints `!` on
    // QWERTY but `1` on AZERTY, where the digit row is shifted throughout.
    ...LADDER_JUMP_LEVELS.map((level, index) => ({
      code: `Digit${index + 1}`,
      shift: true,
      intent: { type: 'goToLevel', level } as EditorIntent
    }))
  ]
};

/** Mutating intents that aren't pane-specific, plus history. */
export const EDIT_LAYER: KeymapLayer = {
  name: 'edit',
  bindings: [
    // Alt+arrows re-pitch (Dorico's modifier discipline: bare arrows never do).
    { code: 'ArrowUp', alt: true, intent: { type: 'transpose', semitones: 1 } },
    { code: 'ArrowDown', alt: true, intent: { type: 'transpose', semitones: -1 } },
    { code: 'ArrowUp', alt: true, shift: true, intent: { type: 'transpose', semitones: 12 } },
    { code: 'ArrowDown', alt: true, shift: true, intent: { type: 'transpose', semitones: -12 } },
    // Insert at the rung (core-rung-insert.md): `Del` is already "remove at
    // this rung", so `I` is its construct twin, with the SIDE as a modifier
    // rather than a second key to learn. Rung-generic by construction.
    { code: 'KeyI', intent: { type: 'insertAtRung', side: 'after' } },
    { code: 'KeyI', shift: true, intent: { type: 'insertAtRung', side: 'before' } },
    { code: 'Delete', intent: { type: 'delete' } },
    { code: 'Backspace', intent: { type: 'delete' } },
    // Duration: Alt+←→ is the primary binding (survey §8.5 — Alt means
    // change, ←→ is the time axis); `-`/`=` is the fluency alias, Dorico's
    // polarity, spatially consistent with the arrows.
    { code: 'ArrowLeft', alt: true, intent: { type: 'shorterDuration' } },
    { code: 'ArrowRight', alt: true, intent: { type: 'longerDuration' } },
    { code: 'Minus', intent: { type: 'shorterDuration' } },
    { code: 'Equal', intent: { type: 'longerDuration' } },
    // The dot (campaign item 4): `.` beside the ladder it modifies, and the
    // key every notation editor already uses. Cycles 0 → 1 → 2 → none, so one
    // key both adds and removes.
    { code: 'Period', intent: { type: 'toggleDots' } },
    { code: 'NumpadDecimal', intent: { type: 'toggleDots' } },
    // Tie: `T` (Dorico/MuseScore convention; free in this scheme — the
    // technique alphabet B H S V X O doesn't claim it).
    // The coincidence discriminator (core-note-address.md move 2). Alt, not a
    // bare letter: it is a NAVIGATION step, and the bare letters belong to the
    // adornment/technique dialects in both panes.
    { code: 'KeyV', alt: true, intent: { type: 'cycleSlot' } },
    { code: 'KeyT', intent: { type: 'toggleTie' } },
    // Respell (campaign item 6): `J`, the spelling key MuseScore and Dorico
    // both use. Cycles, because "the other spelling" has no single answer.
    { code: 'KeyJ', intent: { type: 'respellNote' } },
    // Spanners (campaign item 10). `S` is ONE key with two meanings, chosen by
    // the active projection — slur in notation, slide in tab (item 9's
    // reserved letter) — which is the ladder's decided principle that the
    // active projection picks the input dialect, applied to a letter.
    { code: 'KeyS', intent: { type: 'toggleSlur' } },
    // Beams (campaign item 11) reuse item 10's anchor and its resolution:
    // `B` beams in notation, bends in tab.
    { code: 'KeyB', intent: { type: 'toggleBeam' } },
    // The notation projection's entry action: toggle a notehead at the
    // cursor's (staff position × beat) cell. Binding provisional — Space is
    // the play/pause convention elsewhere; the ladder review owns the call.
    { code: 'Space', intent: { type: 'toggleNote' } },
    { code: 'KeyZ', ctrl: true, intent: { type: 'undo' } },
    { code: 'KeyY', ctrl: true, intent: { type: 'redo' } },
    { code: 'KeyZ', ctrl: true, shift: true, intent: { type: 'redo' } }
  ]
};

/** The tab pane's digit layer: digits are frets (survey §3.4, unanimous).
 *  These raw actions compose into enterFret at the workbench mount. */
export const TAB_DIGIT_LAYER: KeymapLayer = {
  name: 'tab-pane',
  bindings: [
    ...Array.from({ length: 10 }, (_, digit) => [
      { code: `Digit${digit}`, intent: { type: 'tabDigit', digit } as TabDigitAction },
      { code: `Numpad${digit}`, intent: { type: 'tabDigit', digit } as TabDigitAction }
    ]).flat(),
    // Tab technique (campaign item 9): the reserved letters live ONLY in this
    // pane layer, which is what makes `B` and `S` polymorphic without a
    // conditional anywhere — pane layers resolve before the shared ones, so in
    // tab they bend and slide, and in notation the same keys beam and slur.
    { code: 'KeyB', intent: { type: 'toggleTechnique', kind: 'bend' } as EditorIntent },
    { code: 'KeyH', intent: { type: 'toggleTechnique', kind: 'hammerPull' } as EditorIntent },
    { code: 'KeyS', intent: { type: 'toggleTechnique', kind: 'slide' } as EditorIntent },
    { code: 'KeyV', intent: { type: 'toggleTechnique', kind: 'vibrato' } as EditorIntent },
    { code: 'KeyX', intent: { type: 'toggleTechnique', kind: 'palmMute' } as EditorIntent },
    { code: 'KeyO', intent: { type: 'toggleTechnique', kind: 'harmonic' } as EditorIntent }
  ]
};

/**
 * Shell actions: keys that open UI (the setup popovers) rather than mutate.
 * They are NOT EditorIntents — a trace records the setTimeSignature/setTuning
 * intent the popover eventually emits, never the popover opening. They live
 * here because this module is the ONLY interpreter of KeyboardEvents.
 * Shift+letter is the popover tier (survey §6.2, Dorico's discipline).
 */
export type ShellAction =
  | 'lyricPopover'
  | 'layoutPopover'
  | 'selectionTray'
  | 'commandPalette'
  | 'goTo'
  | 'toggleRail'
  | 'togglePanel'
  | 'toggleDocumentFocus'
  // The clipboard verbs are shell actions, not EditorIntents, for the same
  // reason the popovers are: they cross an environment boundary. The mount
  // resolves the asynchronous store I/O first, and the trace records the
  // materialized applyCutPlan/applyPastePlan — never the keypress
  // (core-selection-clipboard.md, stage 6).
  | 'copySelection'
  | 'cutSelection'
  | 'pasteSelection'
  // Escape and Enter (core-rung-addressing.md). Shell actions for the same
  // reason the clipboard verbs are: abandoning or committing the innermost
  // pending thing has to consult the MOUNT-owned fret resolver, then session
  // state, then fall through to deselect — which is view chrome, not session
  // history. No single layer below the mount can see all three, so the mount
  // arbitrates and dispatches the RESOLVED intent downward.
  | 'abandonPending'
  | 'commitPending';

/** Exported for the cheatsheet's join tests (keymapDocs.ts) — resolution
 *  still goes through resolveShellAction only. */
export const SHELL_BINDINGS: (KeyStroke & { action: ShellAction })[] = [
  // Lyrics (campaign item 12): text entry as a popover, not a mode —
  // a syllable is one short string attached to one note.
  { code: 'KeyL', shift: true, action: 'lyricPopover' },
  // Shift+S — the document's presentation layer (core-layout-authoring.md).
  // S for score/system; the plain S is the slur/slide anchor, one layer down.
  { code: 'KeyS', shift: true, action: 'layoutPopover' },
  // `/` opens a command surface — the selection tray when an editor holds the
  // keyboard, the palette's go-to when none does. Slash rather than Ctrl+K on
  // two grounds. It is the surface used most while editing, so it should cost
  // no modifier; and Ctrl+K is the browser's own (Chrome sends it to the
  // omnibox), which a page can only take back by consuming the event — and we
  // deliberately do NOT consume keys typed into text fields, so Ctrl+K worked
  // from the score and escaped to Google from every input. A key that works
  // most of the time teaches that it cannot be trusted.
  //
  // Slash was the rail filter's; that job moves to Ctrl+G, which already
  // matches scenarios through the same `matchesQuery` and can also reach bars
  // and objects. So `/` keeps meaning "search or command" — the mechanism
  // just changes from narrowing a list to picking from one.
  { code: 'Slash', action: 'selectionTray' },
  // Go-to (survey §3.8: typed grammar over scenarios, bars and objects) is
  // the DESTINATION surface — the counterpart to `/`, which is the command
  // one. Its `>` prefix still reaches the global command list, so the list
  // has two doors and neither needs a chord of its own: the tray's `global`
  // tab while editing, `>` here otherwise
  // (core-selection-tray-global-tab.md, which retired Ctrl+Shift+K).
  { code: 'KeyG', ctrl: true, action: 'goTo' },
  // Ctrl AND Meta, like Ctrl/⌘+A above: the one clipboard convention every
  // platform shares. Outside a text field the browser claims none of the
  // three (text fields keep native copy/paste — they win via the focus
  // scope's innermost test before any binding resolves).
  { code: 'KeyC', ctrl: true, action: 'copySelection' },
  { code: 'KeyC', meta: true, action: 'copySelection' },
  { code: 'KeyX', ctrl: true, action: 'cutSelection' },
  { code: 'KeyX', meta: true, action: 'cutSelection' },
  { code: 'KeyV', ctrl: true, action: 'pasteSelection' },
  { code: 'KeyV', meta: true, action: 'pasteSelection' },
  // Escape and Enter, the pending-gesture pair. They are bound HERE rather
  // than in the navigation layer because they no longer name one behaviour:
  // what they do depends on what is open or half-typed at the moment they are
  // pressed. See PENDING_PRECEDENCE below for the whole contract.
  { code: 'Escape', action: 'abandonPending' },
  { code: 'Enter', action: 'commitPending' },
  { code: 'NumpadEnter', action: 'commitPending' },
  // The library rail toggle (VS Code's Ctrl+B sidebar reflex).
  { code: 'KeyB', ctrl: true, action: 'toggleRail' },
  // The document panel folds the same way, and VS Code has already taught the
  // chord for the OTHER side: Ctrl+Alt+B is its secondary sidebar. Adding a
  // modifier to the pane toggle beats inventing an unrelated letter, and the
  // browser claims neither.
  { code: 'KeyB', ctrl: true, alt: true, action: 'togglePanel' },
  // Workbench document focus: hide the shell around the document without
  // claiming F11, which remains the browser/OS fullscreen shortcut.
  { code: 'KeyF', ctrl: true, alt: true, action: 'toggleDocumentFocus' }
];

export function resolveShellAction(stroke: KeyStroke): ShellAction | null {
  const hit = SHELL_BINDINGS.find(b => matches(b, stroke));
  return hit?.action ?? null;
}

/**
 * THE PENDING-GESTURE CONTRACT — stated here because this module is the only
 * interpreter of KeyboardEvents, and because the answer must be given once
 * rather than per surface.
 *
 *   **Escape abandons the innermost pending thing. Enter commits it.**
 *
 * A "pending thing" is a gesture the user has begun and not finished, which
 * lives outside the document until it is: an open overlay, a half-typed fret,
 * an armed spanner anchor. They nest, so the pair walks them innermost-first:
 *
 *   1. a typed popover (Shift+letter grammar) — Escape closes it applying
 *      nothing; Enter applies it. Both are the overlay's own.
 *   2. the selection tray / the command palette — same, and inside the tray a
 *      previewed rung returns to the real one first: the preview is a thing
 *      you are in too.
 *   3. a pending fret digit (TabDigitResolver) — Escape drops it without
 *      touching the document; Enter commits it now rather than waiting out
 *      ENTRY_DIGIT_WINDOW_MS.
 *   4. an armed spanner anchor — Escape drops it; Enter completes the spanner
 *      of the kind that armed it.
 *   5. nothing pending — Escape deselects; Enter is free (the note-rung input
 *      job the session already reserves).
 *
 * Levels 1–2 are enforced mechanically rather than by consultation: overlays
 * own their own keydown and `preventDefault()` before the page-level listener
 * runs, so those two are a description of what the DOM already guarantees.
 * Levels 3–5 are the mount's cascade, in this order.
 *
 * WHAT CHANGED, and why it is worth the churn (core-rung-addressing.md):
 * Escape used to relax the selection one rung at step 3, and Enter used to
 * tighten it. That competed with the reflex Escape has everywhere else — back
 * out of what I am in — and the reflex won every time, so reaching for Escape
 * moved a selection nobody had asked to move. Adding Shift+↑/↓ as a fluency
 * alias in 2026-08 fixed the FEEL of bouncing between rungs and left the
 * misfire untouched, because a better key does not stop a worse one firing.
 * The ladder now owns Shift+↑/↓ (relative) and Shift+1..8 (absolute), and
 * Escape and Enter are back to meaning what they mean everywhere else.
 */
export const PENDING_PRECEDENCE = [
  'popover',
  'overlay',
  'pendingFret',
  'selection'
] as const;

export type PendingConsumer = (typeof PENDING_PRECEDENCE)[number];

function matches(binding: KeyStroke, stroke: KeyStroke): boolean {
  return (
    binding.code === stroke.code &&
    (binding.ctrl ?? false) === (stroke.ctrl ?? false) &&
    (binding.alt ?? false) === (stroke.alt ?? false) &&
    (binding.shift ?? false) === (stroke.shift ?? false) &&
    (binding.meta ?? false) === (stroke.meta ?? false)
  );
}

/** First match wins, layers in the order given (pane layers before shared). */
export function resolveKeyAction(stroke: KeyStroke, layers: KeymapLayer[]): KeyAction | null {
  for (const layer of layers) {
    const hit = layer.bindings.find(b => matches(b, stroke));
    if (hit) return hit.intent;
  }
  return null;
}

/** Resolve only deterministic session intents; raw tab digits end at stage 1. */
export function resolveIntent(stroke: KeyStroke, layers: KeymapLayer[]): EditorIntent | null {
  const action = resolveKeyAction(stroke, layers);
  return action?.type === 'tabDigit' ? null : action;
}

/** The KeyStroke of a DOM KeyboardEvent (typed structurally so this module
 *  stays importable — and testable — without DOM lib types). */
export function strokeOf(event: {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}): KeyStroke {
  return {
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  };
}
