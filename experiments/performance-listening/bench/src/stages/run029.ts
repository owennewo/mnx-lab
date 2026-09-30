/** One committed instrument-validation run. No listener execution or new verdict. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
import {encode,EXPERIMENT} from '../io.ts';
import {sha,requireOutsideGit} from '../ladder/privateSets.ts';
import {readOracle4} from '../events/oracle4.ts';
import {validateOracle4,faultSensitivity4} from '../events/validateOracle4.ts';
import {chooseSentinels,exampleMargin,suitePlan} from '../events/gates2.ts';
const PREREG='reports/029-oracle-coverage.md';
if(import.meta.url===`file://${process.argv[1]}`) {
 const [dataRoot,runId]=process.argv.slice(2);
 if(!dataRoot||!runId||!/^g029[a-z]?-[a-z0-9-]+$/.test(runId))throw new Error('Usage: run029.ts <private-data-root> <new-run-id>');
 const repo=resolve(EXPERIMENT,'../..');
 const git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:32<<20}).trim();
 if(git('status','--porcelain'))throw new Error('Commit implementation before running');
 const commit=git('rev-parse','HEAD'),reportPath=`experiments/performance-listening/${PREREG}`;
 const preregCommit=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
 git('merge-base','--is-ancestor',preregCommit,'origin/main');
 assert.equal(git('show',`${preregCommit}:${reportPath}`),readFileSync(join(EXPERIMENT,PREREG),'utf8').trim());
 const privateDir=join(requireOutsideGit(dataRoot),'instrument-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);
 if(existsSync(privateDir)||existsSync(publicDir))throw new Error('Run ID exists');
 const start=performance.now(),startedAt=new Date().toISOString();
 mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
 const artifact=(name:string,value:unknown)=>{const path=join(privateDir,name);writeFileSync(path,encode(value));return {path,sha256:sha(readFileSync(path))};};
 const paths=git('ls-files','--','experiments/performance-listening/bench/src','experiments/performance-listening/bench/test',
  'experiments/performance-listening/listen','src/audio','src/model','experiments/performance-listening/contracts',
  'experiments/performance-listening/bench/oracle-events','experiments/performance-listening/bench/suite-record.json').split('\n').filter(p=>/\.(ts|json|md)$/.test(p));
 const sourceHashes=Object.fromEntries([...paths,reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha(readFileSync(resolve(repo,p)))]));
 const common={id:runId,kind:'instrument-validation',modelAndTool:'Sol 6.1 (high) in Codex',preregistration:PREREG,
  preregistrationCommit:preregCommit,gitCommit:commit,startedAt,sourceHashes,listenersExecuted:0,listenerVerdictsChanged:0,
  evaluators:{assessment:'assessment-evaluator@3',gates:'stage-gates@2',oracle:'event-oracle@4',definition:'event-instruments@4',audit:'independent audit4 required'}};
 const attempt=artifact('attempt.json',{...common,state:'started'});
 try {
  // Existing producer/test/oracle bytes must be untouched; no behavior change of a frozen baseline.
  const frozenPaths=git('ls-tree','-r','--name-only',preregCommit,'--','experiments/performance-listening/bench/src',
   'experiments/performance-listening/bench/test','experiments/performance-listening/listen','src/audio','src/model',
   'experiments/performance-listening/bench/oracle-events').split('\n').filter(p=>/\.(ts|json|md)$/.test(p));
  for(const p of frozenPaths)assert.equal(sha(readFileSync(resolve(repo,p))),sha(execFileSync('git',['show',`${preregCommit}:${p}`],{cwd:repo,maxBuffer:32<<20})));
  const frozenOracle=JSON.parse(readFileSync(join(EXPERIMENT,'bench/oracle-events/freeze-4.json'),'utf8'));
  assert.equal(sha(readFileSync(join(EXPERIMENT,'bench/oracle-events/oracle-4.json'))),frozenOracle.sha256);
  const checks=validateOracle4(readOracle4()),faults=faultSensitivity4(readOracle4());
  const validation=artifact('oracle-validation.json',{checks,faults,precision:'finite numbers1e-9; exact enums/IDs/null/booleans',independentAudit:false});
  // Historical suite structure and artifact integrity, not a new instruments3 listener evaluation.
  const suitePath=join(EXPERIMENT,'bench/suite-record.json'),suiteBytes=readFileSync(suitePath),suite=JSON.parse(suiteBytes.toString());
  assert.equal(suite.retiredSets.length,0);assert.equal(suite.nextFullSweepNoLaterThan,31);assert.equal(suite.baselinePolicy.mode,'sweep-only');
  assert.equal(suite.baselinePolicy.listeners.length,4);assert.equal(suite.futureEvidence.listenerEvaluated,false);
  assert.equal(sha(readFileSync(suite.futureEvidence.manifest)),suite.futureEvidence.sha256);
  for(const r of suite.retiredSets)assert(r.date&&r.evidence&&r.replacement);
  const citations=[...suite.baselinePolicy.citations,suite.stages[0].passEvidence];
  for(const c of citations)assert.equal(sha(readFileSync(resolve(EXPERIMENT,c.path))),c.sha256);
  const historic=JSON.parse(readFileSync(resolve(EXPERIMENT,suite.stages[0].passEvidence.path),'utf8'));
  const all=historic.results['event-chain@2'] as Record<string,{artifact:{path:string;sha256:string}}>;let artifacts=0;
  const ranking=new Map(Object.entries(all).map(([id,row])=>{
   const bytes=readFileSync(row.artifact.path);assert.equal(sha(bytes),row.artifact.sha256);artifacts++;
   return [id,exampleMargin(JSON.parse(bytes.toString()))];
  }));
  for(const stage of suite.stages) {
   assert.equal(stage.status,'passed');assert.equal(stage.confirmedEvidence,null);assert.equal(stage.retired,false);
   assert.equal(stage.listener,'event-chain@2');assert.equal(stage.instruments.assessment,'assessment-evaluator@2');
   assert(stage.version3Revalidation.includes('pending'));
   // Parent-score metadata of every example is in the already frozen manifest.
   const manifest=JSON.parse(readFileSync(join(historic.set.dir,'manifest.json'),'utf8'));
   assert.equal(sha(readFileSync(join(historic.set.dir,'manifest.json'))),historic.set.sha256);
   const inputs=stage.examples.map((id:string)=>{
    const e=manifest.examples.find((x:{id:string})=>x.id===id);assert(e);
    const parent=manifest.examples.find((x:{id:string})=>x.id===e.of);assert(parent);
    return {id,score:parent.score,kind:e.control??'performance',margin:ranking.get(id)!};
   });
   const selected=chooseSentinels(inputs),ids=[...selected.performances,...selected.controls].map(x=>x.id);
   assert.deepEqual(ids,stage.sentinels.map((x:{id:string})=>x.id));
  }
  const plan=suitePlan(suite.stages.map((s:{sentinels:{id:string}[]})=>({...s,sentinels:s.sentinels.map(x=>x.id)})),[],false);
  assert.deepEqual(plan,suite.routineRegressionIds);assert.equal(plan.length,19);
  const historical=artifact('historical-validation.json',{suite:{path:'bench/suite-record.json',sha256:sha(suiteBytes)},frozenFiles:frozenPaths,
   artifactCount:artifacts,citations,sentinelIds:plan,retiredSets:0,newConfirmations:0,interpretation:'Stored instruments2 evidence only; frozen producers unchanged; no listener reevaluated.'});
  const failed=checks.filter(c=>!c.agrees),supported=failed.length===0&&faults.every(f=>f.detected);
  const groups=Object.fromEntries([...new Set(checks.map(c=>c.group))].map(group=>{
   const rows=checks.filter(c=>c.group===group);return [group,{cases:rows.length,agree:rows.filter(c=>c.agrees).length}];
  }));
  const summary={...common,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-start)/1000,status:supported?'agreement-pending-audit':'mixed-oracle-disagreement',
   decision:supported?'D1: all oracle4 checks agree; independent audit4 required before listener judgment.':'D2: frozen oracle disagreement preserved; independent audit4 next.',attempt,
   oracle:{sha256:frozenOracle.sha256,cases:checks.length,agree:checks.length-failed.length,groups,disagreements:failed.map(c=>`${c.group}:${c.id}`),validation},
   faults:{families:faults.length,detected:faults.filter(f=>f.detected).length},
   historical:{validation:historical,frozenFiles:frozenPaths.length,artifacts,sentinels:plan.length,retiredSets:0,newConfirmations:0},
   stopping:{failingListenerVersions:0,developmentListenerVersions:2,completedListenerComparisons:4,qualificationVersions:0,qualificationAssessments:0,reservedFinalAccesses:0},
   fullSweepDueNoLaterThan:31,independentAudit:false};
  assert(Buffer.byteLength(encode(summary))<300000);writeFileSync(join(publicDir,'summary.json'),encode(summary));
  console.log(encode({id:runId,status:summary.status,elapsedSeconds:summary.elapsedSeconds,cases:checks.length,groups,faults:summary.faults,frozenFiles:frozenPaths.length,artifacts,publicBytes:Buffer.byteLength(encode(summary))}));
 } catch(error) {
  const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null});
  writeFileSync(join(publicDir,'summary.json'),encode({...common,finishedAt:new Date().toISOString(),status:'infrastructure-failed',attempt,failure}));throw error;
 }
}
