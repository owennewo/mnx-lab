// The development scoreboard of development contract 1:
//   tsx src/ladder/scoreboard.ts <run-id> <report-slug> <ladder-dir> <frozen-002-set-dir>
// Runs every candidate over every built rung, the recognition measure at exact labels,
// and the real-clip thermometer. Refuses to run until the code, the development
// contract and the experiment's pre-registration are committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { evaluate } from '../evaluate/index.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { evaluateProxy } from '../proxy/reference.ts';
import { machine } from '../run/runner.ts';
import { type Decision, type Golden, value } from '../types.ts';
import { asGolden, gates } from './goldens.ts';
import { readProxySet, readRungSet, requireOutsideGit, sha } from './privateSets.ts';
import { recognitionAtLabels, recognitionOltw } from './recognition.ts';
import { cachePath, comparable, fingerprint, readCached, writeCached } from './cache.ts';
import { CANDIDATES } from './candidates.ts';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational as exact } from '../../../../../src/audio/time.ts';
import type { Decision as SeamDecision, Handoff } from '../../../listen/contract.ts';
import { decisionToJSON, type DecisionJSON } from '../../../listen/json.ts';
import { liveView } from '../../../listen/liveView.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { legacyListener } from '../seam/legacy.ts';
import { toV1Record } from '../seam/records.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { replayThroughSeam } from '../seam/replay.ts';
import { seamFixtures } from '../seam/fixtures.ts';
import { deliverAs, RESAMPLER_TAPS } from '../../../listen/delivery.ts';
import { decisionFromJSON } from '../../../listen/json.ts';
const SEAM_DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const performanceOf = (s: MnxStructure) => { const c = compilePerformance(s); if (!c.ok) throw new Error('Score does not compile'); return c.performance; };
const handoffFor = (s: MnxStructure, bpm: number): Handoff => ({ from: topOfScore(performanceOf(s)), parts: partIds(s), tempo: { quartersPerMinute: exact(BigInt(bpm)) }, rate: 1 });
const seamRecords: Record<string, DecisionJSON[] | null> = {};
import { pluckedReferenceFrames } from '../candidates/onlineTimeWarp3.ts';
import { CLOCK_VERSION } from '../candidates/clockFollower.ts';
import { SPECTRAL_1 } from '../candidates/spectralFollower1.ts';

const full = process.argv.includes('--full');
const reproduceAt = process.argv.indexOf('--reproduce'), reproduceRun = reproduceAt >= 0 ? process.argv[reproduceAt + 1] : null;
const [runId, slug, ladderDir, proxyDir] = process.argv.slice(2).filter((a, i, all) => a !== '--full' && a !== '--reproduce' && all[i - 1] !== '--reproduce');
// The active suite: which entries run and which frozen examples they run on. --full runs everything.
const suite = JSON.parse(readFileSync(new URL('./suite.json', import.meta.url), 'utf8')) as { entries: string[]; examples: Record<string, string[]> };
const ENTRIES = full ? CANDIDATES : CANDIDATES.filter(c => suite.entries.includes(c.id));
if (!full && ENTRIES.length !== suite.entries.length) throw new Error('suite.json names an entry that is not registered');
const CAUSALITY_MODE = full ? 'every-example' : 'one-positive-per-rung';
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


