/** 031: event-chain@3 (other-bars reporting) in the full sweep, with the frozen baselines. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Handoff } from '../../../listen/contract.ts';
import { decisionFromJSON, decisionToJSON, positionToJSON, type DecisionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { evaluateAssessment3, type AssessmentEvaluation3, type AssessmentReport3 } from '../events/assessment3.ts';
import { evaluateFollowing, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates2, chooseSentinels, costGates, cursorGates, exampleMargin, nextState, pooledGates2, type Status } from '../events/gates2.ts';
import type { PerformanceLabel } from '../events/label.ts';
import { readOracle4 } from '../events/oracle4.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { CANDIDATES } from '../ladder/candidates.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain3, EVENT_CHAIN_3 } from '../listeners/eventChain3.ts';
import type { Cost } from '../report/index.ts';
import { legacyListener } from '../seam/legacy.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { readFourBarTempo, FOUR_BAR_SET } from './fourBarTempo1.ts';
import { BASELINES } from './run023.ts';
import { readSlowedBarSet, SLOWED_BAR_SET } from './slowedBar1.ts';
import { assetPath, type StageExample2 } from './stage1v2.ts';

const PREREG = 'reports/031-other-bars-reporting.md';
const G027A = 'runs/g027a-live-confirmation/summary.json', G030 = 'runs/g030-current-instruments/summary.json';
const G026 = 'runs/g026-single-slowed-bar/summary.json', G025 = 'runs/g025-single-hesitation/summary.json';
const BASELINE_CAUSALITY = ['s3-90', 'sb-s3-45-b2-50', 'sil-s3-90', 'w2-s3-90'];
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const SUBSTAGES = ['stage1', 'hesitation', 'slowedBar', 'four-bar-tempo-revalidation'] as const;
type Artifact = { path: string; sha256: string };
const groupOf = (id: string) => id.includes('s3-') ? 'four-bar-tempo-revalidation' : /^(sb-|sil-sb-|w2-sb-)/.test(id) ? 'slowedBar' : /^(h-|sil-h-|w2-h-)/.test(id) ? 'hesitation' : 'stage1';
const serializeReport = (r: AssessmentReport3) => ({ ...r, notes: r.notes.map(decisionToJSON), tempo: { ...r.tempo, intervals: r.tempo.intervals.map(i => ({ ...i, from: positionToJSON(i.from), to: positionToJSON(i.to) })) } });
type Gates = { cursor: string[]; assessment: string[]; passed: boolean };
const verdict = (label: PerformanceLabel, following: FollowingEvaluation | null, assessment: AssessmentEvaluation3 | null): Gates => {
  const cursor = following ? cursorGates(label, following) : null, assess = assessmentGates2(label, assessment);
  return { cursor: cursor?.failed ?? ['refused'], assessment: assess.failed, passed: !!cursor?.passed && assess.passed };
};
type Row = { example: StageExample2; label: PerformanceLabel; following: FollowingEvaluation | null; assessment: AssessmentEvaluation3 | null;
  cost: Cost | null; causality: { pass: boolean }[]; gates: Gates; artifact: Artifact; reused: boolean; identity?: { record: boolean; musical: boolean } };

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dataRoot, runId] = process.argv.slice(2);
  if (!dataRoot || !runId || !/^g031[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: run031.ts <private-data-root> <new-run-id>');
  const repo = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  if (git('status', '--porcelain')) throw new Error('Commit implementation before running');
  const commit = git('rev-parse', 'HEAD'), reportPath = `experiments/performance-listening/${PREREG}`;
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  // Results are appended below the pre-registration, which itself must never change.
  const preregistered = git('show', `${preregCommit}:${reportPath}`);
  assert(readFileSync(join(EXPERIMENT, PREREG), 'utf8').startsWith(preregistered), 'Pre-registration changed since it landed');
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
  const common = { id: runId, kind: 'listener-full-sweep', modelAndTool: 'Claude Opus 5.5 in Claude Code', preregistration: PREREG,
    preregistrationCommit: preregCommit, gitCommit: commit, startedAt, sourceHashes,
    evaluators: { following: 'following-evaluator@2', assessment: 'assessment-evaluator@3', gates: 'stage-gates@2', oracle: 'event-oracle@4' },
    listeners: [EVENT_CHAIN_3, ...BASELINES], comparator: 'event-chain@2, cited from g030', delivery: DELIVERY,
    suiteMode: 'full sweep: every suite-record set, no retired set; frozen baselines cited by hash or run fresh' };
  const attempt = artifact('attempt.json', { runId, commit, startedAt, state: 'started' });
  const rows: Row[] = [];
  try {
    readOracle4();
    const suiteBytes = readFileSync(join(EXPERIMENT, 'bench/suite-record.json')), suite = JSON.parse(suiteBytes.toString());
    assert.equal(suite.retiredSets.length, 0);
    const historic = readSlowedBarSet(join(dataRoot, SLOWED_BAR_SET)), fresh = readFourBarTempo(join(dataRoot, FOUR_BAR_SET));
    assert.equal(historic.sha256, '553d4e7e62ebebacc63cb8fa7a735414490455d8a8eff19a3671eb36d96954db');
    assert.equal(fresh.sha256, '870363f2f36aa19a13aeee4d0faccff4e59d55ff8183fe8c32c868a803b5b60e');
    const examples = [...historic.manifest.examples, ...fresh.manifest.examples];
    assert.equal(examples.length, 516); assert.equal(new Set(examples.map(e => e.id)).size, 516);
    const suiteIds = new Set(suite.stages.flatMap((s: { examples: string[] }) => s.examples));
    assert.deepEqual([...suiteIds].sort(), examples.map(e => e.id).sort(), 'The sweep covers exactly the suite record');
    const verify = (a: Artifact) => { const bytes = readFileSync(a.path); assert.equal(sha(bytes), a.sha256, a.path); return bytes; };
    const summaryOf = (path: string) => { const bytes = readFileSync(join(EXPERIMENT, path)); return { json: JSON.parse(bytes.toString()), cited: { path, sha256: sha(bytes) } }; };
    const g027a = summaryOf(G027A), g030 = summaryOf(G030), g026 = summaryOf(G026), g025 = summaryOf(G025);
    // Baseline citations need every TypeScript producer unchanged since the commits that recorded them.
    const producerChecks = [g025.json.gitCommit, g026.json.gitCommit].flatMap((at: string) => git('ls-tree', '-r', '--name-only', at, '--', 'src/audio', 'src/model',
      'experiments/performance-listening/listen', 'experiments/performance-listening/bench/src').split('\n').filter(p => p.endsWith('.ts')).map(path => {
      const pinned = execFileSync('git', ['show', `${at}:${path}`], { cwd: repo, maxBuffer: 32 << 20 });
      return { at, path, sha256: sha(pinned), unchanged: existsSync(resolve(repo, path)) && sha(readFileSync(resolve(repo, path))) === sha(pinned) };
    }));
    assert(producerChecks.every(c => c.unchanged), 'A baseline producer changed; cited records cannot be reused');
    for (const s of [g025, g026]) for (const [path, hash] of Object.entries(s.json.sourceHashes as Record<string, string>)) {
      // git's rev:path syntax does not normalise '..'; g026 pins repository sources as ../../src/….
      assert.equal(sha(execFileSync('git', ['show', `${s.json.gitCommit}:${relative(repo, resolve(EXPERIMENT, path))}`], { cwd: repo, maxBuffer: 32 << 20 })), hash, `Pinned ${path}`);
    }
    const validation = artifact('reuse-validation.json', { citations: [g025.cited, g026.cited, g027a.cited, g030.cited], producerChecks,
      manifests: [historic.sha256, fresh.sha256], suite: { path: 'bench/suite-record.json', sha256: sha(suiteBytes) } });

    // event-chain@3: fresh on every example, compared with @2's stored outputs.
    for (const e of examples) {
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure;
      const compiled = compilePerformance(score);
      if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score does not compile');
      const handoff: Handoff = { from: topOfScore(compiled.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
      const audio = readWav(readFileSync(e.audioPath)); assert.equal(audio.length, e.label.audio!.samples);
      const candidate = new EventChain3(), run = executeSeam(() => candidate, score, handoff, audio, DELIVERY);
      const following = run.started.ok ? evaluateFollowing(e.label, run.record) : null;
      const report = run.started.ok ? candidate.assessment() : null;
      const assessment = report ? evaluateAssessment3(e.label, report) : null;
      const causality = run.started.ok ? seamCausality(() => new EventChain3(), score, handoff, audio, DELIVERY, run.record) : [];
      const old = groupOf(e.id) === 'four-bar-tempo-revalidation'
        ? (() => { const d = JSON.parse(verify(g030.json.results[e.id].artifact).toString()); return { record: d.record, report: d.rawReport }; })()
        : (() => { const d = JSON.parse(verify(g027a.json.results['event-chain@2'][e.id].artifact).toString()); return { record: d.record, report: d.report }; })();
      const record = run.record.map(decisionToJSON), serial = report ? serializeReport(report) : null;
      const identity = { record: encode(record) === encode(old.record),
        musical: !!serial && !!old.report && encode(serial.notes) === encode(old.report.notes) && encode(serial.tempo.intervals) === encode(old.report.tempo.intervals) && serial.tempo.overall === old.report.tempo.overall };
      const gates = verdict(e.label, following, assessment);
      const a = artifact(`event-chain-3.${e.id}.json`, { listener: EVENT_CHAIN_3, example: e.id, started: run.started, record, report: serial,
        oldFlags: old.report?.tempo.flags ?? null, following, assessment, cost: run.cost, causality, gates, identity });
      rows.push({ example: e, label: e.label, following, assessment, cost: run.cost, causality, gates, artifact: a, reused: false, identity });
      if (rows.length % 86 === 0) console.log(`event-chain@3 ${rows.length}/516`);
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
        identical: { record: rs.filter(r => r.identity?.record).length, musical: rs.filter(r => r.identity?.musical).length },
        flags: sum(r => r.assessment ? r.assessment.flags.slow.detected + r.assessment.flags.slow.falseAlarms + r.assessment.flags.fast.detected + r.assessment.flags.fast.falseAlarms : 0),
        falseFindings: sum(r => r.assessment?.falseFindings ?? 0),
        events: { reached: sum(r => r.following?.byEvent.reached ?? 0), of: sum(r => r.following?.byEvent.of ?? 0) },
        notes: { assessed: sum(r => r.assessment ? r.assessment.expected.notes.length - r.assessment.notes.unassessed : 0), expected: sum(r => r.assessment?.expected.notes.length ?? 0) },
        intervals: { within: sum(r => r.assessment?.intervals.within ?? 0), matched: sum(r => r.assessment?.intervals.matched ?? 0), unreported: sum(r => r.assessment?.intervals.unreported ?? 0),
          maxErrorSeconds: Math.max(0, ...rs.flatMap(r => r.assessment?.intervals.errors.map(e => Math.abs(e.seconds)) ?? [])) },
        bars: { eligible: sum(r => r.assessment?.expected.bars.filter(b => b.eligible).length ?? 0),
          otherBarsCorrect: sum(r => r.assessment?.barReports.errors.filter(b => b.otherBarsCorrect && b.eligibleCorrect).length ?? 0), matched: sum(r => r.assessment?.barReports.matched ?? 0) },
        maxDelay: Math.max(0, ...rs.flatMap(r => r.following?.byEvent.events.flatMap(e => e.delay === null ? [] : [e.delay]) ?? [])),
        minOnEvent: Math.min(1, ...ps.flatMap(r => r.following && r.following.asDecided.seconds.supportedAnswerable > 0 ? [r.following.asDecided.seconds.onEvent / r.following.asDecided.seconds.supportedAnswerable] : [])),
        failures: rs.filter(r => !r.gates.passed).map(r => ({ id: r.example.id, ...r.gates })),
        pool, cost, prefixes: sum(r => r.causality.length),
        passed: rs.length > 0 && rs.every(r => r.gates.passed && r.identity?.record && r.identity?.musical) && pool.every(g => g.passed) && cost.passed };
    };
    const groups = Object.fromEntries(SUBSTAGES.map(id => [id, aggregate(rows.filter(r => groupOf(r.example.id) === id))]));
    const fourBarClean = aggregate(rows.filter(r => r.example.of.startsWith('s3-')));
    const fourBarSlow = aggregate(rows.filter(r => r.example.of.startsWith('sb-s3-')));
    const slowMisses = rows.filter(r => r.assessment && r.assessment.flags.slow.detected < r.assessment.flags.slow.positives).map(r => ({ id: r.example.id,
      bars: r.assessment!.expected.bars.filter(b => b.expected === 'slow').map(b => ({ ordinal: b.ordinal, truthRatio: b.ratio })) }));
    const falseAlarmRows = rows.filter(r => r.assessment && r.assessment.falseFindings > 0).map(r => ({ id: r.example.id, flags: r.assessment!.flags }));

    // Earlier sentinels, as frozen in the suite record, judged before states change.
    const sentinelChecks = suite.stages.map((s: { id: string; sentinels: { id: string }[] }) => {
      const rs = rows.filter(r => s.sentinels.some(x => x.id === r.example.id));
      return { id: s.id, ids: s.sentinels.map(x => x.id), passed: rs.length === s.sentinels.length && (rs.length === 0 || aggregate(rs).passed) };
    });
    const states: { id: string; before: Status; passed: boolean; sentinelsPassed: boolean; after: Status }[] = [];
    for (const [index, s] of (suite.stages as { id: string; status: Status }[]).entries()) {
      // Earlier substages' frozen sentinels and this substage's own, as 030 applied the rule.
      const sentinelsPassed = sentinelChecks.slice(0, index + 1).every((x: { passed: boolean }) => x.passed);
      states.push({ id: s.id, before: s.status, passed: groups[s.id]!.passed, sentinelsPassed,
        after: nextState({ before: s.status, attempted: true, fullSweep: true, passed: groups[s.id]!.passed, sentinelsPassed }) });
    }
    const scoreOf = (r: Row) => examples.find(x => x.id === r.example.of)!.score;
    const margins = rows.map(r => ({ id: r.example.id, substage: groupOf(r.example.id), score: scoreOf(r), kind: r.example.control ?? 'performance',
      margin: r.gates.passed ? exampleMargin({ following: r.following!, assessment: { ...r.assessment!, evaluator: 'assessment-evaluator@2' }, cost: r.cost!, gates: r.gates, causality: r.causality }) : null }));
    const sentinels = Object.fromEntries(states.filter(s => s.after !== 'open').map(s => [s.id, chooseSentinels(margins.filter(m => m.substage === s.id)
      .map(m => ({ id: m.id, score: m.score, kind: m.kind as 'performance' | 'silence' | 'wrong-score', margin: m.margin! })))]));
    const results = Object.fromEntries(rows.map(r => [r.example.id, { substage: groupOf(r.example.id), kind: r.example.kind, gates: r.gates,
      identity: r.identity, artifact: r.artifact }]));
    const listenerPassed = Object.values(groups).every(g => g.passed) && sentinelChecks.every((s: { passed: boolean }) => s.passed);
    const listenerMeasures = artifact('event-chain-3.aggregate.json', { groups, fourBarClean, fourBarSlow, slowMisses, falseAlarmRows, sentinelChecks, states, margins, sentinels });
    console.log(encode({ listener: EVENT_CHAIN_3, passed: listenerPassed, states, elapsedSeconds: (performance.now() - start) / 1000 }));

    // Frozen baselines: cited on the historical examples, fresh on the four-bar set.
    const baselines: Record<string, unknown> = {};
    const baselineCosts: Cost[] = [];
    for (const id of BASELINES) {
      const entry = CANDIDATES.find(c => c.id === id)!;
      const regressions = JSON.parse(verify(g026.json.perListener[id].regressions).toString());
      const bRows: { id: string; group: string; kind: string; following: FollowingEvaluation | null; gates: Gates; cost: Cost | null; causality: { pass: boolean }[]; cited: boolean; label: PerformanceLabel }[] = [];
      const perExample: Record<string, unknown> = {};
      for (const e of examples) {
        let following: FollowingEvaluation | null, cost: Cost | null, causality: { pass: boolean }[], cited = true, detailArtifact: Artifact;
        if (groupOf(e.id) !== 'four-bar-tempo-revalidation') {
          let record: DecisionJSON[], stored: unknown;
          if (g026.json.results[id][e.id]) {
            detailArtifact = g026.json.results[id][e.id].artifact;
            const d = JSON.parse(verify(detailArtifact).toString()).detail;
            record = d.record; stored = d.following; cost = d.cost; causality = d.causality ?? [];
          } else {
            const d = regressions[e.id].detail; detailArtifact = d.record;
            const r = JSON.parse(verify(d.record).toString()); assert.equal(r.listener, id); assert.equal(r.example, e.id);
            record = r.record; stored = d.following; cost = d.cost; causality = g025.json.causality[`${id} ${e.id}`] ?? [];
          }
          following = evaluateFollowing(e.label, record.map(decisionFromJSON));
          assert.equal(encode(following), encode(stored), `Cited following ${id} ${e.id}`);
        } else {
          cited = false;
          const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure, compiled = compilePerformance(score);
          if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score does not compile');
          const handoff: Handoff = { from: topOfScore(compiled.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
          const audio = readWav(readFileSync(e.audioPath)); assert.equal(audio.length, e.label.audio!.samples);
          const run = executeSeam(legacyListener(entry.factory, entry.legacy), score, handoff, audio, DELIVERY);
          following = run.started.ok ? evaluateFollowing(e.label, run.record) : null; cost = run.cost;
          causality = run.started.ok && BASELINE_CAUSALITY.includes(e.id) ? seamCausality(legacyListener(entry.factory, entry.legacy), score, handoff, audio, DELIVERY, run.record) : [];
          if (cost) baselineCosts.push(cost);
          detailArtifact = artifact(`${id.replace('@', '-')}.${e.id}.json`, { listener: id, example: e.id, started: run.started, record: run.record.map(decisionToJSON), following, cost, causality });
        }
        const gates = verdict(e.label, following, null);
        bRows.push({ id: e.id, group: groupOf(e.id), kind: e.control ?? 'performance', following, gates, cost, causality, cited, label: e.label });
        perExample[e.id] = { cited, gates, artifact: detailArtifact };
      }
      if (BASELINE_CAUSALITY.some(x => !bRows.find(r => r.id === x)!.causality.length)) throw new Error(`Missing baseline causality ${id}`);
      const by = (rs: typeof bRows) => {
        const perf = rs.filter(r => r.kind === 'performance'), ctrl = rs.filter(r => r.kind !== 'performance');
        const ahead = perf.flatMap(r => r.following && r.following.asDecided.seconds.supportedAnswerable > 0 ? [r.following.asDecided.seconds.ahead / r.following.asDecided.seconds.supportedAnswerable] : []);
        return { examples: rs.length, passed: rs.filter(r => r.gates.passed).length, performanceCursorPassed: perf.filter(r => !r.gates.cursor.length).length, performances: perf.length,
          controlCursorPassed: ctrl.filter(r => !r.gates.cursor.length).length, controls: ctrl.length,
          silenceCursorPassed: ctrl.filter(r => r.kind === 'silence' && !r.gates.cursor.length).length, wrongScoreCursorPassed: ctrl.filter(r => r.kind === 'wrong-score' && !r.gates.cursor.length).length,
          maxAhead: ahead.length ? Math.max(...ahead) : null,
          prefixes: { checked: rs.reduce((s, r) => s + r.causality.length, 0), passed: rs.every(r => r.causality.every(c => c.pass)) } };
      };
      const four = bRows.filter(r => r.group === 'four-bar-tempo-revalidation');
      const fresh45 = four.filter(r => r.kind === 'performance' && /-45(-|$)/.test(r.id));
      const freshCost = four.flatMap(r => r.cost ? [r.cost] : []);
      const detail = artifact(`${id.replace('@', '-')}.sweep.json`, perExample);
      baselines[id] = { bySubstage: Object.fromEntries(SUBSTAGES.map(s => [s, by(bRows.filter(r => r.group === s))])),
        fourBar45: { performances: fresh45.length, cursorFailed: fresh45.filter(r => r.gates.cursor.length).length },
        cited: bRows.filter(r => r.cited).length, fresh: four.length,
        freshCost: { maxSustained: Math.max(...freshCost.map(c => c.sustainedRatio)), maxP99Ms: Math.max(...freshCost.map(c => c.p99Ms)), missing: four.length - freshCost.length },
        detail };
      console.log(encode({ baseline: id, fourBar: (baselines[id] as { bySubstage: Record<string, unknown> }).bySubstage['four-bar-tempo-revalidation'], elapsedSeconds: (performance.now() - start) / 1000 }));
    }
    const freshRows = rows;
    const summary = { ...common, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000,
      status: listenerPassed ? 'passed' : 'resolved-listener-failure', decision: listenerPassed ? 'D1' : 'D2', attempt, validation,
      sets: [{ id: historic.manifest.id, dir: join(dataRoot, SLOWED_BAR_SET), sha256: historic.sha256 },
        { id: fresh.manifest.id, dir: join(dataRoot, FOUR_BAR_SET), sha256: fresh.sha256 }],
      citations: [g025.cited, g026.cited, g027a.cited, g030.cited],
      // g031a exceeded the size limit with per-example results inline; they are private, named by hash.
      results: artifact('results.json', results), groups, fourBarClean, fourBarSlow, slowMisses, falseAlarmRows, sentinelChecks, states, sentinels, listenerMeasures, baselines,
      counts: { examples: rows.length, freshPrefixes: freshRows.reduce((s, r) => s + r.causality.length, 0), prefixPass: prefixPass(rows),
        identicalRecords: rows.filter(r => r.identity?.record).length, identicalMusical: rows.filter(r => r.identity?.musical).length },
      freshCost: { machine: freshRows[0]?.cost?.machine, maxSustained: Math.max(...freshRows.map(r => r.cost?.sustainedRatio ?? Infinity)),
        maxP99Ms: Math.max(...freshRows.map(r => r.cost?.p99Ms ?? Infinity)), maxBacklogMs: Math.max(...freshRows.map(r => r.cost?.maxBacklogMs ?? Infinity)), provisional: true },
      baselineFreshCost: { maxSustained: Math.max(...baselineCosts.map(c => c.sustainedRatio)), maxP99Ms: Math.max(...baselineCosts.map(c => c.p99Ms)) },
      newVersions: 1, retiredSets: 0 };
    assert(Buffer.byteLength(encode(summary)) < 300000, 'Public summary exceeds 300KB');
    writeFileSync(join(publicDir, 'summary.json'), encode(summary));
    artifact('completed.json', { runId, commit, summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))) });
    console.log(encode({ id: runId, status: summary.status, elapsedSeconds: summary.elapsedSeconds, counts: summary.counts, states,
      publicBytes: Buffer.byteLength(encode(summary)) }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, measuredExamples: rows.length });
    writeFileSync(join(publicDir, 'summary.json'), encode({ ...common, status: 'infrastructure-failed', finishedAt: new Date().toISOString(), attempt, failure }));
    throw error;
  }
}
