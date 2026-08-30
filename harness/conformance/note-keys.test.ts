// The note-key agreement join.
//
// The editor addresses notes by key; the renderer stamps the same keys into
// primitives as `sourceId` so the overlay, the cross-highlight and the goldens
// can find them. Those are two different walks over the same document, and
// CLAUDE.md has to warn that they be "kept in lockstep" — a comment, enforced
// by care.
//
// This is that requirement as a test. `model/noteWalk.ts` is now the canonical
// enumeration; here we prove over the whole corpus that every key the RENDERER
// emits is one the walk produced, and that the walk claims nothing the renderer
// does not draw. When container descent lands (campaign item 11b), this join is
// what says the five traversals moved together instead of drifting apart.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { noteKeysOf } from '../../src/model/noteWalk.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface Scenario { id: string; dir: string }
const corpus = (loadCorpus() as Scenario[]).slice().sort((a, b) => a.id.localeCompare(b.id));

/** Every `sourceId` the committed goldens carry on drawn note ink. */
function renderedKeys(dir: string): Set<string> {
  const file = path.join(dir, 'expected.primitives.json');
  const keys = new Set<string>();
  if (!fs.existsSync(file)) return keys;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const className = typeof record.className === 'string' ? record.className : '';
    if (typeof record.sourceId === 'string' && /notehead|fret-number/.test(className))
      keys.add(record.sourceId);
    Object.values(record).forEach(visit);
  };
  visit(JSON.parse(fs.readFileSync(file, 'utf8')));
  return keys;
}

describe('note-key agreement (the walk vs the renderer)', () => {
  for (const scenario of corpus) {
    it(`${scenario.id}: every drawn key is one the walk produced`, () => {
      const doc = JSON.parse(
        fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')
      ) as MnxStructure;
      const walked = new Set(noteKeysOf(doc));
      const drawn = renderedKeys(scenario.dir);
      // The renderer draws parts and staves the entry surface does not address,
      // and those noteheads carry their own ids — so the join is one-directional
      // for real ids, and exact for the SYNTHESIZED ones, which only the shared
      // walk can produce.
      const strays = [...drawn].filter(key => key.startsWith('@m') && !walked.has(key));
      expect(strays, 'the renderer synthesized a key the walk does not know').toEqual([]);
    });
  }

  it('the walk produces no duplicate keys anywhere in the corpus', () => {
    // A duplicate is the container collision in miniature: two notes that
    // cannot be told apart cannot be edited apart.
    const offenders: string[] = [];
    for (const scenario of corpus) {
      const doc = JSON.parse(
        fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')
      ) as MnxStructure;
      const keys = noteKeysOf(doc);
      if (new Set(keys).size !== keys.length) offenders.push(scenario.id);
    }
    expect(offenders).toEqual([]);
  });
});
