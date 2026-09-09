import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { it, expect } from 'vitest';
// @ts-expect-error plain mjs
import { unrolledHash, unrolledState } from '../verify/unrolled-evidence.mjs';
// @ts-expect-error plain mjs
import { markVerified, invalidateUnrolled } from '../verify/verify-scenarios.mjs';
// Synthetic test records only; never modify corpus approvals.
it('keeps unseen evidence separate, blocks missing files, and detects explicit retirement', () => {
  const meta = {
    unrolled: true,
    status: 'verified',
    verification: { at: '2020-01-01', primitivesHash: 'old' },
  };
  expect(unrolledState(meta, 'new')).toBe('unseen');
  expect(unrolledState(meta, null)).toBe('blocked');
  expect(
    unrolledState({ ...meta, verification: { ...meta.verification, unrolledHash: 'old' } }, 'new'),
  ).toBe('stale');
  expect(
    unrolledState(
      {
        ...meta,
        unrolled: false,
        verification: { ...meta.verification, unrolledHash: 'old' },
      },
      'old',
    ),
  ).toBe('retired-without-review');
});
it('requires current presented evidence to approve unrolled and preserves unrelated provenance', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-unrolled-evidence-'));
  const scenario = { dir };
  const write = (name: string, value: unknown) =>
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n');
  const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  try {
    write('meta.json', {
      unrolled: true,
      status: 'rendered',
      verification: {
        at: '2020-01-01',
        primitivesHash: 'old',
        renderHash: 'old-render',
        bothHash: 'old-both',
        performanceHash: 'old-performance',
        performanceAt: '2020-02-01',
      },
    });
    write('document.mnx.json', { parts: [] });
    write('expected.unrolled.svg', {});
    expect(() => markVerified(scenario, '2026-09-09', { unrolledOnly: true })).toThrow('presented');
    const hash = unrolledHash(scenario);
    markVerified(scenario, '2026-09-09', { unrolledOnly: true, presentedUnrolledHash: hash });
    expect(read().verification).toEqual({
      at: '2020-01-01',
      primitivesHash: 'old',
      renderHash: 'old-render',
      bothHash: 'old-both',
      performanceHash: 'old-performance',
      performanceAt: '2020-02-01',
      unrolledHash: hash,
      unrolledAt: '2026-09-09',
    });
    write('expected.unrolled.svg', { changed: true });
    expect(() => markVerified(scenario, '2026-09-09', { presentedUnrolledHash: hash })).toThrow(
      'changed',
    );
    markVerified(scenario, '2026-09-09');
    expect(read().verification.unrolledHash).toBe(hash); // engraving-only never refreshes it
    invalidateUnrolled(scenario);
    expect(read().status).toBe('rendered');
    expect(unrolledState(read(), unrolledHash(scenario))).toBe('stale');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

it('hashes both required projections and blocks missing tab evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-unrolled-tab-'));
  const scenario = { dir };
  try {
    fs.writeFileSync(
      path.join(dir, 'document.mnx.json'),
      JSON.stringify({ parts: [{ _x: { mnxLab: { tab: { staffKind: 'both' } } } }] }),
    );
    fs.writeFileSync(path.join(dir, 'expected.unrolled.svg'), '<svg/>');
    expect(unrolledHash(scenario)).toBeNull();
    fs.writeFileSync(path.join(dir, 'expected.unrolled.tab.svg'), '<svg/>');
    const first = unrolledHash(scenario);
    fs.writeFileSync(
      path.join(dir, 'expected.unrolled.tab.svg'),
      '<svg><text>changed</text></svg>',
    );
    expect(unrolledHash(scenario)).not.toBe(first);
    fs.unlinkSync(path.join(dir, 'expected.unrolled.svg'));
    expect(unrolledHash(scenario)).toBeNull();
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
