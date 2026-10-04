/** 037: frozen seam arithmetic validation only. No listener/model execution. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXPERIMENT, encode, sha256 } from '../io.ts';
import { requireOutsideGit } from '../ladder/privateSets.ts';
import { readObservationOracle2, checkHandCase, legacyChecks, faultProbes } from './validateObservation2.ts';
const REPORT = 'reports/037-challenger-observation-seam.md';
const IDENTITY = 'GPT-6.1-Sol (high) in Codex';
if (import.meta.url === pathToFileURL(resolve(process.argv[1]!)).href) {
  const [dataRoot, runId] = process.argv.slice(2);
  assert(dataRoot && runId && /^g037[a-z]?-challenger-observation-seam$/.test(runId), 'Usage: run037.ts <private-data-root> <new-run-id>');
  const repo = resolve(EXPERIMENT, '../..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Commit all implementation first');
  const commit = git('rev-parse', 'HEAD'), reportPath = `experiments/performance-listening/${REPORT}`;
  const preregCommit = git('log', '--diff-filter=A', '--format=%H', '--', reportPath).split('\n').at(-1)!;
  git('merge-base', '--is-ancestor', preregCommit, 'origin/main');
  assert.equal(git('show', `${preregCommit}:${reportPath}`), readFileSync(join(EXPERIMENT, REPORT), 'utf8').trim(), 'Pre-registration changed');
  assert.equal(git('rev-parse', `${runId}-source`), commit, 'Source tag must pin HEAD');
  const privateDir = join(requireOutsideGit(dataRoot), 'instrument-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
  assert(!existsSync(privateDir) && !existsSync(publicDir), 'Run ID already exists');
  const sourcePaths = ['bench/src/challenger/run037.ts', 'bench/src/challenger/observation2.ts', 'bench/src/challenger/validateObservation2.ts',
    'bench/src/challenger/native.ts', 'bench/src/io.ts', 'bench/src/ladder/privateSets.ts', 'bench/test/observation-seam-2.test.ts',
    'bench/oracle-events/observation-seam-2.json', 'bench/oracle-events/freeze-observation-seam-2.json',
    'contracts/observation-seam-2.md', 'contracts/development-contract-2.md', 'research/observation-clock-037.md', REPORT];
  const common = { id: runId, kind: 'observation-seam-arithmetic-validation', modelAndTool: IDENTITY,
    gitCommit: commit, preregistration: REPORT, preregistrationCommit: preregCommit,
    sourceHashes: Object.fromEntries(sourcePaths.map(p => [p, sha256(readFileSync(join(EXPERIMENT, p)))])),
    definition: 'observation-seam@2', independentAudit: false, listenersExecuted: 0, modelInferences: 0,
    listenerVerdictsChanged: 0, suiteChanges: 0, reservedFinalHeldOutAccesses: 0 };
  const ref = (name: string) => ({ path: join(privateDir, name), sha256: '0'.repeat(64) });
  // Dry assembly exercises the same summary structure before any case is evaluated.
  const assemble = (results: { id: string; agrees: boolean; artifact: { path: string; sha256: string } }[],
    validation: { path: string; sha256: string }, counts: { protectedFiles: number; historicalRuns: number; citedArtifacts: number; legacy: number; probes: number },
    status: string, elapsedSeconds: number) => ({ ...common, status, elapsedSeconds, oracle: { cases: results.length,
      agree: results.filter(r => r.agrees).length, sha256: common.sourceHashes['bench/oracle-events/observation-seam-2.json'], perCase: results }, counts, validation,
    stopping: { main: 0, challenger: 0, mainVersions: 3, mainComparisons: 10, challengerVersions: 1, challengerComparisons: 1,
      explorationSpent: true, qualificationVersionsSpent: 0, qualificationSlotsSpent: 0 },
    fullSweep: 'No listener stage claim; sines retired by amendment; guitar sweep due from first guitar-stage claim.' });
  const dry = JSON.parse(encode(assemble([{ id: 'dry', agrees: true, artifact: ref('dry.json') }], ref('validation.json'),
    { protectedFiles: 0, historicalRuns: 0, citedArtifacts: 0, legacy: 0, probes: 0 }, 'dry', 0)));
  assert.equal(dry.oracle.perCase[0].artifact.sha256.length, 64); assert.equal(dry.independentAudit, false);
  const startedAt = new Date().toISOString(), start = performance.now();
  mkdirSync(privateDir, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const artifact = (name: string, value: unknown) => {
    const path = join(privateDir, name); writeFileSync(path, encode(value), { flag: 'wx' });
    return { path, sha256: sha256(readFileSync(path)) };
  };
  const results: { id: string; agrees: boolean; artifact: { path: string; sha256: string } }[] = [];
  const attempt = artifact('attempt.json', { ...common, startedAt, dryAssembly: true });
  try {
    const baseline = git('rev-parse', `${preregCommit}^`);
    const scopes = ['experiments/performance-listening/bench', 'experiments/performance-listening/listen',
      'experiments/performance-listening/contracts', 'experiments/performance-listening/runs',
      'experiments/performance-listening/archive/ladder-1/runs', 'src/audio', 'src/model'];
    const protectedPaths = git('ls-tree', '-r', '--name-only', baseline, '--', ...scopes).split('\n').filter(Boolean);
    const protectedHashes: Record<string, string> = {};
    for (const p of protectedPaths) {
      const current = readFileSync(resolve(repo, p)), old = execFileSync('git', ['show', `${baseline}:${p}`], { cwd: repo, maxBuffer: 32 << 20 });
      assert.equal(sha256(current), sha256(old), `Protected file changed: ${p}`);
      protectedHashes[relative(EXPERIMENT, resolve(repo, p))] = sha256(current);
    }
    let citedArtifacts = 0;
    const citations: { path: string; sha256: string }[] = [];
    // Validate recorded artifacts without inspecting audio or running the old suite.
    const visit = (v: unknown): void => {
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      if (typeof o.path === 'string' && typeof o.sha256 === 'string' && o.path.startsWith('/home/williao/dev/mnx-listening-data/') && existsSync(o.path)) {
        assert.equal(sha256(readFileSync(o.path)), o.sha256, `Cited artifact changed: ${o.path}`); citedArtifacts++;
      }
      for (const child of Object.values(o)) visit(child);
    };
    for (const id of ['g035-challenger-basic-pitch', 'g036-incumbent-guitar']) {
      const path = join(EXPERIMENT, 'runs', id, 'summary.json'), bytes = readFileSync(path);
      citations.push({ path: relative(EXPERIMENT, path), sha256: sha256(bytes) }); visit(JSON.parse(bytes.toString()));
    }
    const cases = readObservationOracle2();
    // One private record per measured case, written immediately; a writer failure cannot discard earlier cases.
    for (const c of cases) {
      const measured = checkHandCase(c);
      results.push({ id: c.id, agrees: measured.agrees, artifact: artifact(`case-${c.id}.json`, measured) });
    }
    const legacy = legacyChecks(cases), probes = faultProbes(cases);
    const validation = artifact('validation.json', { protectedHashes, citations, citedArtifacts, legacy, probes, independentAudit: false,
      timing: 'Injected elapsed times only, no native performance cost measured', causality: 'Sample access and arithmetic only, no live listener prefix verdict' });
    const agrees = results.every(r => r.agrees) && legacy.every(c => c.agrees) && probes.every(p => p.detected);
    const summary = { ...assemble(results, validation,
      { protectedFiles: protectedPaths.length, historicalRuns: citations.length, citedArtifacts, legacy: legacy.length, probes: probes.filter(p => p.detected).length },
      agrees ? 'D1-agreement-pending-independent-audit' : 'D2-mixed-hand-oracle-result', (performance.now() - start) / 1000),
      startedAt, finishedAt: new Date().toISOString(), attempt,
      decision: agrees ? 'D1: implementation agreement only; independent observation-seam@2 audit next, no live verdict.' : 'D2: preserve frozen disagreement; independent audit next.' };
    writeFileSync(join(publicDir, 'summary.json'), encode(summary), { flag: 'wx' });
    console.log(encode({ id: runId, status: summary.status, cases: results.length, agree: results.filter(r => r.agrees).length,
      counts: summary.counts, elapsedSeconds: summary.elapsedSeconds, publicBytes: Buffer.byteLength(encode(summary)) }));
  } catch (error) {
    const failure = artifact('failure.json', { message: String(error), stack: error instanceof Error ? error.stack : null, completedCases: results.length });
    const publicPath = join(publicDir, 'summary.json');
    if (!existsSync(publicPath)) writeFileSync(publicPath, encode({ ...common, startedAt, attempt, failure, completedCases: results,
      status: 'D3-infrastructure', elapsedSeconds: (performance.now() - start) / 1000 }), { flag: 'wx' });
    throw error;
  }
}
