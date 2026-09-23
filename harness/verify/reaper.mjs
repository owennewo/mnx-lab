// A smoke that dies without reaching its `finally` — SIGKILL, a tool timeout —
// leaves what it started running, reparented to init: Chrome, and workerd,
// which holds its port and ignores SIGTERM. The reaper is a detached watcher
// that learns the smoke's descendants while the smoke lives and SIGKILLs them
// once it is gone. Linux only (it reads /proc); elsewhere it does nothing.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
let started = false;

/** Watch this process; idempotent. */
export function startReaper() {
  if (started || process.platform !== 'linux') return;
  started = true;
  spawn(process.execPath, [SELF, String(process.pid)], { detached: true, stdio: 'ignore' }).unref();
}

/** [ppid, starttime] from /proc/<pid>/stat, or null once the pid is gone. */
function stat(pid) {
  try {
    const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
    return [Number(fields[1]), fields[19]];
  } catch {
    return null;
  }
}

function descendants(root) {
  const children = new Map();
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    const s = stat(Number(name));
    if (s) children.set(s[0], [...(children.get(s[0]) ?? []), [Number(name), s[1]]]);
  }
  const found = new Map();
  const walk = pid => { for (const [child, start] of children.get(pid) ?? []) if (child !== process.pid) { found.set(child, start); walk(child); } };
  walk(root);
  return found;
}

function watch(parent) {
  const born = stat(parent)?.[1];
  let known = new Map();
  const tick = () => {
    if (born && stat(parent)?.[1] === born) {
      known = descendants(parent);
      return;
    }
    // Only a process that is still the one we saw: a recycled pid is someone else's.
    for (const [pid, start] of known) if (stat(pid)?.[1] === start) try { process.kill(pid, 'SIGKILL'); } catch {}
    process.exit(0);
  };
  tick();
  setInterval(tick, 250);
}

if (process.argv[1] === SELF) watch(Number(process.argv[2]));
