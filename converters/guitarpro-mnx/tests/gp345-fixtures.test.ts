import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  importGuitarPro,
  importGuitarPro5,
  importGuitarProCleanRoom,
  parseGuitarPro5
} from '../src/index.js';
import { MnxStructure } from '../src/common/types.js';
import { normalizeIds } from './helpers/normalize.js';

const FIXTURES = path.resolve(__dirname, 'fixtures/gp5');

async function importFixture(name: string): Promise<MnxStructure> {
  const bytes = await fs.readFile(path.join(FIXTURES, name));
  return importGuitarPro(new Uint8Array(bytes));
}

/**
 * The first GP3–5 oracle fixtures. PyGuitarPro writes them through its public
 * API; alphaTab independently proves it accepts their bodies. Once the
 * clean-room GP5 body reader lands, its output joins this exact comparison.
 */
describe('GP5.00/5.10 fixture oracle', () => {
  it('both revisions describe the same MNX score through alphaTab', async () => {
    const gp500 = normalizeIds(await importFixture('basic-5.00.gp5'));
    const gp510 = normalizeIds(await importFixture('basic-5.10.gp5'));
    expect(gp500).toEqual(gp510);
  });

  it.each(['basic-5.00.gp5', 'basic-5.10.gp5'])('%s has exact clean-room parity', async name => {
    const bytes = new Uint8Array(await fs.readFile(path.join(FIXTURES, name)));
    const alphaTab = normalizeIds(importGuitarPro(bytes));
    expect(normalizeIds(importGuitarPro5(bytes))).toEqual(alphaTab);
    expect(normalizeIds(importGuitarProCleanRoom(bytes))).toEqual(alphaTab);
  });

  it.each(['basic-5.00.gp5', 'basic-5.10.gp5'])('%s consumes the complete binary body', async name => {
    const bytes = new Uint8Array(await fs.readFile(path.join(FIXTURES, name)));
    const document = parseGuitarPro5(bytes);
    expect(document.masterBars).toHaveLength(2);
    expect(document.tracks).toHaveLength(1);
    expect(document.bars.get(0)?.voiceIds).toHaveLength(2);
    expect(document.notes.size).toBe(7);
  });

  it.each(['basic-5.00.gp5', 'basic-5.10.gp5'])('%s carries the baseline fields', async name => {
    const mnx = await importFixture(name);
    expect(mnx.global.measures).toHaveLength(2);
    expect(mnx.global.measures[0]).toMatchObject({
      key: { fifths: 0 },
      time: { count: 3, unit: 4 },
      repeatStart: {},
      section: { label: 'A - baseline' },
      _x: {
        mnxLab: {
          harmonies: [{ root: { step: 'D' }, quality: 'dominantSeventh' }]
        }
      }
    });
    expect(mnx.global.measures[1]).toMatchObject({
      key: { fifths: 1 },
      time: { count: 4, unit: 4 },
      repeatEnd: { times: 3 },
      barline: { type: 'double' }
    });
    expect(mnx.parts).toHaveLength(1);
    expect(mnx.parts[0]).toMatchObject({
      name: 'Open D',
      _x: { mnxLab: { capo: 2, tab: { staffKind: 'both' } } }
    });
    expect(mnx.parts[0].measures[0].sequences).toHaveLength(2);
    expect(mnx.parts[0].measures[1].sequences?.[0].content).toHaveLength(2);
    expect(mnx.parts[0].measures[0].sequences?.[0].content).toMatchObject([
      { duration: { base: 'quarter', dots: 1 } },
      { duration: { base: 'eighth' } },
      { duration: { base: 'quarter' }, rest: {} }
    ]);
    expect(mnx.parts[0].measures[1].sequences?.[0].content[0]).toMatchObject({
      type: 'tuplet',
      content: [{}, {}, {}],
      inner: { duration: { base: 'eighth' }, multiple: 3 },
      outer: { duration: { base: 'eighth' }, multiple: 2 }
    });
  });
});

