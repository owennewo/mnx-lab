// The def walker, checked against the spec's own answer.
//
// `harness/helpers/mnxDefs.ts` reimplements what upstream computes in
// accumulate_used_json_objects(): which schema objects a document instantiates.
// The converter matrix needs it for documents that are not scenarios — a
// fixture, or the same fixture after a round trip — but a second opinion about
// coverage is worth nothing unless it agrees with the first one where both
// apply. The 52 mirrored spec scenarios are where both apply.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { defsInDocument, extensionKeysInDocument } from '../helpers/mnxDefs.ts';

const SPEC_DIR = path.join(
  path.dirname(path.dirname(new URL(import.meta.url).pathname)),
  '..',
  'scenarios',
  'spec'
);

/**
 * Defs upstream's join claims for documents that do not contain them.
 *
 * Both are OPTIONAL properties of an object the document does use: an `event`
 * may carry `"type": "event"` and a global measure may carry `number`, and none
 * of these documents writes either. So upstream's join is reachability-shaped —
 * it credits what the used objects *could* carry — while this walker is
 * instantiation-shaped, crediting only what is written down.
 *
 * Instantiation is the right question for the matrix: "did this survive the
 * round trip" is meaningless for a key that was never there. The divergence is
 * pinned here rather than papered over, so a THIRD kind of miss fails the test.
 */
const REACHABLE_BUT_UNWRITTEN = new Set(['measure-number', 'literal-string-event']);

const slugs = fs
  .readdirSync(SPEC_DIR)
  .filter(slug => fs.existsSync(path.join(SPEC_DIR, slug, 'meta.json')))
  .sort();

describe('defsInDocument', () => {
  it('finds every def the spec claims, except what the document never wrote', () => {
    const unexplained: string[] = [];
    for (const slug of slugs) {
      const meta = JSON.parse(fs.readFileSync(path.join(SPEC_DIR, slug, 'meta.json'), 'utf8'));
      const document = JSON.parse(
        fs.readFileSync(path.join(SPEC_DIR, slug, 'document.mnx.json'), 'utf8')
      );
      const found = defsInDocument(document);
      for (const claimed of (meta.coversDefs ?? []) as string[]) {
        if (found.has(claimed) || REACHABLE_BUT_UNWRITTEN.has(claimed)) continue;
        unexplained.push(`${slug}: ${claimed}`);
      }
    }
    expect(unexplained).toEqual([]);
  });

  it('covers the corpus rather than a corner of it', () => {
    // A walker that returned {} for everything would pass the test above.
    expect(slugs.length).toBeGreaterThan(40);
    const everything = new Set<string>();
    for (const slug of slugs) {
      const document = JSON.parse(
        fs.readFileSync(path.join(SPEC_DIR, slug, 'document.mnx.json'), 'utf8')
      );
      for (const def of defsInDocument(document)) everything.add(def);
    }
    expect(everything.size).toBeGreaterThan(100);
  });
});

describe('extensionKeysInDocument', () => {
  it('names the vendor keys a document carries, and nothing when it carries none', () => {
    const plain = JSON.parse(
      fs.readFileSync(path.join(SPEC_DIR, 'hello-world', 'document.mnx.json'), 'utf8')
    );
    expect([...extensionKeysInDocument(plain)]).toEqual([]);

    const tabbed = {
      parts: [
        {
          _x: { mnxLab: { strings: [], capo: 2 } },
          measures: [
            { sequences: [{ content: [{ notes: [{ _x: { mnxLab: { string: 1, fret: 3 } } }] }] }] }
          ]
        }
      ]
    };
    expect([...extensionKeysInDocument(tabbed)].sort()).toEqual([
      '_x.mnxLab.capo',
      '_x.mnxLab.fret',
      '_x.mnxLab.string',
      '_x.mnxLab.strings'
    ]);
  });
});
