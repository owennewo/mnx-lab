import { expect, it } from 'vitest';
// @ts-expect-error Plain Node harness module.
import { planSmokes } from '../verify/run-smokes.mjs';

it('builds each selected face once, preserves embed formats and removes duplicate requests', () => {
  const { commands } = planSmokes(['selection', 'inspector', 'embed', 'lib', 'selection']);
  expect(commands.filter((c: { command: string }) => c.command === 'npm').map((c: { args: string[] }) => c.args))
    .toEqual([['run', 'build'], ['run', 'build:embed'], ['run', 'build:lib']]);
  expect(commands.filter((c: { args: string[] }) => c.args[0].endsWith('selection-smoke.mjs'))).toHaveLength(1);
  const embeds = commands.filter((c: { args: string[] }) => c.args[0].endsWith('embed-smoke.mjs'));
  expect(embeds).toHaveLength(2);
  expect(embeds[1].env).toEqual({ MNX_EMBED_FORMAT: 'iife' });
});
it('reuses supplied builds while retaining every selected check, including player review', () => {
  const normal = planSmokes(['player', 'unrolled']);
  const built = planSmokes(['player', 'unrolled'], { built: true });
  expect(built.commands).toEqual(normal.commands.filter((c: { command: string }) => c.command !== 'npm'));
  expect(built.commands).toHaveLength(4);
  expect(built.artifacts).toEqual(['dist/client/workbench/index.html']);
  expect(planSmokes(['audio']).artifacts).toEqual([]);
});
it('rejects absent or unknown selections before starting builds or smokes', () => {
  expect(() => planSmokes([])).toThrow('Select');
  expect(() => planSmokes(['selection', 'typo'])).toThrow('Unknown smoke');
});
