// The development scoreboard of development contract 1:
//   tsx src/ladder/scoreboard.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir>
// Runs every candidate over every built rung, the recognition measure at exact labels,
// and the real-clip thermometer. Refuses to run until the code, the development
// contract and the experiment's pre-registration are committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { clockFollower, CLOCK_VERSION } from '../candidates/clockFollower.ts';
import { spectralFollower1, SPECTRAL_1 } from '../candidates/spectralFollower1.ts';
import { spectralFollower2 } from '../candidates/spectralFollower2.ts';
import { onlineTimeWarp1, OLTW_1 } from '../candidates/onlineTimeWarp1.ts';
import { onlineTimeWarp2, OLTW_2 } from '../candidates/onlineTimeWarp2.ts';
import { evaluate } from '../evaluate/index.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { evaluateProxy } from '../proxy/reference.ts';
import { execute, machine } from '../run/runner.ts';
import type { Decision, Listener, Tempo } from '../types.ts';
import { asGolden, gates } from './goldens.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha } from './privateSets.ts';
import { recognitionAtLabels, recognitionOltw } from './recognition.ts';

const [runId, slug, ladderDir, proxyDir] = process.argv.slice(2);
if (!runId || !/^g\d{3}[a-z]?-[a-z0-9-]+$/.test(runId) || !slug || !/^\d{3}-[a-z0-9-]+$/.test(slug) || !ladderDir || !proxyDir) {
  throw new Error('Usage: tsx src/ladder/scoreboard.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir>');
}
const repo = join(EXPERIMENT, '../..');
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const preregistration = `experiments/performance-listening/reports/${slug}.md`;
const pinned = ['experiments/performance-listening/bench/src', 'src/audio', 'src/model', 'experiments/performance-listening/contracts/development-contract-1.md', preregistration];
if (git('status', '--porcelain', '--', ...pinned)) throw new Error('Commit the code, the contract and the pre-registration before running');
git('cat-file', '-e', `HEAD:${preregistration}`);

const privateOut = join(requireOutsideGit(ladderDir), 'runs', runId), publicOut = join(EXPERIMENT, 'runs', runId);
if (existsSync(privateOut) || existsSync(publicOut)) throw new Error('Run id exists; a run is never overwritten');

