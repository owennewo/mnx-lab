// The keymap's meaning table — roadmap/inprogress/core-keymap-cheatsheet.md.
//
// The binding tables (keymap.ts) say which key fires which intent; THIS table
// says what that means at each rung of the selection ladder — the per-level
// navigation map (core-selection-ladder.md) written down as data. It feeds
// the workbench's cheatsheet and the conformance joins that keep it honest:
// every binding documented, every documented stroke bound, and the level
// guards mirrored (a rung absent here must be a no-op in the session).
//
// Meanings are STATIC per level — a map, not an enablement oracle. State-
// dependent applicability (a note under the cursor, undo history) is not
// modelled; chasing it would couple this table to every session invariant.
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  SHELL_BINDINGS,
  TAB_DIGIT_LAYER,
  type KeyStroke
} from './keymap.ts';
import type { SelectionLevel } from './selection.ts';
import type { Projection } from './cursor.ts';

/** Display groups, in cheatsheet order. */
export type KeyGroup =
  | 'navigation'
  | 'selection'
  | 'entry'
  | 'editing'
  | 'adornments'
  | 'setup'
  | 'workbench';

export const KEY_GROUP_LABELS: readonly [KeyGroup, string][] = [
  ['navigation', 'Navigation'],
  ['selection', 'Selection'],
  ['entry', 'Note entry'],
  ['editing', 'Editing'],
  ['adornments', 'Adornments'],
  ['setup', 'Setup'],
  ['workbench', 'Workbench']
];

export interface KeyDoc {
  /** Display label — physical-QWERTY keys per the keymap's `code` decision. */
  keys: string;
  /** Every stroke this row documents; joined against the binding tables. */
  strokes: KeyStroke[];
  group: KeyGroup;
  /** Meaning per rung; 'all' = level-independent. An ABSENT level means the
   *  key is inert at that rung — mirrored by the session's guards. */
  meaning: Partial<Record<SelectionLevel | 'all', string>>;
  /** Context gate beyond the level (the mount's layer/projection rules). */
  requires?: 'tabPane' | 'notationProjection';
}

const digitStrokes: KeyStroke[] = Array.from({ length: 10 }, (_, d) => [
  { code: `Digit${d}` },
  { code: `Numpad${d}` }
]).flat();

