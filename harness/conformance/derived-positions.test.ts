import { describe, it, expect } from 'vitest';
import {
  resolveEventPositions,
  tabPositionContext,
  MAX_FRET
} from '../../src/engine/tab/guitarPositions.ts';
import { validateDocument } from '../../src/engine/layout/validate.ts';
import {
  MnxStructure,
  MnxNote,
  MnxPart,
  MnxPitch,
  STANDARD_GUITAR_STRINGS
} from '../../src/model/mnx.ts';

/**
 * The derivation ladder of roadmap/proposed/derived-positions.md, stage 3:
 * string + pitch → fret is arithmetic against the part's declared strings and
 * capo (MNX pitch is SOUNDING — no transposition term); a bare note gets the
 * lowest playable fret; nothing is ever silently clamped — unplayable notes
 * resolve to null and surface as red `scope: 'tab'` validation issues.
 */

const p = (step: MnxPitch['step'], octave: number, alter?: number): MnxPitch =>
  alter !== undefined ? { step, octave, alter } : { step, octave };

const bare = (pitch: MnxPitch): MnxNote => ({ pitch });
const onString = (pitch: MnxPitch, string: number, fret?: number): MnxNote => ({
  pitch,
  _x: { mnxLab: fret !== undefined ? { string, fret } : { string } }
});

// No instrument is assumed any more — the standard context must be DECLARED.
const STANDARD = tabPositionContext(undefined, { strings: STANDARD_GUITAR_STRINGS })!;

function partWith(overrides: {
  strings?: { string: number; pitch: MnxPitch }[];
  capo?: number;
  notes: MnxNote[];
}): MnxPart {
  return {
    _x: {
      mnxLab: {
        // Explicit declaration required: absent strings ⇒ no fingerboard.
        strings: overrides.strings ?? [...STANDARD_GUITAR_STRINGS],
        ...(overrides.capo !== undefined ? { capo: overrides.capo } : {}),
        tab: { staffKind: 'tab' }
      }
    },
    measures: [
      {
        sequences: [
          { content: [{ duration: { base: 'whole' }, notes: overrides.notes }] }
        ]
      }
    ]
  } as MnxPart;
}

function docWith(part: MnxPart): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [part]
  } as MnxStructure;
}

const tabIssues = (doc: MnxStructure) =>
  validateDocument(doc).filter(i => i.scope === 'tab');

