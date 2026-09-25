// The landing gate, targeted: read what this branch changed against
// origin/main and run the tests, build and smokes that can see it — all of
// them when a change reaches data every test reads, none when it is prose.
// The rule and the evidence behind it: docs/gates.md.
//
//   npm run gate               run it
//   npm run gate -- --plan     say what would run, and why, and stop
//   npm run gate -- --full     everything, whatever changed
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planSmokes, smokeCoverage } from '../harness/verify/run-smokes.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// Read from disk by tests rather than imported, so vitest's import graph
// cannot see a change to them: any one of these runs the whole suite.
const DATA = [
  /^scenarios\//, /^public\//, /^migrations\//, /^spec\//, /^vendor\//, /^\.gitmodules$/,
  /^harness\/(fixtures|reports|musicxml-oracle)\//, /^converters\/fixtures\//,
  /^worker\/generated\//, /^worker\/models[^/]*\.json$/,
  /^package(-lock)?\.json$/, /^tsconfig[^/]*\.json$/, /^[^/]*\.config\.ts$/, /^wrangler\.jsonc$/,
  /^\.dependency-cruiser\.cjs$/, /^(studio|workbench)\/index\.html$/, /^embed\.html$/,
];
// Tests that read SOURCE from disk (a boundary check, a source census, a token
// scan of the shells' styles), so a code change reaches them without an import:
// they run with any code change. harness/helpers/readAudit.ts keeps this list
// true both ways — an undeclared reader fails, and so does a declared one that
// reads no source (unless it spawns a tool, whose reads it cannot see).
export const SOURCE_READERS = [
  'architecture-boundaries', 'audio-boundary', 'converter-matrix',
  'design-tokens', 'app-icons', 'smoke-runner',
].map(name => `harness/conformance/${name}.test.ts`);
// The only test that reads prose: the link check. (keymap-docs was listed too,
// but reads no markdown — it is reached by import like any other.)
const MARKDOWN_TESTS = ['local-markdown-links'].map(name => `harness/conformance/${name}.test.ts`);
const MARKDOWN_READ = /^(docs\/|README\.md$|CLAUDE\.md$|apps\/[^/]+\/README\.md$)/;
// Prose, plans and agent configuration: nothing builds, imports or reads them.
const INERT = /^(docs\/|roadmap\/|research\/|\.claude\/)|^[^/]+\.md$|^apps\/[^/]+\/README\.md$|^\.gitignore$|^\.dev\.vars\.example$/;
// Code the build and vitest's import graph see.
const CODE = /^(src|apps|worker|converters|harness|tools|experiments)\//;

/** The areas a smoke may declare in `covers` (harness/verify/run-smokes.mjs).
 *  `audio` is reached through the shared src/ layers, which run every smoke. */
export const SMOKE_AREAS = ['workbench', 'studio', 'library', 'embed', 'lib', 'audio'];

const SHARED_SRC = /^src\/(model|engine|audio|edit|elements|storage|importers|corpus|assist)\//;
const CONVERTERS = ['guitarpro-mnx', 'musicxml-mnx'];

