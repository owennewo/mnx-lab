// Why does the incumbent's support test reject correct alignments? Not a candidate.
//   tsx src/ladder/supportDiagnostic.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir>
// Runs online-time-warp@6 with a trace on every active rung-2 positive and on the real
// Winner clip. At every analysis frame where its alignment is right (within ±0.25 quarter of
// the truth) but it reports unsupported, records which condition refused: the rank limit,
// the path-cost cap, or both.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from '../candidates/onlineTimeWarp2.ts';
import { HOP_SECONDS } from '../candidates/onlineTimeWarp1.ts';
import { onlineTimeWarpWith, type SupportTrace } from '../candidates/onlineTimeWarpConfigurable.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { positionAt } from '../proxy/reference.ts';
import { execute, machine } from '../run/runner.ts';

import { V6 } from './candidates.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha } from './privateSets.ts';

const [runId, slug, ladderDir, proxyDir] = process.argv.slice(2);
if (!runId || !slug || !ladderDir || !proxyDir) throw new Error('Usage: tsx src/ladder/supportDiagnostic.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir>');
const repo = join(EXPERIMENT, '../..'), git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--', 'experiments/performance-listening/bench/src', `experiments/performance-listening/reports/${slug}.md`)) throw new Error('Commit the diagnostic and its pre-registration first');
const privateOut = join(requireOutsideGit(ladderDir), 'runs', runId), publicOut = join(EXPERIMENT, 'runs', runId);
if (existsSync(privateOut) || existsSync(publicOut)) throw new Error('Run id exists');
const LIMIT = V6.support.limit;

/** Runs the incumbent with a trace; returns each frame's trace and the audio time it describes. */
function traced(scorePath: string, audioPath: string, bpm: number) {
  const frames: SupportTrace[] = [];
  const score = JSON.parse(readFileSync(scorePath, 'utf8'));
  execute(() => onlineTimeWarpWith({ ...V6, trace: f => frames.push(f) }), score, { bpm, unit: 'quarter' }, readWav(readFileSync(audioPath)));
  return frames;
}
function tally(frames: SupportTrace[], truthAt: (seconds: number) => number | null, bpm: number) {
  const t = { frames: 0, correctAlignment: 0, rejectedCorrect: 0, byRank: 0, byCap: 0, byBoth: 0, warming: 0, costs: [] as number[], ranks: [] as number[] };
  for (const f of frames) {
    if (f.rows < MINIMUM_FRAMES) { t.warming++; continue; }
    const truth = truthAt(f.clock); if (truth === null) continue;
    t.frames++;
    const aligned = (f.best + 1) * HOP_SECONDS * bpm / 60;
    if (Math.abs(aligned - truth) > 0.25) continue;
    t.correctAlignment++;
    if (f.supported) continue;
    t.rejectedCorrect++;
    const rank = f.meanRank! > LIMIT, cap = f.pathCost > MAXIMUM_PATH_COST;
    if (rank && cap) t.byBoth++; else if (rank) t.byRank++; else if (cap) t.byCap++;
    t.costs.push(f.pathCost); t.ranks.push(f.meanRank!);
  }
  const q = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? { p05: s[Math.floor(s.length * 0.05)]!, median: s[Math.floor(s.length / 2)]!, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]! } : null; };
  return { ...t, costs: undefined, ranks: undefined, pathCost: q(t.costs), meanRank: q(t.ranks) };
}

const suite = JSON.parse(readFileSync(new URL('./suite.json', import.meta.url), 'utf8')) as { examples: Record<string, string[]> };
const { manifest } = readRungSet(join(ladderDir, 'rung-2'));
const rows: Record<string, SupportTrace[]> = {};
const perSet = manifest.examples.filter(e => e.kind === 'positive' && suite.examples[manifest.id]!.includes(e.id)).map(e => {
  const bpm = e.golden.intended.tempo.bpm, frames = traced(e.scorePath, e.audioPath, bpm); rows[e.id] = frames;
  return { example: e.id, ...tally(frames, s => s * bpm / 60, bpm) };
});
const proxy = readProxySet(proxyDir).manifest, real = proxy.examples.find(e => e.id === 'winner-positive')!;
const realFrames = traced(real.scorePath, real.audioPath, proxy.nominalBpm); rows['real-winner'] = realFrames;
const thermometer = { example: 'real Winner clip, sync-interpolated truth', ...tally(realFrames, s => positionAt(real.reference, s)?.quarter ?? null, proxy.nominalBpm) };
if (!compilePerformance(JSON.parse(readFileSync(real.scorePath, 'utf8'))).ok) throw new Error('compile');

mkdirSync(privateOut, { recursive: true }); writeFileSync(join(privateOut, 'frames.json'), encode(rows));
const summary = { id: runId, kind: 'support-diagnostic', preregistration: `reports/${slug}.md`, gitCommit: git('rev-parse', 'HEAD'), machine: machine(),
  candidate: 'online-time-warp@6', rankLimit: LIMIT, pathCostCap: MAXIMUM_PATH_COST, perSet, thermometer,
  privateFramesSha256: sha(readFileSync(join(privateOut, 'frames.json'))) };
mkdirSync(publicOut, { recursive: true }); writeFileSync(join(publicOut, 'summary.json'), encode(summary));
console.log(JSON.stringify({ perSet, thermometer }, null, 2));

