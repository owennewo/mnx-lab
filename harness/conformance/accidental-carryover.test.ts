// Accidental carryover: an accidental holds to the barline.
//
// The renderer used to judge every note against the key signature alone, so a
// bar of four G-flats printed four flats, and a natural after an F-sharp in the
// same bar printed nothing at all — a wrong reading, not just extra ink.
// `measureAccidentals` decides a whole measure once, for spacing, notation and
// the tab walk alike.
import { describe, it, expect } from 'vitest';
import { measureAccidentals, tieTargetIds } from '../../src/engine/layout/spacing.ts';
import type { MnxNote, MnxPartMeasure, MnxStructure } from '../../src/model/mnx.ts';

const SHARP = 'accidentalSharp';
const FLAT = 'accidentalFlat';
const NATURAL = 'accidentalNatural';

const note = (step: string, octave: number, alter?: number, extra: Partial<MnxNote> = {}): MnxNote =>
  ({ pitch: { step, octave, ...(alter === undefined ? {} : { alter }) }, ...extra }) as MnxNote;
const q = (...notes: MnxNote[]) => ({ duration: { base: 'quarter' }, notes });
const rest = () => ({ duration: { base: 'quarter' }, rest: {} });
const measure = (...sequences: { content: unknown[]; staff?: number }[]) => ({ sequences }) as unknown as MnxPartMeasure;

/** The glyphs one measure prints for `notes`, in the order given. */
function resolve(
  pm: MnxPartMeasure,
  notes: MnxNote[],
  { fifths = 0, useAccidentalDisplay = false, ties = new Set<string>() } = {}
) {
  const accidentalOf = measureAccidentals([pm], fifths, useAccidentalDisplay, ties);
  return notes.map(accidentalOf);
}

describe('an accidental holds to the barline', () => {
  it('prints a repeated altered note once, and cancels it with a natural', () => {
    const a = note('F', 4, 1), b = note('F', 4, 1), c = note('F', 4);
    expect(resolve(measure({ content: [q(a), q(b), q(c)] }), [a, b, c])).toEqual([SHARP, null, NATURAL]);
  });

  it('measures against the key signature first (the Soundslice comparison, one flat)', () => {
    // B♮ against a one-flat key, then B again: the natural is already in force.
    const b1 = note('B', 4), b2 = note('B', 4), bFlat = note('B', 4, -1);
    expect(resolve(measure({ content: [q(b1), q(b2), q(bFlat)] }), [b1, b2, bFlat], { fifths: -1 }))
      .toEqual([NATURAL, null, FLAT]);
    // The G♭ our render repeated on every beat.
    const g1 = note('G', 4, -1), g2 = note('G', 4, -1);
    expect(resolve(measure({ content: [q(g1), q(g2)] }), [g1, g2], { fifths: -1 })).toEqual([FLAT, null]);
  });

  it('treats another octave as another position', () => {
    const low = note('F', 4, 1), high = note('F', 5, 1);
    expect(resolve(measure({ content: [q(low), q(high)] }), [low, high])).toEqual([SHARP, SHARP]);
  });

  it('starts every measure from the key signature again', () => {
    const first = note('F', 4, 1), second = note('F', 4, 1);
    expect(resolve(measure({ content: [q(first)] }), [first])).toEqual([SHARP]);
    expect(resolve(measure({ content: [q(second)] }), [second])).toEqual([SHARP]);
  });
});

describe('voices and staves', () => {
  it('shares one bar of state across the voices of a staff, in time order', () => {
    // Voice 2 plays F♯ on beat 1; voice 1's F on beat 2 comes after it in TIME
    // though before it in document order — so it needs the natural.
    const v1 = note('F', 4), v2 = note('F', 4, 1);
    const pm = measure({ content: [rest(), q(v1)] }, { content: [q(v2), rest()] });
    expect(resolve(pm, [v2, v1])).toEqual([SHARP, NATURAL]);
  });

  it('keeps each staff to itself', () => {
    const upper = note('F', 4, 1), lower = note('F', 4, 1);
    const pm = measure({ content: [q(upper), rest()], staff: 1 }, { content: [rest(), q(lower)], staff: 2 });
    expect(resolve(pm, [upper, lower])).toEqual([SHARP, SHARP]);
  });

  it('reads a grace group ahead of its principal', () => {
    const grace = note('F', 4, 1), principal = note('F', 4, 1);
    const pm = measure({ content: [{ type: 'grace', content: [{ duration: { base: 'eighth' }, notes: [grace] }] }, q(principal)] });
    expect(resolve(pm, [grace, principal])).toEqual([SHARP, null]);
  });
});

describe('ties', () => {
  it('finds tie continuations across the document', () => {
    const doc = {
      parts: [{
        measures: [
          { sequences: [{ content: [q(note('F', 4, 1, { id: 'from', ties: [{ target: 'to' }] }))] }] },
          { sequences: [{ content: [q(note('F', 4, 1, { id: 'to' }))] }] }
        ]
      }]
    } as unknown as MnxStructure;
    expect([...tieTargetIds(doc)]).toEqual(['to']);
  });

  it('never restates a tied-over accidental, and a later note in the bar states it again', () => {
    const continuation = note('F', 4, 1, { id: 'to' }), later = note('F', 4, 1);
    expect(resolve(measure({ content: [q(continuation), q(later)] }), [continuation, later], { ties: new Set(['to']) }))
      .toEqual([null, SHARP]);
  });
});

describe('explicit display still wins', () => {
  it('prints a courtesy accidental the document asks for', () => {
    const a = note('F', 4, 1), courtesy = note('F', 4, 1, { accidentalDisplay: { show: true } });
    expect(resolve(measure({ content: [q(a), q(courtesy)] }), [a, courtesy])).toEqual([SHARP, SHARP]);
  });

  it('hides what the document hides, and the pitch still holds', () => {
    const hidden = note('F', 4, 1, { accidentalDisplay: { show: false } }), after = note('F', 4, 1);
    expect(resolve(measure({ content: [q(hidden), q(after)] }), [hidden, after])).toEqual([null, null]);
  });

  it('infers nothing when the document declares useAccidentalDisplay', () => {
    const a = note('F', 4, 1), shown = note('F', 4, 1, { accidentalDisplay: { show: true } });
    expect(resolve(measure({ content: [q(a), q(shown)] }), [a, shown], { useAccidentalDisplay: true }))
      .toEqual([null, SHARP]);
  });

  it('falls back to the key signature for a note the measure never held', () => {
    const accidentalOf = measureAccidentals([measure({ content: [] })], 0, false, new Set());
    expect(accidentalOf(note('F', 4, 1))).toBe(SHARP);
  });
});
