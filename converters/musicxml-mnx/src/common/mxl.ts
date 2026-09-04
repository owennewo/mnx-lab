// `.mxl` — compressed MusicXML, read and written with no dependencies.
//
// `.mxl` is what MuseScore, Sibelius, Dorico and Finale hand you by default, so
// a converter that only reads `.musicxml` cannot open most of the files that
// actually exist. It is a zip whose `META-INF/container.xml` names the root
// score:
//
//   META-INF/container.xml   <container><rootfiles><rootfile full-path="…"/>
//   <name>.musicxml          the score
//   (anything else)          images, linked parts — ignored here
//
// ZERO DEPENDENCIES, in Node and in the browser. Reading uses
// `DecompressionStream('deflate-raw')`, which both platforms have; `node:zlib`
// would have been simpler and Node-only, which is the trap
// `converters/guitarpro-mnx/src/gpif/container.ts` fell into and the reason
// that reader could not simply be reused (roadmap/inprogress/core-musicxml-mxl.md).
//
// DecompressionStream is async, and that is the whole reason `readMxl` returns
// a promise while `importMusicXML` stays synchronous: the asynchrony is
// contained at the container boundary rather than spread through the converter.
//
// Writing uses STORED entries (no compression), which is entirely legal zip and
// needs no compressor at all — only CRC-32, which is fifteen lines. The files
// are larger than a deflating writer's; every reader takes them.

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;

/** CRC-32, the one piece of arithmetic a zip writer cannot avoid. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const view = (data: Uint8Array): DataView =>
  new DataView(data.buffer, data.byteOffset, data.byteLength);

/** Is this byte string a zip container? `.mxl` and `.musicxml` share an extension habit. */
export function isZip(data: Uint8Array): boolean {
  return data.length >= 4 && view(data).getUint32(0, true) === LOCAL_HEADER;
}

interface ZipEntry {
  name: string;
  compression: number;
  offset: number;
  compressedSize: number;
}

/**
 * Reads the central directory rather than scanning local headers.
 *
 * A local header may declare sizes of zero and defer them to a data descriptor
 * after the payload — legal, and common from streaming writers — so its sizes
 * cannot be trusted. The central directory always has the real ones.
 */
