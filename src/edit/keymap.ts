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

/** What a binding matches on. Unlisted modifiers must be UP. */
export interface KeyStroke {
  code: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyBinding extends KeyStroke {
  intent: EditorIntent;
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
    // The selection ladder: Escape relaxes toward score (the mount turns a
    // relax past the top into the conventional deselect, so Escape's meaning
    // never changes — it just becomes gradual), Enter tightens toward note.
    // Overlays keep precedence mechanically: popovers/palette preventDefault
    // their Escape/Enter before the window listener sees them.
    { code: 'Escape', intent: { type: 'relaxSelection' } },
    { code: 'Enter', intent: { type: 'tightenSelection' } },
    { code: 'NumpadEnter', intent: { type: 'tightenSelection' } },
    // Shift+↑/↓ is the ladder's fluency alias (the `-`/`=` pattern: same
    // intents, a scrubbable pair). It completes both families: Shift+arrows
    // reshape the selection — laterally along the rung, vertically across
    // rungs (widening to the parent IS vertical extension in a containment
    // model) — and every modifier on ↑↓ now does something vertical (bare =
    // line, Ctrl = climb, Alt = transpose, Shift = rung). Polarity is the
    // ladder's own: up widens toward score, down narrows toward note.
    { code: 'ArrowUp', shift: true, intent: { type: 'relaxSelection' } },
    { code: 'ArrowDown', shift: true, intent: { type: 'tightenSelection' } }
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
    { code: 'KeyM', shift: true, intent: { type: 'appendMeasure' } },
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
 *  Consecutive digits combine into two-digit frets in the session. */
export const TAB_DIGIT_LAYER: KeymapLayer = {
  name: 'tab-pane',
  bindings: [
    ...Array.from({ length: 10 }, (_, digit) => [
      { code: `Digit${digit}`, intent: { type: 'fretDigit', digit } as EditorIntent },
      { code: `Numpad${digit}`, intent: { type: 'fretDigit', digit } as EditorIntent }
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
  | 'timeSignaturePopover'
  | 'tuningPopover'
  | 'partPopover'
  | 'clefPopover'
  | 'keySignaturePopover'
  | 'barAttributePopover'
  | 'adornmentPopover'
  | 'lyricPopover'
  | 'rhythmPopover'
  | 'selectionTray'
  | 'commandPalette'
  | 'goTo'
  | 'toggleRail'
  | 'togglePanel'
  // The clipboard verbs are shell actions, not EditorIntents, for the same
  // reason the popovers are: they cross an environment boundary. The mount
  // resolves the asynchronous store I/O first, and the trace records the
  // materialized applyCutPlan/applyPastePlan — never the keypress
  // (core-selection-clipboard.md, stage 6).
  | 'copySelection'
  | 'cutSelection'
  | 'pasteSelection';

/** Exported for the cheatsheet's join tests (keymapDocs.ts) — resolution
 *  still goes through resolveShellAction only. */
export const SHELL_BINDINGS: (KeyStroke & { action: ShellAction })[] = [
  { code: 'KeyT', shift: true, action: 'timeSignaturePopover' },
  { code: 'KeyU', shift: true, action: 'tuningPopover' },
  // Part genesis (element-ops exemplar): construct traces start from {},
  // so "add part" needs a keyboard surface — setup tier like its siblings.
  { code: 'KeyP', shift: true, action: 'partPopover' },
  // The inherited-attribute pair (campaign item 5): setup tier like their
  // siblings, and the same grammar hosts removal via the `inherit` token,
  // because Del at the measure rung already means "remove the empty bar".
  { code: 'KeyC', shift: true, action: 'clefPopover' },
  { code: 'KeyK', shift: true, action: 'keySignaturePopover' },
  // The bar-attribute family (campaign item 7): ten kinds behind one
  // popover, because they are all keys on the global measure.
  { code: 'KeyB', shift: true, action: 'barAttributePopover' },
  // Event adornments (campaign item 8): one popover for markings,
  // dynamics and directions — single-letter accelerators are a later
  // pass, since keys are the unstable layer and the ops are not.
  { code: 'KeyA', shift: true, action: 'adornmentPopover' },
  // Lyrics (campaign item 12): text entry as a popover, not a mode —
  // a syllable is one short string attached to one note.
  { code: 'KeyL', shift: true, action: 'lyricPopover' },
  // Rhythm declarations (campaign item 11b): the containers and authored
  // silence — the four things that are content but not events. No anchor
  // gesture: the typed declaration already says how much music it takes.
  { code: 'KeyR', shift: true, action: 'rhythmPopover' },
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
  // The library rail toggle (VS Code's Ctrl+B sidebar reflex).
  { code: 'KeyB', ctrl: true, action: 'toggleRail' },
  // The score panel folds the same way, and VS Code has already taught the
  // chord for the OTHER side: Ctrl+Alt+B is its secondary sidebar. Adding a
  // modifier to the pane toggle beats inventing an unrelated letter, and the
  // browser claims neither.
  { code: 'KeyB', ctrl: true, alt: true, action: 'togglePanel' }
];

export function resolveShellAction(stroke: KeyStroke): ShellAction | null {
  const hit = SHELL_BINDINGS.find(b => matches(b, stroke));
  return hit?.action ?? null;
}

/**
 * ESCAPE PRECEDENCE — the selection ladder's open question, answered here
 * because this module is the only interpreter of KeyboardEvents and the
 * answer must be stated once rather than per surface.
 *
 * **Innermost open thing first.** Escape means "back out of the thing I am
 * in", and the overlays are inside the editor, so they consume it before the
 * ladder ever sees it:
 *
 *   1. a typed popover (Shift+letter grammar) — closes, nothing applied
 *   2. the selection tray / the command palette — closes, selection intact
 *      (inside the tray, a previewed scope returns to the real one first:
 *      the preview is a thing you are in too)
 *   3. otherwise `relaxSelection` — the ladder widens one rung
 *   4. past `score` — the mount's deselect
 *
 * The rule is enforced mechanically rather than by consultation: overlays own
 * their own keydown and `preventDefault()` before the page-level listener
 * runs, so this list is a description of what the DOM already guarantees —
 * which is why the ORDER is the whole contract and no code branches on it.
 */
export const ESCAPE_PRECEDENCE = [
  'popover',
  'overlay',
  'relaxSelection',
  'deselect'
] as const;

export type EscapeConsumer = (typeof ESCAPE_PRECEDENCE)[number];

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
export function resolveIntent(stroke: KeyStroke, layers: KeymapLayer[]): EditorIntent | null {
  for (const layer of layers) {
    const hit = layer.bindings.find(b => matches(b, stroke));
    if (hit) return hit.intent;
  }
  return null;
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
