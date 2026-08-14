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
    { code: 'NumpadEnter', intent: { type: 'tightenSelection' } }
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
    // Tie: `T` (Dorico/MuseScore convention; free in this scheme — the
    // technique alphabet B H S V X O doesn't claim it).
    { code: 'KeyT', intent: { type: 'toggleTie' } },
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
  name: 'tab-digits',
  bindings: Array.from({ length: 10 }, (_, digit) => [
    { code: `Digit${digit}`, intent: { type: 'fretDigit', digit } as EditorIntent },
    { code: `Numpad${digit}`, intent: { type: 'fretDigit', digit } as EditorIntent }
  ]).flat()
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
  | 'commandPalette'
  | 'goTo'
  | 'toggleRail';

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
  // The palette (survey §8.5: Ctrl+K — Dorico's Jump Bar, GP's Cmd+E) and
  // go-to (§3.8: Ctrl+G + typed grammar) are ONE widget, two entry points:
  // Ctrl+K prefills the `>` command prefix, Ctrl+G opens bare (go-to).
  { code: 'KeyK', ctrl: true, action: 'commandPalette' },
  { code: 'KeyG', ctrl: true, action: 'goTo' },
  // The library rail toggle (VS Code's Ctrl+B sidebar reflex).
  { code: 'KeyB', ctrl: true, action: 'toggleRail' }
];

export function resolveShellAction(stroke: KeyStroke): ShellAction | null {
  const hit = SHELL_BINDINGS.find(b => matches(b, stroke));
  return hit?.action ?? null;
}

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
