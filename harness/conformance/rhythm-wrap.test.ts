// The wrap verbs (campaign item 11b's construction half).
//
// The tier table can only say a construct op EXISTS for a kind. This says the
// op builds the thing: for every container the corpus actually holds, unwrap it
// out of its own scenario, then rebuild it through navigation + the typed
// declaration and demand the document come back byte-identical.
//
// That round trip is the strongest constructibility claim available — stronger
// than a trace, because the target is a human-verified scenario rather than
// whatever the ops happened to produce.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { driveToElement } from '../../src/edit/destructWalk.ts';
import { parseRhythm } from '../../src/edit/setupGrammar.ts';
import type { PartialContainerSpec } from '../../src/edit/setupGrammar.ts';
import { forEachNoteAddress } from '../../src/model/noteWalk.ts';
import type { MnxSequence, MnxStructure } from '../../src/model/mnx.ts';

const REPO = path.join(__dirname, '../..');
const load = (id: string): MnxStructure =>
  JSON.parse(fs.readFileSync(path.join(REPO, 'scenarios', id, 'score.mnx.json'), 'utf8'));

/** Where a scenario's first container sits, and what it holds. */
function firstContainer(doc: MnxStructure): {
  partIndex: number;
  measureIndex: number;
  sequenceIndex: number;
  index: number;
  seq: MnxSequence;
} | null {
  const parts = doc.parts ?? [];
  for (const [partIndex, part] of parts.entries())
    for (const [measureIndex, measure] of (part.measures ?? []).entries())
      for (const [sequenceIndex, seq] of (measure.sequences ?? []).entries()) {
        const index = seq.content.findIndex(item =>
          ['tuplet', 'grace', 'tremolo', 'space'].includes(
            (item as { type?: string }).type ?? ''
          )
        );
        if (index >= 0) return { partIndex, measureIndex, sequenceIndex, index, seq };
      }
  return null;
}

/** The note key of the note at these coordinates, as the editor addresses it. */
function keyAt(
  doc: MnxStructure,
  where: { partIndex: number; measureIndex: number; sequenceIndex: number; index: number }
): string | null {
  let found: string | null = null;
  forEachNoteAddress(doc, address => {
    if (found !== null) return;
    if (
      address.partIndex === where.partIndex &&
      address.measureIndex === where.measureIndex &&
      address.sequenceIndex === where.sequenceIndex &&
      address.eventIndex === where.index &&
      address.containerIndex === undefined &&
      address.noteIndex === 0
    )
      found = address.key;
  });
  return found;
}

/**
 * Each corpus container, and the text a player types to build it. The text is
 * the whole gesture — there is no anchor to arm, because the declaration says
 * how much music it takes.
 */
const CASES: { id: string; typed: string }[] = [
  { id: 'spec/tuplets', typed: '3 eighth in 2 eighth' },
  { id: 'lab/11-rhythm/02-tuplet-number-hidden', typed: '3 eighth in 1 quarter, no number' },
  { id: 'spec/grace-note', typed: 'grace' },
  { id: 'lab/11-rhythm/01-appoggiatura', typed: 'appoggiatura' },
  { id: 'spec/tremolos-multi-note', typed: 'tremolo 2' },
  { id: 'spec/tie-targets', typed: 'space 1/4' }
];

describe('rhythm declarations: unwrap a corpus container, then rebuild it', () => {
  for (const { id, typed } of CASES) {
    it(`${id}: "${typed}" reconstructs the document`, () => {
      const original = load(id);
      const site = firstContainer(original)!;
      expect(site, `${id} holds no container`).not.toBeNull();

      // Take the container out, leaving its content where it stood — the state
      // an author is in just before they declare it.
      const stripped = JSON.parse(JSON.stringify(original)) as MnxStructure;
      const seq = stripped.parts![site.partIndex].measures![site.measureIndex].sequences![
        site.sequenceIndex
      ];
      const container = seq.content[site.index] as { type: string; content?: unknown[] };
      seq.content = [
        ...seq.content.slice(0, site.index),
        ...((container.content ?? []) as MnxSequence['content']),
        ...seq.content.slice(site.index + 1)
      ];

      // Navigate there the way a player would, then type the declaration.
      const session = new EditorSession(stripped, id);
      const anchorKey =
        keyAt(stripped, site) ??
        // A `space` holds no events: its slot is now occupied by whatever
        // followed it, which is where the insert belongs.
        keyAt(stripped, { ...site, index: site.index });
      expect(anchorKey, `${id}: nothing to navigate to`).not.toBeNull();
      expect(driveToElement(session, anchorKey!), `${id}: could not reach the run`).toBe(true);

      const parsed = parseRhythm(typed);
      expect(parsed, `${id}: "${typed}" did not parse`).not.toBeNull();
      const applied =
        parsed && 'space' in parsed
          ? session.handleIntent({ type: 'insertSpace', duration: parsed.space })
          : session.handleIntent({
              type: 'wrapInContainer',
              spec: (parsed as { wrap: PartialContainerSpec }).wrap,
              ...((parsed as { count?: number }).count === undefined
                ? {}
                : { count: (parsed as { count?: number }).count })
            });
      expect(applied, `${id}: the declaration did not apply`).toBe(true);
      expect(session.doc).toEqual(original);
    });
  }
});