const rungDirs = readdirSync(ladderDir).filter(d => /^rung-\d+$/.test(d)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
if (!rungDirs.length) throw new Error('No built rung');
const proxy = readProxySet(proxyDir);

const score = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as MnxStructure;

const cpuStart = process.cpuUsage();
const records: Record<string, Decision[]> = {}, evaluations: Record<string, unknown> = {}, recognitionRows: Record<string, unknown> = {};
/** The exact score position at audio time t, read from a golden's supported intervals. */
function labelledPosition(golden: Golden) {
  const supported = golden.labels.following.filter(l => l.state === 'supported');
  return (t: number) => {
    const l = supported.find(x => t >= x.start && t <= x.end) ?? (t < supported[0]!.start ? supported[0]! : supported.at(-1)!);
    if (l.state !== 'supported') throw new Error('unreachable');
    return value(l.truth.atStart) + (t - l.start) * value(l.truth.quartersPerSecond);
  };
}

const rungs = rungDirs.map(dir => {
  const frozen = readRungSet(join(ladderDir, dir)), sha256 = frozen.sha256;
  const active = full ? null : suite.examples[frozen.manifest.id];
  if (!full && !active) throw new Error(`suite.json does not list ${frozen.manifest.id}`);
  if (active?.some(id => !frozen.manifest.examples.some(e => e.id === id))) throw new Error(`suite.json names an unknown example in ${frozen.manifest.id}`);
  const manifest = { ...frozen.manifest, examples: frozen.manifest.examples.filter(e => !active || active.includes(e.id)) };
  const kindOf = (e: typeof manifest.examples[number]) => e.kind ?? (e.id as 'positive' | 'wrong-score' | 'silence');
  const groupOf = (e: typeof manifest.examples[number]) => e.group ?? 'fixed';
  const causalityExample = manifest.examples.find(e => kindOf(e) === 'positive')!;
  const candidates = ENTRIES.map(c => {
    const print = fingerprint(c.module);
    // Causality is a property of the listener's code, so the slim suite checks it once per rung.
    // Every entry runs through the seam: wrapped as a version-2 listener, delivered by the
    // seam runner, and translated back to version 1 for the frozen evaluator.
    const listener = legacyListener(c.factory, c.legacy);
    let rungCausality: ReturnType<typeof seamCausality> | null = null;
    const causalityFor = (e: typeof manifest.examples[number], s: MnxStructure, handoff: Handoff, audio: Float32Array, record: SeamDecision[]) => {
      if (CAUSALITY_MODE === 'every-example') return seamCausality(listener, s, handoff, audio, SEAM_DELIVERY, record);
      if (e.id === causalityExample.id) return (rungCausality = seamCausality(listener, s, handoff, audio, SEAM_DELIVERY, record));
      return rungCausality ??= (() => { const ce = causalityExample, cs = score(ce.scorePath), ch = handoffFor(cs, ce.golden.intended.tempo.bpm), ca = readWav(readFileSync(ce.audioPath));
        return seamCausality(listener, cs, ch, ca, SEAM_DELIVERY, executeSeam(listener, cs, ch, ca, SEAM_DELIVERY).record); })();
    };
    const compute = (e: typeof manifest.examples[number]) => {
      const s = score(e.scorePath), audio = readWav(readFileSync(e.audioPath)), handoff = handoffFor(s, e.golden.intended.tempo.bpm);
      const stats = { clamped: 0, droppedNotes: 0 };
      const run = executeSeam(legacyListener(c.factory, c.legacy, stats), s, handoff, audio, SEAM_DELIVERY);
      if (!run.started.ok || !run.cost) throw new Error(`${c.id} refused ${e.id}: ${run.started.ok ? 'no cost' : run.started.refused}`);
      const v1 = toV1Record(performanceOf(s), run.record);
      const checks = causalityFor(e, s, handoff, audio, run.record);
      const evaluation = evaluate(asGolden(e.golden), v1);
      // The display rule Studio will use must show exactly what the evaluator scored.
      const agreement = evaluation.asDecided.points.every(p => (liveView(run.record, p.time)?.id ?? null) === p.decision);
      const result = { example: e.id, kind: kindOf(e), group: groupOf(e), gates: gates(evaluation, run.cost, checks), counts: evaluation.asDecided.counts, denominators: evaluation.asDecided.denominators,
        errors: { ...evaluation.asDecided.errors, values: undefined }, losses: evaluation.asDecided.losses.length,
        exposure: evaluation.exposure, timeliness: { ...evaluation.timeliness, delays: undefined }, cost: run.cost, causality: checks,
        seam: { agreement, clampedPositions: stats.clamped } };
      return { result: JSON.parse(JSON.stringify(result)) as typeof result, record: v1, seamRecord: run.record.map(decisionToJSON), evaluation };
    };
    const paths = manifest.examples.map(e => cachePath(ladderDir, c.id, CAUSALITY_MODE === 'every-example' ? print.hash : `rc-${print.hash}`, sha256, e.id));
    const cached = paths.map(p => readCached<ReturnType<typeof compute>['result']>(p));
    let spotCheck: { example: string; reproduced: true } | null = null;
    if (cached.some(Boolean)) {
      // Reuse is allowed only if one reused example recomputes to exactly the same result.
      const i = cached.findIndex(Boolean), fresh = compute(manifest.examples[i]!);
      if (comparable(fresh.result) !== comparable(cached[i]!.result)) throw new Error(`Cached result for ${c.id} on ${dir}/${manifest.examples[i]!.id} does not reproduce`);
      spotCheck = { example: manifest.examples[i]!.id, reproduced: true };
    }
    const examples = manifest.examples.map((e, i) => {
      const hit = cached[i];
      const entry = hit ?? { ...compute(e), sourceRun: runId };
      if (!hit) writeCached(paths[i]!, entry);
      records[`${dir}/${c.id}/${e.id}`] = entry.record as Decision[]; evaluations[`${dir}/${c.id}/${e.id}`] = entry.evaluation;
      seamRecords[`${dir}/${c.id}/${e.id}`] = entry.seamRecord ?? null;
      return { ...entry.result, computedIn: hit ? hit.sourceRun : runId };
    });
    return { candidate: c.id, diagnostic: c.diagnostic ?? false, fingerprint: print.hash, cache: { reused: cached.filter(Boolean).length, computed: cached.filter(x => !x).length, spotCheck }, examples };
  }).map(c => {
    const clean = (group: string) => c.examples.filter(e => e.group === group).every(e => e.gates.failed.length === 0);
    return { ...c, passes: c.examples.every(e => e.gates.failed.length === 0),
      passesByGroup: { development: clean('development'), heldOut: clean('held-out'), fixed: clean('fixed') },
      // The contract's verdict: every held-out example, and every fixed control, meets every gate.
      rungVerdict: clean('held-out') && clean('fixed') };
  });
  const wrongScore = manifest.examples.find(e => kindOf(e) === 'wrong-score')!;
  const recognition = ENTRIES.filter(c => c.recognition).map(c => ({
    candidate: c.id,
    examples: manifest.examples.filter(e => kindOf(e) === 'positive').map(positive => {
      const audio = readWav(readFileSync(positive.audioPath)), at = labelledPosition(asGolden(positive.golden)), handed = positive.golden.intended.tempo.bpm;
      const r = c.recognition === 'oltw' || c.recognition === 'oltw3'
        ? recognitionOltw(audio, score(positive.scorePath), score(wrongScore.scorePath), at, handed, c.recognition === 'oltw3' ? pluckedReferenceFrames : undefined)
        : recognitionAtLabels(audio, score(positive.scorePath), score(wrongScore.scorePath), c.recognition as 1 | 2, at, handed);
      recognitionRows[`${dir}/${c.id}/${positive.id}`] = r.rows;
      return { example: positive.id, group: groupOf(positive), ...r, rows: undefined };
    }),
  }));
  return { rung: manifest.rung, set: manifest.id, sha256, candidates, recognition };
});

// ---- The Studio seam, exercised on every run (SEAM.md part 1). Checks on the seam, never
// candidate metrics: a candidate cannot fail the ladder because of them.

// S6: every example's record replayed through ListeningBackend inside PlaybackSession.
for (const r of rungs) {
  const dir = rungDirs.find(d => readRungSet(join(ladderDir, d)).sha256 === r.sha256)!;
  const manifest = readRungSet(join(ladderDir, dir)).manifest;
  for (const c of r.candidates) {
    let checked = 0; const failures: string[] = [];
    for (const e of c.examples) {
      const key = `${dir}/${c.candidate}/${e.example}`, stored = seamRecords[key];
      if (!stored) { failures.push(`${e.example}: no seam record`); continue; }
      const example = manifest.examples.find(x => x.id === e.example)!;
      const points = (evaluations[key] as { asDecided: { points: { time: number; decision: string | null }[] } }).asDecided.points;
      const result = await replayThroughSeam(performanceOf(score(example.scorePath)), stored.map(decisionFromJSON), points);
      checked += result.checked; failures.push(...result.failures.slice(0, 3).map(f => `${e.example} ${f}`));
    }
    Object.assign(c, { seamReplay: { checked, failures } });
  }
}

// S7: every entry answers the navigation fixtures, following on the correct pass or refusing.
const fixtureAnswers = seamFixtures(repo).flatMap(f => ENTRIES.map(c => {
  const run = executeSeam(legacyListener(c.factory, c.legacy), f.score, f.handoff, f.audio, SEAM_DELIVERY);
  if (!run.started.ok) return { fixture: f.id, entry: c.id, answer: 'refused' as const, reason: run.started.refused };
  const g = gates(evaluate(asGolden(f.golden), toV1Record(performanceOf(f.score), run.record)), run.cost!, [{ pass: true }]);
  return { fixture: f.id, entry: c.id, answer: g.supportedCorrect !== null && g.supportedCorrect >= 0.95 ? 'follows' as const : 'fails' as const, supportedCorrect: g.supportedCorrect };
}));

// S9: the rung-0 clip delivered at 48 kHz/480, 48 kHz/128 and 44.1 kHz/128 through the
// delivery adapter. 48/480 must equal direct delivery; 48/128 must give the same decisions,
// each at most one block later; 44.1 kHz positions must agree within the tolerance.
const deliveryChecks = (() => {
  const rung0 = readRungSet(join(ladderDir, 'rung-0')).manifest, example = rung0.examples.find(e => e.id === 'positive')!;
  const s = score(example.scorePath), handoff = handoffFor(s, example.golden.intended.tempo.bpm), audio48 = readWav(readFileSync(example.audioPath));
  const cached = join(ladderDir, 'cache', 'seam', `${sha(readFileSync(example.audioPath)).slice(0, 16)}-44100.s16`);
  if (!existsSync(cached)) { mkdirSync(dirname(cached), { recursive: true }); writeFileSync(cached, execFileSync('ffmpeg', ['-v', 'error', '-i', example.audioPath, '-af', 'aresample=resampler=soxr', '-ar', '44100', '-f', 's16le', '-acodec', 'pcm_s16le', '-'], { maxBuffer: 1 << 28 })); }
  const bytes = readFileSync(cached), audio44 = Float32Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readInt16LE(2 * i) / 32768);
  const perf = performanceOf(s), json = (r: readonly SeamDecision[]) => JSON.stringify(r.map(decisionToJSON));
  const quarter = (d: SeamDecision | undefined): number | null => {
    if (d?.kind !== 'position') return null;
    const v1 = toV1Record(perf, [d])[0]!;
    return v1.kind === 'position' ? value(v1.candidates[0]!.position.quarters) : null;
  };
  return ENTRIES.map(c => {
    const direct = seamRecords[`rung-0/${c.id}/positive`]!.map(decisionFromJSON);
    const via = (audio: Float32Array, delivery: { sampleRate: number; chunkSamples: number }) => {
      const factory = deliverAs(legacyListener(c.factory, c.legacy), SEAM_DELIVERY), run = executeSeam(factory, s, handoff, audio, delivery);
      if (!run.started.ok) throw new Error(`${c.id} refused delivery ${delivery.sampleRate}/${delivery.chunkSamples}: ${run.started.refused}`);
      return { run, causality: seamCausality(factory, s, handoff, audio, delivery, run.record).every(x => x.pass) };
    };
    const a = via(audio48, { sampleRate: 48000, chunkSamples: 480 }), b = via(audio48, { sampleRate: 48000, chunkSamples: 128 }), h = via(audio44, { sampleRate: 44100, chunkSamples: 128 });
    const strip = (r: readonly SeamDecision[]) => json(r.map(d => ({ ...d, madeAt: 0 })));
    const lag = Math.max(0, ...b.run.record.map((d, i) => d.madeAt - (a.run.record[i]?.madeAt ?? Infinity)));
    const grid = Array.from({ length: Math.floor(audio48.length / 2400) }, (_, k) => (k + 1) * 0.05).filter(t => t >= 0.15);
    let both = 0, within = 0, sameSupport = 0;
    for (const t of grid) {
      const x = quarter(liveView(a.run.record, t)), y = quarter(liveView(h.run.record, t));
      if ((x === null) === (y === null)) sameSupport++;
      if (x !== null && y !== null) { both++; if (Math.abs(x - y) <= 0.25 + 1e-9) within++; }
    }
    const meanLag = (r: readonly SeamDecision[]) => r.reduce((sum, d) => sum + d.madeAt - d.refersTo, 0) / Math.max(1, r.length);
    return { entry: c.id,
      '48000/480': { equalsDirect: json(a.run.record) === json(direct), causality: a.causality },
      '48000/128': { sameDecisions: strip(b.run.record) === strip(a.run.record), maxExtraMadeAtSeconds: lag, withinOneBlock: lag < 128 / 48000 + 1e-12, causality: b.causality },
      '44100/128': { causality: h.causality, gridPoints: grid.length, bothPositions: both, positionsWithinTolerance: within, sameSupportState: sameSupport,
        addedDelaySeconds: meanLag(h.run.record) - meanLag(a.run.record), resamplerDelaySeconds: RESAMPLER_TAPS / 44100 } };
  });
})();

