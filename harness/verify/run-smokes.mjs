// Explicit batch orchestration: build each selected face once, then run the
// smokes side by side — each owns its ports, profile and library, so they do
// not share state — and start nothing new after the first failure.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree, scopedTempRoot, sweepScopedRoots } from './tempDirs.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Measured on a 6-core machine (2026-09-24): 4 at once takes the full set from
// ~205 s to ~60 s with every smoke green; 8 is faster still, but inflates each
// smoke by up to 2× under contention, which is where timing flakes live.
const DEFAULT_JOBS = 4;
// A smoke that hangs holds its slot and the whole run with it. The slowest take
// ~30 s under load; well past that, the job's process group is killed.
const JOB_TIMEOUT_S = 300;
/** Process groups of the commands running now, killed if the runner is stopped. */
const running = new Set();
const verify = name => `harness/verify/${name}`;
/** A job is a chain run in order; a smoke's jobs are independent of each other.
 *  `covers` names the areas a change must touch for the smoke to be worth
 *  running (tools/gate.mjs): the shell it drives, `library` when it runs the
 *  Worker, or the build face it loads. */
const one = (file, covers, extra = {}) => ({ build: 'build:site', covers, jobs: [[{ file: verify(file) }]], ...extra });
const WORKBENCH = ['workbench'];
const STUDIO = ['studio'];
const STUDIO_LIBRARY = ['studio', 'library'];
const SMOKES = {
  'lib': one('lib-smoke.mjs', ['lib'], { build: 'build:lib' }),
  'embed': { build: 'build:embed', covers: ['embed'], jobs: [[{ file: verify('embed-smoke.mjs') }], [{ file: verify('embed-smoke.mjs'), env: { MNX_EMBED_FORMAT: 'iife' } }]] },
  'csp': one('csp-smoke.mjs', WORKBENCH),
  'selection': one('selection-smoke.mjs', WORKBENCH),
  'inspector': one('inspector-smoke.mjs', WORKBENCH),
  'focus': one('focus-mode-smoke.mjs', WORKBENCH),
  'sync-bar': one('sync-bar-smoke.mjs', STUDIO),
  'sync-rederive': one('sync-rederive-smoke.mjs', STUDIO),
  'piece-create': one('piece-create-smoke.mjs', STUDIO_LIBRARY),
  'save-pipeline': one('save-pipeline-smoke.mjs', STUDIO_LIBRARY),
  'piece-lifecycle': one('piece-lifecycle-smoke.mjs', STUDIO_LIBRARY),
  'studio-editor': one('studio-editor-smoke.mjs', STUDIO_LIBRARY),
  'play-only': one('studio-play-only-smoke.mjs', STUDIO_LIBRARY),
  'workbench-editor': one('workbench-editor-smoke.mjs', WORKBENCH),
  'audio': one('audio-smoke.mjs', ['audio'], { build: null }),
  // The review page is the smoke's input, so it is built first in the same job.
  'player': { build: 'build:site', covers: WORKBENCH, jobs: [[{ file: verify('performance-review.mjs') }, { file: verify('player-workbench-smoke.mjs') }]] },
  'unrolled': { build: 'build:site', covers: WORKBENCH, jobs: [[{ file: verify('unrolled-review.mjs') }, { file: verify('unrolled-smoke.mjs') }]] },
  'studio': one('studio-smoke.mjs', STUDIO_LIBRARY),
  'studio-export': one('studio-export-smoke.mjs', STUDIO),
  'recording-studio': one('recording-studio-smoke.mjs', STUDIO),
  'single-cursor': one('single-cursor-smoke.mjs', STUDIO),
  'recording-management': one('recording-management-smoke.mjs', STUDIO_LIBRARY),
  'youtube': one('youtube-smoke.mjs', ['embed'], { build: 'build:embed' }),
};

/** Every smoke with the areas it covers and the files that are its own. */
export const smokeCoverage = () => Object.entries(SMOKES).map(([name, smoke]) => ({
  name, build: smoke.build, covers: smoke.covers,
  files: [...new Set(smoke.jobs.flat().map(run => run.file))],
}));
// What a smoke needs built is the bundle alone: the gate build's validators,
// boundaries and type checks add ~20 s and nothing a browser can see.
const ARTIFACTS = {
  'build:site': 'dist/client/workbench/index.html',
  'build:embed': 'dist/embed/mnx-lab.js',
  'build:lib': 'dist/lib/index.js',
};

export function planSmokes(names, { built = false } = {}) {
  if (!names.length) throw new Error('Select at least one smoke; use --help for names.');
  for (const name of names) {
    if (!Object.hasOwn(SMOKES, name)) throw new Error(`Unknown smoke: ${name}. Use --help for names.`);
  }
  const unique = [...new Set(names)];
  const builds = [...new Set(unique.map(name => SMOKES[name].build).filter(Boolean))];
  return {
    artifacts: builds.map(build => ARTIFACTS[build]),
    builds: built ? [] : builds.map(build => ({ command: 'npm', args: ['run', build] })),
    jobs: unique.flatMap(name => SMOKES[name].jobs.map(chain => ({
      label: name + (chain[0].env?.MNX_EMBED_FORMAT ? ` (${chain[0].env.MNX_EMBED_FORMAT})` : ''),
      commands: chain.map(({ file, env }) => ({ command: process.execPath, args: [file], ...(env ? { env } : {}) })),
    }))),
  };
}

