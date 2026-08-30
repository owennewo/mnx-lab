// src/model/jsonView.ts, pinned for the first time.
//
// The module renders a document to numbered lines with a JSON-pointer index,
// and it is what the note ↔ document cross-highlight is built on. CLAUDE.md
// names it explicitly — "the note↔JSON cross-highlight depends on
// model/noteKeys.ts and model/jsonView.ts mirroring the same traversal — keep
// them in lockstep" — and until now nothing checked that. It also had no UI
// consumer, so the traversal could have drifted for months without anyone
// noticing; the document panel's json tab is about to depend on it heavily
// (roadmap/proposed/core-json-view.md), which is what makes the gap urgent
// rather than theoretical.
//
// Real corpus documents, not fixtures. The `spec/` mirrors are the interesting
// half: they carry no note ids, so every key there is SYNTHESIZED positionally,
// which is exactly the path a hand-written fixture with tidy ids would skip.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildJsonView } from '../../src/model/jsonView.ts';
import { noteKeysOf } from '../../src/model/noteWalk.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const dirById = new Map<string, string>(
  loadCorpus().map((s: { id: string; dir: string }) => [s.id, s.dir])
);

function doc(id: string): unknown {
  const dir = dirById.get(id);
  if (!dir) throw new Error(`unknown scenario id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8'));
}

/** Multi-part, multi-voice, with ids. The realistic navigation instrument. */
const RICH = 'lab/document/twelve-bar-blues';
/** A spec mirror: no note ids anywhere, so keys are positional. */
const MIRROR = 'spec/hello-world';
/**
 * Two staves, so `sequences[].staff === 2` actually appears.
 *
 * Added after a mutation check embarrassed the first draft: deleting jsonView's
 * staff-1 filter — which shifts every voice index, and so every synthesized
 * key — passed the whole file. Not because the assertions were weak, but
 * because NEITHER sample contained a non-staff-1 sequence, so the mutation was
 * a no-op on the data. Only three scenarios in the corpus exercise that branch;
 * without one of them the filter is untested code.
 */
const GRAND = 'spec/grand-staff';

const SAMPLES = [RICH, MIRROR, GRAND].filter(id => dirById.has(id));

describe('json view', () => {
  it('has scenarios to test against', () => {
    expect(SAMPLES.length, `neither ${RICH} nor ${MIRROR} is in the corpus`).toBeGreaterThan(0);
  });

  describe('the text is exactly JSON.stringify', () => {
    // The pane advertises itself as the raw document. If the renderer ever
    // drifts — a key reordered, indentation changed, a number reformatted —
    // it is quietly showing something that is not the file, and every line
    // number the pointers hand out is off by however much it drifted.
    for (const id of SAMPLES) {
      it(id, () => {
        const d = doc(id);
        const view = buildJsonView(d);
        expect(view.lines.join('\n')).toBe(JSON.stringify(d, null, 2));
        expect(view.text).toBe(view.lines.join('\n'));
      });
    }
  });

  describe('spans', () => {
    for (const id of SAMPLES) {
      it(`${id}: every span starts where lineByPointer says`, () => {
        const view = buildJsonView(doc(id));
        const mismatched: string[] = [];
        for (const [pointer, start] of view.lineByPointer) {
          const span = view.spanByPointer.get(pointer);
          if (!span) {
            mismatched.push(`${pointer}: no span`);
          } else if (span[0] !== start) {
            mismatched.push(`${pointer}: span starts ${span[0]}, index says ${start}`);
          }
        }
        expect(mismatched.slice(0, 10), `${mismatched.length} mismatched`).toEqual([]);
      });

      it(`${id}: every span is well-formed and inside the document`, () => {
        const view = buildJsonView(doc(id));
        const bad: string[] = [];
        for (const [pointer, [a, b]] of view.spanByPointer) {
          if (a > b) bad.push(`${pointer}: inverted [${a}, ${b}]`);
          if (a < 0 || b >= view.lines.length) bad.push(`${pointer}: out of range [${a}, ${b}]`);
        }
        expect(bad.slice(0, 10), `${bad.length} malformed`).toEqual([]);
      });

      it(`${id}: a child's span nests inside its parent's`, () => {
        // The property the scoped view rests on: slicing a parent's span shows
        // every descendant whole. If nesting breaks, a scoped view silently
        // truncates the thing it was asked to show.
        const view = buildJsonView(doc(id));
        const escapes: string[] = [];
        for (const [pointer, [a, b]] of view.spanByPointer) {
          if (pointer === '') continue;
          const parent = pointer.slice(0, pointer.lastIndexOf('/'));
          const outer = view.spanByPointer.get(parent);
          if (!outer) continue;
          if (a < outer[0] || b > outer[1]) {
            escapes.push(`${pointer} [${a}, ${b}] escapes ${parent || '<root>'} [${outer[0]}, ${outer[1]}]`);
          }
        }
        expect(escapes.slice(0, 10), `${escapes.length} escaped`).toEqual([]);
      });

      it(`${id}: the root span covers the whole document`, () => {
        const view = buildJsonView(doc(id));
        expect(view.spanByPointer.get('')).toEqual([0, view.lines.length - 1]);
      });

      it(`${id}: a container's span really does reach its closing brace`, () => {
        // Cheap and specific: whatever the last line of a container's span is,
        // it must be the line that closes it. This is the assertion that fails
        // if someone records the span before the closing token is pushed.
        const view = buildJsonView(doc(id));
        const wrong: string[] = [];
        for (const [pointer, [a, b]] of view.spanByPointer) {
          if (a === b) continue; // scalars and empty containers
          const last = view.lines[b].trim();
          if (last !== '}' && last !== ']' && last !== '},' && last !== '],') {
            wrong.push(`${pointer} ends on ${JSON.stringify(last)}`);
          }
        }
        expect(wrong.slice(0, 10), `${wrong.length} bad ends`).toEqual([]);
      });
    }
  });

  describe('note keys agree with the canonical walk', () => {
    // THE ASSERTION THAT ACTUALLY ENFORCES LOCKSTEP, and the one this file
    // shipped without on its first draft. Round-tripping the two maps against
    // each other proves only that they are mutual inverses — which stays true
    // when every key in them is WRONG. Deleting jsonView's staff-1 filter (so
    // voice indices, and therefore every synthesized key, shift) passed the
    // round-trip tests without a murmur.
    //
    // `noteWalk.noteKeysOf` is the canonical enumeration — `note-keys.test.ts`
    // already joins the RENDERER to it, so joining the JSON view to it too is
    // what puts all three traversals on one definition instead of two pairs.
    // jsonView deliberately anchors `parts[0]` only, so the direction that
    // holds is containment: everything it claims must be a key the walk knows.
    for (const id of SAMPLES) {
      it(`${id}: every anchored key is one the walk produces`, () => {
        const d = doc(id) as MnxStructure;
        const view = buildJsonView(d);
        const canonical = new Set(noteKeysOf(d));
        const unknown = [...view.noteLineByKey.keys()].filter(k => !canonical.has(k));
        expect(
          unknown.slice(0, 10),
          `${unknown.length} key(s) the canonical walk does not produce — the two ` +
            `traversals have drifted (CLAUDE.md: keep noteKeys and jsonView in lockstep)`
        ).toEqual([]);
      });
    }
  });

  describe('note keys round-trip', () => {
    // Both directions, because the highlight is used both ways: notehead →
    // line, and line → notehead. Necessary but NOT sufficient — see above.
    for (const id of SAMPLES) {
      it(id, () => {
        const view = buildJsonView(doc(id));
        expect(view.noteLineByKey.size, 'no notes were anchored').toBeGreaterThan(0);
        for (const [key, line] of view.noteLineByKey) {
          expect(view.noteKeyByLine.get(line), `line ${line} should map back to ${key}`).toBe(key);
        }
        for (const [line, key] of view.noteKeyByLine) {
          expect(view.noteLineByKey.get(key), `${key} should map back to line ${line}`).toBe(line);
        }
      });
    }

    it('anchors a mirror document, where every key is positional', () => {
      if (!dirById.has(MIRROR)) return;
      const view = buildJsonView(doc(MIRROR));
      // A spec mirror carries no ids, so nothing here can be anchored by one.
      const anchored = [...view.noteLineByKey.keys()];
      expect(anchored.length).toBeGreaterThan(0);
      for (const key of anchored) {
        const line = view.noteLineByKey.get(key)!;
        expect(view.lines[line]).toMatch(/"(id|pitch)"|\{/);
      }
    });
  });

  describe('degenerate documents', () => {
    // The editor really does start from `{}` (the element-ops campaign's
    // genesis story), so the empty document is a live case, not a curiosity.
    it('renders the empty document', () => {
      const view = buildJsonView({});
      expect(view.text).toBe('{}');
      expect(view.spanByPointer.get('')).toEqual([0, 0]);
      expect(view.noteLineByKey.size).toBe(0);
    });

    it('survives undefined', () => {
      const view = buildJsonView(undefined);
      expect(view.text).toBe('null');
    });
  });
});
