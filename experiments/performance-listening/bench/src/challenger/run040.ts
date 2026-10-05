/** Committed, preregistered instrument/state checks only; no native listener judgment. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EXPERIMENT, encode, sha256 } from '../io.ts';
import { requireOutsideGit } from '../ladder/privateSets.ts';
import { readObservationOracle3, check3, inherited3, probes3, stateParity3, statePrefixes3 } from './validateObservation3.ts';
const [dataRoot, runId] = process.argv.slice(2);
assert(dataRoot && runId && /^g040[a-z]?-challenger-streaming-state$/.test(runId), 'Usage run040.ts <data-root> <run-id>');
const repo = resolve(EXPERIMENT, '../..'), git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
assert.equal(git('status', '--porcelain'), '', 'Commit implementation first');
const commit = git('rev-parse', 'HEAD'), report = 'experiments/performance-listening/reports/040-challenger-streaming-state.md';
const prereg = git('log', '--diff-filter=A', '--format=%H', '--', report).split('\n').at(-1)!;
git('merge-base', '--is-ancestor', prereg, 'origin/main');
assert.equal(git('show', `${prereg}:${report}`), readFileSync(resolve(repo, report), 'utf8').trim(), 'Preregistration changed');
assert.equal(git('rev-parse', `${runId}-source`), commit, 'Source tag must pin HEAD');
const privateDir = join(requireOutsideGit(dataRoot), 'instrument-runs', runId), publicDir = join(EXPERIMENT, 'runs', runId);
assert(!existsSync(privateDir) && !existsSync(publicDir), 'Run ID already exists');
const sources = ['bench/src/challenger/streaming3.ts','bench/src/challenger/validateObservation3.ts','bench/src/challenger/run040.ts',
  'bench/src/challenger/observation2.ts','bench/src/challenger/validateObservation2.ts','bench/src/challenger/native.ts',
  'bench/oracle-events/observation-seam-3.json','bench/oracle-events/freeze-observation-seam-3.json',
  'bench/oracle-events/observation-seam-2.json','contracts/observation-seam-3.md','research/streaming-state-040.md',
  'reports/040-challenger-streaming-state.md','bench/test/observation-seam-3.test.ts'];
const common = { id: runId, modelAndTool: 'GPT-6.1-Sol (high) in Codex', gitCommit: commit, preregistrationCommit: prereg,
  sourceHashes: Object.fromEntries(sources.map(p => [p, sha256(readFileSync(join(EXPERIMENT,p)))])),
  definition: 'observation-seam@3', independentAudit: false, nativeInferences: 0, listenersExecuted: 0,
  cursorVerdicts: 0, suiteChanges: 0, reservedFinalHeldOutAccesses: 0,
  stopping: { main: 0, challenger: 1, mainVersions: 3, mainComparisons: 11, challengerVersions: 2, challengerComparisons: 3, explorationSpent: true, qualificationVersionsSpent: 0, qualificationSlotsSpent: 0 } };
const assemble = (status: string, cases: unknown[], validation: unknown, elapsedSeconds: number) => ({ ...common, status, cases, validation, elapsedSeconds,
  nativeCostAndAccuracy: 'Unmeasured; synthetic injected backend/costs only. Independent audit before any listener verdict.' });
const dummy = { path: join(privateDir,'dry.json'), sha256: '0'.repeat(64) };
assert.equal(JSON.parse(encode(assemble('dry',[{id:'dry',artifact:dummy}],dummy,0))).cases[0].artifact.sha256.length,64);
mkdirSync(privateDir,{recursive:true}); mkdirSync(publicDir,{recursive:true});
const artifact = (name: string, value: unknown) => { const path = join(privateDir,name); writeFileSync(path,encode(value),{flag:'wx'}); return {path,sha256:sha256(readFileSync(path))}; };
const start = performance.now(), startedAt = new Date().toISOString();
const attempt = artifact('attempt.json',{...common,startedAt,dryAssembly:true});
const results: {id:string;agrees:boolean;artifact:ReturnType<typeof artifact>}[] = [];
try {
  const baseline = git('rev-parse',`${prereg}^`);
  const scopes = ['experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts',
    'experiments/performance-listening/runs','experiments/performance-listening/archive/ladder-1/runs','src/model','src/audio'];
  const paths = git('ls-tree','-r','--name-only',baseline,'--',...scopes).split('\n').filter(Boolean), protectedHashes: Record<string,string> = {};
  for (const p of paths) { const bytes = readFileSync(resolve(repo,p)), old = execFileSync('git',['show',`${baseline}:${p}`],{cwd:repo,maxBuffer:32<<20});
    assert.equal(sha256(bytes),sha256(old),`Protected file changed ${p}`); protectedHashes[p]=sha256(bytes); }
  const signalPath = '/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/layers/signal.py';
  const primarySources = Object.fromEntries([signalPath,'/home/williao/dev/guitar-nn/benchmarks/basic-pitch/sources/basic_pitch-inference.py',
    '/home/williao/dev/guitar-nn/benchmarks/basic-pitch/config.json','/home/williao/dev/guitar-nn/environments/basic-pitch/requirements.lock'].map(p=>[p,sha256(readFileSync(p))]));
  for (const c of readObservationOracle3()) { const checked = check3(c); results.push({id:c.id,agrees:checked.agrees,artifact:artifact(`case-${c.id}.json`,checked)}); }
  for (const c of inherited3()) results.push({id:`inherited-${c.id}`,agrees:c.agrees,artifact:artifact(`inherited-${c.id}.json`,c)});
  const parity = stateParity3(), prefixes = statePrefixes3(), probes = probes3(readObservationOracle3());
  const validation = artifact('validation.json',{protectedHashes,primarySources,parity,prefixes,probes,
    coverage: 'Explicit pinned-DSP/procedural boundaries in seam3; synthetic maps/costs, not native or acoustic evidence'});
  const pass = results.every(r=>r.agrees) && prefixes.every(p=>p.pass) && probes.every(p=>p.detected);
  const summary = {...assemble(pass?'D1-agreement-pending-independent-audit':'D2-mixed',results,validation,(performance.now()-start)/1000),
    attempt,startedAt,finishedAt:new Date().toISOString(),counts:{newCases:28,inheritedCases:36,agree:results.filter(r=>r.agrees).length,
      probesDetected:probes.filter(p=>p.detected).length,syntheticPrefixes:prefixes.length,syntheticPrefixesAgree:prefixes.filter(p=>p.pass).length,protectedFiles:paths.length},
    parity, decision:'Independent seam3 audit next; native optimization/cost/cursor still open.'};
  writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});
  console.log(encode({id:runId,status:summary.status,counts:summary.counts,parity,elapsedSeconds:summary.elapsedSeconds,publicBytes:Buffer.byteLength(encode(summary))}));
} catch (error) {
  const failure = artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completed:results.length});
  writeFileSync(join(publicDir,'summary.json'),encode({...assemble('D3-infrastructure',results,failure,(performance.now()-start)/1000),attempt,startedAt}),{flag:'wx'});
  throw error;
}
