import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';
import { dynamicToXml } from '../src/common/dynamics.js';
import type { MnxDynamic, MnxStructure } from '../src/common/types.js';

/**
 * Dynamics and hairpins, both directions.
 *
 * None of the converter fixtures — the three guitar scores or the 27 W3C
 * comparisons — contains a single dynamic, so every round trip over them passed
 * while the feature existed in neither direction. The documents here carry it:
 * hand-written MusicXML for import, and the corpus's own dynamics scenarios for
 * the round trip.
 */

const SCENARIOS = path.resolve(__dirname, '../../../scenarios');

const ATTRIBUTES =
  '<divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time>' +
  '<clef><sign>G</sign><line>2</line></clef>';

function score(measures: string[], attributes = ATTRIBUTES): string {
  const body = measures
    .map(
      (content, index) =>
        `<measure number="${index + 1}">` +
        (index === 0 ? `<attributes>${attributes}</attributes>` : '') +
        `${content}</measure>`
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list>' +
    '<score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${body}</part></score-partwise>`
  );
}

const note = (notations = '', staff = '') =>
  '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration>' +
  `<voice>1</voice><type>quarter</type>${staff}${notations}</note>`;
const bar = note() + note() + note() + note();
const dynamics = (inner: string, after = '', attrs = '') =>
  `<direction${attrs}><direction-type><dynamics>${inner}</dynamics></direction-type>${after}</direction>`;
const wedge = (type: string) => `<direction><direction-type><wedge type="${type}"/></direction-type></direction>`;

function load(xml: string, warnings: string[] = []): MnxStructure {
  return importMusicXML(xml, { onWarning: message => warnings.push(message) });
}

const dynamicsOf = (mnx: MnxStructure) => mnx.parts[0].measures.map(measure => measure.dynamics);

describe('importing dynamics', () => {
  it('places a mark at the cursor, nudged by its offset', () => {
    const mnx = load(score([dynamics('<f/>') + note() + dynamics('<p/>', '<offset>2</offset>') + note() + note() + note()]));
    expect(dynamicsOf(mnx)).toEqual([
      [
        { position: { fraction: [0, 1] }, type: 'immediate', value: 'f' },
        { position: { fraction: [3, 8] }, type: 'immediate', value: 'p' }
      ]
    ]);
  });

  it('spells the sforzando family structurally and the rest as SMuFL glyphs', () => {
    const warnings: string[] = [];
    const mnx = load(
      score([
        dynamics('<sfz/>') + note() +
          dynamics('<fp/>') + note() +
          dynamics('<pf/>') + note() +
          dynamics('<other-dynamics smufl="dynamicZ"/>') + note()
      ]),
      warnings
    );
    expect(warnings).toEqual([]);
    expect(dynamicsOf(mnx)[0]).toEqual([
      { position: { fraction: [0, 1] }, type: 'accent', accentPrefix: 's', value: 'f', accentSuffix: 'z' },
      {
        position: { fraction: [1, 4] }, type: 'accent',
        accentPrefix: '', value: 'f', accentSuffix: '', residualValue: 'p'
      },
      { position: { fraction: [1, 2] }, type: 'immediate', glyphs: ['dynamicPF'] },
      { position: { fraction: [3, 4] }, type: 'immediate', glyphs: ['dynamicZ'] }
    ]);
  });

  it('says so, rather than dropping it silently, when a mark is free text', () => {
    const warnings: string[] = [];
    const mnx = load(score([dynamics('<other-dynamics>molto f</other-dynamics>') + bar]), warnings);
    expect(dynamicsOf(mnx)).toEqual([undefined]);
    expect(warnings).toEqual([expect.stringMatching(/measure 1: dynamic "molto f" has no MNX equivalent/)]);
  });

  it("reads a dynamic hung off a note at that note's onset", () => {
    const mnx = load(score([note() + note('<notations><dynamics><mf/></dynamics></notations>') + note() + note()]));
    expect(dynamicsOf(mnx)[0]).toEqual([{ position: { fraction: [1, 4] }, type: 'immediate', value: 'mf' }]);
  });

  it('states only the exceptional placement', () => {
    const mnx = load(score([dynamics('<p/>', '', ' placement="above"') + dynamics('<f/>', '', ' placement="below"') + bar]));
    expect(dynamicsOf(mnx)[0]).toEqual([
      { position: { fraction: [0, 1] }, type: 'immediate', value: 'p', orient: 'above' },
      { position: { fraction: [0, 1] }, type: 'immediate', value: 'f' }
    ]);
  });

  it('pairs a hairpin across a barline and names the measure it ends in', () => {
    const mnx = load(score([note() + note() + wedge('crescendo') + note() + note(), note() + wedge('stop') + note() + note() + note()]));
    expect(dynamicsOf(mnx)).toEqual([
      [
        {
          position: { fraction: [1, 2] }, type: 'gradual', wedgeType: 'increasing',
          end: { measure: 'm2', position: { fraction: [1, 4] } }
        }
      ],
      undefined
    ]);
    expect(mnx.global.measures[1].id).toBe('m2');
  });

  it('keeps a hairpin with no stop, without an end, and says so', () => {
    const warnings: string[] = [];
    const mnx = load(score([wedge('diminuendo') + bar]), warnings);
    expect(dynamicsOf(mnx)[0]).toEqual([{ position: { fraction: [0, 1] }, type: 'gradual', wedgeType: 'decreasing' }]);
    expect(warnings).toEqual([expect.stringMatching(/hairpin with no stop/)]);
  });

  it('keeps the staff only where there is more than one to tell apart', () => {
    const grand =
      '<divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>' +
      '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>';
    const staffNote = note('', '<staff>2</staff>');
    const mnx = load(score([dynamics('<pp/>', '<staff>2</staff>') + staffNote + staffNote + staffNote + staffNote], grand));
    expect(dynamicsOf(mnx)[0]).toEqual([{ position: { fraction: [0, 1] }, type: 'immediate', value: 'pp', staff: 2 }]);

    const single = load(score([dynamics('<pp/>', '<staff>1</staff>') + bar]));
    expect(dynamicsOf(single)[0]).toEqual([{ position: { fraction: [0, 1] }, type: 'immediate', value: 'pp' }]);
  });

  it('produces MNX the published schema accepts', async () => {
    const validate = (await import('../../../worker/generated/validate-mnx.mjs')).default;
    const mnx = load(
      score([
        dynamics('<sfz/>') + note() + dynamics('<fp/>') + note() + wedge('crescendo') + note() + note(),
        note() + wedge('stop') + dynamics('<other-dynamics smufl="dynamicZ"/>') + note() + note() + note()
      ])
    );
    const valid = validate(mnx);
    expect(valid ? [] : validate.errors).toEqual([]);
  });
});

