import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, expect, it } from 'vitest';
// @ts-expect-error Plain Node tool module.
import { land } from '../../tools/land.mjs';

// tools/land.mjs in throwaway repositories: a bare origin, a primary checkout on main, and a
// worktree with a commit to land. The gate is a command that passes or fails on request.
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
const IDENTITY = ['-c', 'user.name=t', '-c', 'user.email=t@example.test'];
const commit = (cwd: string, file: string, text: string, message = file) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), text);
  git(cwd, 'add', '-A'); git(cwd, ...IDENTITY, 'commit', '-qm', message);
};
const PASS: [string, string[]] = ['true', []], FAIL: [string, string[]] = ['false', []];
let primary: string, worktree: string, origin: string;
const heads = () => ({ main: git(primary, 'rev-parse', 'main'), origin: git(origin, 'rev-parse', 'main'), branch: git(worktree, 'rev-parse', 'HEAD') });
const quiet = () => {};

beforeEach(() => {
  const top = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'land-'));
  origin = path.join(top, 'origin.git'); primary = path.join(top, 'primary'); worktree = path.join(top, 'task');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['init', '-q', '-b', 'main', primary]);
  git(primary, 'remote', 'add', 'origin', origin);
  commit(primary, '.gitignore', 'node_modules\n');
  git(primary, 'push', '-q', 'origin', 'main');
  git(primary, 'worktree', 'add', '-q', worktree, '-b', 'task', 'main');
  fs.mkdirSync(path.join(worktree, 'node_modules'));
  commit(worktree, 'work.txt', 'work');
});
const go = (options: object = {}) => land({ root: worktree, gate: PASS, log: quiet, ...options });
/** Someone else lands while the gate runs: main moves in the primary, and origin with it. */
const someoneLands = (file: string) => { commit(primary, file, 'theirs'); git(primary, 'push', '-q', 'origin', 'main'); };

it('lands a green branch: main and origin fast-forward to it', () => {
  expect(go()).toMatchObject({ landed: true, task: 'task' });
  const h = heads();
  expect(h.main).toBe(h.branch);
  expect(h.origin).toBe(h.branch);
});
it('a red gate merges nothing', () => {
  const before = heads();
  expect(() => go({ gate: FAIL })).toThrow('nothing was merged');
  expect(heads().main).toBe(before.main);
  expect(heads().origin).toBe(before.origin);
});
it('refuses an uncommitted tree, main itself, and a worktree with no dependencies, before running anything', () => {
  fs.writeFileSync(path.join(worktree, 'loose.txt'), 'x');
  expect(() => go({ gate: FAIL })).toThrow('not clean');
  fs.rmSync(path.join(worktree, 'loose.txt'));
  expect(() => land({ root: primary, gate: PASS, log: quiet })).toThrow('from a worktree');
  fs.rmSync(path.join(worktree, 'node_modules'), { recursive: true });
  expect(() => go()).toThrow('npm ci');
});
it('rebases on what landed first', () => {
  someoneLands('theirs.txt');
  expect(go()).toMatchObject({ landed: true });
  expect(fs.existsSync(path.join(worktree, 'theirs.txt'))).toBe(true);
  expect(git(primary, 'log', '--format=%s', '-2')).toBe('work.txt\ntheirs.txt');
});
it('starts over when main moves during the gate', () => {
  const marker = path.join(path.dirname(worktree), 'moved');
  // The first gate lands someone else's commit, as another agent would; the second finds nothing to do.
  const script = `[ -e ${marker} ] || { touch ${marker}; git -C ${primary} -c user.name=t -c user.email=t@example.test commit -q --allow-empty -m theirs; git -C ${primary} push -q origin main; }`;
  expect(go({ gate: ['sh', ['-c', script]] })).toMatchObject({ landed: true });
  expect(git(primary, 'log', '--format=%s', '-2')).toBe('work.txt\ntheirs');
  expect(heads().origin).toBe(heads().branch);
});
it('stops at a rebase conflict and leaves main alone', () => {
  someoneLands('work.txt');
  const before = heads().main;
  expect(() => go()).toThrow('rebase');
  expect(heads().main).toBe(before);
  git(worktree, 'rebase', '--abort');
});
it('regenerates the goldens only when the rebase reached them, and stops if they move', () => {
  const regenerate = (text: string): [string, string[]] => ['sh', ['-c', `mkdir -p scenarios && printf ${text} > scenarios/expected.txt`]];
  commit(worktree, 'scenarios/expected.txt', 'same');
  someoneLands('docs.txt');
  // Nothing of theirs or ours moves the golden: the regenerate reproduces it, and the run lands.
  expect(go({ goldens: regenerate('same') })).toMatchObject({ landed: true });

  commit(worktree, 'src/engine/layout.ts', 'ours');
  someoneLands('src/engine/theirs.ts');
  const before = heads().main;
  expect(() => go({ goldens: regenerate('moved') })).toThrow('goldens moved');
  expect(heads().main).toBe(before);
});