describe('GP5 lyrics and simple techniques', () => {
  it.each(['lyrics-techniques-5.00.gp5', 'lyrics-techniques-5.10.gp5'])(
    '%s has exact clean-room parity',
    async name => {
      const bytes = new Uint8Array(await fs.readFile(path.join(FIXTURES, name)));
      expect(normalizeIds(importGuitarProCleanRoom(bytes))).toEqual(
        normalizeIds(importGuitarPro(bytes))
      );
    }
  );

  it('dispatches lyric streams onto voice one notes, skipping rests', async () => {
    const bytes = new Uint8Array(
      await fs.readFile(path.join(FIXTURES, 'lyrics-techniques-5.10.gp5'))
    );
    const mnx = normalizeIds(importGuitarProCleanRoom(bytes));
    expect(mnx.global.lyrics?.lineOrder).toEqual(['1', '2']);
    const first = mnx.parts[0].measures[0].sequences?.[0].content ?? [];
    const second = mnx.parts[0].measures[1].sequences?.[0].content ?? [];
    expect(first[0]).toMatchObject({ lyrics: { lines: { '1': { text: 'Shin', type: 'start' } } } });
    expect(first[1]).toMatchObject({ lyrics: { lines: { '1': { text: 'ing', type: 'end' } } } });
    expect(first[2]).toMatchObject({ rest: {} });
    expect(first[3]).toMatchObject({ lyrics: { lines: { '1': { text: 'two words', type: 'whole' } } } });
    expect(first[4]).toMatchObject({ lyrics: { lines: { '1': { text: 'bright', type: 'whole' } } } });
    expect(second[0]).toMatchObject({ lyrics: { lines: { '2': { text: 'Second', type: 'whole' } } } });
    expect(second[1]).toMatchObject({ lyrics: { lines: { '2': { text: 'verse', type: 'whole' } } } });
  });

  it('maps the representable GP5 note techniques and their targets', async () => {
    const bytes = new Uint8Array(
      await fs.readFile(path.join(FIXTURES, 'lyrics-techniques-5.10.gp5'))
    );
    const mnx = normalizeIds(importGuitarProCleanRoom(bytes));
    const first = mnx.parts[0].measures[0].sequences?.[0].content ?? [];
    const second = mnx.parts[0].measures[1].sequences?.[0].content ?? [];

    expect(first[0]).toMatchObject({
      notes: [{ _x: { mnxLab: { tab: { technique: { hammerPull: { target: 'n1' } } } } } }]
    });
    expect(first[3]).toMatchObject({
      notes: [{ _x: { mnxLab: { tab: { technique: { vibrato: true, palmMute: true } } } } }]
    });
    expect(first[4]).toMatchObject({
      notes: [{ _x: { mnxLab: { tab: { technique: { slide: { type: 'shift', target: 'n4' } } } } } }]
    });
    expect(first[6]).toMatchObject({
      notes: [
        {
          pitch: { octave: 5 },
          _x: { mnxLab: { tab: { technique: { harmonic: { type: 'natural' } } } } }
        }
      ]
    });
    expect(first[7]).toMatchObject({
      notes: [{ pitch: { octave: 6 }, _x: { mnxLab: { tab: { technique: { harmonic: { type: 'pinch' } } } } } }]
    });
    expect(second[0]).toMatchObject({
      notes: [{ _x: { mnxLab: { tab: { technique: { slide: { type: 'legato', target: 'n8' } } } } } }]
    });
    expect(second[2]).toMatchObject({
      notes: [{ _x: { mnxLab: { tab: { technique: { slide: { type: 'slideOut', direction: 'down' } } } } } }]
    });
    expect(second[3]).toMatchObject({
      notes: [{ _x: { mnxLab: { tab: { technique: { slide: { type: 'slideIn', direction: 'down' } } } } } }]
    });
  });
});
