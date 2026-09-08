import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computeBoth, computePrimitives, initSmufl } from '../helpers/corpusPrimitives.ts';
import { importGuitarPro } from '../../converters/guitarpro-mnx/src/index.js';
import { importMusicXML } from '../../converters/musicxml-mnx/src/index.js';
import { isTimedEvent, type MnxStructure, type MnxEvent } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

beforeAll(initSmufl);

function score(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{ id: 'guitar', _x: { mnxLab: { tab: { staffKind: 'both' }, strings: [
      { string: 1, pitch: { step: 'E', octave: 4 } },
      { string: 2, pitch: { step: 'B', octave: 3 } }
    ] } }, measures: [{ sequences: [{ content: Array.from({ length: 8 }, (_, i) => ({
      duration: { base: 'eighth' as const },
      notes: [{ id: `n${i}`, pitch: { step: 'C' as const, octave: 4 },
        _x: { mnxLab: { string: 2, fret: 1 } } }]
    })) }] }] }]
  };
}

function withEventIds(doc: MnxStructure): MnxStructure {
  const result = structuredClone(doc);
  let id = 0;
  for (const part of result.parts) for (const measure of part.measures)
    for (const seq of measure.sequences ?? []) for (const event of seq.content)
      if (isTimedEvent(event)) event.id ??= `event-${id++}`;
  return result;
}

function ink(primitives: readonly Primitive[], wanted: string[]): Primitive[] {
  const result: Primitive[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.className === 'string' &&
        wanted.some(name => (record.className as string).split(' ').includes(name))) {
      result.push(node as Primitive);
    }
    Object.values(record).forEach(walk);
  };
  walk(primitives);
  return result;
}
const beamInk = (primitives: readonly Primitive[]) => ink(primitives, ['beam', 'stem', 'flag']);
const rendered = (doc: MnxStructure) => computePrimitives(doc).notation.primitives;

function expectIdIndependent(doc: MnxStructure) {
  const before = structuredClone(doc);
  const anonymous = rendered(doc);
  expect(ink(anonymous, ['beam']).length).toBeGreaterThan(0);
  expect(beamInk(anonymous)).toEqual(beamInk(rendered(withEventIds(doc))));
  expect(doc).toEqual(before); // layout must not mint IDs or otherwise rewrite the document
}

it('beams ID-less eighths identically in Notation and Both, without mutating the document', () => {
  const doc = score();
  expectIdIndependent(doc);
  expect(ink(rendered(doc), ['beam'])).toHaveLength(2);
  expect(ink(rendered(doc), ['flag'])).toHaveLength(0);
  const both = computeBoth(doc)!;
  expect(both).not.toBeNull();
  expect(beamInk(both.primitives)).toEqual(beamInk(computeBoth(withEventIds(doc))!.primitives));
});

it('handles mixed named and anonymous events, including secondary beams and hooks', () => {
  const doc = score();
  const events = doc.parts[0].measures[0].sequences![0].content as MnxEvent[];
  events[0].id = 'named';
  events[1].duration = { base: '16th' };
  events[2].duration = { base: '16th' };
  events[3].duration = { base: 'quarter' };
  expectIdIndependent(doc);
});

it('does not join voices, staves or parts whose local event positions coincide', () => {
  const doc = score();
  const secondVoice = structuredClone(doc.parts[0].measures[0].sequences![0]);
  secondVoice.content.forEach(event => {
    if (isTimedEvent(event)) event.notes!.forEach(note => { delete note.id; note.pitch.octave = 3; });
  });
  doc.parts[0].measures[0].sequences!.push(secondVoice);
  const secondPart = structuredClone(doc.parts[0]);
  secondPart.id = 'other';
  secondPart.staves = 2;
  secondPart.measures[0].sequences!.forEach((seq, i) => {
    seq.staff = i + 1;
    for (const event of seq.content) if (isTimedEvent(event))
      event.notes!.forEach(note => delete note.id);
  });
  doc.parts.push(secondPart);
  expectIdIndependent(doc);
  expect(ink(rendered(doc), ['beam'])).toHaveLength(8);
});

it('infers beams on chord-merged staff sources without source event IDs', () => {
  const doc = score();
  const second = structuredClone(doc.parts[0]);
  second.id = 'other';
  for (const event of second.measures[0].sequences![0].content) if (isTimedEvent(event)) {
    event.notes!.forEach(note => { delete note.id; note.pitch.step = 'E'; });
  }
  doc.parts.push(second);
  doc.layouts = [{ id: 'merged', content: [{ type: 'staff', sources: [
    { part: 'guitar' }, { part: 'other' }
  ] }] }];
  doc.scores = [{ name: 'Merged', layout: 'merged' }];
  expectIdIndependent(doc);
  expect(ink(rendered(doc), ['beam'])).toHaveLength(2);
});

it('breaks inferred runs at rests and keeps isolated notes flagged', () => {
  const doc = score();
  const events = doc.parts[0].measures[0].sequences![0].content as MnxEvent[];
  events[1] = { duration: { base: 'eighth' }, rest: {} };
  expectIdIndependent(doc);
  expect(ink(rendered(doc), ['beam'])).toHaveLength(2);
  expect(ink(rendered(doc), ['flag'])).toHaveLength(1);
});

it('honors support.useBeams for ID-less documents', () => {
  const doc = score();
  doc.mnx.support = { useBeams: true };
  expect(ink(rendered(doc), ['beam'])).toHaveLength(0);
  expect(ink(rendered(doc), ['flag'])).toHaveLength(8);
});

it('resolves explicit IDs separately from position keys and leaves unspecified events flagged', () => {
  const doc = score();
  const measure = doc.parts[0].measures[0];
  const events = measure.sequences![0].content as MnxEvent[];
  // These authored IDs look exactly like other events' internal positions.
  events[0].id = '0:0:0:2';
  events[1].id = '0:0:0:3';
  measure.beams = [{ events: [events[0].id, events[1].id] }];
  const p = rendered(doc);
  expect(ink(p, ['beam'])).toHaveLength(1);
  expect(ink(p, ['flag'])).toHaveLength(6);
  expect(beamInk(p)).toEqual(beamInk(rendered(withEventIds(doc))));
});

describe('converter imports without event IDs', () => {
  it('beams the real GPX source without changing the converter contract', () => {
    const bytes = fs.readFileSync(new URL('../../converters/fixtures/Sun-did-glide.gpx', import.meta.url));
    const imported = importGuitarPro(bytes) as unknown as MnxStructure;
    const doc: MnxStructure = { mnx: imported.mnx,
      global: { measures: imported.global.measures.slice(0, 8) },
      parts: [{ ...imported.parts[0], measures: imported.parts[0].measures.slice(0, 8) }] };
    expect(doc.parts[0].measures.flatMap(m => m.sequences!.flatMap(s => s.content))
      .every(e => !('id' in e))).toBe(true);
    expectIdIndependent(doc);
  });

  it('beams MusicXML without slurs, which likewise imports without event IDs', () => {
    const xml = `<score-partwise version="4.0"><part-list><score-part id="P1">
      <part-name>Guitar</part-name></score-part></part-list><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      ${Array.from({ length: 8 }, () => '<note><pitch><step>C</step><octave>4</octave></pitch>' +
        '<duration>1</duration><type>eighth</type></note>').join('')}
      </measure></part></score-partwise>`;
    const doc = importMusicXML(xml) as unknown as MnxStructure;
    expect(doc.parts[0].measures[0].sequences![0].content.every(e => !('id' in e))).toBe(true);
    expectIdIndependent(doc);
    expect(ink(rendered(doc), ['beam'])).toHaveLength(2);
  });
});
