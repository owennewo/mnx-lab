/** 036 thermometer: the unchanged event-chain@3 on 035's frozen guitar renders, both
 * outputs and controls, beside 035's challenger assessment. No listener, instrument,
 * stimulus or suite state changes.
 *   tsx src/stages/run036.ts <data-root> <run-id> */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionToJSON, positionToJSON, type DecisionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { evaluateAssessment3, type AssessmentEvaluation3, type AssessmentReport3 } from '../events/assessment3.ts';
import { evaluateFollowing, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates2, costGates, cursorGates, pooledGates2 } from '../events/gates2.ts';
import { validateLabel } from '../events/label.ts';
import { readOracle4 } from '../events/oracle4.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { sinePitch } from '../listeners/eventChain1.ts';
import { EventChain3, EVENT_CHAIN_3 } from '../listeners/eventChain3.ts';
import type { Cost } from '../report/index.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { assetPath, type StageExample2 } from './stage1v2.ts';

export const PREREG036 = 'reports/036-incumbent-guitar.md';
export const GUITAR_SET = 'contract2-challenger-guitar-v1';
const GUITAR_MANIFEST_SHA = '7c0537d08b57333b3df4c9ac82cc4f26678dcaebbf48ac72d3a72e2dca502055';
const GUITARS = ['tonejs-acoustic', 'martin', 'spanish', 'fender'] as const;
const G034 = 'runs/g034-missing-event-sweep/summary.json', G035 = 'runs/g035-challenger-basic-pitch/summary.json';
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 }, WINDOW = 960;

type Artifact = { path: string; sha256: string };
type Gates = { cursor: string[]; assessment: string[]; passed: boolean };
type Row = { example: StageExample2; guitar: string; part: 'clean' | 'hesitation'; following: FollowingEvaluation | null; assessment: AssessmentEvaluation3 | null;
  cost: Cost | null; causality: { pass: boolean }[]; gates: Gates; challenger: string[]; artifact: Artifact };
const serialize = (r: AssessmentReport3) => ({ ...r, notes: r.notes.map(decisionToJSON), tempo: { ...r.tempo,
  intervals: r.tempo.intervals.map(i => ({ ...i, from: positionToJSON(i.from), to: positionToJSON(i.to) })) } });

export type WindowClass = 'exact' | 'octave' | 'other' | 'unpitched' | 'silent';
/** The front-end diagnostic: the listener's own 20 ms windows at 10 ms hops, classified
 * against the rendered note each lies wholly inside. Reads labels; never a listener input. */
export function frontEnd(audio: Float32Array, notes: { midi: number; onset: number; end: number }[], sampleRate = 48000) {
  const counts: Record<WindowClass, number> = { exact: 0, octave: 0, other: 0, unpitched: 0, silent: 0 };
  const perNote = notes.map(n => ({ ...n, windows: 0, exact: 0, acquiredAfter: null as number | null, run: 0 }));
  for (let endSample = WINDOW; endSample <= audio.length; endSample += DELIVERY.chunkSamples) {
    const t = endSample / sampleRate, from = (endSample - WINDOW) / sampleRate;
    const note = perNote.find(n => n.onset <= from + 1e-9 && t <= n.end + 1e-9);
    if (!note) continue;
    const p = sinePitch(audio.subarray(endSample - WINDOW, endSample), sampleRate);
    const d = p.midi === null ? null : Math.abs(p.midi - note.midi);
    const kind: WindowClass = p.midi === null ? (p.silent ? 'silent' : 'unpitched') : d === 0 ? 'exact' : d === 12 || d === 24 ? 'octave' : 'other';
    counts[kind]++; note.windows++;
    if (kind === 'exact') { note.exact++; note.run++; if (note.run === 2 && note.acquiredAfter === null) note.acquiredAfter = t - note.onset; }
    else note.run = 0;
  }
  return { counts, notes: perNote.map(({ run: _, ...n }) => n) };
}

