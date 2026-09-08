import { it, expect } from 'vitest';
import { exportMidi, quantizeTick } from '../../src/audio/midiFile.ts';
import { readMidi } from '../helpers/readMidi.ts';
import { rational as q, ZERO, QUARTER } from '../../src/audio/time.ts';
import type { Performance, SoundingEvent } from '../../src/audio/performanceTypes.ts';
const note = (id: string, voice: string, position = ZERO, duration = QUARTER): SoundingEvent => ({
  id,
  voice,
  position,
  duration,
  midi: 60,
  velocity: 80,
  curve: [],
  writtenIds: [],
});
const performance = (parts: number, strings = 1): Performance => ({
  formatVersion: 1,
  written: [],
  sounding: Array.from({ length: parts }, (_, p) =>
    Array.from({ length: strings }, (_, s) => note(`p${p}s${s}`, `p${p}s${s}`)),
  ).flat(),
  voices: Array.from({ length: parts }, (_, p) =>
    Array.from({ length: strings }, (_, s) => ({ id: `p${p}s${s}`, partIndex: p, string: s + 1 })),
  ).flat(),
  tempo: [{ position: ZERO, quarterBpm: q(120n) }],
  measures: [],
  sourceMap: [],
  diagnostics: [],
});
it('writes type 1, big-endian PPQ 960, a conductor tempo and exact note bytes', () => {
  const result = exportMidi(performance(1));
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect([...result.bytes.slice(0, 14)]).toEqual([
    77, 84, 104, 100, 0, 0, 0, 6, 0, 1, 0, 2, 3, 192,
  ]);
  const parsed = readMidi(result.bytes);
  expect(parsed.ppq).toBe(960);
  expect(parsed.format).toBe(1);
  expect(parsed.tracks[0].find((e) => e.metaType === 81)?.data).toEqual([7, 161, 32]); // 500,000 us
  expect(parsed.tracks[1].filter((e) => [8, 9].includes(e.status >> 4))).toEqual([
    { tick: 0, status: 144, data: [60, 80] },
    { tick: 960, status: 128, data: [60, 0] },
  ]);
  expect(parsed.tracks[1].filter((e) => e.status >> 4 === 11).map((e) => e.data)).toEqual([
    [101, 0],
    [100, 0],
    [6, 12],
    [38, 0],
    [101, 127],
    [100, 127],
  ]);
});
it('rounds absolute boundaries half-up and omits even a 0.6-tick note when both boundaries collapse', () => {
  expect(quantizeTick(q(1n, 7680n))).toBe(1);
  const p = performance(1);
  p.sounding[0].position = q(3n, 19200n);
  p.sounding[0].duration = q(3n, 19200n);
  const result = exportMidi(p);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.diagnostics.some((d) => d.code === 'collapsed-note')).toBe(true);
    expect(
      readMidi(result.bytes)
        .tracks.flat()
        .filter((e) => e.status >> 4 === 9),
    ).toHaveLength(0);
  }
});
it('preflights three six-string parts and refuses sixteen melodic parts without producing bytes', () => {
  const result = exportMidi(performance(3, 6));
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.allocation.map((a) => a.channels.length)).toEqual([6, 6, 1]);
  expect(result.allocation[2].independent).toBe(false);
  expect(result.allocation.flatMap((a) => a.channels)).not.toContain(9);
  expect(exportMidi(performance(16))).toEqual({
    ok: false,
    diagnostics: [
      {
        code: 'channel-allocation',
        message: 'More than 15 melodic parts require channels; no MIDI file produced.',
      },
    ],
  });
});
it('orders releases and bend reset/setup before new attacks and clips exported curves', () => {
  const p = performance(1);
  p.sounding.push(note('b', 'p0s0', QUARTER));
  p.sounding[1].curve = [
    {
      kind: 'bend',
      points: [
        { offset: ZERO, cents: 1400 },
        { offset: q(1n, 100000n), cents: 1300 },
      ],
    },
  ];
  const result = exportMidi(p);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.diagnostics.some((d) => d.code === 'bend-clipped')).toBe(true);
  expect(result.diagnostics.some((d) => d.code === 'collapsed-curve')).toBe(true);
  const events = readMidi(result.bytes).tracks[1].filter((e) => e.tick === 960);
  expect(events[0].status >> 4).toBe(8);
  expect(events.at(-1)?.status >> 4).toBe(9);
  expect(events.filter((e) => e.status >> 4 === 14).at(-1)?.data).toEqual([127, 127]);
});
it('reserves channel 10 for declared kit sounds', () => {
  const p = performance(1);
  p.voices[0].kit = true;
  const result = exportMidi(p);
  expect(result.ok).toBe(true);
  if (result.ok)
    expect(
      readMidi(result.bytes)
        .tracks.flat()
        .find((e) => e.status >> 4 === 9)?.status,
    ).toBe(153);
});
it('combines independent bend and vibrato curves before quantization', () => {
  const p = performance(1);
  p.sounding[0].curve = [
    { kind: 'bend', points: [{ offset: ZERO, cents: 200 }] },
    { kind: 'vibrato', offset: ZERO, duration: QUARTER, period: QUARTER, depthCents: 25 },
  ];
  const result = exportMidi(p);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const bends = readMidi(result.bytes).tracks[1].filter(
    (e) => e.status >> 4 === 14 && e.tick === 240,
  );
  expect(bends.at(-1)?.data).toEqual([0, 76]); // 8192 + 225/1200 * 8192 = 9728
});
