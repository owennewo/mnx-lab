// The destruct sweep v0 — the element-ops exemplar's REVERSE harness
// (roadmap/inprogress/core-element-ops-exemplar.md, campaign
// core-campaign-element-ops.md item 1; item 2 scales this corpus-wide).
//
// No fixtures: the walk regenerates each run. For each exemplar scenario,
// enumerate its elements (v0 walker = the noteKeys traversal — both
// exemplars are notes-only) and, each from a FRESH session loaded
// history-less (as documents really arrive):
//
//   1. ADDRESS it with cursor navigation (goToMeasure / nextPosition /
//      lineUp/lineDown intents only — the addressability half: an element
//      the cursor cannot reach is a finding, not a skip)
//   2. delete it (the Delete intent)
//   3. assert: the op log's last op is deleteNote of that key; the doc
//      changed; still schema-valid; every id referenced anywhere still
//      resolves (the dangling-reference oracle); the layout still runs with
//      no NEW diagnostics beyond the untouched doc's baseline; and undo-all
//      restores the loaded document BYTE-identically
//
// Then the exhaustive pass: delete every element in one session, in two
// orders (chord members must commute) — terminal state = the walker
// enumerates zero elements. A measure of rests IS the legal terminal; the
// blank doc is not the goal (scaffolding teardown is coarse-op territory,
// deliberately out of the campaign's frame).
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { forEachKeyedNote, onsetsEqual } from '../../src/edit/cursor.ts';
import { isTimedEvent, type MnxNote, type MnxStructure } from '../../src/model/mnx.ts';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const EXEMPLARS = ['lab/document/minimal-single-note', 'lab/tab-positions/open-strings-chord'];

const dirById = new Map<string, string>(
  loadCorpus().map((s: { id: string; dir: string }) => [s.id, s.dir])
);

function loadDoc(id: string): MnxStructure {
  const dir = dirById.get(id);
  if (!dir) throw new Error(`unknown scenario id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
}

/** The v0 element walker: every keyed note (both exemplars are notes-only). */
function elementKeys(doc: MnxStructure): string[] {
  const keys: string[] = [];
  forEachKeyedNote(doc, (_note, key) => keys.push(key));
  return keys;
}

/** Diagnostic-badge count across both projections — the "no new
 *  diagnostics" baseline (badges are primitives with a diagnostic class). */
function diagnosticCount(doc: MnxStructure): number {
  const prims = computePrimitives(doc);
  const count = (list: { className?: string }[] | undefined) =>
    (list ?? []).filter(p => p.className?.includes('diagnostic-marker')).length;
  return count(prims.notation.primitives) + count(prims.tab?.primitives);
}

/** Every note id referenced anywhere a note points at another note (v0:
 *  ties — the exemplars carry nothing richer; item 2 grows this with the
 *  walker). Returns the referenced ids. */
function referencedIds(doc: MnxStructure): string[] {
  const refs: string[] = [];
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const item of seq.content ?? []) {
          if (!isTimedEvent(item)) continue;
          for (const note of ((item.notes ?? []) as MnxNote[])) {
            for (const tie of note.ties ?? []) if (tie.target) refs.push(tie.target);
          }
        }
      }
    }
  }
  return refs;
}

function noteIds(doc: MnxStructure): Set<string> {
  const ids = new Set<string>();
  forEachKeyedNote(doc, note => {
    if (note.id) ids.add(note.id);
  });
  return ids;
}

/**
 * Drive the cursor to the element via navigation intents only, then return
 * whether it arrived (slot under cursor = the target key). This is the
 * addressability audit: the grid is consulted to AIM (the UI does the same),
 * but every move goes through handleIntent.
 */
function driveTo(session: EditorSession, key: string): boolean {
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
  const line =
    session.projection === 'tab' ? target.slot.line : target.slot.staffPosition;
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

describe('destruct sweep v0 (element-ops exemplar)', () => {
  for (const id of EXEMPLARS) {
    describe(id, () => {
      const loaded = loadDoc(id);
      const loadedBytes = JSON.stringify(loaded);
      const keys = elementKeys(loaded);
      const baseline = diagnosticCount(loaded);

      it('enumerates at least one element', () => {
        expect(keys.length).toBeGreaterThan(0);
      });

      for (const key of keys) {
        it(`element ${key}: addressable, deletable, undoable`, () => {
          const session = new EditorSession(JSON.parse(loadedBytes) as MnxStructure, id);

          // 1. Addressability — pure navigation.
          expect(driveTo(session, key), `cursor cannot address ${key}`).toBe(true);

          // 2. The deletion.
          expect(session.handleIntent({ type: 'delete' })).toBe(true);
          const lastOp = session.appliedOps.at(-1);
          expect(lastOp).toEqual({ type: 'deleteNote', noteId: key });
          expect(JSON.stringify(session.doc)).not.toBe(loadedBytes);

          // 3. The oracles.
          expect(validateMnx(session.doc), 'deletion left the document schema-invalid').toBe(true);
          const ids = noteIds(session.doc);
          for (const ref of referencedIds(session.doc)) {
            expect(ids.has(ref), `dangling reference to '${ref}' after deleting ${key}`).toBe(true);
          }
          expect(
            diagnosticCount(session.doc),
            'deletion introduced new renderer diagnostics'
          ).toBeLessThanOrEqual(baseline);

          while (session.canUndo) session.handleIntent({ type: 'undo' });
          expect(JSON.stringify(session.doc)).toBe(loadedBytes);
        });
      }

      it('exhaustive pass: two orders commute to the same ink-free terminal', () => {
        const terminals = [false, true].map(reversed => {
          const session = new EditorSession(JSON.parse(loadedBytes) as MnxStructure, id);
          for (let guard = 0; elementKeys(session.doc).length > 0 && guard < 64; guard++) {
            const remaining = elementKeys(session.doc);
            const key = reversed ? remaining[remaining.length - 1] : remaining[0];
            expect(driveTo(session, key), `cursor cannot address ${key}`).toBe(true);
            expect(session.handleIntent({ type: 'delete' })).toBe(true);
          }
          // Terminal: the walker enumerates zero elements — NOT the blank doc.
          expect(elementKeys(session.doc)).toEqual([]);
          expect(validateMnx(session.doc)).toBe(true);
          return session.doc;
        });
        expect(terminals[0]).toEqual(terminals[1]);
      });
    });
  }
});