export const KEY_DOCS: KeyDoc[] = [
  // ── Navigation — bare arrows move by the rung's unit (session.moveHorizontal).
  {
    keys: '←/→',
    strokes: [{ code: 'ArrowLeft' }, { code: 'ArrowRight' }],
    group: 'navigation',
    meaning: {
      note: 'walk positions (notation: this voice’s ink, nearest pitch)',
      event: 'walk positions',
      voiceMeasure: 'walk bars',
      partMeasure: 'walk bars',
      measure: 'walk bars',
      section: 'jump between section starts'
      // score: the whole score is selected — nowhere to go.
    }
  },
  {
    keys: '↑/↓',
    strokes: [{ code: 'ArrowUp' }, { code: 'ArrowDown' }],
    group: 'navigation',
    meaning: { note: 'up/down the vertical line (string / staff position)' }
  },
  {
    keys: 'Ctrl+←/→',
    strokes: [
      { code: 'ArrowLeft', ctrl: true },
      { code: 'ArrowRight', ctrl: true }
    ],
    group: 'navigation',
    meaning: { all: 'bar jump (the Ctrl climb)' }
  },
  {
    keys: 'Ctrl+↑/↓',
    strokes: [
      { code: 'ArrowUp', ctrl: true },
      { code: 'ArrowDown', ctrl: true }
    ],
    group: 'navigation',
    // note-only — mirrored by the session's level guard (the honesty test).
    meaning: { note: 'jump to the voice above/below (the event sounding at this beat)' }
  },

  // ── Selection — the ladder walk.
  {
    keys: 'Esc',
    strokes: [{ code: 'Escape' }],
    group: 'selection',
    meaning: { all: 'widen the selection one rung (past score: deselect)' }
  },
  {
    keys: 'Enter',
    strokes: [{ code: 'Enter' }, { code: 'NumpadEnter' }],
    group: 'selection',
    meaning: { all: 'narrow the selection one rung (descends to the nearest note)' }
  },

  // ── Note entry.
  {
    keys: '0–9',
    strokes: digitStrokes,
    group: 'entry',
    requires: 'tabPane',
    meaning: { note: 'enter a fret on the cursor’s string (digits combine: 1,2 → 12)' }
  },
  {
    keys: 'Space',
    strokes: [{ code: 'Space' }],
    group: 'entry',
    requires: 'notationProjection',
    meaning: { note: 'toggle a notehead at this staff-position × beat cell' }
  },

  // ── Editing.
  {
    keys: 'Del/⌫',
    strokes: [{ code: 'Delete' }, { code: 'Backspace' }],
    group: 'editing',
    // Containers must be EMPTY to be deletable (element-ops: removal never
    // destroys ink implicitly) — hence the guards in the upper-rung meanings.
    meaning: {
      note: 'delete the note under the cursor (an emptied event becomes a rest)',
      measure: 'delete this bar — only when it holds no notes',
      score: 'delete the part (then trailing bars) — only when no notes remain'
    }
  },
  {
    keys: 'Alt+↑/↓',
    strokes: [
      { code: 'ArrowUp', alt: true },
      { code: 'ArrowDown', alt: true },
      { code: 'ArrowUp', alt: true, shift: true },
      { code: 'ArrowDown', alt: true, shift: true }
    ],
    group: 'editing',
    // Selection-scoped: the verb transposes THE SELECTION, so the rung
    // already scales it — one meaning for every level.
    meaning: { all: 'transpose the selection ±1 semitone (+Shift: octave); on a rest: nudge it' }
  },
  {
    keys: 'Alt+←/→ · −/=',
    strokes: [
      { code: 'ArrowLeft', alt: true },
      { code: 'ArrowRight', alt: true },
      { code: 'Minus' },
      { code: 'Equal' }
    ],
    group: 'editing',
    meaning: {
      note: 'shorter/longer duration (on an empty cell: the pending entry duration)',
      event: 'shorter/longer duration'
    }
  },
  {
    keys: 'Shift+M',
    strokes: [{ code: 'KeyM', shift: true }],
    group: 'editing',
    meaning: { all: 'append a bar at the end' }
  },
  {
    keys: 'Ctrl+Z/Y',
    strokes: [
      { code: 'KeyZ', ctrl: true },
      { code: 'KeyY', ctrl: true },
      { code: 'KeyZ', ctrl: true, shift: true }
    ],
    group: 'editing',
    meaning: { all: 'undo / redo' }
  },

  // ── Adornments — the tie today; the technique alphabet (B H S V X O) and
  // articulations land here as they arrive.
  {
    keys: 'T',
    strokes: [{ code: 'KeyT' }],
    group: 'adornments',
    meaning: { note: 'tie to the same pitch in the next event (toggles)' }
  },
  {
    keys: 'B',
    strokes: [{ code: 'KeyB' }],
    group: 'adornments',
    meaning: {
      note: 'beam: arm at the first note, press again at the last (Esc drops it) — bend in the tab projection'
    }
  },
  {
    keys: 'S',
    strokes: [{ code: 'KeyS' }],
    group: 'adornments',
    meaning: {
      note: 'slur: arm at this note, press again at the far note (Esc drops it) — slide in the tab projection'
    }
  },

  // ── Setup — the typed popovers (shell actions: a trace records the intent
  // the popover emits, never its opening).
  {
    keys: 'Shift+T',
    strokes: [{ code: 'KeyT', shift: true }],
    group: 'setup',
    meaning: { all: 'time signature… (typed popover)' }
  },
  {
    keys: 'Shift+U',
    strokes: [{ code: 'KeyU', shift: true }],
    group: 'setup',
    meaning: { all: 'tuning… (typed popover)' }
  },
  {
    keys: 'Shift+P',
    strokes: [{ code: 'KeyP', shift: true }],
    group: 'setup',
    meaning: { all: 'add part… (typed popover; empty input = anonymous part)' }
  },
  {
    keys: 'Shift+C',
    strokes: [{ code: 'KeyC', shift: true }],
    group: 'setup',
    meaning: { all: 'clef… (typed popover: treble/bass/alto/tenor/…; `inherit` un-declares)' }
  },
  {
    keys: 'Shift+K',
    strokes: [{ code: 'KeyK', shift: true }],
    group: 'setup',
    meaning: { all: 'key signature… (typed popover: C/Bb/-3/+2; `inherit` un-declares)' }
  },
  {
    keys: 'Shift+B',
    strokes: [{ code: 'KeyB', shift: true }],
    group: 'setup',
    meaning: {
      all: 'bar attribute… (typed popover: barline/repeat/ending/segno/fine/jump/tempo/rehearsal/section; `no X` strips)'
    }
  },

  // ── Workbench shell.
  {
    keys: 'Ctrl+K',
    strokes: [{ code: 'KeyK', ctrl: true }],
    group: 'workbench',
    meaning: { all: 'command palette' }
  },
  {
    keys: 'Ctrl+G',
    strokes: [{ code: 'KeyG', ctrl: true }],
    group: 'workbench',
    meaning: { all: 'go to (bar number · scenario · def:)' }
  },
  {
    keys: 'Ctrl+B',
    strokes: [{ code: 'KeyB', ctrl: true }],
    group: 'workbench',
    meaning: { all: 'toggle the scenario rail' }
  }
];

