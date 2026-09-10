import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro, exportGuitarPro } from '../src/index.js';
import { writeGpContainer } from '../src/gpif/container.js';
import { mnxToGpifXml } from '../src/gpif/fromMnx.js';
import type { MnxEvent, MnxStructure } from '../src/common/types.js';
import { normalizeIds } from './helpers/normalize.js';

/**
 * Ties, dynamics, articulations and arpeggios in GPIF, and the tripwire that
 * names whatever else a file carries. Every one of these was once dropped
 * without a word: a Soundslice export of Davy Graham's "Anji" lost 13 ties and
 * 17 staccatos on import and printed no warning at all.
 *
 * Hand-authored GPIF in the shapes Guitar Pro and Soundslice write — not an
 * alphaTab export, which is the oracle elsewhere and would mark its own work.
 */

/** One track in standard tuning, 4/4, one voice; `bars` lists each bar's beats. */
function score(bars: string[][], notes: string, masterBarExtra = ''): Uint8Array {
  let beatId = 0;
  const beats: string[] = [];
  const voices: string[] = [];
  const barXml: string[] = [];
  const masterBars: string[] = [];
  bars.forEach((barBeats, index) => {
    const ids = barBeats.map(xml => {
      beats.push(xml.replace('<Beat>', `<Beat id="${beatId}">`));
      return beatId++;
    });
    voices.push(`<Voice id="${index}"><Beats>${ids.join(' ')}</Beats></Voice>`);
    barXml.push(`<Bar id="${index}"><Clef>G2</Clef><Voices>${index} -1 -1 -1</Voices></Bar>`);
    masterBars.push(
      `<MasterBar><Time>4/4</Time><Bars>${index}</Bars>${index === 0 ? masterBarExtra : ''}</MasterBar>`
    );
  });
  return writeGpContainer(`<GPIF>
    <Tracks><Track id="0"><Name>Guitar</Name><Properties>
      <Property name="Tuning"><Pitches>40 45 50 55 59 64</Pitches></Property>
    </Properties></Track></Tracks>
    <MasterBars>${masterBars.join('')}</MasterBars>
    <Bars>${barXml.join('')}</Bars>
    <Voices>${voices.join('')}</Voices>
    <Beats>${beats.join('')}</Beats>
    <Notes>${notes}</Notes>
    <Rhythms><Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm></Rhythms>
  </GPIF>`);
}

/** A quarter-note beat: note ids (empty = rest), then any extra children. */
const beat = (noteIds: string, extra = '') =>
  `<Beat><Rhythm ref="0"/>${noteIds ? `<Notes>${noteIds}</Notes>` : ''}${extra}</Beat>`;
/** A fretted note; `string` is GPIF's (0 = lowest). */
const note = (id: number, string: number, fret: number, extra = '', properties = '') =>
  `<Note id="${id}"><Properties>` +
  `<Property name="String"><String>${string}</String></Property>` +
  `<Property name="Fret"><Fret>${fret}</Fret></Property>${properties}` +
  `</Properties>${extra}</Note>`;
const tieFrom = '<Tie origin="true" destination="false"/>';
const tieInto = '<Tie origin="false" destination="true"/>';
const dynamic = (value: string) => `<Dynamic>${value}</Dynamic>`;

function load(data: Uint8Array) {
  const warnings: string[] = [];
  const mnx = normalizeIds(importGuitarPro(data, { onWarning: message => warnings.push(message) }));
  const events = (measure: number) =>
    mnx.parts[0].measures[measure].sequences![0].content as MnxEvent[];
  return { mnx, warnings, events };
}

describe('ties', () => {
  it('links each destination to the previous note on its string, across a barline', () => {
    const { events, warnings } = load(score(
      [[beat('0'), beat('1'), beat(''), beat('2')], [beat('3'), beat(''), beat(''), beat('')]],
      note(0, 2, 2, tieFrom) + note(1, 2, 2, tieInto) +
        note(2, 3, 5, tieFrom) + note(3, 3, 5, tieInto)
    ));
    expect(events(0)[0].notes![0].ties).toEqual([{ target: 'n1' }]);
    expect(events(0)[1].notes![0].ties).toBeUndefined();
    expect(events(0)[3].notes![0].ties).toEqual([{ target: 'n3' }]);
    expect(events(1)[0].notes![0].pitch).toEqual(events(0)[3].notes![0].pitch);
    expect(warnings).toEqual([]);
  });

  it('ties from the chord note on the same string, not from its neighbour', () => {
    const { events } = load(score(
      [[beat('0 1'), beat('2'), beat(''), beat('')]],
      note(0, 0, 3) + note(1, 3, 2, tieFrom) + note(2, 3, 2, tieInto)
    ));
    const [low, high] = events(0)[0].notes!;
    expect(low.ties).toBeUndefined();
    expect(high.ties).toEqual([{ target: 'n2' }]);
  });

  it('keeps a destination with no origin as a plain note, and says so', () => {
    const { events, warnings } = load(score(
      [[beat('0'), beat(''), beat(''), beat('')]],
      note(0, 2, 2, tieInto)
    ));
    expect(events(0)[0].notes![0].ties).toBeUndefined();
    expect(warnings).toEqual([expect.stringContaining('tied from nothing')]);
  });
});

