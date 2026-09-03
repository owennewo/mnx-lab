import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  GpBinaryReader,
  readGpBinaryPreamble,
  sniffGpBinaryVersion
} from '../src/gp345/index.js';

function fixedByteString(value: string, size: number): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length > size) throw new Error('test string is too long');
  const bytes = new Uint8Array(size + 1);
  bytes[0] = encoded.length;
  bytes.set(encoded, 1);
  return bytes;
}

function int32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

describe('legacy Guitar Pro binary cursor', () => {
  it('reads little-endian signed and unsigned primitives sequentially', () => {
    const reader = new GpBinaryReader(
      new Uint8Array([0xff, 0xfe, 0x34, 0x12, 0xfc, 0xff, 0xff, 0xff])
    );
    expect(reader.readUint8()).toBe(255);
    expect(reader.readInt8()).toBe(-2);
    expect(reader.readUint16()).toBe(0x1234);
    expect(reader.readInt32()).toBe(-4);
    expect(reader.offset).toBe(8);
    expect(reader.remaining).toBe(0);
  });

  it('reads all three GP3–5 string encodings as Windows-1252', () => {
    const bytes = new Uint8Array([
      4, 0x63, 0x61, 0x66, 0xe9,
      ...int32(4), 0x63, 0x61, 0x66, 0xe9,
      ...int32(5), 4, 0x63, 0x61, 0x66, 0xe9
    ]);
    const reader = new GpBinaryReader(bytes);
    expect(reader.readByteSizeString('byte string')).toBe('café');
    expect(reader.readIntSizeString('int string')).toBe('café');
    expect(reader.readIntByteSizeString('hybrid string')).toBe('café');
    expect(reader.remaining).toBe(0);
  });

  it('consumes the padding in a fixed-width byte-size string', () => {
    const reader = new GpBinaryReader(new Uint8Array([2, 0x47, 0x50, 0, 0, 0, 0x7f]));
    expect(reader.readByteSizeString('fixed string', 5)).toBe('GP');
    expect(reader.offset).toBe(6);
    expect(reader.readUint8()).toBe(0x7f);
  });

  it('reports truncation at the field and byte offset that caused it', () => {
    const reader = new GpBinaryReader(new Uint8Array([4, 0x47, 0x50]));
    expect(() => reader.readByteSizeString('track name')).toThrow(
      /at 0x1: track name needs 4 bytes, only 2 remain/
    );
  });

  it('rejects inconsistent hybrid string lengths before desynchronising', () => {
    const reader = new GpBinaryReader(new Uint8Array([...int32(8), 2, 0x47, 0x50]));
    expect(() => reader.readIntByteSizeString('title')).toThrow(
      /title length mismatch: outer length 8, byte length 2/
    );
  });
});

describe('legacy Guitar Pro version dispatch', () => {
  it.each([
    ['FICHIER GUITAR PRO v3.00', 3, 0],
    ['FICHIER GUITAR PRO v4.00', 4, 0],
    ['FICHIER GUITAR PRO v4.06', 4, 6],
    ['FICHIER GUITAR PRO L4.06', 4, 6],
    ['FICHIER GUITAR PRO v5.00', 5, 0],
    ['FICHIER GUITAR PRO v5.10', 5, 10]
  ] as const)('recognises %s', (raw, major, revision) => {
    expect(sniffGpBinaryVersion(fixedByteString(raw, 30))).toMatchObject({
      raw,
      major,
      revision
    });
  });

  it('refuses older and unknown formats precisely', () => {
    expect(() =>
      sniffGpBinaryVersion(fixedByteString('FICHIER GUITAR PRO v2.21', 30))
    ).toThrow(/unsupported Guitar Pro binary version.*v2\.21/);
  });

  it('refuses a truncated fixed-width header', () => {
    expect(() => sniffGpBinaryVersion(new Uint8Array([5, 0x47, 0x50]))).toThrow(
      /version needs 30 bytes, only 2 remain/
    );
  });
});

describe.each([
  ['basic-5.00.gp5', 0],
  ['basic-5.10.gp5', 10]
] as const)('PyGuitarPro fixture preamble: %s', (name, revision) => {
  it('reads the version and Windows-1252 score information', async () => {
    const file = await fs.readFile(path.resolve(__dirname, 'fixtures/gp5', name));
    const preamble = readGpBinaryPreamble(new Uint8Array(file));

    expect(preamble.version).toMatchObject({ major: 5, revision });
    expect(preamble.scoreInfo).toEqual({
      title: 'Legacy café',
      subtitle: 'GP5 binary baseline',
      artist: 'MNX Lab',
      album: 'Clean-room fixtures',
      words: 'Public-domain test text',
      music: 'MNX Lab',
      copyright: 'CC0',
      tab: 'Generated fixture',
      instructions: 'Structural baseline; metadata intentionally exercises Windows-1252.',
      notice: ["Generated with PyGuitarPro's public API."]
    });
    // Both revisions share this prefix layout; the next byte starts lyrics.
    expect(preamble.bodyOffset).toBe(298);
    expect(preamble.bodyOffset).toBeLessThan(file.length);
  });
});