describe('derivation: string + pitch → fret', () => {
  it('derives the fret from a string-only annotation', () => {
    // Sounding C3 on string 5 (open A2): 48 − 45 = fret 3.
    const [pos] = resolveEventPositions([onString(p('C', 3), 5)], STANDARD);
    expect(pos).toEqual({ str: 5, fret: 3 });
  });

  it('sounding C4 derives to string 2 fret 1 when bare — the written-pitch trap stays out', () => {
    // C4 read off a guitar staff would be string 5 fret 3, but that is WRITTEN
    // pitch; MNX pitch is sounding, and sounding C4 sits a half step above
    // open B3.
    const [pos] = resolveEventPositions([bare(p('C', 4))], STANDARD);
    expect(pos).toEqual({ str: 2, fret: 1 });
  });

  it('reads the declared tuning: drop-D reaches D2 at fret 0', () => {
    const dropD = tabPositionContext(
      partWith({
        strings: [
          { string: 1, pitch: p('E', 4) },
          { string: 2, pitch: p('B', 3) },
          { string: 3, pitch: p('G', 3) },
          { string: 4, pitch: p('D', 3) },
          { string: 5, pitch: p('A', 2) },
          { string: 6, pitch: p('D', 2) }
        ],
        notes: []
      })
    );
    expect(resolveEventPositions([bare(p('D', 2))], dropD)[0]).toEqual({ str: 6, fret: 0 });
    // Standard tuning cannot reach D2 at all.
    expect(resolveEventPositions([bare(p('D', 2))], STANDARD)[0]).toBeNull();
  });

  it('applies the capo: frets are capo-relative and opens shift up', () => {
    const capo2 = tabPositionContext(partWith({ capo: 2, notes: [] }));
    // Effective open string 6 = E2 + 2 = F#2 → F#2 is fret 0, A2 is fret 3.
    expect(resolveEventPositions([bare(p('F', 2, 1))], capo2)[0]).toEqual({ str: 6, fret: 0 });
    expect(resolveEventPositions([onString(p('A', 2), 6)], capo2)[0]).toEqual({ str: 6, fret: 3 });
    // E2 now sits BELOW the capo — unplayable, not fret −2.
    expect(resolveEventPositions([bare(p('E', 2))], capo2)[0]).toBeNull();
  });

  it('flags a stored fret that disagrees, and renders the derived one', () => {
    const [pos] = resolveEventPositions([onString(p('C', 3), 5, 5)], STANDARD);
    expect(pos).toEqual({ str: 5, fret: 3, mismatch: true });
  });

  it('assigns chords highest-pitch-first with no string collisions', () => {
    // Open C major from pitches alone: E4 C4 G3 E3 C3 (sounding).
    const chord = [bare(p('E', 4)), bare(p('C', 4)), bare(p('G', 3)), bare(p('E', 3)), bare(p('C', 3))];
    const positions = resolveEventPositions(chord, STANDARD);
    expect(positions).toEqual([
      { str: 1, fret: 0 },
      { str: 2, fret: 1 },
      { str: 3, fret: 0 },
      { str: 4, fret: 2 },
      { str: 5, fret: 3 }
    ]);
  });

  it('honours a partial annotation: the pinned string is reserved, the rest derive around it', () => {
    // C4 pinned high on string 3 (fret 5); the bare E4 must then use string 1.
    const positions = resolveEventPositions([onString(p('C', 4), 3), bare(p('E', 4))], STANDARD);
    expect(positions).toEqual([
      { str: 3, fret: 5 },
      { str: 1, fret: 0 }
    ]);
  });

  it('never clamps: unplayable notes resolve to null', () => {
    // Annotated below the open string, annotated past MAX_FRET, and bare below range.
    expect(resolveEventPositions([onString(p('C', 3), 1)], STANDARD)[0]).toBeNull();
    expect(resolveEventPositions([onString(p('C', 7), 6)], STANDARD)[0]).toBeNull();
    expect(resolveEventPositions([bare(p('C', 1))], STANDARD)[0]).toBeNull();
    expect(MAX_FRET).toBe(24);
  });
});

describe('derivation validation (red scope:tab issues)', () => {
  it('is silent for a consistent annotated document', () => {
    const doc = docWith(partWith({ notes: [onString(p('C', 3), 5, 3), onString(p('E', 4), 1, 0)] }));
    expect(tabIssues(doc)).toEqual([]);
  });

  it('flags a stored-vs-derived fret mismatch as an error', () => {
    const doc = docWith(partWith({ notes: [onString(p('C', 3), 5, 5)] }));
    const issues = tabIssues(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('stored fret 5 disagrees with the derived fret 3');
  });

  it('flags an annotated note whose pitch the string cannot sound', () => {
    const doc = docWith(partWith({ notes: [onString(p('C', 3), 1)] }));
    const issues = tabIssues(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('not playable on string 1');
  });

  it('flags an undeclared string number', () => {
    const doc = docWith(
      partWith({
        strings: [{ string: 1, pitch: p('E', 4) }],
        notes: [onString(p('E', 4), 2, 0)]
      })
    );
    const issues = tabIssues(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('string 2 is not declared');
  });

  it('flags a bare pitch outside the reachable range on a declared tab part', () => {
    const doc = docWith(partWith({ notes: [bare(p('C', 1))] }));
    const issues = tabIssues(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('not playable on the declared strings');
  });

  it('says nothing about bare out-of-range pitches on a non-tab part', () => {
    const doc = docWith({
      measures: [
        { sequences: [{ content: [{ duration: { base: 'whole' }, notes: [bare(p('C', 1))] }] }] }
      ]
    } as MnxPart);
    expect(tabIssues(doc)).toEqual([]);
  });

  it('bases string-conflict checks on the derived fret', () => {
    // Two voices, same instant: string 5 carries C3 (derives 3) and D3
    // (derives 5) — a genuine conflict even though no frets are stored.
    const part = {
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS], tab: { staffKind: 'tab' } } },
      measures: [
        {
          sequences: [
            { voice: 'v1', content: [{ duration: { base: 'whole' }, notes: [onString(p('C', 3), 5)] }] },
            { voice: 'v2', content: [{ duration: { base: 'whole' }, notes: [onString(p('D', 3), 5)] }] }
          ]
        }
      ]
    } as unknown as MnxPart;
    const issues = tabIssues(docWith(part));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('string 5 is fretted at 3 and 5');
  });
});
