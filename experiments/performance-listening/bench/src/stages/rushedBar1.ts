/** 033 stimulus: one bar of s2 or s3 played faster than the rest, with paired controls. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { controlLabel, perfectLabel, LABEL_FORMAT_2, validateLabel } from '../events/label.ts';
import { writeWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { mixSines, windowNotes, SAMPLE_RATE } from '../ladder/render.ts';
import { FOUR_BAR_SCORE, FOUR_BAR_SET, readFourBarTempo } from './fourBarTempo1.ts';
import { assetPath, readStageSet2, type StageExample2 } from './stage1v2.ts';
import { DISTANT_SCORE, STAGE_1_SET_3 } from './stage1v3.ts';

export const RUSHED_SET = 'contract2-rushed-bar-v1';
export const PREREG033 = 'reports/033-rushed-bar.md';
export const RUSH_FACTORS = [1.05, 1.1, 1.15, 1.2, 1.25, 1.3] as const;
export const RUSH_TEMPI = [45, 63, 90, 99] as const;
const SCORES = [{ id: 's2', path: 'sources/s2-two-bar-scale.mnx.json', bars: 2 }, { id: 's3', path: FOUR_BAR_SCORE, bars: 4 }] as const;

export type RushConstruction = { id: string; parent: string; score: string; ordinal: number; factor: number; tempo: number;
  checkedBoundaries: number; identicalNotePcm: number; roundedLengthNotes: number };
export interface RushedManifest {
  id: typeof RUSHED_SET; version: 1; stage: 2; partition: 'development'; handedQuartersPerMinute: 90;
  gitCommit: string; parents: { id: string; sha256: string }[];
  examples: StageExample2[]; assets: Record<string, string>; construction: RushConstruction[];
  recipe: { note: string; renderer: string; peakDbfs: number; rampSamples: number; sampleRate: number; factors: readonly number[]; tempi: readonly number[] };
}

/** The slowed-bar map with a factor above one: bar `ordinal` plays at `factor` times `tempo`. */
export function rushedSample(q: number, tempo: number, ordinal: number, factor: number) {
  return Math.round((q + Math.min(4, Math.max(0, q - 4 * ordinal)) * (1 / factor - 1)) * 60 / tempo * SAMPLE_RATE);
}
/** Independent of the map: sum each preceding beat's duration. */
export function beatSample(q: number, tempo: number, ordinal: number, factor: number) {
  let seconds = 0;
  for (let beat = 0; beat < q; beat++) seconds += 60 / tempo / (Math.floor(beat / 4) === ordinal ? factor : 1);
  return Math.round(seconds * SAMPLE_RATE);
}

export function source033() {
  const repo = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Commit implementation before running');
  const reportPath = `experiments/performance-listening/${PREREG033}`;
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  const original = execFileSync('git', ['show', `${preregCommit}:${reportPath}`], { cwd: repo, encoding: 'utf8' });
  assert(readFileSync(join(EXPERIMENT, PREREG033), 'utf8').startsWith(original), 'Pre-registration changed');
  return { repo, git, commit: git('rev-parse', 'HEAD'), preregCommit };
}

export function readRushedSet(dir: string) {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  assert.equal(sha(bytes), JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256, 'Rushed-bar manifest changed');
  const manifest = JSON.parse(bytes.toString()) as RushedManifest;
  assert.equal(manifest.id, RUSHED_SET); assert.equal(manifest.examples.length, 456); assert.equal(manifest.construction.length, 144);
  assert.equal(new Set(manifest.examples.map(e => e.id)).size, 456);
  for (const [path, hash] of Object.entries(manifest.assets)) assert.equal(sha(readFileSync(assetPath(path))), hash, path);
  manifest.examples.forEach(e => validateLabel(e.label));
  return { manifest, sha256: sha(bytes) };
}

