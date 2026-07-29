import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro, exportGuitarPro, buildScore } from '../src/index.js';
import {
  MnxStructure,
  MnxPitch,
  MnxTuningEntry,
  isTimedEvent
} from '../src/common/types.js';
import { pitchToMidi } from '../src/common/tuning.js';

/**
 * MNX -> .gp -> MNX round trips over the project's two reference scores.
 *
 * These fixtures are the point: `House-of-the-Rising-Sun` is standard tuning,
 * `Sun-did-glide` is a 77-bar score in a NON-standard tuning (E4 A3 G3 D3 A2 E2)
 * with two voices. The non-standard tuning is what makes it valuable — MNX and
 * Guitar Pro number strings in OPPOSITE directions (MNX 1 = highest, Guitar Pro
 * 1 = lowest), and with standard tuning alone several of those bugs stay hidden.
 */

const SCORES = path.resolve(__dirname, '../../../server/scores');
const FIXTURES = ['House-of-the-Rising-Sun', 'Sun-did-glide'];

/** Every note/rest flattened in document order, with everything that must survive. */
interface Row {
  measure: number;
  voice: string | undefined;
  midi: number | 'REST';
  base: string;
  dots: number;
  string?: number;
  fret?: number;
}

function rows(mnx: MnxStructure): Row[] {
  const out: Row[] = [];
  for (const part of mnx.parts) {
    part.measures.forEach((measure, measureIndex) => {
      for (const sequence of measure.sequences ?? []) {
        for (const item of sequence.content ?? []) {
          if (!isTimedEvent(item)) continue;
          const base = item.duration.base;
          const dots = item.duration.dots ?? 0;
          const common = { measure: measureIndex, voice: sequence.voice, base, dots };

          if (item.rest || !item.notes?.length) {
            out.push({ ...common, midi: 'REST' });
            continue;
          }
          for (const note of item.notes) {
            const position = note._x?.mnxLab?.tab?.position;
            out.push({
              ...common,
              midi: pitchToMidi(note.pitch),
              string: position?.string,
              fret: position?.fret
            });
          }
        }
      }
    });
  }
  return out;
}

/** Tuning keyed by string number — `_x.mnxLab.tab` says array order carries no meaning. */
function tuningByString(entries: MnxTuningEntry[] | undefined): Record<number, number> {
  const map: Record<number, number> = {};
  for (const entry of entries ?? []) map[entry.string] = pitchToMidi(entry.pitch);
  return map;
}

function everyPitch(mnx: MnxStructure): MnxPitch[] {
  const out: MnxPitch[] = [];
  for (const part of mnx.parts)
    for (const measure of part.measures)
      for (const sequence of measure.sequences ?? [])
        for (const item of sequence.content ?? [])
          if (isTimedEvent(item)) for (const note of item.notes ?? []) out.push(note.pitch);
  return out;
}

