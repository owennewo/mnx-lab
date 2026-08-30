// The keymap's meaning table — roadmap/complete/core-keymap-cheatsheet.md.
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
  LADDER_JUMP_LEVELS,
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
      event: 'walk this voice’s events (rests included)',
      voiceMeasure: 'walk bars',
      partMeasure: 'walk bars',
      measure: 'walk bars'
      // document: the whole document is selected — nowhere to go.
    }
  },
  {
    keys: '↑/↓',
    strokes: [{ code: 'ArrowUp' }, { code: 'ArrowDown' }],
    group: 'navigation',
    // The vertical axis coarsens as the rung widens: the staff's own space,
    // then the voice stack, then the system's staves, then the systems
    // themselves. This
    // table states what the READER gets, so the last two rows are here even
    // though the session refuses them — both are resolved by the mount (a fact
    // about the paint, and one about the host) and arrive as a resolved intent
    // or not at all. keymap-docs.test.ts names that pair, so a third cannot
    // appear unnoticed.
    meaning: {
      note: 'up/down the vertical line (string / staff position)',
      // The floor axis (core-selection-floor-axis.md): vertical at the floor
      // is note-natured — the event rung descends into its noteheads. The
      // voice jump moved to Ctrl+↑/↓ after descent (a named cost).
      event: 'descend to the event’s nearest notehead',
      voiceMeasure: 'the voice above/below in this bar',
      partMeasure: 'the staff above/below (this part’s staves, then the next part)',
      measure: 'the nearest bar in the system above/below',
      document: 'the previous/next document in the collection'
    }
  },
  {
    keys: 'Ctrl+←/→',
    strokes: [
      { code: 'ArrowLeft', ctrl: true },
      { code: 'ArrowRight', ctrl: true }
    ],
    group: 'navigation',
    // The climb: at the note rungs the bar is the first ancestor whose ←→
    // means something else; from voice-measure up the bar step is the rung's
    // OWN move, so the climb continues to the section.
    meaning: {
      note: 'bar jump (the Ctrl climb)',
      event: 'bar jump, keeping the voice',
      voiceMeasure: 'jump to the prev/next section',
      partMeasure: 'jump to the prev/next section',
      measure: 'jump to the prev/next section'
    }
  },
  {
    keys: 'Ctrl+↑/↓',
    strokes: [
      { code: 'ArrowUp', ctrl: true },
      { code: 'ArrowDown', ctrl: true }
    ],
    group: 'navigation',
    // The same climb on the vertical. Part-measure's climb reaches the SYSTEM
    // — the mount's to resolve, like the measure rung's bare ↑↓.
    meaning: {
      note: 'jump to the voice above/below (the event sounding at this beat)',
      event: 'jump to the staff above/below',
      voiceMeasure: 'jump to the staff above/below',
      partMeasure: 'jump to the system above/below'
    }
  },

  // ── Selection — the ladder walk. Escape and Enter left it in
  // core-rung-addressing.md; the ladder is Shift+arrows (relative) and
  // Shift+digits (absolute), and the two terminal keys went back to meaning
  // what they mean everywhere else.
  {
    keys: 'Shift+↑/↓',
    strokes: [
      { code: 'ArrowUp', shift: true },
      { code: 'ArrowDown', shift: true }
    ],
    group: 'selection',
    meaning: { all: 'widen / narrow the selection one rung' }
  },
  {
    keys: 'Shift+1…6',
    // The LABEL names the position, never the glyph: shifted Digit1 prints
    // `!` on QWERTY but `1` on AZERTY, where the whole digit row is shifted.
    strokes: LADDER_JUMP_LEVELS.map((_, index) => ({
      code: `Digit${index + 1}`,
      shift: true
    })),
    group: 'selection',
    meaning: {
      all: 'jump straight to a rung — 1 note, 2 event, 3 voice, 4 part, 5 bar, 6 document (a rung this score has not got refuses)'
    }
  },
  {
    keys: 'Esc',
    strokes: [{ code: 'Escape' }],
    group: 'selection',
    meaning: {
      all: 'abandon the innermost pending thing — an open popover or inspector, a half-typed fret, an armed slur/beam anchor — or deselect when there is none'
    }
  },
  {
    keys: 'Enter',
    strokes: [{ code: 'Enter' }, { code: 'NumpadEnter' }],
    group: 'selection',
    meaning: {
      all: 'commit the innermost pending thing — apply the popover, enter the fret now, complete the armed slur/beam — or, with nothing pending, open the rung inspector'
    }
  },
  {
    keys: 'Shift+←/→',
    strokes: [
      { code: 'ArrowLeft', shift: true },
      { code: 'ArrowRight', shift: true }
    ],
    group: 'selection',
    // The floor axis (core-selection-floor-axis.md): horizontal extent is
    // event-natured, so the note rung has no ranges — the first press
    // re-levels the single notehead to its own event, and extension
    // continues at the event rung.
    meaning: {
      note: 'become an event selection (the note’s own event; press again to extend)',
      event: 'extend through this voice’s events (rests included)',
      voiceMeasure: 'extend through this voice’s existing bar copies',
      partMeasure: 'extend through bars on this staff',
      measure: 'extend through global bars'
    }
  },
  {
    keys: 'Shift+End',
    strokes: [{ code: 'End', shift: true }],
    group: 'selection',
    meaning: {
      note: 'become an event range to this voice’s last event',
      event: 'extend to this voice’s last event',
      voiceMeasure: 'extend to this voice’s last existing bar copy',
      partMeasure: 'extend to the last bar on this staff',
      measure: 'extend to the last global bar'
    }
  },
  {
    keys: 'Ctrl/⌘+Shift+←/→',
    strokes: [
      { code: 'ArrowLeft', ctrl: true, shift: true },
      { code: 'ArrowRight', ctrl: true, shift: true }
    ],
    group: 'selection',
    // Select-to-word-edge with sections as the words
    // (core-selection-range-grain.md): → extends to the last bar of the
    // current section (again: through the next); ← to its first bar. With no
    // sections the boundary is the piece's ends.
    meaning: {
      voiceMeasure: 'extend to the section boundary (again: the next section)',
      partMeasure: 'extend to the section boundary (again: the next section)',
      measure: 'extend to the section boundary (again: the next section)'
    }
  },
  {
    keys: 'Ctrl/⌘+A',
    strokes: [
      { code: 'KeyA', ctrl: true },
      { code: 'KeyA', meta: true }
    ],
    group: 'selection',
    meaning: {
      note: 'select every event in this staff/voice timeline (closes at the event rung)',
      event: 'select every event in this staff/voice timeline',
      voiceMeasure: 'select every existing bar copy in this staff/voice',
      partMeasure: 'select this whole part (all staves and bars)',
      measure: 'select the global timeline',
      document: 'the whole document is already selected'
    }
  },

  // ── Note entry.
  {
    keys: '0–9',
    strokes: digitStrokes,
    group: 'entry',
    requires: 'tabPane',
    meaning: { note: 'enter a fret on the cursor’s string (digits compose for 500 ms: 1,2 → 12)' }
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
    // TWO PRESSES, ONE RULE: press 1 clears what the rung owns, press 2
    // removes the rung (core-delete-clears-then-removes.md). Removal never
    // destroys ink implicitly — it just no longer answers with silence.
    meaning: {
      note: 'delete the note under the cursor (an emptied event becomes a rest)',
      event: 'clear the event to an equal-duration rest, then remove the empty event',
      voiceMeasure: 'clear this voice’s bar copy, then remove the empty copy',
      partMeasure: 'clear this staff’s bar copy, then remove the empty copy',
      measure: 'clear this bar across every part, then remove the empty bar',
      document: 'clear the score, then remove the empty part and its trailing bars'
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
    keys: 'J',
    strokes: [{ code: 'KeyJ' }],
    group: 'editing',
    meaning: {
      all: 'respell the note enharmonically (D♯ → E♭ → …), same sound, cycles'
    }
  },
  {
    keys: '.',
    strokes: [{ code: 'Period' }, { code: 'NumpadDecimal' }],
    group: 'editing',
    meaning: {
      note: 'dot the note (cycles 0 → 1 → 2 → none); on an empty cell: the pending entry duration',
      event: 'dot the event (cycles 0 → 1 → 2 → none)'
    }
  },
  {
    keys: 'Home / End',
    strokes: [{ code: 'Home' }, { code: 'End' }],
    group: 'navigation',
    meaning: { all: 'the first / last bar of the score' }
  },
  {
    keys: 'I / Shift+I',
    strokes: [{ code: 'KeyI' }, { code: 'KeyI', shift: true }],
    group: 'editing',
    meaning: {
      all: 'insert after / before, at the rung you are addressing — a bar at the ' +
        'measure rung, a part at the score rung, a voice at the voice-bar rung ' +
        '(after only: voices have no visible order). Other rungs refuse.'
    }
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

  // ── The clipboard (core-selection-clipboard.md, stage 6). The rung types
  // the clip — copy is one meaning because the ladder already scales the
  // unit; cut spells its removal table because "remove exactly the selected
  // unit" differs per rung, and its missing document row mirrors the planner's
  // refusal (document deletion belongs to the library, not the edit session).
  {
    keys: 'Ctrl/⌘+C',
    strokes: [
      { code: 'KeyC', ctrl: true },
      { code: 'KeyC', meta: true }
    ],
    group: 'editing',
    meaning: { all: 'copy the selection as a typed clip — the rung decides the unit' }
  },
  {
    keys: 'Ctrl/⌘+X',
    strokes: [
      { code: 'KeyX', ctrl: true },
      { code: 'KeyX', meta: true }
    ],
    group: 'editing',
    meaning: {
      note: 'cut the note (an emptied event becomes a rest)',
      event: 'cut the events to equal-duration rests',
      voiceMeasure: 'cut this voice’s bar copies (absence is silence)',
      partMeasure: 'cut this staff’s bars; the part closure cuts the whole part',
      measure: 'cut the global bars — the timeline closes'
      // document: refused — deleting a document belongs to its library.
    }
  },
  {
    keys: 'Ctrl/⌘+V',
    strokes: [
      { code: 'KeyV', ctrl: true },
      { code: 'KeyV', meta: true }
    ],
    group: 'editing',
    meaning: {
      all: 'paste the copied clip at the selection — exact and conservative; a refusal names why'
    }
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
    keys: 'Alt+V',
    strokes: [{ code: 'KeyV', alt: true }],
    group: 'navigation',
    meaning: {
      all: 'step between notes sharing this beat and line (a second voice, a chord member on the same string)'
    }
  },
  {
    keys: 'B',
    strokes: [{ code: 'KeyB' }],
    group: 'adornments',
    meaning: {
      note: 'beam: arm at the first note, press again at the last (Esc drops it) — bend in the tab projection',
      // The selected-run form rode the ranges to the event rung (the floor axis).
      event: 'beam the selected event run'
    }
  },
  {
    keys: 'H',
    strokes: [{ code: 'KeyH' }],
    group: 'adornments',
    meaning: { note: 'tab: hammer-on or pull-off to the next note — the interval decides which' }
  },
  {
    keys: 'V',
    strokes: [{ code: 'KeyV' }],
    group: 'adornments',
    meaning: { note: 'tab: vibrato (toggles)' }
  },
  {
    keys: 'X',
    strokes: [{ code: 'KeyX' }],
    group: 'adornments',
    meaning: { note: 'tab: palm mute (toggles)' }
  },
  {
    keys: 'O',
    strokes: [{ code: 'KeyO' }],
    group: 'adornments',
    meaning: { note: 'tab: natural harmonic (toggles)' }
  },
  {
    keys: 'S',
    strokes: [{ code: 'KeyS' }],
    group: 'adornments',
    meaning: {
      note: 'slur: arm at this note, press again at the far note (Esc drops it) — slide in the tab projection',
      event: 'slur the selected event run'
    }
  },

  // ── Setup — the typed popovers (shell actions: a trace records the intent
  // the popover emits, never its opening).
  {
    keys: 'Shift+T',
    strokes: [{ code: 'KeyT', shift: true }],
    group: 'setup',
    meaning: { all: 'time signature… (typed popover: 4/4, 6/8; `inherit` un-declares)' }
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
    meaning: {
      all: 'part… (typed popover: a name adds one; `capo 3`/`staves 2` change it; `no <thing>` strips)'
    }
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
    keys: 'Shift+A',
    strokes: [{ code: 'KeyA', shift: true }],
    group: 'setup',
    meaning: {
      all: 'adornment… (typed popover: accent/staccato/…, a dynamic like mf, or `text …`; `no X` strips)'
    }
  },
  {
    keys: 'Shift+L',
    strokes: [{ code: 'KeyL', shift: true }],
    group: 'setup',
    meaning: {
      all: 'lyric… (typed popover: `sleep-`, `-ing`, `2: Am`, `line 2 Nederlands nl`; `no lyric` strips)'
    }
  },
  {
    keys: 'Shift+R',
    strokes: [{ code: 'KeyR', shift: true }],
    group: 'setup',
    meaning: {
      all: 'rhythm… (typed popover: `3:2`, `3 eighth in 1 quarter, no number`, `grace`, `appoggiatura`, `tremolo 2`, `space 1/4`)'
    }
  },
  {
    keys: 'Shift+B',
    strokes: [{ code: 'KeyB', shift: true }],
    group: 'setup',
    meaning: {
      all: 'bar attribute… (typed popover: barline/repeat/ending/segno/fine/jump/tempo/rehearsal/section; `no X` strips)'
    }
  },
  {
    keys: 'Shift+S',
    strokes: [{ code: 'KeyS', shift: true }],
    group: 'setup',
    meaning: {
      all: 'layout… (typed popover: `layout L1: bracket [ vn1, vn2 ]`, `score "Part A": layout L1`, `mmrest m3 x2`; `no layout 2` strips)'
    }
  },

  // ── Workbench shell.
  {
    keys: '/',
    strokes: [{ code: 'Slash' }],
    group: 'workbench',
    meaning: {
      all: 'command tray for what is selected; again widens to the `global` tab (go-to, with no editor)'
    }
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
  },
  {
    keys: 'Ctrl+Alt+B',
    strokes: [{ code: 'KeyB', ctrl: true, alt: true }],
    group: 'workbench',
    meaning: { all: 'toggle the document panel (the other pane, VS Code’s chord)' }
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
  // The rung inspector (roadmap/inprogress/workbench-rung-inspector.md):
  // Enter with nothing pending. Its pills at the bar rung fire the two
  // signatures and the measure-attribute pair; its crumbs go to a bar or a
  // part; ↑↓ walk the ladder.
  rungInspector: [
    // bar
    'setTimeSignature',
    'removeTimeSignature',
    'setKeySignature',
    'removeKeySignature',
    'setMeasureAttribute',
    'removeMeasureAttribute',
    // event
    'setEventDuration',
    'setMarking',
    'removeMarking',
    'setFermata',
    'removeFermata',
    'setPositioned',
    'removePositioned',
    'setSyllable',
    'removeSyllable',
    // note
    'setAccidentalDisplay',
    'removeAccidentalDisplay',
    'setFingering',
    'removeFingering',
    'removeStringAnnotation',
    'setStringAnnotation',
    'enterFret',
    'setTechnique',
    'toggleTechnique',
    // voice-bar and part-bar
    'setFullMeasureRest',
    'removeFullMeasureRest',
    'setMeasureRepeat',
    'removeMeasureRepeat',
    'setClef',
    'removeClef',
    'setPartDeclaration',
    'removePartDeclaration',
    // the crumbs and the ladder
    'goToMeasure',
    'setPart',
    'relaxSelection',
    'tightenSelection',
    'extendSelection',
    'nextPosition',
    'prevPosition'
  ],
  timeSignaturePopover: ['setTimeSignature', 'removeTimeSignature'],
  tuningPopover: ['setTuning'],
  partPopover: [
    'addPart',
    'setPartDeclaration',
    'removePartDeclaration',
    // Document-level support declarations (`explicit accidentals`): not an
    // element, so neither harness could see it missing — a trace did.
    'setSupport'
  ],
  // One popover per attribute, two intents each: the grammar's `inherit`
  // token emits the removal intent (campaign item 5).
  // The document's presentation layer, construct and destruct in one grammar
  // (core-layout-authoring.md). A layout is a TREE, so it has no place in the
  // music to stand at: the user supplies a 1-based slot and the whole value.
  layoutPopover: [
    'setLayout',
    'setScore',
    'addMultimeasureRest',
    'removeLayout',
    'removeScore',
    'removeMultimeasureRest'
  ],
  clefPopover: ['setClef', 'removeClef'],
  keySignaturePopover: ['setKeySignature', 'removeKeySignature'],
  lyricPopover: [
    'setSyllable',
    'removeSyllable',
    'setLyricLine',
    'removeLyricLine'
  ],
  adornmentPopover: [
    'setMarking',
    'removeMarking',
    'setFermata',
    'removeFermata',
    'setPositioned',
    'removePositioned',
    'removeStringAnnotation',
    // The accidental's DISPLAY is note-level ink like the markings beside it
    // (campaign item 6); its SPELLING is `J`, a key, because that is a
    // different question.
    'setAccidentalDisplay',
    'removeAccidentalDisplay',
    // Fingering and a shaped bend: note-level ink whose VALUE exceeds a
    // keystroke, so the typed surface carries them (campaign item 9 shipped
    // the ops; item 3's trace queue found they had no way in).
    'setFingering',
    'removeFingering',
    'toggleTechnique',
    // A shaped bend types its stops and SETS them — an upsert, not a toggle
    // (core-bend-stops.md).
    'setTechnique'
  ],
  // The rhythm declarations (campaign item 11b): the three containers share
  // one wrap verb, silence is inserted, and rest spelling is a verb rather
  // than a padding policy.
  rhythmPopover: ['wrapInContainer', 'insertSpace', 'setRestSpelling'],
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
  // The selection tray (core-selection-tray-mechanism.md) fires the registry's
  // commands through the same funnel as keys, so most of what it offers is
  // already reachable — bound to a key or owned by a popover grammar above.
  // Listed here is what the tray ADDS to reachability: the accidental's
  // display flag, which no binding and no grammar claims, so before the tray
  // the only way to set it was an AI edit or a hand-written file.
  selectionTray: [
    'setAccidentalDisplay',
    'applyPastePlan',
    'applyCutPlan',
    // The voice rung's construct half. No key: adding a voice is a structural
    // decision, and its removal twin (`Del` on an empty voice bar) is already
    // guarded rather than bound to a bare keystroke.
    'addVoiceMeasure'
  ],
  commandPalette: [
    'undo',
    'redo',
    'appendMeasure',
    'toggleTie',
    'setStaffKind'
  ],
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
