// Builds and freezes the rung-2 (timbre) set outside git:
//   tsx src/ladder/prepareRung2.ts <frozen-002-set-dir> <ladder-dir> <tonejs-dir> <repo-samples-dir>
// Sample sets are split into development and held-out groups here, before any candidate
// runs. Sets that share an origin of recordings stay in the same group.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { writeWav } from '../generate/wav.ts';
import { encode } from '../io.ts';
import { validateGolden } from '../validate.ts';
import { asGolden, ladderGolden, type RungTwoRecipe } from './goldens.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha, type RungManifest } from './privateSets.ts';
import { durationSamples, maxPolyphony, noteLabels, scoreNotes, SAMPLE_RATE, type RungZeroRecipe } from './render.ts';
import { ATTACK_FRACTION, loadSet, mixSamples, PRE_ROLL, RELEASE_SAMPLES, SAMPLE_RENDERER_VERSION } from './samples.ts';
import { sampleSources } from './sources.ts';

const [proxyDir, ladderDir, tonejsDir, repoSamples] = process.argv.slice(2);
if (!proxyDir || !ladderDir || !tonejsDir || !repoSamples) throw new Error('Usage: tsx src/ladder/prepareRung2.ts <frozen-002-set-dir> <ladder-dir> <tonejs-dir> <repo-samples-dir>');
const { manifest: proxy, sha256: proxySha } = readProxySet(proxyDir);
const rung0 = readRungSet(join(ladderDir, 'rung-0'));
const out = join(requireOutsideGit(ladderDir), 'rung-2');
if (existsSync(out)) throw new Error('Rung 2 exists; a frozen set is never overwritten');

export const SOURCES = sampleSources(tonejsDir, repoSamples);

const winner = proxy.examples.find(e => e.id === 'winner-positive')!, dust = proxy.examples.find(e => e.id === 'winner-audio-dust-score')!;
const score = JSON.parse(readFileSync(winner.scorePath, 'utf8')) as MnxStructure;
const timing: RungZeroRecipe = { ...rung0.manifest.examples[0]!.golden.audio.recipe as RungZeroRecipe };
const notes = scoreNotes(score, timing), windowEnd = durationSamples(timing);
// Pad to a multiple of 3 samples so the duration is exact at the evaluator's 1e-9 s grid.
const length = Math.ceil(windowEnd / 3) * 3, duration = length / SAMPLE_RATE;
if (Math.round(duration * 1e9) / 1e9 !== duration) throw new Error('Duration is not exact at the evaluator grid precision');
const level = 10 ** (timing.peakDbfs / 20) / maxPolyphony(notes);
const set = 'winner-ladder-rung2-v1', cache = join(ladderDir, '..', 'samples', 'decoded-48k');

mkdirSync(out, { recursive: true });
const examples: RungManifest['examples'] = [], assets = [winner.scorePath, dust.scorePath];
const summary: string[] = [];
for (const source of SOURCES) {
  const loaded = loadSet(source, cache);
  const { pcm, shifts } = mixSamples(notes, loaded, length, level);
  const audioPath = join(out, `${source.group}-${source.id}.wav`);
  writeFileSync(audioPath, writeWav(pcm)); assets.push(audioPath, ...source.files.map(f => f.path));
  const shiftMax = Math.max(...shifts.map(Math.abs)), shiftMean = shifts.reduce((a, b) => a + Math.abs(b), 0) / shifts.length;
  const recipe: RungTwoRecipe = { ...timing, rung: 2, renderer: SAMPLE_RENDERER_VERSION, preRollSamples: PRE_ROLL, attackFraction: ATTACK_FRACTION, releaseSamples: RELEASE_SAMPLES, paddedSamples: length - windowEnd,
    samples: { id: source.id, name: source.name, source: source.source, licence: source.licence, attribution: source.attribution, origin: source.origin, files: source.files.length, shiftSemitones: { max: shiftMax, mean: shiftMean } } };
  const profile = { ...rung0.manifest.examples[0]!.golden.profile, harmonic: { level: 3, range: `Recorded guitar samples: ${source.name}; resampled at most ${shiftMax} semitones` } };
  const common = { set, recipe, duration, audioSha256: sha(readFileSync(audioPath)), notes: noteLabels(notes, recipe), profile, scoreOrigin: `F2msc score pinned by ${proxy.id} (${proxySha})` };
  const positive = ladderGolden({ ...common, example: 'positive', score: winner.scorePath });
  const wrong = ladderGolden({ ...common, example: 'wrong-score', score: dust.scorePath });
  positive.example = `${source.group}-${source.id}-positive`; wrong.example = `${source.group}-${source.id}-wrong-score`;
  examples.push({ id: positive.example, kind: 'positive', group: source.group, scorePath: winner.scorePath, audioPath, golden: positive });
  examples.push({ id: wrong.example, kind: 'wrong-score', group: source.group, scorePath: dust.scorePath, audioPath, golden: wrong });
  summary.push(`${source.group}/${source.id}: ${source.files.length} roots, shift max ${shiftMax} mean ${shiftMean.toFixed(2)} semitones`);
}
const silencePath = join(out, 'silence.wav');
writeFileSync(silencePath, writeWav(new Int16Array(length))); assets.push(silencePath);
const silenceRecipe = examples[0]!.golden.audio.recipe;
const silence = ladderGolden({ set, example: 'silence', recipe: silenceRecipe, duration, audioSha256: sha(readFileSync(silencePath)), score: winner.scorePath, notes: [], profile: rung0.manifest.examples[0]!.golden.profile, scoreOrigin: `F2msc score pinned by ${proxy.id}` });
examples.push({ id: 'silence', kind: 'silence', group: 'fixed', scorePath: winner.scorePath, audioPath: silencePath, golden: silence });
for (const e of examples) validateGolden(asGolden(e.golden));

const manifest: RungManifest = {
  id: set, version: 1, rung: 2, partition: 'development',
  seeds: { development: [], heldOut: [], note: `Sample sets are the independence unit. Development: ${SOURCES.filter(s => s.group === 'development').map(s => s.id).join(', ')}. Held out: ${SOURCES.filter(s => s.group === 'held-out').map(s => s.id).join(', ')}. The two Karoryfer sets share an origin and share a group.` },
  sourceSet: { id: proxy.id, sha256: proxySha }, maxPolyphony: maxPolyphony(notes), examples,
  assets: Object.fromEntries([...new Set(assets)].map(path => [path, sha(readFileSync(path))])),
};
const encoded = encode(manifest);
writeFileSync(join(out, 'manifest.json'), encoded);
writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(encoded), frozenBeforeCandidate: true }));
console.log(JSON.stringify({ out, set, sha256: sha(encoded), examples: examples.length, duration, sets: summary }, null, 2));
