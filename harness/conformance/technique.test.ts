import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { bendLabel } from '../../src/engine/layout/technique.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure, MnxTabTechnique } from '../../src/model/mnx.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';

/**
 * PLAYING TECHNIQUE — that it is DRAWN, and drawn as the thing it is.
 *
 * The corpus goldens pin the coordinates; this file pins the claims a reader
 * of a guitar score would make, which is the half a golden cannot state. The
 * gap it closes is the one core-guitar-technique.md opened with: technique
 * travelled through both converters and the schema for a month with nothing
 * drawing it, and the way that failure LOOKED was a perfectly clean render of
 * a score that was quietly telling the player to pick every note.
 *
 * So every assertion here is of the form "this technique reaches the page",
 * and each one fails if the marks are dropped, whichever staff drops them.
 */

const SCENARIOS = path.resolve(__dirname, '../../scenarios/lab/25-tab-techniques');

function readScenario(name: string): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(SCENARIOS, name, 'document.mnx.json'), 'utf8'));
}

const cls = (p: Primitive) => (p.className ?? '').split(' ');
const marks = (layout: LayoutResult, token: string): Primitive[] =>
  layout.primitives.filter(p => cls(p).includes(token));
const texts = (layout: LayoutResult, token: string): string[] =>
  marks(layout, token).map(p => (p.kind === 'text' ? p.text : ''));

/** The three projections a tab-opting document has. */
function projections(doc: MnxStructure): Record<'notation' | 'tab' | 'both', LayoutResult> {
  initSmufl();
  return {
    notation: layoutNotation({ mnx: doc, widthSp: WIDTH_SP }),
    tab: layoutTab({ mnx: doc, widthSp: WIDTH_SP }),
    both: layoutBothSystem({ mnx: doc, widthSp: WIDTH_SP })
  };
}

// ---------- A document builder, for the cases the corpus does not hold ----------

const STANDARD_STRINGS = [
  { string: 1, pitch: { step: 'E', octave: 4 } },
  { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'E', octave: 2 } }
];

type Item =
  | { rest: true }
  | { string: number; technique?: MnxTabTechnique; id?: string };

/** One 4/4 bar of quarter notes on the open strings, each optionally annotated.
 *  `strings: false` declares no instrument — the case that has no tab staff at
 *  all, and so the case the notation staff has to carry alone. */
function bar(items: Item[], opts: { strings?: boolean } = {}): MnxStructure {
  const withStrings = opts.strings !== false;
  const OPEN: Record<number, { step: string; octave: number }> = {
    1: { step: 'E', octave: 4 }, 2: { step: 'B', octave: 3 }, 3: { step: 'G', octave: 3 },
    4: { step: 'D', octave: 3 }, 5: { step: 'A', octave: 2 }, 6: { step: 'E', octave: 2 }
  };
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        id: 'guitar',
        ...(withStrings
          ? { _x: { mnxLab: { strings: STANDARD_STRINGS, tab: { staffKind: 'both' } } } }
          : {}),
        measures: [
          {
            clefs: [{ clef: { sign: 'G', staffPosition: -2, octave: -1 } }],
            sequences: [
              {
                content: items.map(item =>
                  'rest' in item
                    ? { duration: { base: 'quarter' }, rest: {} }
                    : {
                        duration: { base: 'quarter' },
                        notes: [
                          {
                            pitch: OPEN[item.string],
                            ...(item.id ? { id: item.id } : {}),
                            _x: {
                              mnxLab: {
                                string: item.string,
                                ...(item.technique ? { tab: { technique: item.technique } } : {})
                              }
                            }
                          }
                        ]
                      }
                )
              }
            ]
          }
        ]
      }
    ]
  } as unknown as MnxStructure;
}

// ---------- The corpus's five techniques reach the page ----------

