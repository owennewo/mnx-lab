import { inflateRawSync, crc32 } from 'node:zlib';

/**
 * Guitar Pro GPIF containers, clean-room.
 *
 * A GPIF score travels in one of two containers, told apart by magic bytes:
 *
 *   `PK\x03\x04` — GP7/8 `.gp`: a plain zip holding `Content/score.gpif`.
 *   `BCFS` / `BCFZ` — GP6 `.gpx`: a proprietary sector filesystem holding
 *   `score.gpif` at its root; BCFZ is the same filesystem behind a bit-level
 *   LZ compressor.
 *
 * Everything here is implemented from the format behavior documented in
 * research/gpif-field-notes.md (fixture arithmetic + the two permissively
 * licensed readers observed as behavioral references) — no alphaTab and no
 * copyleft source was read for it.
 */

/** What the magic bytes say a Guitar Pro file is. */
export type GpContainerKind = 'gp-zip' | 'gpx-bcfs' | 'gpx-bcfz' | 'gp345-binary';

export function sniffContainer(data: Uint8Array): GpContainerKind {
  if (data.length >= 4) {
    if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
      return 'gp-zip';
    }
    const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
    if (magic === 'BCFS') return 'gpx-bcfs';
    if (magic === 'BCFZ') return 'gpx-bcfz';
  }
  // The gp3/gp4/gp5 family opens with a length-prefixed version string; it is
  // not a GPIF container at all.
  return 'gp345-binary';
}

/**
 * Extracts the GPIF XML from a `.gp` or `.gpx`. Throws with a precise reason
 * for the gp3–5 binary family — that lineage needs a different reader, and a
 * silent wrong parse would be worse than a refusal.
 */
export function extractScoreGpif(data: Uint8Array): string {
  switch (sniffContainer(data)) {
    case 'gp-zip': {
      const entry = readZipEntry(data, 'Content/score.gpif');
      if (!entry) throw new Error('zip container has no Content/score.gpif');
      return decodeXml(entry);
    }
    case 'gpx-bcfs': {
      const entry = readBcfs(data.subarray(4)).get('score.gpif');
      if (!entry) throw new Error('BCFS container has no score.gpif');
      return decodeXml(entry);
    }
    case 'gpx-bcfz': {
      const image = decompressBcfz(data.subarray(4));
      // The decompressed image is itself a BCFS container, magic included.
      const entry = readBcfs(image.subarray(4)).get('score.gpif');
      if (!entry) throw new Error('BCFZ container has no score.gpif');
      return decodeXml(entry);
    }
    case 'gp345-binary':
      throw new Error(
        'not a GPIF container (gp3/gp4/gp5 binary?) — this reader covers .gp and .gpx only'
      );
  }
}

function decodeXml(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Wraps GPIF XML as a `.gp`: a stored-only zip of `VERSION` + `Content/score.gpif`
 * — the minimal container Guitar Pro and alphaTab both accept (the
 * `Triplets-and-graces` fixture is the proof). Stored entries with fixed
 * timestamps keep the bytes a pure function of the score.
 */
export function writeGpContainer(gpifXml: string): Uint8Array {
  return writeStoredZip([
    { name: 'VERSION', data: new TextEncoder().encode('7.0') },
    { name: 'Content/score.gpif', data: new TextEncoder().encode(gpifXml) }
  ]);
}

function writeStoredZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = new TextEncoder().encode(name);
    const sum = crc32(data);

    const local = new Uint8Array(30);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, ZIP_LOCAL, true);
    localView.setUint16(4, 10, true); // version needed
    localView.setUint16(10, 0, true); // mod time — fixed, so bytes are stable
    localView.setUint16(12, 33, true); // mod date — 1980-01-01
    localView.setUint32(14, sum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);

    const header = new Uint8Array(46);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, ZIP_CENTRAL, true);
    headerView.setUint16(4, 20, true); // version made by
    headerView.setUint16(6, 10, true);
    headerView.setUint16(14, 33, true);
    headerView.setUint32(16, sum, true);
    headerView.setUint32(20, data.length, true);
    headerView.setUint32(24, data.length, true);
    headerView.setUint16(28, nameBytes.length, true);
    headerView.setUint32(42, offset, true);

    chunks.push(local, nameBytes, data);
    central.push(header, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, ZIP_EOCD, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);

  const parts = [...chunks, ...central, end];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zip (.gp)
// ---------------------------------------------------------------------------

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

/**
 * Minimal central-directory zip reader: stored (0) and deflate (8) entries,
 * no zip64. Guitar Pro's own zips are small and unexotic; our fixture writer
 * (`converters/fixtures/tools/zip.mjs`) is stored-only.
 */
