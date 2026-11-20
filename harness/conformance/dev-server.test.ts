// Which processes are a checkout's dev server (tools/devServer.mjs): library-sync stops exactly
// those around a write, so a shell or an editor sitting in the checkout must never match.
import { expect, it } from 'vitest';
import { isDevServer } from '../../tools/devServer.mjs';

const root = '/home/u/mnx-lab';
const proc = (cwd: string, exe: string, ...argv: string[]) => ({ cwd, exe, cmd: argv.join('\0') + '\0' });

it('matches the dev server of this checkout and nothing else', () => {
  expect(isDevServer(proc(root, '/usr/bin/node', 'node', `${root}/node_modules/.bin/vite`), root)).toBe(true);
  expect(isDevServer(proc(root, `${root}/node_modules/@cloudflare/workerd-linux-64/bin/workerd`, `${root}/node_modules/@cloudflare/workerd-linux-64/bin/workerd`, 'serve'), root)).toBe(true);
  expect(isDevServer(proc(root, '/usr/bin/node', 'npm', 'run', 'dev'), root)).toBe(true);
  // A shell, an editor, another npm script, another checkout's server: no.
  expect(isDevServer(proc(root, '/usr/bin/bash', 'bash'), root)).toBe(false);
  expect(isDevServer(proc(root, '/usr/bin/nvim', 'nvim', `${root}/tools/devServer.mjs`), root)).toBe(false);
  expect(isDevServer(proc(root, '/usr/bin/node', 'npm', 'run', 'gate'), root)).toBe(false);
  expect(isDevServer(proc('/home/u/wt/x', '/usr/bin/node', 'node', '/home/u/wt/x/node_modules/.bin/vite'), root)).toBe(false);
});