function readDirectory(data: Uint8Array): ZipEntry[] {
  const bytes = view(data);
  // The end-of-directory record is last, but a zip comment may follow it, so
  // it has to be found by scanning backwards.
  let end = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (bytes.getUint32(i, true) === END_OF_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error('Not a zip container: no end-of-directory record');

  const count = bytes.getUint16(end + 10, true);
  let cursor = bytes.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (bytes.getUint32(cursor, true) !== CENTRAL_HEADER) break;
    const nameLength = bytes.getUint16(cursor + 28, true);
    const extraLength = bytes.getUint16(cursor + 30, true);
    const commentLength = bytes.getUint16(cursor + 32, true);
    entries.push({
      name: new TextDecoder().decode(data.subarray(cursor + 46, cursor + 46 + nameLength)),
      compression: bytes.getUint16(cursor + 10, true),
      compressedSize: bytes.getUint32(cursor + 20, true),
      offset: bytes.getUint32(cursor + 42, true)
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// Declared rather than pulled in with `lib: ["DOM"]`, which would put the whole
// browser DOM back into a Node package's global scope — the very ambience the
// XML layer was extracted from. These three are what web streams give us, and
// Node has had them since 18.
declare class DecompressionStream {
  constructor(format: 'deflate-raw' | 'deflate' | 'gzip');
  readonly readable: {
    getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> };
  };
  readonly writable: {
    getWriter(): { write(chunk: Uint8Array): Promise<void>; close(): Promise<void> };
  };
}

/** DEFLATE, via the only inflater Node and browsers both have. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  // Deliberately not awaited before reading: a large member can exceed the
  // stream's internal buffer, and awaiting the write first would deadlock
  // against a reader that has not started.
  const written = writer.write(data).then(() => writer.close());

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      size += value.length;
    }
  }
  await written;

  const out = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

async function readEntry(data: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const bytes = view(data);
  if (bytes.getUint32(entry.offset, true) !== LOCAL_HEADER) {
    throw new Error(`Corrupt zip: no local header for ${entry.name}`);
  }
  const nameLength = bytes.getUint16(entry.offset + 26, true);
  const extraLength = bytes.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const payload = data.subarray(start, start + entry.compressedSize);
  if (entry.compression === 0) return payload;
  if (entry.compression === 8) return inflateRaw(payload);
  throw new Error(`Unsupported zip compression method ${entry.compression} for ${entry.name}`);
}

/**
 * The MusicXML text inside a `.mxl`.
 *
 * `META-INF/container.xml` names the root score. When it is missing or
 * unreadable — plenty of files in the wild are assembled by hand — the fallback
 * is the first `.musicxml`/`.xml` entry that is not itself metadata, which is
 * what every reader does and what the container would have said anyway.
 */
export async function readMxl(data: Uint8Array): Promise<string> {
  const entries = readDirectory(data);
  const decoder = new TextDecoder();
  const byName = new Map(entries.map(entry => [entry.name, entry]));

  const container = byName.get('META-INF/container.xml');
  if (container) {
    const xml = decoder.decode(await readEntry(data, container));
    const match = /<rootfile\b[^>]*\bfull-path\s*=\s*"([^"]+)"/.exec(xml);
    const named = match && byName.get(match[1]);
    if (named) return decoder.decode(await readEntry(data, named));
  }

  const fallback = entries.find(
    entry =>
      !entry.name.startsWith('META-INF/') &&
      !entry.name.endsWith('/') &&
      /\.(musicxml|xml)$/i.test(entry.name)
  );
  if (!fallback) throw new Error('No MusicXML found inside the .mxl container');
  return decoder.decode(await readEntry(data, fallback));
}

function localAndCentral(name: string, payload: Uint8Array, offset: number) {
  const nameBytes = new TextEncoder().encode(name);
  const crc = crc32(payload);

  const local = new Uint8Array(30 + nameBytes.length + payload.length);
  const localView = view(local);
  localView.setUint32(0, LOCAL_HEADER, true);
  localView.setUint16(4, 20, true); // version needed
  localView.setUint16(8, 0, true); // stored
  localView.setUint32(14, crc, true);
  localView.setUint32(18, payload.length, true);
  localView.setUint32(22, payload.length, true);
  localView.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(payload, 30 + nameBytes.length);

  const central = new Uint8Array(46 + nameBytes.length);
  const centralView = view(central);
  centralView.setUint32(0, CENTRAL_HEADER, true);
  centralView.setUint16(4, 20, true); // version made by
  centralView.setUint16(6, 20, true); // version needed
  centralView.setUint16(10, 0, true); // stored
  centralView.setUint32(16, crc, true);
  centralView.setUint32(20, payload.length, true);
  centralView.setUint32(24, payload.length, true);
  centralView.setUint16(28, nameBytes.length, true);
  centralView.setUint32(42, offset, true);
  central.set(nameBytes, 46);

  return { local, central };
}

/**
 * Writes a `.mxl`: the container manifest, then the score, stored.
 *
 * The manifest comes first because that is the order every writer uses and some
 * readers assume — the format does not require it, but nothing is gained by
 * being the one file that differs.
 */
export function writeMxl(xml: string, scoreName = 'score.musicxml'): Uint8Array {
  const encoder = new TextEncoder();
  const manifest =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container><rootfiles>' +
    `<rootfile full-path="${scoreName}" media-type="application/vnd.recordare.musicxml+xml"/>` +
    '</rootfiles></container>';

  const files: { name: string; payload: Uint8Array }[] = [
    { name: 'META-INF/container.xml', payload: encoder.encode(manifest) },
    { name: scoreName, payload: encoder.encode(xml) }
  ];

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const { local, central } = localAndCentral(file.name, file.payload, offset);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = view(end);
  endView.setUint32(0, END_OF_DIRECTORY, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
