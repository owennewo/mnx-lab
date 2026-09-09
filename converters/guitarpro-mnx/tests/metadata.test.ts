import { expect, it, describe } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { importGuitarProCleanRoom } from '../src/cleanRoom.js';
import { importGuitarPro as importOracle } from '../src/import/gp.js';
import { writeGpContainer } from '../src/gpif/container.js';
import { mnxToGpifXml } from '../src/gpif/fromMnx.js';
import {
  CONVERTER_NAME,
  CONVERTER_VERSION,
  EMPTY_SCORE_INFO,
  gpScoreInfoToWork,
  workToGpScoreInfo
} from '../src/common/scoreMetadata.js';
import { MnxLabWork, MnxStructure } from '../src/common/types.js';

/**
 * Score metadata: `_x.mnxLab.work` (what the piece is) and `_x.mnxLab.encoding`
 * (what wrote the file), both at the document root. An earlier shape handed
 * title and artist to the host beside the document, where every save dropped
 * them — so the assertions here are all about the DOCUMENT carrying it.
 */

const gpif = (score: string): Uint8Array =>
  writeGpContainer(`<GPIF><Score>${score}</Score></GPIF>`);

/** A document with just enough structure to export. */
function documentWithWork(work: MnxLabWork): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{ id: 'P1', measures: [{}] }],
    _x: { mnxLab: { work } }
  };
}

describe('reading the Guitar Pro header', () => {
  it('reads the whole binary preamble into work, not a side channel', () => {
    // Eleven header fields, decoded from Windows-1252 — this fixture exists to
    // exercise that charset, and the accented title is the assertion that bites.
    const bytes = readFileSync(resolve(__dirname, 'fixtures/gp5/basic-5.10.gp5'));
    expect(importGuitarProCleanRoom(bytes)._x?.mnxLab?.work).toEqual({
      title: 'Legacy café',
      subtitle: 'GP5 binary baseline',
      artist: 'MNX Lab',
      album: 'Clean-room fixtures',
      creators: [
        { role: 'composer', name: 'MNX Lab' },
        { role: 'lyricist', name: 'Public-domain test text' },
        { role: 'transcriber', name: 'Generated fixture' }
      ],
      copyright: 'CC0',
      notes:
        'Structural baseline; metadata intentionally exercises Windows-1252.\n\n' +
        "Generated with PyGuitarPro's public API."
    });
  });

  it('decodes and trims GPIF text, CDATA included', () => {
    const bytes = gpif('<Title> Café &amp; song </Title><Artist><![CDATA[ Artist ]]></Artist>');
    expect(importGuitarProCleanRoom(bytes)._x?.mnxLab?.work).toEqual({
      title: 'Café & song',
      artist: 'Artist'
    });
  });

  it('stamps what wrote the file, and no date unless asked', () => {
    const bytes = gpif('<Title>T</Title>');
    expect(importGuitarProCleanRoom(bytes)._x?.mnxLab?.encoding).toEqual({
      software: CONVERTER_NAME,
      version: CONVERTER_VERSION
    });
    expect(
      importGuitarProCleanRoom(bytes, { encodingDate: '2026-09-09' })._x?.mnxLab?.encoding?.date
    ).toBe('2026-09-09');
  });

  it('states no work at all for a file whose header is empty', () => {
    const document = importGuitarProCleanRoom(gpif('<Title/><Artist/>'));
    expect(document._x?.mnxLab?.work).toBeUndefined();
    expect(document._x?.mnxLab?.encoding).toBeDefined();
  });

  it('maps the three authorship fields onto typed creators', () => {
    const work = importGuitarProCleanRoom(
      gpif('<Music>Bach</Music><Words>Anon</Words><Tabber>Me</Tabber>')
    )._x?.mnxLab?.work;
    expect(work?.creators).toEqual([
      { role: 'composer', name: 'Bach' },
      { role: 'lyricist', name: 'Anon' },
      { role: 'transcriber', name: 'Me' }
    ]);
  });

  it('expands WordsAndMusic into both credits, as alphaTab does', () => {
    expect(
      importGuitarProCleanRoom(gpif('<WordsAndMusic>Dylan</WordsAndMusic>'))._x?.mnxLab?.work
        ?.creators
    ).toEqual([
      { role: 'composer', name: 'Dylan' },
      { role: 'lyricist', name: 'Dylan' }
    ]);
  });

  it('agrees with the oracle importer on a name credited with both', () => {
    // alphaTab's GPIF reader copies `WordsAndMusic` into its `words` AND
    // `music` fields, which lands on the same pair of creators. If it did not,
    // every differential test comparing the two readers would fail on the
    // header rather than on the music. Exported through our own writer because
    // alphaTab cannot parse a GPIF with no tracks in it.
    const bytes = writeGpContainer(
      mnxToGpifXml(
        documentWithWork({
          creators: [
            { role: 'composer', name: 'Dylan' },
            { role: 'lyricist', name: 'Dylan' }
          ]
        })
      )
    );
    expect(importOracle(bytes)._x?.mnxLab?.work?.creators).toEqual(
      importGuitarProCleanRoom(bytes)._x?.mnxLab?.work?.creators
    );
  });

  it('joins Notices onto Instructions, the only free-text field work has', () => {
    const work = importGuitarProCleanRoom(
      gpif('<Instructions>Capo 2</Instructions><Notices>Line one\nLine two</Notices>')
    )._x?.mnxLab?.work;
    expect(work?.notes).toBe('Capo 2\n\nLine one\nLine two');
  });
});

