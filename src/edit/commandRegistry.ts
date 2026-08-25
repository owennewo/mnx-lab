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
import type { ResolvedSelection, SelectionLevel, SelectionMember } from './selection.ts';
import type { Projection } from './cursor.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { MeasureAttributeKind } from './ops.ts';
import { eventAtAddress, hasSlurStartingAt, techniqueAt } from './ops.ts';
import { findNoteAddress } from '../model/noteWalk.ts';

/**
 * Where a command applies: a rung of the selection ladder, or `session` —
 * the scope ABOVE the top rung, shown as the tray's `global` tab
 * (roadmap/proposed/core-selection-tray-global-tab.md). It was called
 * `document` until core-document-rung.md gave that word to the top rung; the
 * two must stay distinct, because `SelectionLevel | 'document'` would silently
 * absorb the scope into the rung and leak undo/redo onto a selection.
 */
export type CommandScope = SelectionLevel | 'session';

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
  /** Concrete things the current selection resolves to, including rests and
   * empty structural members that have no overlay key. */
  readonly members: readonly SelectionMember[];
  readonly memberCount: number;
  readonly noteKeys: readonly string[];
  /** Markings on the event under the cursor (`accent`, `staccato`, …). */
  readonly markings: readonly string[];
  /** Markings per selected note/event member; used for all/none/mixed reads. */
  readonly memberMarkings: readonly (readonly string[])[];
  /** Bar attributes declared on the cursor's global measure. */
  readonly barAttributes: readonly MeasureAttributeKind[];
  readonly memberBarAttributes: readonly (readonly MeasureAttributeKind[])[];
  /** Does the note under the cursor start a tie? */
  readonly tied: boolean;
  /** Are there strings to fret — is the tab dialect available at all? */
  readonly hasStrings: boolean;
}

/**
 * What has been vouched for about ONE PLACEMENT — one command in one rung's
 * tab (roadmap/proposed/core-selection-tray-residue.md, the triage ledger).
 *
 * - `tested`  — a human clicked it and the document changed the way the label
 *               promised, on more than one member, and undo put it back. The
 *               conformance suite proves the WIRING; this is the behaviour,
 *               and like a scenario's `verified` it is a human assertion.
 * - `grouped` — it sits with its relatives (the bar rung's repeat family is
 *               one thing; key/time/clef is another).
 * - `ordered` — it sits at the right index inside that group.
 *
 * `ordered` presupposes `grouped`: an index inside a group nobody has drawn
 * is not a statement about anything.
 */
export type TriageMark = 'tested' | 'grouped' | 'ordered';

export const TRIAGE_MARKS: readonly TriageMark[] = ['tested', 'grouped', 'ordered'];

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
   * `'mixed'` means some resolved members carry it; firing applies it to all.
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
  /**
   * What has been vouched for, PER SCOPE — twelve rows appear at two rungs and
   * are different verbs there (`slur` arms an anchor at `note` and reads a
   * resolved range at `event`; `section` at the bar rung and at the section
   * rung share a label and nothing else), so a mark earned at one rung says
   * nothing about the other.
   *
   * Absent, or short of all three marks, means the tile draws PURPLE — the
   * tray's own *never seen*. Every row is in that state today, on purpose: the
   * ledger is empty and the tray is where that becomes uncomfortable.
   */
  triage?: Partial<Record<CommandScope, readonly TriageMark[]>>;
}

// ── The read surface ───────────────────────────────────────────────────────

