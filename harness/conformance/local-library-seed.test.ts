import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Plain Node tool module.
import { seedLocalLibrary } from '../../tools/library-local-auth.mjs';

const root = new URL('../../', import.meta.url);
const migrations = fs.readdirSync(new URL('migrations/', root)).filter(n => n.endsWith('.sql')).sort();
let dir = '';
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

// `npm run dev` runs this on every start, so the second start must be a no-op —
// and it records migrations where `wrangler d1 migrations apply --local` looks.
it('brings a local D1 to the latest migration once, then finds nothing to do', async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-seed-'));
  expect((await seedLocalLibrary(root, { persistPath: dir })).applied).toEqual(migrations);
  expect((await seedLocalLibrary(root, { persistPath: dir })).applied).toEqual([]);
}, 20_000);
