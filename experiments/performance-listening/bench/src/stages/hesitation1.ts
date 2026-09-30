/** 025: freeze one exact silent hesitation; no listener receives recipes or labels. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { controlLabel, perfectLabel, LABEL_FORMAT_2, validateLabel } from '../events/label.ts';
import { writeWav } from '../generate/wav.ts';
import { encode } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { mixSines, windowNotes, SAMPLE_RATE } from '../ladder/render.ts';
import { totalQuarters } from './stage1.ts';
import { assetPath, readStageSet2, type StageExample2, type StageManifest2 } from './stage1v2.ts';
import { DISTANT_SCORE, STAGE_1_SET_3 } from './stage1v3.ts';
export const HESITATION_SET = 'contract2-hesitation-v1';
export const PAUSES = [0.3, 0.5, 0.7, 1, 2] as const;
export interface HesitationManifest extends Omit<StageManifest2, 'version' | 'stage'> {
  version: 3; stage: 2;
  parent: { id: string; sha256: string };
  insertions: { id: string; parent: string; gapFromSample: number; gapSamples: number; resumedEvent: number; pcmExact: true }[];
}
export function readHesitationSet(dir: string) {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  if (sha(bytes) !== JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256) throw new Error('Frozen hesitation manifest changed');
  const manifest = JSON.parse(bytes.toString()) as HesitationManifest;
  if (manifest.id !== HESITATION_SET || manifest.version !== 3 || manifest.examples.length !== 144) throw new Error('Unexpected hesitation set');
  for (const [path, hash] of Object.entries(manifest.assets)) if (sha(readFileSync(assetPath(path))) !== hash) throw new Error(`Changed asset: ${path}`);
  manifest.examples.forEach(e => validateLabel(e.label));
  return { manifest, sha256: sha(bytes) };
}
export function freezeHesitation(root: string) {
  const { manifest: parent, sha256: parentHash } = readStageSet2(join(root, STAGE_1_SET_3));
  const out = join(requireOutsideGit(root), HESITATION_SET);
  if (existsSync(out)) throw new Error('Hesitation set exists; never overwrite');
  const wrongBytes = readFileSync(assetPath(DISTANT_SCORE));
  const wrong = compilePerformance(JSON.parse(wrongBytes.toString()) as MnxStructure);
  if (!wrong.ok || wrong.performance.diagnostics.length) throw new Error('Wrong score does not compile');
  mkdirSync(out, { recursive: true });
  const examples: StageExample2[] = structuredClone(parent.examples), assets = { ...parent.assets };
  const insertions: HesitationManifest['insertions'] = [];
  for (const base of parent.examples.filter(e => e.kind === 'performance')) {
    const scoreBytes = readFileSync(assetPath(base.scorePath)), score = JSON.parse(scoreBytes.toString()) as MnxStructure;
    const compiled = compilePerformance(score);
    if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score does not compile');
    const quarters = totalQuarters(compiled.performance), original = readFileSync(base.audioPath);
    const originalLength = (original.length - 44) / 2;
    const resumedEvent = base.score === 's1' ? 2 : 4;
    const pauseQuarter = base.label.events[resumedEvent]!.quarter;
    const gapFromSample = Math.round(base.label.performance.events[resumedEvent]!.onset! * SAMPLE_RATE);
    const steady = windowNotes(score, 0, quarters, q => Math.round(q * 60 / base.tempo * SAMPLE_RATE), originalLength, 480);
    for (const pause of PAUSES) {
      const gapSamples = Math.round(pause * SAMPLE_RATE), length = originalLength + gapSamples;
      const rendered = steady.map(n => n.scoreQuarter < pauseQuarter ? { ...n } : { ...n, fromSample: n.fromSample + gapSamples, toSample: n.toSample + gapSamples });
      const pcm = mixSines(rendered, length, -12, 480, SAMPLE_RATE), bytes = writeWav(pcm);
      for (let i = 0; i < length; i++) {
        const expected = i < gapFromSample ? original.readInt16LE(44 + i * 2) : i < gapFromSample + gapSamples ? 0 : original.readInt16LE(44 + (i - gapSamples) * 2);
        if (pcm[i] !== expected) throw new Error(`Insertion changed PCM at ${i}`);
      }
      const id = `h-${base.id}-${Math.round(pause * 1000)}`, audioPath = join(out, `${id}.wav`);
      writeFileSync(audioPath, bytes); const audioHash = sha(bytes); assets[audioPath] = audioHash;
      const audio = { path: `${id}.wav`, sampleRate: SAMPLE_RATE, samples: length, sha256: audioHash }, duration = length / SAMPLE_RATE;
      const label = perfectLabel({ id, performance: compiled.performance, score: base.label.score as { path: string; sha256: string }, handedQuartersPerMinute: 90,
        duration, audio, rendered, sampleRate: SAMPLE_RATE, format: LABEL_FORMAT_2, recipe: { stage: 2, deviation: 'hesitation', base: base.id, pause, resumedEvent, articulation: 'silent-gap' } });
      label.provenance.note = 'Every pitch matched; one exact silent gap delays the resumed event and every following event. Cursor holds the previous sounded event throughout the gap.';
      for (const p of label.performance.events) {
        const before = base.label.performance.events[p.index]!;
        const shift = p.index >= resumedEvent ? gapSamples / SAMPLE_RATE : 0;
        if (Math.abs(p.onset! - before.onset! - shift) > 1e-12 || p.notes.some((n, k) => Math.abs(n.end! - before.notes[k]!.end! - shift) > 1e-12)) throw new Error('Unexpected label shift');
      }
      examples.push({ ...base, id, of: id, audioPath, label });
      insertions.push({ id, parent: base.id, gapFromSample, gapSamples, resumedEvent, pcmExact: true });
      const silId = `sil-${id}`, silPath = join(out, `${silId}.wav`), silBytes = writeWav(new Int16Array(length));
      writeFileSync(silPath, silBytes); const silHash = sha(silBytes); assets[silPath] = silHash;
      examples.push({ ...base, id: silId, kind: 'control', control: 'silence', of: id, audioPath: silPath,
        label: controlLabel({ id: silId, performance: compiled.performance, score: base.label.score as { path: string; sha256: string }, handedQuartersPerMinute: 90, duration,
          audio: { ...audio, path: `${silId}.wav`, sha256: silHash }, control: 'silence', extras: [], recipe: { stage: 2, of: id }, note: `Digital silence as long as ${id}.` }) });
      const wrongId = `w2-${id}`;
      examples.push({ ...base, id: wrongId, kind: 'control', control: 'wrong-score', of: id, score: 'w2', scorePath: DISTANT_SCORE, audioPath,
        label: controlLabel({ id: wrongId, performance: wrong.performance, score: { path: DISTANT_SCORE, sha256: sha(wrongBytes) }, handedQuartersPerMinute: 90, duration, audio,
          control: 'wrong-score', extras: rendered.map(n => ({ onset: n.fromSample / SAMPLE_RATE, end: n.toSample / SAMPLE_RATE, midi: n.midi })),
          recipe: { stage: 2, of: id }, note: `${id}'s audio handed the distant w2 score.` }) });
    }
  }
  const manifest: HesitationManifest = { ...parent, id: HESITATION_SET, version: 3, stage: 2,
    parent: { id: parent.id, sha256: parentHash }, examples, assets, insertions,
    recipe: { ...parent.recipe, note: '025: parent stage-1 regressions unchanged; a single silent pause at 0.3/0.5/0.7/1/2 s before s1 event 2 or s2 event 4, plus paired controls.' } };
  const bytes = encode(manifest);
  writeFileSync(join(out, 'manifest.json'), bytes);
  writeFileSync(join(out, 'freeze.json'), encode({ sha256: sha(bytes), frozenBeforeComparisonRunner: true, unchangedListener: 'event-chain@1', parent: manifest.parent, exactPcmInsertions: insertions.length, regressionExamples: parent.examples.length }));
  readHesitationSet(out);
  return { out, sha256: sha(bytes), examples: examples.length, insertions: insertions.length };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(freezeHesitation(process.argv[2]!));