describe.each(FIXTURES)('MNX -> Guitar Pro -> MNX: %s', name => {
  async function roundTrip() {
    const original: MnxStructure = JSON.parse(
      await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8')
    );
    // Fidelity is measured with the unison collapse OFF: collapsing is a
    // deliberate editorial change for tab readability (covered separately
    // below), and mixing it in here would hide real round-trip losses.
    const gp = exportGuitarPro(original, { collapseTabUnisons: false });
    const back = importGuitarPro(gp);
    return { original, gp, back };
  }

  it('writes a real Guitar Pro 7 container', async () => {
    const { gp } = await roundTrip();
    expect(gp.length).toBeGreaterThan(0);
    // .gp is a zip archive — "PK\x03\x04".
    expect(Array.from(gp.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('preserves every note and rest: pitch, duration, dots, string and fret', async () => {
    const { original, back } = await roundTrip();
    const before = rows(original);
    const after = rows(back);
    expect(after.length).toBe(before.length);
    expect(after).toEqual(before);
  });

  it('preserves measure and voice structure', async () => {
    const { original, back } = await roundTrip();
    expect(back.parts.length).toBe(original.parts.length);
    expect(back.parts[0].measures.length).toBe(original.parts[0].measures.length);
    expect(back.global.measures.length).toBe(original.global.measures.length);

    const voices = (m: MnxStructure) =>
      m.parts[0].measures.map(measure => (measure.sequences ?? []).length);
    expect(voices(back)).toEqual(voices(original));
  });

  it('preserves tuning exactly, including non-standard tunings', async () => {
    const { original, back } = await roundTrip();
    const before = tuningByString(original.parts[0]._x?.mnxLab?.tab?.tuning);
    const after = tuningByString(back.parts[0]._x?.mnxLab?.tab?.tuning);
    expect(Object.keys(after).length).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it('keeps sounding pitch consistent with tuning + capo + fret', async () => {
    const { back } = await roundTrip();
    const tuning = tuningByString(back.parts[0]._x?.mnxLab?.tab?.tuning);
    // `_x.mnxLab.tab` frets are measured FROM the capo, so it belongs in the identity.
    // Sun-did-glide is capo 4 — omitting it reads as a major third of error.
    const capo = back.parts[0]._x?.mnxLab?.tab?.capo ?? 0;
    let checked = 0;
    for (const row of rows(back)) {
      if (row.midi === 'REST' || row.string === undefined) continue;
      expect(tuning[row.string] + capo + row.fret!).toBe(row.midi);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('emits well-formed pitches (no NaN/null octaves)', async () => {
    const { back } = await roundTrip();
    for (const pitch of everyPitch(back)) {
      expect(Number.isInteger(pitch.octave)).toBe(true);
      expect(pitch.step).toMatch(/^[A-G]$/);
      if (pitch.alter !== undefined) expect(Number.isInteger(pitch.alter)).toBe(true);
    }
    expect(JSON.stringify(back)).not.toContain('null');
  });

  it('declares itself a single-source tab part', async () => {
    const { back } = await roundTrip();
    expect(back.parts[0]._x?.mnxLab?.tab?.staffKind).toBe('both');
    // Guitar Pro is natively single-source, so there is never a second
    // tab-only part to merge — and never a TAB clef.
    for (const measure of back.parts[0].measures)
      for (const entry of measure.clefs ?? []) expect(entry.clef.sign).not.toBe('TAB');
  });
});

describe.each(FIXTURES)('schema conformance: %s', name => {
  it('produces MNX that validates against the project schemas', async () => {
    // The local interfaces in src/common/types.ts mirror src/types/mnx.ts by
    // hand, so THIS is the guard that actually catches drift: the precompiled
    // Ajv validators built from the MNX schema and
    // schemas/mnx-lab-extensions.schema.json.
    //
    // Validated against the PROPOSED schema: the importer writes `rehearsal` and
    // `section`, which are drafted in roadmap/proposed/score-text.md and not yet
    // adopted, so the published schema rejects them by design. Swap this import
    // back to validate-mnx.mjs the moment the CG adopts them — the published
    // validator passing is the signal that the proposal has landed.
    const validate = (await import('../../../worker/generated/validate-mnx-proposed.mjs'))
      .default;
    const { validateNoteExt, validatePartExt, validateGlobalMeasureExt } = await import(
      '../../../worker/generated/validate-extensions.mjs'
    );

    const original: MnxStructure = JSON.parse(
      await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8')
    );
    const back = importGuitarPro(exportGuitarPro(original));

    const valid = validate(back);
    if (!valid) {
      const errors = (validate.errors ?? [])
        .slice(0, 5)
        .map((e: { instancePath: string; message: string }) => `${e.instancePath} ${e.message}`);
      expect.fail(`MNX schema errors (${validate.errors?.length}): ${errors.join(' ; ')}`);
    }

    for (const measure of back.global.measures) {
      if (measure._x?.mnxLab) {
        expect(validateGlobalMeasureExt(measure._x.mnxLab)).toBe(true);
      }
    }

    for (const part of back.parts) {
      if (part._x?.mnxLab) expect(validatePartExt(part._x.mnxLab)).toBe(true);
      for (const measure of part.measures)
        for (const sequence of measure.sequences ?? [])
          for (const item of sequence.content ?? [])
            if (isTimedEvent(item))
              for (const note of item.notes ?? [])
                if (note._x?.mnxLab) expect(validateNoteExt(note._x.mnxLab)).toBe(true);
    }
  });
});

describe('string numbering', () => {
  it('inverts between MNX (1 = highest) and Guitar Pro (1 = lowest)', async () => {
    // Sun-did-glide's 2nd string is A3, not the standard B3 — if the numbering
    // were flipped, this note would come back a different pitch entirely.
    const original: MnxStructure = JSON.parse(
      await fs.readFile(path.join(SCORES, 'Sun-did-glide.mnx.json'), 'utf-8')
    );
    const back = importGuitarPro(exportGuitarPro(original));
    const tuning = tuningByString(back.parts[0]._x?.mnxLab?.tab?.tuning);

    expect(tuning[1]).toBe(64); // string 1 = E4, the HIGHEST string
    expect(tuning[2]).toBe(57); // string 2 = A3 (non-standard; B3 would be 59)
    expect(tuning[6]).toBe(40); // string 6 = E2, the LOWEST string
  });
});

describe('lyrics', () => {
  /**
   * Guitar Pro stores lyrics as one text blob per verse, re-split on
   * whitespace, with a trailing `-` marking a syllable that continues. GP7 also
   * writes them per-beat, which is why attachment (voice, and rest-vs-note)
   * survives — see roadmap/inprogress/guitar-pro.md.
   */
  async function sunRoundTrip() {
    const original: MnxStructure = JSON.parse(
      await fs.readFile(path.join(SCORES, 'Sun-did-glide.mnx.json'), 'utf-8')
    );
    return { original, back: importGuitarPro(exportGuitarPro(original)) };
  }

  function verse(mnx: MnxStructure, line: string) {
    const out: { measure: number; voice?: string; rest: boolean; text: string; type?: string }[] = [];
    for (const part of mnx.parts)
      part.measures.forEach((measure, measureIndex) => {
        for (const sequence of measure.sequences ?? [])
          for (const item of sequence.content ?? []) {
            if (!isTimedEvent(item)) continue;
            const syllable = item.lyrics?.lines?.[line];
            if (syllable?.text)
              out.push({
                measure: measureIndex,
                voice: sequence.voice,
                rest: item.rest !== undefined,
                text: syllable.text,
                type: syllable.type
              });
          }
      });
    return out;
  }

  it('carries all three verses through Guitar Pro with the words intact', async () => {
    const { original, back } = await sunRoundTrip();
    expect(original.global.lyrics?.lineOrder).toEqual(['1', '2', '3']);
    expect(back.global.lyrics?.lineOrder).toEqual(['1', '2', '3']);

    for (const line of ['1', '2', '3']) {
      const before = verse(original, line);
      const after = verse(back, line);
      expect(after.length, `verse ${line} syllable count`).toBe(before.length);
      expect(after.map(s => s.text), `verse ${line} words`).toEqual(before.map(s => s.text));
    }
  });

  it('preserves which event each syllable is attached to', async () => {
    const { original, back } = await sunRoundTrip();
    for (const line of ['1', '2', '3']) {
      const key = (s: { measure: number; voice?: string; rest: boolean }) =>
        `${s.measure}/${s.voice}/${s.rest ? 'rest' : 'note'}`;
      expect(verse(back, line).map(key)).toEqual(verse(original, line).map(key));
    }
  });

  it('preserves hyphenation across the format boundary', async () => {
    const { original, back } = await sunRoundTrip();
    const continued = (mnx: MnxStructure, line: string) =>
      verse(mnx, line).filter(s => s.type === 'start' || s.type === 'middle').map(s => s.text);

    // "shin-" + "ing" etc. must still be marked as continuing, or the renderer
    // loses every hyphen in the score.
    expect(continued(original, '1').length).toBeGreaterThan(0);
    expect(continued(back, '1')).toEqual(continued(original, '1'));
  });

  it('escapes spaces inside a syllable so Guitar Pro does not split it', async () => {
    // A raw space would be read as a syllable break by Guitar Pro's parser.
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }], lyrics: { lineOrder: ['1'] } },
      parts: [
        {
          measures: [
            {
              sequences: [
                {
                  voice: 'v1',
                  content: [
                    {
                      duration: { base: 'whole' },
                      lyrics: { lines: { '1': { text: 'two words', type: 'whole' } } },
                      notes: [{ pitch: { step: 'E', octave: 4 }, _x: { mnxLab: { tab: { position: { string: 1, fret: 0 } } } } }]
                    }
                  ]
                }
              ]
            }
          ],
          _x: { mnxLab: { tab: { staffKind: 'both' } } }
        }
      ]
    };
    const back = importGuitarPro(exportGuitarPro(doc));
    const syllables = verse(back, '1');
    expect(syllables.length).toBe(1);
    expect(syllables[0].text).toBe('two words');
  });
});

describe('same-string unisons', () => {
  /**
   * A string is one physical object. When a note is written in two voices at
   * the same fingerboard position — standard fingerstyle engraving for a note
   * shared between a bass line and the melody — tab cannot show it twice, and
   * consumers disagree: Ultimate Guitar re-frets the duplicate onto another
   * string (in Sun-did-glide's tuning, an open high E reappears as fret 7 on
   * the A string), while TuxGuitar draws both in the same place.
   *
   * Sun-did-glide has exactly 6 of these, and 0 genuine conflicts.
   */
  async function sun(): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCORES, 'Sun-did-glide.mnx.json'), 'utf-8'));
  }

  /** string -> frets claimed at each onset, per measure. */
  function claimsPerMeasure(mnx: MnxStructure) {
    const WHOLES: Record<string, number> = {
      whole: 1, half: 0.5, quarter: 0.25, eighth: 0.125,
      '16th': 0.0625, '32nd': 0.03125, '64th': 0.015625
    };
    const out: { measure: number; string: number; frets: number[] }[] = [];
    for (const part of mnx.parts)
      part.measures.forEach((measure, measureIndex) => {
        const at = new Map<string, number[]>();
        for (const sequence of measure.sequences ?? []) {
          let onset = 0;
          for (const item of sequence.content ?? []) {
            if (!isTimedEvent(item)) break;
            for (const note of item.notes ?? []) {
              const position = note._x?.mnxLab?.tab?.position;
              if (!position) continue;
              const key = `${Math.round(onset * 1e6)}:${position.string}`;
              at.set(key, [...(at.get(key) ?? []), position.fret]);
            }
            onset +=
              (WHOLES[item.duration.base] ?? 0) * (2 - Math.pow(2, -(item.duration.dots ?? 0)));
          }
        }
        for (const [key, frets] of at)
          if (frets.length > 1)
            out.push({ measure: measureIndex + 1, string: Number(key.split(':')[1]), frets });
      });
    return out;
  }

  it('the fixture really does contain them (otherwise this suite proves nothing)', async () => {
    const collisions = claimsPerMeasure(await sun());
    expect(collisions.length).toBeGreaterThan(0);
    // All are the SAME note written twice — no genuine unplayable conflicts.
    for (const c of collisions) expect(new Set(c.frets).size).toBe(1);
  });

  it('writes the note once by default, so no string is claimed twice', async () => {
    const back = importGuitarPro(exportGuitarPro(await sun()));
    expect(claimsPerMeasure(back)).toEqual([]);
  });

  it('keeps the note in the voice where it stands alone, not the chord', async () => {
    // Bar 6: voice 1 is F2+E4 (a chord), voice 2 is the melody's E4. Dropping
    // the melody's copy would leave a hole in the melodic line.
    const back = importGuitarPro(exportGuitarPro(await sun()));
    const measure = back.parts[0].measures[5];
    const firstOf = (voice: string) => {
      const sequence = measure.sequences.find(s => s.voice === voice);
      const item = sequence?.content?.[0];
      return item && isTimedEvent(item) ? item : undefined;
    };
    // Melody keeps its note...
    expect(firstOf('v2')?.notes?.length).toBe(1);
    // ...and the chord voice keeps its other note rather than becoming a rest.
    expect(firstOf('v1')?.notes?.length).toBe(1);
    expect(firstOf('v1')?.rest).toBeUndefined();
  });

  it('reports every collapse instead of doing it silently', async () => {
    const warnings: string[] = [];
    exportGuitarPro(await sun(), { onWarning: m => warnings.push(m) });
    const collapses = warnings.filter(w => /written in two voices/.test(w));
    expect(collapses.length).toBe(claimsPerMeasure(await sun()).length);
  });

  it('can be turned off to reproduce the document literally', async () => {
    const doc = await sun();
    const back = importGuitarPro(exportGuitarPro(doc, { collapseTabUnisons: false }));
    expect(claimsPerMeasure(back).length).toBe(claimsPerMeasure(doc).length);
  });

  it('never collapses a genuine conflict (different frets, one string)', async () => {
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          measures: [
            {
              sequences: [1, 5].map((fret, i) => ({
                voice: `v${i + 1}`,
                content: [
                  {
                    duration: { base: 'whole' as const },
                    notes: [
                      {
                        pitch: { step: 'F' as const, octave: 2, ...(fret === 5 ? { alter: 1 } : {}) },
                        _x: { mnxLab: { tab: { position: { string: 6, fret } } } }
                      }
                    ]
                  }
                ]
              }))
            }
          ],
          _x: { mnxLab: { tab: { staffKind: 'both' as const } } }
        }
      ]
    };
    const warnings: string[] = [];
    const back = importGuitarPro(exportGuitarPro(doc, { onWarning: m => warnings.push(m) }));
    // Unplayable either way — surfacing it beats silently deleting a note.
    expect(claimsPerMeasure(back).length).toBe(1);
    expect(warnings.filter(w => /written in two voices/.test(w))).toEqual([]);
  });
});

