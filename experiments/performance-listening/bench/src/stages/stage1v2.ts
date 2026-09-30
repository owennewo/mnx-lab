// Renders and freezes contract 2's stage 1 with its controls, outside git:
//   tsx src/stages/stage1v2.ts <data-root>
// The eight perfect, steady sine performances of stage 1 (s1, s2 handed 90, played at
// 45/63/90/99), rendered by the same code as contract2-stage1-v1 and labelled as
// performance-label@2; beside each, a silence control of the same length and a
// wrong-score control (its audio handed w1). Records whether each performance's audio is
// byte-identical to v1's. A frozen set is never overwritten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { writeWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { mixSines, RENDERER_VERSION, SAMPLE_RATE, windowNotes } from '../ladder/render.ts';
import { controlLabel, LABEL_FORMAT_2, perfectLabel, type PerformanceLabel, writesDeadNotes } from '../events/label.ts';
import { HANDED, SCORES, STAGE_1_SET, type StageManifest, TEMPI, totalQuarters } from './stage1.ts';

export const STAGE_1_SET_2 = 'contract2-stage1-v2';
export const WRONG_SCORE = { id: 'w1', path: 'sources/w1-two-bar-black-keys.mnx.json' } as const;
const PEAK_DBFS = -12, RAMP_SECONDS = 0.01;

export interface StageExample2 {
  id: string; kind: 'performance' | 'control'; control: 'silence' | 'wrong-score' | null; of: string;
  /** Relative to the experiment; resolve with `assetPath`. */
  score: string; scorePath: string; tempo: number; audioPath: string; label: PerformanceLabel;
}
export interface StageManifest2 {
  id: string; version: 2; stage: 1; partition: 'development'; handedQuartersPerMinute: number;
  recipe: { renderer: string; synth: 'sine'; peakDbfs: number; rampSeconds: number; sampleRate: number; labels: typeof LABEL_FORMAT_2; note: string };
  examples: StageExample2[];
  identicalToV1: Record<string, boolean>;
  assets: Record<string, string>;
}

/** Scores are named relative to the experiment, so a set outlives the worktree that made
 * it (contract2-stage1-v1 named them by absolute path, in a worktree since removed);
 * private audio is named by absolute path. */
export const assetPath = (path: string) => isAbsolute(path) ? path : resolve(EXPERIMENT, path);

/** A frozen stage set, verified byte for byte before any use. */
export function readStageSet2(dir: string): { manifest: StageManifest2; sha256: string } {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  if (sha(bytes) !== JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256) throw new Error('Stage set changed since freezing');
  const manifest = JSON.parse(bytes.toString('utf8')) as StageManifest2;
  if (manifest.version !== 2) throw new Error('Not a version-2 stage set');
  for (const [path, hash] of Object.entries(manifest.assets)) if (sha(readFileSync(assetPath(path))) !== hash) throw new Error(`Stage asset changed: ${path}`);
  return { manifest, sha256: sha(bytes) };
}

/** Version 1's audio hashes, from its frozen manifest and its WAV bytes, without its score
 * assets, whose absolute paths no longer exist. */
function v1AudioHashes(dir: string): Record<string, string> {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  if (sha(bytes) !== JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256) throw new Error('contract2-stage1-v1 changed since freezing');
  const manifest = JSON.parse(bytes.toString('utf8')) as StageManifest;
  return Object.fromEntries(manifest.examples.map(e => {
    const recorded = e.label.audio!.sha256;
    if (sha(readFileSync(join(dir, `${e.id}.wav`))) !== recorded) throw new Error(`${e.id}.wav in contract2-stage1-v1 changed since freezing`);
    return [e.id, recorded];
  }));
}

