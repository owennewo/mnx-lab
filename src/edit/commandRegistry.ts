// The command registry — roadmap/inprogress/core-selection-tray-mechanism.md.
//
// One flat table of commands, each declaring where it applies (ladder rungs),
// how it draws (SMuFL glyph name), what key already fires it, whether it is
// currently ON, and what it fires. The selection tray is a pure function of
// this table plus the session; nothing else about the tray decides content.
//
// It lives in `edit/`, not the workbench, for one hard reason: the harness may
// not import shells, so a registry above the boundary could never be joined
// against the keymap in a test. Everything here is data plus pure functions
// over a narrow read surface (`SessionView`) — commands never hold a session.
//
// A registry row is the SURFACE HALF of a campaign agreement block
// (core-campaign-element-ops.md): op pair, key-or-tier, rung. The campaign
// decided those; this table is where they become something a user can see.
import type { EditorIntent } from './intents.ts';
import type { ShellAction } from './keymap.ts';
import type { SelectionLevel } from './selection.ts';
import type { Projection } from './cursor.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { MeasureAttributeKind } from './ops.ts';
import { hasSlurStartingAt, techniqueAt } from './ops.ts';
import { findNoteAddress } from '../model/noteWalk.ts';

/**
 * Where a command applies: a rung of the selection ladder, or `document` —
 * the scope above `score`, which is what the design spec called it and what
 * the tray shows as its `global` tab
 * (roadmap/proposed/core-selection-tray-global-tab.md).
 */
export type CommandScope = SelectionLevel | 'document';

/** How a command draws: a canonical SMuFL glyph name, or one of the two marks
 *  that have no single glyph and are drawn as arcs by the tray. */
export type CommandGlyph = { smufl: string } | { arc: 'slur' | 'tie' };

/**
 * What a command may fire. `intent` goes through `session.handleIntent` — the
 * one funnel — and `surface` opens an existing shell surface (a typed popover)
 * rather than reimplementing its grammar.
 */
export type CommandAction =
  | { intent: EditorIntent }
  | { surface: ShellAction };

/** The narrow read surface a command may consult. Deliberately small: every
 *  field is something the tray must know to draw a tile, and nothing here can
 *  mutate. Built by `sessionView` below. */
export interface SessionView {
  readonly doc: MnxStructure;
  readonly level: SelectionLevel;
  readonly projection: Projection;
  /** The note key under the cursor, when the cursor sits on ink. */
  readonly noteKey: string | null;
  readonly measureIndex: number;
  /** Markings on the event under the cursor (`accent`, `staccato`, …). */
  readonly markings: readonly string[];
  /** Bar attributes declared on the cursor's global measure. */
  readonly barAttributes: readonly MeasureAttributeKind[];
  /** Does the note under the cursor start a tie? */
  readonly tied: boolean;
  /** Are there strings to fret — is the tab dialect available at all? */
  readonly hasStrings: boolean;
}

export interface EditorCommand {
  id: string;
  /** Which tabs offer it. A command in no scope renders nowhere. */
  scopes: readonly CommandScope[];
  glyph: CommandGlyph;
  label: string;
  /** Display form of the key that already fires it, for the tile's chip. */
  shortcut?: string;
  tier: 'key' | 'popover';
  /** Only in this projection, when set (the tab dialect's letters). */
  projection?: Projection;
  /**
   * Is the thing already on the selection? `true` draws the tile as a remove.
   * `'mixed'` is reserved for the range selections the ladder cannot express
   * yet — nothing returns it today (see the residue ledger).
   */
  isActive?: (view: SessionView) => boolean | 'mixed';
  /**
   * What firing the tile does. **Absent means not yet wired** — the tile draws
   * unavailable and `blockedBy` says why. After the campaign's vocabulary
   * sweep this is the exception, not the rule.
   */
  action?: (view: SessionView) => CommandAction | null;
  /** Why an actionless command is not wired; the residue ledger's row id. */
  blockedBy?: string;
}

// ── The read surface ───────────────────────────────────────────────────────

/** The session shape the view needs — structural, so tests can pass a stub. */
export interface SessionLike {
  readonly doc: MnxStructure;
  readonly selectionLevel: SelectionLevel;
  readonly projection: Projection;
  readonly cursor: { measureIndex: number };
  cursorContext(): { anchorKeys: string[]; occupied: boolean };
  readonly mode?: string;
}

