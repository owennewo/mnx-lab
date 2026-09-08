import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { it, expect } from 'vitest';
// @ts-expect-error plain mjs
import { performanceHash, performanceState } from '../verify/performance-evidence.mjs';
// @ts-expect-error plain mjs
import { markVerified, invalidatePerformance } from '../verify/verify-scenarios.mjs';
// Synthetic test records only; never modify corpus approvals.
it('keeps unseen evidence separate, blocks missing files, and detects explicit retirement', () => {
  const meta = {
    performance: true,
    status: 'verified',
    verification: { at: '2020-01-01', primitivesHash: 'old' },
  };
  expect(performanceState(meta, 'new')).toBe('unseen');
  expect(performanceState(meta, null)).toBe('blocked');
  expect(
    performanceState(
      { ...meta, verification: { ...meta.verification, performanceHash: 'old' } },
      'new',
    ),
  ).toBe('stale');
  expect(
    performanceState(
      {
        ...meta,
        performance: false,
        verification: { ...meta.verification, performanceHash: 'old' },
      },
      'old',
    ),
  ).toBe('retired-without-review');
});
it('requires current presented evidence to approve performance and preserves unrelated provenance', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-performance-evidence-'));
  const scenario = { dir };
  const write = (name: string, value: unknown) =>
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n');
  const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  try {
    write('meta.json', {
      performance: true,
      status: 'rendered',
      verification: {
        at: '2020-01-01',
        primitivesHash: 'old',
        renderHash: 'old-render',
        bothHash: 'old-both',
      },
    });
    write('expected.performance.json', {});
    write('expected.midi.json', {});
    expect(() => markVerified(scenario, '2026-09-09', { performanceOnly: true })).toThrow(
      'presented',
    );
    const hash = performanceHash(scenario);
    markVerified(scenario, '2026-09-09', { performanceOnly: true, presentedPerformanceHash: hash });
    expect(read().verification).toEqual({
      at: '2020-01-01',
      primitivesHash: 'old',
      renderHash: 'old-render',
      bothHash: 'old-both',
      performanceHash: hash,
      performanceAt: '2026-09-09',
    });
    write('expected.performance.json', { changed: true });
    expect(() => markVerified(scenario, '2026-09-09', { presentedPerformanceHash: hash })).toThrow(
      'changed',
    );
    markVerified(scenario, '2026-09-09');
    expect(read().verification.performanceHash).toBe(hash); // engraving-only never refreshes it
    invalidatePerformance(scenario);
    expect(read().status).toBe('rendered');
    expect(performanceState(read(), performanceHash(scenario))).toBe('stale');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
