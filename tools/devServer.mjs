// A checkout's `npm run dev`, found, stopped and started again — for the operator tools
// that must not write a library while its dev server holds it open (library-sync.mjs).
// Matched narrowly, never by working directory alone: a shell or an editor sitting in the
// checkout is not the dev server.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { stop } from './worktree-retire.mjs';

/** Is this process part of `checkout`'s dev server: its vite, its workerd, or the npm above them? */
export function isDevServer({ cwd, exe, cmd }, checkout) {
  const modules = path.join(checkout, 'node_modules') + path.sep;
  const args = cmd.split('\0').filter(Boolean);
  if ([exe, ...args].some(a => a.startsWith(modules) && /[\\/](vite|workerd)$/.test(a))) return true;
  return cwd === checkout && /(^|[\\/])npm(-cli\.js)?$/.test(args.find(a => /npm/.test(a)) ?? '') && args.includes('run') && args.includes('dev');
}

/** The pids of `checkout`'s dev server, from /proc (Linux); empty elsewhere. */
export function devServerProcesses(checkout) {
  if (process.platform !== 'linux') return [];
  const found = [];
  for (const name of fs.readdirSync('/proc')) {
    const pid = Number(name);
    if (!pid || pid === process.pid) continue;
    const read = f => { try { return f(); } catch { return ''; } };
    const proc = {
      cwd: read(() => fs.readlinkSync(`/proc/${pid}/cwd`)).replace(/ \(deleted\)$/, ''),
      exe: read(() => fs.readlinkSync(`/proc/${pid}/exe`)).replace(/ \(deleted\)$/, ''),
      cmd: read(() => fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')),
    };
    if (isDevServer(proc, checkout)) found.push({ pid, cmd: proc.cmd.split('\0').join(' ').trim() });
  }
  return found;
}

/** Stop them (workerd ignores SIGTERM, so SIGKILL follows); throws if any survive. */
export async function stopDevServer(procs) {
  const survivors = await stop(procs);
  if (survivors.length) throw new Error(`The dev server would not stop: ${survivors.map(p => p.pid).join(' ')}`);
}

/** `npm run dev` in `checkout`, detached so it outlives the tool; resolves once it answers. */
export async function startDevServer(checkout, { timeoutMs = 120000 } = {}) {
  const log = path.join(homedir(), '.cache/mnx-lab/dev-server.log');
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const out = fs.openSync(log, 'a');
  spawn('npm', ['run', 'dev'], { cwd: checkout, detached: true, stdio: ['ignore', out, out] }).unref();
  const port = execFileSync('node', [path.join(checkout, 'tools/dev-port.mjs')], { cwd: checkout, encoding: 'utf8' }).trim();
  for (const until = Date.now() + timeoutMs; Date.now() < until; await new Promise(r => setTimeout(r, 1000))) {
    try { if ((await fetch(`http://localhost:${port}/studio/`)).ok) return { port, log }; } catch { /* not up yet */ }
  }
  throw new Error(`The dev server did not come back on port ${port}; see ${log}`);
}