/** The session shape the view needs — structural, so tests can pass a stub. */
export interface SessionLike {
  readonly doc: MnxStructure;
  readonly selectionLevel: SelectionLevel;
  readonly projection: Projection;
  readonly cursor: { measureIndex: number };
  readonly resolvedSelection: ResolvedSelection;
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
  const resolved = session.resolvedSelection;
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
  const members = resolved.members;
  const selectedMemberMarkings = members.flatMap(member => {
    const event = member.kind === 'note'
      ? findNoteAddress(doc, member.noteKey)?.event
      : member.kind === 'event'
        ? eventAtAddress(doc, member)
        : undefined;
    return event
      ? [event.markings ? Object.keys(event.markings as Record<string, unknown>) : []]
      : [];
  });
  const selectedMemberBarAttributes = members.flatMap(member => {
    const index = member.kind === 'measure'
      ? member.measureIndex
      : member.kind === 'section'
        ? member.start
        : undefined;
    if (index === undefined) return [];
    const selected = doc.global?.measures?.[index] as Record<string, unknown> | undefined;
    return [selected
      ? BAR_ATTRIBUTE_PROBES.filter(([, field]) => selected[field] !== undefined).map(([kind]) => kind)
      : []];
  });
  const ties = address?.note.ties;
  return {
    doc,
    level: session.selectionLevel,
    projection: session.projection,
    noteKey,
    measureIndex,
    members,
    memberCount: members.length,
    noteKeys: resolved.noteKeys,
    markings,
    memberMarkings: selectedMemberMarkings.length > 0 ? selectedMemberMarkings : [markings],
    barAttributes,
    memberBarAttributes: selectedMemberBarAttributes.length > 0
      ? selectedMemberBarAttributes
      : [barAttributes],
    tied: Array.isArray(ties) && ties.length > 0,
    hasStrings: (doc.parts ?? []).some(part => (part._x?.mnxLab?.strings?.length ?? 0) > 0)
  };
}

function memberState<T>(members: readonly (readonly T[])[], value: T): boolean | 'mixed' {
  if (members.length === 0) return false;
  const active = members.filter(values => values.includes(value)).length;
  if (active === 0) return false;
  return active === members.length ? true : 'mixed';
}

