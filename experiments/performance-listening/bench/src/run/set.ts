import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { clockFollower, CLOCK_VERSION } from '../candidates/clockFollower.ts';
import { evaluate, EVALUATOR_VERSION } from '../evaluate/index.ts';
import { verifySetLock } from '../generate/set.ts';
import { readWav } from '../generate/wav.ts';
import { EXPERIMENT, encode, json, readSet, sha256 } from '../io.ts';
import { renderReport, type RunReport } from '../report/index.ts';
import { checkPrefix, DELIVERY, execute, machine, prefixCuts, RUNNER_VERSION } from './runner.ts';
export function sourceHashes(): Record<string, string> {
  const root = join(EXPERIMENT, 'bench/src');
  function walk(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(join(path, d.name)) : [join(path, d.name)]); }
  const paths = [...walk(root), ...readdirSync(join(EXPERIMENT, 'contracts')).filter(n => n.endsWith('.md') || n.endsWith('.schema.json')).map(n => join(EXPERIMENT, 'contracts', n)), join(EXPERIMENT, 'generators/sine-v1.json')].sort();
  return Object.fromEntries(paths.map(p => [relative(EXPERIMENT, p), sha256(readFileSync(p))]));
}
export function runSet(id: string, runId: string): string {
  if (!/^[a-z0-9-]+$/.test(runId)) throw new Error('Invalid run id');
  verifySetLock(id);
  const repo = join(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const dirty = git('status', '--porcelain', '--', 'experiments/performance-listening/bench/src', 'src/audio', 'src/model');
  if (dirty) throw new Error('Commit candidate, instrument and shared timing code before recording a run');
  const set = readSet(id); const output = join(EXPERIMENT, 'runs', runId);
  const report: RunReport = { id: runId, candidate: CLOCK_VERSION, set: id, evaluator: EVALUATOR_VERSION, evaluations: [], causality: [], costs: [] };
  const records: Record<string, unknown> = {};
  for (const { folder, golden } of set.examples) {
    const wav = readFileSync(join(folder, golden.audio.path));
    if (sha256(wav) !== golden.audio.sha256) throw new Error(`${golden.example}: audio hash mismatch; regenerate`);
    const score = json<MnxStructure>(join(folder, golden.intended.score)); const pcm = readWav(wav);
    if (pcm.length !== golden.audio.duration * DELIVERY.sampleRate) throw new Error('Audio duration mismatch');
    const run = execute(clockFollower, score, golden.intended.tempo, pcm);
    records[golden.example] = run.record;
    report.evaluations.push(evaluate(golden, run.record));
    report.costs!.push({ example: golden.example, value: run.cost });
    const cuts = checkPrefix(clockFollower, score, golden.intended.tempo, pcm, prefixCuts(golden));
    report.causality!.push({ example: golden.example, pass: cuts.every(c => c.pass), cuts });
  }
  mkdirSync(join(EXPERIMENT, 'runs'), { recursive: true }); mkdirSync(output); // never overwrite run history
  const metadata = { id: runId, candidate: CLOCK_VERSION, runner: RUNNER_VERSION, evaluator: EVALUATOR_VERSION, generator: 'sine-v1', set: { id, version: set.manifest.version, lock: sha256(readFileSync(join(set.path, 'set.lock.json'))) },
    instrumentContract: 'v1', researchContract: { id: 'research-contract-0', provisional: true, humanApproved: false }, randomness: null,
    delivery: DELIVERY, clock: 'samples released / 48000; wall clock excluded from decisions', machine: machine(), gitCommit: git('rev-parse', 'HEAD'), sourceHashes: sourceHashes(),
    conditions: 'Node process on development machine; no forced pacing or warm-up; feed costs measured separately from logical clock; variable wall cost; sustained includes start/finish; maximum backlog is work remaining at the next chunk release',
    reproduce: `npm -w mnx-listening-bench run generate -- ${id}; npm -w mnx-listening-bench run run -- ${id} <new-run-id>` };
  writeFileSync(join(output, 'metadata.json'), encode(metadata));
  for (const [example, record] of Object.entries(records)) writeFileSync(join(output, `${example}.decisions.json`), encode(record));
  writeFileSync(join(output, 'counts.json'), encode(report.evaluations));
  writeFileSync(join(output, 'run.json'), encode(report));
  writeFileSync(join(output, 'report.md'), renderReport(report));
  return output;
}
export function reportRun(id: string): string {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid run id');
  return renderReport(json<RunReport>(join(EXPERIMENT, 'runs', id, 'run.json')));
}
