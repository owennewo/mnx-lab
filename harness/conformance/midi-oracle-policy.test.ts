import fs from 'node:fs';
import { expect, it } from 'vitest';
import {
  comparePerformances,
  xmlEvidence,
  midiAttacks,
  barEvidence,
  type Attack,
} from '../helpers/midiOracle.ts';
const attack = (pitch: number, onset: number, measure = 0): Attack => ({
  onset,
  seconds: onset / 2,
  notes: [{ pitch, duration: 1, velocity: 80, seconds: 0.5, measure }],
});
const source = (timingInterpretive = false) => ({
  bars: [
    {
      index: 0,
      number: '1',
      patterns: ['60'],
      offsets: [0],
      features: timingInterpretive ? ['fermata'] : [],
      timingInterpretive,
    },
  ],
  featureCounts: {},
});
it('uses independent MIDI at its own PPQ and matches the hand-stated tuplet positions', () => {
  const m = midiAttacks(fs.readFileSync('harness/fixtures/midi-oracle/w3c--tuplets.mid'));
  expect(m.ppq).toBe(480);
  expect(m.attacks.slice(0, 7).map((a) => a.onset)).toEqual([0, 2 / 3, 1, 4 / 3, 5 / 3, 2, 3]);
  expect(m.attacks.slice(0, 7).map((a) => a.notes[0].pitch)).toEqual([72, 67, 64, 65, 67, 76, 74]);
});
it('fails strict timing beyond one sixty-fourth quarter and accepts a smaller PPQ rounding error', () => {
  const a = [attack(60, 0), attack(62, 1)];
  expect(
    comparePerformances(a, [attack(60, 0), attack(62, 1.02)], { bars: [], featureCounts: {} })
      .strict.match,
  ).toBe(false);
  expect(
    comparePerformances(a, [attack(60, 0), attack(62, 1.002)], { bars: [], featureCounts: {} })
      .strict.match,
  ).toBe(true);
});
it('keeps pitch omissions and extra duplicate notes as failures rather than normalizing them away', () => {
  const a = [attack(60, 0), attack(62, 1)];
  expect(
    comparePerformances(a, [attack(60, 0)], source()).strict.pitchOrder.missingFromExternal,
  ).toHaveLength(1);
  const doubled = attack(60, 0);
  doubled.notes.push({ ...doubled.notes[0] });
  expect(comparePerformances([attack(60, 0)], [doubled], source()).strict.match).toBe(false);
});
it('treats simultaneous chord note order as a multiset but keeps multiplicity', () => {
  const a = attack(60, 0);
  a.notes.push({ ...a.notes[0], pitch: 64 });
  const b = { ...a, notes: [...a.notes].reverse() };
  expect(
    comparePerformances([a], [b], { bars: [], featureCounts: {} }).strict.pitchOrder.match,
  ).toBe(true);
});
it('re-anchors after a fermata at independently unique content, then checks later timing', () => {
  const a = [attack(60, 0), attack(62, 2, 1), attack(64, 3, 1)],
    b = [attack(60, 0), attack(62, 1, 1), attack(64, 2, 1)];
  const r = comparePerformances(a, b, source(true));
  expect(r.strict.timing.excluded).toHaveLength(1);
  expect(r.strict.timing.anchors).toEqual([
    { ourAttack: 1, externalAttack: 1, status: 'independent-anchor' },
  ]);
  expect(r.strict.timing.checked).toBe(1);
  expect(r.strict.timing.mismatches).toHaveLength(0);
  const changed = [...b.slice(0, 2), attack(64, 2.1, 1)];
  expect(comparePerformances(a, changed, source(true)).strict.timing.mismatches).toHaveLength(1);
});
it('leaves timing unobservable when repeated content provides no independent anchor', () => {
  const a = Array.from({ length: 8 }, (_, i) => attack(60, i + (i ? 1 : 0), i ? 1 : 0)),
    b = Array.from({ length: 8 }, (_, i) => attack(60, i, i ? 1 : 0));
  const r = comparePerformances(a, b, source(true));
  expect(r.strict.timing.checked).toBe(0);
  expect(r.strict.timing.anchors).toHaveLength(0);
  expect(r.strict.timing.excluded).toHaveLength(8);
});
it('does not call identical or silent bars observable and rejects inside-bar fingerprint collisions', () => {
  const bars = [
    { ...source().bars[0] },
    { ...source().bars[0], index: 1 },
    { ...source().bars[0], index: 2, patterns: [], offsets: [] },
  ];
  const r = comparePerformances([attack(60, 0)], [attack(60, 0)], { bars, featureCounts: {} });
  expect(r.strict.bars.checked).toBe(0);
  expect(r.strict.bars.unobservableWritten).toHaveLength(3);
  const nested = [
    { ...source().bars[0], patterns: ['62', '60'], offsets: [0, 1] },
    { ...source().bars[0], index: 1 },
  ];
  expect(barEvidence([attack(62, 0), attack(60, 1)], nested)[1].writtenMeasure).toBeNull();
});
it('recognizes unique written bar content without calling the MNX pass model', () => {
  const xml =
    '<score-partwise><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note></measure><measure number="2"><note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration></note></measure></part></score-partwise>';
  const source = xmlEvidence(xml);
  expect(
    barEvidence([attack(62, 0), attack(60, 1)], source.bars).map((b) => b.writtenMeasure),
  ).toEqual([1, 0]);
  const comparison = comparePerformances(
    [attack(62, 0, 0), attack(60, 1, 1)],
    [attack(62, 0), attack(60, 1)],
    source,
  );
  expect(comparison.strict.bars.mismatches).toHaveLength(2);
});
it('does not hide missing grace pitches inside a timing exclusion', () => {
  const a = [attack(59, 0), attack(60, 0.125)],
    b = [attack(60, 0)];
  const r = comparePerformances(a, b, source(true));
  expect(r.strict.match).toBe(false);
  expect(r.strict.pitchOrder.missingFromExternal).toHaveLength(1);
});