/** Run one command with its output held back, so parallel smokes print whole.
 *  It leads its own process group, so a timeout takes its Chrome and workerd too. */
function runBuffered({ command, args, env }, output, timeoutS = JOB_TIMEOUT_S) {
  return new Promise(resolve => {
    output.push(`> ${path.basename(command)} ${args.join(' ')}\n`);
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env }, detached: true });
    running.add(child.pid);
    const timer = setTimeout(() => {
      output.push(`\n(timed out after ${timeoutS} s — killed with everything it started)\n`);
      killGroup(child.pid);
    }, timeoutS * 1000);
    child.stdout.on('data', chunk => output.push(chunk));
    child.stderr.on('data', chunk => output.push(chunk));
    const done = status => { clearTimeout(timer); running.delete(child.pid); resolve(status); };
    child.on('error', error => { output.push(`${error.stack}\n`); done(1); });
    child.on('close', (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

function killGroup(pid) {
  try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
}

/** Each job works in a temp directory of its own (TMPDIR), removed when the
 *  job ends — with whatever it left running in it (harness/verify/tempDirs.mjs). */
async function runJobs(jobs, concurrency, scope, timeoutS) {
  const queue = [...jobs];
  const results = [];
  let stopped = false;
  let next = 0;
  const worker = async () => {
    while (queue.length && !stopped) {
      const job = queue.shift();
      const started = performance.now();
      const output = [];
      const tmp = path.join(scope, String(next++));
      fs.mkdirSync(tmp);
      let status = 0;
      for (const command of job.commands) {
        status = await runBuffered({ ...command, env: { ...command.env, TMPDIR: tmp } }, output, timeoutS);
        if (status !== 0) break;
      }
      if (!removeTree(tmp)) output.push(`(could not remove ${tmp})\n`);
      const seconds = (performance.now() - started) / 1000;
      if (status !== 0) stopped = true;
      results.push({ label: job.label, status, seconds });
      process.stdout.write(`\n━━ ${job.label} ${status === 0 ? 'passed' : 'FAILED'} in ${seconds.toFixed(1)}s\n`);
      process.stdout.write(Buffer.concat(output.map(part => (typeof part === 'string' ? Buffer.from(part) : part))));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return { results, skipped: queue.map(job => job.label) };
}

function parseTimeout(args) {
  const at = args.indexOf('--timeout');
  if (at < 0) return { timeoutS: JOB_TIMEOUT_S, rest: args };
  const timeoutS = Number(args[at + 1]);
  if (!(timeoutS > 0)) throw new Error('--timeout takes a number of seconds.');
  return { timeoutS, rest: args.filter((_, i) => i !== at && i !== at + 1) };
}

function parseJobs(args) {
  const at = args.findIndex(arg => arg === '--jobs' || arg === '-j');
  if (at < 0) return { jobs: DEFAULT_JOBS, rest: args };
  const jobs = Number(args[at + 1]);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error('--jobs takes a whole number of at least 1.');
  return { jobs, rest: args.filter((_, i) => i !== at && i !== at + 1) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: npm run smoke -- [--built] [--jobs N] [--timeout S] <name> [<name> ...]');
    console.log('Names: ' + Object.keys(SMOKES).join(', '));
    console.log('--built: reuse current artifacts; rebuild first if sources/configuration changed.');
    console.log(`--jobs N: smokes run at once (default ${DEFAULT_JOBS}); 1 runs them in turn.`);
    console.log(`--timeout S: kill a job still running after S seconds (default ${JOB_TIMEOUT_S}).`);
    return;
  }
  const { timeoutS, rest: afterTimeout } = parseTimeout(args);
  const { jobs: concurrency, rest } = parseJobs(afterTimeout);
  const built = rest.includes('--built');
  const plan = planSmokes(rest.filter(arg => arg !== '--built'), { built });
  if (built) {
    for (const artifact of plan.artifacts) {
      if (!fs.existsSync(path.join(ROOT, artifact))) throw new Error(`Missing ${artifact}; run without --built first.`);
    }
  }
  for (const { command, args: buildArgs } of plan.builds) {
    console.log(`\n> ${path.basename(command)} ${buildArgs.join(' ')}`);
    const child = spawnSync(command, buildArgs, { cwd: ROOT, stdio: 'inherit' });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      process.exitCode = child.status ?? 1;
      return;
    }
  }
  sweepScopedRoots();
  const scope = scopedTempRoot('smokes');
  // Each command leads its own process group, so Ctrl+C reaches only the runner:
  // pass it on, and leave nothing behind.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      for (const pid of running) killGroup(pid);
      removeTree(scope);
      process.exit(130);
    });
  }
  const started = performance.now();
  const { results, skipped } = await runJobs(plan.jobs, concurrency, scope, timeoutS).finally(() => removeTree(scope));
  const failed = results.filter(result => result.status !== 0);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed` +
    `${skipped.length ? `, ${skipped.length} not started` : ''} in ${((performance.now() - started) / 1000).toFixed(1)}s (${concurrency} at once)`);
  for (const { label } of failed) console.log(`  FAILED ${label}`);
  if (skipped.length) console.log(`  not started after the failure: ${skipped.join(', ')}`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
