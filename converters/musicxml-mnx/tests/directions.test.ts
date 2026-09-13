import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';
import type { MnxStructure } from '../src/common/types.js';

/**
 * Free text: `<words>` → part `directions`, and back.
 *
 * MusicXML has no section element, so plain words cannot say whether they name
 * a section or are just text over the staff — Soundslice writes "Verse 1-4"
 * over a volta as plain words. Plain words are text; only BOLD words at the head
 * of a bar are a section name, which is what this converter's exporter writes.
 */

const SCENARIOS = path.resolve(__dirname, '../../../scenarios');

const ATTRIBUTES =
  '<divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time>' +
  '<clef><sign>G</sign><line>2</line></clef>';
const NOTE = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><type>half</type></note>';

function score(content: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list>' +
    '<score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>' +
    `<part id="P1"><measure number="1"><attributes>${ATTRIBUTES}</attributes>${content}</measure></part></score-partwise>`
  );
}

const directionsOf = (mnx: MnxStructure) => mnx.parts[0].measures.map(m => m.directions);

describe('words from MusicXML', () => {
  it('reads plain words at the head of a bar as text, not a section', () => {
    const mnx = importMusicXML(
      score(`<direction placement="above"><direction-type><words>Verse 1-4</words></direction-type></direction>${NOTE}${NOTE}`)
    );
    expect(mnx.global.measures[0].section).toBeUndefined();
    expect(directionsOf(mnx)).toEqual([[{ position: { fraction: [0, 1] }, text: 'Verse 1-4', orient: 'above' }]]);
  });

  it('reads bold words at the head of a bar as a section name', () => {
    const mnx = importMusicXML(
      score(`<direction placement="above"><direction-type><words font-weight="bold">Chorus</words></direction-type></direction>${NOTE}${NOTE}`)
    );
    expect(mnx.global.measures[0].section).toEqual({ label: 'Chorus' });
    expect(directionsOf(mnx)).toEqual([undefined]);
  });

  it('places words mid-bar at their onset, with their placement', () => {
    const mnx = importMusicXML(
      score(`${NOTE}<direction placement="below"><direction-type><words font-weight="bold">let ring</words></direction-type></direction>${NOTE}`)
    );
    expect(mnx.global.measures[0].section).toBeUndefined();
    expect(directionsOf(mnx)).toEqual([[{ position: { fraction: [1, 2] }, text: 'let ring', orient: 'below' }]]);
  });

  it('leaves a tempo mark\'s words and a jump\'s caption to their own objects', () => {
    const mnx = importMusicXML(
      score(
        '<direction placement="above"><direction-type><words>Allegro</words></direction-type>' +
          '<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type></direction>' +
          `${NOTE}${NOTE}` +
          '<direction placement="above"><direction-type><words>Fine</words></direction-type><sound fine="yes"/></direction>'
      )
    );
    expect(directionsOf(mnx)).toEqual([undefined]);
  });
});

describe('text directions through a MusicXML round trip, over the corpus', () => {
  async function scenario(id: string): Promise<MnxStructure> {
    return JSON.parse(await fs.readFile(path.join(SCENARIOS, id, 'document.mnx.json'), 'utf-8'));
  }

  it.each(['lab/31-score-text/04-directions', 'lab/31-score-text/08-directions-stacked'])('%s comes back exactly', async id => {
    const original = await scenario(id);
    const warnings: string[] = [];
    const back = importMusicXML(exportMusicXML(original, { onWarning: message => warnings.push(message) }));
    expect(directionsOf(back)).toEqual(directionsOf(original));
    expect(warnings).toEqual([]);
  });

  it('keeps a section name a section, beside a direction on the same bar', () => {
    const original = importMusicXML(
      score(
        '<direction placement="above"><direction-type><words font-weight="bold">Verse</words></direction-type></direction>' +
          `<direction placement="above"><direction-type><words>1-4</words></direction-type></direction>${NOTE}${NOTE}`
      )
    );
    expect(original.global.measures[0].section).toEqual({ label: 'Verse' });
    const back = importMusicXML(exportMusicXML(original));
    expect(back.global.measures[0].section).toEqual({ label: 'Verse' });
    expect(directionsOf(back)).toEqual(directionsOf(original));
  });
});