/**
 * Intent types produced by shell SURFACES rather than direct bindings — the
 * typed popovers, the palette, and the view switcher. The construct-trace
 * keyboard join (harness/conformance/construct-traces.test.ts) reads this
 * beside the binding tables: an intent is keyboard-reachable iff a binding
 * claims its type or a surface here emits it. Keep honest — a surface listed
 * here must really emit that intent in the workbench.
 */
export const SURFACE_INTENTS: Record<string, string[]> = {
  timeSignaturePopover: ['setTimeSignature'],
  tuningPopover: ['setTuning'],
  partPopover: ['addPart'],
  // One popover per attribute, two intents each: the grammar's `inherit`
  // token emits the removal intent (campaign item 5).
  clefPopover: ['setClef', 'removeClef'],
  keySignaturePopover: ['setKeySignature', 'removeKeySignature'],
  barAttributePopover: [
    'setMeasureAttribute',
    'removeMeasureAttribute',
    // The popover is a SURFACE, not a data-owner: it writes part-measure
    // rhythm declarations beside the global-measure keys (item 11).
    'setFullMeasureRest',
    'removeFullMeasureRest',
    'setMeasureRepeat',
    'removeMeasureRepeat'
  ],
  commandPalette: ['undo', 'redo', 'appendMeasure', 'toggleTie', 'setStaffKind'],
  goTo: ['goToMeasure'],
  // The view tabs (workbench) / view attribute (embeds): switching the pane
  // is what emits setProjection — recorded so traces replay faithfully.
  viewSwitcher: ['setProjection']
};

/** Canonical form for stroke joins (unlisted modifiers are UP, as matched). */
export function strokeKey(stroke: KeyStroke): string {
  return [
    stroke.code,
    stroke.ctrl ? 'C' : '',
    stroke.alt ? 'A' : '',
    stroke.shift ? 'S' : '',
    stroke.meta ? 'M' : ''
  ].join('');
}

/** Every stroke the binding tables (three layers + shell) claim. */
export function allBindingStrokes(): KeyStroke[] {
  return [
    ...NAVIGATION_LAYER.bindings,
    ...EDIT_LAYER.bindings,
    ...TAB_DIGIT_LAYER.bindings,
    ...SHELL_BINDINGS
  ].map(({ code, ctrl, alt, shift, meta }) => ({ code, ctrl, alt, shift, meta }));
}

// ── The cheatsheet: the table filtered to a moment ──────────────────────────

export interface CheatRow {
  keys: string;
  meaning: string;
}

export interface CheatGroup {
  label: string;
  rows: CheatRow[];
}

/**
 * What the keyboard can do RIGHT NOW: the meaning table filtered by the
 * selection level, the mount's active layers (tabPane ⇔ the digit layer) and
 * the projection. Groups arrive in display order; empty groups are dropped.
 */
export function cheatsheet(
  level: SelectionLevel,
  context: { tabPane: boolean; projection: Projection }
): CheatGroup[] {
  const groups: CheatGroup[] = [];
  for (const [group, label] of KEY_GROUP_LABELS) {
    const rows: CheatRow[] = [];
    for (const doc of KEY_DOCS) {
      if (doc.group !== group) continue;
      if (doc.requires === 'tabPane' && !context.tabPane) continue;
      if (doc.requires === 'notationProjection' && context.projection !== 'notation') continue;
      const meaning = doc.meaning[level] ?? doc.meaning.all;
      if (!meaning) continue;
      rows.push({ keys: doc.keys, meaning });
    }
    if (rows.length > 0) groups.push({ label, rows });
  }
  return groups;
}
