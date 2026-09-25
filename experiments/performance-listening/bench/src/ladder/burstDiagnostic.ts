// Which features mislead the incumbent's alignment on recorded guitar? Not a candidate.
//   tsx src/ladder/burstDiagnostic.ts <run-id> <report-slug> <ladder-dir>
// For every analysis frame where the alignment-only diagnostic of online-time-warp@2 is
// wrong by more than 0.25 quarter, split the match into per-dimension contributions and
// report which semitone bands, and which half (sustained level or onset change), make the
// chosen reference frame look closer than the true one.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { frames, HOP_SECONDS, referenceFrames } from '../candidates/onlineTimeWarp1.ts';
import { onlineTimeWarp2 } from '../candidates/onlineTimeWarp2.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { execute, machine } from '../run/runner.ts';
import { value } from '../types.ts';
import { readRungSet, requireOutsideGit, sha } from './privateSets.ts';

const [runId, slug, ladderDir] = process.argv.slice(2);
if (!runId || !slug || !ladderDir) throw new Error('Usage: tsx src/ladder/burstDiagnostic.ts <run-id> <report-slug> <ladder-dir>');
const repo = join(EXPERIMENT, '../..'), git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--', 'experiments/performance-listening/bench/src', `experiments/performance-listening/reports/${slug}.md`)) throw new Error('Commit the diagnostic and its pre-registration first');
const privateOut = join(requireOutsideGit(ladderDir), 'runs', runId), publicOut = join(EXPERIMENT, 'runs', runId);
if (existsSync(privateOut) || existsSync(publicOut)) throw new Error('Run id exists');

const BANDS = 61, LOW_MIDI = 36;
const NOTE = (m: number) => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][m % 12] + String(Math.floor(m / 12) - 1);
const suite = JSON.parse(readFileSync(new URL('./suite.json', import.meta.url), 'utf8')) as { examples: Record<string, string[]> };
const { manifest } = readRungSet(join(ladderDir, 'rung-2'));
const positives = manifest.examples.filter(e => e.kind === 'positive' && suite.examples[manifest.id]!.includes(e.id));

const perSet = [], rows: unknown[] = [];
for (const e of positives) {
  const score = JSON.parse(readFileSync(e.scorePath, 'utf8')) as MnxStructure, audio = readWav(readFileSync(e.audioPath));
  const bpm = e.golden.intended.tempo.bpm, qps = bpm / 60;
  const live = frames(audio), reference = referenceFrames(score, bpm).frames;
  const { record } = execute(() => onlineTimeWarp2({ alwaysClaim: true }), score, { bpm, unit: 'quarter' }, audio);
  const byClock = new Map(record.map(d => [d.madeAt.toFixed(9), d]));
  const tally = { wrong: { level: 0, onset: 0, frames: 0, bands: new Float64Array(BANDS) }, right: { level: 0, onset: 0, frames: 0 } };
  for (const f of live) {
    const d = byClock.get(f.clock.toFixed(9));
    if (!d || d.kind !== 'position' || f.rms <= 1e-4) continue;
    const chosen = Math.round(value(d.candidates[0]!.position.quarters) / qps / HOP_SECONDS) - 1;
    const truth = f.clock * qps, trueFrame = Math.round(f.clock / HOP_SECONDS) - 1;
    const error = value(d.candidates[0]!.position.quarters) - truth;
    if (chosen < 0 || chosen >= reference.length || trueFrame >= reference.length) continue;
    // A positive contribution favours the chosen frame: its match minus the true frame's.
    let level = 0, onset = 0; const bands = new Float64Array(BANDS);
    for (let k = 0; k < 2 * BANDS; k++) {
      const c = f.feature[k]! * (reference[chosen]!.feature[k]! - reference[trueFrame]!.feature[k]!);
      if (k < BANDS) { level += c; bands[k]! += c; } else { onset += c; bands[k - BANDS]! += c; }
    }
    const side = Math.abs(error) > 0.25 ? tally.wrong : tally.right;
    side.level += level; side.onset += onset; side.frames++;
    if (side === tally.wrong) { for (let k = 0; k < BANDS; k++) tally.wrong.bands[k]! += bands[k]!; rows.push({ example: e.id, clock: f.clock, truth, error, level, onset, bands: Array.from(bands) }); }
  }
  const w = tally.wrong, top = Array.from(w.bands, (v, k) => ({ note: NOTE(LOW_MIDI + k), midi: LOW_MIDI + k, share: v / (w.level + w.onset) })).sort((a, b) => b.share - a.share).slice(0, 5);
  perSet.push({ example: e.id, wrongFrames: w.frames, rightFrames: tally.right.frames,
    wrong: { levelAdvantage: w.level, onsetAdvantage: w.onset, levelShare: w.level / (w.level + w.onset) },
    right: { meanLevel: tally.right.level / Math.max(1, tally.right.frames), meanOnset: tally.right.onset / Math.max(1, tally.right.frames) },
    topBands: top });
}
mkdirSync(privateOut, { recursive: true }); writeFileSync(join(privateOut, 'frames.json'), encode(rows));
const summary = { id: runId, kind: 'feature-diagnostic', preregistration: `reports/${slug}.md`, gitCommit: git('rev-parse', 'HEAD'), machine: machine(),
  sourceHashes: Object.fromEntries(['bench/src/ladder/burstDiagnostic.ts', 'bench/src/candidates/onlineTimeWarp1.ts', 'bench/src/candidates/onlineTimeWarp2.ts'].map(p => [p, sha(readFileSync(join(EXPERIMENT, p)))])),
  set: manifest.id, perSet, privateFramesSha256: sha(readFileSync(join(privateOut, 'frames.json'))) };
mkdirSync(publicOut, { recursive: true }); writeFileSync(join(publicOut, 'summary.json'), encode(summary));
console.log(JSON.stringify(perSet, null, 2));
