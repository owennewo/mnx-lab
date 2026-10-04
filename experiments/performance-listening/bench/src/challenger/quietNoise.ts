/** 038 fixed stimulus only. No listener threshold or evaluator is changed. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWav, writeWav } from '../generate/wav.ts';
import { encode } from '../io.ts';
import { sha } from '../ladder/privateSets.ts';
import { assetPath, type StageExample2 } from '../stages/stage1v2.ts';
import { validateLabel } from '../events/label.ts';
export const NOISE_SET = 'contract2-challenger-guitar-noise-v1';
export const NOISE_SEED = 380038;
export function levels(x: Float32Array) {
  let sum = 0, square = 0, peak = 0;
  for (const v of x) { sum += v; square += v * v; peak = Math.max(peak, Math.abs(v)); }
  return { samples: x.length, mean: sum / x.length, rms: Math.sqrt(square / x.length), rmsDbfs: 10 * Math.log10(square / x.length), peak };
}
export function normalizeNoise(x: Float32Array): Buffer {
  assert(x.length > 0 && x.every(Number.isFinite));
  const mean = levels(x).mean;
  let square = 0; for (const v of x) square += (v - mean) ** 2;
  assert(square > 0, 'Noise must have nonzero centered energy');
  const scale = .001 / Math.sqrt(square / x.length), pcm = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) { const v = Math.round((x[i]! - mean) * scale * 32768); assert(v >= -32768 && v <= 32767); pcm[i] = v; }
  const wav = writeWav(pcm), measured = levels(readWav(wav));
  assert(Math.abs(measured.rmsDbfs + 60) <= .01, `Noise level ${measured.rmsDbfs}`); assert(measured.peak < 1);
  return wav;
}
export function freezeQuietNoise(root: string, original: { examples: StageExample2[]; assets: Record<string, string> }, parentHash: string) {
  const dir = join(root, NOISE_SET); assert(!existsSync(dir), 'Never overwrite frozen noise'); mkdirSync(dir);
  const lengths = [...new Set(original.examples.filter(e => e.kind === 'performance').map(e => e.label.audio!.samples))].sort((a, b) => a - b);
  const max = lengths.at(-1)!;
  const args = ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `anoisesrc=color=pink:sample_rate=48000:amplitude=1:seed=${NOISE_SEED}:nb_samples=1024`, '-af', `atrim=end_sample=${max}`, '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1'];
  const raw = execFileSync('ffmpeg', args, { maxBuffer: 32 << 20 }); assert.equal(raw.length, max * 4);
  assert.equal(sha(execFileSync('ffmpeg', args, { maxBuffer: 32 << 20 })), sha(raw), 'Generator reproducibility');
  const stream = Float32Array.from({ length: max }, (_, i) => raw.readFloatLE(i * 4));
  const rawPath = join(dir, 'pink-stream.f32'); writeFileSync(rawPath, raw, { flag: 'wx' });
  const binaryPath = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim();
  const generator = { name: 'FFmpeg anoisesrc pink', seed: NOISE_SEED, args, version: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0],
    binary: { path: binaryPath, sha256: sha(readFileSync(binaryPath)) }, raw: { path: rawPath, sha256: sha(raw) }, sampleRate: 48000,
    rmsDbfs: -60, normalization: 'per-length prefix, mean removed, centered RMS scaled to .001, Math.round to PCM16', repeatedRawHashAgrees: true };
  const wavs = new Map<number, { path: string; sha256: string; levels: ReturnType<typeof levels> }>();
  const assets: Record<string, string> = { [rawPath]: sha(raw) };
  for (const n of lengths) { const path = join(dir, `pink-${n}.wav`), bytes = normalizeNoise(stream.subarray(0, n)); writeFileSync(path, bytes, { flag: 'wx' });
    const hash = sha(bytes); wavs.set(n, { path, sha256: hash, levels: levels(readWav(bytes)) }); assets[path] = hash; }
  const examples = original.examples.map(e => {
    if (e.control !== 'silence') { assets[e.scorePath] = original.assets[e.scorePath]!; assets[e.audioPath] = original.assets[e.audioPath]!; return e; }
    const a = wavs.get(e.label.audio!.samples)!, label = structuredClone(e.label), id = `noise-${e.of}`;
    label.id = id; label.audio = { ...label.audio!, path: a.path, sha256: a.sha256 };
    label.provenance = { kind: 'generated', recipe: { ...label.provenance.recipe as object, noiseGenerator: generator.name, noiseSeed: NOISE_SEED, rmsDbfs: -60 },
      note: 'Fixed quiet pink-noise silence control: no performed score event; length equals parent performance.' };
    validateLabel(label); assets[e.scorePath] = sha(readFileSync(assetPath(e.scorePath)));
    return { ...e, id, audioPath: a.path, label };
  });
  const manifest = { id: NOISE_SET, version: 1, partition: 'development', parentManifestSha256: parentHash, generator,
    levels: [...wavs.values()], examples, assets };
  const bytes = encode(manifest); writeFileSync(join(dir, 'manifest.json'), bytes, { flag: 'wx' });
  writeFileSync(join(dir, 'freeze.json'), encode({ sha256: sha(bytes), frozenBeforeInference: true }), { flag: 'wx' });
  return manifest;
}
