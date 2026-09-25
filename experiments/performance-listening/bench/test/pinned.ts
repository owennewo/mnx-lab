import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EXPERIMENT } from '../src/io.ts';

/** A recorded run pins the bytes its source files had at the commit it ran on. Its
 * evidence is checked against that commit, so later work on the same files, such as the
 * Studio seam, cannot invalidate an earlier run. */
export function pinnedSha256(commit: string, path: string): string {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`A pinned run needs a full commit id, not ${commit}`);
  const bytes = execFileSync('git', ['show', `${commit}:experiments/performance-listening/${path}`], { cwd: EXPERIMENT, maxBuffer: 1 << 27 });
  return createHash('sha256').update(bytes).digest('hex');
}