const CANDIDATES: { id: string; factory: () => Listener; recognition?: 1 | 2 | 'oltw' }[] = [
  { id: CLOCK_VERSION, factory: clockFollower },
  { id: SPECTRAL_1, factory: spectralFollower1, recognition: 1 },
  { id: 'spectral-follower@2', factory: spectralFollower2, recognition: 2 },
  { id: OLTW_1, factory: onlineTimeWarp1, recognition: 'oltw' },
  { id: OLTW_2, factory: onlineTimeWarp2 },
];
const rungDirs = readdirSync(ladderDir).filter(d => /^rung-\d+$/.test(d)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
if (!rungDirs.length) throw new Error('No built rung');
const proxy = readProxySet(proxyDir);

const score = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as MnxStructure;
function causality(factory: () => Listener, s: MnxStructure, tempo: Tempo, audio: Float32Array, record: Decision[]) {
  const checks = [];
  for (const fraction of [0.25, 0.5, 0.75]) for (const kind of ['silence', 'alternating'] as const) {
    const sample = Math.floor(audio.length * fraction), future = audio.slice();
    for (let i = sample; i < future.length; i++) future[i] = kind === 'silence' ? 0 : (i % 2 ? 0.125 : -0.125);
    const changed = execute(factory, s, tempo, future).record;
    const prefix = (r: Decision[]) => JSON.stringify(r.filter(d => d.madeAt <= sample / 48000));
    checks.push({ fraction, kind, pass: prefix(record) === prefix(changed) });
  }
  return checks;
}

const cpuStart = process.cpuUsage();
const records: Record<string, Decision[]> = {}, evaluations: Record<string, unknown> = {}, recognitionRows: Record<string, unknown> = {};
const rungs = rungDirs.map(dir => {
  const { manifest, sha256 } = readRungSet(join(ladderDir, dir));
  const tempo: Tempo = { bpm: manifest.examples[0]!.golden.intended.tempo.bpm, unit: 'quarter' };
  const candidates = CANDIDATES.map(c => ({
    candidate: c.id,
    examples: manifest.examples.map(e => {
      const s = score(e.scorePath), audio = readWav(readFileSync(e.audioPath));
      const run = execute(c.factory, s, tempo, audio);
      const checks = causality(c.factory, s, tempo, audio, run.record);
      const evaluation = evaluate(asGolden(e.golden), run.record);
      records[`${dir}/${c.id}/${e.id}`] = run.record; evaluations[`${dir}/${c.id}/${e.id}`] = evaluation;
      const result = gates(evaluation, run.cost, checks);
      return { example: e.id, gates: result, counts: evaluation.asDecided.counts, denominators: evaluation.asDecided.denominators,
        errors: { ...evaluation.asDecided.errors, values: undefined }, losses: evaluation.asDecided.losses.length,
        exposure: evaluation.exposure, timeliness: { ...evaluation.timeliness, delays: undefined }, cost: run.cost, causality: checks };
    }),
  })).map(c => ({ ...c, passes: c.examples.every(e => e.gates.failed.length === 0) }));
  const positive = manifest.examples.find(e => e.id === 'positive')!, wrong = manifest.examples.find(e => e.id === 'wrong-score')!;
  const recipe = positive.golden.audio.recipe;
  const recognition = CANDIDATES.filter(c => c.recognition).map(c => {
    const audio = readWav(readFileSync(positive.audioPath)), at = (seconds: number) => recipe.fromQuarter + seconds * recipe.bpm / 60;
    const r = c.recognition === 'oltw'
      ? recognitionOltw(audio, score(positive.scorePath), score(wrong.scorePath), at, recipe.bpm)
      : recognitionAtLabels(audio, score(positive.scorePath), score(wrong.scorePath), c.recognition!, at, recipe.bpm);
    recognitionRows[`${dir}/${c.id}`] = r.rows;
    return { candidate: c.id, ...r, rows: undefined };
  });
  return { rung: manifest.rung, set: manifest.id, sha256, candidates, recognition };
});

// The thermometer: the real Winner clip under the sync-proxy evaluator. Recorded on every
// run, never used to select. Frozen candidates should reproduce experiment 002 exactly.
const recorded002: Record<string, { example: string; metrics: unknown }[]> = {};
for (const [runName, side, id] of [['g002a-spectral1-winner-sync-proxy', 'comparator', CLOCK_VERSION], ['g002a-spectral1-winner-sync-proxy', 'candidate', SPECTRAL_1], ['g002b-spectral2-winner-sync-proxy', 'candidate', 'spectral-follower@2']] as const) {
  recorded002[id] = JSON.parse(readFileSync(join(EXPERIMENT, 'runs', runName, 'summary.json'), 'utf8'))[side].examples;
}
const thermometer = CANDIDATES.map(c => ({
  candidate: c.id,
  examples: proxy.manifest.examples.map(e => {
    const run = execute(c.factory, score(e.scorePath), { bpm: proxy.manifest.nominalBpm, unit: 'quarter' }, readWav(readFileSync(e.audioPath)));
    const metrics = evaluateProxy(e.reference, run.record).summary;
    const before = recorded002[c.id]?.find(x => x.example === e.id)?.metrics;
    return { example: e.id, metrics, reproducesExperiment002: before === undefined ? null : JSON.stringify(before) === JSON.stringify(metrics) };
  }),
}));

const cpu = process.cpuUsage(cpuStart), cpuSeconds = (cpu.user + cpu.system) / 1e6;
mkdirSync(privateOut, { recursive: true });
writeFileSync(join(privateOut, 'records.json'), encode(records));
writeFileSync(join(privateOut, 'evaluations.json'), encode(evaluations));
writeFileSync(join(privateOut, 'recognition.json'), encode(recognitionRows));
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]);
const sourceFiles = [...files(join(EXPERIMENT, 'bench/src')), join(EXPERIMENT, 'contracts/development-contract-1.md')];
const summary = {
  id: runId, kind: 'development-scoreboard', policy: 'development-contract-1', preregistration: `reports/${slug}.md`,
  gitCommit: git('rev-parse', 'HEAD'), machine: machine(),
  sourceHashes: Object.fromEntries(sourceFiles.map(p => [p.slice(EXPERIMENT.length), sha(readFileSync(p))])),
  rungs, thermometer: { set: proxy.manifest.id, sha256: proxy.sha256, evaluator: 'sync-proxy-evaluator@1', use: 'recorded, never used to select', candidates: thermometer },
  cpuSeconds,
  privateHashes: Object.fromEntries(['records.json', 'evaluations.json', 'recognition.json'].map(f => [f, sha(readFileSync(join(privateOut, f)))])),
};
mkdirSync(publicOut, { recursive: true });
writeFileSync(join(publicOut, 'summary.json'), encode(summary));
console.log(JSON.stringify({ runId, cpuSeconds, rungs: rungs.map(r => ({ rung: r.rung, candidates: r.candidates.map(c => ({ candidate: c.candidate, passes: c.passes, examples: c.examples.map(e => ({ example: e.example, failed: e.gates.failed, ...Object.fromEntries(Object.entries(e.gates).filter(([k]) => !['pass', 'failed'].includes(k))) })) })), recognition: r.recognition.map(x => ({ candidate: x.candidate, nearest: x.nearestAcceptance, local: x.localAcceptance, nearbyWrong: x.nearbyWrongAcceptance, other: x.otherScoreAcceptance, margins: { ...x.margins, quantiles: undefined }, best: 'cutoff' in x ? x.cutoff.best : null })) })), thermometer: thermometer.map(t => ({ candidate: t.candidate, examples: t.examples.map(e => ({ example: e.example, agreement: e.metrics.agreement, reproduces: e.reproducesExperiment002 })) })) }, null, 2));
