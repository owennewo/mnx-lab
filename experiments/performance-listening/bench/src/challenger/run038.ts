/** 038 unchanged listeners on fixed quiet-noise controls. Native live remains exploratory. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionToJSON, positionToJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds, validateRecord } from '../../../listen/validate.ts';
import { evaluateAssessment3, type AssessmentReport3 } from '../events/assessment3.ts';
import { evaluateFollowing } from '../events/following.ts';
import { assessmentGates2, cursorGates } from '../events/gates2.ts';
import { readOracle4 } from '../events/oracle4.ts';
import { validateLabel } from '../events/label.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain3 } from '../listeners/eventChain3.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { assetPath, type StageExample2 } from '../stages/stage1v2.ts';
import { BasicPitchChain, type ObservationEvent } from './chain.ts';
import { BasicPitchLive } from './live.ts';
import { NativeModel } from './native.ts';
import { freezeQuietNoise, NOISE_SET } from './quietNoise.ts';
type Artifact = { path: string; sha256: string };
const MODEL = '/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx';
const PYTHON = '/home/williao/dev/guitar-nn/.venv-basic-pitch/bin/python';
const MODEL_HASH = '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec';
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const PREREG = 'reports/038-challenger-quiet-noise.md';
const PARENT_HASH = '7c0537d08b57333b3df4c9ac82cc4f26678dcaebbf48ac72d3a72e2dca502055';
const GUITARS = ['tonejs-acoustic', 'martin', 'spanish', 'fender'];
const serialize = (r: AssessmentReport3) => ({ ...r, notes: r.notes.map(decisionToJSON), tempo: { ...r.tempo,
  intervals: r.tempo.intervals.map(i => ({ ...i, from: positionToJSON(i.from), to: positionToJSON(i.to) })) } });
const pairKey = (e: StageExample2) => `${e.label.score.sha256}:${e.label.audio!.sha256}`;
const scoredLabel = (e: StageExample2) => ({ duration: e.label.duration, score: e.label.score, handoff: e.label.handoff,
  events: e.label.events, performance: e.label.performance, cursor: e.label.cursor });
if (import.meta.url === `file://${process.argv[1]}`) {
  const [dataRoot, runId] = process.argv.slice(2); assert(dataRoot && runId && /^g038a?-challenger-quiet-noise$/.test(runId));
  const repo = resolve(EXPERIMENT, '../..'), git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Commit all code before running');
  const reportPath = `experiments/performance-listening/${PREREG}`, preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  assert(readFileSync(join(EXPERIMENT, PREREG), 'utf8').startsWith(git('show', `${preregCommit}:${reportPath}`)));
  const commit = git('rev-parse', 'HEAD'); assert.equal(git('rev-parse', `${runId}-source^{commit}`), commit);
  const root = requireOutsideGit(dataRoot), privateDir = join(root, 'diagnostic-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
  assert(!existsSync(privateDir) && !existsSync(publicDir), 'Never overwrite a run');
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const artifact = (name: string, value: unknown): Artifact => { const path = join(privateDir, name); writeFileSync(path, encode(value), { flag: 'wx' }); return { path, sha256: sha(readFileSync(path)) }; };
  const checked = new Map<string, string>();
  const verify = (a: Artifact) => { const path = isAbsolute(a.path) ? a.path : join(EXPERIMENT, a.path), bytes = readFileSync(path); assert.equal(sha(bytes), a.sha256, path); checked.set(path, a.sha256); return bytes; };
  const startedAt = new Date().toISOString(), start = performance.now();
  const paths = git('ls-files', '--', 'src/audio', 'src/model', 'experiments/performance-listening/bench', 'experiments/performance-listening/listen', 'experiments/performance-listening/contracts', 'experiments/performance-listening/sources').split('\n').filter(p => /\.(ts|mjs|py|json|md)$/.test(p));
  const sourceHashes = Object.fromEntries([...paths, reportPath, 'package-lock.json', 'experiments/performance-listening/research/quiet-noise-038.md'].map(p => [relative(EXPERIMENT, resolve(repo, p)), sha(readFileSync(resolve(repo, p)))]));
  const common = { id: runId, kind: 'quiet-noise-control-diagnostic', modelAndTool: 'GPT-6.1-Sol (high) in Codex', gitCommit: commit,
    preregistration: PREREG, preregistrationCommit: preregCommit, startedAt, sourceHashes, delivery: DELIVERY, modelSha256: MODEL_HASH,
    evaluators: { following: 'following-evaluator@2', assessment: 'assessment-evaluator@3', gates: 'stage-gates@2', oracle: 'event-oracle@4' },
    liveVerdict: 'exploratory nominal-clock control comparisons; seam-3 adoption/audit still required', promotion: false, stageClaim: false, newVersions: 0 };
  const completed: Artifact[] = []; let native: NativeModel | null = null;
  const checkSummary = (v: object) => { const s = JSON.parse(encode(v)); assert.equal(s.id, runId); assert.equal(s.gitCommit, commit);
    for (const k of ['results', 'validation']) assert(s[k].path && /^[a-f0-9]{64}$/.test(s[k].sha256));
    assert(s.groups && Array.isArray(s.perExample)); return Buffer.byteLength(encode(v)); };
  try {
    readOracle4(); assert.equal(sha(readFileSync(MODEL)), MODEL_HASH);
    const originalDir = join(root, 'contract2-challenger-guitar-v1'), originalBytes = readFileSync(join(originalDir, 'manifest.json'));
    assert.equal(sha(originalBytes), PARENT_HASH); assert.equal(JSON.parse(readFileSync(join(originalDir, 'freeze.json'), 'utf8')).sha256, PARENT_HASH);
    const original = JSON.parse(originalBytes.toString()) as { examples: StageExample2[]; assets: Record<string, string> };
    for (const [path, hash] of Object.entries(original.assets)) verify({ path: assetPath(path), sha256: hash });
    const prior = [35, 36].map(n => { const path = `runs/g0${n}-${n === 35 ? 'challenger-basic-pitch' : 'incumbent-guitar'}/summary.json`, bytes = readFileSync(join(EXPERIMENT, path));
      const summary = JSON.parse(bytes.toString());
      for (const [p, hash] of Object.entries(summary.sourceHashes as Record<string, string>)) if (/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p) || p.endsWith('package-lock.json')) assert.equal(sha(readFileSync(resolve(EXPERIMENT, p))), hash, `Changed reused producer ${p}`);
      const results = JSON.parse(verify(summary.results).toString());
      for (const e of original.examples) { validateLabel(e.label); assert(results[e.id]); verify(results[e.id].artifact); }
      return { citation: { path, sha256: sha(bytes), results: summary.results }, summary, results }; });
    const oldIdentity = JSON.parse(verify(prior[0]!.summary.identity).toString());
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: '/home/williao/dev/guitar-nn', encoding: 'utf8' }).trim(), oldIdentity.guitarNNCommit);
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: '/home/williao/dev/guitar-nn', encoding: 'utf8' }).trim(), '');
    assert.equal(sha(readFileSync('/home/williao/dev/guitar-nn/environments/basic-pitch/requirements.lock')), oldIdentity.lockSha256);
    assert.deepEqual(JSON.parse(readFileSync('/home/williao/dev/guitar-nn/benchmarks/basic-pitch/config.json', 'utf8')), oldIdentity.config);
    // Verify every guitar observation and relevant prior live record, not unrelated retired sine evidence.
    for (const e of original.examples) {
      const a = JSON.parse(readFileSync(prior[0]!.results[e.id].artifact.path, 'utf8'));
      verify(a.observations.raw); verify(a.observations.decoded);
    }
    const oldLive = JSON.parse(verify(prior[0]!.summary.live).toString()) as { id: string; edge: number; gates: string[]; artifact: Artifact }[];
    for (const r of oldLive) if (r.edge === 0) verify(r.artifact);
    const protectedCount = checked.size;
    const validation = artifact('validation.json', { parent: { path: join(originalDir, 'manifest.json'), sha256: PARENT_HASH },
      citations: prior.map(p => p.citation), verifiedPriorArtifacts: Object.fromEntries(checked), originalSourcesUnchanged: true,
      identity: prior[0]!.summary.identity, externalSources: ['layers/signal.py', 'models.py'].map(p => { const path = `/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/${p}`; return { path, sha256: sha(readFileSync(path)) }; }) });
    artifact('dry-assembly.json', { checkedBeforeGenerationAndMeasurement: true, bytes: checkSummary({ ...common, validation, results: { path: join(privateDir, 'results.json'), sha256: '0'.repeat(64) }, groups: {}, perExample: [] }) });
    const manifest = freezeQuietNoise(root, original, PARENT_HASH), setPath = join(root, NOISE_SET, 'manifest.json'), set = { path: setPath, sha256: sha(readFileSync(setPath)) };
    assert.equal(manifest.examples.length, 576);
    for (const e of manifest.examples.filter(e => e.control !== 'silence')) assert.deepEqual(e, original.examples.find(p => p.id === e.id));
    const controls = manifest.examples.filter(e => e.control === 'silence'); assert.equal(controls.length, 192);
    const pairs = new Map<string, StageExample2>();
    for (const e of controls) { const key = pairKey(e), existing = pairs.get(key); if (existing) assert.deepEqual(scoredLabel(e), scoredLabel(existing)); else pairs.set(key, e); }
    assert.equal(pairs.size, 48);
    const unique = new Map<string, { path: string; sha256: string; duration: number }>();
    for (const e of controls) unique.set(e.label.audio!.sha256, { path: e.audioPath, sha256: e.label.audio!.sha256, duration: e.label.duration }); assert.equal(unique.size, 42);
    const request = artifact('observation-request.json', { out: join(privateDir, 'observations'), audio: [...unique.values()] });
    console.log('Frozen 192 controls / 48 input pairs / 42 audio hashes; starting offline inference');
    execFileSync(PYTHON, [join(EXPERIMENT, 'bench/src/challenger/observations.py'), request.path], { stdio: 'inherit' });
    const obsIndexPath = join(privateDir, 'observations/index.json'), observationIndex = JSON.parse(readFileSync(obsIndexPath, 'utf8')) as Record<string, { raw: Artifact; decoded: Artifact }>;
    const identity = { path: join(privateDir, 'observations/identity.json'), sha256: sha(readFileSync(join(privateDir, 'observations/identity.json'))) };
    assert.deepEqual(JSON.parse(verify(identity).toString()), oldIdentity, 'Model, dependency versions and decoder identity unchanged');
    const diagRequest = artifact('diagnostic-request.json', { index: obsIndexPath, audio: [...unique.values()], out: join(privateDir, 'noise-diagnostics.json') });
    execFileSync(PYTHON, [join(EXPERIMENT, 'bench/src/challenger/noiseDiagnostics038.py'), diagRequest.path], { stdio: 'inherit' });
    const diagnostic = { path: join(privateDir, 'noise-diagnostics.json'), sha256: sha(readFileSync(join(privateDir, 'noise-diagnostics.json'))) };
    const probes = new Set<string>();
    for (const score of ['s1', 's2']) for (const hesitation of [false, true]) {
      const selected = [...pairs.values()].filter(e => e.score === score && e.of.includes('-h-') === hesitation).sort((a, b) =>
        (hesitation ? b.label.duration - a.label.duration : a.label.duration - b.label.duration) || a.id.localeCompare(b.id))[0]!; probes.add(pairKey(selected));
    }
    assert.equal(probes.size, 4); artifact('probe-selection.json', [...probes].map(k => pairs.get(k)!.id));
    const loaded = performance.now(); native = new NativeModel(MODEL); const nativeLoadMs = performance.now() - loaded;
    const pairResults = new Map<string, { artifact: Artifact; incumbentAssessment: string[]; incumbentCursor: string[]; challengerAssessment: string[]; challengerCursor: string[];
      incumbentCost: ReturnType<typeof executeSeam>['cost']; challengerCost: ReturnType<typeof executeSeam>['cost'];
      decodedEvents: number; pitchedFrames: number; positionEmissions: number; prefixes: number; prefixesPass: boolean; challengerMatched: number; incumbentMatched: number }>();
    for (const [key, e] of pairs) {
      const score = JSON.parse(readFileSync(assetPath(e.scorePath), 'utf8')) as MnxStructure, compiled = compilePerformance(score); assert(compiled.ok);
      const handoff = { from: topOfScore(compiled.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
      const audio = readWav(verify({ path: e.audioPath, sha256: e.label.audio!.sha256 }));
      const observations = observationIndex[e.label.audio!.sha256]!; verify(observations.raw);
      const decoded = JSON.parse(verify(observations.decoded).toString()) as { events: ObservationEvent[] };
      const offline = new BasicPitchChain(decoded.events); assert(offline.start(score, handoff, DELIVERY).ok); offline.feed(new Float32Array(), e.label.duration);
      validateRecord(offline.finish().map(d => ({ ...d, madeAt: e.label.duration }))); const challengerReport = offline.assessment();
      const challengerAssessment = evaluateAssessment3(e.label, challengerReport), ca = assessmentGates2(e.label, challengerAssessment);
      const incumbent = new EventChain3(), ir = executeSeam(() => incumbent, score, handoff, audio, DELIVERY); assert(ir.started.ok);
      const incumbentReport = incumbent.assessment(), iae = evaluateAssessment3(e.label, incumbentReport), ia = assessmentGates2(e.label, iae);
      const ife = evaluateFollowing(e.label, ir.record), ic = cursorGates(e.label, ife);
      const live = new BasicPitchLive(native, 0), lr = executeSeam(() => live, score, handoff, audio, DELIVERY); assert(lr.started.ok);
      const lfe = evaluateFollowing(e.label, lr.record), lc = cursorGates(e.label, lfe);
      const prefix = probes.has(key) ? { incumbent: seamCausality(() => new EventChain3(), score, handoff, audio, DELIVERY, ir.record),
        challenger: seamCausality(() => new BasicPitchLive(native!, 0), score, handoff, audio, DELIVERY, lr.record) } : { incumbent: [], challenger: [] };
      const a = artifact(`pair-${pairResults.size}.json`, { key, example: e.id, labelSha256: sha(encode(e.label)), observations,
        incumbent: { record: ir.record.map(decisionToJSON), report: serialize(incumbentReport), assessment: iae, following: ife, assessmentGates: ia, cursorGates: ic, cost: ir.cost },
        challenger: { report: serialize(challengerReport), assessment: challengerAssessment, assessmentGates: ca,
          record: lr.record.map(decisionToJSON), following: lfe, cursorGates: lc, cost: lr.cost, frames: live.frames, edge: 0, liveClock: 'nominal' }, prefix }); completed.push(a);
      pairResults.set(key, { artifact: a, incumbentAssessment: ia.failed, incumbentCursor: ic.failed, challengerAssessment: ca.failed, challengerCursor: lc.failed,
        incumbentCost: ir.cost, challengerCost: lr.cost, decodedEvents: decoded.events.length, pitchedFrames: live.frames.filter(f => f.midi !== null).length,
        positionEmissions: lr.record.filter(d => d.kind === 'position').length, prefixes: prefix.incumbent.length + prefix.challenger.length,
        prefixesPass: [...prefix.incumbent, ...prefix.challenger].every(p => p.pass), challengerMatched: challengerReport.notes.filter(n => n.kind === 'note' && n.verdict === 'match').length,
        incumbentMatched: incumbentReport.notes.filter(n => n.kind === 'note' && n.verdict === 'match').length });
      console.log(`noise pair ${pairResults.size}/48: incumbent ${ia.failed.length}/${ic.failed.length}, challenger ${ca.failed.length}/${lc.failed.length}`);
    }
    await native.close(); native = null;
    const rows = controls.map(e => ({ id: e.id, guitar: (e.label.provenance.recipe as { sampleSource: string }).sampleSource,
      part: e.of.includes('-h-') ? 'hesitation' : 'clean', key: pairKey(e), ...pairResults.get(pairKey(e))! }));
    const aggregate = (rs: typeof rows) => ({ examples: rs.length,
      incumbent: { assessmentPassed: rs.filter(r => !r.incumbentAssessment.length).length, cursorComparisonPassed: rs.filter(r => !r.incumbentCursor.length).length, matchedNotes: rs.reduce((s, r) => s + r.incumbentMatched, 0) },
      challenger: { assessmentPassed: rs.filter(r => !r.challengerAssessment.length).length, cursorComparisonPassed: rs.filter(r => !r.challengerCursor.length).length, matchedNotes: rs.reduce((s, r) => s + r.challengerMatched, 0) } });
    const groups = Object.fromEntries([['all', aggregate(rows)], ...GUITARS.flatMap(g => ['clean', 'hesitation'].map(p => [`${g}:${p}`, aggregate(rows.filter(r => r.guitar === g && r.part === p))]))]);
    const cost = (which: 'incumbentCost' | 'challengerCost') => ({ maxSustained: Math.max(...[...pairResults.values()].map(r => r[which]!.sustainedRatio)), maxP99Ms: Math.max(...[...pairResults.values()].map(r => r[which]!.p99Ms)), maxBacklogMs: Math.max(...[...pairResults.values()].map(r => r[which]!.maxBacklogMs)), provisional: true });
    const prefixesPass = [...pairResults.values()].every(r => r.prefixesPass), noiseFailure = rows.some(r => [r.incumbentAssessment, r.incumbentCursor, r.challengerAssessment, r.challengerCursor].some(a => a.length));
    const decision = !prefixesPass ? 'D3' : noiseFailure ? 'D2' : 'D1';
    const results = artifact('results.json', rows), details = artifact('details.json', { pairs: Object.fromEntries(pairResults), originalGuitarAssessment: prior.map(p => p.summary.groups), priorCleanEdge0: oldLive.filter(r => r.edge === 0), protectedCount });
    const summary = { ...common, status: 'measured', decision, validation, results, details, diagnostic, identity, set, generator: manifest.generator,
      uniqueInputs: pairs.size, uniqueAudio: unique.size, retainedExamples: 384, citations: prior.map(p => p.citation), groups,
      perExample: rows.map(r => [r.id, r.incumbentAssessment, r.incumbentCursor, r.challengerAssessment, r.challengerCursor]),
      sampledPrefixes: [...pairResults.values()].reduce((s, r) => s + r.prefixes, 0), sampledPrefixesPass: prefixesPass,
      freshCost: { machine: [...pairResults.values()][0]!.challengerCost!.machine, incumbent: cost('incumbentCost'), challenger: cost('challengerCost'), nativeLoadMs },
      noiseResponse: { pairsWithDecodedPitch: [...pairResults.values()].filter(r => r.decodedEvents > 0).length, pairsWithLivePitch: [...pairResults.values()].filter(r => r.pitchedFrames > 0).length,
        pairsWithPositionClaim: [...pairResults.values()].filter(r => r.positionEmissions > 0).length },
      levels: manifest.levels.map(l => l.levels), finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000 };
    const bytes = checkSummary(summary); writeFileSync(join(publicDir, 'summary.json'), encode(summary), { flag: 'wx' });
    artifact('completed.json', { publicBytes: bytes, exceedsSizeTarget: bytes > 300000, summarySha256: sha(readFileSync(join(publicDir, 'summary.json'))) });
    console.log(encode({ decision, groups, cost: summary.freshCost, response: summary.noiseResponse, publicBytes: bytes, elapsedSeconds: summary.elapsedSeconds }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, completed });
    writeFileSync(join(publicDir, 'summary.json'), encode({ ...common, status: 'infrastructure-failed', failure, completed, finishedAt: new Date().toISOString() }), { flag: 'wx' }); throw error;
  } finally { if (native) await native.close(); }
}