/** Short, selection-honest quantity for the tray meta line. */
export function selectionMemberSummary(view: SessionView): string {
  const noun: Record<SelectionLevel, [string, string]> = {
    note: ['note', 'notes'],
    event: ['event', 'events'],
    container: ['container', 'containers'],
    voiceMeasure: ['voice bar', 'voice bars'],
    partMeasure: ['part bar', 'part bars'],
    measure: ['bar', 'bars'],
    section: ['section', 'sections'],
    document: ['session', 'scores']
  };
  const [one, many] = noun[view.level];
  return `${view.memberCount} ${view.memberCount === 1 ? one : many}`;
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
    isActive: view => memberState(view.memberMarkings, markingName),
    action: view => ({
      intent: memberState(view.memberMarkings, markingName) === true
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
    isActive: view => memberState(view.memberBarAttributes, kind),
    action: view => ({
      intent: memberState(view.memberBarAttributes, kind) === true
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
  // event→event. The anchor form is armed and closed at the note rung; the
  // selected-run form reads an EVENT range, because the floor axis
  // (core-selection-floor-axis.md) moved ranges there — so both tiles live at
  // both rungs, and the docs/tray/guards still say the same thing.
  {
    id: 'slur',
    scopes: NOTE_EVENT,
    glyph: { arc: 'slur' },
    label: 'Slur — press again at the last note',
    shortcut: 'S',
    tier: 'key',
    projection: 'notation',
    isActive: view => {
      const start = view.noteKeys.length > 1 ? view.noteKeys[0] : view.noteKey;
      return start !== null && start !== undefined && hasSlurStartingAt(view.doc, start);
    },
    action: () => ({ intent: { type: 'toggleSlur' } })
  },
  {
    id: 'beam',
    scopes: NOTE_EVENT,
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
  // ONE tile, not the pick-flat/pick-sharp pair this table first drafted:
  // campaign item 6 made spelling a CYCLE (D♯ → E♭ → …, same sound), because
  // "the other spelling" has no single answer. A pair of tiles would promise
  // a choice the verb does not offer.
  {
    id: 'respell',
    scopes: ['note'],
    glyph: { smufl: 'accidentalEnharmonicEquals' },
    label: 'Respell enharmonically (cycles)',
    shortcut: 'J',
    tier: 'key',
    action: () => ({ intent: { type: 'respellNote' } })
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
    label: 'Dot the value (cycles 0 → 1 → 2 → none)',
    shortcut: '.',
    tier: 'key',
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
  {
    id: 'clear-event',
    scopes: ['event'],
    glyph: { smufl: 'restQuarter' },
    label: 'Clear to an equal-duration rest',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── container ───────────────────────────────────────────────────────────
  {
    id: 'container-settings',
    scopes: ['container'],
    glyph: { smufl: 'tuplet3' },
    label: 'Container settings…',
    tier: 'popover',
    blockedBy: 'container-properties'
  },
  {
    id: 'delete-container',
    scopes: ['container'],
    glyph: { smufl: 'tuplet3' },
    label: 'Delete this container (clears its notes first)',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
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
    label: 'Add a voice to this bar',
    // `I` reaches it too (core-rung-insert.md). No `Shift+I`: voices stack by
    // stem direction, not index, so there is no order for `before` to mean.
    shortcut: 'I',
    tier: 'popover',
    action: () => ({ intent: { type: 'addVoiceMeasure' } })
  },
  {
    id: 'delete-voice-bar',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'restWhole' },
    label: 'Delete this voice bar (clears its notes first)',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
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
    id: 'part-scope',
    scopes: ['partMeasure'],
    glyph: { smufl: 'brace' },
    label: 'Select the whole part',
    shortcut: 'Ctrl+A',
    tier: 'key',
    action: () => ({ intent: { type: 'closeSelection' } })
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
  {
    id: 'delete-part-bar',
    scopes: ['partMeasure'],
    glyph: { smufl: 'restWhole' },
    label: 'Delete this staff bar (clears its notes first)',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
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
    label: 'Delete this bar (clears its notes first)',
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
    action: () => ({ intent: { type: 'selectSectionRange' } })
  },
  {
    id: 'delete-section-boundary',
    scopes: ['section'],
    glyph: { smufl: 'barlineDashed' },
    label: 'Delete this section boundary',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── document ───────────────────────────────────────────────────────────────
  {
    id: 'add-part',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Add a part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'staff-kind',
    scopes: ['document'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Staff kind: notation + tab',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'both' } })
  },
  {
    // GENESIS, reached from the tray. `I` now covers the same case from the
    // keyboard at every rung below the score
    // (core-delete-clears-then-removes.md), because a bar-less document is
    // somewhere Delete can leave you and the tile was the only route out. Once
    // one bar exists, End then `I` is the append, and this tile is that act
    // reached by mouse. It lost its own key with `Shift+M`
    // (core-rung-insert.md) — an append key was a special case for a position
    // the cursor can simply travel to, and that argument still holds.
    id: 'add-bar',
    scopes: ['document', 'measure'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Append a bar at the end',
    tier: 'popover',
    action: () => ({ intent: { type: 'appendMeasure' } })
  },
  {
    id: 'insert-bar-after',
    scopes: ['measure'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Insert a bar after this one',
    shortcut: 'I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'after' } })
  },
  {
    id: 'insert-bar-before',
    scopes: ['measure'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Insert a bar before this one',
    shortcut: 'Shift+I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'before' } })
  },
  {
    id: 'insert-part-after',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Insert a part below this one',
    shortcut: 'I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'after' } })
  },
  {
    id: 'insert-part-before',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Insert a part above this one',
    shortcut: 'Shift+I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'before' } })
  },
  {
    id: 'part-name',
    scopes: ['document'],
    glyph: { smufl: 'textBlackNoteShortStem' },
    label: 'Part name…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'staves',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Staves per part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'system-break',
    scopes: ['document'],
    glyph: { smufl: 'systemDivider' },
    label: 'System break',
    tier: 'popover',
    blockedBy: 'layout-authoring'
  },
  {
    id: 'multimeasure-rest',
    scopes: ['document'],
    glyph: { smufl: 'restHBar' },
    label: 'Multimeasure rest',
    tier: 'popover',
    blockedBy: 'layout-authoring'
  },

  // ── session — the scope above the top rung, shown as the tray's `global` tab
  // (core-selection-tray-global-tab.md). These apply to the session rather
  // than to anything selected, which is exactly why they sit past the top of
  // the ladder rather than on `document`.
  //
  // Undo and redo stay AVAILABLE with an empty history on purpose: the tile
  // states say whether a verb exists, not whether it would do something this
  // instant. Ctrl+Z on a fresh document is a no-op, and the tile reads the
  // same way.
  {
    id: 'undo',
    scopes: ['session'],
    glyph: { smufl: 'arrowBlackLeft' },
    label: 'Undo',
    shortcut: 'Ctrl+Z/Y',
    tier: 'key',
    action: () => ({ intent: { type: 'undo' } })
  },
  {
    id: 'redo',
    scopes: ['session'],
    glyph: { smufl: 'arrowBlackRight' },
    label: 'Redo',
    shortcut: 'Ctrl+Z/Y',
    tier: 'key',
    action: () => ({ intent: { type: 'redo' } })
  },
  {
    // Genesis again — see `add-bar`. Keyless since `Shift+M` retired.
    id: 'doc-add-bar',
    scopes: ['session'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Append a bar at the end',
    tier: 'popover',
    action: () => ({ intent: { type: 'appendMeasure' } })
  },
  {
    id: 'doc-go-last',
    scopes: ['session'],
    glyph: { smufl: 'barlineFinal' },
    label: 'Go to the last bar',
    shortcut: 'End',
    tier: 'key',
    action: () => ({ intent: { type: 'goToEdge', edge: 'last' } })
  },
  {
    id: 'doc-go-first',
    scopes: ['session'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Go to the first bar',
    shortcut: 'Home',
    tier: 'key',
    action: () => ({ intent: { type: 'goToEdge', edge: 'first' } })
  },
  {
    id: 'doc-add-part',
    scopes: ['session'],
    glyph: { smufl: 'brace' },
    label: 'Add a part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
  },
  {
    id: 'doc-time',
    scopes: ['session'],
    glyph: { smufl: 'timeSig4' },
    label: 'Time signature…',
    shortcut: 'Shift+T',
    tier: 'popover',
    action: () => ({ surface: 'timeSignaturePopover' })
  },
  {
    id: 'doc-tuning',
    scopes: ['session'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Tuning…',
    shortcut: 'Shift+U',
    tier: 'popover',
    action: () => ({ surface: 'tuningPopover' })
  },
  {
    id: 'staff-kind-both',
    scopes: ['session'],
    glyph: { smufl: 'brace' },
    label: 'Staff kind — notation + tab',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'both' } })
  },
  {
    id: 'staff-kind-tab',
    scopes: ['session'],
    glyph: { smufl: '6stringTabClef' },
    label: 'Staff kind — tab only',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'tab' } })
  },
  {
    id: 'staff-kind-notation',
    scopes: ['session'],
    glyph: { smufl: 'gClef' },
    label: 'Staff kind — notation only',
    tier: 'popover',
    action: () => ({ intent: { type: 'setStaffKind', kind: 'notation' } })
  }
];

// ── Selection ──────────────────────────────────────────────────────────────

/**
 * A captioned band of tiles inside one rung's tab.
 *
 * Grouping is a CLAIM — that these verbs answer the same question — so it is
 * stated in one ordered table rather than as a field per row: the membership,
 * the order inside the band and the caption are the three things a reviewer
 * argues about, and they belong where they can be read together. That is also
 * exactly the `grouped` and `ordered` pair the triage ledger asks for
 * (roadmap/proposed/core-selection-tray-residue.md).
 */
export interface CommandGroup {
  id: string;
  /** The band's caption. Absent draws the band with no caption row. */
  caption?: string;
  /** Command ids, in the order they should sit inside the band. */
  commands: readonly string[];
}

/**
 * The note rung, in six bands — five of which exist today.
 *
 * Ordered concentrically, working outwards from the note: how is it WRITTEN →
 * what does it JOIN → how is it STRUCK → what do the HANDS do → what WORDS
 * ride along. A `chord` band (does it exist at all) comes first the day the
 * rung's insert verb lands — a chord is a set, so that verb has no side
 * (roadmap/complete/core-rung-insert.md) and belongs with existence rather
 * than with direction.
 *
 * Where the claims are arguable, and deliberately: `beam` is a rhythm
 * declaration rather than a spanner, and sits under `joins` for how it is
 * used — press once here, press again at the far end — not for how it is
 * modelled. `breath` is a gap after the note rather than a way of playing it.
 * `fingering` is arguably a hand verb, and opens the same popover as the
 * markings; it is under `text` because it puts characters beside the note.
 *
 * A scope with no entry here draws one uncaptioned band — the flat grid every
 * other rung has today.
 */
export const COMMAND_GROUPS: Partial<Record<CommandScope, readonly CommandGroup[]>> = {
  note: [
    { id: 'spelling', caption: 'spelling', commands: ['respell', 'accidental-display'] },
    { id: 'joins', caption: 'joins', commands: ['tie', 'slur', 'beam'] },
    {
      id: 'articulation',
      caption: 'articulation',
      commands: ['staccato', 'accent', 'tenuto', 'strong-accent', 'staccatissimo', 'breath']
    },
    {
      id: 'fingerboard',
      caption: 'fingerboard',
      commands: ['bend', 'slide', 'hammer-pull', 'vibrato', 'palm-mute', 'harmonic']
    },
    { id: 'text', caption: 'text', commands: ['fingering', 'lyric'] }
  ]
};

/** One band of commands as the tray draws it. */
export interface CommandBand {
  id: string;
  caption?: string;
  commands: readonly EditorCommand[];
}

/**
 * Partition a scope's commands into bands.
 *
 * Takes the list the tray is ALREADY going to draw — projection filtered,
 * search filtered — so a band whose every member was typed away disappears
 * caption and all, and a band that survives keeps saying which family the
 * survivor came from. That is the whole argument for captions over a gutter
 * label: filtering is when a tile most needs its context, and it is exactly
 * when a flat grid has none to give.
 *
 * Anything the table does not name lands in a trailing uncaptioned band, so a
 * new command is drawn from the day it is written; the conformance suite is
 * what stops it staying there unnoticed at a grouped rung.
 */
export function bandsForScope(
  scope: CommandScope,
  commands: readonly EditorCommand[]
): readonly CommandBand[] {
  const table = COMMAND_GROUPS[scope];
  if (!table) return commands.length > 0 ? [{ id: 'all', commands }] : [];
  const remaining = new Map(commands.map(command => [command.id, command]));
  const bands: CommandBand[] = [];
  for (const group of table) {
    const members = group.commands
      .map(id => {
        const command = remaining.get(id);
        remaining.delete(id);
        return command;
      })
      .filter((command): command is EditorCommand => command !== undefined);
    if (members.length > 0) bands.push({ id: group.id, caption: group.caption, commands: members });
  }
  const rest = commands.filter(command => remaining.has(command.id));
  if (rest.length > 0) bands.push({ id: 'ungrouped', commands: rest });
  return bands;
}

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

/**
 * Has anyone vouched for this placement — all three marks, at THIS rung?
 *
 * A blocked command is exempt rather than untriaged: its verb does not exist,
 * so asking a reviewer to click it is asking nonsense, and the tile is already
 * drawn unavailable. It enters triage purple on the day it wires.
 */
export function isTriaged(command: EditorCommand, scope: CommandScope): boolean {
  if (!command.action) return true;
  const marks = command.triage?.[scope];
  return marks !== undefined && TRIAGE_MARKS.every(mark => marks.includes(mark));
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
