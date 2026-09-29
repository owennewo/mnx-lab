// Experiment 014's explanatory traces and forward-alignment invariance check.
// No evaluator or candidate selection lives here.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HOP_SECONDS } from '../candidates/onlineTimeWarp1.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from '../candidates/onlineTimeWarp2.ts';
import { onlineTimeWarp7, type DecoyTrace } from '../candidates/onlineTimeWarp7.ts';
import { onlineTimeWarpWith } from '../candidates/onlineTimeWarpConfigurable.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { positionAt } from '../proxy/reference.ts';
import { execute, machine } from '../run/runner.ts';
import { value, type Decision } from '../types.ts';
import { closure } from './cache.ts';
import { V6 } from './candidates.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha } from './privateSets.ts';

const [runId, slug, ladderDir, proxyDir] = process.argv.slice(2);
if (!runId || !/^g\d{3}[a-z]?-[a-z0-9-]+$/.test(runId) || !slug || !/^\d{3}-[a-z0-9-]+$/.test(slug) || !ladderDir || !proxyDir) throw new Error('Usage: tsx src/ladder/decoyDiagnostic.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir>');
const repo = join(EXPERIMENT, '../..'), git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
const preregistration = `reports/${slug}.md`;
if (git('status', '--porcelain', '--', 'experiments/performance-listening/bench/src', `experiments/performance-listening/${preregistration}`)) throw new Error('Commit the diagnostic and pre-registration first');
git('cat-file', '-e', `HEAD:experiments/performance-listening/${preregistration}`);
const privateOut = join(requireOutsideGit(ladderDir), 'runs', runId), publicOut = join(EXPERIMENT, 'runs', runId);
if (existsSync(privateOut) || existsSync(publicOut)) throw new Error('Run id exists');
const suite = JSON.parse(readFileSync(new URL('./suite.json', import.meta.url), 'utf8')) as { examples: Record<string, string[]> };
const privateRows: Record<string, DecoyTrace[]> = {};
const quantiles = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? { p05: s[Math.floor(s.length * .05)]!, median: s[Math.floor(s.length / 2)]!, p95: s[Math.min(s.length - 1, Math.floor(s.length * .95))]! } : null;
};
const cpuStart = process.cpuUsage();
function run(key: string, scorePath: string, audioPath: string, bpm: number, truth: ((t: number) => number | null) | null) {
  const frames: DecoyTrace[] = [], score = JSON.parse(readFileSync(scorePath, 'utf8')), audio = readWav(readFileSync(audioPath)), tempo = { bpm, unit: 'quarter' as const };
  const candidate = execute(() => onlineTimeWarp7({ trace: f => frames.push(f) }), score, tempo, audio);
  const baseline = execute(() => onlineTimeWarpWith({ ...V6, alwaysClaim: true }), score, tempo, audio);
  privateRows[key] = frames;
  const old = new Map(baseline.record.map(d => [d.madeAt, d]));
  const positionValue = (d: Decision) => d.kind === 'position' ? JSON.stringify({ refersTo: d.refersTo, confidence: d.confidence, candidates: d.candidates }) : null;
  const positions = candidate.record.filter(d => d.kind === 'position');
  const mismatches = positions.filter(d => positionValue(d) !== positionValue(old.get(d.madeAt)!)).length;
  const steady = frames.filter(f => f.forward.rows >= MINIMUM_FRAMES);
  const correct = truth ? steady.filter(f => { const q = truth(f.clock); return q !== null && Math.abs((f.forward.best + 1) * HOP_SECONDS * bpm / 60 - q) <= .25; }) : [];
  const summaryOf = (fs: DecoyTrace[]) => ({ frames: fs.length, forwardBetter: fs.filter(f => f.fits).length,
    ties: fs.filter(f => f.forward.meanRank === f.reverse.meanRank).length,
    reverseBetter: fs.filter(f => !f.fits && f.forward.meanRank !== f.reverse.meanRank).length,
    refusedByComparisonOnly: fs.filter(f => !f.fits && f.forward.pathCost <= MAXIMUM_PATH_COST).length,
    refusedByCapOnly: fs.filter(f => f.fits && f.forward.pathCost > MAXIMUM_PATH_COST).length,
    refusedByBoth: fs.filter(f => !f.fits && f.forward.pathCost > MAXIMUM_PATH_COST).length,
    accepted: fs.filter(f => f.supported).length,
    forwardRank: quantiles(fs.map(f => f.forward.meanRank!)), reverseRank: quantiles(fs.map(f => f.reverse.meanRank!)),
    rankAdvantage: quantiles(fs.map(f => f.reverse.meanRank! - f.forward.meanRank!)),
  });
  return { example: key, alignmentInvariant: { claimedPositions: positions.length, mismatches }, all: summaryOf(steady), correctAlignment: truth ? summaryOf(correct) : null };
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
const thermometer = proxy.manifest.examples.filter(e => e.id === 'winner-positive' || e.id === 'winner-audio-dust-score').map(e => run(`thermometer/${e.id}`, e.scorePath, e.audioPath, proxy.manifest.nominalBpm,
  e.id === 'winner-positive' ? s => positionAt(e.reference, s)?.quarter ?? null : null));
const cpu = process.cpuUsage(cpuStart);
mkdirSync(privateOut, { recursive: true });
const privatePath = join(privateOut, 'frames.json'); writeFileSync(privatePath, encode(privateRows));
const sourceHashes = Object.fromEntries(closure(['ladder/decoyDiagnostic.ts']).map(p => [relative(EXPERIMENT, p), sha(readFileSync(p))]));
sourceHashes[preregistration] = sha(readFileSync(join(EXPERIMENT, preregistration)));
const summary = { id: runId, kind: 'decoy-support-diagnostic', preregistration, gitCommit: git('rev-parse', 'HEAD'), sourceHashes,
  investigator: { model: 'GPT-6', tool: 'Codex' }, machine: machine(), candidate: 'online-time-warp@7', sets, proxySha256: proxy.sha256,
  cpuSeconds: (cpu.user + cpu.system) / 1e6, perSet, thermometer,
  privateFrames: { path: privatePath, sha256: sha(readFileSync(privatePath)) },
  alignmentInvariant: [...perSet, ...thermometer].every(e => e.alignmentInvariant.mismatches === 0) };
mkdirSync(publicOut, { recursive: true }); writeFileSync(join(publicOut, 'summary.json'), encode(summary));
console.log(JSON.stringify({ alignmentInvariant: summary.alignmentInvariant, perSet, thermometer }, null, 2));
