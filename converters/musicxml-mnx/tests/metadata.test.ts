import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { importMusicXML } from '../src/import/musicxml.js';
import { exportMusicXML } from '../src/export/mnx.js';
import { CONVERTER_NAME, CONVERTER_VERSION } from '../src/common/scoreMetadata.js';
import { MnxLabWork, MnxStructure } from '../src/common/types.js';

/**
 * Score metadata: `_x.mnxLab.work` and `_x.mnxLab.encoding` at the document
 * root. MusicXML states the same facts in three places that do not mean the
 * same thing — `<work>` and `<identification>` are metadata, `<credit>` is
 * printed page text — so the read order and what each one is trusted for are
 * the substance of these tests.
 */

const score = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">${body}` +
  '<part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>' +
  '<part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>' +
  '</measure></part></score-partwise>';

const workOf = (xml: string): MnxLabWork | undefined =>
  importMusicXML(xml)._x?.mnxLab?.work;

function documentWithWork(work: MnxLabWork): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        id: 'P1',
        name: 'G',
        measures: [
          { sequences: [{ content: [{ type: 'event', duration: { base: 'whole' }, rest: {} }] }] }
        ]
      }
    ],
    _x: { mnxLab: { work } }
  };
}

describe('reading MusicXML metadata', () => {
  it('reads work, identification and rights', () => {
    expect(
      workOf(
        score(
          '<work><work-title>The Title</work-title></work>' +
            '<identification>' +
            '<creator type="composer">Bach</creator>' +
            '<creator type="lyricist">Anon</creator>' +
            '<rights>CC0</rights>' +
            '<source>urn:example</source>' +
            '</identification>'
        )
      )
    ).toEqual({
      title: 'The Title',
      creators: [
        { role: 'composer', name: 'Bach' },
        { role: 'lyricist', name: 'Anon' }
      ],
      copyright: 'CC0',
      source: 'urn:example'
    });
  });

  it('falls back to a printed credit when the document declares no work', () => {
    // Finale and MuseScore both emit files that print a title without ever
    // declaring one; reading only <work> would lose it.
    expect(
      workOf(
        score(
          '<credit><credit-type>title</credit-type><credit-words>Printed</credit-words></credit>'
        )
      )
    ).toEqual({ title: 'Printed' });
  });

  it('takes an untyped credit only as a last resort', () => {
    expect(workOf(score('<credit><credit-words>Just words</credit-words></credit>'))).toEqual({
      title: 'Just words'
    });
    // A declared work always wins over anything printed.
    expect(
      workOf(
        score(
          '<work><work-title>Declared</work-title></work>' +
            '<credit><credit-words>Printed</credit-words></credit>'
        )
      )
    ).toMatchObject({ title: 'Declared' });
  });

  it('promotes movement-title to the title, or keeps it as the subtitle', () => {
    expect(workOf(score('<movement-title>Allegro</movement-title>'))).toEqual({
      title: 'Allegro'
    });
    expect(
      workOf(
        score('<work><work-title>Sonata</work-title></work><movement-title>Allegro</movement-title>')
      )
    ).toEqual({ title: 'Sonata', subtitle: 'Allegro' });
  });

  it('lifts the performer back out of the creator MusicXML parks it in', () => {
    const work = workOf(
      score('<identification><creator type="artist">The Animals</creator></identification>')
    );
    expect(work).toEqual({ artist: 'The Animals' });
  });

  it('reads album and notes from miscellaneous fields', () => {
    expect(
      workOf(
        score(
          '<identification><miscellaneous>' +
            '<miscellaneous-field name="album">Live</miscellaneous-field>' +
            '<miscellaneous-field name="notes">Capo 2</miscellaneous-field>' +
            '</miscellaneous></identification>'
        )
      )
    ).toEqual({ album: 'Live', notes: 'Capo 2' });
  });

  it('states no work at all for a document that carries none', () => {
    const document = importMusicXML(score(''));
    expect(document._x?.mnxLab?.work).toBeUndefined();
    expect(document._x?.mnxLab?.encoding).toEqual({
      software: CONVERTER_NAME,
      version: CONVERTER_VERSION
    });
  });

  it('never forwards the source file’s own encoding', () => {
    // <encoding> describes the MusicXML, not the MNX derived from it.
    const document = importMusicXML(
      score(
        '<identification><encoding><software>Finale v27</software>' +
          '<encoding-date>2020-01-01</encoding-date></encoding></identification>'
      )
    );
    expect(document._x?.mnxLab?.encoding).toEqual({
      software: CONVERTER_NAME,
      version: CONVERTER_VERSION
    });
  });

  it('stamps a date only when asked', () => {
    expect(
      importMusicXML(score(''), { encodingDate: '2026-09-09' })._x?.mnxLab?.encoding?.date
    ).toBe('2026-09-09');
  });
});

