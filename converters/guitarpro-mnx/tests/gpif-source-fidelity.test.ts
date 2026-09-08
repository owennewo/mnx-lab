import { describe, expect, it } from 'vitest';
import { importGuitarPro } from '../src/index.js';
import { writeGpContainer } from '../src/gpif/container.js';
import type { MnxEvent } from '../src/common/types.js';

// Independently authored GPIF, not an alphaTab export or a converter round trip.
function score(options: { slots?: string; voices?: string; beats?: string;
  notes?: string; rhythms?: string } = {}) {
  return writeGpContainer(`<GPIF>
    <Tracks><Track id="0"><Name>Guitar</Name><Properties>
      <Property name="Tuning"><Pitches>40 45 50 55 59 64</Pitches></Property>
    </Properties></Track></Tracks>
    <MasterBars><MasterBar><Time>4/4</Time><Bars>0</Bars></MasterBar></MasterBars>
    <Bars><Bar id="0"><Clef>G2</Clef><Voices>${options.slots ?? '0 -1 -1 -1'}</Voices></Bar></Bars>
    <Voices>${options.voices ?? '<Voice id="0"><Beats>0</Beats></Voice>'}</Voices>
    <Beats>${options.beats ?? '<Beat id="0"><Rhythm ref="0"/><Notes>0</Notes></Beat>'}</Beats>
    <Notes>${options.notes ?? '<Note id="0"><Properties><Property name="Midi"><Number>60</Number></Property></Properties></Note>'}</Notes>
    <Rhythms>${options.rhythms ?? '<Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm>'}</Rhythms>
  </GPIF>`);
}
const sequences = (data: Uint8Array) => importGuitarPro(data).parts[0].measures[0].sequences!;
const note = (properties: string) => `<Note id="0"><Properties>${properties}</Properties></Note>`;
const property = (name: string, value: string) => `<Property name="${name}">${value}</Property>`;
const number = (name: string, value: number) => property(name, `<Float>${value}</Float>`);

it('imports one occupied voice, without synthesizing quarter rests for -1 slots', () => {
  const result = sequences(score());
  expect(result).toHaveLength(1);
  expect(result[0].voice).toBe('v1');
  expect((result[0].content[0] as MnxEvent).notes).toHaveLength(1);
});

it('represents an entirely empty bar as a full-measure rest, without quarter-rest voices', () => {
  expect(sequences(score({ slots: '-1 -1 -1 -1', voices: '' })))
    .toEqual([{ voice: 'v1', content: [], fullMeasure: {} }]);
});

it('keeps source voice numbers across a gap and preserves authored all-rest voices', () => {
  const result = sequences(score({ slots: '-1 0 -1 1',
    voices: '<Voice id="0"><Beats>0</Beats></Voice><Voice id="1"><Beats>1 2</Beats></Voice>',
    beats: '<Beat id="0"><Rhythm ref="0"/><Notes>0</Notes></Beat>' +
      '<Beat id="1"><Rhythm ref="0"/></Beat><Beat id="2"><Rhythm ref="0"/></Beat>' }));
  expect(result.map(s => s.voice)).toEqual(['v2', 'v4']);
  expect(result[1].content).toEqual([
    { duration: { base: 'quarter' }, rest: {} }, { duration: { base: 'quarter' }, rest: {} }
  ]);
});

it('does not turn a zero-beat voice into a rest alongside an occupied voice', () => {
  expect(sequences(score({ slots: '0 1 -1 -1', voices:
    '<Voice id="0"><Beats>0</Beats></Voice><Voice id="1"><Beats/></Voice>' }))).toHaveLength(1);
});

describe('authored ConcertPitch spelling', () => {
  it.each([
    ['D', 'b', 5, 61, { step: 'D', alter: -1, octave: 4 }],
    ['B', '#', 4, 60, { step: 'B', alter: 1, octave: 3 }],
    ['F', 'x', 5, 67, { step: 'F', alter: 2, octave: 4 }],
    ['D', 'bb', 5, 60, { step: 'D', alter: -2, octave: 4 }],
    ['C', '', 5, 60, { step: 'C', octave: 4 }]
  ])('preserves %s%s in GPIF octave %s', (step, accidental, octave, midi, expected) => {
    const data = score({ notes: note(property('Midi', `<Number>${midi}</Number>`) +
      property('ConcertPitch', `<Pitch><Step>${step}</Step><Accidental>${accidental}</Accidental><Octave>${octave}</Octave></Pitch>`)) });
    expect((sequences(data)[0].content[0] as MnxEvent).notes![0].pitch).toEqual(expected);
  });

  it('uses ConcertPitch when no numeric pitch or fingerboard position is supplied', () => {
    const data = score({ notes: note(property('ConcertPitch',
      '<Pitch><Step>D</Step><Accidental>b</Accidental><Octave>5</Octave></Pitch>')) });
    expect((sequences(data)[0].content[0] as MnxEvent).notes![0].pitch)
      .toEqual({ step: 'D', alter: -1, octave: 4 });
  });

  it('keeps fingerboard pitch and warns when a supplied spelling disagrees', () => {
    const data = score({ notes: note(property('String', '<String>0</String>') +
      property('Fret', '<Fret>0</Fret>') + property('ConcertPitch',
        '<Pitch><Step>C</Step><Octave>5</Octave></Pitch>')) });
    const warnings: string[] = [];
    const result = importGuitarPro(data, { onWarning: w => warnings.push(w) });
    expect((result.parts[0].measures[0].sequences![0].content[0] as MnxEvent).notes![0].pitch)
      .toEqual({ step: 'E', octave: 2 });
    expect(warnings).toEqual([expect.stringContaining('ConcertPitch disagrees')]);
  });
});