describe('repeats and alternate endings', () => {
  /**
   * Guitar Pro flags EVERY bar of a volta with the same ending mask — alphaTab
   * draws the bracket's open hook where a bar's mask differs from the previous
   * bar's and closes it where it differs from the next. MNX states the bracket
   * once with a `duration`, so both directions have to translate the span.
   */
  async function sun(): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCORES, 'Sun-did-glide.mnx.json'), 'utf-8'));
  }

  const structure = (mnx: MnxStructure) =>
    mnx.global.measures
      .map((m, i) => ({ measure: i + 1, repeatStart: m.repeatStart, repeatEnd: m.repeatEnd, ending: m.ending }))
      .filter(m => m.repeatStart || m.repeatEnd || m.ending);

  it('the fixture carries the repeat structure at all', async () => {
    expect(structure(await sun())).toEqual([
      { measure: 9, repeatStart: {}, repeatEnd: undefined, ending: undefined },
      { measure: 47, repeatStart: undefined, repeatEnd: undefined, ending: { numbers: [2], duration: 22 } },
      { measure: 68, repeatStart: undefined, repeatEnd: { times: 3 }, ending: undefined }
    ]);
  });

  it('round-trips repeats, play count and the volta span unchanged', async () => {
    const original = await sun();
    const back = importGuitarPro(exportGuitarPro(original));
    expect(structure(back)).toEqual(structure(original));
  });

  it('flags every bar of the volta in the Guitar Pro model, not just the first', async () => {
    // Only the first bar flagged would render a one-bar bracket.
    const score = buildScore(await sun());
    const flagged = score.masterBars
      .map((mb, i) => ({ bar: i + 1, mask: mb.alternateEndings }))
      .filter(b => b.mask !== 0);

    expect(flagged.length).toBe(22);
    expect(flagged[0].bar).toBe(47);
    expect(flagged[flagged.length - 1].bar).toBe(68);
    expect(new Set(flagged.map(b => b.mask))).toEqual(new Set([0b10])); // ending "2"
  });

  it('carries the repeat signs into the Guitar Pro model', async () => {
    const score = buildScore(await sun());
    expect(score.masterBars[8].isRepeatStart).toBe(true);
    expect(score.masterBars[67].repeatCount).toBe(3);
    expect(score.masterBars.filter(mb => mb.isRepeatStart).length).toBe(1);
  });

  it('handles multiple brackets and multi-numbered endings', async () => {
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: {
        measures: [
          { time: { count: 4, unit: 4 }, repeatStart: {} },
          { ending: { numbers: [1, 2], duration: 2 } },
          {},
          { ending: { numbers: [3] }, repeatEnd: { times: 4 } }
        ]
      },
      parts: [
        {
          measures: Array.from({ length: 4 }, () => ({
            sequences: [{ voice: 'v1', content: [{ duration: { base: 'whole' as const }, rest: {} }] }]
          })),
          _x: { mnxLab: { tab: { staffKind: 'both' as const } } }
        }
      ]
    };

    const score = buildScore(doc);
    // "1,2" is bits 0 and 1; the 2-bar span flags both bars.
    expect(score.masterBars[1].alternateEndings).toBe(0b11);
    expect(score.masterBars[2].alternateEndings).toBe(0b11);
    expect(score.masterBars[3].alternateEndings).toBe(0b100); // ending "3"

    const back = importGuitarPro(exportGuitarPro(doc));
    expect(structure(back)).toEqual(structure(doc));
  });
});