const BAR_ATTRIBUTE_PROBES: readonly [MeasureAttributeKind, string][] = [
  ['barline', 'barline'],
  ['repeatStart', 'repeatStart'],
  ['repeatEnd', 'repeatEnd'],
  ['ending', 'ending'],
  ['segno', 'segno'],
  ['fine', 'fine'],
  ['jump', 'jump'],
  ['tempo', 'tempos'],
  ['rehearsal', 'rehearsal'],
  ['section', 'section']
];

/** Session → the registry's read surface. The one place that knows how to
 *  find "the thing under the cursor"; commands just read the result. */
export function sessionView(session: SessionLike): SessionView {
  const doc = session.doc;
  const context = session.cursorContext();
  const noteKey = context.occupied ? (context.anchorKeys[0] ?? null) : null;
  const address = noteKey ? findNoteAddress(doc, noteKey) : null;
  const markings = address?.event.markings
    ? Object.keys(address.event.markings as Record<string, unknown>)
    : [];
  const measureIndex = session.cursor.measureIndex;
  const measure = doc.global?.measures?.[measureIndex] as Record<string, unknown> | undefined;
  const barAttributes = measure
    ? BAR_ATTRIBUTE_PROBES.filter(([, field]) => measure[field] !== undefined).map(([kind]) => kind)
    : [];
  const ties = address?.note.ties;
  return {
    doc,
    level: session.selectionLevel,
    projection: session.projection,
    noteKey,
    measureIndex,
    markings,
    barAttributes,
    tied: Array.isArray(ties) && ties.length > 0,
    hasStrings: (doc.parts ?? []).some(part => (part._x?.mnxLab?.strings?.length ?? 0) > 0)
  };
}

// ── The table ──────────────────────────────────────────────────────────────

const NOTE_EVENT: readonly CommandScope[] = ['note', 'event'];

/** A marking tile: on when the event carries it, and the same tile removes it
 *  (the design's rule — an active tile IS the remove). */
function marking(
  id: string,
  smufl: string,
  label: string,
  markingName: string
): EditorCommand {
  return {
    id,
    scopes: NOTE_EVENT,
    glyph: { smufl },
    label,
    shortcut: 'Shift+A',
    tier: 'popover',
    isActive: view => view.markings.includes(markingName),
    action: view => ({
      intent: view.markings.includes(markingName)
        ? { type: 'removeMarking', marking: markingName }
        : { type: 'setMarking', marking: markingName }
    })
  };
}

/** A dynamic tile: the part-measure's positioned family (item 8's second op
 *  pair). Activeness needs an onset-scan the view does not carry, so these
 *  stay stateless — pressing sets, and removal goes through the popover. */
function dynamic(id: string, smufl: string, label: string, value: string): EditorCommand {
  return {
    id,
    scopes: ['event'],
    glyph: { smufl },
    label,
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({
      intent: {
        type: 'setPositioned',
        attribute: { kind: 'dynamic', value: value as never }
      }
    })
  };
}

/** A bar-attribute tile: item 7's ten kinds, one verb, `no X` strips. */
function barAttribute(
  id: string,
  smufl: string,
  label: string,
  kind: MeasureAttributeKind,
  make: () => EditorIntent
): EditorCommand {
  return {
    id,
    scopes: ['measure'],
    glyph: { smufl },
    label,
    shortcut: 'Shift+B',
    tier: 'popover',
    isActive: view => view.barAttributes.includes(kind),
    action: view => ({
      intent: view.barAttributes.includes(kind)
        ? { type: 'removeMeasureAttribute', kind }
        : make()
    })
  };
}

/** A tab-technique tile (item 9): its reserved letter, tab projection only. */
function technique(
  id: string,
  smufl: string,
  label: string,
  kind: 'bend' | 'slide' | 'hammerPull' | 'vibrato' | 'palmMute' | 'harmonic',
  shortcut: string
): EditorCommand {
  const probe = kind === 'hammerPull' ? 'hammerOn' : kind;
  return {
    id,
    scopes: ['note'],
    glyph: { smufl },
    label,
    shortcut,
    tier: 'key',
    projection: 'tab',
    isActive: view =>
      view.noteKey !== null && techniqueAt(view.doc, view.noteKey, probe) !== undefined,
    action: () => ({ intent: { type: 'toggleTechnique', kind } })
  };
}