describe('writing the Guitar Pro header', () => {
  it('writes every work field into <Score>', () => {
    const xml = mnxToGpifXml(
      documentWithWork({
        title: 'T',
        subtitle: 'S',
        artist: 'A',
        album: 'Al',
        creators: [
          { role: 'composer', name: 'C' },
          { role: 'lyricist', name: 'L' },
          { role: 'transcriber', name: 'Tab' }
        ],
        copyright: '© 2026',
        notes: 'N'
      })
    );
    const written: [string, string][] = [
      ['Title', 'T'],
      ['SubTitle', 'S'],
      ['Artist', 'A'],
      ['Album', 'Al'],
      ['Music', 'C'],
      ['Words', 'L'],
      ['Tabber', 'Tab'],
      ['Copyright', '© 2026'],
      ['Instructions', 'N']
    ];
    for (const [element, value] of written) {
      expect(xml).toContain(`<${element}><![CDATA[${value}]]></${element}>`);
    }
  });

  it('collapses one person credited with both into WordsAndMusic', () => {
    const info = workToGpScoreInfo({
      creators: [
        { role: 'composer', name: 'Dylan' },
        { role: 'lyricist', name: 'Dylan' }
      ]
    });
    expect(info).toMatchObject({ wordsAndMusic: 'Dylan', words: '', music: '' });
  });

  it('warns rather than silently dropping a credit Guitar Pro cannot hold', () => {
    const warnings: string[] = [];
    workToGpScoreInfo(
      { creators: [{ role: 'arranger', name: 'Segovia' }], source: 'urn:x' },
      message => warnings.push(message)
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('arranger');
    expect(warnings[1]).toContain('source');
  });

  it('round-trips a full header through the clean-room writer and reader', () => {
    const work: MnxLabWork = {
      title: 'T',
      subtitle: 'S',
      artist: 'A',
      album: 'Al',
      creators: [
        { role: 'composer', name: 'C' },
        { role: 'lyricist', name: 'L' },
        { role: 'transcriber', name: 'Tab' }
      ],
      copyright: '© 2026',
      notes: 'N'
    };
    const bytes = writeGpContainer(mnxToGpifXml(documentWithWork(work)));
    expect(importGuitarProCleanRoom(bytes)._x?.mnxLab?.work).toEqual(work);
  });

  it('is a no-op for a document that states no work', () => {
    expect(workToGpScoreInfo(undefined)).toEqual(EMPTY_SCORE_INFO);
    expect(gpScoreInfoToWork(EMPTY_SCORE_INFO)).toBeUndefined();
  });
});

it('stamps the version the package actually declares', () => {
  // The browser build cannot read package.json, so the version is a constant.
  // This is what keeps it from drifting.
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
  expect(CONVERTER_VERSION).toBe(pkg.version);
});

it('stamps the encoding through the CLI, with a date only when asked', () => {
  // Nothing else in this package runs `cli.ts`. The sibling converter shipped a
  // `--encoding-date` helper that was never defined, with every unit test
  // green, so one end-to-end run guards both CLIs against that class of bug.
  const dir = mkdtempSync(join(tmpdir(), 'mnx-gp-cli-'));
  const source = resolve(__dirname, '../../fixtures/Triplets-and-graces.gp');
  const run = (args: string[]): void => {
    const result = spawnSync('npx', ['tsx', resolve(__dirname, '../src/cli.ts'), ...args], {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf-8'
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  };

  const plain = join(dir, 'plain.mnx.json');
  run(['--import', source, '--output', plain]);
  expect(JSON.parse(readFileSync(plain, 'utf-8'))._x.mnxLab).toEqual({
    work: { title: 'Triplets and graces' },
    encoding: { software: CONVERTER_NAME, version: CONVERTER_VERSION }
  });

  const dated = join(dir, 'dated.mnx.json');
  run(['--import', source, '--output', dated, '--encoding-date']);
  expect(JSON.parse(readFileSync(dated, 'utf-8'))._x.mnxLab.encoding.date).toMatch(
    /^\d{4}-\d{2}-\d{2}$/
  );

  rmSync(dir, { recursive: true, force: true });
}, 60000);
