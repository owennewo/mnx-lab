// Runs frozen baselines on a frozen stage set under following-evaluator@2:
//   tsx src/stages/run.ts <stage-set-dir> <run-id> <preregistration>
// Refuses unless the experiment's files are committed and the pre-registration is in
// HEAD; never overwrites a run. Private records go beside the set; the public summary
// names them by path and hash and pins the commit and source hashes.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { multiply, rational as exact, toSafeFraction } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Decision, Handoff } from '../../../listen/contract.ts';
import { decisionToJSON } from '../../../listen/json.ts';
import { toPerformed, topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { CANDIDATES } from '../ladder/candidates.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { legacyListener, type LegacyStats } from '../seam/legacy.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { ASSESSMENT_EVALUATOR } from '../events/assessment.ts';
import { evaluateFollowing, FOLLOWING_EVALUATOR, type FollowingEvaluation } from '../events/following.ts';
import { eventPositions, type PerformanceLabel } from '../events/label.ts';
import { readOracle } from '../events/oracle.ts';
import { HANDED, readStageSet } from './stage1.ts';

export const BASELINES = ['clock-follower@1', 'online-time-warp@8', 'online-time-warp@12', 'online-time-warp@14'] as const;
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const SOURCES = [
  'contracts/event-instruments-1.md', 'bench/oracle-events/oracle.json',
  'bench/src/events/label.ts', 'bench/src/events/following.ts', 'bench/src/events/assessment.ts', 'bench/src/events/oracle.ts',
  'bench/src/stages/stage1.ts', 'bench/src/stages/run.ts',
  'bench/src/seam/legacy.ts', 'bench/src/seam/runner.ts', 'bench/src/ladder/render.ts', 'bench/src/ladder/candidates.ts',
  'bench/src/candidates/clockFollower.ts', 'bench/src/candidates/onlineTimeWarp1.ts', 'bench/src/candidates/onlineTimeWarp2.ts',
  'bench/src/candidates/onlineTimeWarpConfigurable.ts', 'bench/src/candidates/onlineTimeWarp8.ts',
  'bench/src/candidates/onlineTimeWarp12.ts', 'bench/src/candidates/onlineTimeWarp14.ts',
  'listen/liveView.ts', 'listen/backend.ts', 'listen/validate.ts', 'listen/positions.ts',
];

/** The pre-registered diagnostic: each position replaced by the event whose onset is
 * nearest in performed quarters, ties to the later. Never scored. */
export function nearestEventRecord(label: PerformanceLabel, performance: ReturnType<typeof performanceOf>, record: readonly Decision[]): Decision[] {
  const positions = eventPositions(label);
  const quartersOf = (at: Parameters<typeof toPerformed>[1]) => {
    const performed = toPerformed(performance, at);
    if (!performed.ok) throw new Error(performed.diagnostic.message);
    const q = toSafeFraction(multiply(performed.value, exact(4n)));
    return q.num / q.den;
  };
  return record.map(d => d.kind !== 'position' ? d : { ...d, candidates: d.candidates.map(c => {
    const q = quartersOf(c.at);
    let best = 0;
    label.events.forEach((e, i) => { if (Math.abs(e.quarter - q) <= Math.abs(label.events[best]!.quarter - q)) best = i; });
    return { ...c, at: positions[best]! };
  }) });
}
const performanceOf = (score: MnxStructure) => {
  const c = compilePerformance(score);
  if (!c.ok || c.performance.diagnostics.length) throw new Error('The score does not compile cleanly');
  return c.performance;
};
const summarise = (e: FollowingEvaluation) => ({
  onEvent: e.asDecided.onEventFraction, ahead: e.asDecided.aheadFraction,
  seconds: e.asDecided.seconds, hindsightOnEvent: e.hindsight.onEventFraction,
  exposure: e.exposure, byEvent: { reached: e.byEvent.reached, of: e.byEvent.of, delays: e.byEvent.events.map(v => v.delay) },
  recovery: { recovered: e.recovery.recovered, of: e.recovery.of, notAssessable: e.recovery.notAssessable }, extras: e.extras,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const [setDir, runId, preregistration] = process.argv.slice(2);
  if (!setDir || !runId || !preregistration || !/^g\d{3}[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: tsx src/stages/run.ts <stage-set-dir> <run-id> <preregistration>');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: EXPERIMENT, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--', '.')) throw new Error('Commit the experiment before running it');
  git('cat-file', '-e', `HEAD:experiments/performance-listening/${preregistration}`);
  const commit = git('rev-parse', 'HEAD');
  const publicDir = resolve(EXPERIMENT, 'runs', runId), privateDir = join(requireOutsideGit(setDir), 'runs', runId);
  if (existsSync(publicDir) || existsSync(privateDir)) throw new Error(`Run ${runId} exists; a run is never overwritten`);
  readOracle();
  const { manifest, sha256: setSha } = readStageSet(setDir);
  mkdirSync(privateDir, { recursive: true });

  const results: Record<string, unknown> = {}, causality: Record<string, unknown> = {};
  for (const id of BASELINES) {
    const entry = CANDIDATES.find(c => c.id === id)!;
    const perExample: Record<string, unknown> = {};
    for (const example of manifest.examples) {
      const score = JSON.parse(readFileSync(example.scorePath, 'utf8')) as MnxStructure, performance = performanceOf(score);
      const audio = readWav(readFileSync(example.audioPath));
      if (audio.length !== example.label.audio!.samples) throw new Error(`${example.id}: audio length differs from its label`);
      const handoff: Handoff = { from: topOfScore(performance), parts: partIds(score), tempo: { quartersPerMinute: exact(BigInt(HANDED)) }, rate: 1 };
      const stats: LegacyStats = { clamped: 0, droppedNotes: 0 };
      const run = executeSeam(legacyListener(entry.factory, entry.legacy, stats), score, handoff, audio, DELIVERY);
      const recordPath = join(privateDir, `${id.replace('@', '-')}.${example.id}.json`);
      writeFileSync(recordPath, encode({ listener: id, example: example.id, started: run.started, record: run.record.map(decisionToJSON) }));
      perExample[example.id] = {
        started: run.started, legacy: stats, cost: run.cost,
        following: run.started.ok ? summarise(evaluateFollowing(example.label, run.record)) : null,
        diagnosticNearest: run.started.ok ? (({ onEvent, ahead, byEvent }) => ({ onEvent, ahead, byEvent: { reached: byEvent.reached, of: byEvent.of } }))(summarise(evaluateFollowing(example.label, nearestEventRecord(example.label, performance, run.record)))) : null,
        record: { path: recordPath, sha256: sha(readFileSync(recordPath)), decisions: run.record.length },
      };
      if (example.tempo === HANDED && run.started.ok) {
        causality[`${id} ${example.score}`] = seamCausality(legacyListener(entry.factory, entry.legacy), score, handoff, audio, DELIVERY, run.record);
      }
      console.log(`${id} ${example.id}: ${run.started.ok ? JSON.stringify((perExample[example.id] as { following: { onEvent: number; ahead: number } }).following.onEvent) : run.started.refused}`);
    }
    results[id] = perExample;
  }
  const summary = {
    id: runId, kind: 'stage-baselines', policy: 'development-contract-2', preregistration, gitCommit: commit,
    evaluators: { following: FOLLOWING_EVALUATOR, assessment: `${ASSESSMENT_EVALUATOR} (oracle only: the baselines emit no assessment)` },
    mapping: 'Scored: rule 1 of following-evaluator@2, the last event whose onset a position has reached. diagnosticNearest: the nearest onset, never scored.',
    oracle: { sha256: sha(readFileSync(resolve(EXPERIMENT, 'bench/oracle-events/oracle.json'))) },
    set: { id: manifest.id, dir: setDir, sha256: setSha, handedQuartersPerMinute: manifest.handedQuartersPerMinute, examples: manifest.examples.map(e => ({ id: e.id, tempo: e.tempo, duration: e.label.duration, audioSha256: e.label.audio!.sha256 })) },
    delivery: DELIVERY, listeners: BASELINES, results, causality,
    sourceHashes: Object.fromEntries(SOURCES.map(p => [p, sha(readFileSync(resolve(EXPERIMENT, p)))])),
  };
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'summary.json'), encode(summary));
  console.log(`Wrote runs/${runId}/summary.json`);
}
