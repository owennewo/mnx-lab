import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro } from '../src/index.js';
import {
  importGuitarProGpif,
  extractScoreGpif,
  sniffContainer,
  decompressBcfz
} from '../src/gpif/index.js';
import { normalizeIds } from './helpers/normalize.js';

/**
 * The clean-room GPIF importer, held to DIFFERENTIAL PARITY with alphaTab.
 *
 * `src/gpif/` reads `.gp`/`.gpx` without alphaTab — its own container layer,
 * its own GPIF parser, its own MNX mapping (research/gpif-field-notes.md is
 * the reconstruction it was written from). alphaTab remains the production
 * import path until this suite proves the replacement carries everything, so
 * the test is exact structural equality against `importGuitarPro` on the SAME
 * bytes, over every Guitar Pro fixture — five files spanning both containers
 * (BCFS `.gpx`, zip `.gp`) and both gpif dialects (GP6, GP7/8).
 *
 * The one permitted difference is note-id NAMING: alphaTab numbers notes with
 * its own score-global counter, the clean-room path with its own. Ids are
 * structural (technique targets reference them), so both sides are rewritten
 * to sequential ids in traversal order — the renaming is a bijection, so a
 * dangling or crossed target still fails.
 */

const SCORES = path.resolve(__dirname, '../../fixtures');
const FIXTURES = [
  'House-of-the-Rising-Sun.gpx',
  'Sun-did-glide.gpx',
  'Vestapol.gpx',
  'Sun-did-glide.gp',
  'Triplets-and-graces.gp'
];

async function bytes(name: string): Promise<Uint8Array> {
  return new Uint8Array(await fs.readFile(path.join(SCORES, name)));
}

describe.each(FIXTURES)('clean-room GPIF importer parity: %s', name => {
  it('produces exactly what the alphaTab importer produces', async () => {
    const data = await bytes(name);
    const cleanRoom = normalizeIds(importGuitarProGpif(data));
    const alphaTab = normalizeIds(importGuitarPro(data));
    expect(cleanRoom).toEqual(alphaTab);
  });
});

describe('GPIF container layer', () => {
  it.each(FIXTURES)('extracts GPIF XML from %s', async name => {
    const xml = extractScoreGpif(await bytes(name));
    expect(xml).toContain('<GPIF>');
    expect(xml).toContain('<MasterBars>');
  });

  it('tells the container kinds apart by magic', async () => {
    expect(sniffContainer(await bytes('Sun-did-glide.gp'))).toBe('gp-zip');
    expect(sniffContainer(await bytes('Sun-did-glide.gpx'))).toBe('gpx-bcfs');
    expect(sniffContainer(new Uint8Array([0x18, 0x00, 0x00, 0x00]))).toBe('gp345-binary');
  });

  it('refuses the gp3–5 binary family with a reason, never a wrong parse', async () => {
    expect(() => extractScoreGpif(new Uint8Array([0x18, 0x01, 0x02, 0x03]))).toThrow(
      /gp3\/gp4\/gp5/
    );
  });

  /**
   * No committed fixture is BCFZ (Guitar Pro wrote ours uncompressed), so the
   * decompressor is exercised on a stream built bit-by-bit here: literal runs
   * followed by a back-reference that must copy from the already-written
   * output and stop at the declared length.
   */
  it('decompresses a hand-built BCFZ stream', () => {
    const writer = new BitWriter();
    // Declared decompressed length: 10 bytes, little-endian u32.
    writer.pushBits(10, 8);
    writer.pushBits(0, 8);
    writer.pushBits(0, 8);
    writer.pushBits(0, 8);
    // Two literal runs: "ab", "cd".
    writer.pushLiteralRun([0x61, 0x62]);
    writer.pushLiteralRun([0x63, 0x64]);
    // Back-reference: reach back 4, copy 6 — capped at 4 by the window, then
    // the declared length caps the final copy.
    writer.pushBackReference(4, 15);
    writer.pushBackReference(4, 15);

    const out = decompressBcfz(writer.finish());
    expect(Buffer.from(out).toString('latin1')).toBe('abcdabcdab');
  });
});

/** MSB-first bit writer mirroring the reader's layout, to craft BCFZ streams. */
class BitWriter {
  private bytes: number[] = [];
  private bit = 0;

  private pushBit(value: number): void {
    if (this.bit === 0) this.bytes.push(0);
    this.bytes[this.bytes.length - 1] |= (value & 1) << (7 - this.bit);
    this.bit = (this.bit + 1) % 8;
  }

  pushBits(value: number, count: number): void {
    for (let index = count - 1; index >= 0; index--) this.pushBit((value >> index) & 1);
  }

  pushBitsReversed(value: number, count: number): void {
    for (let index = 0; index < count; index++) this.pushBit((value >> index) & 1);
  }

  pushLiteralRun(bytes: number[]): void {
    this.pushBit(0);
    this.pushBitsReversed(bytes.length, 2);
    for (const byte of bytes) this.pushBits(byte, 8);
  }

  pushBackReference(offset: number, size: number): void {
    this.pushBit(1);
    this.pushBits(4, 4); // field width: 4 bits each for offset and size
    this.pushBitsReversed(offset, 4);
    this.pushBitsReversed(size, 4);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}