// The thermometer: the real Winner clip under the sync-proxy evaluator. Recorded on every
// run, never used to select. Frozen candidates should reproduce experiment 002 exactly.
const recorded002: Record<string, { example: string; metrics: unknown }[]> = {};
for (const [runName, side, id] of [['g002a-spectral1-winner-sync-proxy', 'comparator', CLOCK_VERSION], ['g002a-spectral1-winner-sync-proxy', 'candidate', SPECTRAL_1], ['g002b-spectral2-winner-sync-proxy', 'candidate', 'spectral-follower@2']] as const) {
  recorded002[id] = JSON.parse(readFileSync(join(EXPERIMENT, 'runs', runName, 'summary.json'), 'utf8'))[side].examples;
}
const thermometer = ENTRIES.map(c => ({
  candidate: c.id,
  examples: proxy.manifest.examples.map(e => {
    const s = score(e.scorePath), seam = executeSeam(legacyListener(c.factory, c.legacy), s, handoffFor(s, proxy.manifest.nominalBpm), readWav(readFileSync(e.audioPath)), SEAM_DELIVERY);
    if (!seam.started.ok) throw new Error(`${c.id} refused the thermometer: ${seam.started.refused}`);
    const run = { record: toV1Record(performanceOf(s), seam.record) };
    const metrics = evaluateProxy(e.reference, run.record).summary;
    const before = recorded002[c.id]?.find(x => x.example === e.id)?.metrics;
    return { example: e.id, metrics, reproducesExperiment002: before === undefined ? null : JSON.stringify(before) === JSON.stringify(metrics) };
  }),
}));

