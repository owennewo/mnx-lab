// The licence and notices (core-campaign-synth Phase 3): NOTICE.md and the /notices/ page are
// generated from one inventory (tools/notices.mjs) and must be current; every production
// package the lockfile installs is in that inventory; every licence text it names exists.
import fs from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error Plain Node tool module.
import { COMPONENTS, OUTPUTS } from '../../tools/notices.mjs';

type Component = { name: string; packages?: string[]; texts: string[] };
const components = COMPONENTS as Component[];

it('NOTICE.md and notices/index.html are generated from the current inventory', () => {
  for (const [file, render] of Object.entries(OUTPUTS as Record<string, () => string>))
    expect(fs.readFileSync(file, 'utf8'), `${file} is stale: run node tools/notices.mjs`).toBe(render());
});
it('every production package the lockfile installs has a notice', () => {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, { dev?: boolean; link?: boolean }> };
  const shipped = Object.entries(lock.packages)
    .filter(([key, entry]) => key.includes('node_modules/') && !entry.dev && !entry.link)
    .map(([key]) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length));
  const noticed = new Set(components.flatMap(c => c.packages ?? []));
  expect(shipped.length).toBeGreaterThan(5);
  expect([...new Set(shipped)].filter(name => !noticed.has(name)), 'add them to tools/notices.mjs').toEqual([]);
});
it('every licence text the inventory names is present, and the site licence is the AGPL', () => {
  const texts = new Set(fs.readdirSync('public/licenses'));
  expect(components.flatMap(c => c.texts).filter(t => !texts.has(t))).toEqual([]);
  expect(texts.has('AGPL-3.0.txt')).toBe(true);
  expect(fs.readFileSync('LICENSE.md', 'utf8')).toMatch(/^# GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3, 19 November 2007/);
});
