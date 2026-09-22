import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brokenLocalMarkdownLinks, localMarkdownDestinations } from '../helpers/localMarkdownLinks.ts';

describe('current reference links', () => {
  it('resolves files relative to the document and reports a moved target', () => {
    const root = mkdtempSync(join(tmpdir(), 'mnx-doc-links-'));
    try {
      mkdirSync(join(root, 'docs'));
      writeFileSync(join(root, 'name (one).md'), 'target');
      writeFileSync(join(root, 'docs/index.md'), '[ok](../name%20(one).md#heading)\n[missing][gone]\n[gone]: ../moved.md\n[root](/name%20(one).md)');
      expect(brokenLocalMarkdownLinks(root, ['docs/index.md'])).toEqual(['docs/index.md: ../moved.md']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('checks images and angle destinations while ignoring external URLs and code examples', () => {
    expect(localMarkdownDestinations([
      '![image](image.svg) [space](<a b.md> "Title")',
      '[web](https://example.com) [mail](mailto:a@example.com) [anchor](#heading)',
      '[protocol](//example.com) [query](?view=1)',
      '`[inline](missing.md)` <!-- [comment](missing.md) -->',
      '```md\n[fenced](missing.md)\n```',
      '~~~\n[tilde](missing.md)\n~~~',
    ].join('\n'))).toEqual(['image.svg', 'a b.md']);
  });

  it('keeps local file destinations in current repository references valid', () => {
    expect(brokenLocalMarkdownLinks(resolve(import.meta.dirname, '../..'))).toEqual([]);
  });
});