describe('exporting dynamics', () => {
  const measure = (dynamics: MnxDynamic[], id?: string) => ({
    ...(id ? { id } : {}),
    sequences: [{ content: [{ duration: { base: 'whole' as const }, rest: {} }] }],
    dynamics
  });
  // `end.measure` names a GLOBAL measure, so that is where the ids go.
  const doc = (measures: ReturnType<typeof measure>[]): MnxStructure => ({
    mnx: { version: 1 },
    global: {
      measures: measures.map(({ id }, i) => ({
        ...(id ? { id } : {}),
        ...(i === 0 ? { time: { count: 4, unit: 4 } } : {})
      }))
    },
    parts: [{ id: 'P1', name: 'Piano', measures: measures.map(({ id: _id, ...rest }) => rest) }]
  }) as unknown as MnxStructure;

  it('writes marks at the head of the measure with an offset, and hairpins as numbered wedges', () => {
    const xml = exportMusicXML(
      doc([
        measure([
          { position: { fraction: [0, 1] }, type: 'accent', accentPrefix: 's', value: 'f', accentSuffix: 'z' },
          {
            position: { fraction: [1, 4] }, type: 'gradual', wedgeType: 'increasing',
            end: { measure: 'm2', position: { fraction: [1, 2] } }
          }
        ]),
        measure([], 'm2')
      ])
    );
    expect(xml).toMatch(/<dynamics><sfz\s*\/><\/dynamics>/);
    expect(xml).toMatch(/<wedge type="crescendo" number="1"\s*\/><\/direction-type><offset>8<\/offset>/);
    expect(xml).toMatch(/<wedge type="stop" number="1"\s*\/><\/direction-type><offset>16<\/offset>/);
  });

  it('numbers overlapping hairpins apart and reuses a number once it is free', () => {
    const xml = exportMusicXML(
      doc([
        measure([
          { position: { fraction: [0, 1] }, type: 'gradual', wedgeType: 'increasing', end: { measure: 'm1', position: { fraction: [1, 2] } } },
          { position: { fraction: [1, 4] }, type: 'gradual', wedgeType: 'decreasing', end: { measure: 'm1', position: { fraction: [3, 4] } } },
          { position: { fraction: [3, 4] }, type: 'gradual', wedgeType: 'increasing', end: { measure: 'm1', position: { fraction: [1, 1] } } }
        ], 'm1')
      ])
    );
    const wedges = [...xml.matchAll(/<wedge type="(\w+)" number="(\d)"/g)].map(m => `${m[1]}:${m[2]}`);
    expect(wedges).toEqual(['crescendo:1', 'stop:1', 'diminuendo:2', 'stop:2', 'crescendo:1', 'stop:1']);
  });

  it('warns for what MusicXML cannot say', () => {
    const warnings: string[] = [];
    exportMusicXML(
      doc([
        measure([
          { position: { fraction: [0, 1] }, type: 'relative', relativeValue: 'louder' },
          { position: { fraction: [1, 4] }, type: 'gradual', wedgeType: 'decreasing' },
          { position: { fraction: [1, 2] }, type: 'immediate', value: 'p', prefix: 'subito' }
        ])
      ]),
      { onWarning: message => warnings.push(message) }
    );
    expect(warnings).toEqual([
      expect.stringMatching(/relative dynamic \(louder\) has no MusicXML equivalent/),
      expect.stringMatching(/hairpin with no end was closed at the end of its measure/),
      expect.stringMatching(/dynamic's prefix has no MusicXML equivalent/)
    ]);
  });

  it('writes a split part’s dynamics once, on the notation half', () => {
    const tab = doc([measure([{ position: { fraction: [0, 1] }, type: 'immediate', value: 'f' }])]);
    tab.parts[0]._x = { mnxLab: { tab: { staffKind: 'both' } } } as never;
    const xml = exportMusicXML(tab);
    expect(xml.match(/<dynamics>/g)).toHaveLength(1);
    expect(dynamicsOf(importMusicXML(xml))).toEqual([[{ position: { fraction: [0, 1] }, type: 'immediate', value: 'f' }]]);
  });
});

describe('dynamics through a MusicXML round trip, over the corpus', () => {
  async function scenario(id: string): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCENARIOS, id, 'document.mnx.json'), 'utf-8'));
  }
  const roundTrip = (mnx: MnxStructure, warnings: string[] = []) =>
    importMusicXML(exportMusicXML(mnx, { onWarning: message => warnings.push(message) }), {
      onWarning: message => warnings.push(message)
    });

  it.each(['spec/dynamics', 'lab/30-dynamics/02-accent-prefix-suffix', 'lab/30-dynamics/04-diminuendo-across-bars'])(
    '%s comes back exactly',
    async id => {
      const original = await scenario(id);
      const warnings: string[] = [];
      expect(dynamicsOf(roundTrip(original, warnings))).toEqual(dynamicsOf(original));
      expect(warnings).toEqual([]);
    }
  );

  /** What a mark SAYS: the MusicXML it spells, or the hairpin and its end. */
  const spelled = (groups: MnxDynamic[] | undefined) =>
    (groups ?? []).map(group => ({
      at: group.position.fraction[0] / group.position.fraction[1],
      says: group.type === 'gradual' ? `${group.wedgeType}` : JSON.stringify(dynamicToXml(group).children)
    }));

  it('lab/30-dynamics/01-all-dynamic-marks keeps every mark, some respelled from glyph to structure', async () => {
    const original = await scenario('lab/30-dynamics/01-all-dynamic-marks');
    const warnings: string[] = [];
    const back = roundTrip(original, warnings);
    expect(warnings).toEqual([]);
    expect(dynamicsOf(back).map(spelled)).toEqual(dynamicsOf(original).map(spelled));
    // A glyph the enum now names comes back as the value…
    expect(dynamicsOf(back)[0]![3]).toEqual({ position: { fraction: [3, 4] }, type: 'immediate', value: 'ppp' });
    // …and the sforzando family as its structure.
    expect(dynamicsOf(back)[5]![0]).toMatchObject({ type: 'accent', accentPrefix: 's', value: 'f', accentSuffix: 'z' });
  });

  it('lab/30-dynamics/03-hairpin-and-relative loses the relative mark and closes the open hairpin, out loud', async () => {
    const original = await scenario('lab/30-dynamics/03-hairpin-and-relative');
    const warnings: string[] = [];
    const back = roundTrip(original, warnings);
    expect(dynamicsOf(back)[0]).toEqual([
      {
        position: { fraction: [0, 1] }, type: 'gradual', wedgeType: 'increasing',
        end: { measure: 'm1', position: { fraction: [1, 1] } }
      }
    ]);
    expect(warnings).toEqual([
      expect.stringMatching(/hairpin with no end/),
      expect.stringMatching(/relative dynamic \(louder\)/)
    ]);
  });
});
