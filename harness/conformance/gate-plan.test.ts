// The targeted landing gate's rule (tools/gate.mjs, docs/gates.md). Each case
// is a kind of change seen in main's history, or a miss found when vitest's
// import graph alone was tried as the selector.
import { expect, it } from 'vitest';
// @ts-expect-error Plain Node tool module.
import { planGate } from '../../tools/gate.mjs';
// @ts-expect-error Plain Node harness module.
import { smokeCoverage } from '../verify/run-smokes.mjs';

const ALL_SMOKES = (smokeCoverage() as { name: string }[]).map(smoke => smoke.name);

it('prose and plans run nothing', () => {
  const plan = planGate(['roadmap/proposed/core-x.md', 'research/notes.md', '.claude/skills/verify/SKILL.md']);
  expect(plan.tests).toEqual({ mode: 'none' });
  expect(plan.build).toBe(false);
  expect(plan.smokes).toEqual([]);
});
it('prose a test reads runs the link check, and nothing else', () => {
  const plan = planGate(['docs/browser-smokes.md', 'CLAUDE.md']);
  expect(plan.tests.mode).toBe('files');
  expect(plan.tests.files).toEqual(expect.arrayContaining(['harness/conformance/local-markdown-links.test.ts']));
  expect(plan.build).toBe(false);
  expect(plan.smokes).toEqual([]);
});
it('data read from disk runs every test — the misses the import graph had', () => {
  for (const file of [
    'scenarios/lab/00-document/01-minimal-single-note/expected.primitives.json',
    'public/smufl/bravura_metadata.json',
    'migrations/0006_piece_prefs.sql',
    'harness/fixtures/roundtrip-register.json',
    'converters/fixtures/Binary-suite.gp3',
    'package.json',
  ]) expect(planGate([file]).tests, file).toEqual({ mode: 'full' });
});
it('code runs what imports it plus the tests that read source from disk', () => {
  const plan = planGate(['src/engine/layout/spacing.ts']);
  expect(plan.tests.mode).toBe('changed');
  expect(plan.tests.always).toEqual(expect.arrayContaining(['harness/conformance/architecture-boundaries.test.ts']));
  expect(plan.build).toBe(true);
  expect(plan.smokes).toEqual(ALL_SMOKES);
});
it('a shell change runs that shell\'s smokes only', () => {
  const studio = planGate(['apps/studio/src/main.ts']).smokes;
  expect(studio).toContain('studio');
  expect(studio).not.toContain('inspector');
  const workbench = planGate(['src/workbench/ScenarioPage.ts']).smokes;
  expect(workbench).toContain('inspector');
  expect(workbench).not.toContain('studio');
});
it('a Worker change runs the smokes that run the Worker', () => {
  const smokes = planGate(['worker/api/library.ts']).smokes;
  expect(smokes).toEqual(expect.arrayContaining(['studio', 'save-pipeline', 'recording-management']));
  expect(smokes).not.toContain('sync-bar');
  expect(smokes).not.toContain('inspector');
});
it('a smoke\'s own file runs that smoke; shared smoke plumbing runs them all', () => {
  expect(planGate(['harness/verify/selection-smoke.mjs']).smokes).toEqual(['selection']);
  expect(planGate(['harness/verify/unrolled-review.mjs']).smokes).toEqual(['unrolled']);
  expect(planGate(['harness/verify/browserHarness.mjs']).smokes).toEqual(ALL_SMOKES);
});
it('the model or a converter runs the converter suites it can reach', () => {
  expect(planGate(['src/model/mnx.ts']).converters).toEqual(['guitarpro-mnx', 'musicxml-mnx']);
  expect(planGate(['converters/musicxml-mnx/src/import/musicxml.ts']).converters).toEqual(['musicxml-mnx']);
  expect(planGate(['src/engine/layout/spacing.ts']).converters).toEqual([]);
});
it('a path the rule does not know runs everything', () => {
  const plan = planGate(['docs/x.md', 'some-new-root-file.txt']);
  expect(plan.tests).toEqual({ mode: 'full' });
  expect(plan.build).toBe(true);
  expect(plan.smokes).toEqual(ALL_SMOKES);
  expect(plan.reasons.join(' ')).toContain('some-new-root-file.txt');
});

it('the listening workspace gates its code, disk-read evidence, and shared timing inputs', () => {
  for (const file of [
    'experiments/performance-listening/bench/src/evaluate/index.ts',
    'experiments/performance-listening/bench/oracle/o1/expected.json',
    'experiments/performance-listening/contracts/golden.schema.json',
    'experiments/performance-listening/sets/harness-v1/p1/golden.json',
    'src/audio/performance.ts', 'src/model/mnx.ts', 'package-lock.json',
  ]) expect(planGate([file]).listeningBench, file).toBe(true);
  expect(planGate(['src/workbench/main.ts']).listeningBench).toBe(false);
  expect(planGate([], { full: true }).listeningBench).toBe(true);
});