describe('tempo', () => {
  /**
   * `Automation.buildTempoAutomation`'s `reference` argument is an INDEX into
   * alphaTab's multiplier table [1, .5, 1, 1.5, 2, 3] — it names the note value
   * the BPM counts, NOT a note denominator. Passing 4 (as in "a quarter note")
   * selects multiplier 2 and silently doubles the tempo: 180 became 360.
   */
  async function score(name: string): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
  }
  const tempos = (m: MnxStructure) =>
    m.global.measures.flatMap((g, i) => (g.tempos ?? []).map(t => ({ measure: i + 1, ...t })));

  it('reads the authored tempo (Vestapol is 180 bpm in Soundslice)', async () => {
    expect(tempos(await score('Vestapol'))).toEqual([
      { measure: 1, bpm: 180, value: { base: 'quarter' } }
    ]);
    expect(tempos(await score('Sun-did-glide'))[0].bpm).toBe(160);
  });

  it('round-trips the tempo without doubling it', async () => {
    for (const name of ['House-of-the-Rising-Sun', 'Sun-did-glide', 'Vestapol']) {
      const src = await score(name);
      const back = importGuitarPro(exportGuitarPro(src));
      expect(tempos(back), name).toEqual(tempos(src));
    }
  });

  it('converts a non-quarter beat unit rather than mis-scaling it', async () => {
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: {
        measures: [
          {
            time: { count: 6, unit: 8 },
            tempos: [{ bpm: 90, value: { base: 'quarter', dots: 1 } }]
          }
        ]
      },
      parts: [
        {
          measures: [
            { sequences: [{ voice: 'v1', content: [{ duration: { base: 'whole' }, rest: {} }] }] }
          ],
          _x: { mnxLab: { tab: { staffKind: 'both' } } }
        }
      ]
    };
    const back = importGuitarPro(exportGuitarPro(doc));
    // Guitar Pro stores tempo ONLY as quarter-note BPM, so the beat unit is
    // normalised away: 90 dotted-quarters per minute IS 135 quarters per
    // minute. The number changes; the speed does not. (A wrong `reference`
    // would give some other multiple — 180 or 45 — so this still pins it.)
    expect(tempos(back)).toEqual([{ measure: 1, bpm: 135, value: { base: 'quarter' } }]);

    // The invariant that actually matters: quarter-equivalent speed.
    const perQuarter = (bpm: number, base: string, dots = 0) =>
      bpm * (base === 'quarter' ? 1 : base === 'half' ? 2 : 0.5) * (2 - Math.pow(2, -dots));
    expect(perQuarter(back.global.measures[0].tempos![0].bpm, 'quarter')).toBe(
      perQuarter(90, 'quarter', 1)
    );
  });
});

