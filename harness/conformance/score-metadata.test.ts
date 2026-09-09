// Document metadata: `_x.mnxLab.work` and `_x.mnxLab.encoding` at the root.
//
// Two claims are worth a test rather than a comment, because both are easy to
// break by accident and neither shows up in a golden:
//
//  1. Metadata NEVER reaches the page. The printed title comes from
//     `scores[].name`, which labels a LAYOUT; nothing in the layout engine
//     reads `work`. If that changed, every scenario's engraving would depend on
//     a field the corpus barely populates, and the change would land silently
//     on the one scenario that does.
//  2. The upgrade shim leaves the block alone. It is v6.2-additive — no hop
//     migrates into or out of it — so a document carrying metadata must come
//     back byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import { upgradeTabExtension } from '../../src/model/upgradeTabExtension.ts';
import {
  creatorsWithRole,
  documentArtist,
  documentTitle,
  documentWork,
  type MnxStructure
} from '../../src/model/mnx.ts';

const SCENARIO = 'scenarios/lab/00-document/05-score-metadata';

function document(): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(SCENARIO, 'document.mnx.json'), 'utf8'));
}

/** The same document with every trace of metadata removed. */
function withoutMetadata(doc: MnxStructure): MnxStructure {
  const clone = JSON.parse(JSON.stringify(doc));
  delete clone._x;
  return clone;
}

describe('score metadata', () => {
  it('never reaches the page', () => {
    // Byte-for-byte identical primitives with and without the block. The
    // printed title is `scores[].name` — a layout label — and the engine has no
    // reason to know a document has an identity at all.
    const doc = document();
    expect(JSON.stringify(computePrimitives(doc))).toBe(
      JSON.stringify(computePrimitives(withoutMetadata(doc)))
    );
  });

  it('survives the load-time upgrade shim untouched', () => {
    const doc = document();
    expect(upgradeTabExtension(doc)._x).toEqual(doc._x);
  });

  it('reads back through the model accessors', () => {
    const doc = document();
    expect(documentTitle(doc)).toBe('The House of the Rising Sun');
    expect(documentArtist(doc)).toBe('The Animals');
    expect(creatorsWithRole(doc, 'composer')).toEqual([
      { role: 'composer', name: 'Traditional' }
    ]);
    // An arranger is a role Guitar Pro cannot hold; the corpus carries one on
    // purpose so the lossy export path has something to warn about.
    expect(creatorsWithRole(doc, 'arranger')).toHaveLength(1);
    expect(documentWork(doc)?.encoding).toBeUndefined();
  });

  it('states nothing for a document that carries no block', () => {
    const bare = withoutMetadata(document());
    expect(documentTitle(bare)).toBeNull();
    expect(documentArtist(bare)).toBeNull();
    expect(documentWork(bare)).toBeUndefined();
    expect(creatorsWithRole(bare, 'composer')).toEqual([]);
  });

  it('validates against the extension schema at the root placement point', async () => {
    const { validateRootExt } = await import('../../worker/generated/validate-extensions.mjs');
    const block = document()._x?.mnxLab;
    expect(validateRootExt(block)).toBe(true);
    // The whole dict is validated, not each block, so a misspelled sibling key
    // is caught — the reason the other three placement points work this way.
    expect(validateRootExt({ ...block, wrok: {} })).toBe(false);
    expect(validateRootExt({ work: { title: 'T', composer: 'X' } })).toBe(false);
    expect(validateRootExt({ encoding: { date: '9 September 2026' } })).toBe(false);
  });
});
