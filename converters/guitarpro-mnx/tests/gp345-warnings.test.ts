import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { GpBinaryReader } from '../src/gp345/binary.js';

/** Where the reader consumed each labelled field, so a test can flip it. */
function fieldOffsets(bytes: Buffer) {
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
  try { return { offsets, baseline: parseGuitarProBinary(bytes) }; }
  finally { byteObserver.mockRestore(); shortObserver.mockRestore(); }
}

const fixture = (revision: string) =>
  readFileSync(resolve(__dirname, `fixtures/gp5/basic-${revision}.gp${revision[0]}`));

// GP3/4 carry ONE score-level flag and it means eighth-note triplet feel; GP5
// moved it onto each measure header. Both now land on `_x.mnxLab.swing`, so
// neither is a loss any more — the value became data instead of a warning.
describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s triplet feel', revision => {
  it('reads the feel into the master bars instead of warning it away', () => {
    const bytes = fixture(revision);
    const { offsets, baseline } = fieldOffsets(bytes);
    const labels = [...offsets.keys()].filter(label => label.includes('triplet feel'));
    expect(labels.length).toBeGreaterThan(0);
    expect(baseline.masterBars.every(bar => bar.tripletFeel === null)).toBe(true);

    for (const label of labels) {
      const modified = Buffer.from(bytes);
      modified[offsets.get(label)!] = 1;
      const warnings: string[] = [];
      const actual = parseGuitarProBinary(modified, { onWarning: message => warnings.push(message) });
      expect(warnings.filter(message => /triplet feel/.test(message))).toHaveLength(0);
      expect(actual.masterBars.some(bar => bar.tripletFeel === 'Triplet8th')).toBe(true);
      // Nothing else moves: a feel changes how the written notes are played,
      // never what they are.
      expect({ ...actual, masterBars: actual.masterBars.map(bar => ({ ...bar, tripletFeel: null })) })
        .toEqual(baseline);
    }
  });
});

describe.each(['5.00', '5.10'])('GP%s unknown triplet feel', revision => {
  it('plays a value Guitar Pro never writes straight, and says so', () => {
    const bytes = fixture(revision);
    const { offsets } = fieldOffsets(bytes);
    const label = [...offsets.keys()].find(name => name.includes('triplet feel'))!;
    const modified = Buffer.from(bytes);
    modified[offsets.get(label)!] = 7;
    const warnings: string[] = [];
    const actual = parseGuitarProBinary(modified, { onWarning: message => warnings.push(message) });
    expect(warnings.some(message => /unknown triplet feel 7/.test(message))).toBe(true);
    expect(actual.masterBars.every(bar => bar.tripletFeel === null)).toBe(true);
  });
});

describe.each(['5.00', '5.10'])('GP%s navigation loss warnings', revision => {
  it('reports a navigation direction instead of silently discarding it', () => {
    const bytes = fixture(revision);
    const { offsets, baseline } = fieldOffsets(bytes);
    const labels = [...offsets.keys()].filter(label => label.startsWith('direction '));
    expect(labels).toHaveLength(19);

    for (const label of labels) {
      const modified = Buffer.from(bytes);
      modified.writeInt16LE(2, offsets.get(label)!);
      const warnings: string[] = [];
      const actual = parseGuitarProBinary(modified, { onWarning: message => warnings.push(message) });
      // These fields affect navigation, not our retained written notes.
      expect(actual).toEqual(baseline);
      const loss = warnings.filter(message => /navigation direction/.test(message));
      expect(loss).toHaveLength(1);
      expect(loss[0]).toContain(label.slice('direction '.length));
      expect(loss[0]).toContain('not represented');
    }
  });
});
