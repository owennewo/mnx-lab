// The declarative keymap — roadmap/complete/editor-input-layer.md.
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
    { code: 'ArrowRight', ctrl: true, intent: { type: 'nextMeasure' } },
    { code: 'ArrowLeft', ctrl: true, intent: { type: 'prevMeasure' } },
    // Down/up the vertical axis: strings in a tab part, the note stack else.
    { code: 'ArrowDown', intent: { type: 'lineDown' } },
    { code: 'ArrowUp', intent: { type: 'lineUp' } }
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
  | 'commandPalette'
  | 'goTo';

const SHELL_BINDINGS: (KeyStroke & { action: ShellAction })[] = [
  { code: 'KeyT', shift: true, action: 'timeSignaturePopover' },
  { code: 'KeyU', shift: true, action: 'tuningPopover' },
  // The palette (survey §8.5: Ctrl+K — Dorico's Jump Bar, GP's Cmd+E) and
  // go-to (§3.8: Ctrl+G + typed grammar) are ONE widget, two entry points:
  // Ctrl+K prefills the `>` command prefix, Ctrl+G opens bare (go-to).
  { code: 'KeyK', ctrl: true, action: 'commandPalette' },
  { code: 'KeyG', ctrl: true, action: 'goTo' }
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
