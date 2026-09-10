import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';

/**
 * `part.transposition` direction.
 *
 * MNX: "the interval that transforms a sounding pitch into a written pitch"
 * (a B-flat clarinet is {staffDistance: 1, halfSteps: 2}).
 * MusicXML: `<transpose>` is "what must be added to a written pitch to get a
 * correct sounding pitch" — the opposite sign. Both ends of the converter once
 * copied MusicXML's values straight into MNX, so round trips passed while every
 * imported document carried an inverted interval. An asymmetric transposition
 * (not just the guitar octave) pins the direction of the pitch arithmetic too.
 */

// A B-flat clarinet: written D5 sounds C5.
const CLARINET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Clarinet</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
        <transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>
      </attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

function firstPitch(part: any) {
  for (const measure of part.measures) {
    for (const seq of measure.sequences ?? []) {
      for (const event of seq.content ?? []) {
        if (event.notes?.length) return event.notes[0].pitch;
      }
    }
  }
  return undefined;
}

function transposeValues(xml: string) {
  const block = xml.match(/<transpose>([\s\S]*?)<\/transpose>/)?.[1];
  if (!block) return undefined;
  const read = (tag: string) => {
    const m = block.match(new RegExp(`<${tag}>(-?\\d+)</${tag}>`));
    return m ? Number(m[1]) : undefined;
  };
  return { chromatic: read('chromatic'), diatonic: read('diatonic') };
}

function firstWrittenPitch(xml: string) {
  const block = xml.match(/<pitch>([\s\S]*?)<\/pitch>/)?.[1] ?? '';
  return {
    step: block.match(/<step>(\w)<\/step>/)?.[1],
    octave: Number(block.match(/<octave>(-?\d+)<\/octave>/)?.[1])
  };
}

describe('part.transposition runs sounding → written (the opposite of MusicXML)', () => {
  it('imports <transpose> negated, and the pitch as sounding', () => {
    const mnx = importMusicXML(CLARINET_XML);
    const part = mnx.parts[0];
    expect(part.transposition).toEqual({ interval: { halfSteps: 2, staffDistance: 1 } });
    expect(firstPitch(part)).toMatchObject({ step: 'C', octave: 5 });
  });

  it('exports the interval negated, and the pitch as written', () => {
    // State the MNX interval outright rather than trusting the importer: a
    // shared sign error at both ends cancels out and hides behind a round trip.
    const mnx = importMusicXML(CLARINET_XML);
    mnx.parts[0].transposition = { interval: { halfSteps: 2, staffDistance: 1 } };
    expect(firstPitch(mnx.parts[0])).toMatchObject({ step: 'C', octave: 5 });
    const xml = exportMusicXML(mnx, { splitNotationAndTab: false, divisions: 1 });
    expect(transposeValues(xml)).toEqual({ chromatic: -2, diatonic: -1 });
    expect(firstWrittenPitch(xml)).toEqual({ step: 'D', octave: 5 });
  });

  it('round-trips an asymmetric transposition without drift', () => {
    const once = importMusicXML(CLARINET_XML);
    const twice = importMusicXML(exportMusicXML(once, { splitNotationAndTab: false, divisions: 1 }));
    expect(twice.parts[0].transposition).toEqual(once.parts[0].transposition);
    expect(firstPitch(twice.parts[0])).toEqual(firstPitch(once.parts[0]));
  });

  it('gives a guitar with no declared transposition the octave-up default', async () => {
    const mnxPath = path.resolve(__dirname, '../../fixtures/House-of-the-Rising-Sun.mnx.json');
    const source = JSON.parse(await fs.readFile(mnxPath, 'utf-8'));
    expect(source.parts[0].transposition).toBeUndefined();

    const xml = exportMusicXML(source, { splitNotationAndTab: true, divisions: 8 });
    expect(transposeValues(xml)).toEqual({ chromatic: -12, diatonic: -7 });

    const reimported = importMusicXML(xml, { mergeNotationAndTab: true });
    expect(reimported.parts[0].transposition).toEqual({ interval: { halfSteps: 12, staffDistance: 7 } });
  });
});
