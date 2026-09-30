// Renders and freezes contract 2's stage 1 outside git:
//   tsx src/stages/stage1.ts <data-root>
// Perfect, steady sine performances of the committed one- and two-bar scores, handed 90
// per minute and played at 50%, 70%, 100% and 110% of it. A frozen set is never overwritten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { Performance } from '../../../../../src/audio/performanceTypes.ts';
import { add } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { writeWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { mixSines, RENDERER_VERSION, SAMPLE_RATE, windowNotes } from '../ladder/render.ts';
import { perfectLabel, type PerformanceLabel } from '../events/label.ts';

export const STAGE_1_SET = 'contract2-stage1-v1';
export const HANDED = 90;
export const TEMPI = [45, 63, 90, 99] as const;
export const SCORES = [
  { id: 's1', path: 'sources/s1-one-bar-c4-f4.mnx.json' },
  { id: 's2', path: 'sources/s2-two-bar-scale.mnx.json' },
] as const;
const PEAK_DBFS = -12, RAMP_SECONDS = 0.01;

export interface StageExample { id: string; score: string; scorePath: string; tempo: number; audioPath: string; label: PerformanceLabel }
export interface StageManifest {
  id: string; version: 1; stage: 1; partition: 'development'; handedQuartersPerMinute: number;
  recipe: { renderer: string; synth: 'sine'; peakDbfs: number; rampSeconds: number; sampleRate: number; note: string };
  examples: StageExample[];
  assets: Record<string, string>;
}

export const totalQuarters = (performance: Performance) => {
  const last = performance.measures.at(-1)!, end = add(last.position, last.duration);
  return 4 * Number(end.num) / Number(end.den);
};

/** A frozen stage set, verified byte for byte before any use. */
export function readStageSet(dir: string): { manifest: StageManifest; sha256: string } {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  if (sha(bytes) !== JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256) throw new Error('Stage set changed since freezing');
  const manifest = JSON.parse(bytes.toString('utf8')) as StageManifest;
  for (const [path, hash] of Object.entries(manifest.assets)) if (sha(readFileSync(path)) !== hash) throw new Error(`Stage asset changed: ${path}`);
  return { manifest, sha256: sha(bytes) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: tsx src/stages/stage1.ts <data-root>');
  const out = join(requireOutsideGit(root), STAGE_1_SET);
  if (existsSync(out)) throw new Error(`${out} exists; a frozen set is never overwritten`);
  mkdirSync(out, { recursive: true });
  const examples: StageExample[] = [], assets: Record<string, string> = {};
  for (const s of SCORES) {
    const scorePath = resolve(EXPERIMENT, s.path), bytes = readFileSync(scorePath);
    const score = JSON.parse(bytes.toString('utf8')) as MnxStructure, compiled = compilePerformance(score);
    if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error(`${s.id} does not compile cleanly`);
    const quarters = totalQuarters(compiled.performance);
    assets[scorePath] = sha(bytes);
    for (const tempo of TEMPI) {
      const toSample = (q: number) => Math.round(q * 60 / tempo * SAMPLE_RATE), length = toSample(quarters);
      const notes = windowNotes(score, 0, quarters, toSample, length, RAMP_SECONDS * SAMPLE_RATE);
      const id = `${s.id}-${tempo}`, audioPath = join(out, `${id}.wav`);
      writeFileSync(audioPath, writeWav(mixSines(notes, length, PEAK_DBFS, RAMP_SECONDS * SAMPLE_RATE, SAMPLE_RATE)));
      const audioSha = sha(readFileSync(audioPath)); assets[audioPath] = audioSha;
      const label = perfectLabel({ id, performance: compiled.performance, score: { path: s.path, sha256: sha(bytes) }, handedQuartersPerMinute: HANDED,
        duration: length / SAMPLE_RATE, audio: { path: `${id}.wav`, sampleRate: SAMPLE_RATE, samples: length, sha256: audioSha },
        rendered: notes, sampleRate: SAMPLE_RATE, recipe: { stage: 1, tempo, handed: HANDED, steady: true } });
      examples.push({ id, score: s.id, scorePath, tempo, audioPath, label });
    }
  }
  const manifest: StageManifest = {
    id: STAGE_1_SET, version: 1, stage: 1, partition: 'development', handedQuartersPerMinute: HANDED,
    recipe: { renderer: `${RENDERER_VERSION} mixSines`, synth: 'sine', peakDbfs: PEAK_DBFS, rampSeconds: RAMP_SECONDS, sampleRate: SAMPLE_RATE,
      note: 'One sine per note at its written length, abutting, 10 ms linear attack and release; the clip ends with the last note. Perfect and steady.' },
    examples, assets,
  };
  const encoded = encode(manifest);
  writeFileSync(join(out, 'manifest.json'), encoded);
  writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(encoded), frozenBeforeCandidate: true }));
  console.log(JSON.stringify({ out, sha256: sha(encoded), examples: examples.map(e => `${e.id}: ${e.label.duration.toFixed(4)} s, ${e.label.events.length} events`) }, null, 2));
}
