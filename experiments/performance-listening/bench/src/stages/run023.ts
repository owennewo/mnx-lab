// Experiment 023's runner: the frozen baselines on contract2-stage1-v2 (stage 1 and its
// controls) under following-evaluator@2 and stage-gates@1:
//   tsx src/stages/run023.ts <stage-set-dir> <run-id> <preregistration>
// Refuses unless the experiment's files are committed and the pre-registration is in
// HEAD; never overwrites a run. Private records go beside the set; the public summary
// names them by path and hash, pins the commit and source hashes, and compares each
// record on a stage-1 example with the same listener's record in g022.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational as exact } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Handoff } from '../../../listen/contract.ts';
import { decisionToJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { CANDIDATES } from '../ladder/candidates.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { legacyListener, type LegacyStats } from '../seam/legacy.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { ASSESSMENT_EVALUATOR_2 } from '../events/assessment2.ts';
import { evaluateFollowing, FOLLOWING_EVALUATOR, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates, costGates, cursorGates, pooledGates, PROPOSED, STAGE_GATES } from '../events/gates.ts';
import type { PerformanceLabel } from '../events/label.ts';
import { readOracle, readOracle2 } from '../events/oracle.ts';
import { HANDED } from './stage1.ts';
import { assetPath, readStageSet2 } from './stage1v2.ts';

export const BASELINES = ['clock-follower@1', 'online-time-warp@8', 'online-time-warp@12', 'online-time-warp@14'] as const;
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const CAUSALITY_EXAMPLES = ['s1-90', 's2-90', 'sil-s2-90', 'w1-s2-90'];
const G022 = 'runs/g022-stage1-baselines/summary.json';
const SOURCES = [
  'contracts/event-instruments-2.md', 'bench/oracle-events/oracle-2.json', 'bench/oracle-events/oracle.json',
  'bench/src/events/label.ts', 'bench/src/events/following.ts', 'bench/src/events/assessment2.ts', 'bench/src/events/gates.ts', 'bench/src/events/oracle.ts',
  'bench/src/stages/stage1.ts', 'bench/src/stages/stage1v2.ts', 'bench/src/stages/run023.ts',
  'bench/src/seam/legacy.ts', 'bench/src/seam/runner.ts', 'bench/src/ladder/render.ts', 'bench/src/ladder/candidates.ts',
  'bench/src/candidates/clockFollower.ts', 'bench/src/candidates/onlineTimeWarp1.ts', 'bench/src/candidates/onlineTimeWarp2.ts',
  'bench/src/candidates/onlineTimeWarpConfigurable.ts', 'bench/src/candidates/onlineTimeWarp8.ts',
  'bench/src/candidates/onlineTimeWarp12.ts', 'bench/src/candidates/onlineTimeWarp14.ts',
  'listen/liveView.ts', 'listen/backend.ts', 'listen/validate.ts', 'listen/positions.ts', 'listen/contract.ts',
  'sources/s1-one-bar-c4-f4.mnx.json', 'sources/s2-two-bar-scale.mnx.json', 'sources/w1-two-bar-black-keys.mnx.json',
];

const performanceOf = (score: MnxStructure) => {
  const c = compilePerformance(score);
  if (!c.ok || c.performance.diagnostics.length) throw new Error('The score does not compile cleanly');
  return c.performance;
};
const summarise = (e: FollowingEvaluation) => ({
  onEvent: e.asDecided.onEventFraction, ahead: e.asDecided.aheadFraction,
  correctRejection: e.asDecided.seconds.answerable ? e.asDecided.seconds.correctRejection / e.asDecided.seconds.answerable : null,
  seconds: e.asDecided.seconds, hindsightOnEvent: e.hindsight.onEventFraction,
  exposure: e.exposure, byEvent: { reached: e.byEvent.reached, of: e.byEvent.of, delays: e.byEvent.events.map(v => v.delay) },
  recovery: { recovered: e.recovery.recovered, of: e.recovery.of, notAssessable: e.recovery.notAssessable }, extras: e.extras,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const [setDir, runId, preregistration] = process.argv.slice(2);
  if (!setDir || !runId || !preregistration || !/^g\d{3}[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: tsx src/stages/run023.ts <stage-set-dir> <run-id> <preregistration>');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: EXPERIMENT, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--', '.')) throw new Error('Commit the experiment before running it');
  git('cat-file', '-e', `HEAD:experiments/performance-listening/${preregistration}`);
  const commit = git('rev-parse', 'HEAD');
  const publicDir = resolve(EXPERIMENT, 'runs', runId), privateDir = join(requireOutsideGit(setDir), 'runs', runId);
  if (existsSync(publicDir) || existsSync(privateDir)) throw new Error(`Run ${runId} exists; a run is never overwritten`);
  readOracle(); readOracle2();
  const { manifest, sha256: setSha } = readStageSet2(setDir);
  const g022 = JSON.parse(readFileSync(resolve(EXPERIMENT, G022), 'utf8')) as { results: Record<string, Record<string, { record: { sha256: string }; following: { onEvent: number; ahead: number; byEvent: { reached: number; of: number } } }>> };
  mkdirSync(privateDir, { recursive: true });

  const results: Record<string, unknown> = {}, causality: Record<string, unknown> = {}, perListener: Record<string, unknown> = {};
  for (const id of BASELINES) {
    const entry = CANDIDATES.find(c => c.id === id)!;
    const perExample: Record<string, unknown> = {}, pooledInput: { label: PerformanceLabel; following: FollowingEvaluation | null; assessment: null }[] = [], costs: { sustainedRatio: number; p99Ms: number }[] = [];
    let prefixChecksPassed = true;
    for (const example of manifest.examples) {
      const score = JSON.parse(readFileSync(assetPath(example.scorePath), 'utf8')) as MnxStructure, performance = performanceOf(score);
      const audio = readWav(readFileSync(example.audioPath));
      if (audio.length !== example.label.audio!.samples) throw new Error(`${example.id}: audio length differs from its label`);
      const handoff: Handoff = { from: topOfScore(performance), parts: partIds(score), tempo: { quartersPerMinute: exact(BigInt(HANDED)) }, rate: 1 };
      const stats: LegacyStats = { clamped: 0, droppedNotes: 0 };
      const run = executeSeam(legacyListener(entry.factory, entry.legacy, stats), score, handoff, audio, DELIVERY);
      const recordPath = join(privateDir, `${id.replace('@', '-')}.${example.id}.json`);
      writeFileSync(recordPath, encode({ listener: id, example: example.id, started: run.started, record: run.record.map(decisionToJSON) }));
      const recordSha = sha(readFileSync(recordPath));
      const following = run.started.ok ? evaluateFollowing(example.label, run.record) : null;
      const cursor = following ? cursorGates(example.label, following) : null, assessment = assessmentGates(example.label, null);
      if (run.cost) costs.push({ sustainedRatio: run.cost.sustainedRatio, p99Ms: run.cost.p99Ms });
      pooledInput.push({ label: example.label, following, assessment: null });
      const before = example.kind === 'performance' ? g022.results[id]?.[example.id] : undefined;
      perExample[example.id] = {
        kind: example.kind, control: example.control, of: example.of, score: example.score, tempo: example.tempo,
        started: run.started, legacy: stats, cost: run.cost,
        following: following ? summarise(following) : null,
        gates: { cursor, assessment, passed: (cursor?.passed ?? false) && assessment.passed },
        record: { path: recordPath, sha256: recordSha, decisions: run.record.length },
        g022: before ? { recordSha256: before.record.sha256, identical: before.record.sha256 === recordSha,
          sameFollowing: !!following && before.following.onEvent === following.asDecided.onEventFraction && before.following.ahead === following.asDecided.aheadFraction
            && before.following.byEvent.reached === following.byEvent.reached && before.following.byEvent.of === following.byEvent.of } : null,
      };
      if (CAUSALITY_EXAMPLES.includes(example.id) && run.started.ok) {
        const check = seamCausality(legacyListener(entry.factory, entry.legacy), score, handoff, audio, DELIVERY, run.record);
        causality[`${id} ${example.id}`] = check;
        if (!check.every(c => c.pass)) prefixChecksPassed = false;
      }
      const f = (perExample[example.id] as { following: ReturnType<typeof summarise> | null }).following;
      console.log(`${id} ${example.id}: ${run.started.ok ? `on ${f?.onEvent?.toFixed(3)} ahead ${f?.ahead?.toFixed(3)} rejection ${f?.correctRejection?.toFixed(3)} cursor gates ${cursor?.failed.join(',') || 'pass'}` : run.started.refused}`);
    }
    results[id] = perExample;
    perListener[id] = { pooled: pooledGates(pooledInput), cost: costGates(prefixChecksPassed, costs) };
  }
  const summary = {
    id: runId, kind: 'stage-baselines', policy: 'development-contract-2', preregistration, gitCommit: commit,
    evaluators: { following: FOLLOWING_EVALUATOR, assessment: `${ASSESSMENT_EVALUATOR_2} (oracle only: the baselines emit no assessment)`, gates: STAGE_GATES, proposed: PROPOSED },
    mapping: 'Rule 1 of following-evaluator@2: the last event whose onset a position has reached.',
    oracle: { v1: sha(readFileSync(resolve(EXPERIMENT, 'bench/oracle-events/oracle.json'))), v2: sha(readFileSync(resolve(EXPERIMENT, 'bench/oracle-events/oracle-2.json'))) },
    set: { id: manifest.id, dir: setDir, sha256: setSha, handedQuartersPerMinute: manifest.handedQuartersPerMinute, identicalToV1: manifest.identicalToV1,
      examples: manifest.examples.map(e => ({ id: e.id, kind: e.kind, control: e.control, of: e.of, score: e.score, tempo: e.tempo, duration: e.label.duration, audioSha256: e.label.audio!.sha256 })) },
    compared: G022,
    delivery: DELIVERY, listeners: BASELINES, results, perListener, causality,
    sourceHashes: Object.fromEntries(SOURCES.map(p => [p, sha(readFileSync(resolve(EXPERIMENT, p)))])),
  };
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'summary.json'), encode(summary));
  console.log(`Wrote runs/${runId}/summary.json`);
}
