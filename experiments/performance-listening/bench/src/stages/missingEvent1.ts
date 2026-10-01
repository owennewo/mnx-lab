/** 034: silence one interior note of a frozen steady performance, keeping its beat. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { controlLabel, validateLabel, type PerformanceLabel } from '../events/label.ts';
import { writeWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { assetPath, readStageSet2, type StageExample2 } from './stage1v2.ts';
import { DISTANT_SCORE, STAGE_1_SET_3 } from './stage1v3.ts';
export const MISSING_SET = 'contract2-missing-event-v1';
export const PREREG034 = 'reports/034-missing-event-sweep.md';
export function source034() {
  const repo = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Commit implementation before running');
  const path = `experiments/performance-listening/${PREREG034}`;
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', path).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  const original = execFileSync('git', ['show', `${preregCommit}:${path}`], { cwd: repo, encoding: 'utf8' });
  assert(readFileSync(join(EXPERIMENT, PREREG034), 'utf8').startsWith(original), 'Pre-registration changed');
  return { repo, git, commit: git('rev-parse', 'HEAD'), preregCommit };
}
/** Existing label@2 omission rule: absent onset, no cursor advance until next sound. */
export function omissionLabel(parent: PerformanceLabel, index: number, id: string, audio: NonNullable<PerformanceLabel['audio']>): PerformanceLabel {
  assert(index > 0 && index < parent.events.length - 1 && Number.isInteger(index));
  const label = structuredClone(parent); label.id = id; label.audio = audio;
  const p = label.performance.events[index]!;
  assert(p.notes.length === 1 && p.onset !== null);
  p.onset = null; p.distinguishableAt = null;
  p.notes = p.notes.map(n => ({ noteKey: n.noteKey, outcome: 'missing' }));
  label.cursor.segments = label.cursor.segments.filter(s => s.truth !== index);
  label.provenance = { kind: 'generated', recipe: { stage: 2, deviation: 'missing-event', parent: parent.id, index },
    note: 'One interior event silenced in place; all remaining PCM and timings unchanged; cursor holds its predecessor until next sound.' };
  validateLabel(label); return label;
}
export interface MissingManifest {
  id: typeof MISSING_SET; version: 1; stage: 2; partition: 'development'; gitCommit: string;
  parent: { id: string; sha256: string }; examples: StageExample2[]; assets: Record<string, string>;
  omissions: { id: string; parent: string; index: number; fromSample: number; toSample: number; exactOutside: true; zeroInside: true; unchangedBoundaries: number }[];
}
export function readMissingSet(dir: string) {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  assert.equal(sha(bytes), JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256);
  const manifest = JSON.parse(bytes.toString()) as MissingManifest;
  assert.equal(manifest.id, MISSING_SET); assert.equal(manifest.examples.length, 120); assert.equal(manifest.omissions.length, 32);
  assert.equal(new Set(manifest.examples.map(e => e.id)).size, 120);
  for (const [path, hash] of Object.entries(manifest.assets)) assert.equal(sha(readFileSync(assetPath(path))), hash, path);
  manifest.examples.forEach(e => validateLabel(e.label)); return { manifest, sha256: sha(bytes) };
}
export function freezeMissingSet(root: string) {
  const { commit } = source034(), parent = readStageSet2(join(root, STAGE_1_SET_3));
  const out = join(requireOutsideGit(root), MISSING_SET); assert(!existsSync(out), 'Never overwrite a set');
  const wrongBytes = readFileSync(assetPath(DISTANT_SCORE)), wrong = compilePerformance(JSON.parse(wrongBytes.toString()) as MnxStructure);
  assert(wrong.ok && !wrong.performance.diagnostics.length); mkdirSync(out, { recursive: true });
  const examples = structuredClone(parent.manifest.examples), assets = { ...parent.manifest.assets }, omissions: MissingManifest['omissions'] = [];
  for (const base of parent.manifest.examples.filter(e => e.kind === 'performance')) {
    const c = compilePerformance(JSON.parse(readFileSync(assetPath(base.scorePath), 'utf8')) as MnxStructure);
    assert(c.ok && !c.performance.diagnostics.length);
    const original = readFileSync(base.audioPath), length = base.label.audio!.samples, n = base.label.events.length;
    assert.equal(original.length, 44 + 2 * length);
    // Score-derived beat boundaries, independent of the copied label and modified PCM.
    base.label.performance.events.forEach((p, i) => {
      assert.equal(base.label.events[i]!.quarter, i);
      assert.equal(Math.round(p.onset! * 48000), Math.round(i * 60 / base.tempo * 48000));
      assert.equal(Math.round(p.notes[0]!.end! * 48000), Math.round((i + 1) * 60 / base.tempo * 48000));
    });
    for (let index = 1; index < n - 1; index++) {
      const id = `me-${base.id}-e${index + 1}`, audioPath = join(out, `${id}.wav`);
      const from = Math.round(index * 60 / base.tempo * 48000), to = Math.round((index + 1) * 60 / base.tempo * 48000);
      const bytes = Buffer.from(original); bytes.fill(0, 44 + from * 2, 44 + to * 2);
      assert(bytes.subarray(0, 44 + from * 2).equals(original.subarray(0, 44 + from * 2)));
      assert(bytes.subarray(44 + to * 2).equals(original.subarray(44 + to * 2)));
      assert(bytes.subarray(44 + from * 2, 44 + to * 2).every(x => x === 0));
      assert(original.subarray(44 + from * 2, 44 + to * 2).some(x => x !== 0));
      writeFileSync(audioPath, bytes); const hash = sha(bytes); assets[audioPath] = hash;
      const audio = { ...base.label.audio!, path: `${id}.wav`, sha256: hash };
      const label = omissionLabel(base.label, index, id, audio);
      assert.deepEqual(label.events, base.label.events);
      label.performance.events.forEach((p, k) => { if (k !== index) assert.deepEqual(p, base.label.performance.events[k]); });
      assert.equal(label.performance.events.filter(p => p.onset === null).length, 1);
      assert.equal(label.cursor.segments.find(s => s.from === label.performance.events[index + 1]!.onset)?.truth, index + 1);
      assert.equal(label.events[index + 1]!.quarter - label.events[index - 1]!.quarter, 2);
      assert(Math.abs(label.performance.events[index + 1]!.onset! - label.performance.events[index - 1]!.onset! - 120 / base.tempo) <= 1 / 48000);
      examples.push({ ...base, id, of: id, audioPath, label });
      omissions.push({ id, parent: base.id, index, fromSample: from, toSample: to, exactOutside: true, zeroInside: true, unchangedBoundaries: 2 * (n - 1) });
      const silId = `sil-${id}`, silPath = join(out, `${silId}.wav`), silBytes = writeWav(new Int16Array(length)), silHash = sha(silBytes);
      assert(silBytes.length === bytes.length && silBytes.subarray(44).every(x => x === 0));
      writeFileSync(silPath, silBytes); assets[silPath] = silHash;
      examples.push({ ...base, id: silId, of: id, kind: 'control', control: 'silence', audioPath: silPath,
        label: controlLabel({ id: silId, performance: c.performance, score: base.label.score as { path: string; sha256: string }, handedQuartersPerMinute: 90,
          duration: label.duration, audio: { ...audio, path: `${silId}.wav`, sha256: silHash }, control: 'silence', extras: [], recipe: { stage: 2, of: id }, note: `Silence as long as ${id}.` }) });
      const wId = `w2-${id}`;
      examples.push({ ...base, id: wId, of: id, score: 'w2', scorePath: DISTANT_SCORE, kind: 'control', control: 'wrong-score', audioPath,
        label: controlLabel({ id: wId, performance: wrong.performance, score: { path: DISTANT_SCORE, sha256: sha(wrongBytes) }, handedQuartersPerMinute: 90,
          duration: label.duration, audio, control: 'wrong-score', extras: label.performance.events.filter(p => p.onset !== null).map(p => ({ onset: p.onset!, end: p.notes[0]!.end!, midi: label.events[p.index]!.notes[0]!.midi })),
          recipe: { stage: 2, of: id }, note: `${id}'s audio handed distant w2.` }) });
    }
  }
  const manifest: MissingManifest = { id: MISSING_SET, version: 1, stage: 2, partition: 'development', gitCommit: commit,
    parent: { id: STAGE_1_SET_3, sha256: parent.sha256 }, examples, assets, omissions };
  const bytes = encode(manifest); writeFileSync(join(out, 'manifest.json'), bytes);
  writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(bytes), gitCommit: commit, frozenBeforeComparison: true }));
  readMissingSet(out); return { out, sha256: sha(bytes), examples: examples.length, omissions: omissions.length };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(freezeMissingSet(process.argv[2]!));