describe('dynamics', () => {
  const four = (values: string[], rests: number[] = []) => score(
    [values.map((value, index) => rests.includes(index) ? beat('', dynamic(value)) : beat(`${index}`, dynamic(value)))],
    [0, 1, 2, 3].map(id => note(id, 2, id)).join('')
  );

  it('reads an all-MF file as unmarked — Guitar Pro cannot say otherwise', () => {
    expect(load(four(['MF', 'MF', 'MF', 'MF'])).mnx.parts[0].measures[0].dynamics).toBeUndefined();
  });

  it('states a level once where it starts, not on every beat that repeats it', () => {
    const { mnx } = load(score(
      [[beat('0', dynamic('F')), beat('1', dynamic('F')), beat('', dynamic('F')), beat('2', dynamic('F'))],
        [beat('3', dynamic('F')), beat('', dynamic('F')), beat('', dynamic('F')), beat('', dynamic('F'))]],
      [0, 1, 2, 3].map(id => note(id, 2, id)).join('')
    ));
    expect(mnx.parts[0].measures[0].dynamics).toEqual([
      { position: { fraction: [0, 1] }, type: 'immediate', value: 'f' }
    ]);
    expect(mnx.parts[0].measures[1].dynamics).toBeUndefined();
  });

  it('places a change at its beat', () => {
    expect(load(four(['MF', 'MF', 'P', 'P'])).mnx.parts[0].measures[0].dynamics).toEqual([
      { position: { fraction: [1, 2] }, type: 'immediate', value: 'p' }
    ]);
  });

  it('ignores the level stamped on a rest', () => {
    expect(load(four(['F', 'MF', 'F', 'F'], [1])).mnx.parts[0].measures[0].dynamics).toEqual([
      { position: { fraction: [0, 1] }, type: 'immediate', value: 'f' }
    ]);
  });
});

describe('articulations', () => {
  const marked = (flags: number) => load(score(
    [[beat('0'), beat(''), beat(''), beat('')]],
    note(0, 2, 2, `<Accent>${flags}</Accent>`)
  ));

  it.each([
    [1, { staccato: {} }],
    [4, { strongAccent: {} }],
    [8, { accent: {} }],
    [16, { tenuto: {} }],
    [9, { staccato: {}, accent: {} }]
  ])('reads <Accent>%i as a bitmask', (flags, markings) => {
    const { events, warnings } = marked(flags);
    expect(events(0)[0].markings).toEqual(markings);
    expect(warnings).toEqual([]);
  });

  it('names a bit it does not know', () => {
    const { events, warnings } = marked(2);
    expect(events(0)[0].markings).toBeUndefined();
    expect(warnings).toEqual([expect.stringContaining('note <Accent> bits 0x2')]);
  });
});

describe('arpeggios', () => {
  it('spans the rolled chord bottom to top, in the direction written', () => {
    const { mnx } = load(score(
      [[beat(''), beat('0 1 2', '<Arpeggio>Down</Arpeggio>'), beat(''), beat('')]],
      note(0, 4, 0) + note(1, 0, 3) + note(2, 2, 2)
    ));
    expect(mnx.parts[0].measures[0].arpeggios).toEqual([
      { position: { fraction: [1, 4] }, span: { start: 'n1', end: 'n0' }, direction: 'down' }
    ]);
  });
});

