import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RenderedNote } from './render.ts';
import { sha } from './privateSets.ts';

/** Rung 2: timbre. The same notes and exact timing as rung 0, sounded by recorded
 * guitar samples instead of sines. Each note uses the sample whose root is nearest its
 * pitch, resampled to the exact pitch, starting at the sample's attack and ending at the
 * note's score end with a short release. */
export const SAMPLE_RENDERER_VERSION = 'sample-render@1';
export const PRE_ROLL = 96;          // 2 ms of the sample kept before its detected attack
export const ATTACK_FRACTION = 0.1;  // attack: first sample reaching 10% of the sample's peak
export const RELEASE_SAMPLES = 1440; // 30 ms linear release ending at the note's end

export interface SampleSource {
  id: string; name: string; source: string; licence: string; attribution: string;
  group: 'development' | 'held-out';
  /** Origin of the recordings, so sets sharing one are grouped together. */
  origin: string;
  files: { midi: number; path: string; sha256: string }[];
}

const NAMES: Record<string, number> = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
/** tonejs-instruments names files like Cs3.wav; scientific pitch, A4 = 69. */
export function tonejsMidi(file: string): number {
  const m = /^([A-G]s?)(-?\d)\.wav$/.exec(file);
  if (!m || NAMES[m[1]!] === undefined) throw new Error(`Unrecognised sample name ${file}`);
  return 12 * (Number(m[2]) + 1) + NAMES[m[1]!]!;
}

/** Decodes any file ffmpeg reads into 48 kHz mono, normalised to a peak of 1. Cached. */
export function decode(path: string, cacheDir: string): Float64Array {
  mkdirSync(cacheDir, { recursive: true });
  const cached = join(cacheDir, `${sha(readFileSync(path))}.s16`);
  if (!existsSync(cached)) {
    writeFileSync(cached, execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', '48000', '-f', 's16le', '-acodec', 'pcm_s16le', '-'], { maxBuffer: 1 << 28 }));
  }
  const bytes = readFileSync(cached);
  const x = Float64Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readInt16LE(2 * i) / 32768);
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (!peak) throw new Error(`Silent sample ${path}`);
  return x.map(v => v / peak);
}

export interface LoadedSample { root: number; audio: Float64Array; start: number }
export function loadSet(source: SampleSource, cacheDir: string): LoadedSample[] {
  return source.files.map(f => {
    if (sha(readFileSync(f.path)) !== f.sha256) throw new Error(`Sample changed: ${f.path}`);
    const audio = decode(f.path, cacheDir);
    const attack = audio.findIndex(v => Math.abs(v) >= ATTACK_FRACTION);
    return { root: f.midi, audio, start: Math.max(0, attack - PRE_ROLL) };
  }).sort((a, b) => a.root - b.root);
}

/** Nearest root; on a tie, the lower root, so shifting is upward. */
export function nearest(samples: readonly LoadedSample[], midi: number): LoadedSample {
  return samples.reduce((best, s) => Math.abs(s.root - midi) < Math.abs(best.root - midi) ? s : best);
}

export function mixSamples(notes: readonly RenderedNote[], samples: readonly LoadedSample[], length: number, level: number): { pcm: Int16Array; shifts: number[] } {
  const mix = new Float64Array(length), shifts: number[] = [];
  for (const n of notes) {
    const s = nearest(samples, n.midi), ratio = 2 ** ((n.midi - s.root) / 12);
    shifts.push(n.midi - s.root);
    for (let i = n.fromSample; i < n.toSample; i++) {
      const position = s.start + (i - n.fromSample) * ratio, k = Math.floor(position), f = position - k;
      const a = s.audio[k] ?? 0, b = s.audio[k + 1] ?? 0;
      const release = Math.min(1, (n.toSample - i) / RELEASE_SAMPLES);
      mix[i]! += level * release * (a + (b - a) * f);
    }
  }
  const peak = mix.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (peak > 1) throw new Error('Sampled mix clips');
  return { pcm: Int16Array.from(mix, x => Math.round(32767 * x)), shifts };
}
