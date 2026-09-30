/** Instrument run only: verify/freeze evidence and bootstrap old verdicts; never execute a listener. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
import {encode,EXPERIMENT} from '../io.ts';
import {sha,requireOutsideGit} from '../ladder/privateSets.ts';
import {readOracle3,caseLabel} from '../events/oracle3.ts';
import {expectedAssessment3} from '../events/assessment3.ts';
import {chooseSentinels,exampleMargin,nextState,normalizedMargin,canRetire,suitePlan} from '../events/gates2.ts';
import {readSlowedBarSet} from './slowedBar1.ts';
import {freezeFourBarTempo,readFourBarTempo} from './fourBarTempo1.ts';
const OLD='runs/g027a-live-confirmation/summary.json',PREREG='reports/028-other-bars-suite.md';
const same=(a:unknown,b:unknown):boolean=> {
  if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=1e-9;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>same(v,b[i]));
  if(a&&b&&typeof a==='object'&&typeof b==='object')return Object.entries(b).every(([k,v])=>same((a as Record<string,unknown>)[k],v));
  return a===b;
};
if(import.meta.url===`file://${process.argv[1]}`) {
 const [dataRoot,runId]=process.argv.slice(2);
 if(!dataRoot||!runId||!/^g028[a-z]?-[a-z0-9-]+$/.test(runId))throw new Error('Usage: run028.ts <private-data-root> <new-run-id>');
 const repo=resolve(EXPERIMENT,'../..');
 const git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:32<<20}).trim();
 if(git('status','--porcelain'))throw new Error('Commit implementation before running');
 const commit=git('rev-parse','HEAD'),reportPath=`experiments/performance-listening/${PREREG}`;
 const preregCommit=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
 git('merge-base','--is-ancestor',preregCommit,'origin/main');
 assert.equal(git('show',`${preregCommit}:${reportPath}`),readFileSync(join(EXPERIMENT,PREREG),'utf8').trim());
 const privateDir=join(requireOutsideGit(dataRoot),'instrument-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);
 if(existsSync(privateDir)||existsSync(publicDir))throw new Error('Run ID exists');
 if(existsSync(join(dataRoot,'contract2-four-bar-tempo-v1')))throw new Error('Planned data set exists; preserve it, do not overwrite');
 const startedAt=new Date().toISOString();mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
 const artifact=(name:string,value:unknown)=>{const path=join(privateDir,name);writeFileSync(path,encode(value));return {path,sha256:sha(readFileSync(path))};};
 const sources=git('ls-files','--','experiments/performance-listening/bench/src','experiments/performance-listening/bench/test/event-oracle-3.test.ts',
  'experiments/performance-listening/listen','src/audio','src/model','experiments/performance-listening/contracts','experiments/performance-listening/sources','experiments/performance-listening/bench/oracle-events').split('\n').filter(p=>/\.(ts|json|md)$/.test(p));
 const sourceHashes=Object.fromEntries([...sources,reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha(readFileSync(resolve(repo,p)))]));
 const common={id:runId,kind:'instrument-validation',modelAndTool:'Sol 6.1 (high) in Codex',preregistration:PREREG,preregistrationCommit:preregCommit,gitCommit:commit,startedAt,sourceHashes,
  listenersExecuted:0,listenerVerdictsChanged:0,evaluators:{assessment:'assessment-evaluator@3',gates:'stage-gates@2',oracle:'event-oracle@3',audit:'required before listener judgment'}};
 const attempt=artifact('attempt.json',{...common,state:'started'});
 try {
  const oracle=readOracle3();
  const oracleResults=oracle.assessment.map(c=>{const actual=expectedAssessment3(caseLabel(c));return {id:c.id,agrees:same(actual,c.expected),expected:c.expected,actual:{overall:actual.overall,typical:actual.typical,bars:actual.bars,clean:actual.clean},arithmetic:c.arithmetic};});
  const disagreements=oracleResults.filter(c=>!c.agrees);
  // The development checks diagnosed this frozen arithmetic error. Do not edit it or call agreement.
  assert.deepEqual(disagreements.map(c=>c.id),['B1']);
  assert.equal(disagreements[0]!.actual.bars[0]!.reference,30);
  assert.equal(disagreements[0]!.expected.bars[0]!.reference,60);
  for(const x of oracle.states)assert.equal(nextState(x),x.expected);
  for(const x of oracle.marginCases)assert(same(normalizedMargin(x.name,x.value),x.expected));
  for(const x of oracle.retirement)assert.equal(canRetire(x.history,x.harder),x.expected);
  const selection=chooseSentinels(oracle.selection.inputs);assert.deepEqual(selection.performances.map(x=>x.id),oracle.selection.performances);assert.deepEqual(selection.controls.map(x=>x.id),oracle.selection.controls);
  const oracleArtifact=artifact('oracle-validation.json',{assessment:oracleResults,states:oracle.states,marginCases:oracle.marginCases,retirement:oracle.retirement,selection,disagreements:['B1'],auditPending:true});
  const oldBytes=readFileSync(join(EXPERIMENT,OLD)),old=JSON.parse(oldBytes.toString());
  const {manifest,sha256}=readSlowedBarSet(old.set.dir);assert.equal(sha256,old.set.sha256);
  // Verify recorded source bytes at their pinned commit; additions here cannot invalidate old verdicts.
  let pinnedSources=0;for(const [p,h]of Object.entries(old.sourceHashes as Record<string,string>)) {
    const path=relative(repo,resolve(EXPERIMENT,p));assert.equal(sha(execFileSync('git',['show',`${old.gitCommit}:${path}`],{cwd:repo,maxBuffer:32<<20})),h);pinnedSources++;
  }
  const legacy=old.results['event-chain@2'];
  const verified=manifest.examples.map(e=>{
    const row=legacy[e.id],bytes=readFileSync(row.artifact.path);assert.equal(sha(bytes),row.artifact.sha256);
    const detail=JSON.parse(bytes.toString());assert.equal(row.gates.passed,true);assert.equal(detail.gates.passed,true);
    assert.equal(detail.following.evaluator,'following-evaluator@2');assert.equal(detail.assessment.evaluator,'assessment-evaluator@2');
    return {e,row,detail,margin:exampleMargin(detail)};
  });
  const stageOf=(id:string)=>/^(sb-|sil-sb-|w2-sb-)/.test(id)?'slowedBar':/^(h-|sil-h-|w2-h-)/.test(id)?'hesitation':'stage1';
  const stages=['stage1','hesitation','slowedBar'].map(id=> {
    const all=verified.filter(x=>stageOf(x.e.id)===id);
    assert(old.perListener['event-chain@2'].bySubstage[id].pooled.every((g:{passed:boolean})=>g.passed));
    const inputs=all.map(x=>({id:x.e.id,score:manifest.examples.find(e=>e.id===x.e.of)!.score,kind:x.e.control??'performance' as const,margin:x.margin}));
    const choice=chooseSentinels(inputs);assert.equal(encode(choice),encode(chooseSentinels([...inputs].reverse())));
    return {id,status:'passed' as const,listener:'event-chain@2',instruments:old.evaluators,passEvidence:{path:OLD,sha256:sha(oldBytes)},confirmedEvidence:null,
      version3Revalidation:'pending independent oracle audit and a future listener evaluation',examples:all.map(x=>x.e.id).sort(),
      sentinels:[...choice.performances,...choice.controls].map(x=>({...x,artifact:legacy[x.id].artifact})),incumbentPassHistory:[old.id],retired:false};
  });
  assert.deepEqual(stages.map(s=>s.sentinels.length),[7,7,5]);
  const validation=artifact('historical-validation.json',{summary:{path:OLD,sha256:sha(oldBytes)},manifest:{path:join(old.set.dir,'manifest.json'),sha256},
    pinnedSources,artifacts:verified.map(x=>x.row.artifact),examples:verified.length,producerMode:'Historical instruments-2 verdicts; not re-evaluated using instruments3.',sentinelRanking:verified.map(x=>({id:x.e.id,margin:x.margin}))});
  const data=freezeFourBarTempo(dataRoot);const frozen=readFourBarTempo(data.out);assert.equal(data.sha256,frozen.sha256);assert.equal(frozen.manifest.examples.length,252);
  const dataValidation=artifact('four-bar-validation.json',data);
  const plan=suitePlan(stages.map(s=>({...s,sentinels:s.sentinels.map(x=>x.id)})),[],false);
  const suite={format:'contract2-suite@1',policy:'contracts/development-contract-2.md',definition:'contracts/event-instruments-3.md',bootstrapRun:runId,
    listener:'event-chain@2',instrumentAudit:'event-oracle@3 pending; B1 discrepancy requires independent resolution',stages,
    openSubstages:['four-bar-tempo-revalidation','held-note-hesitation','rushed-bar','missing-event','wrong-note-with-w1','dead-note','extra-note','onset-jitter','frequency-offset','stage3-chords','stage4-recorded-guitar','stage5-categories'],
    retiredSets:[],retirementReason:'One evaluation of incumbent@2; no performance set meets three-evaluation condition.',
    baselinePolicy:{mode:'sweep-only',since:'2026-09-30',authority:'contracts/development-contract-2.md#keeping-the-suite-lean-the-rising-tide',listeners:['clock-follower@1','online-time-warp@8','online-time-warp@12','online-time-warp@14'],citations:old.baselineCitations},
    lastFullComparison:'g026-single-slowed-bar',nextFullSweepNoLaterThan:31,confirmation:'No historical pass is claimed newly confirmed; 027 was a routine repair.',
    routineRegressionIds:plan,futureEvidence:{manifest:join(data.out,'manifest.json'),sha256:data.sha256,listenerEvaluated:false},validation};
  writeFileSync(join(EXPERIMENT,'bench/suite-record.json'),encode(suite));
  const suiteArtifact=artifact('suite-record.json',suite);
  const summary={...common,finishedAt:new Date().toISOString(),status:'mixed-oracle-disagreement',decision:'D2: B1 frozen arithmetic disagrees; pending independent audit, no version3 listener judgment.',attempt,
    oracle:{cases:oracleResults.length,agree:oracleResults.length-disagreements.length,disagree:disagreements.map(c=>c.id),states:oracle.states.length,margins:oracle.marginCases.length,retirementCases:oracle.retirement.length,validation:oracleArtifact},
    historical:{summary:{path:OLD,sha256:sha(oldBytes)},examples:verified.length,pinnedSources,validation},
    suite:{record:'bench/suite-record.json',sha256:sha(encode(suite)),artifact:suiteArtifact,stages:stages.map(s=>({id:s.id,status:s.status,sentinels:s.sentinels.map(x=>({id:x.id,margin:x.margin}))})),regressions:plan.length,retiredPerformanceSets:0},
    data:{manifest:{path:join(data.out,'manifest.json'),sha256:data.sha256},validation:dataValidation,...data.validation},qualification:'unchanged; failing listener version count0; reserved/final unused; Winner5–8 unexamined'};
  assert(Buffer.byteLength(encode(summary))<300000);writeFileSync(join(publicDir,'summary.json'),encode(summary));
  console.log(encode({id:runId,status:summary.status,oracle:summary.oracle,data:data.validation,sentinels:summary.suite.stages,publicBytes:Buffer.byteLength(encode(summary))}));
 } catch(error) {
   const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null});
   writeFileSync(join(publicDir,'summary.json'),encode({...common,finishedAt:new Date().toISOString(),status:'infrastructure-failed',attempt,failure}));throw error;
 }
}
