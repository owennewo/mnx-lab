// vitest setupFiles: hold every test file to the landing gate's rule for what
// it reads from disk. `npm run gate` follows imports through vitest, but a file
// a test READS — a fixture, a report, a source file it scans — is invisible to
// that graph, so the gate reaches it only through its own lists (tools/gate.mjs:
// DATA, the prose checks, SOURCE_READERS). This records the repository files
// each test file reads and fails the file when a change to one of them alone
// would not make the gate run it — which is how a new test would otherwise be
// silently skipped on some later branch. It also fails a declared source reader
// that reads no source, so the list cannot rot the other way. Reads made by a
// child process (dependency-cruiser, uv) are not seen: a test that spawns one is
// trusted, and must be declared by hand if what it spawns reads source.
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { afterAll, expect } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const IGNORED = /^(node_modules|dist|\.git)(\/|$)|\/node_modules\//;

interface Audit { reads: Set<string>; spawned: boolean }
const KEY = Symbol.for('mnx-lab.readAudit');
const state = globalThis as unknown as Record<symbol, Audit | undefined>;

/** A repo-relative path for anything inside the repository, else null. A
 *  directory read keeps a trailing slash: what it lists is `<dir>/…`. */
function relative(target: unknown, directory: boolean): string | null {
  if (typeof target !== 'string' && !(target instanceof URL)) return null;
  const absolute = path.resolve(target instanceof URL ? fileURLToPath(target) : target);
  if (!absolute.startsWith(ROOT)) return null;
  const rel = path.relative(ROOT, absolute).split(path.sep).join('/');
  if (!rel || IGNORED.test(rel)) return null;
  return directory ? `${rel}/` : rel;
}

// Patched once per worker process; each test file gets a fresh record.
if (!state[KEY]) {
  const note = (target: unknown, directory: boolean) => {
    const rel = relative(target, directory);
    if (rel) state[KEY]?.reads.add(rel);
  };
  const wrap = <T extends object>(owner: T, name: keyof T, directory: boolean) => {
    const original = owner[name] as unknown as (...args: unknown[]) => unknown;
    (owner as Record<keyof T, unknown>)[name] = function (this: unknown, target: unknown, ...rest: unknown[]) {
      note(target, directory);
      return original.call(this, target, ...rest);
    };
  };
  wrap(fs, 'readFileSync', false);
  wrap(fs, 'readdirSync', true);
  wrap(fs, 'readFile', false);
  wrap(fs, 'readdir', true);
  wrap(fs, 'createReadStream', false);
  wrap(fs.promises, 'readFile', false);
  wrap(fs.promises, 'readdir', true);
  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'] as const) {
    const original = childProcess[name] as unknown as (...args: unknown[]) => unknown;
    (childProcess as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
      const audit = state[KEY];
      if (audit) audit.spawned = true;
      return original.apply(this, args);
    };
  }
  // Named imports (`import { readFileSync } from 'node:fs'`) see the patch too.
  syncBuiltinESMExports();
}
state[KEY] = { reads: new Set(), spawned: false };
const audit = state[KEY]!;

afterAll(async () => {
  const testPath = expect.getState().testPath;
  if (!testPath || (!audit.reads.size && !audit.spawned)) return;
  // Loaded only for a file that read something: most read nothing, and 155
  // eager imports of the gate cost ~25 CPU-s of setup across the suite.
  // @ts-expect-error — plain .mjs module without type declarations
  const { gateReaches, SOURCE_READERS } = await import('../../tools/gate.mjs');
  const test = path.relative(ROOT, testPath).split(path.sep).join('/');
  const reads = [...audit.reads].sort();
  const probe = (read: string) => (read.endsWith('/') ? `${read}_` : read);
  const unreached = reads.filter((read: string) => !gateReaches(probe(read), test));
  if (unreached.length) {
    throw new Error(
      `${test} reads from disk what the landing gate would not run it for:\n` +
      unreached.map(read => `  ${read}`).join('\n') +
      '\nAdd the path to DATA, or this test to SOURCE_READERS, in tools/gate.mjs (docs/gates.md).'
    );
  }
  const declared = (SOURCE_READERS as string[]).includes(test);
  const readsSource = reads.some((read: string) => gateReaches(probe(read), test) && !gateReaches(probe(read), '<undeclared>'));
  if (declared && !readsSource && !audit.spawned) {
    throw new Error(`${test} is in SOURCE_READERS in tools/gate.mjs but reads no source from disk: remove it.`);
  }
});