describe('every technique in the corpus is drawn, on both staves', () => {
  const CASES: { scenario: string; token: string; what: string }[] = [
    { scenario: '01-bend-and-release', token: 'technique-bend', what: 'a bend curve' },
    { scenario: '02-slides', token: 'technique-slide', what: 'a slide line' },
    { scenario: '03-hammer-pull-chain', token: 'technique-hammerPull', what: 'a hammer-on/pull-off slur' },
    { scenario: '04-vibrato-and-palm-mute', token: 'technique-vibrato', what: 'a vibrato wiggle' },
    { scenario: '04-vibrato-and-palm-mute', token: 'technique-palm-mute', what: 'a palm mute' },
    { scenario: '05-natural-harmonics', token: 'technique-harmonic', what: 'a harmonic' }
  ];

  for (const { scenario, token, what } of CASES) {
    it(`${scenario} draws ${what}`, () => {
      const p = projections(readScenario(scenario));
      // The harmonic is the one technique the tab staff spells INTO the digit
      // rather than beside it, so it has no `technique-harmonic` primitive
      // there — `<12>` is the mark, and the next test pins it.
      if (token !== 'technique-harmonic') {
        expect(marks(p.tab, token).length, `${scenario}: tab`).toBeGreaterThan(0);
      }
      expect(marks(p.notation, token).length, `${scenario}: notation`).toBeGreaterThan(0);
      // The combined system carries both staves' marks, so it carries at least
      // as many as either — the `both` view is where a reader actually sits.
      expect(marks(p.both, token).length, `${scenario}: both`).toBeGreaterThanOrEqual(
        marks(p.notation, token).length
      );
    });
  }

  it('a natural harmonic brackets the fret digit instead of labelling it', () => {
    const p = projections(readScenario('05-natural-harmonics'));
    const digits = marks(p.tab, 'fret-number').map(x => (x.kind === 'text' ? x.text : ''));
    expect(digits).toEqual(['<12>', '<12>']);
    // One mask per digit, still — the brackets are IN the text, which is what
    // keeps `non-square-scale.test.ts`'s mask invariant true of them.
    expect(marks(p.tab, 'fret-bg')).toHaveLength(digits.length);
  });
});

// ---------- The claims a golden cannot state ----------

