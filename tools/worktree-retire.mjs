// Retire a worktree (CLAUDE.md → Retiring the worktree): stop everything still
// running from it, then `git worktree remove`, `branch -d`, `worktree prune`.
// A dev server or a smoke's workerd outlives the worktree it ran from, holding
// its port; stopping them first means none can. git's own refusals stand — a
// dirty tree or an unmerged branch stops the script, never a --force.
//
//   npm run worktree:retire -- <task>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });
const fail = message => { console.error(message); process.exit(1); };

/** Pids whose working directory, executable or command line lies inside `dir`. */
export function processesIn(dir) {
  const inside = p => p === dir || p.startsWith(dir + path.sep);
  // Never the shell that ran us, whose command line may well name the path.
  const ours = new Set();
  for (let pid = process.pid; pid > 1 && !ours.has(pid);) {
    ours.add(pid);
    try { pid = Number(fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[1]); } catch { break; }
  }
  const found = [];
  for (const name of fs.readdirSync('/proc')) {
    const pid = Number(name);
    if (!pid || ours.has(pid)) continue;
    const read = f => { try { return f(); } catch { return ''; } };
    const cwd = read(() => fs.readlinkSync(`/proc/${pid}/cwd`)).replace(/ \(deleted\)$/, '');
    const exe = read(() => fs.readlinkSync(`/proc/${pid}/exe`)).replace(/ \(deleted\)$/, '');
    const cmd = read(() => fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')).split('\0').filter(Boolean);
    if (inside(cwd) || inside(exe) || cmd.some(inside)) found.push({ pid, cmd: cmd.join(' ') });
  }
  return found;
}

const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const pause = ms => new Promise(r => setTimeout(r, ms));

/** SIGTERM, then SIGKILL what ignores it (workerd does); the survivors. */
async function stop(procs) {
  for (const { pid } of procs) try { process.kill(pid, 'SIGTERM'); } catch {}
  for (let i = 0; i < 30 && procs.some(p => alive(p.pid)); i++) await pause(100);
  for (const { pid } of procs) if (alive(pid)) try { process.kill(pid, 'SIGKILL'); } catch {}
  for (let i = 0; i < 20 && procs.some(p => alive(p.pid)); i++) await pause(100);
  return procs.filter(p => alive(p.pid));
}

async function main() {
  const task = process.argv[2];
  if (!task || task.startsWith('-')) fail('Usage: npm run worktree:retire -- <task>');
  const entries = git('worktree', 'list', '--porcelain').stdout.split('\n\n');
  const entry = entries.find(e => e.split('\n').includes(`branch refs/heads/${task}`));
  if (!entry) fail(`No worktree has the branch ${task}.`);
  const dir = entry.match(/^worktree (.*)$/m)[1];
  if (path.resolve(dir) === path.resolve(ROOT)) fail(`${task} is the primary checkout; run this from main's checkout for another worktree.`);
  if (process.cwd() === dir || process.cwd().startsWith(dir + path.sep)) fail(`Run this from outside ${dir}.`);

  if (process.platform === 'linux') {
    const procs = processesIn(dir);
    for (const { pid, cmd } of procs) console.log(`stopping ${pid}: ${cmd.slice(0, 120)}`);
    const survivors = await stop(procs);
    if (survivors.length) fail(`Still running from ${dir}; nothing removed:\n${survivors.map(p => `  ${p.pid} ${p.cmd.slice(0, 120)}`).join('\n')}`);
  } else {
    console.warn('Not Linux: no process sweep; stop anything running from the worktree yourself.');
  }

  for (const args of [['worktree', 'remove', dir], ['branch', '-d', task], ['worktree', 'prune']]) {
    const result = git(...args);
    process.stdout.write(result.stdout);
    if (result.status !== 0) fail(`git ${args.join(' ')} refused:\n${result.stderr}`);
  }
  console.log(`Retired ${task}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
