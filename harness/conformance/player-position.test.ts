import { it, expect } from 'vitest';
import { formatPlaybackPosition, measureAt, siblingVisits, widestPlaybackPosition } from '../../src/audio/playbackPosition.ts';
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
  expect(formatPlaybackPosition(p, q(1n, 2n), doc)).toBe('bar 5 · iteration 1 of 1 · beat 3');
  p.measures[0]!.iteration = 2;
  p.sourceMap = [
    {
      kind: 'fermata',
      position: ZERO,
      duration: q(1n),
      metricPosition: ZERO,
      sources: [{ ordinal: 0, metricOffset: q(1n, 2n) }],
    },
  ];
  expect(formatPlaybackPosition(p, q(1n, 2n), doc)).toBe('bar 5 · iteration 2 of 2 · beat 3 · hold');
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
  // One 4/4 bar: the last beat label is 4.x, and every label fits inside.
  expect(widestPlaybackPosition(p, doc)).toBe('bar 1 · iteration 1 of 1 · beat 4.5');
  for (const num of [0n, 1n, 2n, 3n]) {
    const label = formatPlaybackPosition(p, q(num, 4n), doc);
    expect(label.length).toBeLessThanOrEqual(widestPlaybackPosition(p, doc).length);
  }
  doc.global.measures[0]!.number = 128;
  p.measures[0]!.iteration = 3;
  p.sourceMap = [
    { kind: 'fermata', position: ZERO, duration: q(1n), metricPosition: ZERO, sources: [{ ordinal: 0, metricOffset: ZERO }] },
  ];
  expect(widestPlaybackPosition(p, doc)).toBe('bar 128 · iteration 3 of 3 · beat 4.5 · hold');
  expect(widestPlaybackPosition({ ...p, measures: [] }, doc)).toBe('Ready');
});
it('counts a bar\'s passes and steps between them by performed order', () => {
  const doc = JSON.parse(
    fs.readFileSync('scenarios/spec/repeats/document.mnx.json', 'utf8'),
  ) as MnxStructure;
  const result = compilePerformance(doc);
  if (!result.ok) throw new Error('compile failed');
  const p = result.performance;
  // A bar under a repeat is visited twice; the readout says which pass this is.
  const repeated = p.measures.find((m) => m.iteration === 2);
  if (!repeated) throw new Error('expected a repeated bar in scenarios/spec/repeats');
  expect(formatPlaybackPosition(p, repeated.position, doc)).toMatch(/iteration 2 of 2/);
  const first = p.measures.find((m) => m.measureIndex === repeated.measureIndex && m.iteration === 1)!;
  expect(siblingVisits(p, first.ordinal)).toEqual({ prev: null, next: repeated });
  expect(siblingVisits(p, repeated.ordinal)).toEqual({ prev: first, next: null });
  expect(siblingVisits(p, 999)).toEqual({ prev: null, next: null });
});
