// Experiment 015's decoy-family traces: where the incumbent's forward path ranks among
// fifteen score-derived decoys that cannot be right. No evaluator, candidate or support
// rule lives here; the forward path is online-time-warp@6's, unchanged.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HOP_SECONDS } from '../candidates/onlineTimeWarp1.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from '../candidates/onlineTimeWarp2.ts';
import type { DecoyTrace } from '../candidates/onlineTimeWarp7.ts';
import { onlineTimeWarpWith, type SupportTrace } from '../candidates/onlineTimeWarpConfigurable.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { positionAt } from '../proxy/reference.ts';
import { execute, machine } from '../run/runner.ts';
import { value } from '../types.ts';
import { closure } from './cache.ts';
import { V6 } from './candidates.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha } from './privateSets.ts';

const [runId, slug, ladderDir, proxyDir, earlierFrames] = process.argv.slice(2);
if (!runId || !/^g\d{3}[a-z]?-[a-z0-9-]+$/.test(runId) || !slug || !/^\d{3}-[a-z0-9-]+$/.test(slug) || !ladderDir || !proxyDir || !earlierFrames) {
  throw new Error('Usage: tsx src/ladder/decoyNullDiagnostic.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir> <g014b-frames.json>');
}
const repo = join(EXPERIMENT, '../..'), git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
const preregistration = `reports/${slug}.md`;
if (git('status', '--porcelain', '--', 'experiments/performance-listening/bench/src', `experiments/performance-listening/${preregistration}`)) throw new Error('Commit the diagnostic and pre-registration first');
git('cat-file', '-e', `HEAD:experiments/performance-listening/${preregistration}`);
const privateOut = join(requireOutsideGit(ladderDir), 'runs', runId), publicOut = join(EXPERIMENT, 'runs', runId);
if (existsSync(privateOut) || existsSync(publicOut)) throw new Error('Run id exists');
const suite = JSON.parse(readFileSync(new URL('./suite.json', import.meta.url), 'utf8')) as { examples: Record<string, string[]> };
const earlier = JSON.parse(readFileSync(earlierFrames, 'utf8')) as Record<string, DecoyTrace[]>;

/** The forward path, then 7 forward rotations and 8 reversed rotations by eighths of the
 * reference. Every decoy holds exactly the forward reference's frames, so each live
 * frame's rank scale is the same for all sixteen paths. */
const PATHS = [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ id: `forward-${k}8`, order: 'forward' as const, rotation: k / 8 })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ id: `reverse-${k}8`, order: 'reverse' as const, rotation: k / 8 })),
];
const FORWARD_DECOYS = PATHS.slice(1, 8).map(p => p.id), REVERSED = PATHS.slice(8).map(p => p.id), DECOYS = PATHS.slice(1).map(p => p.id);
const BIN_SECONDS = 2;

const privateRows: Record<string, Record<string, SupportTrace[]>> = {};
const cpuStart = process.cpuUsage();
const share = (n: number, d: number) => d ? n / d : null;
type Frame = Record<string, SupportTrace>;
/** F beats decoy d: strictly lower mean rank. Ties are counted apart, never as wins. */
const beats = (f: Frame, d: string) => f['forward-08']!.meanRank! < f[d]!.meanRank!;
const ties = (f: Frame, d: string) => f['forward-08']!.meanRank! === f[d]!.meanRank!;
const winRate = (fs: Frame[], decoys: string[]) => share(decoys.reduce((s, d) => s + fs.filter(f => beats(f, d)).length, 0), fs.length * decoys.length);
function measures(fs: Frame[]) {
  const position = (f: Frame) => DECOYS.reduce((s, d) => s + (f[d]!.meanRank! < f['forward-08']!.meanRank! ? 1 : ties(f, d) ? .5 : 0), 0) / DECOYS.length;
  return {
    frames: fs.length,
    winVsReversedStart: winRate(fs, ['reverse-08']),
    winVsForwardRotations: winRate(fs, FORWARD_DECOYS),
    winVsReversedFamily: winRate(fs, REVERSED),
    perDecoy: Object.fromEntries(DECOYS.map(d => [d, { wins: fs.filter(f => beats(f, d)).length, ties: fs.filter(f => ties(f, d)).length }])),
    meanPosition: share(fs.reduce((s, f) => s + position(f), 0), fs.length),
    bestOfAll: share(fs.filter(f => DECOYS.every(d => beats(f, d))).length, fs.length),
    underCap: share(fs.filter(f => f['forward-08']!.pathCost <= MAXIMUM_PATH_COST).length, fs.length),
  };
}
function run(key: string, scorePath: string, audioPath: string, bpm: number, truth: ((t: number) => number | null) | null) {
  const score = JSON.parse(readFileSync(scorePath, 'utf8')), audio = readWav(readFileSync(audioPath)), tempo = { bpm, unit: 'quarter' as const };
  const traces: Record<string, SupportTrace[]> = {};
  for (const p of PATHS) {
    const rows: SupportTrace[] = [];
    execute(() => onlineTimeWarpWith({ ...V6, label: `oltw6-${p.id}`, alwaysClaim: true, referenceOrder: p.order, referenceRotation: p.rotation, trace: f => rows.push(f) }), score, tempo, audio);
    traces[p.id] = rows;
  }
  privateRows[key] = traces;
  const length = traces['forward-08']!.length;
  if (PATHS.some(p => traces[p.id]!.length !== length || traces[p.id]!.some((t, i) => t.clock !== traces['forward-08']![i]!.clock || t.rows !== traces['forward-08']![i]!.rows))) throw new Error(`${key}: paths traced different frames`);
  // Integrity: the forward path and the unrotated reversal are experiment 014's two paths.
  const old = earlier[key];
  const reproduces = !!old && old.length === length && JSON.stringify(JSON.parse(encode(traces['forward-08']))) === JSON.stringify(old.map(o => o.forward))
    && JSON.stringify(JSON.parse(encode(traces['reverse-08']))) === JSON.stringify(old.map(o => o.reverse));
  const frames: Frame[] = Array.from({ length }, (_, i) => Object.fromEntries(PATHS.map(p => [p.id, traces[p.id]![i]!])));
  const steady = frames.filter(f => f['forward-08']!.rows >= MINIMUM_FRAMES);
  const correct = truth ? steady.filter(f => { const q = truth(f['forward-08']!.clock); return q !== null && Math.abs((f['forward-08']!.best + 1) * HOP_SECONDS * bpm / 60 - q) <= .25; }) : null;
  const bins = new Map<number, Frame[]>();
  for (const f of steady) { const b = Math.floor(f['forward-08']!.clock / BIN_SECONDS); bins.set(b, [...(bins.get(b) ?? []), f]); }
  const byTime = [...bins].map(([b, fs]) => ({ from: b * BIN_SECONDS, frames: fs.length, winVsReversedStart: winRate(fs, ['reverse-08']), winVsForwardRotations: winRate(fs, FORWARD_DECOYS), winVsReversedFamily: winRate(fs, REVERSED) }));
  return { example: key, reproducesExperiment014: reproduces, all: measures(steady), correctAlignment: correct ? measures(correct) : null, byTime };
}