/** Which smoke areas a path reaches; `all` when it could reach any of them. */
function smokeAreas(file, coverage) {
  const own = coverage.filter(smoke => smoke.files.includes(file));
  if (own.length) return own.map(smoke => `smoke:${smoke.name}`);
  if (SHARED_SRC.test(file) || /^public\//.test(file) || /^converters\/(?!fixtures\/)/.test(file)) return ['all'];
  if (/^(package(-lock)?\.json|tsconfig[^/]*\.json|vite\.config\.ts|wrangler\.jsonc|worker\/generated\/)/.test(file)) return ['all'];
  if (/^harness\/(verify|browser)\//.test(file)) return ['all'];
  if (/^src\/workbench\/|^workbench\/|^src\/entries\/main\.ts$/.test(file)) return ['workbench'];
  if (/^apps\/studio\/|^studio\//.test(file)) return ['studio'];
  if (/^src\/entries\/embed\.ts$|^vite\.embed\.config\.ts$|^embed\.html$|^apps\/viewer-embedded\//.test(file)) return ['embed'];
  if (/^src\/entries\/lib\.ts$|^vite\.lib\.config\.ts$/.test(file)) return ['lib'];
  if (/^(worker|migrations)\/|^tools\/library-local-auth\.mjs$/.test(file)) return ['library'];
  // The corpus is bundled into the workbench, which the workbench smokes open.
  if (/^scenarios\//.test(file)) return ['workbench'];
  return [];
}

/**
 * The plan for a set of changed paths. Pure: the one thing it cannot know —
 * which test files import a changed module — is left as `tests.mode: 'changed'`
 * for the caller to resolve with vitest.
 */
export function planGate(files, { full = false } = {}) {
  const coverage = smokeCoverage();
  const reasons = [];
  const unknown = files.filter(file => !INERT.test(file) && !CODE.test(file) && !DATA.some(re => re.test(file)));
  if (full || unknown.length) {
    if (unknown.length) reasons.push(`unrecognised paths run everything: ${unknown.join(', ')}`);
    else reasons.push('--full');
    return {
      tests: { mode: 'full' }, converters: CONVERTERS, listeningBench: true, build: true,
      smokes: coverage.map(smoke => smoke.name), reasons,
    };
  }
  const data = files.filter(file => DATA.some(re => re.test(file)));
  const code = files.filter(file => CODE.test(file) && !data.includes(file));
  const markdown = files.filter(file => MARKDOWN_READ.test(file));

  let tests;
  if (data.length) {
    tests = { mode: 'full' };
    reasons.push(`data read from disk changed (${data.slice(0, 3).join(', ')}${data.length > 3 ? ', …' : ''}): every test`);
  } else if (code.length) {
    tests = { mode: 'changed', always: [...SOURCE_READERS, ...(markdown.length ? MARKDOWN_TESTS : [])] };
    reasons.push('code changed: the tests that import it, plus the source readers');
  } else if (markdown.length) {
    tests = { mode: 'files', files: MARKDOWN_TESTS };
    reasons.push('prose read by tests changed: the link check only');
  } else {
    tests = { mode: 'none' };
    reasons.push('nothing any test reads changed');
  }

  const converters = files.some(file => /^src\/model\/|^converters\/fixtures\//.test(file))
    ? CONVERTERS
    : CONVERTERS.filter(name => files.some(file => file.startsWith(`converters/${name}/`)));
  if (converters.length) reasons.push(`converter suites: ${converters.join(', ')}`);

  const build = data.length > 0 || code.length > 0;
  if (!build) reasons.push('no build: nothing it compiles changed');

  const areas = new Set(files.flatMap(file => smokeAreas(file, coverage)));
  const smokes = areas.has('all')
    ? coverage.map(smoke => smoke.name)
    : coverage.filter(smoke => areas.has(`smoke:${smoke.name}`) || smoke.covers.some(area => areas.has(area))).map(smoke => smoke.name);
  reasons.push(smokes.length === coverage.length ? 'every smoke' : smokes.length ? `smokes for ${[...areas].join(', ')}` : 'no smokes');
  const listeningBench = files.some(file => /^experiments\/performance-listening\/(?!archive\/)|^src\/(audio|model)\/|^package(-lock)?\.json$|^spec\/mnx-schema\.json$|^tools\/gate\.mjs$/.test(file));
  if (listeningBench) reasons.push('listening bench: whole workspace suite (including disk-read contracts and oracles)');
  return { tests, converters, listeningBench, build, smokes, reasons };
}

/**
 * Would a change to `file` alone make the gate run `test`, for a test that
 * READS the file from disk? An import is vitest's to follow; a read is not, so
 * only a full suite, the prose checks' file list or the declared source readers
 * can reach it. harness/helpers/readAudit.ts asks this of every read a test makes.
 */
export function gateReaches(file, test) {
  const { tests } = planGate([file]);
  return tests.mode === 'full' ||
    (tests.mode === 'files' && tests.files.includes(test)) ||
    (tests.mode === 'changed' && tests.always.includes(test));
}

const git = args => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();

/** What this checkout changed since it left origin/main, committed or not. */
function changedFiles(base) {
  const since = git(['merge-base', base, 'HEAD']);
  if (!since) throw new Error(`No merge base with ${base}; fetch it first.`);
  const listed = [
    ...git(['diff', '--name-only', since]).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ];
  return { since, files: [...new Set(listed.filter(Boolean))].sort() };
}

function run(label, command, args) {
  console.log(`\n▶ ${label}\n> ${command} ${args.join(' ')}`);
  const child = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (child.status !== 0) {
    console.error(`\n✗ gate failed at: ${label}`);
    process.exit(child.status ?? 1);
  }
}

function testFiles(tests, since) {
  if (tests.mode === 'files') return tests.files;
  if (tests.mode !== 'changed') return [];
  const listed = spawnSync('npx', ['vitest', 'list', '--filesOnly', '--changed', since], { cwd: ROOT, encoding: 'utf8' });
  if (listed.status !== 0) throw new Error(`vitest list failed:\n${listed.stderr}`);
  const affected = listed.stdout.split('\n').map(line => line.trim()).filter(line => line.endsWith('.test.ts'))
    .map(line => path.relative(ROOT, line.replace(/^file:\/\//, '')));
  return [...new Set([...affected, ...tests.always])].filter(file => fs.existsSync(path.join(ROOT, file))).sort();
}

function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const baseAt = args.indexOf('--base');
  const base = baseAt >= 0 ? args[baseAt + 1] : 'origin/main';
  const { since, files } = changedFiles(base);
  const plan = planGate(files, { full });
  const tests = testFiles(plan.tests, since);

  console.log(`gate: ${files.length} path(s) changed since ${base} (${since.slice(0, 8)})`);
  for (const reason of plan.reasons) console.log(`  · ${reason}`);
  console.log(`  tests:      ${plan.tests.mode === 'full' ? 'npm test (all)' : tests.length ? `${tests.length} file(s)` : 'none'}`);
  console.log(`  converters: ${plan.converters.join(', ') || 'none'}`);
  console.log(`  bench:      ${plan.listeningBench ? 'mnx-listening-bench' : 'none'}`);
  console.log(`  build:      ${plan.build ? 'npm run build' : 'none'}`);
  console.log(`  smokes:     ${plan.smokes.join(' ') || 'none'}`);
  if (args.includes('--plan')) {
    if (tests.length && plan.tests.mode !== 'full') for (const file of tests) console.log(`    ${file}`);
    return;
  }

  if (plan.tests.mode === 'full') run('tests', 'npm', ['test']);
  else if (tests.length) run('tests', 'npx', ['vitest', 'run', ...tests]);
  for (const name of plan.converters) run(`converter ${name}`, 'npm', ['-w', `@mnx-editor/${name}`, 'test']);
  if (plan.listeningBench) run('listening bench', 'npm', ['-w', 'mnx-listening-bench', 'test']);
  if (plan.build) run('build', 'npm', ['run', 'build']);
  if (plan.smokes.length) {
    // The gate build is the site face; embed and lib still build their own.
    const onlySite = planSmokes(plan.smokes).builds.every(build => build.args[1] === 'build:site');
    run('smokes', process.execPath, ['harness/verify/run-smokes.mjs', ...(plan.build && onlySite ? ['--built'] : []), ...plan.smokes]);
  }
  console.log('\n✓ gate passed');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
