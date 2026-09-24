import { expect, it } from 'vitest';
// @ts-expect-error Plain Node harness module.
import { planSmokes } from '../verify/run-smokes.mjs';

type Command = { command: string; args: string[]; env?: Record<string, string> };
type Job = { label: string; commands: Command[] };
const files = (job: Job) => job.commands.map(c => c.args[0].replace(/.*\//, ''));

it('builds each selected face once, bundle only, and removes duplicate requests', () => {
  const { builds, jobs } = planSmokes(['selection', 'inspector', 'embed', 'lib', 'selection']);
  expect(builds.map((c: Command) => c.args)).toEqual([['run', 'build:site'], ['run', 'build:embed'], ['run', 'build:lib']]);
  expect(jobs.filter((j: Job) => files(j).includes('selection-smoke.mjs'))).toHaveLength(1);
});
it('runs the two embed formats as independent jobs', () => {
  const embeds = planSmokes(['embed']).jobs as Job[];
  expect(embeds.map(j => j.label)).toEqual(['embed', 'embed (iife)']);
  expect(embeds.map(j => j.commands[0].env)).toEqual([undefined, { MNX_EMBED_FORMAT: 'iife' }]);
});
it('keeps a review page and the smoke that reads it in one ordered job', () => {
  const jobs = planSmokes(['player', 'unrolled']).jobs as Job[];
  expect(jobs.map(files)).toEqual([
    ['performance-review.mjs', 'player-workbench-smoke.mjs'],
    ['unrolled-review.mjs', 'unrolled-smoke.mjs'],
  ]);
});
it('reuses supplied builds while retaining every selected check', () => {
  const normal = planSmokes(['player', 'unrolled']);
  const built = planSmokes(['player', 'unrolled'], { built: true });
  expect(built.builds).toEqual([]);
  expect(built.jobs).toEqual(normal.jobs);
  expect(built.artifacts).toEqual(['dist/client/workbench/index.html']);
  expect(planSmokes(['audio']).artifacts).toEqual([]);
});
it('rejects absent or unknown selections before starting builds or smokes', () => {
  expect(() => planSmokes([])).toThrow('Select');
  expect(() => planSmokes(['selection', 'typo'])).toThrow('Unknown smoke');
});