describe('section and rehearsal labels', () => {
  /**
   * Neither has a home in standard MNX — schema v19 has segno/fine/jump but no
   * rehearsal mark, and no general text mechanism at all (the only free text in
   * 188 $defs is lyrics and staff labels). So they live under `_x.mnxLab`,
   * which is schema-legal because `_x` is declared in `global-attrs`.
   *
   * Guitar Pro conflates the two into one `Section{marker, text}`; MNX Lab
   * splits them, because a rehearsal mark is an arbitrary INDEX into the score
   * while a section name states what the music is. Real scores use one or the
   * other: Sun-did-glide names its sections, Vestapol letters them.
   */
  const labels = (m: MnxStructure) =>
    m.global.measures
      .map((g, i) => {
        if (!g.rehearsal && !g.section) return null;
        return {
          measure: i + 1,
          ...(g.rehearsal ? { rehearsal: g.rehearsal.label } : {}),
          ...(g.section ? { section: g.section.label } : {})
        };
      })
      .filter(Boolean);

  async function score(name: string): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
  }

  it('reads named sections', async () => {
    expect(labels(await score('Sun-did-glide'))).toEqual([
      { measure: 1, section: 'Intro' },
      { measure: 9, section: 'Pre-Verse' },
      { measure: 17, section: 'Verse' },
      { measure: 47, section: 'Interlude' },
      { measure: 69, section: 'Outro' }
    ]);
  });

  it('reads lettered rehearsal marks', async () => {
    expect(labels(await score('Vestapol'))).toEqual([
      { measure: 3, rehearsal: 'A' },
      { measure: 23, rehearsal: 'B' },
      { measure: 43, rehearsal: 'C' },
      { measure: 63, rehearsal: 'A' }
    ]);
  });

  it('round-trips both forms through Guitar Pro', async () => {
    for (const name of ['Sun-did-glide', 'Vestapol']) {
      const src = await score(name);
      expect(labels(importGuitarPro(exportGuitarPro(src))), name).toEqual(labels(src));
    }
  });

  it('keeps a rehearsal mark and a section name distinct on one measure', async () => {
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: {
        measures: [
          {
            time: { count: 4, unit: 4 },
            rehearsal: { label: 'A' },
            section: { label: 'Verse' }
          }
        ]
      },
      parts: [
        {
          measures: [
            { sequences: [{ voice: 'v1', content: [{ duration: { base: 'whole' }, rest: {} }] }] }
          ],
          _x: { mnxLab: { tab: { staffKind: 'both' } } }
        }
      ]
    };
    const back = importGuitarPro(exportGuitarPro(doc));
    expect(back.global.measures[0].rehearsal).toEqual({ label: 'A' });
    expect(back.global.measures[0].section).toEqual({ label: 'Verse' });
  });
});