describe('writing MusicXML metadata', () => {
  const full: MnxLabWork = {
    title: 'The Title',
    subtitle: 'A Subtitle',
    artist: 'The Animals',
    album: 'Live',
    creators: [
      { role: 'composer', name: 'Bach' },
      { role: 'lyricist', name: 'Anon' },
      { role: 'arranger', name: 'Segovia' },
      { role: 'transcriber', name: 'Me' }
    ],
    copyright: 'CC0',
    source: 'urn:example',
    notes: 'Capo 2'
  };

  it('writes the metadata elements before part-list, as the XSD requires', () => {
    const xml = exportMusicXML(documentWithWork(full));
    const order = ['<work>', '<identification>', '<credit>', '<part-list>'].map(tag =>
      xml.indexOf(tag)
    );
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('writes a role MusicXML does not suggest, because its type is open', () => {
    const xml = exportMusicXML(documentWithWork(full));
    expect(xml).toContain('<creator type="transcriber">Me</creator>');
    expect(xml).toContain('<creator type="artist">The Animals</creator>');
  });

  it('prints credits without a position, so a consumer lays them out', () => {
    const xml = exportMusicXML(documentWithWork(full));
    expect(xml).toContain(
      '<credit><credit-type>title</credit-type><credit-words>The Title</credit-words></credit>'
    );
    expect(xml).not.toMatch(/<credit[^>]*default-x/);
  });

  it('round-trips every field of work', () => {
    const back = importMusicXML(exportMusicXML(documentWithWork(full)));
    expect(back._x?.mnxLab?.work).toEqual(full);
  });

  it('writes what wrote the file, and a date only when asked', () => {
    expect(exportMusicXML(documentWithWork(full))).toContain(
      `<software>${CONVERTER_NAME} ${CONVERTER_VERSION}</software>`
    );
    expect(exportMusicXML(documentWithWork(full))).not.toContain('<encoding-date>');
    expect(
      exportMusicXML(documentWithWork(full), { encodingDate: '2026-09-09' })
    ).toContain('<encoding-date>2026-09-09</encoding-date>');
  });

  it('emits no work elements for a document that states none', () => {
    const xml = exportMusicXML({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [
        {
          id: 'P1',
          name: 'G',
          measures: [
            { sequences: [{ content: [{ type: 'event', duration: { base: 'whole' }, rest: {} }] }] }
          ]
        }
      ]
    });
    expect(xml).not.toContain('<work>');
    expect(xml).not.toContain('<credit>');
    // <identification> stays: it is where the encoding stamp lives.
    expect(xml).toContain('<identification><encoding>');
  });
});

it('stamps the version the package actually declares', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
  expect(CONVERTER_VERSION).toBe(pkg.version);
});

describe('the CLI', () => {
  // Nothing else in this package runs `cli.ts`, and the gap let a
  // `--encoding-date` helper ship undefined: every test passed and the command
  // threw `ReferenceError` on the first real export. One end-to-end run is
  // cheap insurance against that whole class of bug.
  const cli = resolve(__dirname, '../src/cli.ts');
  const run = (args: string[]): string => {
    const result = spawnSync('npx', ['tsx', cli, ...args], {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf-8'
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    return result.stdout;
  };

  it('exports and re-imports metadata, stamping a date only when asked', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnx-cli-'));
    const source = join(dir, 'in.mnx.json');
    writeFileSync(
      source,
      JSON.stringify(documentWithWork({ title: 'T', creators: [{ role: 'composer', name: 'C' }] }))
    );

    const undated = join(dir, 'undated.xml');
    run(['--export', source, '--output', undated]);
    expect(readFileSync(undated, 'utf-8')).not.toContain('<encoding-date>');

    const dated = join(dir, 'dated.xml');
    run(['--export', source, '--output', dated, '--encoding-date']);
    expect(readFileSync(dated, 'utf-8')).toMatch(/<encoding-date>\d{4}-\d{2}-\d{2}<\/encoding-date>/);

    const back = join(dir, 'back.mnx.json');
    run(['--import', dated, '--output', back]);
    expect(JSON.parse(readFileSync(back, 'utf-8'))._x.mnxLab.work).toEqual({
      title: 'T',
      creators: [{ role: 'composer', name: 'C' }]
    });

    rmSync(dir, { recursive: true, force: true });
  }, 60000);
});
