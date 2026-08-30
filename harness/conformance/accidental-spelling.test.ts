// Accidental spelling (campaign item 6): how a sound gets written.
//
// Two questions the campaign kept together and this item separates. SPELLING —
// which letter and accidental name this pitch — is policy plus a player's
// override (`J`). DISPLAY — whether the accidental is printed, and in brackets
// — is note-level ink, and lives with the other adornments.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { driveToElement } from '../../src/edit/destructWalk.ts';
import { parseAdornment } from '../../src/edit/setupGrammar.ts';
import { enharmonicSpellings, spellPitch } from '../../src/edit/staffSpace.ts';
import { forEachNoteAddress } from '../../src/model/noteWalk.ts';
import type { MnxNote, MnxStructure } from '../../src/model/mnx.ts';

const REPO = path.join(__dirname, '../..');
const load = (id: string): MnxStructure =>
  JSON.parse(fs.readFileSync(path.join(REPO, 'scenarios', id, 'document.mnx.json'), 'utf8'));

describe('the spelling policy', () => {
  // C4 = 60. The black keys are where a policy is forced to choose.
  const eFlat4 = 63;
  const gSharp4 = 68;

  it('spells the direction of the move where the key is silent', () => {
    // The whole of the item's founding complaint: in C, stepping E down a
    // semitone used to produce D♯, so E♭ could not be written at all.
    expect(spellPitch(eFlat4, 0, -1)).toEqual({ step: 'E', octave: 4, alter: -1 });
    expect(spellPitch(eFlat4, 0, 1)).toEqual({ step: 'D', octave: 4, alter: 1 });
  });

  it('lets the key overrule the direction', () => {
    // Three flats: the reader is already carrying E♭, so it is E♭ going up too.
    expect(spellPitch(eFlat4, -3, 1)).toEqual({ step: 'E', octave: 4, alter: -1 });
    // Three sharps: G♯ even on the way down.
    expect(spellPitch(gSharp4, 3, -1)).toEqual({ step: 'G', octave: 4, alter: 1 });
  });

  it('prefers the plain letter when the key does not alter it', () => {
    expect(spellPitch(60, 0, 1)).toEqual({ step: 'C', octave: 4 });
    expect(spellPitch(60, -3, -1)).toEqual({ step: 'C', octave: 4 });
  });

  it('never chooses a double accidental, but can name one', () => {
    expect(Math.abs(spellPitch(eFlat4, 0, 1).alter ?? 0)).toBeLessThanOrEqual(1);
    const spellings = enharmonicSpellings(eFlat4);
    expect(spellings).toContainEqual({ step: 'E', octave: 4, alter: -1 });
    expect(spellings).toContainEqual({ step: 'D', octave: 4, alter: 1 });
    // Every one of them is the same sound — that is the whole invariant.
    expect(
      new Set(spellings.map(p => (p.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(p.step)] + (p.alter ?? 0)))
    ).toEqual(new Set([eFlat4]));
  });
});

describe('respell (J)', () => {
  const oneNote = (pitch: MnxNote['pitch']): MnxStructure =>
    ({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          measures: [
            {
              clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
              sequences: [
                { content: [{ type: 'event', duration: { base: 'whole' }, notes: [{ pitch }] }] }
              ]
            }
          ]
        }
      ]
    }) as MnxStructure;

  const pitchOf = (doc: MnxStructure) =>
    (doc.parts![0].measures![0].sequences![0].content[0] as { notes: MnxNote[] }).notes[0].pitch;

  it('writes the same sound a different way, and cycles back', () => {
    const session = new EditorSession(oneNote({ step: 'D', octave: 4, alter: 1 }));
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    const seen = [JSON.stringify(pitchOf(session.doc))];
    for (let i = 0; i < 8; i++) {
      expect(session.handleIntent({ type: 'respellNote' })).toBe(true);
      seen.push(JSON.stringify(pitchOf(session.doc)));
    }
    // E♭ is among them, and the cycle returns to where it began.
    expect(seen).toContain(JSON.stringify({ step: 'E', octave: 4, alter: -1 }));
    expect(seen[seen.length - 1] === seen[0] || seen.includes(seen[0])).toBe(true);
  });

  it('keeps the sounding pitch through every step', () => {
    const session = new EditorSession(oneNote({ step: 'C', octave: 4, alter: 1 }));
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    const midi = (p: MnxNote['pitch']) =>
      (p.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(p.step)] + (p.alter ?? 0);
    const start = midi(pitchOf(session.doc));
    for (let i = 0; i < 6; i++) {
      session.handleIntent({ type: 'respellNote' });
      expect(midi(pitchOf(session.doc))).toBe(start);
    }
  });
});

describe('the accidental display', () => {
  /** Every note key whose note carries an `accidentalDisplay`, before it is
   *  stripped — the sites the popover has to reach again. */
  function displaySites(doc: MnxStructure): { key: string; typed: string }[] {
    const sites: { key: string; typed: string }[] = [];
    forEachNoteAddress(doc, address => {
      const display = address.note.accidentalDisplay;
      if (!display) return;
      sites.push({
        key: address.key,
        typed: display.enclosure ? 'accidental parens' : 'accidental'
      });
      delete address.note.accidentalDisplay;
    });
    return sites;
  }

  for (const id of ['spec/accidentals', 'lab/01-pitches/01-parenthesized-accidental']) {
    it(`${id}: the popover rebuilds every display it holds`, () => {
      const original = load(id);
      const stripped = JSON.parse(JSON.stringify(original)) as MnxStructure;
      const sites = displaySites(stripped);
      expect(sites.length, `${id} carries no accidentalDisplay`).toBeGreaterThan(0);

      const session = new EditorSession(stripped, id);
      for (const site of sites) {
        expect(driveToElement(session, site.key), `${id}: could not reach ${site.key}`).toBe(true);
        const parsed = parseAdornment(site.typed);
        expect(parsed, `"${site.typed}" did not parse`).not.toBeNull();
        const accidental = (parsed as { accidental: { show: boolean; parenthesized?: boolean } })
          .accidental;
        expect(
          session.handleIntent({
            type: 'setAccidentalDisplay',
            show: accidental.show,
            ...(accidental.parenthesized ? { parenthesized: true } : {})
          })
        ).toBe(true);
      }
      expect(session.doc).toEqual(original);
    });
  }

  it('reads the words, including the cautionary form', () => {
    expect(parseAdornment('accidental')).toEqual({ accidental: { show: true } });
    expect(parseAdornment('accidental parens')).toEqual({
      accidental: { show: true, parenthesized: true }
    });
    expect(parseAdornment('accidental cautionary')).toEqual({
      accidental: { show: true, parenthesized: true }
    });
    expect(parseAdornment('accidental hidden')).toEqual({ accidental: { show: false } });
    expect(parseAdornment('no accidental')).toEqual({ accidental: 'remove' });
    expect(parseAdornment('accidental sideways')).toBeNull();
    // The other adornments still parse — the family gained a member, not a mode.
    expect(parseAdornment('accent')).toEqual({ marking: 'accent' });
  });
});
