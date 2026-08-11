import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro } from '../src/index.js';
import { MnxStructure, isTimedEvent } from '../src/common/types.js';

/**
 * The IMPORT side, from real Guitar Pro binaries.
 *
 * Every other test in this package starts from `.mnx.json` and measures a
 * MNX -> .gp -> MNX round trip — which exercises our exporter and our mapper,
 * but never the thing a user actually does first: open a file Guitar Pro
 * wrote. The `.gpx` fixtures are exactly that. They are BCFS containers (the
 * GP6 proprietary binary, magic `BCFS`), authored in the app, and per
 * CLAUDE.md they are the SOURCE of the corpus: `.mnx.json` is derived from
 * them via `guitarpro-mnx --import`.
 *
 * That derivation is a claim no test made. These do, byte for byte — so an
 * importer change can no longer silently invalidate every committed fixture
 * (and, transitively, the MusicXML `.xml` derived from them). Regenerate with
 * the CLI when a change is intended; a diff here means the corpus moved.
 *
 * What this cannot cover: gp3/gp4/gp5. Those are alphaTab's binary readers,
 * not ours — see the scope note in roadmap/complete/core-guitar-pro.md.
 */

const SCORES = path.resolve(__dirname, '../../fixtures');
const FIXTURES = ['House-of-the-Rising-Sun', 'Sun-did-glide', 'Vestapol'];

async function committed(name: string): Promise<MnxStructure> {
  return JSON.parse(await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8'));
}

async function imported(name: string): Promise<MnxStructure> {
  const bytes = await fs.readFile(path.join(SCORES, `${name}.gpx`));
  return importGuitarPro(new Uint8Array(bytes));
}

describe.each(FIXTURES)('import from a Guitar Pro binary: %s', name => {
  it('the fixture really is a Guitar Pro container, not something we wrote', async () => {
    const bytes = await fs.readFile(path.join(SCORES, `${name}.gpx`));
    // "BCFS" — GP6's own compressed container. A .gp we exported would be a
    // zip ("PK\x03\x04"), which would make this suite prove nothing.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x42, 0x43, 0x46, 0x53]);
  });

  it('reproduces the committed .mnx.json exactly', async () => {
    expect(await imported(name)).toEqual(await committed(name));
  });

  it('carries a fingerboard: declared strings and a fret for every note', async () => {
    const mnx = await imported(name);
    for (const part of mnx.parts) {
      expect(part._x?.mnxLab?.strings?.length, `${name}: strings`).toBeGreaterThan(0);
      for (const measure of part.measures)
        for (const sequence of measure.sequences ?? [])
          for (const item of sequence.content ?? []) {
            if (!isTimedEvent(item) || item.rest) continue;
            for (const note of item.notes ?? []) {
              expect(note._x?.mnxLab?.string, `${name}: note.string`).toBeGreaterThan(0);
            }
          }
    }
  });
});
