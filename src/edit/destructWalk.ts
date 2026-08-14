// The destruct walk — the element-ops campaign's reverse direction
// (roadmap/complete/core-element-ops-exemplar.md), shared verbatim by the
// harness sweep (destruct-sweep.test.ts) and the ops panel's "run destruct
// sweep" button, so the button IS the sweep: enumerate elements, address each
// with NAVIGATION INTENTS ONLY (the addressability audit — the grid is
// consulted to aim, every move goes through handleIntent), delete. No
// fixtures: the walk regenerates from whatever document is loaded, which is
// why the panel button works on any scenario, not just the exemplars.
//
// Two enumerations live here, deliberately:
//   `elementKeys`  — the ink the ops layer can NAME (keyed notes of the entry
//                    surface). The teardown loop below drives it.
//   `walkElements` — every element of the document, whether or not anything
//                    can remove it (elementWalk.ts). The corpus sweep drives
//                    that one, because the gap between the two IS the report
//                    (roadmap/inprogress/core-element-ops-destruct-sweep.md).
import type { MnxStructure } from '../model/mnx.ts';
import { coincidentSlots, forEachKeyedNote, onsetsEqual, slotAt } from './cursor.ts';
import { ELEMENT_KINDS, type ElementKind, type ElementRef } from './elementWalk.ts';
import type { EditorIntent } from './intents.ts';
import type { MeasureAttributeKind, PartDeclarationKind } from './ops.ts';
import type { EditorSession } from './session.ts';

/** The ink the ops layer can name: every keyed note of parts[0]/staff 1. */
export function elementKeys(doc: MnxStructure): string[] {
  const keys: string[] = [];
  forEachKeyedNote(doc, (_note, key) => keys.push(key));
  return keys;
}

/** Can ANY op in the union remove this kind of element? Read from the kind
 *  table's op pair (elementWalk.ts), so the sweep's `no-op` verdict and the
 *  construct tiers can never disagree about what the vocabulary contains —
 *  the campaign's scoreboard denominator, in one place. */
export function kindHasRemovalOp(kind: ElementKind): boolean {
  return (ELEMENT_KINDS[kind].remove?.length ?? 0) > 0;
}

/** Did the cursor reach it, and did anything remove it? Two axes, because
 *  conflating them hides the distinction the campaign is built on: an
 *  unaddressable note is a LADDER gap, a no-op clef is a VOCABULARY gap, and
 *  they are fixed by different work. `broken` is not decided here — it is the
 *  harness's verdict when a removal applied but an oracle failed. */
export type AddressVerdict = 'addressed' | 'unaddressable';
export type RemovalVerdict = 'removed' | 'no-op' | 'refused';

export interface ElementAttempt {
  address: AddressVerdict;
  removal: RemovalVerdict;
}

/** The bar-attribute family's kinds → the `MeasureAttributeKind` they strip.
 *  (`ElementKind` names them with hyphens, the op union in camelCase.) */
const MEASURE_ATTRIBUTE_KINDS: Partial<Record<ElementKind, MeasureAttributeKind>> = {
  barline: 'barline',
  'repeat-start': 'repeatStart',
  'repeat-end': 'repeatEnd',
  ending: 'ending',
  segno: 'segno',
  fine: 'fine',
  jump: 'jump',
  tempo: 'tempo',
  rehearsal: 'rehearsal',
  section: 'section'
};

/** Element kinds that are declarations on `parts[0]` → the key they strip. */
const PART_DECLARATION_KINDS: Partial<Record<ElementKind, PartDeclarationKind>> = {
  'part-name': 'name',
  staves: 'staves',
  strings: 'strings',
  capo: 'capo',
  'staff-kind': 'staffKind'
};

/** The removal intent for a measure-scoped element kind, if it has one. */
function measureRemovalIntent(kind: ElementKind): EditorIntent | null {
  if (kind === 'clef') return { type: 'removeClef' };
  if (kind === 'key-signature') return { type: 'removeKeySignature' };
  if (kind === 'time-signature') return { type: 'removeTimeSignature' };
  if (kind === 'full-measure-rest') return { type: 'removeFullMeasureRest' };
  if (kind === 'measure-repeat') return { type: 'removeMeasureRepeat' };
  const attribute = MEASURE_ATTRIBUTE_KINDS[kind];
  return attribute ? { type: 'removeMeasureAttribute', kind: attribute } : null;
}

/**
 * Try to remove one element from a session, the way a person would: navigate
 * to it, press Delete. Elements no op can remove are reported honestly rather
 * than skipped — `no-op` is the campaign's work queue, not a failure.
 */