const sets: { id: string; sha256: string }[] = [];
const perSet = [0, 1, 2].flatMap(rung => {
  const set = readRungSet(join(ladderDir, `rung-${rung}`)); sets.push({ id: set.manifest.id, sha256: set.sha256 });
  return set.manifest.examples.filter(e => suite.examples[set.manifest.id]!.includes(e.id) && (e.kind ?? e.id) !== 'silence').map(e => {
    const positive = (e.kind ?? e.id) === 'positive';
    const truth = positive ? (t: number) => {
      const l = e.golden.labels.following.find(l => l.state === 'supported' && t >= l.start && t <= l.end);
      return l?.state === 'supported' ? value(l.truth.atStart) + (t - l.start) * value(l.truth.quartersPerSecond) : null;
    } : null;
    return { rung, kind: e.kind ?? e.id, ...run(`rung-${rung}/${e.id}`, e.scorePath, e.audioPath, e.golden.intended.tempo.bpm, truth) };
  });
});
const proxy = readProxySet(proxyDir);
const thermometer = proxy.manifest.examples.filter(e => e.id === 'winner-positive' || e.id === 'winner-audio-dust-score').map(e => ({
  kind: e.id === 'winner-positive' ? 'positive' : 'wrong-score',
  ...run(`thermometer/${e.id}`, e.scorePath, e.audioPath, proxy.manifest.nominalBpm, e.id === 'winner-positive' ? s => positionAt(e.reference, s)?.quarter ?? null : null),
}));
// The pre-registered aggregate: the equal-weight mean over the nine wrong-score examples.
const wrong = [...perSet, ...thermometer].filter(e => e.kind === 'wrong-score');
if (wrong.length !== 9) throw new Error(`Expected nine wrong-score examples, found ${wrong.length}`);
const mean = (pick: (e: typeof wrong[number]) => number | null) => wrong.reduce((s, e) => s + pick(e)!, 0) / wrong.length;
const aggregate = {
  wrongScoreExamples: wrong.length,
  winVsReversedStart: mean(e => e.all.winVsReversedStart),
  winVsForwardRotations: mean(e => e.all.winVsForwardRotations),
  winVsReversedFamily: mean(e => e.all.winVsReversedFamily),
  meanPosition: mean(e => e.all.meanPosition),
  bestOfAll: mean(e => e.all.bestOfAll),
};
const cpu = process.cpuUsage(cpuStart);
mkdirSync(privateOut, { recursive: true });
const privatePath = join(privateOut, 'frames.json'); writeFileSync(privatePath, encode(privateRows));
const sourceHashes = Object.fromEntries(closure(['ladder/decoyNullDiagnostic.ts']).map(p => [relative(EXPERIMENT, p), sha(readFileSync(p))]));
sourceHashes[preregistration] = sha(readFileSync(join(EXPERIMENT, preregistration)));
const summary = { id: runId, kind: 'decoy-null-diagnostic', preregistration, gitCommit: git('rev-parse', 'HEAD'), sourceHashes,
  investigator: { model: 'Claude Opus 5.5 (1M context)', tool: 'Claude Code' }, machine: machine(), forwardPath: 'online-time-warp@6, alignment and rank trace',
  paths: PATHS, sets, proxySha256: proxy.sha256, earlierFrames: { path: earlierFrames, sha256: sha(readFileSync(earlierFrames)) },
  cpuSeconds: (cpu.user + cpu.system) / 1e6, aggregate, perSet, thermometer,
  privateFrames: { path: privatePath, sha256: sha(readFileSync(privatePath)) },
  reproducesExperiment014: [...perSet, ...thermometer].every(e => e.reproducesExperiment014) };
mkdirSync(publicOut, { recursive: true }); writeFileSync(join(publicOut, 'summary.json'), encode(summary));
console.log(JSON.stringify({ reproducesExperiment014: summary.reproducesExperiment014, aggregate, cpuSeconds: summary.cpuSeconds }, null, 2));
