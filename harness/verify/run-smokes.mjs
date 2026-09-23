// Explicit batch orchestration: build each selected face once, then fail fast.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SMOKES = {
  'lib': { build: 'build:lib', runs: [{ file: 'harness/verify/lib-smoke.mjs' }] },
  'embed': { build: 'build:embed', runs: [{ file: 'harness/verify/embed-smoke.mjs' }, { file: 'harness/verify/embed-smoke.mjs', env: { MNX_EMBED_FORMAT: 'iife' } }] },
  'csp': { build: 'build', runs: [{ file: 'harness/verify/csp-smoke.mjs' }] },
  'selection': { build: 'build', runs: [{ file: 'harness/verify/selection-smoke.mjs' }] },
  'inspector': { build: 'build', runs: [{ file: 'harness/verify/inspector-smoke.mjs' }] },
  'focus': { build: 'build', runs: [{ file: 'harness/verify/focus-mode-smoke.mjs' }] },
  'sync-bar': { build: 'build', runs: [{ file: 'harness/verify/sync-bar-smoke.mjs' }] },
  'sync-rederive': { build: 'build', runs: [{ file: 'harness/verify/sync-rederive-smoke.mjs' }] },
  'piece-create': { build: 'build', runs: [{ file: 'harness/verify/piece-create-smoke.mjs' }] },
  'save-pipeline': { build: 'build', runs: [{ file: 'harness/verify/save-pipeline-smoke.mjs' }] },
  'piece-lifecycle': { build: 'build', runs: [{ file: 'harness/verify/piece-lifecycle-smoke.mjs' }] },
  'studio-editor': { build: 'build', runs: [{ file: 'harness/verify/studio-editor-smoke.mjs' }] },
  'play-only': { build: 'build', runs: [{ file: 'harness/verify/studio-play-only-smoke.mjs' }] },
  'workbench-editor': { build: 'build', runs: [{ file: 'harness/verify/workbench-editor-smoke.mjs' }] },
  'audio': { build: null, runs: [{ file: 'harness/verify/audio-smoke.mjs' }] },
  'player': { build: 'build', runs: [{ file: 'harness/verify/performance-review.mjs' }, { file: 'harness/verify/player-workbench-smoke.mjs' }] },
  'unrolled': { build: 'build', runs: [{ file: 'harness/verify/unrolled-review.mjs' }, { file: 'harness/verify/unrolled-smoke.mjs' }] },
  'studio': { build: 'build', runs: [{ file: 'harness/verify/studio-smoke.mjs' }] },
  'studio-export': { build: 'build', runs: [{ file: 'harness/verify/studio-export-smoke.mjs' }] },
  'recording-studio': { build: 'build', runs: [{ file: 'harness/verify/recording-studio-smoke.mjs' }] },
  'single-cursor': { build: 'build', runs: [{ file: 'harness/verify/single-cursor-smoke.mjs' }] },
  'recording-management': { build: 'build', runs: [{ file: 'harness/verify/recording-management-smoke.mjs' }] },
  'youtube': { build: 'build:embed', runs: [{ file: 'harness/verify/youtube-smoke.mjs' }] },
};
const ARTIFACTS = {
  build: 'dist/client/workbench/index.html',
  'build:embed': 'dist/embed/mnx-lab.js',
  'build:lib': 'dist/lib/index.js',
};

export function planSmokes(names, { built = false } = {}) {
  if (!names.length) throw new Error('Select at least one smoke; use --help for names.');
  for (const name of names) {
    if (!Object.hasOwn(SMOKES, name)) throw new Error(`Unknown smoke: ${name}. Use --help for names.`);
  }
  const selected = [...new Set(names)].map(name => SMOKES[name]);
  const builds = [...new Set(selected.map(smoke => smoke.build).filter(Boolean))];
  return {
    artifacts: builds.map(build => ARTIFACTS[build]),
    commands: [
      ...(built ? [] : builds.map(build => ({ command: 'npm', args: ['run', build] }))),
      ...selected.flatMap(smoke => smoke.runs.map(({ file, env }) => ({
        command: process.execPath, args: [file], ...(env ? { env } : {}),
      }))),
    ],
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: npm run smoke -- [--built] <name> [<name> ...]');
    console.log('Names: ' + Object.keys(SMOKES).join(', '));
    console.log('--built: reuse current artifacts; rebuild first if sources/configuration changed.');
    return;
  }
  const built = args.includes('--built');
  const plan = planSmokes(args.filter(arg => arg !== '--built'), { built });
  if (built) {
    for (const artifact of plan.artifacts) {
      if (!fs.existsSync(path.join(ROOT, artifact))) throw new Error(`Missing ${artifact}; run without --built first.`);
    }
  }
  for (const { command, args, env } of plan.commands) {
    console.log(`\n> ${path.basename(command)} ${args.join(' ')}`);
    const child = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      process.exitCode = child.status ?? 1;
      return;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
