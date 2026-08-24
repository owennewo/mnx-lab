import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro } from '../src/index.js';
import {
  MnxGrace,
  MnxStructure,
  isGrace,
  isTimedEvent,
  isTuplet
} from '../src/common/types.js';

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

/**
 * The fourth fixture, and the only one that is not a `.gpx` from the app.
 *
 * `Triplets-and-graces` is hand-authored as GPIF — Guitar Pro 7/8's own native
 * XML, zipped into a `.gp` — because the three app-authored scores contain no
 * tuplet and no grace note between them, and a converter cannot be shown to
 * carry what nothing asks it to carry. `converters/fixtures/tools/` writes it
 * and says why at length; what matters here is that alphaTab reads it with the
 * same production GPIF parser that opens a musician's file, so the import path
 * under test is the real one.
 *
 * These assertions are about the CONTAINERS, because that is the whole of what
 * the source says and our old importer did not: Guitar Pro flags each beat and
 * MNX declares each group once, so "did the flags become the right containers"
 * is the question, and the pitches (covered by the round trip) are not.
 */
describe('import from a hand-authored Guitar Pro 7 container: Triplets-and-graces', () => {
  async function imported(): Promise<MnxStructure> {
    const bytes = await fs.readFile(path.join(SCORES, 'Triplets-and-graces.gp'));
    return importGuitarPro(new Uint8Array(bytes));
  }

  /** The first voice of a measure — the only one carrying content here. */
  async function voice(measureIndex: number) {
    const mnx = await imported();
    return mnx.parts[0].measures[measureIndex].sequences?.[0]?.content ?? [];
  }

  it('is a Guitar Pro 7 container, not a `.gpx` and not something we exported', async () => {
    const bytes = await fs.readFile(path.join(SCORES, 'Triplets-and-graces.gp'));
    // "PK\x03\x04" — the zip a `.gp` is. (The `.gpx` fixtures are BCFS.)
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('reproduces the committed .mnx.json exactly', async () => {
    const committed = JSON.parse(
      await fs.readFile(path.join(SCORES, 'Triplets-and-graces.mnx.json'), 'utf-8')
    );
    expect(await imported()).toEqual(committed);
  });

  it('leaves a bar with no flagged beats entirely flat', async () => {
    const content = await voice(0);
    expect(content.map(item => (item as { type?: string }).type ?? 'event')).toEqual([
      'event', 'event', 'event', 'event'
    ]);
  });

  it('splits a run of six flagged eighths into TWO triplets, not one six-note tuplet', async () => {
    const content = await voice(1);
    const tuplets = content.filter(isTuplet);
    expect(tuplets.length).toBe(2);
    for (const tuplet of tuplets) {
      expect(tuplet.content.length).toBe(3);
      expect(tuplet.inner).toEqual({ duration: { base: 'eighth' }, multiple: 3 });
      expect(tuplet.outer).toEqual({ duration: { base: 'eighth' }, multiple: 2 });
    }
    // …and the two unflagged quarters beside them stay outside both.
    expect(content.filter(isTimedEvent).length).toBe(2);
  });

  it('reads a quarter-note triplet at its own value, not the eighth everyone assumes', async () => {
    const tuplet = (await voice(2)).find(isTuplet);
    expect(tuplet?.inner).toEqual({ duration: { base: 'quarter' }, multiple: 3 });
    expect(tuplet?.outer).toEqual({ duration: { base: 'quarter' }, multiple: 2 });
  });

  it('wraps a `BeforeBeat` grace as an un-timed container ahead of its principal', async () => {
    const content = await voice(2);
    const grace = content[0];
    expect(isGrace(grace)).toBe(true);
    expect((grace as MnxGrace).graceType).toBe('stealPrevious');
    expect((grace as MnxGrace).content.length).toBe(1);
    // The container is un-timed, so the bar's four quarters are the events
    // AFTER it: the principal, one more quarter, and the triplet's half note.
    expect(content.slice(1).filter(isTimedEvent).length).toBe(2);
  });
});
