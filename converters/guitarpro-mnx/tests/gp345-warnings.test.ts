import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { GpBinaryReader } from '../src/gp345/binary.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s musical loss warnings', revision => {
  it('reports triplet feel and GP5 navigation instead of silently discarding them', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/basic-${revision}.gp${revision[0]}`));
    const offsets = new Map<string, number>();
    const readByte = GpBinaryReader.prototype.readUint8;
    const readShort = GpBinaryReader.prototype.readInt16;
    const byteObserver = vi.spyOn(GpBinaryReader.prototype, 'readUint8').mockImplementation(function (
      this: GpBinaryReader, label?: string
    ) {
      if (label?.includes('triplet feel')) offsets.set(label, this.offset);
      return readByte.call(this, label);
    });
    const shortObserver = vi.spyOn(GpBinaryReader.prototype, 'readInt16').mockImplementation(function (
      this: GpBinaryReader, label?: string
    ) {
      if (label?.startsWith('direction ')) offsets.set(label, this.offset);
      return readShort.call(this, label);
    });
    let baseline;
    try { baseline = parseGuitarProBinary(bytes); }
    finally { byteObserver.mockRestore(); shortObserver.mockRestore(); }
    expect([...offsets.keys()].some(label => label.includes('triplet feel'))).toBe(true);
    if (revision.startsWith('5')) expect([...offsets.keys()].filter(label => label.startsWith('direction '))).toHaveLength(19);
    for (const [label, offset] of offsets) {
      const modified = Buffer.from(bytes);
      if (label.startsWith('direction ')) modified.writeInt16LE(2, offset);
      else modified[offset] = 1;
      const warnings: string[] = [];
      const actual = parseGuitarProBinary(modified, { onWarning: message => warnings.push(message) });
      // These fields affect playback/navigation, not our retained written notes.
      expect(actual).toEqual(baseline);
      const loss = warnings.filter(message => /triplet feel|navigation direction/.test(message));
      expect(loss).toHaveLength(1);
      expect(loss[0]).toContain(label.startsWith('direction ') ? label.slice('direction '.length) : 'triplet feel');
      expect(loss[0]).toContain('not represented');
    }
  });
});
