// Land this worktree's branch (CLAUDE.md → Landing the work), in order, stopping at the
// first failure: a clean tree, rebase on origin/main, the goldens re-earned where the rebase
// reached them, the gate, a fast-forward of main, the push. A hand-typed chain of these once
// lost the gate's exit code in a pipe and landed a red build; here a failed step ends the run
// with nothing merged. A merge refused because main moved during the gate starts over.
//
//   npm run land               run it, from the worktree
//   npm run land -- --plan     say what would run, and stop
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** What the goldens are made from, and what they are (CLAUDE.md, step 3). */
const REACHES_GOLDENS = /^(src\/model|src\/engine|scenarios)\//;
const ATTEMPTS = 3;

export class LandingStopped extends Error {}
const stop = message => { throw new LandingStopped(message); };

/** `root` and the commands are injectable so the tests can land in throwaway repositories. */
export function land({ root, gate = ['npm', ['run', 'gate']], goldens = ['npm', ['run', 'update:primitives']], log = console.log, plan = false } = {}) {
  const git = (args, cwd = root) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  const out = (args, cwd) => {
    const r = git(args, cwd);
    if (r.status !== 0) stop(`git ${args.join(' ')} failed:\n${r.stderr.trim()}`);
    return r.stdout.trim();
  };
  const run = ([command, args]) => spawnSync(command, args, { cwd: root, stdio: log === console.log ? 'inherit' : 'ignore' }).status;

  const task = out(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const primary = out(['worktree', 'list', '--porcelain']).match(/^worktree (.*)$/m)[1];
  // Step 1: everything committed, and the tools the gate needs in place.
  if (path.resolve(root) === path.resolve(primary) || task === 'main') stop('Land from a worktree on its own branch, not from main.');
  if (out(['status', '--porcelain'])) stop(`Commit everything first; the tree is not clean:\n${out(['status', '--short'])}`);
  if (!fs.existsSync(path.join(root, 'node_modules'))) stop('No node_modules in this worktree: run npm ci first.');
  if (out(['symbolic-ref', '--quiet', '--short', 'HEAD'], primary) !== 'main') stop(`The primary checkout is not on main: ${primary}`);
  if (plan) { log(`would land ${task}: fetch, rebase on origin/main, goldens if reached, the gate, fast-forward main in ${primary}, push`); return { landed: false, task }; }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    // Step 2: rebase, never merge. A conflict stays in the tree for whoever is landing to resolve.
    out(['fetch', 'origin']);
    const before = out(['merge-base', 'origin/main', 'HEAD']);
    const rebased = git(['rebase', 'origin/main']);
    if (rebased.status !== 0) stop(`The rebase on origin/main stopped: resolve it (git status), then run this again.\n${(rebased.stdout + rebased.stderr).trim()}`);
    // Step 3: where the rebase brought in new work, the goldens must still come back byte-identical.
    const now = out(['rev-parse', 'origin/main']);
    if (now !== before) {
      const touched = out(['diff', '--name-only', before, 'HEAD']).split('\n').filter(f => REACHES_GOLDENS.test(f));
      if (touched.length) {
        log(`▶ the rebase reached the goldens (${touched.length} files): regenerating`);
        if (run(goldens) !== 0) stop('Regenerating the goldens failed.');
        const moved = out(['status', '--porcelain', '--', 'scenarios/']);
        if (moved) stop(`The goldens moved. Never hand-merge one: see CLAUDE.md, steps 3 and 4.\n${moved}`);
      }
    }
    // Step 5: the gate, by its exit status, on the final tree.
    log(`▶ the gate on ${out(['rev-parse', '--short', 'HEAD'])}`);
    if (run(gate) !== 0) stop('The gate failed: nothing was merged. Fix it in this worktree and run this again.');
    // Step 6: fast-forward only. A refusal means main moved during the gate, so all of it again.
    const merged = git(['merge', '--ff-only', task], primary);
    if (merged.status !== 0) {
      log(`main moved during the gate (attempt ${attempt} of ${ATTEMPTS}); starting over.`);
      continue;
    }
    // Step 7.
    const pushed = git(['push', 'origin', 'main'], primary);
    if (pushed.status !== 0) stop(`Merged to main but NOT pushed; push it from ${primary}.\n${pushed.stderr.trim()}`);
    log(`\n✓ landed ${task} as ${out(['rev-parse', '--short', 'HEAD'])}. Next: reflect (CLAUDE.md), and from outside this tree: npm run worktree:retire -- ${task}`);
    return { landed: true, task };
  }
  return stop(`main kept moving: ${ATTEMPTS} attempts, nothing merged. Run this again.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { land({ root: process.cwd(), plan: process.argv.includes('--plan') }); }
  catch (error) {
    if (!(error instanceof LandingStopped)) throw error;
    console.error(`\n✗ ${error.message}`);
    process.exitCode = 1;
  }
}