const compile = (path: string) => {
  const bytes = readFileSync(path), score = JSON.parse(bytes.toString('utf8')) as MnxStructure, compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error(`${path} does not compile cleanly`);
  if (writesDeadNotes(score)) throw new Error(`${path} writes dead notes, which a sine rendering cannot perform`);
  return { bytes, score, performance: compiled.performance };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: tsx src/stages/stage1v2.ts <data-root>');
  const out = join(requireOutsideGit(root), STAGE_1_SET_2);
  if (existsSync(out)) throw new Error(`${out} exists; a frozen set is never overwritten`);
  const v1 = v1AudioHashes(join(root, STAGE_1_SET));
  const wrongPath = WRONG_SCORE.path, wrong = compile(assetPath(wrongPath));
  mkdirSync(out, { recursive: true });
  const examples: StageExample2[] = [], assets: Record<string, string> = { [wrongPath]: sha(wrong.bytes) }, identicalToV1: Record<string, boolean> = {};
  for (const s of SCORES) {
    const scorePath = s.path, { bytes, score, performance } = compile(assetPath(scorePath));
    const quarters = totalQuarters(performance);
    assets[scorePath] = sha(bytes);
    for (const tempo of TEMPI) {
      const toSample = (q: number) => Math.round(q * 60 / tempo * SAMPLE_RATE), length = toSample(quarters), duration = length / SAMPLE_RATE;
      const notes = windowNotes(score, 0, quarters, toSample, length, RAMP_SECONDS * SAMPLE_RATE);
      const id = `${s.id}-${tempo}`, audioPath = join(out, `${id}.wav`);
      writeFileSync(audioPath, writeWav(mixSines(notes, length, PEAK_DBFS, RAMP_SECONDS * SAMPLE_RATE, SAMPLE_RATE)));
      const audioSha = sha(readFileSync(audioPath)); assets[audioPath] = audioSha;
      identicalToV1[id] = v1[id] === audioSha;
      const audio = { path: `${id}.wav`, sampleRate: SAMPLE_RATE, samples: length, sha256: audioSha };
      examples.push({ id, kind: 'performance', control: null, of: id, score: s.id, scorePath, tempo, audioPath,
        label: perfectLabel({ id, performance, score: { path: s.path, sha256: sha(bytes) }, handedQuartersPerMinute: HANDED, duration, audio,
          rendered: notes, sampleRate: SAMPLE_RATE, recipe: { stage: 1, tempo, handed: HANDED, steady: true }, format: LABEL_FORMAT_2 }) });

      const silenceId = `sil-${id}`, silencePath = join(out, `${silenceId}.wav`);
      writeFileSync(silencePath, writeWav(new Int16Array(length)));
      const silenceSha = sha(readFileSync(silencePath)); assets[silencePath] = silenceSha;
      examples.push({ id: silenceId, kind: 'control', control: 'silence', of: id, score: s.id, scorePath, tempo, audioPath: silencePath,
        label: controlLabel({ id: silenceId, performance, score: { path: s.path, sha256: sha(bytes) }, handedQuartersPerMinute: HANDED, duration,
          audio: { path: `${silenceId}.wav`, sampleRate: SAMPLE_RATE, samples: length, sha256: silenceSha }, control: 'silence', extras: [],
          recipe: { stage: 1, of: id }, note: `Digital silence as long as ${id}, handed ${s.id}.` }) });

      const wrongId = `w1-${id}`;
      examples.push({ id: wrongId, kind: 'control', control: 'wrong-score', of: id, score: WRONG_SCORE.id, scorePath: wrongPath, tempo, audioPath,
        label: controlLabel({ id: wrongId, performance: wrong.performance, score: { path: WRONG_SCORE.path, sha256: sha(wrong.bytes) }, handedQuartersPerMinute: HANDED, duration,
          audio, control: 'wrong-score', extras: notes.map(n => ({ onset: n.fromSample / SAMPLE_RATE, end: n.toSample / SAMPLE_RATE, midi: n.midi })),
          recipe: { stage: 1, of: id }, note: `The audio of ${id}, handed ${WRONG_SCORE.id}, which shares no pitch with ${s.id}.` }) });
    }
  }
  const manifest: StageManifest2 = {
    id: STAGE_1_SET_2, version: 2, stage: 1, partition: 'development', handedQuartersPerMinute: HANDED,
    recipe: { renderer: `${RENDERER_VERSION} mixSines`, synth: 'sine', peakDbfs: PEAK_DBFS, rampSeconds: RAMP_SECONDS, sampleRate: SAMPLE_RATE, labels: LABEL_FORMAT_2,
      note: 'Stage 1 of contract2-stage1-v1, relabelled as performance-label@2, with a silence and a wrong-score control beside each example. One sine per note at its written length, abutting, 10 ms linear attack and release; the clip ends with the last note.' },
    examples, identicalToV1, assets,
  };
  const encoded = encode(manifest);
  writeFileSync(join(out, 'manifest.json'), encoded);
  writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(encoded), frozenBeforeCandidate: true }));
  console.log(JSON.stringify({ out, sha256: sha(encoded), identicalToV1,
    examples: examples.map(e => `${e.id}: ${e.kind}${e.control ? ` (${e.control})` : ''}, ${e.label.duration.toFixed(4)} s, ${e.label.events.length} events, ${e.label.performance.extras.length} extras`) }, null, 2));
}
