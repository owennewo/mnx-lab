// The command registry — roadmap/inprogress/core-selection-tray-mechanism.md.
//
// One flat table of commands, each declaring where it applies (ladder rungs),
// how it draws (a SMuFL mark, optionally with an operator composed onto it —
// see `CommandOperator`), what key already fires it, whether it is
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
import type {
  ContainerCoincidence,
  ResolvedSelection,
  SelectionLevel,
  SelectionMember
} from './selection.ts';
import { containerCoincidence } from './selection.ts';
import { spannersUnderSelection, type SpannerCoincidence } from './spannerCoincidence.ts';
import type { Projection } from './cursor.ts';
import type { MnxGlobalMeasure, MnxStructure } from '../model/mnx.ts';
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

/** The picture itself: a canonical SMuFL glyph name, or one of the two marks
 *  that have no single glyph and are drawn as arcs by the tray. */
export type CommandMark = { smufl: string } | { arc: 'slur' | 'tie' };

/**
 * An operator composed onto a mark, so the PICTURE carries the verb.
 *
 * Insert-before and insert-after used to draw the identical glyph at every
 * rung that offers them — two tiles, one picture, told apart only by the
 * shortcut badge sitting on top of the picture. And `restWhole` meant three
 * different things at once (full-measure rest, delete bar, delete part),
 * because a removal had nothing to draw but the hole it leaves.
 *
 * The rule: the MARK names the object, the OPERATOR names what happens to it.
 * `+` is an insertion and sits where the new thing lands; `−` is a removal and
 * leads. That frees `restWhole`/`restQuarter` to mean a rest again — the only
 * tile that still draws one bare is `clear-event`, which literally makes one.
 *
 * `at` is a DIRECTION, not a corner: it follows whichever axis the rung is
 * ordered in. Events and bars run before/after in time, so the operator sits
 * left or right; parts run above/below on the page, and the registry has
 * always said so in its labels, so there it stacks.
 */
export interface CommandOperator {
  sign: 'plus' | 'minus';
  at: 'before' | 'after' | 'above' | 'below';
}

/** How a command draws: a bare mark, or a mark with an operator composed onto
 *  it. Bare is still the common case — most tiles name a marking, not a verb. */
export type CommandGlyph = CommandMark | { mark: CommandMark; op: CommandOperator };

/** The mark inside a glyph, composed or not — the one place that unwraps it,
 *  so callers that care about the SMuFL name never have to know the shape. */
export const glyphMark = (glyph: CommandGlyph): CommandMark =>
  'mark' in glyph ? glyph.mark : glyph;

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
  /** Exact end-barline styles, kept separate because several tiles share the
   *  one `barline` attribute kind. */
  readonly barlineTypes: readonly BarlineType[];
  readonly memberBarlineTypes: readonly (readonly BarlineType[])[];
  /** Does the note under the cursor start a tie? */
  readonly tied: boolean;
  /** Are there strings to fret — is the tab dialect available at all? */
  readonly hasStrings: boolean;
  /** The coincidence probe (core-selection-range-grain.md): which whole
   *  rhythm containers the resolved event range covers, and whether it cuts
   *  through one — the tray's channel for offering container properties on
   *  the range that IS the container, and for the honest partial hint. */
  readonly containerCoincidence: ContainerCoincidence;
  /** The spanner half (core-selection-range-grain.md decision 5): slurs and
   *  beams the resolved range touches, whole or partial — the tray's channel
   *  for the range-IS-the-spanner offer and the honest partial hint. */
  readonly spannerCoincidence: SpannerCoincidence;
}

