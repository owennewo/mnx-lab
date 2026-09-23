// The dev server's port for THIS checkout. The primary checkout keeps 5173; a
// worktree gets a port derived from its folder name, stable across restarts,
// so two agents' dev servers never meet — and Vite is told to fail on a busy
// port rather than drift to the next one, which is how a browser ends up
// reviewing somebody else's checkout without knowing it.
//
//   npm run -s dev:port      → prints it
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** A worktree's `.git` is a file pointing at the primary checkout's. */
export function isWorktree(root = ROOT) {
  try { return fs.statSync(path.join(root, '.git')).isFile(); } catch { return false; }
}

export function devPort(root = ROOT) {
  if (!isWorktree(root)) return 5173;
  let hash = 0;
  for (const ch of path.basename(path.resolve(root))) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 5200 + (hash % 700);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(devPort());
