import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  SAMPLE_PRESETS,
  selectSample,
  type InstrumentSample,
} from '../../src/audio/sampleSelection.ts';

const pack = path.resolve('public/samples/shinyguitar-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'));
const samples: InstrumentSample[] = manifest.samples;
it('pins the shipped CC0 assets, source receipts and complete layer/take coverage', () => {
  expect(fs.readFileSync(path.join(pack, 'LICENSE'), 'utf8')).toContain('CC0 1.0 Universal');
  expect(manifest.revision).toBe('57243cca85277dbcc120ce17c6178032f93c80f3');
  for (const sample of manifest.samples) {
    const bytes = fs.readFileSync(path.join(pack, sample.file));
    expect(bytes.subarray(0, 4).toString()).toBe('fLaC');
    expect(bytes.length).toBe(sample.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sample.sha256);
    expect(sample.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  }
  for (const midi of new Set(samples.map((s) => s.midi)))
    expect(samples.filter((s) => s.midi === midi).map((s) => [s.layer, s.take])).toEqual([
      [2, 1],
      [2, 2],
      [4, 1],
      [4, 2],
    ]);
  expect(
    manifest.samples.reduce((total: number, s: { bytes: number }) => total + s.bytes, 0),
  ).toBeLessThan(4_000_000);
});
it('selects nearby roots and velocity layers while alternating independently addressed attacks', () => {
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  expect(selectSample(samples, hz(41), 0.3, 0)).toMatchObject({
    midi: 40,
    layer: 2,
    take: 1,
  });
  expect(selectSample(samples, hz(41), 0.8, 1)).toMatchObject({
    midi: 40,
    layer: 4,
    take: 2,
  });
  expect(selectSample(samples, hz(41), 0.8, 2)).toMatchObject({
    midi: 40,
    layer: 4,
    take: 1,
  });
  expect(selectSample(samples, hz(69), 0.8, 0)).toMatchObject({ midi: 69 });
  // The nearest edge is transposed; sounded pitch is never clamped to the pack.
  expect(selectSample(samples, hz(24), 0.8, 0).midi).toBe(37);
  expect(selectSample(samples, hz(96), 0.8, 0).midi).toBe(84);
});

// Every pack EXCEPT the archtop, which the two tests above cover in detail.
// Selected by id, not by position: this list was sliced positionally until the
// piano was added at its head, which silently swapped which pack was skipped.
for (const preset of SAMPLE_PRESETS.filter((p) => p.id !== 'guitar')) {
  it(preset.label + ' pins a distinct CC0 source and every converted sample', () => {
    const directory = path.resolve('public/samples', preset.directory);
    const source = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    expect(fs.readFileSync(path.join(directory, 'LICENSE'), 'utf8')).toContain('CC0 1.0 Universal');
    expect(fs.readFileSync(path.join(directory, 'SOURCE.txt'), 'utf8')).toContain('CC0');
    expect(source.repository).not.toBe(manifest.repository);
    expect(source.gain).toBeGreaterThan(0);
    expect(source.samples.length).toBeGreaterThanOrEqual(13);
    for (const sample of source.samples) {
      const bytes = fs.readFileSync(path.join(directory, sample.file));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sample.sha256);
      expect(bytes.length).toBe(sample.bytes);
      expect(sample.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect([sample.layer, sample.take]).toEqual([4, 1]);
    }
    // A single-layer source still responds to soft notes without inventing recordings.
    expect(selectSample(source.samples, 440, 0.1, 5).file).toBe(
      selectSample(source.samples, 440, 0.9, 0).file,
    );
    // Per SAMPLE, not per pack. A flat pack cap read as a size budget but was
    // really a root-count cap, and it broke the moment a pack covered more of
    // the keyboard: the piano's 26 roots span MIDI 24-107 against a guitar's
    // 13-15 over 36-85. What actually guards against bloat is the weight of an
    // individual recording — the conversion recipe's mono 24 kHz s16 at up to
    // eight seconds.
    const bytes = source.samples.reduce((n: number, s: { bytes: number }) => n + s.bytes, 0);
    expect(bytes / source.samples.length).toBeLessThan(120_000);
  });
}

it('keeps the whole sample tree inside the deploy budget', () => {
  // The number that actually matters: every pack ships as static files beside
  // both build faces, on a free Workers plan with no object store behind it.
  let total = 0;
  for (const preset of SAMPLE_PRESETS) {
    const directory = path.resolve('public/samples', preset.directory);
    for (const file of fs.readdirSync(directory))
      total += fs.statSync(path.join(directory, file)).size;
  }
  expect(total).toBeLessThan(12_000_000);
});

it('gives the piano the range no guitar pack has', () => {
  // Why a piano earns its place beside four guitars: it is the only pack that
  // covers the staff at both ends, so a keyboard or vocal score is transposed
  // to a root near it rather than to the edge of a guitar's compass.
  const piano = JSON.parse(
    fs.readFileSync(path.resolve('public/samples/upright-piano-v1/manifest.json'), 'utf8'),
  );
  const roots = piano.samples.map((s: InstrumentSample) => s.midi);
  expect(Math.min(...roots)).toBeLessThan(36);
  expect(Math.max(...roots)).toBeGreaterThan(85);
  expect(new Set(roots).size).toBe(piano.samples.length);
});
