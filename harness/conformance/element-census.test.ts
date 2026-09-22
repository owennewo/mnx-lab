// The ink census join — "an element is anything the renderer draws
// distinguishable ink for", made checkable (campaign item 2,
// roadmap/complete/core-element-ops-destruct-sweep.md).
//
// The walker is document-side by necessity: of the primitives in the committed
// goldens, only noteheads and fret numbers carry a `sourceId`, so the render
// output cannot say which document node caused most of its ink. This join is
// what keeps that walk honest in the other direction — every primitive class
// drawn anywhere in the corpus must be CLAIMED by an element kind or listed as
// structural, with a reason. A renderer feature that draws something new
// (chord symbols, technique) turns red here until the campaign decides which
// kind owns it, which is exactly the conversation the campaign exists to have.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ELEMENT_KINDS, STRUCTURAL_CLASSES, walkElements } from '../../src/edit/elementWalk.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface Scenario { id: string; dir: string }
const corpus = loadCorpus() as Scenario[];

/** Every class token drawn in the committed goldens → the scenarios drawing it. */
function censusClasses(): Map<string, Set<string>> {
  const census = new Map<string, Set<string>>();
  for (const scenario of corpus) {
    const file = path.join(scenario.dir, 'expected.primitives.json');
    if (!fs.existsSync(file)) continue; // invalid-by-design scenarios have no goldens
    const seen = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (typeof record.kind === 'string' && typeof record.className === 'string')
        for (const token of record.className.split(/\s+/).filter(Boolean))
          (census.get(token) ?? census.set(token, new Set()).get(token)!).add(scenario.id);
      Object.values(record).forEach(visit);
    };
    visit(seen);
  }
  return census;
}

const CLAIMED = new Map<string, string[]>();
for (const [kind, spec] of Object.entries(ELEMENT_KINDS))
  for (const className of spec.classes)
    CLAIMED.set(className, [...(CLAIMED.get(className) ?? []), kind]);

describe('ink census (element-ops campaign)', () => {
  const census = censusClasses();

  it('every drawn class is claimed by an element kind or declared structural', () => {
    const unaccounted = [...census.keys()]
      .filter(token => !CLAIMED.has(token) && !(token in STRUCTURAL_CLASSES))
      .sort();
    expect(
      unaccounted,
      `${unaccounted.length} primitive class(es) belong to no element kind and are not ` +
        `declared structural — decide which kind owns them in src/edit/elementWalk.ts: ` +
        unaccounted.map(t => `${t} (${[...census.get(t)!].slice(0, 2).join(', ')})`).join('; ')
    ).toEqual([]);
  });

  it('no class is claimed AND declared structural', () => {
    const both = [...CLAIMED.keys()].filter(token => token in STRUCTURAL_CLASSES).sort();
    expect(both, 'a class is either a consequence or an element’s ink, never both').toEqual([]);
  });

  it('every structural entry carries a reason', () => {
    for (const [token, reason] of Object.entries(STRUCTURAL_CLASSES))
      expect(reason.length, `structural class ${token} has no reason`).toBeGreaterThan(8);
  });

  it('every claimed class is actually drawn somewhere in the corpus', () => {
    // A claim nothing draws is either a renderer gap recorded as a class name
    // (wrong: gaps are recorded as an EMPTY class list) or a typo.
    const phantom = [...CLAIMED.keys()].filter(token => !census.has(token)).sort();
    expect(phantom, 'claimed classes the corpus never draws').toEqual([]);
  });

  it('walks every scenario without throwing, and addresses only the entry surface', () => {
    for (const scenario of corpus) {
      const doc = JSON.parse(
        fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')
      ) as MnxStructure;
      const elements = walkElements(doc);
      // Element paths are the report's row keys: they must be unique.
      const paths = new Set(elements.map(e => e.path));
      expect(paths.size, `${scenario.id}: duplicate element paths`).toBe(elements.length);
      // A note key is a promise that `deleteNote` can name it — only notes in
      // parts[0], staff 1, outside containers get one.
      for (const element of elements)
        if (element.noteKey !== undefined)
          expect(element.kind, `${scenario.id}: ${element.path} carries a note key`).toBe('note');
    }
  });
});
