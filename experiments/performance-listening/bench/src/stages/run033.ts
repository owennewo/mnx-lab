/** 033 routine diagnostic: the rushed-bar set and every frozen sentinel, all fresh. Frozen
 * musical producers are never edited.
 *   tsx src/stages/run033.ts <data-root> <run-id> */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionToJSON, positionToJSON, type DecisionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { evaluateAssessment3, type AssessmentEvaluation3, type AssessmentReport3 } from '../events/assessment3.ts';
import { evaluateFollowing, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates2, chooseSentinels, costGates, cursorGates, exampleMargin, nextState, pooledGates2, type Status } from '../events/gates2.ts';
import { readOracle4 } from '../events/oracle4.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain3, EVENT_CHAIN_3 } from '../listeners/eventChain3.ts';
import type { Cost } from '../report/index.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { readFourBarTempo, FOUR_BAR_SET } from './fourBarTempo1.ts';
import { HELD_SET, readHeldSet } from './heldNoteHesitation1.ts';
import { PREREG033, readRushedSet, RUSHED_SET, source033 } from './rushedBar1.ts';
import { readSlowedBarSet, SLOWED_BAR_SET } from './slowedBar1.ts';
import { assetPath, type StageExample2 } from './stage1v2.ts';

type Artifact = { path: string; sha256: string };
type Gates = { cursor: string[]; assessment: string[]; passed: boolean };
type Row = { example: StageExample2; label: StageExample2['label']; following: FollowingEvaluation | null; assessment: AssessmentEvaluation3 | null;
  report: AssessmentReport3 | null; cost: Cost | null; causality: { pass: boolean }[]; gates: Gates; artifact: Artifact };
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const EARLIER = ['runs/g032-held-note-hesitation/summary.json', 'runs/g031b-reporting-sweep/summary.json'];
const serialize = (r: AssessmentReport3) => ({ ...r, notes: r.notes.map(decisionToJSON), tempo: { ...r.tempo,
  intervals: r.tempo.intervals.map(i => ({ ...i, from: positionToJSON(i.from), to: positionToJSON(i.to) })) } });
const canonical = (x: unknown) => JSON.stringify(JSON.parse(encode(x)));

