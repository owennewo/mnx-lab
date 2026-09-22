import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { createContext, loadCorpus, checkScenario, checkManifest } from '../verify/check-scenarios.mjs';

const ctx = createContext();
const corpus = loadCorpus();

describe('scenario corpus', () => {
  it('keeps the manifest schema versions aligned with their schema IDs', () => {
    expect(checkManifest(ctx)).toEqual([]);
    for (const key of ['mnxSchemaVersion', 'extensionVersion']) {
      expect(checkManifest({ ...ctx, manifest: { ...ctx.manifest, [key]: 'stale' } }))
        .toHaveLength(1);
    }
  });

  it('contains at least one scenario', () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const scenario of corpus) {
    it(scenario.id, () => {
      const { errors } = checkScenario(scenario, ctx);
      expect(errors).toEqual([]);
    });
  }
});