describe('chord symbols', () => {
  /**
   * Guitar Pro states a chord in two unrelated ways and the corpus uses both:
   * a bare `beat.text` annotation (Vestapol) and a `Chord` object referenced by
   * `beat.chordId` (House of the Rising Sun). Both are read into the same
   * global harmony track.
   */
  const harmonies = (m: MnxStructure) =>
    m.global.measures.flatMap((g, i) =>
      (g._x?.mnxLab?.harmonies ?? []).map(h => ({ measure: i + 1, ...h }))
    );

  async function score(name: string): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
  }

  it('reads beat text as structured harmony', async () => {
    const found = harmonies(await score('Vestapol'));
    expect(found).toHaveLength(25);
    expect(found[0]).toEqual({
      measure: 3,
      location: { fraction: [0, 1] },
      root: { step: 'D' },
      quality: 'major'
    });
    expect(found.map(h => h.quality)).toContain('dominantSeventh');
  });

  it('reads Guitar Pro chord objects, slash chords included', async () => {
    const found = harmonies(await score('House-of-the-Rising-Sun'));
    expect(found).toHaveLength(14);
    expect(found[2]).toEqual({
      measure: 4,
      location: { fraction: [0, 1] },
      root: { step: 'D' },
      quality: 'major',
      bass: { step: 'F', alter: 1 }
    });
  });

  it('keeps a literal spelling the structure cannot reproduce', async () => {
    // The source spells one chord `c/G` with a lowercase root. Lowercase is not
    // a reliable minor marker, so the structure reads it as C major over G and
    // `text` carries the literal — nothing in the source file is lost.
    const odd = harmonies(await score('House-of-the-Rising-Sun')).find(h => h.text);
    expect(odd).toMatchObject({ root: { step: 'C' }, quality: 'major', text: 'c/G' });
  });

  it('omits `text` when the structure renders the source spelling exactly', async () => {
    expect(harmonies(await score('Vestapol')).every(h => h.text === undefined)).toBe(true);
  });

  it('round-trips through Guitar Pro', async () => {
    for (const name of ['Vestapol', 'House-of-the-Rising-Sun']) {
      const src = await score(name);
      expect(harmonies(importGuitarPro(exportGuitarPro(src))), name).toEqual(harmonies(src));
    }
  });
});

