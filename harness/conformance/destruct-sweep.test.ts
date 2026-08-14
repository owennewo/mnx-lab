// The destruct sweep v0 — the element-ops exemplar's REVERSE harness
// (roadmap/complete/core-element-ops-exemplar.md, campaign
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
// orders (chord members must commute) — first to the ink-free state (the
// walker enumerates zero elements; a measure of rests is legal, rests being
// absence rather than elements), then PHASE 2, the scaffolding teardown, to
// the literal `{}`. (Superseding this file's first draft: teardown is not
// coarse-op cheating, because a container is removable only once EMPTY — the
// cascade never destroys ink. `{}` is the construct start, so the round trip
// closes, byte-identical undo-all both ways.)
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { forEachKeyedNote } from '../../src/edit/cursor.ts';
import { driveToElement, elementKeys, runDestructWalk } from '../../src/edit/destructWalk.ts';
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
          expect(driveToElement(session, key), `cursor cannot address ${key}`).toBe(true);

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

      it('exhaustive pass: two orders commute, teardown reaches {}', () => {
        const terminals = [false, true].map(reversed => {
          const session = new EditorSession(JSON.parse(loadedBytes) as MnxStructure, id);
          for (let guard = 0; elementKeys(session.doc).length > 0 && guard < 64; guard++) {
            const remaining = elementKeys(session.doc);
            const key = reversed ? remaining[remaining.length - 1] : remaining[0];
            expect(driveToElement(session, key), `cursor cannot address ${key}`).toBe(true);
            expect(session.handleIntent({ type: 'delete' })).toBe(true);
          }
          // Ink-free: the walker enumerates zero elements, and the doc is
          // still schema-valid (a measure of rests is legal).
          expect(elementKeys(session.doc)).toEqual([]);
          expect(validateMnx(session.doc)).toBe(true);
          // Phase 2 — scaffolding teardown (runDestructWalk finds no ink
          // left and proceeds straight to it): empty bars, then the part,
          // then the hollow skeleton dissolves. Terminal: the literal {},
          // the construct start — the round trip closes. ({} is not valid
          // MNX and needn't be — the same boundary exemption as construct's
          // start.)
          runDestructWalk(session);
          expect(JSON.stringify(session.doc)).toBe('{}');
          // And undo-all still restores the loaded document byte-identically.
          while (session.canUndo) session.handleIntent({ type: 'undo' });
          expect(JSON.stringify(session.doc)).toBe(loadedBytes);
          return session.doc;
        });
        expect(terminals[0]).toEqual(terminals[1]);
      });
    });
  }
});