describe('the typed grammar', () => {
  it('reads the ratio, the full form and the display suffixes', () => {
    expect(parseRhythm('3:2')).toEqual({
      wrap: { type: 'tuplet', inner: { multiple: 3 }, outer: { multiple: 2 } }
    });
    expect(parseRhythm('3 eighth in 1 quarter, no number')).toEqual({
      wrap: {
        type: 'tuplet',
        inner: { multiple: 3, duration: { base: 'eighth' } },
        outer: { multiple: 1, duration: { base: 'quarter' } },
        showNumber: 'noNumber'
      }
    });
    expect(parseRhythm('acciaccatura')).toEqual({ wrap: { type: 'grace', slash: true } });
    expect(parseRhythm('grace 2')).toEqual({ wrap: { type: 'grace' }, count: 2 });
    expect(parseRhythm('space 3/8')).toEqual({ space: [3, 8] });
    expect(parseRhythm('3 sausages in 2 eighth')).toBeNull();
    expect(parseRhythm('3:2, no idea')).toBeNull();
  });
});

describe('rest spelling as a verb', () => {
  /** An empty 4/4 bar, padded the way entry pads it: four beat rests. */
  const padded = (): MnxStructure =>
    ({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          measures: [
            {
              clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
              sequences: [
                {
                  content: Array.from({ length: 4 }, () => ({
                    type: 'event' as const,
                    duration: { base: 'quarter' as const },
                    rest: {}
                  }))
                }
              ]
            }
          ]
        }
      ]
    }) as MnxStructure;

  const spell = (base: string, steps = 0): MnxStructure => {
    const session = new EditorSession(padded());
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    for (let i = 0; i < steps; i++) session.handleIntent({ type: 'nextPosition' });
    session.handleIntent({
      type: 'setRestSpelling',
      duration: { base: base as 'half' }
    });
    return session.doc;
  };

  it('joins beat rests into the one an engraver writes', () => {
    const content = spell('half').parts![0].measures![0].sequences![0].content;
    expect(content).toEqual([
      { duration: { base: 'half' }, rest: {} },
      { type: 'event', duration: { base: 'quarter' }, rest: {} },
      { type: 'event', duration: { base: 'quarter' }, rest: {} }
    ]);
  });

  it('refuses a value no run of rests sums to', () => {
    // Starting on beat 3, only two quarters remain — a whole cannot be spelled.
    const content = spell('whole', 2).parts![0].measures![0].sequences![0].content;
    expect(content.length).toBe(4);
  });
});

describe('what a wrap refuses', () => {
  /** Four quarters in one 4/4 bar — room to overshoot and to nest. */
  const plain = (): MnxStructure =>
    ({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          measures: [
            {
              clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
              sequences: [
                {
                  content: (['C', 'D', 'E', 'F'] as const).map(step => ({
                    type: 'event' as const,
                    duration: { base: 'quarter' as const },
                    notes: [{ pitch: { step, octave: 4 } }]
                  }))
                }
              ]
            }
          ]
        }
      ]
    }) as MnxStructure;

  const wrap = (spec: PartialContainerSpec, count?: number): boolean => {
    const session = new EditorSession(plain());
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    return session.handleIntent({
      type: 'wrapInContainer',
      spec,
      ...(count === undefined ? {} : { count })
    });
  };

  it('takes the events that fill the inner value, and no more', () => {
    // Three quarters fill "3 quarter in 2 quarter" exactly.
    expect(wrap({ type: 'tuplet', inner: { multiple: 3 }, outer: { multiple: 2 } })).toBe(true);
    // Nothing in the bar sums to seven quarters, so the run never closes.
    expect(wrap({ type: 'tuplet', inner: { multiple: 7 }, outer: { multiple: 4 } })).toBe(false);
  });

  it('refuses a tremolo that is not two events', () => {
    expect(wrap({ type: 'tremolo', marks: 2 })).toBe(true);
    expect(wrap({ type: 'tremolo', marks: 2 }, 3)).toBe(false);
  });

  it('refuses to nest: a wrapped note cannot be wrapped again', () => {
    const session = new EditorSession(plain());
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    expect(
      session.handleIntent({
        type: 'wrapInContainer',
        spec: { type: 'tuplet', inner: { multiple: 3 }, outer: { multiple: 2 } }
      })
    ).toBe(true);
    // The cursor is now on ink INSIDE the tuplet, and there is no shape for a
    // tuplet in a tuplet — the renderer would draw blank columns.
    expect(
      session.handleIntent({
        type: 'wrapInContainer',
        spec: { type: 'grace' }
      })
    ).toBe(false);
  });

  it('undoes byte-identically — the campaign oracle', () => {
    const doc = plain();
    const session = new EditorSession(doc);
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    const before = JSON.stringify(session.doc);
    session.handleIntent({
      type: 'wrapInContainer',
      spec: { type: 'tuplet', inner: { multiple: 3 }, outer: { multiple: 2 } }
    });
    session.handleIntent({ type: 'insertSpace', duration: [1, 4] });
    expect(JSON.stringify(session.doc)).not.toBe(before);
    session.handleIntent({ type: 'undo' });
    session.handleIntent({ type: 'undo' });
    expect(JSON.stringify(session.doc)).toBe(before);
  });
});