type BarlineType = NonNullable<NonNullable<MnxGlobalMeasure['barline']>['type']>;

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
  /**
   * The tile's NAME, and only its name: verb plus object, no articles, no
   * "this one", no parenthetical.
   *
   * It has to work in three places at once — the hover tooltip, the readout
   * line the keyboard cursor writes into, and the string the scoped search
   * matches on — and the readout is ONE line. Labels that explained themselves
   * ("Delete this bar (clears its notes first)") were really a name and a
   * footnote sharing a field, and the footnote is what pushed the name off the
   * end of the line. Anything that is not the name belongs in `detail`.
   */
  label: string;
  /**
   * The footnote: what the name cannot say and a user would be wrong without.
   * Two kinds earn it — a verb that does something other than what it says the
   * first time (Del clears before it removes, core-delete-clears-then-removes.md)
   * and an interaction with a second step (slur and beam are press-again).
   *
   * Drawn under the name in the tooltip, where there is room, and searched
   * alongside it so nothing became unfindable by being demoted. Deliberately
   * NOT in the readout line: that line has one line to say which tile the
   * cursor is on, and a footnote there would crowd out the name again.
   */
  detail?: string;
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
  const barlineType = doc.global?.measures?.[measureIndex]?.barline?.type;
  const barlineTypes = barlineType ? [barlineType] : [];
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
    const index = member.kind === 'measure' ? member.measureIndex : undefined;
    if (index === undefined) return [];
    const selected = doc.global?.measures?.[index] as Record<string, unknown> | undefined;
    return [selected
      ? BAR_ATTRIBUTE_PROBES.filter(([, field]) => selected[field] !== undefined).map(([kind]) => kind)
      : []];
  });
  const selectedMemberBarlineTypes = members.flatMap(member => {
    const index = member.kind === 'measure' ? member.measureIndex : undefined;
    if (index === undefined) return [];
    const type = doc.global?.measures?.[index]?.barline?.type;
    return [type ? [type] : []];
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
    barlineTypes,
    memberBarlineTypes: selectedMemberBarlineTypes.length > 0
      ? selectedMemberBarlineTypes
      : [barlineTypes],
    tied: Array.isArray(ties) && ties.length > 0,
    hasStrings: (doc.parts ?? []).some(part => (part._x?.mnxLab?.strings?.length ?? 0) > 0),
    containerCoincidence: containerCoincidence(doc, members),
    spannerCoincidence: spannersUnderSelection(doc, members)
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
    voiceMeasure: ['voice bar', 'voice bars'],
    partMeasure: ['part bar', 'part bars'],
    measure: ['bar', 'bars'],
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
    tier: 'popover',
    isActive: view => memberState(view.memberBarAttributes, kind),
    action: view => ({
      intent: memberState(view.memberBarAttributes, kind) === true
        ? { type: 'removeMeasureAttribute', kind }
        : make()
    })
  };
}

/** A style-specific barline tile. Barline styles share one attribute kind,
 *  so kind-only state would make every style look active at once. */