describe('technique marks say what the technique is', () => {
  it('a bend prints its size in steps, the way a player reads it', () => {
    expect(bendLabel(2)).toBe('full');
    expect(bendLabel(1)).toBe('1/2');
    expect(bendLabel(0.5)).toBe('1/4');
    expect(bendLabel(3)).toBe('1 1/2');
    expect(bendLabel(4)).toBe('2');
    // A bend of nothing has no label — and no arrow either (below).
    expect(bendLabel(0)).toBe('');
  });

  it('the corpus bend is labelled "full" and arrives with an arrowhead', () => {
    const p = projections(readScenario('01-bend-and-release'));
    for (const [name, layout] of Object.entries(p)) {
      expect(texts(layout, 'technique-bend-label').every(t => t === 'full'), name).toBe(true);
      const arrows = marks(layout, 'technique-bend-arrow')
        .map(x => (x.kind === 'glyph' ? x.glyph : ''));
      // Bar 1 rises to full; bar 2 pre-bends up, holds, and RELEASES — so the
      // release's downward head has to be there, or the second gesture reads
      // as the first one drawn twice.
      expect(arrows, name).toContain('arrowheadBlackUp');
      expect(arrows, name).toContain('arrowheadBlackDown');
    }
  });

  it('a partial release labels BOTH arrivals — the peak and where it lands', () => {
    const doc = bar([
      { string: 3, technique: { bend: { points: [
        { position: 0, alter: 0 }, { position: 0.5, alter: 2 }, { position: 1, alter: 1 }
      ] } } }
    ]);
    const p = projections(doc);
    expect(texts(p.tab, 'technique-bend-label')).toEqual(['full', '1/2']);
    expect(texts(p.notation, 'technique-bend-label')).toEqual(['full', '1/2']);
  });

  it('a bend curve arrives VERTICALLY, so the head sits on its own tangent', () => {
    const p = projections(readScenario('01-bend-and-release'));
    const curves = marks(p.tab, 'technique-bend').filter(x => x.kind === 'curve');
    expect(curves.length).toBeGreaterThan(0);
    for (const curve of curves) {
      const pts = (curve as { points: { x: number; y: number }[] }).points;
      expect(pts[2]!.x).toBe(pts[3]!.x);
    }
  });

  it('a bend of zero draws nothing at all', () => {
    const doc = bar([
      { string: 3, technique: { bend: { points: [{ position: 0, alter: 0 }, { position: 1, alter: 0 }] } } }
    ]);
    const p = projections(doc);
    expect(marks(p.tab, 'technique-bend')).toHaveLength(0);
    expect(marks(p.notation, 'technique-bend')).toHaveLength(0);
  });

  it('hammer-on and pull-off are ONE letterless adornment — a slur, no H or P', () => {
    // Extension v6, the Soundslice convention: the direction is implicit in
    // the two pitches, so the mark is the curve alone.
    const p = projections(readScenario('03-hammer-pull-chain'));
    for (const [name, layout] of Object.entries(p)) {
      expect(marks(layout, 'technique-hammerPull').length, name).toBeGreaterThan(0);
      const labels = layout.primitives.filter(pr => cls(pr).some(c => c.includes('hammer') && c.includes('label')));
      expect(labels, name).toHaveLength(0);
    }
  });

  /**
   * The bug the tab staff invites: two frets on ONE string sit at the same y,
   * so a slide line drawn between them lands exactly on the string line that
   * is already there and vanishes. Every slide in the corpus is that case.
   */
  it('a slide along one string is slanted, so it is not the string line', () => {
    const tab = projections(readScenario('02-slides')).tab;
    const lines = marks(tab, 'technique-slide').filter(p => p.kind === 'line');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      if (line.kind !== 'line') continue;
      expect(Math.abs(line.y1 - line.y2)).toBeGreaterThan(0.1);
    }
  });

  it('a legato slide adds the slur that says it is picked once; a shift does not', () => {
    const tab = projections(readScenario('02-slides')).tab;
    expect(marks(tab, 'technique-slide-shift').length).toBe(1);
    expect(marks(tab, 'technique-slide-legato').length).toBe(1);
    expect(marks(tab, 'technique-slide-legato-slur').length).toBe(1);
  });
  /**
   * The two enum members no scenario holds, so the census cannot claim their
   * classes and only this file exercises them. They are the members with NO
   * target: a slide into a note comes from before it, one out of it leaves
   * after it, and the direction is the pitch's — so "up" starts (or ends)
   * below the note it touches.
   */
  it('slideIn approaches from before the note; slideOut leaves after it', () => {
    const at = (type: 'slideIn' | 'slideOut', direction?: 'up' | 'down') => {
      const tab = projections(bar([{ string: 3, technique: { slide: { type, direction } } }])).tab;
      const line = marks(tab, `technique-slide-${type}`)[0];
      expect(line?.kind).toBe('line');
      if (line?.kind !== 'line') throw new Error('unreachable');
      const digit = marks(tab, 'fret-number')[0];
      const noteX = digit.kind === 'text' ? digit.x : 0;
      return {
        before: Math.max(line.x1 + (line.dx1 ?? 0), line.x2 + (line.dx2 ?? 0)) <= noteX,
        after: Math.min(line.x1 + (line.dx1 ?? 0), line.x2 + (line.dx2 ?? 0)) >= noteX,
        // Does the far end sit BELOW the note (y grows downward)?
        farBelow: (line.y1 > line.y2) === (line.x1 + (line.dx1 ?? 0) < line.x2 + (line.dx2 ?? 0))
      };
    };
    expect(at('slideIn').before, 'a slide in is drawn before its note').toBe(true);
    expect(at('slideOut').after, 'a slide out is drawn after its note').toBe(true);
    // Sliding UP into a note starts below it; sliding DOWN into it starts above.
    expect(at('slideIn', 'up').farBelow).toBe(true);
    expect(at('slideIn', 'down').farBelow).toBe(false);
  });

  it('a harmonic that is not natural says which kind it is', () => {
    const kinds: [string, string][] = [
      ['artificial', 'A.H.'], ['pinch', 'P.H.'], ['tap', 'T.H.'],
      ['semi', 'S.H.'], ['feedback', 'Fdbk.']
    ];
    for (const [type, label] of kinds) {
      const p = projections(
        bar([{ string: 3, technique: { harmonic: { type } } as MnxTabTechnique }])
      );
      expect(texts(p.tab, 'technique-harmonic-label'), type).toEqual([label]);
      expect(texts(p.notation, 'technique-harmonic-label'), type).toEqual([label]);
    }
    // A natural one says it with the brackets alone — no word.
    const natural = projections(bar([{ string: 3, technique: { harmonic: { type: 'natural' } } }]));
    expect(marks(natural.tab, 'technique-harmonic-label')).toHaveLength(0);
  });
});