function aggregate(rs: Row[]) {
  const perf = rs.filter(r => r.example.kind === 'performance'), controls = rs.filter(r => r.example.kind === 'control');
  const sum = (fn: (r: Row) => number) => perf.reduce((s, r) => s + fn(r), 0);
  const pool = pooledGates2(rs.map(r => ({ label: r.example.label, following: r.following, assessment: r.assessment }))), prefixesPass = rs.length > 0 && rs.every(r => r.causality.length === 6 && r.causality.every(c => c.pass));
  const cost = costGates(prefixesPass, rs.flatMap(r => r.cost ? [r.cost] : []));
  const count = (xs: Row[], f: (r: Row) => boolean) => xs.filter(f).length;
  return { examples: rs.length, performances: perf.length, controls: controls.length,
    assessmentPassed: { performances: count(perf, r => !r.gates.assessment.length), controls: count(controls, r => !r.gates.assessment.length) },
    cursorPassed: { performances: count(perf, r => !r.gates.cursor.length), controls: count(controls, r => !r.gates.cursor.length) },
    challengerAssessmentPassed: { performances: count(perf, r => !r.challenger.length), controls: count(controls, r => !r.challenger.length) },
    events: { reached: sum(r => r.following?.byEvent.reached ?? 0), of: sum(r => r.following?.byEvent.of ?? 0) },
    notes: sum(r => r.assessment?.expected.notes.length ?? 0), falseFindings: sum(r => r.assessment?.falseFindings ?? 0),
    intervals: { within: sum(r => r.assessment?.intervals.within ?? 0), matched: sum(r => r.assessment?.intervals.matched ?? 0), unreported: sum(r => r.assessment?.intervals.unreported ?? 0),
      maxErrorSeconds: Math.max(0, ...perf.flatMap(r => r.assessment?.intervals.errors.map(x => Math.abs(x.seconds)) ?? [])) },
    maxDelay: Math.max(0, ...perf.flatMap(r => r.following?.byEvent.events.flatMap(x => x.delay === null ? [] : [x.delay]) ?? [])),
    failureKinds: Object.fromEntries([...new Set(rs.flatMap(r => [...r.gates.cursor.map(g => `cursor:${g}`), ...r.gates.assessment.map(g => `assessment:${g}`)]))]
      .map(k => [k, rs.filter(r => [...r.gates.cursor.map(g => `cursor:${g}`), ...r.gates.assessment.map(g => `assessment:${g}`)].includes(k)).length])),
    pool, cost, prefixes: rs.reduce((s, r) => s + r.causality.length, 0), prefixesPass };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dataRoot, runId] = process.argv.slice(2); assert(dataRoot && runId && /^g036a?-incumbent-guitar$/.test(runId));
  const repo = resolve(EXPERIMENT, '../..'), git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Commit implementation before running');
  const reportPath = `experiments/performance-listening/${PREREG036}`, preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  assert(readFileSync(join(EXPERIMENT, PREREG036), 'utf8').startsWith(git('show', `${preregCommit}:${reportPath}`)), 'Pre-registration changed');
  const commit = git('rev-parse', 'HEAD'); assert.equal(git('rev-parse', `${runId}-source^{commit}`), commit);
  const root = requireOutsideGit(dataRoot), privateDir = join(root, 'diagnostic-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
  assert(!existsSync(privateDir) && !existsSync(publicDir), 'Never overwrite a run');
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const startedAt = new Date().toISOString(), start = performance.now();
  const artifact = (name: string, value: unknown): Artifact => { const path = join(privateDir, name); assert(!existsSync(path)); writeFileSync(path, encode(value)); return { path, sha256: sha(readFileSync(path)) }; };
  const verify = (a: Artifact) => { const bytes = readFileSync(isAbsolute(a.path) ? a.path : join(EXPERIMENT, a.path)); assert.equal(sha(bytes), a.sha256, a.path); return bytes; };
  const paths = git('ls-files', '--', 'src/audio', 'src/model', 'experiments/performance-listening/listen', 'experiments/performance-listening/bench/src',
    'experiments/performance-listening/bench/oracle-events', 'experiments/performance-listening/contracts', 'experiments/performance-listening/sources',
    'experiments/performance-listening/bench/suite-record.json').split('\n').filter(p => /\.(ts|json|md)$/.test(p));
  const sourceHashes = Object.fromEntries([...paths, reportPath].map(p => [relative(EXPERIMENT, resolve(repo, p)), sha(readFileSync(resolve(repo, p)))]));
  const common = { id: runId, kind: 'listener-thermometer', modelAndTool: 'Claude Opus 5.5 in Claude Code', preregistration: PREREG036, preregistrationCommit: preregCommit,
    gitCommit: commit, startedAt, sourceHashes, listeners: [EVENT_CHAIN_3], delivery: DELIVERY,
    evaluators: { following: 'following-evaluator@2', assessment: 'assessment-evaluator@3', gates: 'stage-gates@2', oracle: 'event-oracle@4' },
    suiteMode: 'thermometer: no routine, no sweep, no suite state; sine records cited from g034', gatesAreComparisons: true, newVersions: 0, retiredSets: 0 };
  const rows: Row[] = [], attempt = artifact('attempt.json', { commit, runId, startedAt });
  const checkSummary = (s: Record<string, unknown>) => { const r = JSON.parse(encode(s)); assert.equal(r.id, runId); assert.equal(r.gitCommit, commit);
    assert(r.results.path && /^[a-f0-9]{64}$/.test(r.results.sha256)); assert(r.groups && r.perExample && r.criterion); return Buffer.byteLength(encode(s)); };
  try {
    readOracle4();
    // The listener and instruments are unchanged since g034, by hash; its sine records stand.
    const g034Bytes = readFileSync(join(EXPERIMENT, G034)), g034 = JSON.parse(g034Bytes.toString());
    const pinned = Object.keys(g034.sourceHashes).filter(p => /^(bench\/src\/(events|listeners|seam)\/|listen\/)/.test(p) && p.endsWith('.ts'));
    for (const p of pinned) assert.equal(sourceHashes[p], g034.sourceHashes[p], `Changed since g034: ${p}`);
    // The frozen guitar set, by manifest, freeze record and every asset.
    const dir = join(root, GUITAR_SET), manifestBytes = readFileSync(join(dir, 'manifest.json'));
    assert.equal(sha(manifestBytes), GUITAR_MANIFEST_SHA); assert.equal(JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256, GUITAR_MANIFEST_SHA);
    const manifest = JSON.parse(manifestBytes.toString()) as { examples: StageExample2[]; assets: Record<string, string> };
    for (const [path, hash] of Object.entries(manifest.assets)) assert.equal(sha(readFileSync(assetPath(path))), hash, path);
    assert.equal(manifest.examples.length, 576); for (const e of manifest.examples) validateLabel(e.label);
    // 035's challenger assessment of the same examples, by the hash its summary records.
    const g035Bytes = readFileSync(join(EXPERIMENT, G035)), g035 = JSON.parse(g035Bytes.toString());
    const challenger = JSON.parse(verify(g035.results).toString()) as Record<string, { failed: string[] }>;
    for (const e of manifest.examples) assert(challenger[e.id], e.id);
    const citations = [{ path: G034, sha256: sha(g034Bytes), pinnedSources: pinned.length }, { path: G035, sha256: sha(g035Bytes), results: g035.results }];
    const validation = artifact('validation.json', { citations, set: { id: GUITAR_SET, manifest: GUITAR_MANIFEST_SHA, assets: Object.keys(manifest.assets).length } });
    const dry = checkSummary({ ...common, attempt, validation, results: { path: join(privateDir, 'results.json'), sha256: '0'.repeat(64) }, groups: {}, perExample: [], criterion: {} });
    artifact('dry-assembly.json', { checkedBeforeMeasuring: true, bytes: dry });
    const diagnostics: Record<string, ReturnType<typeof frontEnd>> = {};
    for (const e of manifest.examples) {
      const guitar = (e.label.provenance.recipe as { sampleSource: string }).sampleSource; assert((GUITARS as readonly string[]).includes(guitar), guitar);
      const part = /-h-/.test(e.of) ? 'hesitation' as const : 'clean' as const;
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure, c = compilePerformance(score); assert(c.ok && !c.performance.diagnostics.length);
      const handoff = { from: topOfScore(c.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
      const audio = readWav(readFileSync(e.audioPath)); assert.equal(audio.length, e.label.audio!.samples);
      const candidate = new EventChain3(), run = executeSeam(() => candidate, score, handoff, audio, DELIVERY);
      const record: DecisionJSON[] = run.record.map(decisionToJSON), report = run.started.ok ? candidate.assessment() : null;
      const following = run.started.ok ? evaluateFollowing(e.label, run.record) : null, assessment = report ? evaluateAssessment3(e.label, report) : null;
      const causality = run.started.ok ? seamCausality(() => new EventChain3(), score, handoff, audio, DELIVERY, run.record) : [];
      const cursor = following ? cursorGates(e.label, following) : null, assess = assessmentGates2(e.label, assessment);
      const gates = { cursor: cursor?.failed ?? ['refused'], assessment: assess.failed, passed: !!cursor?.passed && assess.passed };
      let diagnostic: ReturnType<typeof frontEnd> | null = null;
      if (e.kind === 'performance') {
        const notes = e.label.performance.events.flatMap(p => p.notes.map(n => ({ midi: e.label.events[p.index]!.notes.find(x => x.noteKey === n.noteKey)!.midi!, onset: n.onset!, end: n.end! })));
        diagnostic = diagnostics[e.id] = frontEnd(audio, notes);
      }
      const a = artifact(`event-chain-3.${e.id}.json`, { listener: EVENT_CHAIN_3, example: e.id, inputLabelSha256: sha(encode(e.label)),
        record, report: report ? serialize(report) : null, following, assessment, cost: run.cost, causality, gates, diagnostic });
      rows.push({ example: e, guitar, part, following, assessment, cost: run.cost, causality, gates, challenger: challenger[e.id]!.failed, artifact: a });
      if (rows.length % 96 === 0) console.log(`event-chain@3 ${rows.length}/576`);
    }
    const groups: Record<string, ReturnType<typeof aggregate>> = { all: aggregate(rows) };
    for (const g of GUITARS) for (const part of ['clean', 'hesitation'] as const) groups[`${g}:${part}`] = aggregate(rows.filter(r => r.guitar === g && r.part === part));
    // 035's continuation criterion, for both listeners: the assessment gates, controls included, on a guitar's clean examples.
    const criterion = Object.fromEntries(GUITARS.map(g => { const clean = rows.filter(r => r.guitar === g && r.part === 'clean');
      return [g, { examples: clean.length, incumbent: clean.every(r => !r.gates.assessment.length), challenger: clean.every(r => !r.challenger.length) }]; }));
    const incumbentGuitars = GUITARS.filter(g => criterion[g]!.incumbent).length, decision = incumbentGuitars >= 3 ? 'E1' : 'E2';
    const frontEndByGuitar = Object.fromEntries(GUITARS.map(g => {
      const ds = rows.filter(r => r.guitar === g && diagnostics[r.example.id]).map(r => diagnostics[r.example.id]!), notes = ds.flatMap(d => d.notes);
      const counts = ds.reduce((s, d) => { for (const k of Object.keys(s) as WindowClass[]) s[k] += d.counts[k]; return s; }, { exact: 0, octave: 0, other: 0, unpitched: 0, silent: 0 });
      const total = Object.values(counts).reduce((a, b) => a + b, 0), acquired = notes.flatMap(n => n.acquiredAfter === null ? [] : [n.acquiredAfter]).sort((a, b) => a - b);
      return [g, { windows: total, counts, exactFraction: counts.exact / total, notes: notes.length, neverAcquired: notes.length - acquired.length,
        acquiredAfter: { median: acquired[Math.floor(acquired.length / 2)] ?? null, max: acquired.at(-1) ?? null } }];
    }));
    const disagreements = rows.filter(r => !r.gates.assessment.length !== !r.challenger.length).map(r => ({ id: r.example.id, incumbent: r.gates.assessment, challenger: r.challenger }));
    const results = artifact('results.json', Object.fromEntries(rows.map(r => [r.example.id, { kind: r.example.kind, guitar: r.guitar, part: r.part, gates: r.gates, challenger: r.challenger, artifact: r.artifact }])));
    const details = artifact('aggregate-details.json', { groups, criterion, frontEndByGuitar, disagreements, diagnostics });
    const summary = { ...common, status: 'measured', decision, attempt, validation, citations, results, details, criterion, incumbentGuitars, frontEndByGuitar, groups,
      disagreementCount: disagreements.length, perExample: rows.map(r => [r.example.id, r.gates.cursor, r.gates.assessment]),
      freshCost: { machine: rows[0]?.cost?.machine, maxSustained: Math.max(...rows.map(r => r.cost?.sustainedRatio ?? Infinity)), maxP99Ms: Math.max(...rows.map(r => r.cost?.p99Ms ?? Infinity)), provisional: true },
      finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000 };
    const bytes = checkSummary(summary); writeFileSync(join(publicDir, 'summary.json'), encode(summary));
    artifact('completed.json', { commit, runId, summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))), publicBytes: bytes });
    console.log(encode({ id: runId, decision, incumbentGuitars, criterion, publicBytes: bytes, elapsedSeconds: summary.elapsedSeconds }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, measuredExamples: rows.length, measured: rows.map(r => r.artifact) });
    writeFileSync(join(publicDir, 'summary.json'), encode({ ...common, attempt, failure, status: 'infrastructure-failed', finishedAt: new Date().toISOString() })); throw error;
  }
}
