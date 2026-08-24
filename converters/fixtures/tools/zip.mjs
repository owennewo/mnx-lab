import { crc32 } from 'node:zlib';

/**
 * The smallest zip writer that produces a file Guitar Pro and alphaTab both
 * accept: STORED entries only (method 0), no compression, no zip64.
 *
 * A `.gp` is a zip; every other fixture in this directory arrived as one from
 * the app, so nothing here ever needed to write one. `Triplets-and-graces` is
 * hand-authored (see make-triplets-and-graces.mjs for why), and hand-authoring
 * a `.gp` means writing its container. Stored entries keep the committed
 * fixture's bytes a pure function of its GPIF text — a compressor's level or
 * version could otherwise move them without the music changing.
 */
export function storedZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf-8');
    const body = Buffer.from(data);
    const sum = crc32(body);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4);        // version needed
    local.writeUInt16LE(0, 6);         // flags
    local.writeUInt16LE(0, 8);         // method: stored
    local.writeUInt16LE(0, 10);        // mod time  — fixed, so bytes are stable
    local.writeUInt16LE(33, 12);       // mod date  — 1980-01-01
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);        // extra length

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);       // version made by
    header.writeUInt16LE(10, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(33, 14);
    header.writeUInt32LE(sum, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(body.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt32LE(offset, 42);

    chunks.push(local, nameBytes, body);
    central.push(Buffer.concat([header, nameBytes]));
    offset += local.length + nameBytes.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, directory, end]);
}
