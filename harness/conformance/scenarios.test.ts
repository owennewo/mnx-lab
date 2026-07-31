import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { createContext, loadCorpus, checkScenario } from '../verify/check-scenarios.mjs';

const ctx = createContext();
const corpus = loadCorpus();

describe('scenario corpus', () => {
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
