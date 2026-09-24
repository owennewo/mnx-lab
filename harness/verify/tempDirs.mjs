// Scoped temp directories for smoke jobs and test runs. Everything a run
// makes under os.tmpdir() — Chrome profiles and Chrome's own scoped_dir
// files, Miniflare's storage, mkdtemp fixtures — lands in one directory that
// goes when the run does. Individual cleanup never kept up: most smokes did
// not delete their Chrome profile at all, the rest raced a Chrome still
// shutting down, and Miniflare left its storage behind. On 2026-09-24 /tmp
// (a tmpfs with a per-user quota) held 6.3 GB of it, and SQLite writes in
// the library tests failed with EDQUOT.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCOPED = /^mnx-(smokes|tests)-(\d+)$/;

/** `<tmp>/mnx-<kind>-<pid>`, made if missing; the pid is how a sweep knows
 *  whether its owner is still alive. Resolved against the REAL temp root, so a
 *  run started inside another scoped directory still gets its own. */
export function scopedTempRoot(kind, root = os.tmpdir()) {
  const dir = path.join(root, `mnx-${kind}-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** SIGKILL every process whose command line names `dir` — a Chrome whose
 *  --user-data-dir is inside it, still flushing after its smoke exited.
 *  Linux only (it reads /proc); elsewhere nothing is killed. */
function killUsers(dir) {
  if (process.platform !== 'linux') return;
  for (const entry of fs.readdirSync('/proc')) {
    const pid = Number(entry);
    if (!pid || pid === process.pid) continue;
    try {
      if (fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(dir)) process.kill(pid, 'SIGKILL');
    } catch { /* gone, or not ours */ }
  }
}

/** Remove a tree whose users may still be exiting; true when it is gone.
 *  Never throws: a leftover is reported by the caller, not a failure. */
export function removeTree(dir) {
  killUsers(dir);
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch { /* reported below */ }
  return !fs.existsSync(dir);
}

/** Remove scoped roots whose owning process is gone (a killed runner). */
export function sweepScopedRoots(root = os.tmpdir()) {
  for (const name of fs.readdirSync(root)) {
    const pid = Number(name.match(SCOPED)?.[2]);
    if (pid && pid !== process.pid && !alive(pid)) removeTree(path.join(root, name));
  }
}