function readZipEntry(data: Uint8Array, wanted: string): Uint8Array | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // The end-of-central-directory record is within the last 64KB + 22 bytes.
  let eocd = -1;
  const stop = Math.max(0, data.length - 0x10000 - 22);
  for (let offset = data.length - 22; offset >= stop; offset--) {
    if (view.getUint32(offset, true) === ZIP_EOCD) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip container has no end-of-central-directory record');

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  for (let index = 0; index < count; index++) {
    if (view.getUint32(offset, true) !== ZIP_CENTRAL) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decodeXml(data.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    if (name !== wanted) continue;

    // The local header's own name/extra lengths govern where the data starts.
    if (view.getUint32(localOffset, true) !== ZIP_LOCAL) {
      throw new Error(`zip entry ${wanted}: bad local header`);
    }
    const localName = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localName + localExtra;
    const raw = data.subarray(start, start + compressedSize);

    if (method === 0) return raw;
    if (method === 8) return new Uint8Array(inflateRawSync(raw));
    throw new Error(`zip entry ${wanted}: unsupported compression method ${method}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// BCFS (.gpx, uncompressed)
// ---------------------------------------------------------------------------

const SECTOR_SIZE = 0x1000;
/** A sector whose first u32 is 2 is a file entry. */
const FILE_ENTRY_MARKER = 2;
const FILE_NAME_OFFSET = 4;
const FILE_NAME_MAX = 127;
const FILE_SIZE_OFFSET = 0x8c;
const BLOCK_TABLE_OFFSET = 0x94;

/**
 * Walks a BCFS image (magic already stripped): sectors of 0x1000 bytes; a file
 * entry sector carries a NUL-terminated name, a byte size, and a table of
 * sector indices (0-terminated) holding the contents.
 */
function readBcfs(image: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const u32 = (at: number): number =>
    at + 4 <= image.length
      ? (image[at] | (image[at + 1] << 8) | (image[at + 2] << 16) | (image[at + 3] << 24)) >>> 0
      : 0;

  for (let offset = SECTOR_SIZE; offset + 4 <= image.length; offset += SECTOR_SIZE) {
    if (u32(offset) !== FILE_ENTRY_MARKER) continue;

    let name = '';
    for (let index = 0; index < FILE_NAME_MAX; index++) {
      const byte = image[offset + FILE_NAME_OFFSET + index];
      if (!byte) break;
      name += String.fromCharCode(byte);
    }

    const size = u32(offset + FILE_SIZE_OFFSET);
    const chunks: Uint8Array[] = [];
    let lastBlockOffset = offset;
    for (let index = 0; ; index++) {
      const block = u32(offset + BLOCK_TABLE_OFFSET + 4 * index);
      if (block === 0) break;
      const at = block * SECTOR_SIZE;
      if (at >= image.length) break; // a valid entry never points outside the image
      lastBlockOffset = Math.max(lastBlockOffset, at);
      const sector = new Uint8Array(SECTOR_SIZE);
      sector.set(image.subarray(at, Math.min(at + SECTOR_SIZE, image.length)));
      chunks.push(sector);
    }

    const contents = new Uint8Array(chunks.length * SECTOR_SIZE);
    chunks.forEach((chunk, index) => contents.set(chunk, index * SECTOR_SIZE));
    if (contents.length >= size) files.set(name, contents.subarray(0, size));

    // Data sectors follow their entry; skip past them so a data sector whose
    // first bytes happen to equal the marker is never misread as an entry.
    offset = Math.max(offset, lastBlockOffset);
  }
  return files;
}

// ---------------------------------------------------------------------------
// BCFZ (.gpx, compressed)
// ---------------------------------------------------------------------------

/** Decompressed images are a few MB in practice; the declared length is
 *  attacker-controlled, so refuse absurd values before allocating. */
const MAX_DECOMPRESSED = 64 * 1024 * 1024;

/**
 * The BCFZ stream (magic already stripped): a u32-LE decompressed length, then
 * a bit stream of chunks. Flag bit 1 = back-reference (4 bits of field width,
 * then offset and size in that many LSB-first bits, copying from the output
 * already written); flag bit 0 = literal run (2 LSB-first bits of count, then
 * that many MSB-first bytes).
 */
export function decompressBcfz(data: Uint8Array): Uint8Array {
  const reader = new BitReader(data);
  const b0 = reader.readBits(8), b1 = reader.readBits(8), b2 = reader.readBits(8), b3 = reader.readBits(8);
  const expected = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
  if (expected > MAX_DECOMPRESSED) {
    throw new Error(`BCFZ declares implausible decompressed size: ${expected} bytes`);
  }

  const out = new Uint8Array(expected);
  let length = 0;
  while (!reader.atEnd() && length < expected) {
    if (reader.readBits(1) === 1) {
      const width = reader.readBits(4);
      const offset = reader.readBitsReversed(width);
      const size = reader.readBitsReversed(width);
      if (offset === 0 || offset > length) break;
      // A back-reference never copies more than it reaches back — the source
      // window is what has been written, not a repeating fill.
      const copy = Math.min(size, offset, expected - length);
      const from = length - offset;
      for (let index = 0; index < copy; index++) out[length++] = out[from + index];
    } else {
      const count = reader.readBitsReversed(2);
      for (let index = 0; index < count && length < expected; index++) {
        out[length++] = reader.readBits(8);
      }
    }
  }
  return out.subarray(0, length);
}

/** MSB-first bit reader over a byte stream. */
class BitReader {
  private bit = 0;

  constructor(private readonly data: Uint8Array) {}

  atEnd(): boolean {
    return this.bit >= this.data.length * 8;
  }

  private readBit(): number {
    const byte = this.data[this.bit >> 3] ?? 0;
    const value = (byte >> (7 - (this.bit & 7))) & 1;
    this.bit++;
    return value;
  }

  /** `count` bits, most significant first. */
  readBits(count: number): number {
    let value = 0;
    for (let index = 0; index < count; index++) value = (value << 1) | this.readBit();
    return value;
  }

  /** `count` bits, least significant first. */
  readBitsReversed(count: number): number {
    let value = 0;
    for (let index = 0; index < count; index++) value |= this.readBit() << index;
    return value;
  }
}