/**
 * The registry. Order is display order within a rung.
 *
 * Commands whose verbs the campaign has not built carry no `action` and a
 * `blockedBy` naming the residue row — the tray draws them unavailable, which
 * is how the ledger stays visible in the product instead of only in a doc.
 */
export const COMMANDS: readonly EditorCommand[] = [
  // ── note ────────────────────────────────────────────────────────────────
  {
    id: 'tie',
    scopes: ['note'],
    glyph: { arc: 'tie' },
    label: 'Tie to the next note',
    shortcut: 'T',
    tier: 'key',
    isActive: view => view.tied,
    action: () => ({ intent: { type: 'toggleTie' } })
  },
  // The two anchor gestures (campaign items 10/11). Both SPAN — note→note and
  // event→event — but both are armed and closed AT THE NOTE RUNG, which is
  // where `KEY_DOCS` documents their keys and where the session's guards let
  // them fire. Offering them a rung up would contradict the cheatsheet on the
  // same screen; the tray follows the docs, and the docs follow the guards.
  {
    id: 'slur',
    scopes: ['note'],
    glyph: { arc: 'slur' },
    label: 'Slur — press again at the last note',
    shortcut: 'S',
    tier: 'key',
    projection: 'notation',
    isActive: view => view.noteKey !== null && hasSlurStartingAt(view.doc, view.noteKey),
    action: () => ({ intent: { type: 'toggleSlur' } })
  },
  {
    id: 'beam',
    scopes: ['note'],
    glyph: { smufl: 'textCont8thBeamShortStem' },
    label: 'Beam — press again at the last event',
    shortcut: 'B',
    tier: 'key',
    projection: 'notation',
    action: () => ({ intent: { type: 'toggleBeam' } })
  },
  {
    id: 'accidental-display',
    scopes: ['note'],
    glyph: { smufl: 'accidentalParensLeft' },
    label: 'Force the accidental',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ intent: { type: 'setAccidentalDisplay', show: true } })
  },
  {
    id: 'respell-flat',
    scopes: ['note'],
    glyph: { smufl: 'accidentalFlat' },
    label: 'Respell flat',
    tier: 'popover',
    blockedBy: 'respell'
  },
  {
    id: 'respell-sharp',
    scopes: ['note'],
    glyph: { smufl: 'accidentalSharp' },
    label: 'Respell sharp',
    tier: 'popover',
    blockedBy: 'respell'
  },
  marking('staccato', 'articStaccatoAbove', 'Staccato', 'staccato'),
  marking('accent', 'articAccentAbove', 'Accent', 'accent'),
  marking('tenuto', 'articTenutoAbove', 'Tenuto', 'tenuto'),
  marking('strong-accent', 'articMarcatoAbove', 'Marcato', 'strongAccent'),
  marking('staccatissimo', 'articStaccatissimoAbove', 'Staccatissimo', 'staccatissimo'),
  marking('breath', 'breathMarkComma', 'Breath mark', 'breath'),
  technique('bend', 'brassBend', 'Bend', 'bend', 'B'),
  technique('slide', 'guitarShake', 'Slide', 'slide', 'S'),
  technique('hammer-pull', 'articTenutoAbove', 'Hammer-on / pull-off', 'hammerPull', 'H'),
  technique('vibrato', 'wiggleVibratoMediumFast', 'Vibrato', 'vibrato', 'V'),
  technique('palm-mute', 'pluckedDampAll', 'Palm mute', 'palmMute', 'X'),
  technique('harmonic', 'stringsHarmonic', 'Natural harmonic', 'harmonic', 'O'),
  {
    id: 'fingering',
    scopes: ['note'],
    glyph: { smufl: 'fingering1' },
    label: 'Fingering',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ surface: 'adornmentPopover' })
  },

  // ── event ───────────────────────────────────────────────────────────────
  {
    id: 'shorter',
    scopes: ['event'],
    glyph: { smufl: 'note8thUp' },
    label: 'Shorter duration',
    shortcut: '−',
    tier: 'key',
    action: () => ({ intent: { type: 'shorterDuration' } })
  },
  {
    id: 'longer',
    scopes: ['event'],
    glyph: { smufl: 'noteHalfUp' },
    label: 'Longer duration',
    shortcut: '=',
    tier: 'key',
    action: () => ({ intent: { type: 'longerDuration' } })
  },
  {
    id: 'dots',
    scopes: ['event'],
    glyph: { smufl: 'augmentationDot' },
    label: 'Dot the value',
    tier: 'popover',
    action: () => ({ intent: { type: 'toggleDots' } })
  },
  {
    id: 'tuplet',
    scopes: ['event'],
    glyph: { smufl: 'tuplet3' },
    label: 'Triplet',
    shortcut: 'Shift+R',
    tier: 'popover',
    action: () => ({ surface: 'rhythmPopover' })
  },
  {
    id: 'grace',
    scopes: ['event'],
    glyph: { smufl: 'graceNoteAcciaccaturaStemUp' },
    label: 'Grace note',
    shortcut: 'Shift+R',
    tier: 'popover',
    action: () => ({ surface: 'rhythmPopover' })
  },
  {
    id: 'tremolo',
    scopes: ['event'],
    glyph: { smufl: 'tremolo3' },
    label: 'Tremolo',
    shortcut: 'Shift+R',
    tier: 'popover',
    action: () => ({ surface: 'rhythmPopover' })
  },
  dynamic('piano', 'dynamicPiano', 'Piano', 'p'),
  dynamic('mezzo-forte', 'dynamicMF', 'Mezzo-forte', 'mf'),
  dynamic('forte', 'dynamicForte', 'Forte', 'f'),
  {
    id: 'crescendo',
    scopes: ['event'],
    glyph: { smufl: 'dynamicCrescendoHairpin' },
    label: 'Crescendo',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ surface: 'adornmentPopover' })
  },
  {
    id: 'diminuendo',
    scopes: ['event'],
    glyph: { smufl: 'dynamicDiminuendoHairpin' },
    label: 'Diminuendo',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ surface: 'adornmentPopover' })
  },
  {
    id: 'ottava',
    scopes: ['event'],
    glyph: { smufl: 'ottavaAlta' },
    label: 'Ottava alta',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ intent: { type: 'setPositioned', attribute: { kind: 'ottava', value: 1 } } })
  },
  {
    id: 'direction',
    scopes: ['event'],
    glyph: { smufl: 'textBlackNoteShortStem' },
    label: 'Direction text…',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ surface: 'adornmentPopover' })
  },
  {
    id: 'lyric',
    scopes: ['note', 'event'],
    glyph: { smufl: 'lyricsElisionNarrow' },
    label: 'Lyric syllable…',
    shortcut: 'Shift+L',
    tier: 'popover',
    action: () => ({ surface: 'lyricPopover' })
  },
  {
    id: 'fermata',
    scopes: ['event'],
    glyph: { smufl: 'fermataAbove' },
    label: 'Fermata',
    shortcut: 'Shift+A',
    tier: 'popover',
    action: () => ({ surface: 'adornmentPopover' })
  },
  {
    id: 'arpeggio',
    scopes: ['event'],
    glyph: { smufl: 'arpeggiato' },
    label: 'Arpeggio',
    tier: 'popover',
    blockedBy: 'arpeggio'
  },

  // ── voice-measure ───────────────────────────────────────────────────────
  {
    id: 'full-measure-rest',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'restWhole' },
    label: 'Full-measure rest',
    shortcut: 'Shift+B',
    tier: 'popover',
    action: () => ({ surface: 'barAttributePopover' })
  },
  {
    id: 'rest-spelling',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'restHalf' },
    label: 'Respell the rests…',
    shortcut: 'Shift+R',
    tier: 'popover',
    action: () => ({ surface: 'rhythmPopover' })
  },
  {
    id: 'space',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'restQuarter' },
    label: 'Insert space…',
    shortcut: 'Shift+R',
    tier: 'popover',
    action: () => ({ surface: 'rhythmPopover' })
  },
  {
    id: 'cycle-voice',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'arrowBlackUp' },
    label: 'Step to the next voice at this beat',
    shortcut: 'Alt+V',
    tier: 'key',
    action: () => ({ intent: { type: 'cycleSlot' } })
  },
  {
    id: 'new-voice',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'arrowBlackDown' },
    label: 'Add a voice',
    tier: 'popover',
    blockedBy: 'voice-entry'
  },

  // ── part-measure ────────────────────────────────────────────────────────
  {
    id: 'clef',
    scopes: ['partMeasure', 'measure'],
    glyph: { smufl: 'gClef' },
    label: 'Clef…',
    shortcut: 'Shift+C',
    tier: 'popover',
    action: () => ({ surface: 'clefPopover' })
  },
  {
    id: 'tuning',
    scopes: ['partMeasure'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Tuning…',
    shortcut: 'Shift+U',
    tier: 'popover',
    action: () => ({ surface: 'tuningPopover' })
  },
  {
    id: 'capo',
    scopes: ['partMeasure'],
    glyph: { smufl: 'fingering0' },
    label: 'Capo…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'transpose-part',
    scopes: ['partMeasure'],
    glyph: { smufl: 'ottava' },
    label: 'Instrument transposition',
    tier: 'popover',
    blockedBy: 'part-transposition'
  },
  {
    id: 'mute-part',
    scopes: ['partMeasure'],
    glyph: { smufl: 'pluckedDampAll' },
    label: 'Mute the part',
    tier: 'popover',
    blockedBy: 'mute'
  },

  // ── measure (the global bar) ────────────────────────────────────────────
  {
    id: 'key-signature',
    scopes: ['measure'],
    glyph: { smufl: 'accidentalSharp' },
    label: 'Key signature…',
    shortcut: 'Shift+K',
    tier: 'popover',
    action: () => ({ surface: 'keySignaturePopover' })
  },
  {
    id: 'time-signature',
    scopes: ['measure'],
    glyph: { smufl: 'timeSig4' },
    label: 'Time signature…',
    shortcut: 'Shift+T',
    tier: 'popover',
    action: () => ({ surface: 'timeSignaturePopover' })
  },
  barAttribute('repeat-start', 'repeatLeft', 'Repeat start', 'repeatStart', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'repeatStart' }
  })),
  barAttribute('repeat-end', 'repeatRight', 'Repeat end', 'repeatEnd', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'repeatEnd' }
  })),
  barAttribute('final-barline', 'barlineFinal', 'Final barline', 'barline', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'barline', type: 'final' }
  })),
  barAttribute('segno', 'segno', 'Segno', 'segno', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'segno' }
  })),
  barAttribute('coda', 'coda', 'Jump (D.S. al fine)', 'jump', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'jump', type: 'dsalfine' }
  })),
  {
    id: 'ending',
    scopes: ['measure'],
    glyph: { smufl: 'repeat2Bars' },
    label: 'Volta ending…',
    shortcut: 'Shift+B',
    tier: 'popover',
    isActive: view => view.barAttributes.includes('ending'),
    action: () => ({ surface: 'barAttributePopover' })
  },
  {
    id: 'rehearsal',
    scopes: ['measure'],
    glyph: { smufl: 'repeat1Bar' },
    label: 'Rehearsal mark…',
    shortcut: 'Shift+B',
    tier: 'popover',
    isActive: view => view.barAttributes.includes('rehearsal'),
    action: () => ({ surface: 'barAttributePopover' })
  },
  {
    id: 'tempo',
    scopes: ['measure'],
    glyph: { smufl: 'metNoteQuarterUp' },
    label: 'Tempo…',
    shortcut: 'Shift+B',
    tier: 'popover',
    isActive: view => view.barAttributes.includes('tempo'),
    action: () => ({ surface: 'barAttributePopover' })
  },
  {
    id: 'measure-repeat',
    scopes: ['measure'],
    glyph: { smufl: 'repeat1Bar' },
    label: 'Measure repeat…',
    shortcut: 'Shift+B',
    tier: 'popover',
    action: () => ({ surface: 'barAttributePopover' })
  },
  {
    id: 'delete-bar',
    scopes: ['measure'],
    glyph: { smufl: 'restWhole' },
    label: 'Delete this bar (only when empty)',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── section ─────────────────────────────────────────────────────────────
  {
    id: 'section',
    scopes: ['section', 'measure'],
    glyph: { smufl: 'segno' },
    label: 'Section label…',
    shortcut: 'Shift+B',
    tier: 'popover',
    isActive: view => view.barAttributes.includes('section'),
    action: () => ({ surface: 'barAttributePopover' })
  },
  {
    id: 'section-colour',
    scopes: ['section'],
    glyph: { smufl: 'coda' },
    label: 'Section colour',
    tier: 'popover',
    blockedBy: 'section-colour'
  },
  {
    id: 'section-range',
    scopes: ['section'],
    glyph: { smufl: 'barlineDashed' },
    label: 'Select the section’s range',
    tier: 'popover',
    blockedBy: 'closure'
  },

  // ── score ───────────────────────────────────────────────────────────────
  {
    id: 'add-part',
    scopes: ['score'],
    glyph: { smufl: 'brace' },
    label: 'Add a part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'staff-kind',
    scopes: ['score'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Staff kind: notation + tab',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'both' } })
  },
  {
    id: 'add-bar',
    scopes: ['score', 'measure'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Append a bar',
    shortcut: 'Shift+M',
    tier: 'key',
    action: () => ({ intent: { type: 'appendMeasure' } })
  },
  {
    id: 'part-name',
    scopes: ['score'],
    glyph: { smufl: 'textBlackNoteShortStem' },
    label: 'Part name…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'staves',
    scopes: ['score'],
    glyph: { smufl: 'brace' },
    label: 'Staves per part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'system-break',
    scopes: ['score'],
    glyph: { smufl: 'systemDivider' },
    label: 'System break',
    tier: 'popover',
    blockedBy: 'layout-authoring'
  },
  {
    id: 'multimeasure-rest',
    scopes: ['score'],
    glyph: { smufl: 'restHBar' },
    label: 'Multimeasure rest',
    tier: 'popover',
    blockedBy: 'layout-authoring'
  },

  // ── document — the scope above `score`, shown as the tray's `global` tab
  // (core-selection-tray-global-tab.md). These apply to the session rather
  // than to anything selected, which is exactly why they sit past the top of
  // the ladder rather than on `score`.
  //
  // Undo and redo stay AVAILABLE with an empty history on purpose: the tile
  // states say whether a verb exists, not whether it would do something this
  // instant. Ctrl+Z on a fresh document is a no-op, and the tile reads the
  // same way.
  {
    id: 'undo',
    scopes: ['document'],
    glyph: { smufl: 'arrowBlackLeft' },
    label: 'Undo',
    shortcut: 'Ctrl+Z/Y',
    tier: 'key',
    action: () => ({ intent: { type: 'undo' } })
  },
  {
    id: 'redo',
    scopes: ['document'],
    glyph: { smufl: 'arrowBlackRight' },
    label: 'Redo',
    shortcut: 'Ctrl+Z/Y',
    tier: 'key',
    action: () => ({ intent: { type: 'redo' } })
  },
  {
    id: 'doc-add-bar',
    scopes: ['document'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Append a bar',
    shortcut: 'Shift+M',
    tier: 'key',
    action: () => ({ intent: { type: 'appendMeasure' } })
  },
  {
    id: 'doc-add-part',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Add a part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'doc-time',
    scopes: ['document'],
    glyph: { smufl: 'timeSig4' },
    label: 'Time signature…',
    shortcut: 'Shift+T',
    tier: 'popover',
    action: () => ({ surface: 'timeSignaturePopover' })
  },
  {
    id: 'doc-tuning',
    scopes: ['document'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Tuning…',
    shortcut: 'Shift+U',
    tier: 'popover',
    action: () => ({ surface: 'tuningPopover' })
  },
  {
    id: 'staff-kind-both',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Staff kind — notation + tab',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'both' } })
  },
  {
    id: 'staff-kind-tab',
    scopes: ['document'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Staff kind — tab only',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'tab' } })
  },
  {
    id: 'staff-kind-notation',
    scopes: ['document'],
    glyph: { smufl: 'gClef' },
    label: 'Staff kind — notation only',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'notation' } })
  }
];

// ── Selection ──────────────────────────────────────────────────────────────

/** The commands offered in one scope, in declared order: the scope must
 *  match, and a projection-specific command only appears in its own dialect. */
export function commandsForScope(
  scope: CommandScope,
  view: SessionView
): readonly EditorCommand[] {
  return COMMANDS.filter(command => {
    if (!command.scopes.includes(scope)) return false;
    if (command.projection && command.projection !== view.projection) return false;
    return true;
  });
}

/** How a tile should draw: unavailable when the verb does not exist yet, else
 *  active/mixed from the command's own probe. */
export function commandState(
  command: EditorCommand,
  view: SessionView
): 'available' | 'active' | 'mixed' | 'unavailable' {
  if (!command.action) return 'unavailable';
  const active = command.isActive?.(view);
  if (active === 'mixed') return 'mixed';
  return active ? 'active' : 'available';
}
