import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  GUITAR_PRESETS,
  selectGuitarSample,
  type GuitarSample,
} from '../../src/audio/sampleSelection.ts';

const pack = path.resolve('public/samples/shinyguitar-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'));
const samples: GuitarSample[] = manifest.samples;
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
  expect(selectGuitarSample(samples, hz(41), 0.3, 0)).toMatchObject({
    midi: 40,
    layer: 2,
    take: 1,
  });
  expect(selectGuitarSample(samples, hz(41), 0.8, 1)).toMatchObject({
    midi: 40,
    layer: 4,
    take: 2,
  });
  expect(selectGuitarSample(samples, hz(41), 0.8, 2)).toMatchObject({
    midi: 40,
    layer: 4,
    take: 1,
  });
  expect(selectGuitarSample(samples, hz(69), 0.8, 0)).toMatchObject({ midi: 69 });
  // The nearest edge is transposed; sounded pitch is never clamped to the pack.
  expect(selectGuitarSample(samples, hz(24), 0.8, 0).midi).toBe(37);
  expect(selectGuitarSample(samples, hz(96), 0.8, 0).midi).toBe(84);
});

for (const preset of GUITAR_PRESETS.slice(1)) {
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
    expect(selectGuitarSample(source.samples, 440, 0.1, 5).file).toBe(
      selectGuitarSample(source.samples, 440, 0.9, 0).file,
    );
    expect(source.samples.reduce((n: number, s: { bytes: number }) => n + s.bytes, 0)).toBeLessThan(
      1_500_000,
    );
  });
}