function barlineStyle(
  id: string,
  smufl: string,
  label: string,
  type: BarlineType
): EditorCommand {
  return {
    id,
    scopes: ['measure'],
    glyph: { smufl },
    label,
    tier: 'popover',
    isActive: view => memberState(view.memberBarlineTypes, type),
    action: view => ({
      intent: memberState(view.memberBarlineTypes, type) === true
        ? { type: 'removeMeasureAttribute', kind: 'barline' }
        : { type: 'setMeasureAttribute', attribute: { kind: 'barline', type } }
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
  return {
    id,
    scopes: ['note'],
    glyph: { smufl },
    label,
    shortcut,
    tier: 'key',
    projection: 'tab',
    isActive: view =>
      view.noteKey !== null && techniqueAt(view.doc, view.noteKey, kind) !== undefined,
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
    label: 'Tie to next note',
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
    label: 'Slur',
    detail: 'To the next note; at a slur’s end, extends it',
    shortcut: 'S',
    tier: 'key',
    projection: 'notation',
    isActive: view => {
      // A range wholly covering a slur IS that slur (the coincidence rule).
      if (view.spannerCoincidence.slurs.some(hit => hit.coverage === 'whole')) return true;
      const start = view.noteKeys.length > 1 ? view.noteKeys[0] : view.noteKey;
      return start !== null && start !== undefined && hasSlurStartingAt(view.doc, start);
    },
    action: () => ({ intent: { type: 'toggleSlur' } })
  },
  {
    id: 'beam',
    scopes: NOTE_EVENT,
    glyph: { smufl: 'textCont8thBeamShortStem' },
    label: 'Beam',
    detail: 'To the next note; at a beam’s end, extends it',
    shortcut: 'B',
    tier: 'key',
    projection: 'notation',
    isActive: view => view.spannerCoincidence.beams.some(hit => hit.coverage === 'whole'),
    action: () => ({ intent: { type: 'toggleBeam' } })
  },
  {
    id: 'accidental-display',
    scopes: ['note'],
    glyph: { smufl: 'accidentalParensLeft' },
    label: 'Force accidental',
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
    label: 'Respell enharmonically',
    detail: 'Cycles',
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
    detail: 'Cycles 0 → 1 → 2 → none',
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
    id: 'ottava',
    scopes: ['event'],
    glyph: { smufl: 'ottavaAlta' },
    label: 'Ottava alta',
    tier: 'popover',
    action: () => ({ intent: { type: 'setPositioned', attribute: { kind: 'ottava', value: 1 } } })
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
    id: 'arpeggio',
    scopes: ['event'],
    glyph: { smufl: 'arpeggiato' },
    label: 'Arpeggio',
    tier: 'popover',
    blockedBy: 'arpeggio'
  },
  {
    // `I`/`Shift+I` have inserted an event since core-rung-insert.md, at the
    // note rung as well as the event one — the rung names the SIZE of what
    // you insert, and a note-sized thing in a voice is an event — but neither
    // had a tile, so the verb existed only for readers who already knew the
    // key. Banding the structure verbs is what made the hole visible.
    //
    // The LABEL says "note" even though the id and the intent say event, and
    // that is a deliberate trade rather than drift. "Event" is the accurate
    // word and the useless one: it is the model's term for a slot, and the
    // tile is mostly read at the note rung, where the thing you are about to
    // get is a note. The accuracy is kept where accuracy is load-bearing —
    // the id, the intent, the op — and spent where it only confused.
    id: 'insert-event-before',
    scopes: ['note', 'event'],
    glyph: { mark: { smufl: 'noteQuarterUp' }, op: { sign: 'plus', at: 'before' } },
    label: 'Insert note before',
    shortcut: 'Shift+I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'before' } })
  },
  {
    id: 'insert-event-after',
    scopes: ['note', 'event'],
    glyph: { mark: { smufl: 'noteQuarterUp' }, op: { sign: 'plus', at: 'after' } },
    label: 'Insert note after',
    shortcut: 'I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'after' } })
  },
  {
    // The note rung's Del had no tile either: every other rung's removal is
    // drawn and this one was not, which is the sort of gap a flat grid hides
    // and a captioned band cannot.
    id: 'delete-note',
    scopes: ['note'],
    glyph: { mark: { smufl: 'noteQuarterUp' }, op: { sign: 'minus', at: 'before' } },
    label: 'Delete note',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },
  {
    // The one tile that still draws a bare rest, and the reason the removals
    // stopped: this verb does not remove anything, it MAKES a rest. Now that
    // `delete-note` composes over a note, the rest glyph means only this.
    id: 'clear-event',
    scopes: ['event'],
    glyph: { smufl: 'restQuarter' },
    label: 'Clear to rest',
    detail: 'Keeps the event’s duration',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── containers (the coincidence rule, core-selection-range-grain.md) ─────
  {
    // A container is coextensive with the event range covering its children,
    // so its properties are offered THERE — no rung of its own.
    id: 'container-settings',
    scopes: ['event'],
    glyph: { smufl: 'tuplet3' },
    label: 'Container settings…',
    detail: 'For a range covering a whole tuplet, grace group or tremolo',
    tier: 'popover',
    blockedBy: 'container-properties'
  },

  // ── voice-measure ───────────────────────────────────────────────────────
  {
    id: 'rest-spelling',
    scopes: ['voiceMeasure'],
    glyph: { smufl: 'restHalf' },
    label: 'Respell rests…',
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
    label: 'Step to next voice',
    detail: 'At this beat',
    shortcut: 'Alt+V',
    tier: 'key',
    action: () => ({ intent: { type: 'cycleSlot' } })
  },
  {
    id: 'new-voice',
    // THE PART RUNG CARRIES IT TOO, and must: `voiceMeasure` is present only
    // when the staff's bar ALREADY HAS a voice (`presentLevels` asks for a
    // sequence), so scoping the verb that CREATES one to that rung alone made
    // it unreachable in the only state that needs it — empty the staff's bar
    // and the tile vanished with the voice it would have rebuilt. The rung
    // above is where you stand when there is nothing below, so that is where
    // the construct verb has to be offered.
    scopes: ['voiceMeasure', 'partMeasure'],
    glyph: { smufl: 'arrowBlackDown' },
    label: 'Add voice',
    // `I` reaches it too (core-rung-insert.md), at both rungs. No `Shift+I`:
    // voices stack by stem direction, not index, so there is no order for
    // `before` to mean.
    shortcut: 'I',
    tier: 'popover',
    action: () => ({ intent: { type: 'addVoiceMeasure' } })
  },
  {
    id: 'delete-voice-bar',
    scopes: ['voiceMeasure'],
    glyph: { mark: { smufl: 'restWhole' }, op: { sign: 'minus', at: 'before' } },
    label: 'Delete voice bar',
    detail: 'Clears its notes first',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── part-measure ────────────────────────────────────────────────────────
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
    label: 'Select part',
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
    label: 'Mute part',
    tier: 'popover',
    blockedBy: 'mute'
  },
  {
    id: 'delete-part-bar',
    scopes: ['partMeasure'],
    glyph: { mark: { smufl: 'restWhole' }, op: { sign: 'minus', at: 'before' } },
    label: 'Delete part bar',
    detail: 'Clears its notes first',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── measure (the global bar) ────────────────────────────────────────────
  barAttribute('repeat-start', 'repeatLeft', 'Repeat start', 'repeatStart', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'repeatStart' }
  })),
  barAttribute('repeat-end', 'repeatRight', 'Repeat end', 'repeatEnd', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'repeatEnd' }
  })),
  barlineStyle('double-barline', 'barlineDouble', 'Double barline', 'double'),
  barlineStyle('final-barline', 'barlineFinal', 'Final barline', 'final'),
  barAttribute('segno', 'segno', 'Segno', 'segno', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'segno' }
  })),
  barAttribute('coda', 'coda', 'Jump (D.S. al fine)', 'jump', () => ({
    type: 'setMeasureAttribute',
    attribute: { kind: 'jump', type: 'dsalfine' }
  })),
  {
    id: 'delete-bar',
    scopes: ['measure'],
    glyph: { mark: { smufl: 'barlineSingle' }, op: { sign: 'minus', at: 'before' } },
    label: 'Delete bar',
    detail: 'Clears its notes first',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },

  // ── section ─────────────────────────────────────────────────────────────
  {
    id: 'section-colour',
    scopes: ['measure'],
    glyph: { smufl: 'coda' },
    label: 'Section colour',
    tier: 'popover',
    blockedBy: 'section-colour'
  },
  {
    // The bar-rung verb the section rung's Del used to be
    // (core-selection-range-grain.md): strip the label on THIS bar — the bars
    // remain, exactly as `no section` does in the setup grammar.
    id: 'delete-section-boundary',
    scopes: ['measure'],
    // A bare mark, not a minus-composed one: the operator contract reserves
    // `minus` for the rung's own `delete` intent, and this strips an
    // attribute instead.
    glyph: { smufl: 'barlineDashed' },
    label: 'Delete section boundary',
    detail: 'The bars remain',
    tier: 'popover',
    isActive: view => view.barAttributes.includes('section'),
    action: () => ({ intent: { type: 'removeMeasureAttribute', kind: 'section' } })
  },

  // ── document ───────────────────────────────────────────────────────────────
  {
    id: 'add-part',
    scopes: ['document'],
    glyph: { smufl: 'brace' },
    label: 'Add part…',
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
    id: 'insert-bar-after',
    scopes: ['measure'],
    glyph: { mark: { smufl: 'barlineSingle' }, op: { sign: 'plus', at: 'after' } },
    label: 'Insert bar after',
    shortcut: 'I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'after' } })
  },
  {
    id: 'insert-bar-before',
    scopes: ['measure'],
    glyph: { mark: { smufl: 'barlineSingle' }, op: { sign: 'plus', at: 'before' } },
    label: 'Insert bar before',
    shortcut: 'Shift+I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'before' } })
  },
  {
    // The score rung's Del: the empty part, then the trailing bars — the
    // skeleton dissolving in reverse symmetry with skeleton-on-demand. It has
    // always been keyboard-reachable and never drawn.
    id: 'delete-part',
    scopes: ['document'],
    glyph: { mark: { smufl: 'brace' }, op: { sign: 'minus', at: 'before' } },
    label: 'Delete part',
    detail: 'Clears its notes first',
    shortcut: 'Del',
    tier: 'key',
    action: () => ({ intent: { type: 'delete' } })
  },
  {
    id: 'insert-part-after',
    scopes: ['document'],
    glyph: { mark: { smufl: 'brace' }, op: { sign: 'plus', at: 'below' } },
    label: 'Insert part below',
    shortcut: 'I',
    tier: 'key',
    action: () => ({ intent: { type: 'insertAtRung', side: 'after' } })
  },
  {
    id: 'insert-part-before',
    scopes: ['document'],
    glyph: { mark: { smufl: 'brace' }, op: { sign: 'plus', at: 'above' } },
    label: 'Insert part above',
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
    id: 'doc-go-last',
    scopes: ['session'],
    glyph: { smufl: 'barlineFinal' },
    label: 'Go to last bar',
    shortcut: 'End',
    tier: 'key',
    action: () => ({ intent: { type: 'goToEdge', edge: 'last' } })
  },
  {
    id: 'doc-go-first',
    scopes: ['session'],
    glyph: { smufl: 'barlineSingle' },
    label: 'Go to first bar',
    shortcut: 'Home',
    tier: 'key',
    action: () => ({ intent: { type: 'goToEdge', edge: 'first' } })
  },
  {
    id: 'doc-add-part',
    scopes: ['session'],
    glyph: { smufl: 'brace' },
    label: 'Add part…',
    shortcut: 'Shift+P',
    tier: 'popover',
    action: () => ({ surface: 'partPopover' })
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
  // EVERY RUNG LEADS WITH `structure`, and it is the same three questions each
  // time: what goes before this, what goes after it, and how does it go away.
  // Those verbs were previously scattered among a rung's property tiles — at
  // the bar rung, three of them among thirteen — which is how the tray came to
  // hide `new-voice` at the one rung that could still reach it, and how two
  // insert keys and two deletes came to have no tile at all.
  //
  // A rung's structure band holds the unit IT governs. For most rungs that is
  // a sibling; for `partMeasure` and `document` it is the CHILD, because
  // neither a staff nor a second document can be inserted at all — the
  // asymmetry is the domain's, not the tray's (core-rung-insert.md).
  note: [
    // A chord is a set, so what `I` inserts at the note rung is an EVENT —
    // hence the same pair the event rung draws, aimed one size up.
    {
      id: 'structure',
      caption: 'structure',
      commands: ['insert-event-before', 'insert-event-after', 'delete-note']
    },
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
    { id: 'text', caption: 'text', commands: ['lyric'] }
  ],
  event: [
    {
      id: 'structure',
      caption: 'structure',
      commands: ['insert-event-before', 'insert-event-after', 'clear-event']
    },
    { id: 'duration', caption: 'duration', commands: ['shorter', 'longer', 'dots'] },
    { id: 'rhythm', caption: 'rhythm containers', commands: ['tuplet', 'grace', 'tremolo', 'container-settings'] },
    { id: 'joins', caption: 'joins', commands: ['slur', 'beam'] },
    {
      id: 'articulation',
      caption: 'articulation',
      commands: [
        'staccato', 'accent', 'tenuto', 'strong-accent', 'staccatissimo',
        'breath', 'arpeggio'
      ]
    },
    {
      id: 'dynamics',
      caption: 'dynamics',
      commands: ['piano', 'mezzo-forte', 'forte']
    },
    { id: 'text', caption: 'lines & text', commands: ['ottava', 'lyric'] }
  ],
  // Two tiles, and the band still earns its caption: it says the one verb
  // this rung has is a structural one, rather than leaving it beside a
  // properties popover with nothing to distinguish them.
  voiceMeasure: [
    { id: 'structure', caption: 'structure', commands: ['new-voice', 'delete-voice-bar'] },
    {
      id: 'rests',
      caption: 'rests & spacing',
      commands: ['rest-spelling', 'space']
    },
    { id: 'voices', caption: 'voices', commands: ['cycle-voice'] }
  ],
  partMeasure: [
    // `new-voice` is the child's construct verb, carried here because
    // `voiceMeasure` vanishes with the last voice and takes its own copy with
    // it (core-rung-insert.md, amended 2026-08-25).
    { id: 'structure', caption: 'structure', commands: ['new-voice', 'delete-part-bar'] },
    {
      id: 'instrument',
      caption: 'instrument',
      commands: ['tuning', 'capo', 'transpose-part', 'mute-part']
    },
    { id: 'selection', caption: 'selection', commands: ['part-scope'] }
  ],
  measure: [
    {
      id: 'structure',
      caption: 'structure',
      commands: ['insert-bar-before', 'insert-bar-after', 'delete-bar']
    },
    {
      id: 'repeats',
      caption: 'repeats & barlines',
      commands: ['repeat-start', 'repeat-end', 'double-barline', 'final-barline']
    },
    { id: 'jumps', caption: 'jumps', commands: ['segno', 'coda'] },
    {
      id: 'marks',
      caption: 'marks',
      commands: ['section-colour', 'delete-section-boundary']
    }
  ],
  document: [
    // The score rung inserts PARTS: its own unit is the document, and there is
    // only ever one.
    {
      id: 'structure',
      caption: 'structure',
      commands: ['insert-part-before', 'insert-part-after', 'add-part', 'delete-part']
    },
    { id: 'part', caption: 'part', commands: ['part-name', 'staves', 'staff-kind'] },
    { id: 'layout', caption: 'layout', commands: ['system-break', 'multimeasure-rest'] }
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
