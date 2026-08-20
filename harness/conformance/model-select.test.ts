// The model selector's scoring contract (core-assist-model-selector.md).
// Pure functions, so they test without any dialog chrome — setup-grammar's
// precedent. What is pinned is the CONTRACT, not any particular score:
// the effective price is the workload blend's dot product (cache falling
// back to the input rate), hard filters are hard, unknown data passes
// flagged and scores neutral, and Pareto dominance is respected — a model
// worse-or-equal on every dimension never outranks its dominator.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOKEN_MIX,
  effectivePrice,
  selectModels,
  type CatalogModel,
  type ModelRequirements
} from '../../src/assist/modelSelect.ts';
import { snapshotCatalog } from '../../src/assist/modelCatalog.ts';

function model(partial: Partial<CatalogModel> & { id: string }): CatalogModel {
  return {
    name: partial.id,
    contextLength: 128000,
    pricing: { input: 1, output: 2 },
    parameters: ['tools'],
    ...partial
  };
}

describe('effectivePrice', () => {
  it('is the dot product of the mix with the meters', () => {
    const m = model({ id: 'a', pricing: { input: 3, output: 9, cacheRead: 0.3 } });
    // mix 2:1:1 → (2·3 + 1·9 + 1·0.3) / 4
    expect(effectivePrice(m, { input: 2, output: 1, cached: 1 })).toBeCloseTo(15.3 / 4);
  });

  it('prices cached tokens at the full input rate when no cache meter exists', () => {
    const m = model({ id: 'a', pricing: { input: 3, output: 9 } });
    expect(effectivePrice(m, { input: 2, output: 1, cached: 1 })).toBeCloseTo((6 + 9 + 3) / 4);
  });

  it('a free model blends to zero under any mix', () => {
    const m = model({ id: 'free', pricing: { input: 0, output: 0 } });
    expect(effectivePrice(m, DEFAULT_TOKEN_MIX)).toBe(0);
  });
});

describe('hard constraints', () => {
  const catalog = [
    model({ id: 'tools-yes' }),
    model({ id: 'tools-no', parameters: [] }),
    model({ id: 'small-ctx', contextLength: 8192 }),
    model({ id: 'free', pricing: { input: 0, output: 0 } })
  ];

  it('a missing required parameter excludes, whatever the other dimensions', () => {
    const out = selectModels({ requiredParameters: ['tools'] }, catalog);
    expect(out.map(r => r.model.id)).not.toContain('tools-no');
  });

  it('a context floor excludes below it', () => {
    const out = selectModels({ minContext: 32768 }, catalog);
    expect(out.map(r => r.model.id)).not.toContain('small-ctx');
  });

  it('price ceiling 0 means free-only', () => {
    const out = selectModels({ maxEffectivePrice: 0 }, catalog);
    expect(out.map(r => r.model.id)).toEqual(['free']);
  });

  it('a floor over unknown prior data passes and is flagged — never silent', () => {
    const out = selectModels({ minTokensPerSecond: 50 }, [model({ id: 'no-prior' })]);
    expect(out).toHaveLength(1);
    expect(out[0].flags).toContain('unknown:speed');
    const speed = out[0].dimensions.find(d => d.dimension === 'speed');
    expect(speed?.unknown).toBe(true);
    expect(speed?.utility).toBe(0);
  });

  it('a floor over known prior data is hard', () => {
    const out = selectModels({ minTokensPerSecond: 50 }, [
      model({ id: 'slow', tokensPerSecond: 20 }),
      model({ id: 'fast', tokensPerSecond: 80 })
    ]);
    expect(out.map(r => r.model.id)).toEqual(['fast']);
  });
});

describe('ordering', () => {
  it('exactly meeting every requirement scores 0', () => {
    const m = model({
      id: 'exact',
      contextLength: 32768,
      pricing: { input: 1, output: 1 },
      tokensPerSecond: 50,
      intelligenceIndex: 40
    });
    const [scored] = selectModels(
      { minContext: 32768, maxEffectivePrice: 1, minTokensPerSecond: 50, minIntelligence: 40 },
      [m]
    );
    expect(scored.score).toBeCloseTo(0);
  });

  it('never ranks a dominated model above its dominator', () => {
    // dominator is >= on every dimension (cheaper, bigger context, faster,
    // smarter); the invariant must hold for ANY positive weights.
    const dominated = model({
      id: 'dominated',
      contextLength: 64000,
      pricing: { input: 2, output: 4 },
      tokensPerSecond: 60,
      intelligenceIndex: 50
    });
    const dominator = model({
      id: 'dominator',
      contextLength: 256000,
      pricing: { input: 0.5, output: 1 },
      tokensPerSecond: 120,
      intelligenceIndex: 65
    });
    const req: ModelRequirements = {
      minContext: 32768,
      maxEffectivePrice: 10,
      minTokensPerSecond: 30,
      minIntelligence: 30
    };
    for (const weights of [
      undefined,
      { price: 5, context: 0.1, speed: 0.1, intelligence: 0.1 },
      { price: 0.1, context: 0.1, speed: 0.1, intelligence: 5 }
    ]) {
      const out = selectModels({ ...req, weights }, [dominated, dominator]);
      expect(out[0].model.id).toBe('dominator');
    }
  });

  it('ties break deterministically', () => {
    const a = model({ id: 'b-of-pair' });
    const b = model({ id: 'a-of-pair' });
    const out = selectModels({}, [a, b]);
    expect(out.map(r => r.model.id)).toEqual(['a-of-pair', 'b-of-pair']);
  });
});

describe('the motivating query, against the committed snapshot', () => {
  // 2026-08-20: "the best free model that supports tool calling and isn't
  // crazy slow" — the question the repo could not answer, now a fixture.
  it('free + tools + 32k context returns free tool-callers, best first', () => {
    const out = selectModels(
      {
        requiredParameters: ['tools'],
        minContext: 32768,
        maxEffectivePrice: 0,
        minTokensPerSecond: 30,
        minIntelligence: 30
      },
      snapshotCatalog()
    );
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      expect(r.effectivePrice).toBe(0);
      expect(r.model.parameters).toContain('tools');
      expect(r.model.contextLength).toBeGreaterThanOrEqual(32768);
    }
    // The winner is a model with known priors clearing both floors — not an
    // unknown that squeaked through on flags.
    expect(out[0].flags).toEqual([]);
    expect(out[0].model.intelligenceIndex).toBeGreaterThanOrEqual(30);
  });

  it('the snapshot itself is well-formed', () => {
    const catalog = snapshotCatalog();
    expect(catalog.length).toBeGreaterThan(100);
    const ids = new Set(catalog.map(m => m.id));
    expect(ids.size).toBe(catalog.length);
    for (const m of catalog) {
      expect(m.pricing.input).toBeGreaterThanOrEqual(0);
      expect(m.pricing.output).toBeGreaterThanOrEqual(0);
      expect(m.contextLength).toBeGreaterThanOrEqual(0);
    }
  });
});
