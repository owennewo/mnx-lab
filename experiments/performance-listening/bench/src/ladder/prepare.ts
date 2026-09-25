// Builds and freezes the rung-0 set outside git:
//   tsx src/ladder/prepare.ts <frozen-002-set-dir> <ladder-dir>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { writeWav } from '../generate/wav.ts';
import { encode } from '../io.ts';
import { validateGolden } from '../validate.ts';
import { asGolden, ladderGolden } from './goldens.ts';
import { readProxySet, requireOutsideGit, sha, type RungManifest } from './privateSets.ts';
import { RENDERER_VERSION, SAMPLE_RATE, durationSamples, maxPolyphony, noteLabels, renderSines, scoreNotes, type RungZeroRecipe } from './render.ts';

const [proxyDir, ladderDir] = process.argv.slice(2);
if (!proxyDir || !ladderDir) throw new Error('Usage: tsx src/ladder/prepare.ts <frozen-002-set-dir> <ladder-dir>');
const { manifest: proxy, sha256: proxySha } = readProxySet(proxyDir);
const out = join(requireOutsideGit(ladderDir), 'rung-0');
if (existsSync(out)) throw new Error('Rung 0 exists; a frozen set is never overwritten');

const winner = proxy.examples.find(e => e.id === 'winner-positive')!;
const dust = proxy.examples.find(e => e.id === 'winner-audio-dust-score')!;
const score = JSON.parse(readFileSync(winner.scorePath, 'utf8')) as MnxStructure;
const recipe: RungZeroRecipe = {
  renderer: RENDERER_VERSION, rung: 0, bpm: proxy.nominalBpm, fromQuarter: 0, toQuarter: 16,
  sampleRate: SAMPLE_RATE, peakDbfs: -12, rampSeconds: 0.01,
};
const notes = scoreNotes(score, recipe);
const labels = noteLabels(notes, recipe);
const duration = durationSamples(recipe) / SAMPLE_RATE;
const polyphony = maxPolyphony(notes);
const midis = notes.map(n => n.midi);

mkdirSync(out, { recursive: true });
const positivePath = join(out, 'positive.wav'), silencePath = join(out, 'silence.wav');
writeFileSync(positivePath, writeWav(renderSines(notes, recipe)));
writeFileSync(silencePath, writeWav(new Int16Array(durationSamples(recipe))));
const positiveSha = sha(readFileSync(positivePath)), silenceSha = sha(readFileSync(silencePath));

const profile = {
  melodic: { level: 2, range: `MIDI ${Math.min(...midis)}–${Math.max(...midis)}, the score's own pitches` },
  polyphonic: { level: 2, range: `Up to ${polyphony} simultaneous notes: sustained bass under an arpeggio` },
  harmonic: { level: 1, range: 'Sine partial per note, no harmonics' },
  dynamics: { level: 1, range: 'Constant level per note' },
  rhythm: { level: 2, range: 'Eighth and longer notes at score durations; 10 ms linear attack and release' },
  tempo: { level: 1, range: `Constant ${recipe.bpm} BPM, equal to the handed tempo` },
  structuralAmbiguity: { level: 2, range: 'Real piece: repeated arpeggio patterns and shared bass notes across bars' },
  navigation: { level: 1, range: 'Known start at bar 1; continuous through bar 4' },
};
const common = { set: 'winner-ladder-rung0-v1', recipe, duration, profile, scoreOrigin: `F2msc score pinned by ${proxy.id} (${proxySha})` };
const examples: RungManifest['examples'] = [
  { id: 'positive', scorePath: winner.scorePath, audioPath: positivePath,
    golden: ladderGolden({ ...common, example: 'positive', audioSha256: positiveSha, score: winner.scorePath, notes: labels }) },
  { id: 'wrong-score', scorePath: dust.scorePath, audioPath: positivePath,
    golden: ladderGolden({ ...common, example: 'wrong-score', audioSha256: positiveSha, score: dust.scorePath, notes: labels }) },
  { id: 'silence', scorePath: winner.scorePath, audioPath: silencePath,
    golden: ladderGolden({ ...common, example: 'silence', audioSha256: silenceSha, score: winner.scorePath, notes: [] }) },
];
for (const e of examples) validateGolden(asGolden(e.golden));

const assets = [winner.scorePath, dust.scorePath, positivePath, silencePath];
const manifest: RungManifest = {
  id: common.set, version: 1, rung: 0, partition: 'development',
  seeds: { development: [], heldOut: [], note: 'Rung 0 is deterministic: its one example is both its development and held-out evidence.' },
  sourceSet: { id: proxy.id, sha256: proxySha }, maxPolyphony: polyphony, examples,
  assets: Object.fromEntries(assets.map(path => [path, sha(readFileSync(path))])),
};
const encoded = encode(manifest);
writeFileSync(join(out, 'manifest.json'), encoded);
writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(encoded), frozenBeforeCandidate: true }));
console.log(JSON.stringify({ out, set: manifest.id, sha256: sha(encoded), notes: notes.length, maxPolyphony: polyphony, duration, bpm: recipe.bpm }, null, 2));