export function freezeRushedSet(root: string) {
  const { commit } = source033();
  const stage1 = readStageSet2(join(root, STAGE_1_SET_3)), four = readFourBarTempo(join(root, FOUR_BAR_SET));
  const out = join(requireOutsideGit(root), RUSHED_SET); assert(!existsSync(out), 'Never overwrite a set');
  const wrongBytes = readFileSync(assetPath(DISTANT_SCORE)), wrong = compilePerformance(JSON.parse(wrongBytes.toString()) as MnxStructure);
  assert(wrong.ok && !wrong.performance.diagnostics.length);
  mkdirSync(out, { recursive: true });
  const parents = [...stage1.manifest.examples, ...four.manifest.examples];
  const examples: StageExample2[] = [], assets: Record<string, string> = {}, construction: RushConstruction[] = [];
  // Clean parents and their controls, unchanged.
  for (const { id: score } of SCORES) for (const tempo of RUSH_TEMPI) for (const prefix of ['', 'sil-', 'w2-']) {
    const e = parents.find(x => x.id === `${prefix}${score}-${tempo}`); assert(e, `${prefix}${score}-${tempo}`);
    examples.push(structuredClone(e)); assets[e.audioPath] = sha(readFileSync(e.audioPath));
  }
  for (const s of SCORES) {
    const scoreBytes = readFileSync(assetPath(s.path)), score = JSON.parse(scoreBytes.toString()) as MnxStructure;
    const c = compilePerformance(score); assert(c.ok && !c.performance.diagnostics.length);
    const quarters = s.bars * 4; assets[s.path] = sha(scoreBytes);
    for (const tempo of RUSH_TEMPI) {
      const base = parents.find(x => x.id === `${s.id}-${tempo}`)!;
      assert.equal(base.label.events.length, quarters); assert.equal(base.scorePath, s.path);
      const original = readFileSync(base.audioPath);
      for (let ordinal = 0; ordinal < s.bars; ordinal++) for (const factor of RUSH_FACTORS) {
        const length = rushedSample(quarters, tempo, ordinal, factor);
        const rendered = windowNotes(score, 0, quarters, q => rushedSample(q, tempo, ordinal, factor), length, 480);
        const pcm = mixSines(rendered, length, -12, 480, SAMPLE_RATE), bytes = writeWav(pcm);
        assert.equal(rendered.length, quarters); assert.equal(length, beatSample(quarters, tempo, ordinal, factor));
        let identicalNotePcm = 0, roundedLengthNotes = 0;
        for (const [i, n] of rendered.entries()) {
          assert(n.scoreQuarter === i && n.fromSample === beatSample(i, tempo, ordinal, factor) && n.toSample === beatSample(i + 1, tempo, ordinal, factor), `Boundary ${s.id} ${i}`);
          assert.equal(n.midi, base.label.events[i]!.notes[0]!.midi);
          if (Math.floor(i / 4) === ordinal) { assert(n.toSample - n.fromSample < Math.round(60 / tempo * SAMPLE_RATE)); continue; }
          const old = base.label.performance.events[i]!.notes[0]!, from = Math.round(old.onset! * SAMPLE_RATE), to = Math.round(old.end! * SAMPLE_RATE);
          if (n.toSample - n.fromSample === to - from) {
            for (let j = 0; j < to - from; j++) assert.equal(pcm[n.fromSample + j], original.readInt16LE(44 + (from + j) * 2), `Unchanged-note PCM ${s.id} ${i}`);
            identicalNotePcm++;
          } else { assert(Math.abs(n.toSample - n.fromSample - (to - from)) <= 1, 'Rounding exceeds one sample'); roundedLengthNotes++; }
        }
        const id = `rb-${s.id}-${tempo}-b${ordinal + 1}-${Math.round(factor * 100)}`, audioPath = join(out, `${id}.wav`);
        writeFileSync(audioPath, bytes); const hash = sha(bytes); assets[audioPath] = hash;
        const audio = { path: `${id}.wav`, sampleRate: SAMPLE_RATE, samples: length, sha256: hash }, duration = length / SAMPLE_RATE;
        const recipe = { stage: 2, deviation: 'rushed-bar', base: base.id, ordinal, factor, tempo, synth: 'sine' };
        const label = perfectLabel({ id, performance: c.performance, score: { path: s.path, sha256: sha(scoreBytes) }, handedQuartersPerMinute: 90,
          duration, audio, rendered, sampleRate: SAMPLE_RATE, format: LABEL_FORMAT_2, recipe });
        label.cursor.segments.forEach((g, i) => assert(g.from === rendered[i]!.fromSample / SAMPLE_RATE && g.truth === i && g.admissible.join(',') === String(i), 'Cursor label'));
        examples.push({ id, kind: 'performance', control: null, of: id, score: s.id, scorePath: s.path, tempo, audioPath, label });
        construction.push({ id, parent: base.id, score: s.id, ordinal, factor, tempo, checkedBoundaries: 2 * quarters, identicalNotePcm, roundedLengthNotes });
        const silId = `sil-${id}`, silPath = join(out, `${silId}.wav`), silBytes = writeWav(new Int16Array(length));
        assert(silBytes.length === bytes.length && silBytes.subarray(44).every(x => x === 0), 'Silence control');
        writeFileSync(silPath, silBytes); const silHash = sha(silBytes); assets[silPath] = silHash;
        examples.push({ id: silId, kind: 'control', control: 'silence', of: id, score: s.id, scorePath: s.path, tempo, audioPath: silPath,
          label: controlLabel({ id: silId, performance: c.performance, score: { path: s.path, sha256: sha(scoreBytes) }, handedQuartersPerMinute: 90, duration,
            audio: { ...audio, path: `${silId}.wav`, sha256: silHash }, control: 'silence', extras: [], recipe: { ...recipe, of: id }, note: `Digital silence as long as ${id}.` }) });
        const wId = `w2-${id}`;
        examples.push({ id: wId, kind: 'control', control: 'wrong-score', of: id, score: 'w2', scorePath: DISTANT_SCORE, tempo, audioPath,
          label: controlLabel({ id: wId, performance: wrong.performance, score: { path: DISTANT_SCORE, sha256: sha(wrongBytes) }, handedQuartersPerMinute: 90, duration, audio,
            control: 'wrong-score', extras: rendered.map(n => ({ onset: n.fromSample / SAMPLE_RATE, end: n.toSample / SAMPLE_RATE, midi: n.midi })), recipe: { ...recipe, of: id }, note: `${id}'s audio handed distant w2.` }) });
      }
    }
  }
  assets[DISTANT_SCORE] = sha(wrongBytes);
  const manifest: RushedManifest = { id: RUSHED_SET, version: 1, stage: 2, partition: 'development', handedQuartersPerMinute: 90, gitCommit: commit,
    parents: [{ id: STAGE_1_SET_3, sha256: stage1.sha256 }, { id: FOUR_BAR_SET, sha256: four.sha256 }], examples, assets, construction,
    recipe: { note: '033: one s2 or s3 bar at 1.05-1.30 of base tempo, every bar independently, paired controls; clean s2/s3 parents unchanged.',
      renderer: 'windowNotes + mixSines', peakDbfs: -12, rampSamples: 480, sampleRate: SAMPLE_RATE, factors: RUSH_FACTORS, tempi: RUSH_TEMPI } };
  const bytes = encode(manifest); writeFileSync(join(out, 'manifest.json'), bytes);
  writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(bytes), gitCommit: commit, frozenBeforeComparison: true,
    validation: { performances: construction.length + 8, examples: examples.length, boundaryChecks: construction.reduce((s, x) => s + x.checkedBoundaries, 0),
      identicalNotePcm: construction.reduce((s, x) => s + x.identicalNotePcm, 0), roundedLengthNotes: construction.reduce((s, x) => s + x.roundedLengthNotes, 0) } }));
  readRushedSet(out); return { out, sha256: sha(bytes), examples: examples.length, rushed: construction.length };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(freezeRushedSet(process.argv[2]!));
