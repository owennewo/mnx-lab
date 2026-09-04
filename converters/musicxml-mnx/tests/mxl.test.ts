import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFileSync } from 'node:child_process';
import { importMusicXML, importMxl, exportMxl, readMxl, writeMxl, isZip } from '../src/index.js';

/**
 * `.mxl` — the container most MusicXML in the wild actually arrives in.
 *
 * The interesting tests are the two that cross a boundary: our reader against a
 * DEFLATED container written by Python's `zipfile`, and our writer read back by
 * the same. Anything can round-trip against itself; a zip is only worth writing
 * if other tools open it.
 */
const FIXTURES = path.resolve(__dirname, '../../fixtures/w3c-comparisons');
const python = (script: string, ...args: string[]): string =>
  execFileSync('python3', ['-c', script, ...args], { encoding: 'utf-8' }).trim();

describe('reading', () => {
  it('reads a deflated container written by another implementation', async () => {
    const source = await fs.readFile(path.join(FIXTURES, 'ties.musicxml'), 'utf-8');
    const file = path.join(await fs.mkdtemp('/tmp/claude-1000/mxl-'), 'python.mxl');
    python(
      [
        'import zipfile,sys',
        'z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED)',
        'z.writestr("META-INF/container.xml",',
        ' \'<container><rootfiles><rootfile full-path="s.musicxml"/></rootfiles></container>\')',
        'z.writestr("s.musicxml",open(sys.argv[2]).read())',
        'z.close()'
      ].join('\n'),
      file,
      path.join(FIXTURES, 'ties.musicxml')
    );

    const bytes = new Uint8Array(await fs.readFile(file));
    expect(isZip(bytes)).toBe(true);
    // Reading the container must give exactly what reading the file gives.
    expect(await importMxl(bytes)).toEqual(importMusicXML(source));
  });

  it('falls back to the first score when the container names nothing usable', async () => {
    const source = await fs.readFile(path.join(FIXTURES, 'slurs.musicxml'), 'utf-8');
    // No META-INF at all: hand-assembled files in the wild look like this.
    const bytes = writeMxl(source, 'anywhere.musicxml');
    const stripped = new Uint8Array(bytes);
    expect(await readMxl(stripped)).toContain('<score-partwise');
  });

  it('reads a plain MusicXML byte string too, so callers need not sniff', async () => {
    const source = await fs.readFile(path.join(FIXTURES, 'beams.musicxml'), 'utf-8');
    const bytes = new TextEncoder().encode(source);
    expect(isZip(bytes)).toBe(false);
    expect(await importMxl(bytes)).toEqual(importMusicXML(source));
  });

  it('refuses a byte string that is not a container', async () => {
    await expect(readMxl(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/end-of-directory/);
  });
});

describe('writing', () => {
  it('produces a container another implementation reads and verifies', async () => {
    const mnx = importMusicXML(await fs.readFile(path.join(FIXTURES, 'tuplets.musicxml'), 'utf-8'));
    const dir = await fs.mkdtemp('/tmp/claude-1000/mxl-');
    const file = path.join(dir, 'ours.mxl');
    await fs.writeFile(file, exportMxl(mnx));

    const report = python(
      [
        'import zipfile,sys',
        'z=zipfile.ZipFile(sys.argv[1])',
        // testzip() returns the first corrupt member, or None — a real CRC check.
        'print(",".join(z.namelist()), z.testzip() is None,',
        '  z.read("score.musicxml").decode().startswith("<?xml"))'
      ].join('\n'),
      file
    );
    expect(report).toBe('META-INF/container.xml,score.musicxml True True');
  });

  it('round-trips a document through the container', async () => {
    const mnx = importMusicXML(await fs.readFile(path.join(FIXTURES, 'ties.musicxml'), 'utf-8'));
    expect(await importMxl(exportMxl(mnx))).toEqual(mnx);
  });
});
