import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { synthesize } from '../src/generate/sine.ts';
import { readWav } from '../src/generate/wav.ts';
import { freezeSet, generateSet } from '../src/generate/set.ts';
import { EXPERIMENT, json, readSet, sha256 } from '../src/io.ts';
it('generates all five pinned WAVs deterministically with labels at actual sample boundaries', () => {
  for (const { folder, golden } of readSet('harness-v1').examples) {
    const result = synthesize(json<MnxStructure>(join(folder, 'score.mnx.json')), golden.audio.recipe);
    expect(result.notes).toEqual(golden.labels.notes); expect(result.following).toEqual(golden.labels.following);
    expect(sha256(result.wav)).toBe(golden.audio.sha256);
    expect(result.wav.equals(synthesize(json<MnxStructure>(join(folder, 'score.mnx.json')), golden.audio.recipe).wav)).toBe(true);
    const pcm = readWav(result.wav); expect(pcm.length).toBe(golden.audio.duration * 48000);
    expect(result.wav.readUInt16LE(34)).toBe(16);
    const active = new Uint8Array(pcm.length);
    for (const note of result.notes) {
      const from = Math.round(note.onset * 48000), to = Math.round(note.audibleEnd * 48000);
      active.fill(1, from, to);
      expect(pcm[from]).toBe(0); expect(Math.abs(pcm[from + 480]!)).toBeGreaterThan(0);
      expect(pcm[to]).toBe(0);
      expect(to - from).toBe(golden.audio.recipe.parameters.bpm === 90 ? 16000 : 24000);
      // Positive zero crossings away from the ramps provide an independent pitch check.
      const crossings: number[] = [];
      for (let i = from + 481; i < to - 480; i++) if (pcm[i - 1]! <= 0 && pcm[i]! > 0) crossings.push(i);
      const measured = (crossings.length - 1) * 48000 / (crossings.at(-1)! - crossings[0]!);
      expect(Math.abs(measured - note.pitch.hz)).toBeLessThan(.1);
    }
    for (let i = 0; i < pcm.length; i++) if (!active[i] && pcm[i] !== 0) throw new Error('Sound outside labelled boundaries');
    expect(pcm.every(x => Math.abs(x) <= 10 ** (-12 / 20) + 1 / 32768)).toBe(true);
  }
});
it('refuses changed hashes and frozen scores without rewriting evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'listening-freeze-'));
  try {
    cpSync(join(EXPERIMENT, 'sets'), join(root, 'sets'), { recursive: true });
    cpSync(join(EXPERIMENT, 'generators'), join(root, 'generators'), { recursive: true });
    expect(generateSet('harness-v1', root)).toEqual(generateSet('harness-v1', root));
    freezeSet('harness-v1', root);
    const score = join(root, 'sets/harness-v1/p1/score.mnx.json');
    writeFileSync(score, readFileSync(score, 'utf8') + ' ');
    expect(() => generateSet('harness-v1', root)).toThrow('Frozen set content changed');
    expect(() => freezeSet('harness-v1', root)).toThrow('Frozen set content changed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
