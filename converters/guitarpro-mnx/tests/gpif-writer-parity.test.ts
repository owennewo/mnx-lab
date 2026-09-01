import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro, exportGuitarPro } from '../src/index.js';
import { importGuitarProGpif, exportGuitarProGpif } from '../src/gpif/index.js';
import { MnxStructure } from '../src/common/types.js';
import { normalizeIds } from './helpers/normalize.js';

/**
 * The clean-room GPIF writer, held to LOSSLESSNESS through a production
 * parser — a stronger standard than drop-in equivalence with `Gp7Exporter`,
 * because building these tests exposed two places where alphaTab's own
 * exporter is lossy and the clean-room writer is not:
 *
 *  - Gp7Exporter drops double barlines; this writer emits `<DoubleBar/>`.
 *  - Gp7Exporter writes harmonic notes without `HarmonicFret`, which
 *    alphaTab's own reader then mis-pitches an octave low (Vestapol's 42
 *    natural harmonics); this writer states the touch fret and the pitches
 *    survive.
 *
 * So instead of mirroring those losses, the contract is: what this writer
 * puts in a `.gp`, BOTH readers — alphaTab's production GPIF parser and the
 * clean-room one — get back out exactly as the committed fixture says, for
 * every `.mnx.json` in the corpus. `collapseTabUnisons: false` keeps the
 * one deliberate export-side normalization (a note written identically in
 * two voices collapsing to one) out of a losslessness measurement; the
 * default-collapse path is exercised separately against Gp7Exporter, which
 * applies the same collapse.
 */

const SCORES = path.resolve(__dirname, '../../fixtures');
const FIXTURES = [
  'House-of-the-Rising-Sun',
  'Sun-did-glide',
  'Vestapol',
  'Triplets-and-graces'
];

async function committed(name: string): Promise<MnxStructure> {
  return JSON.parse(await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
}

describe.each(FIXTURES)('clean-room GPIF writer: %s', name => {
  it('alphaTab reads the clean-room .gp back to the committed document exactly', async () => {
    const mnx = await committed(name);
    const bytes = exportGuitarProGpif(mnx, { collapseTabUnisons: false });
    expect(normalizeIds(importGuitarPro(bytes))).toEqual(normalizeIds(mnx));
  });

  it('the all-clean-room round trip reproduces the committed document', async () => {
    const mnx = await committed(name);
    const bytes = exportGuitarProGpif(mnx, { collapseTabUnisons: false });
    expect(normalizeIds(importGuitarProGpif(bytes))).toEqual(normalizeIds(mnx));
  });

  it('both readers agree on what a default-options clean-room file says', async () => {
    const bytes = exportGuitarProGpif(await committed(name));
    expect(normalizeIds(importGuitarProGpif(bytes))).toEqual(
      normalizeIds(importGuitarPro(bytes))
    );
  });

  it('applies the default unison collapse exactly as the alphaTab writer does', async () => {
    const mnx = await committed(name);
    const stripKnownGp7ExporterLosses = (doc: MnxStructure) => {
      // Gp7Exporter drops double barlines and mis-pitches harmonics (see the
      // header note); mask exactly those so its known losses cannot hide a
      // real collapse difference.
      const clone: MnxStructure = JSON.parse(JSON.stringify(doc));
      for (const measure of clone.global?.measures ?? []) delete measure.barline;
      for (const part of clone.parts)
        for (const measure of part.measures)
          for (const sequence of measure.sequences ?? [])
            for (const item of sequence.content ?? [])
              for (const note of ('notes' in item ? (item.notes ?? []) : []))
                if (note._x?.mnxLab?.tab?.technique?.harmonic) {
                  note.pitch = { step: 'C', octave: 0 };
                }
      return clone;
    };
    expect(
      stripKnownGp7ExporterLosses(normalizeIds(importGuitarPro(exportGuitarProGpif(mnx))))
    ).toEqual(
      stripKnownGp7ExporterLosses(normalizeIds(importGuitarPro(exportGuitarPro(mnx))))
    );
  });
});
