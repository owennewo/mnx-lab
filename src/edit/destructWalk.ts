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
//                    (roadmap/proposed/core-element-ops-destruct-sweep.md).
import type { MnxStructure } from '../model/mnx.ts';
import { forEachKeyedNote, onsetsEqual, slotAt } from './cursor.ts';
import type { ElementKind, ElementRef } from './elementWalk.ts';
import type { EditorSession } from './session.ts';

/** The ink the ops layer can name: every keyed note of parts[0]/staff 1. */
export function elementKeys(doc: MnxStructure): string[] {
  const keys: string[] = [];
  forEachKeyedNote(doc, (_note, key) => keys.push(key));
  return keys;
}

/** Can ANY op in the union remove this kind of element? The campaign's
 *  scoreboard denominator — every `false` here is an undrafted item's work,
 *  and flipping one to `true` is what an item lands. */
export function kindHasRemovalOp(kind: ElementKind): boolean {
  return kind === 'note';
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

/**
 * Try to remove one element from a session, the way a person would: navigate
 * to it, press Delete. Elements no op can remove are reported honestly rather
 * than skipped — `no-op` is the campaign's work queue, not a failure.
 */
export function attemptElement(session: EditorSession, element: ElementRef): ElementAttempt {
  if (!kindHasRemovalOp(element.kind)) return { address: 'unaddressable', removal: 'no-op' };
  // A note the ops layer cannot name (a second part, a second staff, inside a
  // container) is an addressing gap, not a missing verb.
  if (element.noteKey === undefined) return { address: 'unaddressable', removal: 'no-op' };
  if (!driveToElement(session, element.noteKey)) return { address: 'unaddressable', removal: 'no-op' };
  const applied = session.handleIntent({ type: 'delete' });
  return { address: 'addressed', removal: applied ? 'removed' : 'refused' };
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
  return slotAt(session.positions, session.cursor, session.projection)?.noteKey === key;
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
