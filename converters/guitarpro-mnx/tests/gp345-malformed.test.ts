import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { GpBinaryReader } from '../src/gp345/binary.js';

// Observe labelled cursor reads on a valid file, then mutate only the wire
// bytes. No parser internals are mocked during the malformed-input assertion.
function countOffsets(bytes: Uint8Array): Map<string, number> {
  const offsets = new Map<string, number>();
  const original = GpBinaryReader.prototype.readInt32;
  const observer = vi.spyOn(GpBinaryReader.prototype, 'readInt32').mockImplementation(function (
    this: GpBinaryReader, label?: string
  ) {
    if (label?.endsWith('count')) offsets.set(label, this.offset);
    return original.call(this, label);
  });
  try { parseGuitarProBinary(bytes); }
  finally { observer.mockRestore(); }
  return offsets;
}

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s damaged input', revision => {
  const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/basic-${revision}.gp${revision[0]}`));
  it('rejects negative and overflowing declared counts at their labelled fields', () => {
    const offsets = countOffsets(bytes);
    expect(offsets.has('measure count')).toBe(true);
    expect(offsets.has('track count')).toBe(true);
    expect([...offsets.keys()].some(label => label.endsWith('beat count'))).toBe(true);
    for (const [label, offset] of offsets) {
      for (const value of [-1, 0x7fffffff]) {
        const corrupt = Buffer.from(bytes);
        corrupt.writeInt32LE(value, offset);
        let error: unknown;
        try { parseGuitarProBinary(corrupt); }
        catch (caught) { error = caught; }
        expect(error, `${label}=${value}`).toBeInstanceOf(Error);
        expect(error, `${label}=${value}`).not.toBeInstanceOf(RangeError);
      }
    }
  });

  it('rejects every incomplete prefix without native range errors', () => {
    for (let length = 0; length < bytes.length; length++) {
      // GP3's observed zero-integer trailer is optional, so dropping it is valid.
      if (revision === '3.00' && length === bytes.length - 4) continue;
      if (revision.startsWith('5') && length === bytes.length - 1) continue;
      let error: unknown;
      try { parseGuitarProBinary(bytes.subarray(0, length)); }
      catch (caught) { error = caught; }
      expect(error, `prefix ${length}/${bytes.length}`).toBeInstanceOf(Error);
      expect(error, `prefix ${length}/${bytes.length}`).not.toBeInstanceOf(RangeError);
    }
  });
  if (revision.startsWith('5')) it('allows only the terminal layout byte to be omitted', () => {
    expect(parseGuitarProBinary(bytes.subarray(0, -1))).toEqual(parseGuitarProBinary(bytes));
    expect(() => parseGuitarProBinary(bytes.subarray(0, -2))).toThrow();
  });
  it('rejects unexplained trailing bytes', () => {
    expect(() => parseGuitarProBinary(Buffer.concat([bytes, Buffer.from([0xff])])))
      .toThrow();
  });
});

describe.each(['5.00', '5.10'])('GP%s damaged bend counts', revision => {
  it('rejects invalid point-list sizes before reading points', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/bends-${revision}.gp5`));
    const offsets = [...countOffsets(bytes)].filter(([label]) => label.endsWith('point count'));
    expect(offsets.length).toBeGreaterThan(0);
    for (const [label, offset] of offsets) {
      for (const value of [-1, 0x7fffffff]) {
        const corrupt = Buffer.from(bytes);
        corrupt.writeInt32LE(value, offset);
        expect(() => parseGuitarProBinary(corrupt), `${label}=${value}`).toThrow(/point count/);
      }
    }
  });
});
