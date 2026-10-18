import { it, expect } from 'vitest';
import { beatLabel, formatPlaybackPosition, measureAt, passesOf, playbackPositionParts, widestPlaceLabel, widestPlaybackPosition } from '../../src/audio/playbackPosition.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { rational as q, ZERO } from '../../src/audio/time.ts';
import fs from 'node:fs';
import type { MnxStructure } from '../../src/model/mnx.ts';
it('formats performed ordinals, written bar numbers, meter beats and inserted holds', () => {
  const doc = JSON.parse(
    fs.readFileSync('scenarios/spec/hello-world/document.mnx.json', 'utf8'),
  ) as MnxStructure;
  const result = compilePerformance(doc);
  if (!result.ok) throw new Error('compile failed');
  const p = result.performance;
  doc.global.measures[0]!.number = 5;
  expect(formatPlaybackPosition(p, q(1n, 2n), doc)).toBe('# 5.1 · beat 3');
  p.measures[0]!.occurrence = 2;
  p.sourceMap = [
    {
      kind: 'fermata',
      position: ZERO,
      duration: q(1n),
      metricPosition: ZERO,
      sources: [{ ordinal: 0, metricOffset: q(1n, 2n) }],
    },
  ];
  expect(formatPlaybackPosition(p, q(1n, 2n), doc)).toBe('# 5.2 · beat 3 · pass 2 of 2 · hold');
  expect(measureAt(p, q(1n))).toBeUndefined();
  expect(formatPlaybackPosition(p, q(1n), doc)).toBe('End');
});
it('reserves the widest label a performance can print, so the readout never resizes', () => {
  const doc = JSON.parse(
    fs.readFileSync('scenarios/spec/hello-world/document.mnx.json', 'utf8'),
  ) as MnxStructure;
  const result = compilePerformance(doc);
  if (!result.ok) throw new Error('compile failed');
  const p = result.performance;
  // One 4/4 bar: the last beat label is 4 and a fraction, and every label fits inside.
  expect(widestPlaybackPosition(p, doc)).toBe('# 1.1 · beat 4½');
  for (const num of [0n, 1n, 2n, 3n]) {
    const label = formatPlaybackPosition(p, q(num, 4n), doc);
    expect(label.length).toBeLessThanOrEqual(widestPlaybackPosition(p, doc).length);
  }
  doc.global.measures[0]!.number = 128;
  p.measures[0]!.occurrence = 3;
  p.sourceMap = [
    { kind: 'fermata', position: ZERO, duration: q(1n), metricPosition: ZERO, sources: [{ ordinal: 0, metricOffset: ZERO }] },
  ];
  expect(widestPlaybackPosition(p, doc)).toBe('# 128.3 · beat 4½ · pass 3 of 3 · hold');
  // The place alone, for a readout that reserves that segment by itself.
  expect(widestPlaceLabel(p, doc)).toBe('# 128.3 · beat 4½');
  expect(widestPlaceLabel({ ...p, measures: [] }, doc)).toBe('');
  expect(widestPlaybackPosition({ ...p, measures: [] }, doc)).toBe('Ready');
});
it('counts a bar\'s passes and lists them in performed order', () => {
  const doc = JSON.parse(
    fs.readFileSync('scenarios/spec/repeats/document.mnx.json', 'utf8'),
  ) as MnxStructure;
  const result = compilePerformance(doc);
  if (!result.ok) throw new Error('compile failed');
  const p = result.performance;
  // A bar under a repeat is visited twice; the readout says which pass this is.
  const repeated = p.measures.find((m) => m.occurrence === 2);
  if (!repeated) throw new Error('expected a repeated bar in scenarios/spec/repeats');
  expect(formatPlaybackPosition(p, repeated.position, doc)).toMatch(/pass 2 of 2/);
  const first = p.measures.find((m) => m.measureIndex === repeated.measureIndex && m.occurrence === 1)!;
  expect(passesOf(p, repeated.measureIndex)).toEqual([first, repeated]);
  expect(passesOf(p, 999)).toEqual([]);
  // The parts the tray renders the pass control from agree with the label.
  const parts = playbackPositionParts(p, repeated.position, doc)!;
  expect(parts.ordinal).toBe(repeated.ordinal);
  expect(parts.occurrence).toBe(2);
  expect(parts.occurrences).toBe(2);
  expect(formatPlaybackPosition(p, repeated.position, doc)).toBe(
    `# ${parts.bar}.2 · beat ${parts.beat} · pass 2 of 2`,
  );
  expect(playbackPositionParts(p, q(-1n), doc)).toBeNull();
});
it('names a beat by its written fraction, and a running playhead by its whole beat', () => {
  expect(beatLabel(q(1n))).toBe('1');
  expect(beatLabel(q(3n, 2n))).toBe('1½');
  expect(beatLabel(q(7n, 3n))).toBe('2⅓');
  expect(beatLabel(q(53n, 16n))).toBe('3⁵⁄₁₆');
  // Read off the clock's 2⁻²⁰ grid, a moving playhead never reduces to a written fraction.
  expect(beatLabel(q((3n << 20n) + 12345n, 1n << 20n))).toBe('3');
});