describe('slurs', () => {
  const from = '<Legato origin="true" destination="false"/>';
  const through = '<Legato origin="true" destination="true"/>';
  const into = '<Legato origin="false" destination="true"/>';
  const notes = [0, 1, 2, 3, 4].map(id => note(id, 2, id)).join('');

  it('reads a legato chain as one slur, first beat to last', () => {
    const { events } = load(score([[beat('0', from), beat('1', through), beat('2', into), beat('3')]], notes));
    expect(events(0)[0].slurs).toEqual([{ target: 'e0' }]);
    expect(events(0)[1].slurs).toBeUndefined();
    expect(events(0)[2].id).toBe('e0');
  });

  it('carries a slur across a barline and writes it back as the same chain', () => {
    const first = load(score(
      [[beat('0'), beat('1'), beat('2'), beat('3', from)], [beat('4', into), beat(''), beat(''), beat('')]],
      notes
    ));
    expect(first.events(0)[3].slurs).toEqual([{ target: 'e0' }]);
    expect(first.events(1)[0].id).toBe('e0');
    const second = load(exportGuitarPro(first.mnx));
    expect(second.mnx).toEqual(first.mnx);
    expect(second.warnings).toEqual([]);
  });
});

describe('the tripwire', () => {
  it('names each kind of unread content once, with a count and where it first appears', () => {
    const { warnings } = load(score(
      [[beat('0'), beat('1', '<Properties><Property name="Brush"><Direction>Up</Direction></Property></Properties>'),
        beat('2'), beat('')]],
      note(0, 2, 2, '<LetRing/>') + note(1, 2, 3, '<LetRing/>') +
        note(2, 1, 0, '', '<Property name="Muted"><Enable/></Property>'),
      '<Fermatas><Fermata><Type>Medium</Type></Fermata></Fermatas>'
    ));
    expect(warnings.sort()).toEqual([
      'measure 1: beat Property Brush is not represented (1 in the file).',
      'measure 1: dead-note styling (Property Muted) is not represented (1 in the file).',
      'measure 1: master bar <Fermatas> is not represented (1 in the file).',
      'measure 1: note <LetRing> is not represented (2 in the file).'
    ]);
  });

  it.each(['House-of-the-Rising-Sun', 'Sun-did-glide', 'Triplets-and-graces'])(
    'stays silent on what our own writer produces: %s',
    async name => {
      const original: MnxStructure = JSON.parse(
        await fs.readFile(path.resolve(__dirname, `../../fixtures/${name}.mnx.json`), 'utf-8')
      );
      const warnings: string[] = [];
      importGuitarPro(exportGuitarPro(original), { onWarning: message => warnings.push(message) });
      expect(warnings.filter(message => message.includes('is not represented'))).toEqual([]);
    }
  );
});

describe('writing them back', () => {
  const source = () => score(
    [[beat('0 1', dynamic('F') + '<Arpeggio>Up</Arpeggio>'), beat('2', dynamic('F')),
      beat('3', dynamic('P')), beat('4', dynamic('P'))],
      [beat('5', dynamic('P')), beat('', dynamic('P')), beat('', dynamic('P')), beat('', dynamic('P'))]],
    note(0, 0, 3, '<Accent>8</Accent>') + note(1, 3, 2, `<Accent>8</Accent>${tieFrom}`) +
      note(2, 3, 2, tieInto) + note(3, 2, 2, '<Accent>1</Accent>') +
      note(4, 2, 2, tieFrom) + note(5, 2, 2, tieInto)
  );

  it('round-trips ties, dynamics, articulations and arpeggios through .gp', () => {
    const first = load(source());
    const second = load(exportGuitarPro(first.mnx));
    expect(second.mnx).toEqual(first.mnx);
    expect(first.mnx.parts[0].measures[0].dynamics).toHaveLength(2);
    expect(second.warnings).toEqual([]);
  });

  it('stamps every beat with the level in force, rests included', () => {
    const xml = mnxToGpifXml(load(source()).mnx);
    const levels = [...xml.matchAll(/<Dynamic>(\w+)<\/Dynamic>/g)].map(match => match[1]);
    expect(levels).toEqual(['F', 'F', 'P', 'P', 'P', 'P', 'P', 'P']);
  });

  it('names the dynamics Guitar Pro has no level for', () => {
    const mnx = load(source()).mnx;
    mnx.parts[0].measures[1].dynamics = [
      { position: { fraction: [0, 1] }, type: 'immediate', value: 'pppp' },
      { position: { fraction: [1, 4] }, type: 'gradual', wedgeType: 'increasing' },
      { position: { fraction: [1, 2] }, type: 'immediate', value: 'n' }
    ];
    const warnings: string[] = [];
    const xml = mnxToGpifXml(mnx, { onWarning: message => warnings.push(message) });
    expect(xml).toContain('<Dynamic>PPP</Dynamic>');
    expect(warnings).toEqual([
      expect.stringContaining('"pppp" is beyond Guitar Pro\'s range; written as PPP'),
      expect.stringContaining('type "gradual" has no Guitar Pro equivalent'),
      expect.stringContaining('"n" has no Guitar Pro equivalent')
    ]);
  });
});
