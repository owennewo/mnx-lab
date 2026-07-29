import { describe, it, expect } from 'vitest';
import { upgradeTabExtension } from '../src/utils/upgradeTabExtension.ts';
import { MnxStructure } from '../src/types/mnx.ts';

/**
 * The load-time upgrade shim is the only thing standing between a document
 * saved months ago and the current extension shape, and it runs on real user
 * data in IndexedDB. Both hops are covered here: v1 (`_x.guitar`, TAB clefs,
 * duplicated tab staff) and v2 (`_x.tab`, `_x.section`, single-interval bends).
 */

/** Minimal v2 document exercising every field the v3 hop touches. */
function v2Document(): any {
  return {
    mnx: { version: 1 },
    global: {
      measures: [
        { time: { count: 4, unit: 4 }, _x: { section: { marker: 'A', text: 'Verse' } } },
        { _x: { section: { text: 'Chorus' } } },
        {}
      ]
    },
    parts: [
      {
        id: 'P1',
        _x: { tab: { staffKind: 'both', capo: 2 } },
        measures: [
          {
            sequences: [
              {
                voice: 'v1',
                content: [
                  {
                    duration: { base: 'quarter' },
                    notes: [
                      {
                        id: 'n1',
                        pitch: { step: 'E', octave: 4 },
                        _x: {
                          tab: {
                            position: { string: 1, fret: 0 },
                            technique: {
                              bend: { type: 'bend', amount: 1 },
                              slide: { type: 'slide-out', direction: 'down' }
                            }
                          }
                        }
                      },
                      {
                        id: 'n2',
                        pitch: { step: 'B', octave: 3 },
                        _x: {
                          tab: {
                            technique: {
                              bend: { type: 'pre-bend', amount: 0.5, release: true },
                              slide: { type: 'slide-in', direction: 'up' }
                            }
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

const firstNote = (doc: any) =>
  doc.parts[0].measures[0].sequences[0].content[0].notes[0];
const secondNote = (doc: any) =>
  doc.parts[0].measures[0].sequences[0].content[0].notes[1];

describe('extension upgrade: v2 -> v3', () => {
  it('re-namespaces tab data under the mnxLab vendor key', () => {
    const doc: any = upgradeTabExtension(v2Document() as MnxStructure);

    expect(doc.parts[0]._x).toEqual({ mnxLab: { tab: { staffKind: 'both', capo: 2 } } });
    expect(firstNote(doc)._x.mnxLab.tab.position).toEqual({ string: 1, fret: 0 });
    // The v2 spelling must be gone, not merely shadowed — a stale `_x.tab`
    // would silently keep feeding the old shape to anything still reading it.
    expect(doc.parts[0]._x.tab).toBeUndefined();
    expect(firstNote(doc)._x.tab).toBeUndefined();
  });

  it('splits the conflated section label, then promotes both out of _x (v4)', () => {
    const doc: any = upgradeTabExtension(v2Document() as MnxStructure);
    const at = { fraction: [0, 4] };

    // v2 conflated them in one `_x.section`; v3 split them under `_x.mnxLab`;
    // v4 promotes both to the standard objects and leaves no vendor dict behind.
    expect(doc.global.measures[0].rehearsal).toEqual({ location: at, label: 'A' });
    expect(doc.global.measures[0].section).toEqual({ location: at, label: 'Verse' });
    expect(doc.global.measures[0]._x).toBeUndefined();
    // A measure with only one of the two gets only that one.
    expect(doc.global.measures[1].section).toEqual({ location: at, label: 'Chorus' });
    expect(doc.global.measures[1].rehearsal).toBeUndefined();
    expect(doc.global.measures[1]._x).toBeUndefined();
    expect(doc.global.measures[2]._x).toBeUndefined();
  });

  it('camelCases the slide enum values', () => {
    const doc: any = upgradeTabExtension(v2Document() as MnxStructure);

    expect(firstNote(doc)._x.mnxLab.tab.technique.slide.type).toBe('slideOut');
    expect(secondNote(doc)._x.mnxLab.tab.technique.slide.type).toBe('slideIn');
  });

  it('turns the single-interval bend into a curve, converting whole steps to semitones', () => {
    const doc: any = upgradeTabExtension(v2Document() as MnxStructure);

    // v2: {type: 'bend', amount: 1} — one whole step, struck then bent.
    expect(firstNote(doc)._x.mnxLab.tab.technique.bend).toEqual({
      points: [
        { position: 0, alter: 0 },
        { position: 1, alter: 2 }
      ]
    });

    // v2: {type: 'pre-bend', amount: 0.5, release: true} — already bent a half
    // step when struck, then released. A pre-bend starts off the unbent pitch.
    expect(secondNote(doc)._x.mnxLab.tab.technique.bend).toEqual({
      points: [
        { position: 0, alter: 1 },
        { position: 1, alter: 0 }
      ]
    });
  });

  it('upgrades a v3 document by promoting its labels out of the vendor dict', () => {
    const v3: any = {
      mnx: { version: 1 },
      global: { measures: [{ _x: { mnxLab: { rehearsal: { label: 'B' } } } }] },
      parts: [{ measures: [{ sequences: [] }] }]
    };
    const out: any = upgradeTabExtension(v3 as MnxStructure);
    expect(out.global.measures[0].rehearsal).toEqual({ location: { fraction: [0, 4] }, label: 'B' });
    expect(out.global.measures[0]._x).toBeUndefined();
  });

  it('leaves an already-v4 document untouched, by identity', () => {
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{ rehearsal: { location: { fraction: [0, 4] }, label: 'B' } }] },
      parts: [
        {
          _x: { mnxLab: { tab: { staffKind: 'tab' } } },
          measures: [{ sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }]
        }
      ]
    } as unknown as MnxStructure;

    expect(upgradeTabExtension(doc)).toBe(doc);
  });
});

describe('extension upgrade: v1 -> v3 in one pass', () => {
  it('lands on the current shape, not the intermediate v2 one', () => {
    const doc: any = upgradeTabExtension({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          id: 'P1',
          _x: {
            guitar: {
              tuning: {
                strings: [
                  { step: 'E', octave: 2 },
                  { step: 'A', octave: 2 },
                  { step: 'D', octave: 3 },
                  { step: 'G', octave: 3 },
                  { step: 'B', octave: 3 },
                  { step: 'E', octave: 4 }
                ]
              },
              capo: 3
            }
          },
          measures: [
            {
              clefs: [{ clef: { sign: 'TAB' } }],
              sequences: [
                {
                  voice: 'v1',
                  content: [
                    {
                      duration: { base: 'quarter' },
                      notes: [
                        {
                          id: 'n1',
                          pitch: { step: 'E', octave: 4 },
                          _x: {
                            guitar: {
                              string: 1,
                              fret: 0,
                              bend: { type: 'bend-release', amount: 1 }
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as unknown as MnxStructure);

    const tab = doc.parts[0]._x.mnxLab.tab;
    expect(tab.capo).toBe(3);
    expect(tab.staffKind).toBe('both'); // it had a TAB clef
    // v1's tuning array order was documented both ways; string 1 is resolved by
    // PITCH, so the highest string wins regardless of how the array was written.
    expect(tab.tuning[0]).toEqual({ string: 1, pitch: { step: 'E', octave: 4 } });
    // The invalid TAB clef is dropped: tab-ness is a view flag, not a clef.
    expect(doc.parts[0].measures[0].clefs).toBeUndefined();

    const note = firstNote(doc);
    expect(note._x.mnxLab.tab.position).toEqual({ string: 1, fret: 0 });
    // v1's "bend-release": rise a whole step, then back. v1 carried no timing,
    // so the peak lands mid-note rather than stacking two points at the end.
    expect(note._x.mnxLab.tab.technique.bend).toEqual({
      points: [
        { position: 0, alter: 0 },
        { position: 0.5, alter: 2 },
        { position: 1, alter: 0 }
      ]
    });
    expect(note._x.guitar).toBeUndefined();
  });
});