describe('technique', () => {
  const techniques = (m: MnxStructure) => {
    const counts: Record<string, number> = {};
    for (const part of m.parts)
      for (const measure of part.measures)
        for (const sequence of measure.sequences ?? [])
          for (const item of sequence.content ?? [])
            if (isTimedEvent(item))
              for (const note of item.notes ?? [])
                for (const key of Object.keys(note._x?.mnxLab?.tab?.technique ?? {}))
                  counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  };

  async function score(name: string): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
  }

  it('carries harmonics and palm mute, which v2 of the extension could not', async () => {
    expect(techniques(await score('Vestapol'))).toMatchObject({
      harmonic: 42,
      palmMute: 2,
      bend: 11,
      slide: 17,
      hammerOn: 32,
      pullOff: 10
    });
  });

  it('stores a bend as a curve in semitones, not a single interval', async () => {
    const bends: { position: number; alter: number }[][] = [];
    const src = await score('Vestapol');
    for (const part of src.parts)
      for (const measure of part.measures)
        for (const sequence of measure.sequences ?? [])
          for (const item of sequence.content ?? [])
            if (isTimedEvent(item))
              for (const note of item.notes ?? []) {
                const bend = note._x?.mnxLab?.tab?.technique?.bend;
                if (bend) bends.push(bend.points);
              }

    expect(bends).toHaveLength(11);
    // Guitar Pro stores quarter tones; MNX Lab stores semitones, so alphaTab's
    // 1 is a quarter-tone curl (0.5) and its 4 is a full step (2).
    expect(bends).toContainEqual([
      { position: 0, alter: 0 },
      { position: 1, alter: 0.5 }
    ]);
    expect(bends).toContainEqual([
      { position: 0, alter: 0 },
      { position: 1, alter: 2 }
    ]);
  });

  it('round-trips every technique through Guitar Pro', async () => {
    for (const name of ['Vestapol', 'Sun-did-glide', 'House-of-the-Rising-Sun']) {
      const src = await score(name);
      expect(techniques(importGuitarPro(exportGuitarPro(src))), name).toEqual(techniques(src));
    }
  });
});
