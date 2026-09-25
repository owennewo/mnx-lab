import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { createContext, loadCorpus, checkScenario, checkManifest, computeExtensionVerdict } from '../verify/check-scenarios.mjs';
import triplets from '../../scenarios/lab/26-tab-rhythm/01-triplets-on-tab/document.mnx.json';

const ctx = createContext();
const corpus = loadCorpus();

describe('the note-extension verdict', () => {
  // A walk that stopped at a sequence's top level passed a bad note extension
  // inside any container unchecked — and tuplets and grace groups are containers.
  type Item = { type?: string; notes?: { _x?: unknown }[]; content?: Item[] };
  const withBadNoteIn = (container: 'tuplet' | 'grace') => {
    const doc = structuredClone(triplets) as unknown as { parts: { measures: { sequences: { content: Item[] }[] }[] }[] };
    const content = doc.parts[0].measures[0].sequences[0].content;
    let holder = content.find(item => item.type === container);
    if (!holder) {
      const event = content.find(item => item.notes?.length)!;
      holder = { type: 'grace', content: [structuredClone(event)] };
      content.unshift(holder);
    }
    holder.content!.find(item => item.notes?.length)!.notes![0]._x = { mnxLab: { notAField: true } };
    return doc;
  };

  it('holds the unmodified fixture valid', () => {
    expect(computeExtensionVerdict(triplets, ctx).verdict).toBe('valid');
  });
  for (const container of ['tuplet', 'grace'] as const) {
    it(`finds a bad note extension inside a ${container}`, () => {
      expect(computeExtensionVerdict(withBadNoteIn(container), ctx).verdict).toBe('invalid');
    });
  }
});

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