export function attemptElement(session: EditorSession, element: ElementRef): ElementAttempt {
  if (!kindHasRemovalOp(element.kind)) return { address: 'unaddressable', removal: 'no-op' };

  // Measure-scoped attributes are addressed by navigating to their bar, then
  // fired with their own verb: the inherited pair reverts to the predecessor's
  // governance (item 5), the bar-attribute family simply strips (item 7).
  // Document-level declarations need no navigation either: the document is the
  // address. A lyric LINE is score-wide (its label and language), unlike the
  // syllables that hang off notes.
  if (element.container) {
    if (element.measureIndex === undefined) {
      // Containers sit in a measure the walker knows; derive it from the path.
      const m = Number(/\/m(\d+)\//.exec(element.path)?.[1] ?? -1);
      if (m < 0) return { address: 'unaddressable', removal: 'no-op' };
      session.handleIntent({ type: 'goToMeasure', measureIndex: m });
    }
    const applied = session.handleIntent({
      type: 'removeContainer',
      sequenceIndex: element.container.sequenceIndex,
      eventIndex: element.container.eventIndex
    });
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }
  if (element.kind === 'layout' || element.kind === 'score') {
    const index = Number(/(\d+)$/.exec(element.path)?.[1] ?? -1);
    if (index < 0) return { address: 'unaddressable', removal: 'no-op' };
    const applied = session.handleIntent(
      element.kind === 'layout' ? { type: 'removeLayout', index } : { type: 'removeScore', index }
    );
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }
  if (element.kind === 'multimeasure-rest') {
    const match = /^score(\d+)\/mmr(\d+)$/.exec(element.path);
    if (!match) return { address: 'unaddressable', removal: 'no-op' };
    const applied = session.handleIntent({
      type: 'removeMultimeasureRest',
      scoreIndex: Number(match[1]),
      index: Number(match[2])
    });
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }
  if (element.kind === 'kit-component' || element.kind === 'sound') {
    const name = element.path.split('/').pop()!;
    const applied = session.handleIntent(
      element.kind === 'sound'
        ? { type: 'removeSound', sound: name }
        : { type: 'removeKitComponent', component: name }
    );
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }
  if (element.kind === 'lyric-line-metadata') {
    const line = element.path.split('/').pop()!;
    const applied = session.handleIntent({ type: 'removeLyricLine', line });
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }

  // Part declarations live on parts[0] and need no navigation at all — the
  // part IS the address, which is why they attach at the score rung.
  const partKind = PART_DECLARATION_KINDS[element.kind];
  if (partKind) {
    const owner = Number(/^p(\d+)\//.exec(element.path)?.[1] ?? 0);
    if ((session.cursor.partIndex ?? 0) !== owner && !session.handleIntent({ type: 'setPart', partIndex: owner }))
      return { address: 'unaddressable', removal: 'no-op' };
    const applied = session.handleIntent({ type: 'removePartDeclaration', kind: partKind });
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }

  // Positioned adornments need the cursor at the right MOMENT, not just the
  // right bar — the first elements whose address has two coordinates.
  if (element.kind === 'dynamic' || element.kind === 'direction' || element.kind === 'ottava') {
    if (element.measureIndex === undefined) return { address: 'unaddressable', removal: 'no-op' };
    session.handleIntent({ type: 'goToMeasure', measureIndex: element.measureIndex });
    const [num, den] = element.onset ?? [0, 1];
    for (let guard = 0; guard < 64; guard++) {
      const at = session.cursor.onset;
      if (at.num * den === num * at.den) break;
      if (!session.handleIntent({ type: 'nextPosition' })) break;
    }
    const at = session.cursor.onset;
    if (at.num * den !== num * at.den) return { address: 'unaddressable', removal: 'no-op' };
    const applied = session.handleIntent({ type: 'removePositioned', kind: element.kind });
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }

  const measureIntent = measureRemovalIntent(element.kind);
  if (measureIntent) {
    if (element.measureIndex === undefined) return { address: 'unaddressable', removal: 'no-op' };
    // A part-measure attribute (a clef) belongs to its own part's timeline.
    const owner = Number(/^p(\d+)\//.exec(element.path)?.[1] ?? 0);
    if ((session.cursor.partIndex ?? 0) !== owner && !session.handleIntent({ type: 'setPart', partIndex: owner }))
      return { address: 'unaddressable', removal: 'no-op' };
    if (element.staffIndex !== undefined && (session.cursor.staffIndex ?? 1) !== element.staffIndex)
      session.handleIntent({ type: 'setStaff', staffIndex: element.staffIndex });
    session.handleIntent({ type: 'goToMeasure', measureIndex: element.measureIndex });
    // A mid-measure attribute needs the cursor at its moment, not just its bar.
    if (element.onset) {
      const [num, den] = element.onset;
      for (let guard = 0; guard < 64; guard++) {
        const at = session.cursor.onset;
        if (at.num * den === num * at.den) break;
        if (!session.handleIntent({ type: 'nextPosition' })) break;
      }
    }
    if (session.cursor.measureIndex !== element.measureIndex)
      return { address: 'unaddressable', removal: 'no-op' };
    const applied = session.handleIntent(measureIntent);
    return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
  }

  // A note the ops layer cannot name (a second part, a second staff, inside a
  // container) is an addressing gap, not a missing verb.
  const key = element.noteKey ?? element.ownerNoteKey;
  if (key === undefined) return { address: 'unaddressable', removal: 'no-op' };
  if (!driveToElement(session, key)) return { address: 'unaddressable', removal: 'no-op' };
  // Note-attached elements are removed THROUGH their note: address the note,
  // then use the element's own verb. Both of these are genuinely pairs — the
  // same key that ties unties, and the same key that slurs unslurs.
  const intent =
    element.kind === 'tie'
      ? ({ type: 'toggleTie' } as const)
      : element.kind === 'slur'
        ? ({ type: 'toggleSlur' } as const)
        : element.kind === 'beam'
          ? ({ type: 'toggleBeam' } as const)
          : element.kind === 'articulation'
            ? ({ type: 'removeMarking', marking: element.path.split('/').pop()! } as const)
            : element.kind === 'accidental-display'
              ? ({ type: 'removeAccidentalDisplay' } as const)
              : element.kind === 'kit-note'
                ? ({ type: 'removeKitNote' } as const)
                : element.kind === 'string-annotation'
              ? ({ type: 'removeStringAnnotation' } as const)
              : element.kind === 'lyric'
              ? ({ type: 'removeSyllable', line: element.path.split('/').pop()! } as const)
              : element.kind === 'technique'
              ? ({ type: 'toggleTechnique', kind: element.path.split('/').pop() } as never)
              : element.kind === 'fingering'
                ? ({ type: 'removeFingering' } as const)
                : ({ type: 'delete' } as const);
  // "Handled" is not "removed": `toggleSlur` legitimately returns true when it
  // merely ARMS an anchor, and a walk that counted that as a removal would
  // report ink gone that is still on the page. Compare the document instead.
  const before = JSON.stringify(session.doc);
  const applied = session.handleIntent(intent);
  const changed = JSON.stringify(session.doc) !== before;
  return { address: 'addressed', removal: applied && changed ? 'removed' : 'refused' };
}

/**
 * Drive the cursor to the element via navigation intents only, returning
 * whether it arrived — where "arrived" means the editor would ACT ON THIS
 * ELEMENT here, not merely that the coordinates match.
 *
 * The distinction is load-bearing and the corpus proves it: `EditorCursor` is
 * {measure, onset, line} with no voice component, so when two voices put a
 * note on the same line at the same onset (twelve-bar-blues m10, melody over
 * the alternating bass on one string) the address is genuinely ambiguous —
 * `slotAt` returns whichever comes first. Comparing coordinates called that
 * "addressed" and then deleted the OTHER voice's note. Resolving the slot
 * instead makes the ambiguity a reported addressability finding, which is
 * what the sweep is for.
 *
 * **Both projections are tried**, because they collide differently and the
 * question is whether the editor can reach the note AT ALL: tab addresses by
 * string, so two chord members derived onto one string are indistinguishable
 * there while their staff positions separate them cleanly in notation.
 * `setProjection` is an ordinary intent (the pane follows the cursor), so
 * switching costs the walk nothing and stops the report from inventing gaps.
 */
export function driveToElement(session: EditorSession, key: string): boolean {
  // The part comes first: a different part is a different grid, so no amount of
  // navigation inside the current one can reach it (campaign item 13b).
  const parts = session.doc.parts ?? [];
  for (const [partIndex, part] of parts.entries()) {
    if ((session.cursor.partIndex ?? 0) !== partIndex) {
      if (!session.handleIntent({ type: 'setPart', partIndex })) continue;
    }
    // …and each staff of it: a grand staff is two spaces, so the note may be
    // in the one the cursor is not looking at (campaign item 13c).
    for (let staffIndex = 1; staffIndex <= (part.staves ?? 1); staffIndex++) {
      if ((session.cursor.staffIndex ?? 1) !== staffIndex) {
        if (!session.handleIntent({ type: 'setStaff', staffIndex })) continue;
      }
      if (driveWithinPart(session, key)) return true;
    }
  }
  return false;
}

function driveWithinPart(session: EditorSession, key: string): boolean {
  if (driveWithinProjection(session, key)) return true;
  const other = session.projection === 'tab' ? 'notation' : 'tab';
  if (!session.handleIntent({ type: 'setProjection', projection: other })) return false;
  return driveWithinProjection(session, key);
}

function driveWithinProjection(session: EditorSession, key: string): boolean {
  const target = session.positions.positions
    .flatMap(p => p.slots.map(slot => ({ position: p, slot })))
    .find(({ slot }) => slot.noteKey === key);
  if (!target) return false;

  session.handleIntent({ type: 'goToMeasure', measureIndex: target.position.measureIndex });
  for (
    let guard = 0;
    !onsetsEqual(session.cursor.onset, target.position.onset) && guard < 64;
    guard++
  ) {
    session.handleIntent({ type: 'nextPosition' });
  }
  const line = session.projection === 'tab' ? target.slot.line : target.slot.staffPosition;
  for (let guard = 0; session.cursor.line !== line && guard < 64; guard++) {
    // lineDown decreases staff position / increases string number.
    session.handleIntent({
      type: session.cursor.line > line === (session.projection === 'tab') ? 'lineUp' : 'lineDown'
    });
  }
  if (slotAt(session.positions, session.cursor, session.projection)?.noteKey === key) return true;

  // Coincidence: several notes can share this moment and line (two voices on
  // one string, two chord members the derivation stacks there). The cursor
  // carries a discriminator for exactly this, so step through them — the same
  // `Alt+V` a player would press (core-note-address.md move 2).
  const coincident = coincidentSlots(session.positions, session.cursor, session.projection).length;
  for (let step = 1; step < coincident; step++) {
    if (!session.handleIntent({ type: 'cycleSlot' })) break;
    if (slotAt(session.positions, session.cursor, session.projection)?.noteKey === key) return true;
  }
  return false;
}

export interface DestructResult {
  deleted: string[];
  /** Elements the cursor could not address or the delete refused — each one
   *  is a campaign finding, not a silent skip. */
  unaddressed: string[];
}

/** Relax the selection ladder until `level` (or report failure) — every
 *  step through handleIntent, so the climb is recorded like keys. */
function climbTo(session: EditorSession, level: 'measure' | 'score'): boolean {
  for (let guard = 0; guard < 12 && session.selectionLevel !== level; guard++) {
    if (!session.handleIntent({ type: 'relaxSelection' })) break;
  }
  return session.selectionLevel === level;
}

/**
 * Delete every enumerable element of the session's document, front of the
 * walker first (positional keys are recomputed after every deletion — a
 * chord member's key may shift as its siblings go); then tear down the
 * emptied scaffolding — bars last→first at the measure rung, the part at
 * the score rung — until the hollow skeleton dissolves to the literal `{}`,
 * the construct start (containers are removable only once empty, so the
 * teardown never destroys ink). The queue this leaves behind is the
 * destruct sequence: undo REBUILDS the score element by element — the
 * construct queue's mirror.
 */
export function runDestructWalk(session: EditorSession): DestructResult {
  const deleted: string[] = [];
  const unaddressed: string[] = [];
  for (let guard = 0; guard < 256; guard++) {
    const remaining = elementKeys(session.doc).filter(k => !unaddressed.includes(k));
    if (remaining.length === 0) break;
    const key = remaining[0];
    if (!driveToElement(session, key) || !session.handleIntent({ type: 'delete' })) {
      unaddressed.push(key);
      continue;
    }
    deleted.push(key);
  }

  // Phase 2 — scaffolding teardown, empty containers only. Each removal
  // resets the ladder to note level (mutations re-anchor), so the climb
  // repeats per container.
  for (let guard = 0; guard < 128; guard++) {
    const measureCount = session.doc.global?.measures?.length ?? 0;
    const partCount = session.doc.parts?.length ?? 0;
    if (measureCount === 0 && partCount === 0) break; // dissolved to {}
    if (measureCount > 0 && partCount > 0) {
      session.handleIntent({ type: 'goToMeasure', measureIndex: measureCount - 1 });
      if (!climbTo(session, 'measure')) break;
    } else if (!climbTo(session, 'score')) break;
    const before = JSON.stringify(session.doc);
    if (!session.handleIntent({ type: 'delete' }) || JSON.stringify(session.doc) === before)
      break;
  }
  return { deleted, unaddressed };
}
