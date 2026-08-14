// The destruct walk — the element-ops campaign's reverse direction
// (roadmap/inprogress/core-element-ops-exemplar.md), shared verbatim by the
// harness sweep (destruct-sweep.test.ts) and the ops panel's "run destruct
// sweep" button, so the button IS the sweep: enumerate elements (v0 walker =
// keyed notes), address each with NAVIGATION INTENTS ONLY (the
// addressability audit — the grid is consulted to aim, every move goes
// through handleIntent), delete. No fixtures: the walk regenerates from
// whatever document is loaded, which is why the panel button works on any
// scenario, not just the exemplars.
import type { MnxStructure } from '../model/mnx.ts';
import { forEachKeyedNote, onsetsEqual } from './cursor.ts';
import type { EditorSession } from './session.ts';

/** The v0 element walker: every keyed note of parts[0]/staff 1. Later
 *  campaign items grow this per element kind ("element = anything the
 *  renderer draws distinguishable ink for"). */
export function elementKeys(doc: MnxStructure): string[] {
  const keys: string[] = [];
  forEachKeyedNote(doc, (_note, key) => keys.push(key));
  return keys;
}

/**
 * Drive the cursor to the element via navigation intents only, returning
 * whether it arrived (cursor addresses the target's position and line).
 */
export function driveToElement(session: EditorSession, key: string): boolean {
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
  return (
    session.cursor.measureIndex === target.position.measureIndex &&
    onsetsEqual(session.cursor.onset, target.position.onset) &&
    session.cursor.line === line
  );
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
