// vitest globalSetup: the whole run works in one temp directory of its own,
// removed at teardown — Miniflare's storage and every mkdtemp fixture with it,
// which per-test cleanup did not reliably remove (harness/verify/tempDirs.mjs).
// @ts-expect-error — plain .mjs module without type declarations
import { removeTree, scopedTempRoot, sweepScopedRoots } from '../verify/tempDirs.mjs';

export default function setup(): () => void {
  sweepScopedRoots();
  const root: string = scopedTempRoot('tests');
  // Set before the pool starts, so every worker (and workerd under it) inherits it.
  process.env.TMPDIR = root;
  return () => {
    removeTree(root);
  };
}
