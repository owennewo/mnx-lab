import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
// @ts-expect-error Plain Node harness module.
import { planSmokes, smokeCoverage } from '../verify/run-smokes.mjs';
// @ts-expect-error Plain Node tool module.
import { planGate, SMOKE_AREAS } from '../../tools/gate.mjs';

const VERIFY = fileURLToPath(new URL('../verify/', import.meta.url));
type Coverage = { name: string; covers: string[]; files: string[] };
const coverage = smokeCoverage() as Coverage[];

it('registers every smoke on disk, and nothing that is not there — an unregistered smoke never runs', () => {
  const onDisk = fs.readdirSync(VERIFY).filter(name => name.endsWith('-smoke.mjs')).map(name => `harness/verify/${name}`).sort();
  const registered = [...new Set(coverage.flatMap(smoke => smoke.files).filter(file => file.endsWith('-smoke.mjs')))].sort();
  expect(registered).toEqual(onDisk);
});
it('declares for every smoke areas the gate reaches, and each area really is reached by a change there', () => {
  for (const smoke of coverage) {
    expect(smoke.covers.length, smoke.name).toBeGreaterThan(0);
    for (const area of smoke.covers) expect(SMOKE_AREAS, `${smoke.name} covers ${area}`).toContain(area);
  }
  // A representative change in each area, and a smoke covering it that the gate then runs.
  const probes: Record<string, string> = {
    workbench: 'src/workbench/ScenarioPage.ts', studio: 'apps/studio/src/PiecePage.ts', library: 'worker/api/library.ts',
    embed: 'src/entries/embed.ts', lib: 'src/entries/lib.ts', audio: 'src/audio/transport.ts',
  };
  expect(Object.keys(probes).sort()).toEqual([...SMOKE_AREAS].sort());
  for (const [area, file] of Object.entries(probes)) {
    const runs: string[] = planGate([file]).smokes;
    for (const smoke of coverage.filter(s => s.covers.includes(area))) expect(runs, `${file} → ${smoke.name}`).toContain(smoke.name);
  }
});
it('refuses the two smoke traps that cost a leak and a hang', () => {
  // A profile under a literal /tmp escapes the runner's scoped TMPDIR (6.3 GB of
  // litter by 2026-09-24); waiting for Chrome's 'exit' by hand hangs forever on a
  // Chrome that already exited — stopChrome() in browserHarness.mjs does it safely.
  const traps: [RegExp, string][] = [
    [/mkdtemp(Sync)?\(\s*['"`]\/tmp/, 'make temp directories under os.tmpdir(), not a literal /tmp'],
    [/once\(\s*chrome\s*,\s*['"]exit['"]|chrome\.once\(\s*['"]exit['"]/, "stop Chrome with stopChrome(), not by waiting for 'exit'"],
  ];
  const found = fs.readdirSync(VERIFY).filter(name => name.endsWith('.mjs') && name !== 'browserHarness.mjs').flatMap(name =>
    fs.readFileSync(path.join(VERIFY, name), 'utf8').split('\n').flatMap((line, index) =>
      traps.filter(([pattern]) => pattern.test(line)).map(([, fix]) => `harness/verify/${name}:${index + 1}: ${fix}`)));
  expect(found).toEqual([]);
});

type Command = { command: string; args: string[]; env?: Record<string, string> };
type Job = { label: string; commands: Command[] };
const files = (job: Job) => job.commands.map(c => c.args[0].replace(/.*\//, ''));

it('builds each selected face once, bundle only, and removes duplicate requests', () => {
  const { builds, jobs } = planSmokes(['selection', 'inspector', 'embed', 'lib', 'selection']);
  expect(builds.map((c: Command) => c.args)).toEqual([['run', 'build:site'], ['run', 'build:embed'], ['run', 'build:lib']]);
  expect(jobs.filter((j: Job) => files(j).includes('selection-smoke.mjs'))).toHaveLength(1);
});
it('starts the longest smokes first, whatever order they were asked for', () => {
  const labels = (planSmokes(['audio', 'selection', 'inspector']).jobs as Job[]).map(j => j.label);
  expect(labels).toEqual(['inspector', 'selection', 'audio']);
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
