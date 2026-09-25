// A smoke that dies without reaching its `finally` — SIGKILL, a tool timeout —
// leaves what it started running, reparented to init: Chrome, and workerd,
// which holds its port and ignores SIGTERM. The reaper is a detached watcher
// that learns the smoke's descendants while the smoke lives and SIGKILLs them
// once it is gone. Linux only (it reads /proc); elsewhere it does nothing.
//
// Ancestry alone has a race: a watcher that is still starting when the smoke
// dies (a loaded machine takes seconds to schedule a new node) never saw the
// descendants, and by then they have been reparented away. So everything the
// smoke starts after startReaper() also carries a marker in its environment —
// the smoke's pid and start time, which a recycled pid cannot match — and the
// watcher kills whatever carries it, whenever it gets to look.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const MARKER = 'MNX_REAPER_OWNER';
let started = false;

/** Watch this process; idempotent. */
export function startReaper() {
  if (started || process.platform !== 'linux') return;
  started = true;
  const marker = `${process.pid}:${stat(process.pid)?.[1]}`;
  spawn(process.execPath, [SELF, marker], { detached: true, stdio: 'ignore' }).unref();
  // Set after the watcher is spawned, so it does not carry the marker itself.
  process.env[MARKER] = marker;
}

/** Processes carrying the marker in their environment, however far they were reparented. */
function marked(marker) {
  const found = new Map();
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
    try {
      if (fs.readFileSync(`/proc/${name}/environ`, 'utf8').split('\0').includes(`${MARKER}=${marker}`)) {
        const s = stat(Number(name));
        if (s) found.set(Number(name), s[1]);
      }
    } catch { /* gone, or not ours to read */ }
  }
  return found;
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

function watch(marker) {
  const [parent, born] = [Number(marker.split(':')[0]), marker.split(':')[1]];
  let known = new Map();
  const tick = () => {
    if (stat(parent)?.[1] === born) {
      known = descendants(parent);
      return;
    }
    // Only a process that is still the one we saw: a recycled pid is someone else's.
    for (const [pid, start] of [...known, ...marked(marker)]) if (stat(pid)?.[1] === start) try { process.kill(pid, 'SIGKILL'); } catch {}
    process.exit(0);
  };
  tick();
  setInterval(tick, 250);
}

if (process.argv[1] === SELF) watch(process.argv[2]);