it('places chords exactly within tuplets and after grace notes, including dotted durations', () => {
  const data = score({ voices: '<Voice id="0"><Beats>0 1 2 3 4 5</Beats></Voice>',
    beats: [0, 1, 2, 3, 4, 5].map(i => `<Beat id="${i}"><Rhythm ref="${i === 0 ? 0 : i < 4 ? 1 : i === 4 ? 2 : 0}"/>` +
      (i === 0 ? '<GraceNotes>BeforeBeat</GraceNotes>' : '') +
      `<Notes>0</Notes><FreeText>${['C', 'D', 'E', 'F', 'G', 'A'][i]}</FreeText></Beat>`).join(''),
    rhythms: '<Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm>' +
      '<Rhythm id="1"><NoteValue>Eighth</NoteValue><PrimaryTuplet num="3" den="2"/></Rhythm>' +
      '<Rhythm id="2"><NoteValue>Quarter</NoteValue><AugmentationDot count="1"/></Rhythm>' });
  const harmonies = importGuitarPro(data).global.measures[0]._x!.mnxLab!.harmonies!;
  expect(harmonies.map(h => h.location.fraction)).toEqual([[0, 1], [1, 12], [1, 6], [1, 4], [5, 8]]);
});

it('retains exact positions on successive quintuplet beats', () => {
  const data = score({ voices: '<Voice id="0"><Beats>0 1 2 3 4</Beats></Voice>',
    beats: [0, 1, 2, 3, 4].map(i => `<Beat id="${i}"><Rhythm ref="0"/><Notes>0</Notes>` +
      `<FreeText>C</FreeText></Beat>`).join(''),
    rhythms: '<Rhythm id="0"><NoteValue>16th</NoteValue><PrimaryTuplet num="5" den="4"/></Rhythm>' });
  expect(importGuitarPro(data).global.measures[0]._x!.mnxLab!.harmonies!.map(h => h.location.fraction))
    .toEqual([[0, 1], [1, 20], [1, 10], [3, 20], [1, 5]]);
});

describe('bend evidence', () => {
  const bend = (middle: string) => score({ notes: note(property('Midi', '<Number>60</Number>') +
    property('Bended', '<Enable/>') + number('BendOriginValue', 0) +
    number('BendDestinationValue', 0) + number('BendMiddleValue', 100) + middle) });
  it('preserves an explicitly positioned peak and hold', () => {
    const result = sequences(bend(number('BendMiddleOffset1', 25) + number('BendMiddleOffset2', 75)));
    expect((result[0].content[0] as MnxEvent).notes![0]._x!.mnxLab!.tab!.technique!.bend!.points)
      .toEqual([{ position: 0, alter: 0 }, { position: 0.25, alter: 2 },
        { position: 0.75, alter: 2 }, { position: 1, alter: 0 }]);
  });
  it('retains the known linear unpositioned bend without a warning', () => {
    const warnings: string[] = [];
    const data = score({ notes: note(property('Midi', '<Number>60</Number>') +
      property('Bended', '<Enable/>') + number('BendOriginValue', 0) +
      number('BendMiddleValue', 50) + number('BendDestinationValue', 100)) });
    const result = importGuitarPro(data, { onWarning: w => warnings.push(w) });
    const event = result.parts[0].measures[0].sequences![0].content[0] as MnxEvent;
    expect(event.notes![0]._x!.mnxLab!.tab!.technique!.bend!.points)
      .toEqual([{ position: 0, alter: 0 }, { position: 1, alter: 2 }]);
    expect(warnings).toEqual([]);
  });
  it('reports an ambiguous unpositioned peak instead of silently calling it interpolation', () => {
    const warnings: string[] = [];
    importGuitarPro(bend(''), { onWarning: w => warnings.push(w) });
    expect(warnings).toEqual([expect.stringContaining('bend middle value has no position')]);
  });
});

it('preserves beat-authored lyrics on rests in their actual voice', () => {
  const result = sequences(score({ slots: '-1 0 -1 -1',
    beats: '<Beat id="0"><Rhythm ref="0"/><Lyrics><Line>word</Line></Lyrics></Beat>' }));
  expect(result[0].voice).toBe('v2');
  expect(result[0].content[0]).toMatchObject({ rest: {}, lyrics: { lines: { '1': { text: 'word' } } } });
});
