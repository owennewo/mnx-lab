import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateDocument } from '../../src/engine/layout/validate.ts';
import { MnxStructure } from '../../src/model/mnx.ts';

/**
 * Fingerboard-conflict validation.
 *
 * A string is one physical object, so two notes cannot claim it at the same
 * instant. Two very different situations share that shape, and the severity
 * split is the whole point of these tests:
 *
 *   - different frets on one string → unplayable → error
 *   - the same fret, in two voices  → one note written twice; legal, standard
 *     fingerstyle engraving → warning, because "you made a mistake" is wrong
 *
 * Both are `scope: 'tab'`: the notation staff engraves these bars perfectly.
 */

const SCORES = path.resolve(__dirname, '../../converters/fixtures');

function readScore(name: string): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
}

/** Sounding pitch of (string, fret) in standard tuning — v5 derives the fret
 *  from string + pitch, so fixture pitches must be CONSISTENT with their
 *  stored positions or the mismatch tripwire (deliberately) fires. */
type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
function pitchAt(string: number, fret: number): { step: Step; octave: number; alter?: number } {
  const OPEN = [64, 59, 55, 50, 45, 40]; // string 1..6
  const midi = OPEN[string - 1] + fret;
  const NAMES: [Step, number?][] = [
    ['C'], ['C', 1], ['D'], ['D', 1], ['E'], ['F'], ['F', 1], ['G'], ['G', 1], ['A'], ['A', 1], ['B']
  ];
  const [step, alter] = NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return alter !== undefined ? { step, octave, alter } : { step, octave };
}

/** Minimal one-measure document with the given per-voice positions. */
function docWith(voices: { string: number; fret: number }[][]): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        measures: [
          {
            sequences: voices.map((positions, i) => ({
              voice: `v${i + 1}`,
              content: [
                {
                  duration: { base: 'whole' as const },
                  notes: positions.map(position => ({
                    pitch: pitchAt(position.string, position.fret),
                    _x: { mnxLab: { string: position.string, fret: position.fret } }
                  }))
                }
              ]
            }))
          }
        ],
        _x: {
          mnxLab: {
            strings: [
              { string: 1, pitch: { step: 'E' as const, octave: 4 } },
              { string: 2, pitch: { step: 'B' as const, octave: 3 } },
              { string: 3, pitch: { step: 'G' as const, octave: 3 } },
              { string: 4, pitch: { step: 'D' as const, octave: 3 } },
              { string: 5, pitch: { step: 'A' as const, octave: 2 } },
              { string: 6, pitch: { step: 'E' as const, octave: 2 } }
            ],
            tab: { staffKind: 'both' as const }
          }
        }
      }
    ]
  };
}

describe('tab fingerboard validation', () => {
  it('is silent for documents with no fingerboard positions', () => {
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          measures: [
            {
              sequences: [
                { voice: 'v1', content: [{ duration: { base: 'whole' }, notes: [{ pitch: { step: 'E', octave: 4 } }] }] },
                { voice: 'v2', content: [{ duration: { base: 'whole' }, notes: [{ pitch: { step: 'E', octave: 4 } }] }] }
              ]
            }
          ]
        }
      ]
    };
    // Two voices on the same pitch is ordinary notation — nothing to report
    // without positions to conflict.
    expect(validateDocument(doc).filter(i => i.scope === 'tab')).toEqual([]);
  });

  it('warns (does not error) when one note is written in two voices', () => {
    const issues = validateDocument(
      docWith([[{ string: 1, fret: 0 }], [{ string: 1, fret: 0 }]])
    ).filter(i => i.scope === 'tab');

    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].measureIndex).toBe(0);
    expect(issues[0].message).toMatch(/string 1 fret 0/);
    expect(issues[0].message).toMatch(/voices 1 and 2/);
  });

  it('errors when one string is fretted at two different positions at once', () => {
    const issues = validateDocument(
      docWith([[{ string: 6, fret: 1 }], [{ string: 6, fret: 5 }]])
    ).filter(i => i.scope === 'tab');

    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toMatch(/string 6 is fretted at 1 and 5/);
  });

  it('does not flag a chord spread across different strings', () => {
    const issues = validateDocument(
      docWith([[{ string: 6, fret: 1 }, { string: 4, fret: 3 }, { string: 1, fret: 0 }]])
    ).filter(i => i.scope === 'tab');
    expect(issues).toEqual([]);
  });

  it('does not flag the same position at different times', () => {
    const doc = docWith([[{ string: 1, fret: 0 }]]);
    // Two half notes, same position, sequential — perfectly playable.
    doc.parts[0].measures[0].sequences[0].content = [
      { duration: { base: 'half' }, notes: [{ pitch: { step: 'E', octave: 4 }, _x: { mnxLab: { string: 1, fret: 0 } } }] },
      { duration: { base: 'half' }, notes: [{ pitch: { step: 'E', octave: 4 }, _x: { mnxLab: { string: 1, fret: 0 } } }] }
    ];
    expect(validateDocument(doc).filter(i => i.scope === 'tab')).toEqual([]);
  });

  it('finds the shared notes in Sun-did-glide, as warnings rather than errors', () => {
    // The corpus is authored as Guitar Pro now, and Guitar Pro cannot represent
    // a note twice on one string — so most of these collapse at authoring time.
    // What matters is the SEVERITY: a note written in two voices is legal.
    const issues = validateDocument(readScore('Sun-did-glide')).filter(i => i.scope === 'tab');
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(i => i.severity === 'warning')).toBe(true);
    expect(issues[0].message).toMatch(/written in\s+voices/);
  });

  it('reports nothing for the fixtures with no fingerboard conflicts', () => {
    for (const name of ['House-of-the-Rising-Sun', 'Vestapol']) {
      expect(
        validateDocument(readScore(name)).filter(i => i.scope === 'tab'),
        name
      ).toEqual([]);
    }
  });

  it('leaves bar-duration validation unscoped so both staves still show it', () => {
    const doc = docWith([[{ string: 1, fret: 0 }]]);
    // One quarter note in a 4/4 bar — underfilled.
    doc.parts[0].measures[0].sequences[0].content = [
      { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'E', octave: 4 } }] }
    ];
    const issues = validateDocument(doc);
    expect(issues.length).toBe(1);
    expect(issues[0].scope).toBeUndefined();
    expect(issues[0].message).toMatch(/underfills/);
  });
});
