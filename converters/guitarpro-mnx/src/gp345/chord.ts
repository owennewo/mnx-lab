import { GpBinaryReader } from './binary.js';

/** Read the diagram record while retaining its harmonic name. */
export function readBinaryChord(reader: GpBinaryReader, major: number, label: string): string {
  const modern = reader.readBool(`${label} chord format`);
  if (!modern) {
    const name = reader.readIntByteSizeString(`${label} chord name`);
    const firstFret = reader.readInt32(`${label} chord first fret`);
    if (firstFret !== 0) reader.skip(6 * 4, `${label} chord frets`);
    return name;
  }
  reader.skip(4, `${label} chord accidental and reserved bytes`);
  reader.skip(major === 3 ? 12 : 3, `${label} chord root, type, extension`);
  reader.skip(9, `${label} chord bass, tonality, add`);
  const name = reader.readByteSizeString(`${label} chord name`, 22);
  reader.skip(major === 3 ? 12 : 3, `${label} chord alterations`);
  reader.readInt32(`${label} chord first fret`);
  reader.skip((major === 3 ? 6 : 7) * 4, `${label} chord frets`);
  if (major === 3) {
    reader.skip(4 + 6 * 4, `${label} chord barres`);
    reader.skip(8, `${label} chord omissions and padding`);
  } else {
    reader.skip(16, `${label} chord barres`);
    reader.skip(8, `${label} chord omissions and padding`);
    reader.skip(8, `${label} chord fingerings and display`);
  }
  return name;
}
