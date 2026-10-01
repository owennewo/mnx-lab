/** 030: unchanged listener outputs judged by the independently audited current instruments. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionFromJSON, decisionToJSON, positionFromJSON, positionToJSON, type DecisionJSON, type ScorePositionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { evaluateAssessment2, type AssessmentReport2 } from '../events/assessment2.ts';
import { evaluateAssessment3, type AssessmentEvaluation3, type AssessmentReport3 } from '../events/assessment3.ts';
import { evaluateFollowing, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates2, chooseSentinels, costGates, cursorGates, exampleMargin, nextState, pooledGates2, type Status } from '../events/gates2.ts';
import type { PerformanceLabel } from '../events/label.ts';
import { readOracle4 } from '../events/oracle4.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain2, EVENT_CHAIN_2 } from '../listeners/eventChain2.ts';
import type { Cost } from '../report/index.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { readFourBarTempo, FOUR_BAR_SET } from './fourBarTempo1.ts';
import { promoteReport030 } from './report030.ts';
import { readSlowedBarSet, SLOWED_BAR_SET } from './slowedBar1.ts';
import { assetPath, type StageExample2 } from './stage1v2.ts';

const PREREG = 'reports/030-current-instruments.md';
const OLD = 'runs/g027a-live-confirmation/summary.json';
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
type Artifact = { path: string; sha256: string };
type ReportJSON = Omit<AssessmentReport2, 'notes' | 'tempo'> & { notes: DecisionJSON[]; tempo: Omit<AssessmentReport2['tempo'], 'intervals'> & { intervals: { from: ScorePositionJSON; to: ScorePositionJSON; seconds: number }[] } };
const parseReport = (r: ReportJSON): AssessmentReport2 => ({ ...r, notes: r.notes.map(decisionFromJSON), tempo: { ...r.tempo, intervals: r.tempo.intervals.map(i => ({ ...i, from: positionFromJSON(i.from), to: positionFromJSON(i.to) })) } });
const serializeReport = (r: AssessmentReport2 | AssessmentReport3) => ({ ...r, notes: r.notes.map(decisionToJSON), tempo: { ...r.tempo, intervals: r.tempo.intervals.map(i => ({ ...i, from: positionToJSON(i.from), to: positionToJSON(i.to) })) } });
const groupOf = (id: string) => id.includes('s3-') ? 'four-bar-tempo-revalidation' : /^(sb-|sil-sb-|w2-sb-)/.test(id) ? 'slowedBar' : /^(h-|sil-h-|w2-h-)/.test(id) ? 'hesitation' : 'stage1';
const verdict = (label: PerformanceLabel, following: FollowingEvaluation | null, assessment: AssessmentEvaluation3 | null) => {
  const cursor = following ? cursorGates(label, following) : null, assess = assessmentGates2(label, assessment);
  return { cursor: cursor?.failed ?? ['refused'], assessment: assess.failed, passed: !!cursor?.passed && assess.passed };
};
type Row = { example: StageExample2; label: PerformanceLabel; following: FollowingEvaluation | null; assessment: AssessmentEvaluation3 | null;
  cost: Cost | null; causality: { pass: boolean }[]; gates: ReturnType<typeof verdict>; artifact: Artifact; reused: boolean };

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dataRoot, runId] = process.argv.slice(2);
  if (!dataRoot || !runId || !/^g030[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: run030.ts <private-data-root> <new-run-id>');
  const repo = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  if (git('status', '--porcelain')) throw new Error('Commit implementation before running');
  const commit = git('rev-parse', 'HEAD'), reportPath = `experiments/performance-listening/${PREREG}`;
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  assert.equal(git('show', `${preregCommit}:${reportPath}`), readFileSync(join(EXPERIMENT, PREREG), 'utf8').trim());
  const privateDir = join(requireOutsideGit(dataRoot), 'diagnostic-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
  if (existsSync(privateDir) || existsSync(publicDir)) throw new Error('Run ID exists; never overwrite');
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const start = performance.now(), startedAt = new Date().toISOString();
  const artifact = (name: string, value: unknown): Artifact => {
    const path = join(privateDir, name); writeFileSync(path, encode(value)); return { path, sha256: sha(readFileSync(path)) };
  };
  const paths = git('ls-files', '--', 'src/audio', 'src/model', 'experiments/performance-listening/listen',
    'experiments/performance-listening/bench/src', 'experiments/performance-listening/bench/oracle-events',
    'experiments/performance-listening/contracts', 'experiments/performance-listening/sources',
    'experiments/performance-listening/bench/suite-record.json').split('\n').filter(p => /\.(ts|json|md)$/.test(p));
  const sourceHashes = Object.fromEntries([...paths, reportPath].map(p => [relative(EXPERIMENT, resolve(repo, p)), sha(readFileSync(resolve(repo, p)))]));
  const common = { id: runId, kind: 'listener-revalidation', modelAndTool: 'Sol 6.1 (high) in Codex', preregistration: PREREG,
    preregistrationCommit: preregCommit, gitCommit: commit, startedAt, sourceHashes,
    evaluators: { following: 'following-evaluator@2', assessment: 'assessment-evaluator@3', gates: 'stage-gates@2', oracle: 'event-oracle@4' },
    listeners: [EVENT_CHAIN_2], delivery: DELIVERY, suiteMode: 'routine diagnostic: all attempted revalidation sets; no full sweep' };
  const attempt = artifact('attempt.json', { runId, commit, startedAt, state: 'started' });
  const rows: Row[] = [];
  try {
    readOracle4();
    const suiteBytes = readFileSync(join(EXPERIMENT, 'bench/suite-record.json')), suite = JSON.parse(suiteBytes.toString());
    assert.equal(suite.retiredSets.length, 0);
    const historic = readSlowedBarSet(join(dataRoot, SLOWED_BAR_SET)), fresh = readFourBarTempo(join(dataRoot, FOUR_BAR_SET));
    assert.equal(historic.sha256, '553d4e7e62ebebacc63cb8fa7a735414490455d8a8eff19a3671eb36d96954db');
    assert.equal(fresh.sha256, '870363f2f36aa19a13aeee4d0faccff4e59d55ff8183fe8c32c868a803b5b60e');
    assert.equal(fresh.manifest.examples.length, 252);
    const verify = (a: Artifact) => { const bytes = readFileSync(a.path); assert.equal(sha(bytes), a.sha256, a.path); return bytes; };
    const oldBytes = readFileSync(join(EXPERIMENT, OLD)), old = JSON.parse(oldBytes.toString());
    assert.equal(old.set.sha256, historic.sha256);
    // Hash all existing TypeScript producers, not only the listener's top-level module.
    const producers = git('ls-tree', '-r', '--name-only', old.gitCommit, '--', 'src/audio', 'src/model',
      'experiments/performance-listening/listen', 'experiments/performance-listening/bench/src').split('\n').filter(p => p.endsWith('.ts'));
    const producerChecks = producers.map(path => {
      const pinned = execFileSync('git', ['show', `${old.gitCommit}:${path}`], { cwd: repo, maxBuffer: 32 << 20 });
      return { path, sha256: sha(pinned), unchanged: existsSync(resolve(repo, path)) && sha(readFileSync(resolve(repo, path))) === sha(pinned) };
    });
    const pinnedChecks = Object.entries(old.sourceHashes as Record<string, string>).map(([path, hash]) => {
      const bytes = execFileSync('git', ['show', `${old.gitCommit}:${relative(repo, resolve(EXPERIMENT, path))}`], { cwd: repo, maxBuffer: 32 << 20 });
      assert.equal(sha(bytes), hash, `Recorded source ${path}`); return { path, sha256: hash };
    });
    const reuse = producerChecks.every(c => c.unchanged);
    const auditPath = 'bench/oracle-events/audit-4.md';
    const audit = { path: auditPath, sha256: sha(readFileSync(join(EXPERIMENT, auditPath))) };
    const baselineCitations = suite.baselinePolicy.citations.map((c: Artifact) => {
      assert.equal(sha(readFileSync(join(EXPERIMENT, c.path))), c.sha256); return c;
    });
    const validation = artifact('reuse-validation.json', { oldSummary: { path: OLD, sha256: sha(oldBytes) }, producerChecks, pinnedChecks,
      reuse, audit, baselineCitations, manifests: [historic.sha256, fresh.sha256], suite: { path: 'bench/suite-record.json', sha256: sha(suiteBytes) } });
    const examples = [...historic.manifest.examples, ...fresh.manifest.examples];
    assert.equal(new Set(examples.map(e => e.id)).size, 516);
    for (const e of examples) {
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure;
      let following: FollowingEvaluation | null, raw: AssessmentReport2 | null, record: DecisionJSON[], cost: Cost | null, causality: { pass: boolean }[];
      const reused = reuse && groupOf(e.id) !== 'four-bar-tempo-revalidation';
      let citation: Artifact | null = null;
      if (reused) {
        citation = old.results[EVENT_CHAIN_2][e.id].artifact;
        const d = JSON.parse(verify(citation!).toString());
        assert.equal(d.listener, EVENT_CHAIN_2); assert.equal(d.example, e.id); assert(d.started.ok);
        record = d.record; raw = parseReport(d.report as ReportJSON); cost = d.cost; causality = d.causality;
        following = evaluateFollowing(e.label, record.map(decisionFromJSON));
        assert.equal(encode(following), encode(d.following), `Unchanged following ${e.id}`);
        assert.equal(encode(evaluateAssessment2(e.label, raw)), encode(d.assessment), `Historical evaluation ${e.id}`);
      } else {
        const compiled = compilePerformance(score);
        if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score does not compile');
        const handoff = { from: topOfScore(compiled.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
        const audio = readWav(readFileSync(e.audioPath)); assert.equal(audio.length, e.label.audio!.samples);
        const candidate = new EventChain2(), run = executeSeam(() => candidate, score, handoff, audio, DELIVERY);
        following = run.started.ok ? evaluateFollowing(e.label, run.record) : null;
        raw = run.started.ok ? candidate.assessment() : null;
        record = run.record.map(decisionToJSON); cost = run.cost;
        causality = run.started.ok ? seamCausality(() => new EventChain2(), score, handoff, audio, DELIVERY, run.record) : [];
      }
      const report = raw ? promoteReport030(raw, score) : null;
      const assessment = report ? evaluateAssessment3(e.label, report) : null;
      const gates = verdict(e.label, following, assessment);
      const a = artifact(`event-chain-2.${e.id}.json`, { listener: EVENT_CHAIN_2, example: e.id, reused, citation, record,
        rawReport: raw ? serializeReport(raw) : null, report: report ? serializeReport(report) : null, following, assessment, cost, causality, gates });
      rows.push({ example: e, label: e.label, following, assessment, cost, causality, gates, artifact: a, reused });
      if (rows.length % 42 === 0) console.log(`${rows.length}/516 examples measured`);
    }
    const prefixPass = (rs: Row[]) => rs.length > 0 && rs.every(r => r.causality.length === 6 && r.causality.every(c => c.pass));
    const costVerdict = (rs: Row[]) => {
      const v = costGates(prefixPass(rs), rs.flatMap(r => r.cost ? [r.cost] : []));
      return { ...v, passed: v.passed && rs.every(r => r.cost !== null), missing: rs.filter(r => !r.cost).length };
    };
    const aggregate = (rs: Row[]) => {
      const pool = pooledGates2(rs), cost = costVerdict(rs), ps = rs.filter(r => r.example.kind === 'performance');
      const sum = (fn: (r: Row) => number) => rs.reduce((s, r) => s + fn(r), 0);
      return { examples: rs.length, performances: ps.length, controls: rs.length - ps.length,
        cursorPassed: rs.filter(r => !r.gates.cursor.length).length, assessmentPassed: rs.filter(r => !r.gates.assessment.length).length,
        controlsPassed: rs.filter(r => r.example.kind === 'control' && r.gates.passed).length,
        falseFindings: sum(r => r.assessment?.falseFindings ?? 0),
        events: { reached: sum(r => r.following?.byEvent.reached ?? 0), of: sum(r => r.following?.byEvent.of ?? 0) },
        notes: { assessed: sum(r => r.assessment ? r.assessment.expected.notes.length - r.assessment.notes.unassessed : 0), expected: sum(r => r.assessment?.expected.notes.length ?? 0) },
        intervals: { within: sum(r => r.assessment?.intervals.within ?? 0), matched: sum(r => r.assessment?.intervals.matched ?? 0), unreported: sum(r => r.assessment?.intervals.unreported ?? 0),
          maxErrorSeconds: Math.max(0, ...rs.flatMap(r => r.assessment?.intervals.errors.map(e => Math.abs(e.seconds)) ?? [])) },
        maxDelay: Math.max(0, ...rs.flatMap(r => r.following?.byEvent.events.flatMap(e => e.delay === null ? [] : [e.delay]) ?? [])),
        failures: rs.filter(r => !r.gates.passed).map(r => ({ id: r.example.id, ...r.gates })),
        pool, cost, prefixes: sum(r => r.causality.length),
        passed: rs.length > 0 && rs.every(r => r.gates.passed) && pool.every(g => g.passed) && cost.passed };
    };
    const groups = Object.fromEntries(['stage1', 'hesitation', 'slowedBar', 'four-bar-tempo-revalidation'].map(id => [id, aggregate(rows.filter(r => groupOf(r.example.id) === id))]));
    const fourBarClean = aggregate(rows.filter(r => r.example.of.startsWith('s3-')));
    const fourBarSlow = aggregate(rows.filter(r => r.example.of.startsWith('sb-s3-')));
    const sentinelRows = rows.filter(r => suite.routineRegressionIds.includes(r.example.id)); assert.equal(sentinelRows.length, 19);
    const sentinelChecks = suite.stages.map((s: { id: string; sentinels: { id: string }[] }) => {
      const rs = rows.filter(r => s.sentinels.some(x => x.id === r.example.id));
      return { id: s.id, passed: rs.length === s.sentinels.length && aggregate(rs).passed };
    });
    const earlierSentinelsPassed = sentinelChecks.every((s: { passed: boolean }) => s.passed);
    const states = suite.stages.map((s: { id: string; status: Status; sentinels: { id: string }[] }, index: number) => {
      const rs = rows.filter(r => s.sentinels.some(x => x.id === r.example.id));
      const ownSentinels = rs.length === s.sentinels.length && aggregate(rs).passed;
      return { id: s.id, before: s.status, passed: groups[s.id]!.passed, ownSentinelsPassed: ownSentinels,
        after: nextState({ before: s.status, attempted: true, fullSweep: false, passed: groups[s.id]!.passed, sentinelsPassed: sentinelChecks.slice(0, index).every((x: { passed: boolean }) => x.passed) && ownSentinels }) };
    });
    const fourState = nextState({ before: 'open', attempted: true, fullSweep: false, passed: groups['four-bar-tempo-revalidation']!.passed, sentinelsPassed: earlierSentinelsPassed });
    const selected = fourState === 'passed' ? chooseSentinels(rows.filter(r => groupOf(r.example.id) === 'four-bar-tempo-revalidation').map(r => {
      const margin = exampleMargin({ following: r.following!, assessment: { ...r.assessment!, evaluator: 'assessment-evaluator@2' },
        cost: r.cost!, gates: r.gates, causality: r.causality });
      return { id: r.example.id, score: examples.find(e => e.id === r.example.of)!.score, kind: r.example.control ?? 'performance', margin };
    })) : null;
    const results = Object.fromEntries(rows.map(r => [r.example.id, { substage: groupOf(r.example.id), kind: r.example.kind, control: r.example.control,
      reused: r.reused, gates: r.gates, artifact: r.artifact }]));
    const allPassed = Object.values(groups).every(g => g.passed) && earlierSentinelsPassed;
    const measures = artifact('aggregate-details.json', { groups, fourBarClean, fourBarSlow, sentinelRows: sentinelRows.map(r => ({ id: r.example.id,
      falseFindings: r.assessment?.falseFindings, flags: r.assessment?.flags, gates: r.gates })), states, fourState, selected });
    const freshRows = rows.filter(r => !r.reused), citedRows = rows.filter(r => r.reused);
    const summary = { ...common, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000,
      status: allPassed ? 'passed' : 'resolved-musical-failure', decision: allPassed ? 'D1' : 'D2', attempt, validation, audit,
      sets: [{ id: historic.manifest.id, dir: join(dataRoot, SLOWED_BAR_SET), sha256: historic.sha256 },
        { id: fresh.manifest.id, dir: join(dataRoot, FOUR_BAR_SET), sha256: fresh.sha256 }],
      baselineCitations, results, groups, fourBarClean, fourBarSlow, earlierSentinelsPassed, states, fourState, selected, measures,
      counts: { examples: rows.length, reused: citedRows.length, fresh: freshRows.length, freshPrefixes: freshRows.reduce((s, r) => s + r.causality.length, 0),
        citedPrefixes: citedRows.reduce((s, r) => s + r.causality.length, 0), prefixPass: prefixPass(rows) },
      freshCost: { machine: freshRows[0]?.cost?.machine, maxSustained: Math.max(...freshRows.map(r => r.cost?.sustainedRatio ?? Infinity)),
        maxP99Ms: Math.max(...freshRows.map(r => r.cost?.p99Ms ?? Infinity)), maxBacklogMs: Math.max(...freshRows.map(r => r.cost?.maxBacklogMs ?? Infinity)), provisional: true },
      stopping: { failingListenerVersions: 0, developmentListenerVersions: 2, completedListenerComparisons: 5, qualificationVersions: 0, qualificationAssessments: 0, reservedFinalAccesses: 0 },
      fullSweepDueNoLaterThan: 31, newVersions: 0, retiredSets: 0, newConfirmations: 0 };
    assert(Buffer.byteLength(encode(summary)) < 300000, 'Public summary exceeds300KB');
    writeFileSync(join(publicDir, 'summary.json'), encode(summary));
    artifact('completed.json', { runId, commit, summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))) });
    console.log(encode({ id: runId, status: summary.status, elapsedSeconds: summary.elapsedSeconds,
      groups: Object.fromEntries(Object.entries(groups).map(([id, g]) => [id, { examples: g.examples, cursorPassed: g.cursorPassed, assessmentPassed: g.assessmentPassed,
        failedPools: g.pool.filter(p => !p.passed), passed: g.passed }])), counts: summary.counts, states, fourState, publicBytes: Buffer.byteLength(encode(summary)) }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, measuredExamples: rows.length });
    writeFileSync(join(publicDir, 'summary.json'), encode({ ...common, status: 'infrastructure-failed', finishedAt: new Date().toISOString(), attempt, failure }));
    throw error;
  }
}
