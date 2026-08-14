// The viewer surface's engine-side contract (docs/core-viewer-surface.md).
//
// Two rules are asserted here because they are the ones that rot quietly:
//
//  1. `view="auto"` resolves the DOCUMENT's hint. The element's own
//     resolution needs a browser, but the rule it resolves is pure — one
//     reading of `staffKind`, shared with the engine's tab gate, so the two
//     can never drift into different definitions of what a document means.
//
//  2. The `hide` set's LAYOUT/EMIT split. Hiding lyrics must reclaim the
//     vertical band they reserve — an engine concern, which CSS could not do.
//     Hiding badges must NOT move the layout, which is what makes CSS the
//     honest tool there. If either flips, the contract's sorting question
//     ("does hiding it reclaim space?") has been answered differently and the
//     doc needs rewriting — this test is where that gets noticed.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { declaredStaffKind, wantsTabView } from '../../src/model/mnx.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const dirById = new Map<string, string>(
  loadCorpus().map((s: { id: string; dir: string }) => [s.id, s.dir])
);

function doc(id: string): MnxStructure {
  const dir = dirById.get(id);
  if (!dir) throw new Error(`unknown scenario id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
}

describe('viewer surface', () => {
  describe('the document hint (view="auto" resolves this)', () => {
    it('reads a declared staffKind', () => {
      expect(declaredStaffKind(doc('lab/tab-positions/open-strings-chord'))).toBe('both');
      expect(wantsTabView(doc('lab/tab-positions/open-strings-chord'))).toBe(true);
    });

    it('is undefined when no part declares one — the signal to fall through', () => {
      // Declaring strings is NOT declaring a view: this document has a
      // fingerboard and asks for notation. A host that conflates the two shows
      // tab the author never requested (which is what the embed app did).
      expect(declaredStaffKind(doc('lab/document/twelve-bar-blues'))).toBeUndefined();
      expect(wantsTabView(doc('lab/document/twelve-bar-blues'))).toBe(false);
    });

    it('survives an empty document', () => {
      expect(declaredStaffKind({} as MnxStructure)).toBeUndefined();
    });
  });

  describe('the hide set', () => {
    it('lyrics is LAYOUT-side: hiding reclaims the band', () => {
      initSmufl();
      const lyrics = doc('lab/lyrics/verse-labels');
      const shown = layoutNotation({ mnx: lyrics, widthSp: 80 });
      const hidden = layoutNotation({ mnx: lyrics, widthSp: 80, hide: ['lyrics'] });
      // Both halves matter: the ink goes AND the space closes up. CSS could
      // manage the first and never the second.
      expect(hidden.primitives.length).toBeLessThan(shown.primitives.length);
      expect(hidden.heightSp).toBeLessThan(shown.heightSp);
    });

    it('badges is EMIT-side: hiding must not move the layout', () => {
      initSmufl();
      // A document whose bars carry diagnostics, so badges are actually drawn.
      const mismatched = doc('lab/edge-cases/bar-duration-mismatch');
      const shown = layoutNotation({ mnx: mismatched, widthSp: 80 });
      const hidden = layoutNotation({ mnx: mismatched, widthSp: 80, hide: ['badges'] });
      expect(hidden.heightSp).toBe(shown.heightSp);
      expect(hidden.usedWidthSp).toBe(shown.usedWidthSp);
      // …which is precisely why the element hides them in CSS instead.
    });

    it('an unknown feature is ignored, not fatal', () => {
      initSmufl();
      const simple = doc('lab/document/minimal-single-note');
      const base = layoutNotation({ mnx: simple, widthSp: 80 });
      const odd = layoutNotation({
        mnx: simple,
        widthSp: 80,
        hide: ['nonsense' as unknown as 'lyrics']
      });
      expect(odd.heightSp).toBe(base.heightSp);
    });
  });
});