// --reproduce: every result this run shares with an earlier run must be identical to it,
// apart from measured processing cost. The seam's regression test.
const reproduction = reproduceRun ? (() => {
  const earlier = JSON.parse(readFileSync(join(EXPERIMENT, 'runs', reproduceRun, 'summary.json'), 'utf8')) as { rungs: { sha256: string; candidates: { candidate: string; examples: { example: string; gates: object }[] }[] }[] };
  let compared = 0; const mismatches: string[] = [];
  for (const r of rungs) for (const c of r.candidates) {
    const before = earlier.rungs.find(x => x.sha256 === r.sha256)?.candidates.find(x => x.candidate === c.candidate);
    for (const e of c.examples) {
      const old = before?.examples.find(x => x.example === e.example);
      if (!old) continue;
      compared++;
      if (comparable(old) !== comparable(e)) mismatches.push(`rung ${r.rung} ${c.candidate} ${e.example}`);
    }
  }
  return { run: reproduceRun, compared, identical: compared - mismatches.length, mismatches };
})() : null;
const cpu = process.cpuUsage(cpuStart), cpuSeconds = (cpu.user + cpu.system) / 1e6;
mkdirSync(privateOut, { recursive: true });
writeFileSync(join(privateOut, 'records.json'), encode(records));
writeFileSync(join(privateOut, 'evaluations.json'), encode(evaluations));
writeFileSync(join(privateOut, 'recognition.json'), encode(recognitionRows));
writeFileSync(join(privateOut, 'seam-records.json'), encode(seamRecords));
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]);
const sourceFiles = [...files(join(EXPERIMENT, 'bench/src')), join(EXPERIMENT, 'contracts/development-contract-1.md')];
const summary = {
  id: runId, kind: 'development-scoreboard', policy: 'development-contract-1', preregistration: `reports/${slug}.md`,
  suite: full ? 'full' : suite, causality: CAUSALITY_MODE, seam: { vocabulary: 'listening-vocabulary@2', delivery: SEAM_DELIVERY, reproduction, fixtureAnswers, deliveryChecks },
  gitCommit: git('rev-parse', 'HEAD'), machine: machine(),
  sourceHashes: Object.fromEntries(sourceFiles.map(p => [p.slice(EXPERIMENT.length), sha(readFileSync(p))])),
  rungs, thermometer: { set: proxy.manifest.id, sha256: proxy.sha256, evaluator: 'sync-proxy-evaluator@1', use: 'recorded, never used to select', candidates: thermometer },
  cpuSeconds,
  privateHashes: Object.fromEntries(['records.json', 'seam-records.json', 'evaluations.json', 'recognition.json'].map(f => [f, sha(readFileSync(join(privateOut, f)))])),
};
mkdirSync(publicOut, { recursive: true });
writeFileSync(join(publicOut, 'summary.json'), encode(summary));
console.log(JSON.stringify({ runId, cpuSeconds, rungs: rungs.map(r => ({ rung: r.rung, candidates: r.candidates.map(c => ({ candidate: c.candidate, rungVerdict: c.rungVerdict, passesByGroup: c.passesByGroup,
  failing: c.examples.filter(e => e.gates.failed.length).map(e => `${e.example}: ${e.gates.failed.join('+')}`) })) })),
  thermometer: thermometer.map(t => ({ candidate: t.candidate, examples: t.examples.map(e => ({ example: e.example, agreement: e.metrics.agreement, reproduces: e.reproducesExperiment002 })) })) }, null, 2));
if (reproduction?.mismatches.length) { console.error(`Does not reproduce ${reproduction.run}: ${reproduction.mismatches.join('; ')}`); process.exitCode = 1; }
