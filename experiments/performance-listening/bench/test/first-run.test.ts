import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { clockFollower } from '../src/candidates/clockFollower.ts';
import { evaluate } from '../src/evaluate/index.ts';
import { synthesize } from '../src/generate/sine.ts';
import { readWav } from '../src/generate/wav.ts';
import { verifySetLock } from '../src/generate/set.ts';
import { EXPERIMENT, encode, json, readSet, sha256 } from '../src/io.ts';
import type { RunReport } from '../src/report/index.ts';
import { renderReport } from '../src/report/index.ts';
import { execute, checkPrefix, prefixCuts } from '../src/run/runner.ts';
import type { Decision } from '../src/types.ts';
const runId = 'g001-clock-harness-v1';
const folder = join(EXPERIMENT, 'runs', runId);
const run = json<RunReport>(join(folder, 'run.json'));
// Literal arithmetic from FIRST_STEP §9 and the pre-run endpoint convention.
const predicted = {
  p1: { correct: 68, wrong: 0, falseFollowing: 0, missed: 0, exposure: 0, answerable: 68 },
  p2: { correct: 148, wrong: 0, falseFollowing: 0, missed: 0, exposure: 0, answerable: 148 },
  'c1-silence': { correct: 0, wrong: 0, falseFollowing: 168, missed: 168, exposure: 8.35, answerable: 168 },
  'c2-wrong-piece': { correct: 0, wrong: 0, falseFollowing: 158, missed: 158, exposure: 7.85, answerable: 158 },
  't1-tempo-90': { correct: 8, wrong: 90, falseFollowing: 0, missed: 90, exposure: 4.5, answerable: 98 },
};
it('matches every first-run prediction with no candidate or label adjustment', () => {
  expect(run.evaluations.map(e => e.example)).toEqual(Object.keys(predicted));
  for (const e of run.evaluations) {
    const p = predicted[e.example as keyof typeof predicted];
    for (const view of [e.asDecided, e.hindsight]) {
      expect(view.counts).toEqual({ correct: p.correct, wrong: p.wrong, falseFollowing: p.falseFollowing, overAmbiguous: 0, lost: 0, abstained: 0, uncovered: 0, correctRejection: 0, pending: 2, confidentPending: 2 });
      expect(view.denominators.answerable).toBe(p.answerable);
      expect(view.confidence.slice(0, 4).every(b => b.claims === 0)).toBe(true);
      expect(view.confidence[4]).toMatchObject({ claims: p.answerable + 2, pending: 2, answerable: p.answerable, correct: p.correct });
    }
    expect(e.timeliness.missed).toBe(p.missed);
    expect(e.timeliness.delays.filter(d => d.seconds !== null).every(d => d.seconds === 0)).toBe(true);
    expect(e.exposure).toEqual({ totalSeconds: p.exposure, longestSeconds: p.exposure });
  }
  const probe = run.evaluations.find(e => e.example === 't1-tempo-90')!;
  expect(probe.asDecided.errors.values).toEqual(Array.from({ length: 90 }, (_, i) => (11 + i) / 40));
  expect(probe.asDecided.errors.max).toBe(2.5);
  expect(probe.asDecided.points.find(p => p.time === .5)?.category).toBe('correct');
  expect(probe.asDecided.points.find(p => p.time === .55)?.category).toBe('wrong');
  expect(probe.asDecided.points.at(-1)).toMatchObject({ time: 5, error: 2.5 });
  expect(run.evaluations.reduce((n, e) => n + e.asDecided.confidence[4]!.claims, 0)).toBe(650);
  expect(run.evaluations.reduce((n, e) => n + e.asDecided.confidence[4]!.correct, 0)).toBe(224);
  expect(run.causality).toHaveLength(5);
  expect(run.causality!.every(c => c.pass && c.cuts.length === 3 && c.cuts.every(p => p.pass))).toBe(true);
  for (const { value: c } of run.costs!) {
    expect(c.provisional).toBe(true); expect(c.machine.hostname.length).toBeGreaterThan(0); expect(c.machine.cpu.length).toBeGreaterThan(0);
    for (const n of [c.meanMs, c.p95Ms, c.p99Ms, c.sustainedRatio, c.maxBacklogMs, c.initializationMs, c.finishMs]) expect(Number.isFinite(n) && n >= 0).toBe(true);
  }
});
it('reproduces the recorded logical bytes, independent evaluator counts and causality from pinned recipes', () => {
  verifySetLock('harness-v1');
  for (const { folder: exampleFolder, golden } of readSet('harness-v1').examples) {
    const score = json<MnxStructure>(join(exampleFolder, 'score.mnx.json'));
    const wav = synthesize(score, golden.audio.recipe).wav;
    expect(sha256(wav)).toBe(golden.audio.sha256);
    const pcm = readWav(wav);
    const record = json<Decision[]>(join(folder, `${golden.example}.decisions.json`));
    expect(sha256(encode(execute(clockFollower, score, golden.intended.tempo, pcm).record))).toBe(sha256(encode(record)));
    expect(evaluate(golden, record)).toEqual(run.evaluations.find(e => e.example === golden.example));
    expect(checkPrefix(clockFollower, score, golden.intended.tempo, pcm, prefixCuts(golden))).toEqual(run.causality!.find(c => c.example === golden.example)!.cuts);
  }
  expect(json(join(folder, 'counts.json'))).toEqual(run.evaluations);
  expect(renderReport(run)).toBe(readFileSync(join(folder, 'report.md'), 'utf8'));
});
it('freezes instrument contracts but leaves the research contract provisional and unapproved', () => {
  const frozen = json<{ status: string; run: string; files: Record<string, string> }>(join(EXPERIMENT, 'contracts/freeze.json'));
  expect(frozen.status).toBe('frozen'); expect(frozen.run).toBe(runId);
  expect(Object.keys(frozen.files)).not.toContain('research-contract-0.md');
  for (const [path, hash] of Object.entries(frozen.files)) expect(sha256(readFileSync(join(EXPERIMENT, 'contracts', path)))).toBe(hash);
  const metadata = json<{ researchContract: { provisional: boolean; humanApproved: boolean }; sourceHashes: Record<string, string>; randomness: null; gitCommit: string }>(join(folder, 'metadata.json'));
  expect(metadata.researchContract).toMatchObject({ provisional: true, humanApproved: false }); expect(metadata.randomness).toBeNull();
  expect(metadata.gitCommit).toMatch(/^[a-f0-9]{40}$/);
  for (const [path, hash] of Object.entries(metadata.sourceHashes)) expect(sha256(readFileSync(join(EXPERIMENT, path)))).toBe(hash);
  const pkg = json<{ dependencies?: object }>(join(EXPERIMENT, 'bench/package.json'));
  expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
});
