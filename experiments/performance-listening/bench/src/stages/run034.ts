/** 034 batch-end sweep and one interior omission. Frozen
 * musical producers are never edited.
 *   tsx src/stages/run034.ts <data-root> <run-id> */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionFromJSON, decisionToJSON, positionToJSON, type DecisionJSON } from '../../../listen/json.ts';
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
import { readRushedSet, RUSHED_SET } from './rushedBar1.ts';
import { MISSING_SET, PREREG034, readMissingSet, source034 } from './missingEvent1.ts';
import { CANDIDATES } from '../ladder/candidates.ts';
import { legacyListener } from '../seam/legacy.ts';
import { BASELINES } from './run023.ts';
import { readSlowedBarSet, SLOWED_BAR_SET } from './slowedBar1.ts';
import { assetPath, type StageExample2 } from './stage1v2.ts';

type Artifact = { path: string; sha256: string };
type Gates = { cursor: string[]; assessment: string[]; passed: boolean };
type Row = { example: StageExample2; label: StageExample2['label']; following: FollowingEvaluation | null; assessment: AssessmentEvaluation3 | null;
  report: AssessmentReport3 | null; cost: Cost | null; causality: { pass: boolean }[]; gates: Gates; artifact: Artifact };
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const EARLIER = ['runs/g033-rushed-bar/summary.json', 'runs/g032-held-note-hesitation/summary.json', 'runs/g031b-reporting-sweep/summary.json'];
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
    recovery: { recovered: sum(r => r.example.kind === 'performance' ? r.following?.recovery.recovered ?? 0 : 0), of: sum(r => r.example.kind === 'performance' ? r.following?.recovery.of ?? 0 : 0) },
    missing: { positives: sum(r => r.example.kind === 'performance' ? r.assessment?.notes.missing.positives ?? 0 : 0), detected: sum(r => r.example.kind === 'performance' ? r.assessment?.notes.missing.detected ?? 0 : 0) },
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
  const [dataRoot, runId] = process.argv.slice(2); assert(dataRoot && runId && /^g034a?-missing-event-sweep$/.test(runId));
  const { repo, git, commit, preregCommit } = source034(); assert.equal(git('rev-parse', `${runId}-source^{commit}`), commit);
  const privateDir = join(requireOutsideGit(dataRoot), 'diagnostic-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
  assert(!existsSync(privateDir) && !existsSync(publicDir), 'Never overwrite a run');
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const startedAt = new Date().toISOString(), start = performance.now();
  const artifact = (name: string, value: unknown): Artifact => { const path = join(privateDir, name); writeFileSync(path, encode(value)); return { path, sha256: sha(readFileSync(path)) }; };
  const verify = (a: Artifact) => { const bytes = readFileSync(a.path); assert.equal(sha(bytes), a.sha256, a.path); return bytes; };
  const paths = git('ls-files', '--', 'src/audio', 'src/model', 'experiments/performance-listening/listen', 'experiments/performance-listening/bench/src',
    'experiments/performance-listening/bench/oracle-events', 'experiments/performance-listening/contracts', 'experiments/performance-listening/sources',
    'experiments/performance-listening/bench/suite-record.json').split('\n').filter(p => /\.(ts|json|md)$/.test(p));
  const sourceHashes = Object.fromEntries([...paths, `experiments/performance-listening/${PREREG034}`].map(p => [relative(EXPERIMENT, resolve(repo, p)), sha(readFileSync(resolve(repo, p)))]));
  const common = { id: runId, kind: 'listener-full-sweep', modelAndTool: 'Sol 6.1 (high) in Codex', preregistration: PREREG034,
    preregistrationCommit: preregCommit, gitCommit: commit, startedAt, sourceHashes, listeners: [EVENT_CHAIN_3, ...BASELINES], delivery: DELIVERY,
    evaluators: { following: 'following-evaluator@2', assessment: 'assessment-evaluator@3', gates: 'stage-gates@2', oracle: 'event-oracle@4' },
    suiteMode: 'full sweep: every suite-record example plus missing interior events; no retirement; baseline reuse guarded by producer/input/artifact hashes', newVersions: 0, retiredSets: 0 };
  const rows: Row[] = [], attempt = artifact('attempt.json', { commit, runId, startedAt });
  let baselineMeasured = 0;
  const makeSummary = (status: string, decision: string, results: Artifact, groups: unknown, counts: unknown, extra: object) => ({ ...common,
    status, decision, attempt, results, groups, counts, ...extra, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000 });
  const checkSummary = (s: ReturnType<typeof makeSummary>) => {
    const r = JSON.parse(encode(s)); assert.equal(r.id, runId); assert.equal(r.gitCommit, commit);
    assert(r.results.path && /^[a-f0-9]{64}$/.test(r.results.sha256)); assert(r.groups && r.counts);
    assert(['passed', 'resolved-listener-failure'].includes(r.status)); return Buffer.byteLength(encode(s));
  };
  try {
    readOracle4();
    const missing = readMissingSet(join(dataRoot, MISSING_SET));
    const sets = [readSlowedBarSet(join(dataRoot, SLOWED_BAR_SET)), readFourBarTempo(join(dataRoot, FOUR_BAR_SET)),
      readHeldSet(join(dataRoot, HELD_SET)), readRushedSet(join(dataRoot, RUSHED_SET)), missing];
    const suiteBytes = readFileSync(join(EXPERIMENT, 'bench/suite-record.json')), suite = JSON.parse(suiteBytes.toString());
    assert.equal(suite.retiredSets.length, 0);
    const byId = new Map<string, StageExample2>();
    for (const set of sets) for (const e of set.manifest.examples) {
      const previous = byId.get(e.id); if (previous) assert.deepEqual(e, previous, `Duplicate input ${e.id}`); else byId.set(e.id, e);
    }
    const examples = [...byId.values()]; assert.equal(examples.length, 1164);
    const suiteIds = [...new Set(suite.stages.flatMap((s: { examples: string[] }) => s.examples))].sort();
    assert.deepEqual(suiteIds, examples.filter(e => !e.of.startsWith('me-')).map(e => e.id).sort(), 'Every suite example included');
    const parentScore = (e: StageExample2) => byId.get(e.of)!.score;
    const citations: Artifact[] = [], earlier = new Map<string, Artifact>();
    const summaryOf = (path: string) => {
      const bytes = readFileSync(join(EXPERIMENT, path)); citations.push({ path, sha256: sha(bytes) }); return JSON.parse(bytes.toString());
    };
    const priorSummaries = EARLIER.map(summaryOf);
    for (const s of priorSummaries) for (const [id, r] of Object.entries(JSON.parse(verify(s.results).toString()) as Record<string, { artifact: Artifact }>)) if (!earlier.has(id)) earlier.set(id, r.artifact);
    const g031b = priorSummaries[2], g026 = summaryOf('runs/g026-single-slowed-bar/summary.json'), g025 = summaryOf('runs/g025-single-hesitation/summary.json');
    // Freeze-check the actual old production code. compare031 is a read-only post-run diagnostic,
    // absent from listener/adapter/evaluator/runner execution; its changed display is irrelevant.
    const producerChecks: { commit: string; path: string; sha256: string; unchanged: boolean }[] = [];
    for (const s of [g031b, g026, g025]) for (const [path, hash] of Object.entries(s.sourceHashes as Record<string, string>)) {
      const repoPath = relative(repo, resolve(EXPERIMENT, path));
      const pinned = execFileSync('git', ['show', `${s.gitCommit}:${repoPath}`], { cwd: repo, maxBuffer: 32 << 20 });
      assert.equal(sha(pinned), hash, `Pinned source ${path}`);
      if (path.endsWith('.ts') && !path.endsWith('/compare031.ts')) producerChecks.push({ commit: s.gitCommit, path, sha256: hash,
        unchanged: existsSync(assetPath(path)) && sha(readFileSync(assetPath(path))) === hash });
    }
    const reuseAllowed = producerChecks.every(x => x.unchanged);
    const baselineCaches = Object.fromEntries(BASELINES.map(id => [id, {
      sweep: JSON.parse(verify(g031b.baselines[id].detail).toString()) as Record<string, { artifact: Artifact }>,
      regressions: JSON.parse(verify(g026.perListener[id].regressions).toString()) as Record<string, { detail: { cost: Cost; following: FollowingEvaluation; record: Artifact } }>
    }]));
    // Verify all cited artifacts and transitive records before measuring, not only those first used.
    let baselineArtifactsVerified = 0;
    for (const id of BASELINES) for (const [example, v] of Object.entries(baselineCaches[id]!.sweep)) {
      assert(byId.has(example)); const d = JSON.parse(verify(v.artifact).toString());
      const data = d.detail ?? d; if (data.record?.path) verify(data.record);
      baselineArtifactsVerified++;
    }
    const validation = artifact('validation.json', { citations, producerChecks, reuseAllowed, baselineArtifactsVerified,
      manifests: sets.map(s => ({ id: s.manifest.id, sha256: s.sha256 })), suite: { path: 'bench/suite-record.json', sha256: sha(suiteBytes) }, activeIds: examples.map(e => e.id) });
    artifact('dry-assembly.json', { checkedBeforeMeasuring: true, bytes: checkSummary(makeSummary('passed', 'D1', { path: join(privateDir, 'results.json'), sha256: '0'.repeat(64) }, { dry: true }, { examples: 1164 }, { validation })), requiredShape: true });
    const identity: { id: string; earlier: Artifact; record: boolean; report: boolean; following: boolean; assessment: boolean }[] = [];
    const inputs = (e: StageExample2) => {
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure, c = compilePerformance(score); assert(c.ok && !c.performance.diagnostics.length);
      const handoff = { from: topOfScore(c.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
      const audio = readWav(readFileSync(e.audioPath)); assert.equal(audio.length, e.label.audio!.samples); return { score, handoff, audio };
    };
    for (const e of examples) {
      const { score, handoff, audio } = inputs(e), candidate = new EventChain3();
      const run = executeSeam(() => candidate, score, handoff, audio, DELIVERY);
      const record = run.record.map(decisionToJSON), report = run.started.ok ? candidate.assessment() : null;
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
      if (rows.length % 100 === 0) console.log(`event-chain@3 ${rows.length}/${examples.length}`);
    }
    const ownIds = new Set(missing.manifest.examples.map(e => e.id)), own = rows.filter(r => ownIds.has(r.example.id));
    const omissionRows = own.filter(r => r.example.of.startsWith('me-'));
    const stageRows = (s: { examples: string[] }) => rows.filter(r => s.examples.includes(r.example.id));
    const substageGroups = Object.fromEntries(suite.stages.map((s: { id: string; examples: string[] }) => [s.id, aggregate(stageRows(s))]));
    const groups = { ...substageGroups, 'missing-event': aggregate(own), omissionOnly: aggregate(omissionRows), clean: aggregate(own.filter(r => !r.example.of.startsWith('me-'))), sweep: aggregate(rows) };
    const sentinelChecks = suite.stages.map((s: { id: string; sentinels: { id: string }[] }) => ({ id: s.id, ids: s.sentinels.map(x => x.id), ...aggregate(rows.filter(r => s.sentinels.some(x => x.id === r.example.id))) }));
    const earlierPassed = sentinelChecks.every((s: { passed: boolean }) => s.passed);
    const passed = Object.values(groups).every(g => g.passed) && earlierPassed;
    const states: { id: string; before: Status; after: Status }[] = suite.stages.map((s: { id: string; status: Status }, k: number) => ({ id: s.id, before: s.status,
      after: nextState({ before: s.status, attempted: true, fullSweep: true, passed: substageGroups[s.id]!.passed,
        sentinelsPassed: sentinelChecks.slice(0, k + 1).every((x: { passed: boolean }) => x.passed) }) }));
    states.push({ id: 'missing-event', before: 'open', after: nextState({ before: 'open', attempted: true, fullSweep: true, passed: groups['missing-event'].passed && groups.omissionOnly.passed, sentinelsPassed: earlierPassed }) });
    const margins = rows.filter(r => r.gates.passed && r.cost && r.following && r.assessment && r.causality.length === 6 && costGates(r.causality.every(c => c.pass), [r.cost]).passed).map(r => ({ id: r.example.id, score: parentScore(r.example),
      kind: (r.example.control ?? 'performance') as 'performance' | 'silence' | 'wrong-score', margin: exampleMargin({ following: r.following!, assessment: { ...r.assessment!, evaluator: 'assessment-evaluator@2' }, cost: r.cost!, gates: r.gates, causality: r.causality }), artifact: r.artifact }));
    const sentinels = Object.fromEntries(states.filter(s => s.after !== 'open').map(s => {
      const ids = new Set(s.id === 'missing-event' ? [...ownIds] : suite.stages.find((x: { id: string }) => x.id === s.id).examples);
      return [s.id, chooseSentinels(margins.filter(m => ids.has(m.id)))];
    }));
    const omissionDetails = omissionRows.filter(r => r.example.kind === 'performance').map(r => {
      const index = missing.manifest.omissions.find(x => x.id === r.example.id)!.index;
      return { id: r.example.id, index, recovery: r.following!.recovery, nextDelay: r.following!.byEvent.events.find(e => e.index === index + 1)?.delay,
        shownOmitted: JSON.parse(verify(r.artifact).toString()).record.some((d: DecisionJSON) => d.kind === 'position' && canonical((d as { candidates: { at: unknown }[] }).candidates[0]!.at) === canonical(r.label.events[index]!.at)),
        spanningInterval: r.assessment!.intervals.errors.find(e => e.from === index - 1 && e.to === index + 1), notes: r.assessment!.notes };
    });
    const results = artifact('results.json', Object.fromEntries(rows.map(r => [r.example.id, { kind: r.example.kind, gates: r.gates, artifact: r.artifact }])));
    const measures = artifact('aggregate-details.json', { groups, sentinelChecks, states, margins, sentinels, identity, omissionDetails });
    console.log(`Incumbent measurement complete in ${((performance.now() - start) / 1000).toFixed(2)} s; baseline sweep follows.`);
    // Baseline evidence is informational, never mixed into the incumbent's stage verdict.
    const baselineGroup = (e: StageExample2) => e.of.startsWith('hh-') ? 'held-note-hesitation' : e.of.startsWith('rb-') ? 'rushed-bar' : e.of.startsWith('me-') ? 'missing-event' : 'historical';
    const freshPrefixIds = new Set<string>();
    for (const stage of ['held-note-hesitation', 'rushed-bar', 'missing-event']) for (const kind of ['performance', 'silence', 'wrong-score']) {
      const e = examples.find(e => baselineGroup(e) === stage && (e.control ?? 'performance') === kind)!; assert(e); freshPrefixIds.add(e.id);
    }
    const baselines: Record<string, unknown> = {};
    for (const id of BASELINES) {
      const entry = CANDIDATES.find(c => c.id === id)!, cache = baselineCaches[id]!;
      const bRows: { id: string; group: string; kind: string; following: FollowingEvaluation | null; gates: Gates; cost: Cost | null; causality: { pass: boolean }[]; reused: boolean; artifact: Artifact }[] = [];
      for (const e of examples) {
        const old = reuseAllowed ? cache.sweep[e.id] : undefined;
        let following: FollowingEvaluation | null, cost: Cost | null, causality: { pass: boolean }[], a: Artifact;
        if (old) {
          a = old.artifact; const stored = JSON.parse(verify(a).toString()), d = stored.detail ?? stored;
          let record: DecisionJSON[], expected: FollowingEvaluation;
          if (Array.isArray(d.record) && d.cost) { record = d.record; expected = d.following; cost = d.cost; causality = d.causality ?? []; }
          else { const reg = cache.regressions[e.id]!.detail; assert.deepEqual(reg.record, a);
            record = stored.record; expected = reg.following; cost = reg.cost; causality = g025.causality[`${id} ${e.id}`] ?? []; }
          following = evaluateFollowing(e.label, record.map(decisionFromJSON)); assert.equal(canonical(following), canonical(expected), `Baseline reused evaluation ${id} ${e.id}`);
        } else {
          const { score, handoff, audio } = inputs(e), factory = legacyListener(entry.factory, entry.legacy);
          const run = executeSeam(factory, score, handoff, audio, DELIVERY);
          following = run.started.ok ? evaluateFollowing(e.label, run.record) : null; cost = run.cost;
          causality = run.started.ok && freshPrefixIds.has(e.id) ? seamCausality(factory, score, handoff, audio, DELIVERY, run.record) : [];
          a = artifact(`${id.replace('@', '-')}.${e.id}.json`, { listener: id, example: e.id, started: run.started, record: run.record.map(decisionToJSON), following, cost, causality });
          baselineMeasured++;
        }
        const cursor = following ? cursorGates(e.label, following) : null, assess = assessmentGates2(e.label, null);
        const gates = { cursor: cursor?.failed ?? ['refused'], assessment: assess.failed, passed: !!cursor?.passed && assess.passed };
        bRows.push({ id: e.id, group: baselineGroup(e), kind: e.control ?? 'performance', following, cost, causality, reused: !!old, gates, artifact: a });
        if (bRows.length % 100 === 0) console.log(`${id} ${bRows.length}/${examples.length}; total fresh baseline measurements ${baselineMeasured}`);
      }
      const by = (rs: typeof bRows) => ({ examples: rs.length, performances: rs.filter(r => r.kind === 'performance').length,
        performanceCursorPassed: rs.filter(r => r.kind === 'performance' && !r.gates.cursor.length).length,
        controls: rs.filter(r => r.kind !== 'performance').length, controlCursorPassed: rs.filter(r => r.kind !== 'performance' && !r.gates.cursor.length).length,
        silencePassed: rs.filter(r => r.kind === 'silence' && !r.gates.cursor.length).length, wrongScorePassed: rs.filter(r => r.kind === 'wrong-score' && !r.gates.cursor.length).length,
        recoveries: rs.filter(r => r.kind === 'performance').reduce((s, r) => s + (r.following?.recovery.recovered ?? 0), 0),
        recoveryCases: rs.filter(r => r.kind === 'performance').reduce((s, r) => s + (r.following?.recovery.of ?? 0), 0) });
      const prefixes = bRows.flatMap(r => r.causality), costs = bRows.flatMap(r => r.cost ? [r.cost] : []);
      const detail = artifact(`${id.replace('@', '-')}.sweep.json`, Object.fromEntries(bRows.map(r => [r.id, r])));
      baselines[id] = { reused: bRows.filter(r => r.reused).length, fresh: bRows.filter(r => !r.reused).length, detail,
        groups: Object.fromEntries(['historical', 'held-note-hesitation', 'rushed-bar', 'missing-event'].map(g => [g, by(bRows.filter(r => r.group === g))])),
        prefixes: { checked: prefixes.length, passed: prefixes.every(c => c.pass), freshExamples: [...freshPrefixIds], freshChecks: bRows.filter(r => !r.reused).reduce((s, r) => s + r.causality.length, 0) },
        cost: { ...costGates(prefixes.length > 0 && prefixes.every(c => c.pass), costs), missing: bRows.length - costs.length,
          maxSustained: Math.max(...costs.map(c => c.sustainedRatio)), maxP99Ms: Math.max(...costs.map(c => c.p99Ms)), provisional: true } };
    }
    const counts = { examples: rows.length, fresh: rows.length, prefixes: rows.reduce((s, r) => s + r.causality.length, 0), withEarlierRecord: identity.length,
      identicalToEarlier: identity.filter(x => x.record && x.report && x.following && x.assessment).length, baselineMeasured };
    const brief = (g: ReturnType<typeof aggregate>) => ({ ...g, failures: g.failures.slice(0, 40), failureCount: g.failures.length });
    const summary = makeSummary(passed ? 'passed' : 'resolved-listener-failure', passed ? 'D1' : 'D2', results,
      Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, brief(g)])), counts, { validation, measures, citations, baselines,
        sets: sets.map(s => ({ id: s.manifest.id, dir: join(dataRoot, s.manifest.id), sha256: s.sha256 })),
        sentinelChecks: sentinelChecks.map((s: { id: string; passed: boolean }) => ({ id: s.id, passed: s.passed })), states, sentinels,
        identityChanged: identity.filter(x => !(x.record && x.report && x.following && x.assessment)),
        freshCost: { machine: rows[0]?.cost?.machine, maxSustained: Math.max(...rows.map(r => r.cost?.sustainedRatio ?? Infinity)), maxP99Ms: Math.max(...rows.map(r => r.cost?.p99Ms ?? Infinity)),
          maxBacklogMs: Math.max(...rows.map(r => r.cost?.maxBacklogMs ?? Infinity)), provisional: true } });
    const bytes = checkSummary(summary); writeFileSync(join(publicDir, 'summary.json'), encode(summary));
    artifact('completed.json', { commit, runId, summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))), publicBytes: bytes, exceedsSizeTarget: bytes > 300000 });
    console.log(encode({ id: runId, status: summary.status, decision: summary.decision, counts, states, publicBytes: bytes, elapsedSeconds: summary.elapsedSeconds }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, measuredExamples: rows.length, baselineMeasured });
    writeFileSync(join(publicDir, 'summary.json'), encode({ ...common, attempt, failure, status: 'infrastructure-failed', finishedAt: new Date().toISOString() })); throw error;
  }
}
