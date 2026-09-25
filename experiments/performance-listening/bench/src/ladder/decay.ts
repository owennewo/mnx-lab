// Measures how fast the development guitars decay, to fix the plucked reference's decay:
//   tsx src/ladder/decay.ts <frozen-002-set-dir> <ladder-dir> <tonejs-dir> <repo-samples-dir>
// Uses only the development sample sets, and only the samples Winner's notes would use.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { readProxySet, readRungSet } from './privateSets.ts';
import { scoreNotes, type RungZeroRecipe } from './render.ts';
import { loadSet, nearest } from './samples.ts';
import { sampleSources } from './sources.ts';

/** Time constant of an exponential fitted to the RMS envelope, 50 ms to 1 s after the peak. */
export function decaySeconds(audio: Float64Array, start: number): number {
  const frame = 960, from = start;
  let peakAt = from;
  for (let i = from; i < Math.min(audio.length, from + 4800); i++) if (Math.abs(audio[i]!) > Math.abs(audio[peakAt]!)) peakAt = i;
  const xs: number[] = [], ys: number[] = [];
  for (let t = peakAt + 2400; t + frame <= Math.min(audio.length, peakAt + 48000); t += frame) {
    let e = 0; for (let i = t; i < t + frame; i++) e += audio[i]! ** 2;
    const rms = Math.sqrt(e / frame);
    if (rms > 1e-4) { xs.push((t - peakAt) / 48000); ys.push(Math.log(rms)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return -1 / slope;
}

const [proxyDir, ladderDir, tonejsDir, repoSamples] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('decay.ts')) {
  if (!proxyDir || !ladderDir || !tonejsDir || !repoSamples) throw new Error('Usage: tsx src/ladder/decay.ts <frozen-002-set-dir> <ladder-dir> <tonejs-dir> <repo-samples-dir>');
  const { manifest: proxy } = readProxySet(proxyDir);
  const timing = readRungSet(join(ladderDir, 'rung-0')).manifest.examples[0]!.golden.audio.recipe as RungZeroRecipe;
  const score = JSON.parse(readFileSync(proxy.examples.find(e => e.id === 'winner-positive')!.scorePath, 'utf8')) as MnxStructure;
  const midis = [...new Set(scoreNotes(score, timing).map(n => n.midi))];
  const perSet: Record<string, number> = {}, all: number[] = [];
  for (const source of sampleSources(tonejsDir, repoSamples).filter(s => s.group === 'development')) {
    const loaded = loadSet(source, join(ladderDir, '..', 'samples', 'decoded-48k'));
    const taus = [...new Set(midis.map(m => nearest(loaded, m)))].map(s => decaySeconds(s.audio, s.start)).filter(t => Number.isFinite(t) && t > 0);
    taus.sort((a, b) => a - b); perSet[source.id] = taus[Math.floor(taus.length / 2)]!; all.push(...taus);
  }
  all.sort((a, b) => a - b);
  console.log(JSON.stringify({ samples: all.length, medianSeconds: all[Math.floor(all.length / 2)], quartiles: [all[Math.floor(all.length / 4)], all[Math.floor(3 * all.length / 4)]], perSetMedian: perSet }, null, 2));
}
