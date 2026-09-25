// Builds and freezes the rung-1 (tempo) set outside git:
//   tsx src/ladder/prepareRung1.ts <frozen-002-set-dir> <ladder-dir>
// Seeds are split into development and held-out groups here, before any candidate runs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { writeWav } from '../generate/wav.ts';
import { encode } from '../io.ts';
import { validateGolden } from '../validate.ts';
import { ALLOWANCE, asGolden, ladderGolden, type RungOneRecipe } from './goldens.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha, type RungManifest } from './privateSets.ts';
import { RENDERER_VERSION, SAMPLE_RATE, maxPolyphony, mixSines, noteLabels, windowNotes } from './render.ts';
import { SEGMENT_QUARTERS, tempoCurve, tempoFollowing, timeMap, type TempoFamily } from './tempo.ts';

export const RUNG_1_SEEDS: { group: 'development' | 'held-out'; family: TempoFamily; seed: number }[] = [
  { group: 'development', family: 'constant', seed: 1 }, { group: 'development', family: 'constant', seed: 2 },
  { group: 'development', family: 'ramp', seed: 3 }, { group: 'development', family: 'ramp', seed: 4 },
  { group: 'development', family: 'drift', seed: 5 }, { group: 'development', family: 'drift', seed: 6 },
  { group: 'held-out', family: 'constant', seed: 101 }, { group: 'held-out', family: 'constant', seed: 102 },
  { group: 'held-out', family: 'ramp', seed: 103 }, { group: 'held-out', family: 'ramp', seed: 104 },
  { group: 'held-out', family: 'drift', seed: 105 }, { group: 'held-out', family: 'drift', seed: 106 },
];

const [proxyDir, ladderDir] = process.argv.slice(2);
if (!proxyDir || !ladderDir) throw new Error('Usage: tsx src/ladder/prepareRung1.ts <frozen-002-set-dir> <ladder-dir>');
const { manifest: proxy, sha256: proxySha } = readProxySet(proxyDir);
const rung0 = readRungSet(join(ladderDir, 'rung-0'));
const out = join(requireOutsideGit(ladderDir), 'rung-1');
if (existsSync(out)) throw new Error('Rung 1 exists; a frozen set is never overwritten');

const winner = proxy.examples.find(e => e.id === 'winner-positive')!, dust = proxy.examples.find(e => e.id === 'winner-audio-dust-score')!;
const score = JSON.parse(readFileSync(winner.scorePath, 'utf8')) as MnxStructure;
const fromQuarter = 0, toQuarter = 16, handed = proxy.nominalBpm, segments = (toQuarter - fromQuarter) / SEGMENT_QUARTERS;
const set = 'winner-ladder-rung1-v1';
const profileFor = (bpms: number[]) => ({
  ...rung0.manifest.examples[0]!.golden.profile,
  tempo: { level: 2, range: `Whole-BPM tempo per eighth note, ${Math.min(...bpms)}–${Math.max(...bpms)} BPM; handed ${handed} BPM` },
});

mkdirSync(out, { recursive: true });
const examples: RungManifest['examples'] = [], assets = [winner.scorePath, dust.scorePath];
let longest = 0, polyphony = 0;
for (const { group, family, seed } of RUNG_1_SEEDS) {
  const bpms = tempoCurve(family, seed, handed, segments);
  const map = timeMap(bpms, fromQuarter, SAMPLE_RATE);
  const length = map.toSample(toQuarter), duration = length / SAMPLE_RATE;
  const recipe: RungOneRecipe = { renderer: RENDERER_VERSION, rung: 1, bpm: handed, fromQuarter, toQuarter, sampleRate: SAMPLE_RATE, peakDbfs: -12, rampSeconds: 0.01,
    tempo: { family, seed, segmentQuarters: SEGMENT_QUARTERS, bpms } };
  const notes = windowNotes(score, fromQuarter, toQuarter, map.toSample, length, recipe.rampSeconds * SAMPLE_RATE);
  const labels = noteLabels(notes, recipe);
  polyphony = Math.max(polyphony, maxPolyphony(notes)); longest = Math.max(longest, length);
  const name = `${group}-${family}-${seed}`, audioPath = join(out, `${name}.wav`);
  writeFileSync(audioPath, writeWav(mixSines(notes, length, recipe.peakDbfs, recipe.rampSeconds * SAMPLE_RATE, SAMPLE_RATE)));
  const audioSha256 = sha(readFileSync(audioPath)); assets.push(audioPath);
  const common = { set, recipe, duration, audioSha256, notes: labels, profile: profileFor(bpms), scoreOrigin: `F2msc score pinned by ${proxy.id} (${proxySha})` };
  const positive = ladderGolden({ ...common, example: 'positive', score: winner.scorePath });
  positive.labels.following = tempoFollowing(bpms, fromQuarter, SAMPLE_RATE, duration, Math.min(...labels.map(l => l.onset)) + ALLOWANCE, positive.labels.following[0]!.provenance);
  positive.example = `${name}-positive`;
  const wrong = ladderGolden({ ...common, example: 'wrong-score', score: dust.scorePath });
  wrong.example = `${name}-wrong-score`;
  examples.push({ id: positive.example, kind: 'positive', group, scorePath: winner.scorePath, audioPath, golden: positive });
  examples.push({ id: wrong.example, kind: 'wrong-score', group, scorePath: dust.scorePath, audioPath, golden: wrong });
}
const silencePath = join(out, 'silence.wav');
writeFileSync(silencePath, writeWav(new Int16Array(longest))); assets.push(silencePath);
const silenceRecipe: RungOneRecipe = { renderer: RENDERER_VERSION, rung: 1, bpm: handed, fromQuarter, toQuarter, sampleRate: SAMPLE_RATE, peakDbfs: -12, rampSeconds: 0.01, tempo: { family: 'constant', seed: 0, segmentQuarters: SEGMENT_QUARTERS, bpms: [] } };
const silence = ladderGolden({ set, example: 'silence', recipe: silenceRecipe, duration: longest / SAMPLE_RATE, audioSha256: sha(readFileSync(silencePath)), score: winner.scorePath, notes: [], profile: rung0.manifest.examples[0]!.golden.profile, scoreOrigin: `F2msc score pinned by ${proxy.id}` });
examples.push({ id: 'silence', kind: 'silence', group: 'fixed', scorePath: winner.scorePath, audioPath: silencePath, golden: silence });
for (const e of examples) validateGolden(asGolden(e.golden));

const manifest: RungManifest = {
  id: set, version: 1, rung: 1, partition: 'development',
  seeds: { development: RUNG_1_SEEDS.filter(s => s.group === 'development').map(s => s.seed), heldOut: RUNG_1_SEEDS.filter(s => s.group === 'held-out').map(s => s.seed), note: 'Split before any candidate ran; the rung passes on held-out seeds.' },
  sourceSet: { id: proxy.id, sha256: proxySha }, maxPolyphony: polyphony, examples,
  assets: Object.fromEntries(assets.map(path => [path, sha(readFileSync(path))])),
};
const encoded = encode(manifest);
writeFileSync(join(out, 'manifest.json'), encoded);
writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(encoded), frozenBeforeCandidate: true }));
console.log(JSON.stringify({ out, set, sha256: sha(encoded), examples: examples.length,
  curves: RUNG_1_SEEDS.map(s => { const b = tempoCurve(s.family, s.seed, handed, segments); return `${s.group}/${s.family}/${s.seed}: ${Math.min(...b)}–${Math.max(...b)} BPM`; }) }, null, 2));
