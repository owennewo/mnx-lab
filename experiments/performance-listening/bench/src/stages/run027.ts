/** 027: one frozen live-confirmation change; old evidence verified, all new evidence run. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionFromJSON, decisionToJSON, positionFromJSON, positionToJSON, type DecisionJSON, type ScorePositionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { ASSESSMENT_EVALUATOR_2, evaluateAssessment2, type AssessmentReport2, type AssessmentEvaluation2 } from '../events/assessment2.ts';
import { FOLLOWING_EVALUATOR, evaluateFollowing, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates, cursorGates, costGates, pooledGates, STAGE_GATES } from '../events/gates.ts';
import type { PerformanceLabel } from '../events/label.ts';
import { readOracle, readOracle2 } from '../events/oracle.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain2, EVENT_CHAIN_2 } from '../listeners/eventChain2.ts';
import { EVENT_CHAIN_1 } from '../listeners/eventChain1.ts';
import type { Cost } from '../report/index.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { assetPath } from './stage1v2.ts';
import { readSlowedBarSet } from './slowedBar1.ts';

type Artifact = { path: string; sha256: string };
type ReportJSON = Omit<AssessmentReport2, 'notes' | 'tempo'> & { notes: DecisionJSON[]; tempo: Omit<AssessmentReport2['tempo'], 'intervals'> & { intervals: { from: ScorePositionJSON; to: ScorePositionJSON; seconds: number }[] } };
type Detail = { record: DecisionJSON[] | Artifact; report?: ReportJSON; assessmentArtifact?: Artifact; started?: { ok: boolean }; cost: Cost; following: FollowingEvaluation; assessment: AssessmentEvaluation2; causality?: { pass: boolean }[] };
type Pool = { label: PerformanceLabel; following: FollowingEvaluation | null; assessment: AssessmentEvaluation2 | null };
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const OLD_PATH = 'runs/g026-single-slowed-bar/summary.json';
const POLICY = 'contracts/development-contract-2.md';
const parseReport = (r: ReportJSON): AssessmentReport2 => ({ ...r, notes: r.notes.map(decisionFromJSON), tempo: { ...r.tempo, intervals: r.tempo.intervals.map(i => ({ ...i, from: positionFromJSON(i.from), to: positionFromJSON(i.to) })) } });
const reportJSON = (r: AssessmentReport2): ReportJSON => ({ ...r, notes: r.notes.map(decisionToJSON), tempo: { ...r.tempo, intervals: r.tempo.intervals.map(i => ({ ...i, from: positionToJSON(i.from), to: positionToJSON(i.to) })) } });
const musical = (r: ReportJSON) => ({ ...r, notes: r.notes.map(({ id: _id, ...n }) => n) });
const substage = (id: string) => /^(sb-|sil-sb-|w2-sb-)/.test(id) ? 'slowedBar' : /^(h-|sil-h-|w2-h-)/.test(id) ? 'hesitation' : 'stage1';
const gates = (label: PerformanceLabel, following: FollowingEvaluation | null, assessment: AssessmentEvaluation2 | null) => {
  const cursor = following ? cursorGates(label, following) : null, assess = assessmentGates(label, assessment);
  return { cursor: cursor?.failed ?? ['refused'], assessment: assess.failed, passed: !!cursor?.passed && assess.passed };
};
if (import.meta.url === `file://${process.argv[1]}`) {
  const [setDir, runId, preregistration] = process.argv.slice(2);
  if (!setDir || !runId || preregistration !== 'reports/027-live-confirmation.md' || !/^g027[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: run027.ts <set-dir> <new-run-id> reports/027-live-confirmation.md');
  const root = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  if (git('status', '--porcelain')) throw new Error('Commit all code before running');
  const reportPath = `experiments/performance-listening/${preregistration}`;
  git('cat-file', '-e', `HEAD:${reportPath}`);
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  if (git('show', `${preregCommit}:${reportPath}`) !== readFileSync(resolve(EXPERIMENT, preregistration), 'utf8').trim()) throw new Error('Pre-registration changed');
  const publicDir = resolve(EXPERIMENT, 'runs', runId), privateDir = join(requireOutsideGit(setDir), 'runs', runId);
  if (existsSync(publicDir) || existsSync(privateDir)) throw new Error('Run ID exists; never overwrite');
  const commit = git('rev-parse', 'HEAD'), startedAt = new Date().toISOString();
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const artifact = (name: string, data: unknown): Artifact => { const path = join(privateDir, name); writeFileSync(path, encode(data)); return { path, sha256: sha(readFileSync(path)) }; };
  artifact('attempt.json', { runId, commit, startedAt, state: 'started' });
  const results: Record<string, Record<string, unknown>> = { [EVENT_CHAIN_2]: {} };
  try {
    const { manifest, sha256 } = readSlowedBarSet(setDir);
    if (sha256 !== '553d4e7e62ebebacc63cb8fa7a735414490455d8a8eff19a3671eb36d96954db') throw new Error('Wrong frozen manifest');
    readOracle(); readOracle2();
    const verified = new Map<string, Artifact>();
    const verify = (a: Artifact): Buffer => { const b = readFileSync(a.path); if (sha(b) !== a.sha256) throw new Error(`Changed artifact ${a.path}`); verified.set(a.path, a); return b; };
    const oldBytes = readFileSync(resolve(EXPERIMENT, OLD_PATH)), old = JSON.parse(oldBytes.toString());
    if (old.set.sha256 !== sha256) throw new Error('Old set mismatch');
    const parentBytes = readFileSync(resolve(EXPERIMENT, old.regression.summary.path));
    if (sha(parentBytes) !== old.regression.summary.sha256) throw new Error('Changed parent citation');
    const parent = JSON.parse(parentBytes.toString());
    const oldValidation = JSON.parse(verify(old.regression.validation).toString());
    for (const a of oldValidation.verifiedArtifacts as Artifact[]) verify(a);
    if (!old.regression.reused || !oldValidation.reuse || oldValidation.changed.length) throw new Error('Unexpected old regression provenance');
    const producerPaths = git('ls-tree', '-r', '--name-only', old.gitCommit, '--', 'src/audio', 'src/model', 'experiments/performance-listening/listen', 'experiments/performance-listening/bench/src').split('\n').filter(p => p.endsWith('.ts'));
    const producerChecks = producerPaths.map(path => {
      const b = execFileSync('git', ['show', `${old.gitCommit}:${path}`], { cwd: root, maxBuffer: 32 << 20 });
      return { path, sha256: sha(b), unchanged: existsSync(resolve(root, path)) && sha(readFileSync(resolve(root, path))) === sha(b) };
    });
    // New listener sources require a fresh candidate run, but cannot alter the old producer closure.
    const changed = producerChecks.filter(c => !c.unchanged).map(c => c.path);
    const pinnedChecks = Object.entries(old.sourceHashes as Record<string, string>).map(([path, hash]) => {
      const bytes = execFileSync('git', ['show', `${old.gitCommit}:${relative(root, resolve(EXPERIMENT, path))}`], { cwd: root, maxBuffer: 32 << 20 });
      if (sha(bytes) !== hash) throw new Error(`Invalid old source hash ${path}`);
      const historical = path.startsWith('reports/') || path.startsWith('research/') || path === POLICY;
      const unchanged = sha(readFileSync(resolve(EXPERIMENT, path))) === hash;
      if (!historical && !unchanged) changed.push(path);
      return { path, recordedSha256: hash, unchanged, historical };
    });
    if (changed.length) throw new Error(`Actual old producers changed; comparator rerun required: ${changed.join(', ')}`);
    const regressions = JSON.parse(verify(old.perListener[EVENT_CHAIN_1].regressions).toString());
    const oldPool: Pool[] = [], pool: Pool[] = [], costs: Cost[] = [], oldCosts: Cost[] = [];
    const oldDetails: Record<string, { detail: Detail; record: DecisionJSON[]; report: ReportJSON; following: FollowingEvaluation; assessment: AssessmentEvaluation2 }> = {};
    let oldPrefixPass = true, oldPrefixes = 0;
    for (const e of manifest.examples) {
      let detail: Detail, expectedGates: unknown;
      const row = old.results[EVENT_CHAIN_1][e.id];
      if (row) { const a = JSON.parse(verify(row.artifact).toString()); detail = a.detail; expectedGates = a.gates; }
      else { detail = regressions[e.id].detail; expectedGates = regressions[e.id].gates; }
      const record = Array.isArray(detail.record) ? detail.record : JSON.parse(verify(detail.record).toString()).record as DecisionJSON[];
      const report = detail.report ?? JSON.parse(verify(detail.assessmentArtifact!).toString()) as ReportJSON;
      const following = evaluateFollowing(e.label, record.map(decisionFromJSON)), assessment = evaluateAssessment2(e.label, parseReport(report));
      if (encode(following) !== encode(detail.following) || encode(assessment) !== encode(detail.assessment) || encode(gates(e.label, following, assessment)) !== encode(expectedGates)) throw new Error(`Old evaluation differs ${e.id}`);
      const checks = detail.causality ?? parent.causality[`${EVENT_CHAIN_1} ${e.id}`];
      if (checks.length !== 6 || checks.some((c: { pass: boolean }) => !c.pass)) oldPrefixPass = false;
      oldPrefixes += checks.length;
      oldCosts.push(detail.cost); oldPool.push({ label: e.label, following, assessment });
      oldDetails[e.id] = { detail, record, report, following, assessment };
    }
    const validation = artifact('comparator-validation.json', { summary: { path: OLD_PATH, sha256: sha(oldBytes) }, parentSummary: old.regression.summary, producerChecks, pinnedChecks, changed, verifiedArtifacts: [...verified.values()], examples: manifest.examples.length, oldPrefixes, oldCostGates: costGates(oldPrefixPass, oldCosts), policyChange: { oldSha256: old.sourceHashes[POLICY], currentSha256: sha(readFileSync(resolve(EXPERIMENT, POLICY))), reason: 'User approved rising tide/stopping/other-bars flags after 026; instruments 3 are explicitly deferred to 028.' } });
    let prefixPassed = true, prefixCount = 0, passed = 0, identicalReports = 0, identicalMusicalReports = 0, identicalEvaluations = 0;
    const comparisons: Record<string, unknown> = {};
    for (const e of manifest.examples) {
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure, c = compilePerformance(score);
      if (!c.ok || c.performance.diagnostics.length) throw new Error('Score does not compile');
      const handoff = { from: topOfScore(c.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
      const audio = readWav(readFileSync(e.audioPath)); if (audio.length !== e.label.audio!.samples) throw new Error('Audio length differs');
      const candidate = new EventChain2(), run = executeSeam(() => candidate, score, handoff, audio, DELIVERY);
      const following = run.started.ok ? evaluateFollowing(e.label, run.record) : null;
      const report = run.started.ok ? reportJSON(candidate.assessment()) : null;
      const assessment = report ? evaluateAssessment2(e.label, parseReport(report)) : null;
      const checks = run.started.ok ? seamCausality(() => new EventChain2(), score, handoff, audio, DELIVERY, run.record) : [];
      prefixCount += checks.length; if (checks.length !== 6 || checks.some(c => !c.pass)) prefixPassed = false;
      if (run.cost) costs.push(run.cost);
      const verdict = gates(e.label, following, assessment); if (verdict.passed) passed++;
      const original = oldDetails[e.id]!;
      const musicalEqual = report !== null && encode(musical(report)) === encode(musical(original.report));
      const reportEqual = encode(report) === encode(original.report), evaluationEqual = encode(assessment) === encode(original.assessment);
      if (reportEqual) identicalReports++; if (musicalEqual) identicalMusicalReports++; if (evaluationEqual) identicalEvaluations++;
      const delayChanges = following?.byEvent.events.map((event, i) => ({ index: i, old: original.following.byEvent.events[i]!.delay, fresh: event.delay, change: event.delay !== null && original.following.byEvent.events[i]!.delay !== null ? event.delay - original.following.byEvent.events[i]!.delay! : null })) ?? [];
      const comparison = { identicalReport: reportEqual, identicalMusicalReport: musicalEqual, identicalEvaluation: evaluationEqual, delayChanges, oldAbstained: original.following.asDecided.seconds.abstained, freshAbstained: following?.asDecided.seconds.abstained ?? null };
      comparisons[e.id] = comparison;
      const a = artifact(`event-chain-2.${e.id}.json`, { listener: EVENT_CHAIN_2, example: e.id, started: run.started, record: run.record.map(decisionToJSON), report, following, assessment, cost: run.cost, causality: checks, gates: verdict, comparison });
      results[EVENT_CHAIN_2][e.id] = { kind: e.kind, control: e.control, substage: substage(e.id), gates: verdict, artifact: a };
      pool.push({ label: e.label, following, assessment });
      console.log(`${e.id}: cursor ${verdict.cursor.join(',') || 'pass'} assessment ${verdict.assessment.join(',') || 'pass'}`);
    }
    const group = (ps: Pool[]) => Object.fromEntries(['stage1', 'hesitation', 'slowedBar'].map(name => [name, { examples: ps.filter(p => substage(p.label.id) === name).length, passed: ps.filter(p => substage(p.label.id) === name && gates(p.label, p.following, p.assessment).passed).length, pooled: pooledGates(ps.filter(p => substage(p.label.id) === name)) }]));
    const bySubstage = group(pool), oldBySubstage = group(oldPool), pooled = pooledGates(pool), cost = costGates(prefixPassed, costs);
    const comparisonArtifact = artifact('comparisons.json', comparisons);
    const sources = [...new Set([...Object.keys(old.sourceHashes as Record<string, string>).filter(p => !p.startsWith('reports/') && !p.startsWith('research/')), ...producerPaths.map(p => relative(EXPERIMENT, resolve(root, p))), 'bench/src/listeners/eventChain2.ts', 'bench/src/stages/run027.ts', 'bench/test/event-chain-2.test.ts', preregistration, 'research/live-confirmation-027.md'])];
    const cites = ['runs/g025-single-hesitation/summary.json', OLD_PATH].map(path => ({ path, sha256: sha(readFileSync(resolve(EXPERIMENT, path))), use: 'Frozen baseline sweep-only evidence, no fresh baseline execution.' }));
    const summary = { id: runId, kind: 'stage-listener', policy: 'development-contract-2', modelAndTool: 'Sol 6.1 (high) in Codex', preregistration, preregistrationCommit: preregCommit, gitCommit: commit, startedAt, finishedAt: new Date().toISOString(), evaluators: { following: FOLLOWING_EVALUATOR, assessment: ASSESSMENT_EVALUATOR_2, gates: STAGE_GATES }, suite: { mode: 'routine repair; all substages in full pending 028 sentinels', frozenBaselines: 'sweep-only' }, set: { id: manifest.id, dir: setDir, sha256, freeze: JSON.parse(readFileSync(join(setDir, 'freeze.json'), 'utf8')) }, delivery: DELIVERY, listeners: [EVENT_CHAIN_2], comparator: { listener: EVENT_CHAIN_1, summary: { path: OLD_PATH, sha256: sha(oldBytes) }, validation, bySubstage: oldBySubstage, cost: costGates(oldPrefixPass, oldCosts), prefixes: oldPrefixes, reused: true, freshTiming: false }, baselineCitations: cites, results,
      perListener: { [EVENT_CHAIN_2]: { pooled, bySubstage, cost, counts: { examples: pool.length, passed, prefixes: prefixCount, identicalReports, identicalMusicalReports, identicalEvaluations }, comparisons: comparisonArtifact, freshCost: { machine: costs[0]?.machine, maxSustained: Math.max(...costs.map(c => c.sustainedRatio)), maxP99Ms: Math.max(...costs.map(c => c.p99Ms)), maxBacklogMs: Math.max(...costs.map(c => c.maxBacklogMs)) }, passed: pool.length === 264 && passed === 264 && prefixCount === 1584 && pooled.every(g => g.passed) && Object.values(bySubstage).every(g => g.pooled.every(p => p.passed)) && cost.passed } }, sourceHashes: Object.fromEntries(sources.map(p => [p, sha(readFileSync(resolve(EXPERIMENT, p)))])) };
    writeFileSync(join(publicDir, 'summary.json'), JSON.stringify(summary) + '\n');
    artifact('attempt.json', { runId, commit, startedAt, state: 'completed', summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))) });
    console.log(`Completed ${runId}; public bytes ${readFileSync(join(publicDir, 'summary.json')).length}`);
  } catch (error) {
    const failure = { runId, commit, startedAt, state: 'failed', error: String(error), results };
    artifact('failure.json', failure); writeFileSync(join(publicDir, 'attempt.json'), encode(failure)); throw error;
  }
}
