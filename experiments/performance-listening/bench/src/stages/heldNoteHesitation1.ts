/** 032 stimulus: one unchanged pause timeline, with its preceding sine sustained. */
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
import { maxPolyphony, mixSines, windowNotes, SAMPLE_RATE, type RenderedNote } from '../ladder/render.ts';
import { HESITATION_SET, readHesitationSet } from './hesitation1.ts';
import { totalQuarters } from './stage1.ts';
import { assetPath, readStageSet2, type StageExample2 } from './stage1v2.ts';
import { DISTANT_SCORE, STAGE_1_SET_3 } from './stage1v3.ts';
export const HELD_SET = 'contract2-held-note-hesitation-v1';
export const PREREG032 = 'reports/032-held-note-hesitation.md';
export type HeldConstruction = { id: string; silentId: string; resumedEvent: number; pauseFromSample: number; pauseSamples: number;
  changedFromSample: number; changedToSample: number; outsideRegionExact: true; timelineExact: true; rendered: RenderedNote[] };
export interface HeldManifest {
  id: typeof HELD_SET; version: 1; stage: 2; partition: 'development';
  gitCommit: string; parents: { id: string; sha256: string }[];
  examples: StageExample2[]; assets: Record<string, string>; construction: HeldConstruction[];
  recipe: { note: string; peakDbfs: number; rampSamples: number; sampleRate: number };
}
/** Preserve onsets and all but the note immediately before resumption. */
export function holdPreceding(notes: readonly RenderedNote[], resumedEvent: number): RenderedNote[] {
  assert(Number.isInteger(resumedEvent) && resumedEvent > 0 && resumedEvent < notes.length);
  const held = structuredClone([...notes]);
  assert(held[resumedEvent - 1]!.toSample <= held[resumedEvent]!.fromSample);
  held[resumedEvent - 1]!.toSample = held[resumedEvent]!.fromSample;
  assert.equal(maxPolyphony(held), 1);
  return held;
}
export function source032() {
  const repo = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Commit implementation before running');
  const reportPath = `experiments/performance-listening/${PREREG032}`;
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  const original = execFileSync('git', ['show', `${preregCommit}:${reportPath}`], { cwd: repo, encoding: 'utf8' });
  assert(readFileSync(join(EXPERIMENT, PREREG032), 'utf8').startsWith(original), 'Pre-registration changed');
  return { repo, git, commit: git('rev-parse', 'HEAD'), preregCommit };
}
export function readHeldSet(dir: string) {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  assert.equal(sha(bytes), JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256);
  const manifest = JSON.parse(bytes.toString()) as HeldManifest;
  assert.equal(manifest.id, HELD_SET); assert.equal(manifest.examples.length, 144); assert.equal(manifest.construction.length, 40);
  assert.equal(new Set(manifest.examples.map(e => e.id)).size, 144);
  for (const [path, hash] of Object.entries(manifest.assets)) assert.equal(sha(readFileSync(assetPath(path))), hash, path);
  manifest.examples.forEach(e => validateLabel(e.label));
  return { manifest, sha256: sha(bytes) };
}
export function freezeHeldSet(root: string) {
  const { commit } = source032();
  const parent = readHesitationSet(join(root, HESITATION_SET)), clean = readStageSet2(join(root, STAGE_1_SET_3));
  const out = join(requireOutsideGit(root), HELD_SET); assert(!existsSync(out), 'Never overwrite a set');
  const wrongBytes = readFileSync(assetPath(DISTANT_SCORE)), wrong = compilePerformance(JSON.parse(wrongBytes.toString()) as MnxStructure);
  assert(wrong.ok && !wrong.performance.diagnostics.length);
  mkdirSync(out, { recursive: true });
  const examples: StageExample2[] = structuredClone(clean.manifest.examples), assets = { ...clean.manifest.assets };
  const construction: HeldConstruction[] = [];
  for (const insertion of parent.manifest.insertions) {
    const silent = parent.manifest.examples.find(e => e.id === insertion.id)!;
    const base = clean.manifest.examples.find(e => e.id === insertion.parent)!;
    const scoreBytes = readFileSync(assetPath(base.scorePath)), score = JSON.parse(scoreBytes.toString()) as MnxStructure;
    const compiled = compilePerformance(score); assert(compiled.ok && !compiled.performance.diagnostics.length);
    const length = silent.label.audio!.samples;
    const steady = windowNotes(score, 0, totalQuarters(compiled.performance), q => Math.round(q * 60 / base.tempo * SAMPLE_RATE), length - insertion.gapSamples, 480);
    const paused = steady.map((n, k) => k < insertion.resumedEvent ? n : { ...n, fromSample: n.fromSample + insertion.gapSamples, toSample: n.toSample + insertion.gapSamples });
    const rendered = holdPreceding(paused, insertion.resumedEvent), pcm = mixSines(rendered, length, -12, 480, SAMPLE_RATE);
    const silentBytes = readFileSync(silent.audioPath), previous = paused[insertion.resumedEvent - 1]!;
    const changedFromSample = previous.toSample - 480, changedToSample = rendered[insertion.resumedEvent - 1]!.toSample;
    let changed = 0;
    for (let i = 0; i < length; i++) {
      if (i < changedFromSample || i >= changedToSample) assert.equal(pcm[i], silentBytes.readInt16LE(44 + i * 2), `Unchanged PCM ${silent.id} ${i}`);
      else if (pcm[i] !== silentBytes.readInt16LE(44 + i * 2)) changed++;
    }
    assert(changed > insertion.gapSamples / 2, 'The pause must actually sound');
    const id = insertion.id.replace(/^h-/, 'hh-'), audioPath = join(out, `${id}.wav`), bytes = writeWav(pcm);
    writeFileSync(audioPath, bytes); const hash = sha(bytes); assets[audioPath] = hash;
    const audio = { path: `${id}.wav`, sampleRate: SAMPLE_RATE, samples: length, sha256: hash }, duration = length / SAMPLE_RATE;
    const label = perfectLabel({ id, performance: compiled.performance, score: base.label.score as { path: string; sha256: string }, handedQuartersPerMinute: 90,
      duration, audio, rendered, sampleRate: SAMPLE_RATE, format: LABEL_FORMAT_2,
      recipe: { stage: 2, deviation: 'held-note-hesitation', silentCounterpart: silent.id, pause: insertion.gapSamples / SAMPLE_RATE, resumedEvent: insertion.resumedEvent, articulation: 'constant-sine-sustain-no-overlap' } });
    assert.deepEqual(label.cursor, silent.label.cursor);
    assert.deepEqual(label.events, silent.label.events);
    label.performance.events.forEach((p, k) => {
      assert.equal(p.onset, silent.label.performance.events[k]!.onset);
      p.notes.forEach((n, j) => assert.equal(n.end, k === insertion.resumedEvent - 1 ? label.performance.events[insertion.resumedEvent]!.onset : silent.label.performance.events[k]!.notes[j]!.end));
    });
    label.provenance.note = 'Exactly the silent counterpart onsets; only the preceding note sustains to resumption. The cursor holds; the pause changes one inter-onset interval.';
    examples.push({ ...base, id, of: id, audioPath, label });
    construction.push({ id, silentId: silent.id, resumedEvent: insertion.resumedEvent, pauseFromSample: insertion.gapFromSample, pauseSamples: insertion.gapSamples,
      changedFromSample, changedToSample, outsideRegionExact: true, timelineExact: true, rendered });
    const silId = `sil-${id}`, silPath = join(out, `${silId}.wav`), silBytes = writeWav(new Int16Array(length)), silHash = sha(silBytes);
    writeFileSync(silPath, silBytes); assets[silPath] = silHash;
    examples.push({ ...base, id: silId, of: id, kind: 'control', control: 'silence', audioPath: silPath,
      label: controlLabel({ id: silId, performance: compiled.performance, score: base.label.score as { path: string; sha256: string }, handedQuartersPerMinute: 90, duration,
        audio: { ...audio, path: `${silId}.wav`, sha256: silHash }, control: 'silence', extras: [], recipe: { stage: 2, of: id }, note: `Silence as long as ${id}.` }) });
    const wId = `w2-${id}`;
    examples.push({ ...base, id: wId, of: id, score: 'w2', scorePath: DISTANT_SCORE, kind: 'control', control: 'wrong-score', audioPath,
      label: controlLabel({ id: wId, performance: wrong.performance, score: { path: DISTANT_SCORE, sha256: sha(wrongBytes) }, handedQuartersPerMinute: 90, duration, audio,
        control: 'wrong-score', extras: rendered.map(n => ({ onset: n.fromSample / SAMPLE_RATE, end: n.toSample / SAMPLE_RATE, midi: n.midi })), recipe: { stage: 2, of: id }, note: `${id} audio handed distant w2.` }) });
  }
  const manifest: HeldManifest = { id: HELD_SET, version: 1, stage: 2, partition: 'development', gitCommit: commit,
    parents: [{ id: parent.manifest.id, sha256: parent.sha256 }, { id: clean.manifest.id, sha256: clean.sha256 }], examples, assets, construction,
    recipe: { note: '40 held-note pauses, paired controls and 24 clean parents. Exact onsets; constant sustain, no overlapping pitches.', peakDbfs: -12, rampSamples: 480, sampleRate: SAMPLE_RATE } };
  const bytes = encode(manifest); writeFileSync(join(out, 'manifest.json'), bytes);
  writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(bytes), gitCommit: commit, frozenBeforeComparison: true }));
  readHeldSet(out); return { out, sha256: sha(bytes), examples: examples.length, heldPerformances: construction.length };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(freezeHeldSet(process.argv[2]!));