function aggregate(rs: Row[]) {
  const sum = (fn: (r: Row) => number) => rs.reduce((s, r) => s + fn(r), 0);
  const pool = pooledGates2(rs), prefixesPass = rs.length > 0 && rs.every(r => r.causality.length === 6 && r.causality.every(c => c.pass));
  const cost = costGates(prefixesPass, rs.flatMap(r => r.cost ? [r.cost] : [])), perf = rs.filter(r => r.example.kind === 'performance');
  const flags = (d: 'slow' | 'fast') => ({ positives: sum(r => r.assessment?.flags[d].positives ?? 0), detected: sum(r => r.assessment?.flags[d].detected ?? 0),
    negatives: sum(r => r.assessment?.flags[d].negatives ?? 0), falseAlarms: sum(r => r.assessment?.flags[d].falseAlarms ?? 0) });
  return { examples: rs.length, performances: perf.length, controls: rs.length - perf.length,
    cursorPassed: rs.filter(r => !r.gates.cursor.length).length, assessmentPassed: rs.filter(r => !r.gates.assessment.length).length,
    events: { reached: sum(r => r.following?.byEvent.reached ?? 0), of: sum(r => r.following?.byEvent.of ?? 0) },
    notes: { expected: sum(r => r.example.kind === 'performance' ? r.assessment?.expected.notes.length ?? 0 : 0),
      assessed: sum(r => r.example.kind === 'performance' && r.assessment ? r.assessment.expected.notes.length - r.assessment.notes.unassessed : 0) },
    intervals: { within: sum(r => r.assessment?.intervals.within ?? 0), matched: sum(r => r.assessment?.intervals.matched ?? 0), unreported: sum(r => r.assessment?.intervals.unreported ?? 0),
      maxErrorSeconds: Math.max(0, ...rs.flatMap(r => r.assessment?.intervals.errors.map(x => Math.abs(x.seconds)) ?? [])) },
    falseFindings: sum(r => r.assessment?.falseFindings ?? 0), slow: flags('slow'), fast: flags('fast'),
    maxRatioError: Math.max(0, ...rs.flatMap(r => r.assessment?.barReports.errors.flatMap(e => e.ratio === null ? [] : [Math.abs(e.ratio)]) ?? [])),
    aheadSeconds: sum(r => r.following?.asDecided.seconds.ahead ?? 0),
    maxDelay: Math.max(0, ...rs.flatMap(r => r.following?.byEvent.events.flatMap(x => x.delay === null ? [] : [x.delay]) ?? [])),
    minOnEvent: Math.min(1, ...perf.flatMap(r => r.following && r.following.asDecided.seconds.supportedAnswerable > 0 ? [r.following.asDecided.seconds.onEvent / r.following.asDecided.seconds.supportedAnswerable] : [])),
    maxOverallError: Math.max(0, ...perf.flatMap(r => r.assessment && r.assessment.overall.error !== null ? [Math.abs(r.assessment.overall.error)] : [])),
    failures: rs.filter(r => !r.gates.passed).map(r => ({ id: r.example.id, ...r.gates })), pool, cost, prefixes: sum(r => r.causality.length), prefixesPass,
    passed: rs.length > 0 && rs.every(r => r.gates.passed && r.cost !== null) && pool.every(g => g.passed) && cost.passed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dataRoot, runId] = process.argv.slice(2); assert(dataRoot && runId && /^g033a?-rushed-bar$/.test(runId));
  const { repo, git, commit, preregCommit } = source033(); assert.equal(git('rev-parse', `${runId}-source^{commit}`), commit);
  const privateDir = join(requireOutsideGit(dataRoot), 'diagnostic-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
  assert(!existsSync(privateDir) && !existsSync(publicDir), 'Never overwrite a run');
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const startedAt = new Date().toISOString(), start = performance.now();
  const artifact = (name: string, value: unknown): Artifact => { const path = join(privateDir, name); writeFileSync(path, encode(value)); return { path, sha256: sha(readFileSync(path)) }; };
  const verify = (a: Artifact) => { const bytes = readFileSync(a.path); assert.equal(sha(bytes), a.sha256, a.path); return bytes; };
  const paths = git('ls-files', '--', 'src/audio', 'src/model', 'experiments/performance-listening/listen', 'experiments/performance-listening/bench/src',
    'experiments/performance-listening/bench/oracle-events', 'experiments/performance-listening/contracts', 'experiments/performance-listening/sources',
    'experiments/performance-listening/bench/suite-record.json').split('\n').filter(p => /\.(ts|json|md)$/.test(p));
  const sourceHashes = Object.fromEntries([...paths, `experiments/performance-listening/${PREREG033}`].map(p => [relative(EXPERIMENT, resolve(repo, p)), sha(readFileSync(resolve(repo, p)))]));
  const common = { id: runId, kind: 'listener-routine-diagnostic', modelAndTool: 'Claude Opus 5.5 in Claude Code', preregistration: PREREG033,
    preregistrationCommit: preregCommit, gitCommit: commit, startedAt, sourceHashes, listeners: [EVENT_CHAIN_3], delivery: DELIVERY,
    evaluators: { following: 'following-evaluator@2', assessment: 'assessment-evaluator@3', gates: 'stage-gates@2', oracle: 'event-oracle@4' },
    suiteMode: 'routine: rushed-bar substage with clean s2/s3 parents, every frozen sentinel and control; all fresh', newVersions: 0, retiredSets: 0 };
  const rows: Row[] = [], attempt = artifact('attempt.json', { commit, runId, startedAt });
  const makeSummary = (status: string, decision: string, results: Artifact, groups: unknown, counts: unknown, extra: object) => ({ ...common,
    status, decision, attempt, results, groups, counts, ...extra, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000 });
  const checkSummary = (s: ReturnType<typeof makeSummary>) => {
    const r = JSON.parse(encode(s)); assert.equal(r.id, runId); assert.equal(r.gitCommit, commit);
    assert(r.results.path && /^[a-f0-9]{64}$/.test(r.results.sha256)); assert(r.groups && r.counts);
    assert(['passed', 'resolved-listener-failure'].includes(r.status)); return Buffer.byteLength(encode(s));
  };
  try {
    readOracle4();
    const rushed = readRushedSet(join(dataRoot, RUSHED_SET)), slowed = readSlowedBarSet(join(dataRoot, SLOWED_BAR_SET));
    const four = readFourBarTempo(join(dataRoot, FOUR_BAR_SET)), held = readHeldSet(join(dataRoot, HELD_SET));
    const suiteBytes = readFileSync(join(EXPERIMENT, 'bench/suite-record.json')), suite = JSON.parse(suiteBytes.toString());
    const byId = new Map([...slowed.manifest.examples, ...four.manifest.examples, ...held.manifest.examples].map(e => [e.id, e]));
    const sentinelIds: string[] = suite.routineRegressionIds; assert.equal(sentinelIds.length, 28);
    assert.deepEqual([...new Set(suite.stages.flatMap((s: { sentinels: { id: string }[] }) => s.sentinels.map(x => x.id)))].sort(), [...sentinelIds].sort());
    const examples = [...rushed.manifest.examples];
    for (const id of sentinelIds) if (!examples.some(e => e.id === id)) { assert(byId.has(id), id); examples.push(byId.get(id)!); }
    assert.equal(examples.length, 479);
    for (const e of rushed.manifest.examples.filter(e => byId.has(e.id))) assert.deepEqual(e, byId.get(e.id));
    // Latest earlier event-chain@3 record per example, for the read-only identity diagnostic.
    const citations: Artifact[] = [], earlier = new Map<string, Artifact>();
    for (const path of EARLIER) {
      const bytes = readFileSync(join(EXPERIMENT, path)), summary = JSON.parse(bytes.toString()); citations.push({ path, sha256: sha(bytes) });
      for (const [id, r] of Object.entries(JSON.parse(verify(summary.results).toString()) as Record<string, { artifact: Artifact }>)) if (!earlier.has(id)) earlier.set(id, r.artifact);
    }
    const validation = artifact('validation.json', { citations, manifests: { rushed: rushed.sha256, slowed: slowed.sha256, four: four.sha256, held: held.sha256 },
      suite: { path: 'bench/suite-record.json', sha256: sha(suiteBytes) }, activeIds: examples.map(e => e.id), withEarlierRecord: examples.filter(e => earlier.has(e.id)).map(e => e.id) });
    const dryBytes = checkSummary(makeSummary('passed', 'D1', { path: join(privateDir, 'results.json'), sha256: '0'.repeat(64) }, { dryAssembly: true }, { examples: 479 }, { validation, citations }));
    artifact('dry-assembly.json', { checkedBeforeMeasuring: true, bytes: dryBytes, requiredShape: true });
    const identity: { id: string; earlier: Artifact; record: boolean; report: boolean; following: boolean; assessment: boolean }[] = [];
    for (const e of examples) {
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure, c = compilePerformance(score); assert(c.ok && !c.performance.diagnostics.length);
      const handoff = { from: topOfScore(c.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
      const audio = readWav(readFileSync(e.audioPath)); assert.equal(audio.length, e.label.audio!.samples);
      const candidate = new EventChain3(), run = executeSeam(() => candidate, score, handoff, audio, DELIVERY);
      const record: DecisionJSON[] = run.record.map(decisionToJSON), report = run.started.ok ? candidate.assessment() : null;
      const following = run.started.ok ? evaluateFollowing(e.label, run.record) : null, assessment = report ? evaluateAssessment3(e.label, report) : null;
      const cost = run.cost, causality = run.started.ok ? seamCausality(() => new EventChain3(), score, handoff, audio, DELIVERY, run.record) : [];
      const cursor = following ? cursorGates(e.label, following) : null, assess = assessmentGates2(e.label, assessment);
      const gates = { cursor: cursor?.failed ?? ['refused'], assessment: assess.failed, passed: !!cursor?.passed && assess.passed };
      const a = artifact(`event-chain-3.${e.id}.json`, { listener: EVENT_CHAIN_3, example: e.id, inputLabelSha256: sha(encode(e.label)),
        record, report: report ? serialize(report) : null, following, assessment, cost, causality, gates });
      const prior = earlier.get(e.id);
      if (prior) {
        const d = JSON.parse(verify(prior).toString()); assert.equal(d.listener, EVENT_CHAIN_3); assert.equal(d.example, e.id);
        identity.push({ id: e.id, earlier: prior, record: canonical(record) === canonical(d.record), report: canonical(report ? serialize(report) : null) === canonical(d.report),
          following: canonical(following) === canonical(d.following), assessment: canonical(assessment) === canonical(d.assessment) });
      }
      rows.push({ example: e, label: e.label, following, assessment, report, cost, causality, gates, artifact: a });
      if (rows.length % 60 === 0) console.log(`event-chain@3 ${rows.length}/479`);
    }
    const ownIds = new Set(rushed.manifest.examples.map(e => e.id)), own = rows.filter(r => ownIds.has(r.example.id));
    const rushedRows = own.filter(r => r.example.of.startsWith('rb-'));
    const groups = { own: aggregate(own), rushed: aggregate(rushedRows), rushedS2: aggregate(rushedRows.filter(r => r.example.of.startsWith('rb-s2-'))),
      rushedS3: aggregate(rushedRows.filter(r => r.example.of.startsWith('rb-s3-'))), clean: aggregate(own.filter(r => !r.example.of.startsWith('rb-'))), active: aggregate(rows) };
    const sentinelChecks = suite.stages.map((s: { id: string; sentinels: { id: string }[] }) => ({ id: s.id, ids: s.sentinels.map(x => x.id), ...aggregate(rows.filter(r => s.sentinels.some(x => x.id === r.example.id))) }));
    const earlierPassed = sentinelChecks.every((s: { passed: boolean }) => s.passed);
    // D1 reads the two declared pools, every earlier sentinel group, and every active example with prefixes and cost.
    const activeExamplesPass = rows.every(r => r.gates.passed && r.cost !== null) && groups.active.cost.passed;
    const passed = groups.own.passed && groups.rushed.passed && earlierPassed && activeExamplesPass;
    const states = suite.stages.map((s: { id: string; status: Status }, k: number) => ({ id: s.id, before: s.status,
      after: nextState({ before: s.status, attempted: false, fullSweep: false, passed: sentinelChecks[k].passed, sentinelsPassed: sentinelChecks.slice(0, k + 1).every((x: { passed: boolean }) => x.passed) }) }));
    states.push({ id: 'rushed-bar', before: 'open', after: nextState({ before: 'open', attempted: true, fullSweep: false, passed, sentinelsPassed: earlierPassed }) });
    const margins = own.filter(r => r.gates.passed && r.cost && r.following && r.assessment && r.causality.length === 6 && costGates(r.causality.every(c => c.pass), [r.cost]).passed).map(r => ({ id: r.example.id,
      score: rushed.manifest.examples.find(e => e.id === r.example.of)!.score, kind: (r.example.control ?? 'performance') as 'performance' | 'silence' | 'wrong-score',
      margin: exampleMargin({ following: r.following!, assessment: { ...r.assessment!, evaluator: 'assessment-evaluator@2' }, cost: r.cost!, gates: r.gates, causality: r.causality }), artifact: r.artifact }));
    const sentinels = passed ? chooseSentinels(margins) : null;
    // Each expected-fast or flagged bar of the rushed s3 performances: truth, estimate and verdict.
    const construction = new Map(rushed.manifest.construction.map(x => [x.id, x]));
    const flagRows = rushedRows.filter(r => r.example.kind === 'performance' && r.assessment && r.report).flatMap(r => r.assessment!.expected.bars.flatMap(b => {
      const reported = r.report!.tempo.bars.find(x => x.ordinal === b.ordinal) ?? null, flag = r.report!.tempo.flags.find(f => f.ordinal === b.ordinal)?.direction ?? null;
      if (b.expected !== 'fast' && flag === null) return [];
      const x = construction.get(r.example.id)!;
      return [{ id: r.example.id, tempo: x.tempo, rushedOrdinal: x.ordinal, factor: x.factor, ordinal: b.ordinal, expected: b.expected, trueRatio: b.ratio, reportedRatio: reported?.ratio ?? null, flag }];
    }));
    const results = artifact('results.json', Object.fromEntries(rows.map(r => [r.example.id, { kind: r.example.kind, gates: r.gates, artifact: r.artifact }])));
    const measures = artifact('aggregate-details.json', { groups, sentinelChecks, states, margins, sentinels, identity, flagRows });
    const unchanged = identity.filter(x => x.record && x.report && x.following && x.assessment).length;
    const counts = { examples: rows.length, fresh: rows.length, prefixes: rows.reduce((s, r) => s + r.causality.length, 0), withEarlierRecord: identity.length, identicalToEarlier: unchanged };
    const brief = (g: ReturnType<typeof aggregate>) => ({ ...g, failures: g.failures.slice(0, 40), failureCount: g.failures.length });
    const summary = makeSummary(passed ? 'passed' : 'resolved-listener-failure', passed ? 'D1' : 'D2', results,
      Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, brief(g)])), counts,
      { sets: [{ id: RUSHED_SET, dir: join(dataRoot, RUSHED_SET), sha256: rushed.sha256 }], citations, validation, measures,
        fastFlags: { misses: flagRows.filter(f => f.expected === 'fast' && f.flag !== 'fast'), falseAlarms: flagRows.filter(f => f.flag !== null && f.expected !== 'either' && f.flag !== f.expected) },
        identityChanged: identity.filter(x => !(x.record && x.report && x.following && x.assessment)),
        sentinelChecks: sentinelChecks.map((s: { id: string; ids: string[]; passed: boolean }) => ({ id: s.id, ids: s.ids, passed: s.passed })), states, sentinels,
        freshCost: { machine: rows[0]?.cost?.machine, maxSustained: Math.max(...rows.map(r => r.cost?.sustainedRatio ?? Infinity)), maxP99Ms: Math.max(...rows.map(r => r.cost?.p99Ms ?? Infinity)),
          maxBacklogMs: Math.max(...rows.map(r => r.cost?.maxBacklogMs ?? Infinity)), provisional: true } });
    const bytes = checkSummary(summary); writeFileSync(join(publicDir, 'summary.json'), encode(summary));
    artifact('completed.json', { commit, runId, summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))), publicBytes: bytes, exceedsSizeTarget: bytes > 300000 });
    console.log(encode({ id: runId, status: summary.status, decision: summary.decision, counts, states, publicBytes: bytes, elapsedSeconds: summary.elapsedSeconds }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, measuredExamples: rows.length });
    writeFileSync(join(publicDir, 'summary.json'), encode({ ...common, attempt, failure, status: 'infrastructure-failed', finishedAt: new Date().toISOString() })); throw error;
  }
}