// ---------- Palm mute: a per-note flag that has to read as a span ----------

describe('palm mute reads as the span it is', () => {
  const pm = (string: number): Item => ({ string, technique: { palmMute: true } });

  it('a run of muted notes prints "P.M." once, over a dashed line', () => {
    const tab = projections(bar([pm(6), pm(6), pm(6), pm(6)])).tab;
    expect(texts(tab, 'technique-palm-mute')).toEqual(['P.M.']);
    expect(marks(tab, 'technique-palm-mute-line')).toHaveLength(1);
  });

  it('a rest breaks the run, because the hand comes off the strings', () => {
    const tab = projections(bar([pm(6), pm(6), { rest: true }, pm(6)])).tab;
    expect(texts(tab, 'technique-palm-mute')).toEqual(['P.M.', 'P.M.']);
  });

  it('an unmuted note between two muted ones breaks it too', () => {
    const tab = projections(bar([pm(6), { string: 5 }, pm(6), pm(6)])).tab;
    expect(texts(tab, 'technique-palm-mute')).toEqual(['P.M.', 'P.M.']);
  });

  it('a single muted note is the abbreviation alone — nothing to dash', () => {
    const tab = projections(bar([pm(6), { string: 5 }])).tab;
    expect(texts(tab, 'technique-palm-mute')).toEqual(['P.M.']);
    expect(marks(tab, 'technique-palm-mute-line')).toHaveLength(0);
  });
});

// ---------- The reason the notation staff draws technique at all ----------

describe('technique survives where there is no fingerboard', () => {
  /**
   * The open question core-guitar-technique.md left, answered by the model
   * rather than by taste: `technique` is drafted for standard MNX, and a
   * document that declares no strings has NO tab staff (no instrument is ever
   * assumed). Were the notation staff silent, this document's technique would
   * be unrenderable rather than merely unfretted.
   */
  it('a document with no strings still draws its technique on the notation staff', () => {
    const doc = bar(
      [
        { string: 3, id: 'a', technique: { hammerPull: { target: 'b' } } },
        { string: 3, id: 'b', technique: { vibrato: true } }
      ],
      { strings: false }
    );
    initSmufl();
    const notation = layoutNotation({ mnx: doc, widthSp: WIDTH_SP });
    expect(marks(notation, 'technique-hammerPull').length).toBeGreaterThan(0);
    expect(marks(notation, 'technique-vibrato').length).toBeGreaterThan(0);
    // And there is genuinely no tab staff to have carried it.
    expect(layoutBothSystem({ mnx: doc, widthSp: WIDTH_SP }).primitives
      .filter(p => cls(p).includes('tab-clef'))).toHaveLength(0);
  });

  it('a hammer-pull whose target does not exist still leaves a mark', () => {
    const doc = bar([{ string: 3, id: 'a', technique: { hammerPull: { target: 'nowhere' } } }]);
    const p = projections(doc);
    for (const [name, layout] of Object.entries(p)) {
      // No far end to reach — but the mark is not optional. A short stub of
      // the slur says the technique happened; dropping it is how a dangling
      // id turns into a silently plainer score.
      expect(marks(layout, 'technique-hammerPull').length, name).toBeGreaterThan(0);
    }
  });
});

// ---------- Technique is ink, so the frame has to make room for it ----------

describe('the frame follows the marks', () => {
  /**
   * The gaps between staves and between systems are ink-measured
   * (core-ink-measured-gaps.md), so a bend arrow above a tab staff should push
   * its notation sibling clear of it with nobody encoding "bends need 2sp".
   * This is that mechanism doing its job for content it has never seen.
   */
  it('a bend opens the system it is drawn in', () => {
    initSmufl();
    const plain = bar([{ string: 3 }, { string: 3 }]);
    const bent = bar([
      {
        string: 3,
        technique: { bend: { points: [{ position: 0, alter: 0 }, { position: 1, alter: 2 }] } }
      },
      { string: 3 }
    ]);
    const heightOf = (doc: MnxStructure) =>
      layoutBothSystem({ mnx: doc, widthSp: WIDTH_SP }).heightSp;
    expect(heightOf(bent)).toBeGreaterThan(heightOf(plain));
  });
});
