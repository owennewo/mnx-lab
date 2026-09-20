// The REST-key agreement join — the note-key join's other half.
//
// `model/restSpans.ts` tells the playhead which rest it is standing in, and
// the answer is only useful if the key it spells is the one the renderer
// stamped on the drawn rest. Those are two walks over one document, the same
// standing hazard `note-keys.test.ts` exists for, so the same proof: over the
// whole corpus, every rest the lookup claims must be a rest the goldens drew.
//
// One-directional by design. The renderer draws rests the lookup does not
// claim — a rest inside a tuplet (whose key carries no container index, so
// the lookup passes it over rather than answering to an ambiguous name) and
// the synthesized full-measure rest of a bar that holds no event at all.
// Nothing in the other direction is acceptable: a claimed rest that was never
// drawn is a playhead pointing at nothing.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { restSpansOf, restsAt } from '../../src/model/restSpans.ts';
import { rational, ZERO } from '../../src/model/time.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface Scenario { id: string; dir: string }
const corpus = (loadCorpus() as Scenario[]).slice().sort((a, b) => a.id.localeCompare(b.id));

/** Every `sourceId` the committed goldens carry on drawn rest ink. */
function renderedRestKeys(dir: string): Set<string> {
  const file = path.join(dir, 'expected.primitives.json');
  const keys = new Set<string>();
  if (!fs.existsSync(file)) return keys;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const className = typeof record.className === 'string' ? record.className : '';
    if (typeof record.sourceId === 'string' && /\brest\b/.test(className)) keys.add(record.sourceId);
    Object.values(record).forEach(visit);
  };
  visit(JSON.parse(fs.readFileSync(file, 'utf8')));
  return keys;
}

describe('rest-key agreement (the lookup vs the renderer)', () => {
  for (const scenario of corpus) {
    const file = path.join(scenario.dir, 'expected.primitives.json');
    if (!fs.existsSync(file)) continue;
    it(`${scenario.id}: every rest the playhead can claim was drawn`, () => {
      const doc = JSON.parse(
        fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')
      ) as MnxStructure;
      const drawn = renderedRestKeys(scenario.dir);
      // Only the SYNTHESIZED keys can be joined: a rest with an `id` of its
      // own is drawn under that id in parts the goldens may not render.
      const claimed = restSpansOf(doc).map(span => span.key).filter(key => key.startsWith('@m'));
      const strays = claimed.filter(key => !drawn.has(key));
      expect(strays, 'the playhead would point at a rest nothing drew').toEqual([]);
    });
  }
});

/** Two voices on one staff: voice 0 rests on beat 1, voice 1 on beats 3–4. */
function twoVoices(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'p1',
      measures: [{
        sequences: [
          { content: [
            { duration: { base: 'quarter' }, rest: {} },
            { duration: { base: 'half', dots: 1 }, notes: [{ pitch: { step: 'C', octave: 4 } }] }
          ] },
          { content: [
            { duration: { base: 'half' }, notes: [{ pitch: { step: 'E', octave: 4 } }] },
            { duration: { base: 'half' }, rest: {} }
          ] }
        ]
      }]
    }]
  } as MnxStructure;
}

describe('which rest the playhead is standing in', () => {
  const spans = restSpansOf(twoVoices());

  it('finds every drawn rest, with its voice and its written extent', () => {
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ voiceIndex: 0, measureIndex: 0, start: ZERO });
    expect(spans[1]).toMatchObject({ voiceIndex: 1, measureIndex: 0, start: rational(1n, 2n) });
  });

  it('owns its onset and not its end', () => {
    // Beat 1: voice 0 rests, voice 1 plays.
    expect(restsAt(spans, 0, ZERO).map(s => s.voiceIndex)).toEqual([0]);
    // The quarter rest ends exactly here — the note that follows owns it.
    expect(restsAt(spans, 0, rational(1n, 4n))).toEqual([]);
    // Beat 3: voice 1's half rest begins; voice 0 is holding a dotted half.
    expect(restsAt(spans, 0, rational(1n, 2n)).map(s => s.voiceIndex)).toEqual([1]);
    expect(restsAt(spans, 0, rational(3n, 4n)).map(s => s.voiceIndex)).toEqual([1]);
    // The bar's end belongs to the next bar.
    expect(restsAt(spans, 0, rational(1n, 1n))).toEqual([]);
  });

  it('never answers for another bar', () => {
    expect(restsAt(spans, 1, ZERO)).toEqual([]);
  });
});

describe('what a container does to the offsets after it', () => {
  it('advances by the tuplet´s outer value, so the rest after it is found', () => {
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [{
        id: 'p1',
        measures: [{
          sequences: [{ content: [
            { type: 'tuplet', outer: { duration: { base: 'half' }, multiple: 1 },
              inner: { duration: { base: 'quarter' }, multiple: 3 },
              content: [
                { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'C', octave: 4 } }] },
                { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'D', octave: 4 } }] },
                { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'E', octave: 4 } }] }
              ] },
            { duration: { base: 'half' }, rest: {} }
          ] }]
        }]
      }]
    } as unknown as MnxStructure;
    const spans = restSpansOf(doc);
    expect(spans).toHaveLength(1);
    // The triplet spans a half note, so the rest starts halfway through the bar.
    expect(spans[0].start).toEqual(rational(1n, 2n));
    expect(restsAt(spans, 0, rational(1n, 4n))).toEqual([]);
    expect(restsAt(spans, 0, rational(5n, 8n))).toHaveLength(1);
  });

  it('advances over a `space`, whose duration is a fraction and not a note value', () => {
    // The shape that broke the first draft: `sequenceItemKind` calls a space
    // an event, but its duration is [1, 4] of a whole note. Read as a note
    // value it throws; skipped entirely it puts this rest a beat early.
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [{
        id: 'p1',
        measures: [{
          sequences: [{ content: [
            { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'C', octave: 4 } }] },
            { type: 'space', duration: [1, 4] },
            { duration: { base: 'half' }, rest: {} }
          ] }]
        }]
      }]
    } as unknown as MnxStructure;
    const spans = restSpansOf(doc);
    expect(spans).toHaveLength(1); // the space itself is not a rest
    expect(spans[0].start).toEqual(rational(1n, 2n));
  });

  it('gives a grace note no metric time of its own', () => {
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [{
        id: 'p1',
        measures: [{
          sequences: [{ content: [
            { type: 'grace', content: [
              { duration: { base: 'eighth' }, notes: [{ pitch: { step: 'B', octave: 3 } }] }
            ] },
            { duration: { base: 'whole' }, rest: {} }
          ] }]
        }]
      }]
    } as unknown as MnxStructure;
    expect(restSpansOf(doc)[0].start).toEqual(ZERO);
  });
});
