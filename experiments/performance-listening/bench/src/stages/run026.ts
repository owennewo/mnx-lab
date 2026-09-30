/** 026: unchanged listeners, verified regression reuse, compact public provenance. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Handoff } from '../../../listen/contract.ts';
import { decisionFromJSON, decisionToJSON, positionFromJSON, positionToJSON, type DecisionJSON, type ScorePositionJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { ASSESSMENT_EVALUATOR_2, evaluateAssessment2, type AssessmentEvaluation2, type AssessmentReport2 } from '../events/assessment2.ts';
import { evaluateFollowing, FOLLOWING_EVALUATOR, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates, costGates, cursorGates, pooledGates, STAGE_GATES } from '../events/gates.ts';
import type { PerformanceLabel } from '../events/label.ts';
import { readOracle, readOracle2 } from '../events/oracle.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { CANDIDATES } from '../ladder/candidates.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain1, EVENT_CHAIN_1 } from '../listeners/eventChain1.ts';
import type { Cost } from '../report/index.ts';
import { legacyListener } from '../seam/legacy.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { BASELINES } from './run023.ts';
import { assetPath } from './stage1v2.ts';
import { HESITATION_SET, readHesitationSet } from './hesitation1.ts';
import { SLOWED_BAR_SET, readSlowedBarSet } from './slowedBar1.ts';
const DELIVERY={sampleRate:48000,chunkSamples:480};
const REGRESSION='runs/g025-single-hesitation/summary.json';
type Artifact={path:string;sha256:string};
type Pool={label:PerformanceLabel;following:FollowingEvaluation|null;assessment:AssessmentEvaluation2|null};
type ReportJSON=Omit<AssessmentReport2,'notes'|'tempo'> & {notes:DecisionJSON[];tempo:Omit<AssessmentReport2['tempo'],'intervals'> & {intervals:{from:ScorePositionJSON;to:ScorePositionJSON;seconds:number}[]}};
type OldExample={record:Artifact;assessmentArtifact:Artifact|null;cost:Cost|null;started:{ok:boolean};following:FollowingEvaluation|null;assessment:AssessmentEvaluation2|null};
type OldSummary={gitCommit:string;set:{sha256:string};sourceHashes:Record<string,string>;results:Record<string,Record<string,OldExample>>;causality:Record<string,{pass:boolean}[]>};
if(import.meta.url===`file://${process.argv[1]}`) {
  const [setDir,runId,preregistration]=process.argv.slice(2);
  if(!setDir||!runId||preregistration!=='reports/026-single-slowed-bar.md'||!/^g026[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: run026.ts <set-dir> <new-run-id> reports/026-single-slowed-bar.md');
  const root=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32<<20}).trim();
  if(git('status','--porcelain')) throw new Error('Commit all code before running');
  const reportPath=`experiments/performance-listening/${preregistration}`;
  git('cat-file','-e',`HEAD:${reportPath}`);
  const preregCommit=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
  git('merge-base','--is-ancestor',preregCommit,'origin/main');
  const publicDir=resolve(EXPERIMENT,'runs',runId),privateDir=join(requireOutsideGit(setDir),'runs',runId);
  if(existsSync(publicDir)||existsSync(privateDir)) throw new Error('Run ID exists; never overwrite');
  const {manifest,sha256}=readSlowedBarSet(setDir),parent=readHesitationSet(join(resolve(setDir,'..'),HESITATION_SET));
  const oldBytes=readFileSync(resolve(EXPERIMENT,REGRESSION)),old=JSON.parse(oldBytes.toString()) as OldSummary;
  if(manifest.id!==SLOWED_BAR_SET||manifest.parent.sha256!==parent.sha256||old.set.sha256!==parent.sha256) throw new Error('Regression set mismatch');
  for(const e of parent.manifest.examples) if(encode(e)!==encode(manifest.examples.find(n=>n.id===e.id))) throw new Error(`Changed regression example ${e.id}`);
  readOracle();readOracle2();
  const producerPaths=git('ls-tree','-r','--name-only',old.gitCommit,'--','src/audio','src/model','experiments/performance-listening/listen','experiments/performance-listening/bench/src').split('\n').filter(p=>p.endsWith('.ts'));
  const producerChecks=producerPaths.map(path=>{const recorded=execFileSync('git',['show',`${old.gitCommit}:${path}`],{cwd:root,maxBuffer:32<<20});return {path,sha256:sha(recorded),unchanged:existsSync(resolve(root,path))&&sha(readFileSync(resolve(root,path)))===sha(recorded)};});
  const changed=producerChecks.filter(p=>!p.unchanged).map(p=>p.path);
  // Non-code producer contracts and oracle bytes must also remain unchanged. Reports evolve below their frozen pre-registration.
  for(const [path,hash] of Object.entries(old.sourceHashes)) {
    if(sha(execFileSync('git',['show',`${old.gitCommit}:experiments/performance-listening/${path}`],{cwd:root,maxBuffer:32<<20}))!==hash) throw new Error('Pinned producer hash invalid');
    if(!path.startsWith('reports/')&&!path.startsWith('research/')&&sha(readFileSync(resolve(EXPERIMENT,path)))!==hash&&!changed.includes(`experiments/performance-listening/${path}`)) changed.push(`experiments/performance-listening/${path}`);
  }
  const verifiedArtifacts:Artifact[]=[];
  const verify=(a:Artifact)=>{if(sha(readFileSync(a.path))!==a.sha256) throw new Error(`Changed private artifact ${a.path}`);verifiedArtifacts.push(a);};
  for(const id of [...BASELINES,EVENT_CHAIN_1]) for(const e of parent.manifest.examples) {
    const original=old.results[id][e.id];if(!original) throw new Error('Missing regression result');verify(original.record);if(original.assessmentArtifact) verify(original.assessmentArtifact);
  }
  const reuse=changed.length===0,commit=git('rev-parse','HEAD'),startedAt=new Date().toISOString();
  mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
  const artifact=(name:string,data:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(data));return {path,sha256:sha(readFileSync(path))};};
  artifact('attempt.json',{runId,commit,startedAt,state:'started'});
  const validation=artifact('regression-validation.json',{summary:{path:REGRESSION,sha256:sha(oldBytes)},sourceCommit:old.gitCommit,producerChecks,changed,verifiedArtifacts,regressionExamples:144,reuse});
  const results:Record<string,Record<string,unknown>>={},perListener:Record<string,unknown>={};
  try {
    for(const id of [...BASELINES,EVENT_CHAIN_1]) {
      const pool:Pool[]=[],costs:Cost[]=[],freshCosts:Cost[]=[],perExample:Record<string,unknown>={},regressionDetails:Record<string,unknown>={};
      let prefixPassed=true,newPrefixes=0,reusedPrefixes=0,passed=0,newCursorPassed=0,newAssessmentPassed=0,regressionPassed=0;
      const entry=CANDIDATES.find(c=>c.id===id);
      for(const e of manifest.examples) {
        const original=old.results[id][e.id]??null;
        let following:FollowingEvaluation|null,assessment:AssessmentEvaluation2|null,cost:Cost|null,detail:unknown;
        if(original&&reuse) {
          const record=(JSON.parse(readFileSync(original.record.path,'utf8')).record as DecisionJSON[]).map(decisionFromJSON);
          following=original.started.ok?evaluateFollowing(e.label,record):null;
          assessment=null;
          if(original.assessmentArtifact) {
            const r=JSON.parse(readFileSync(original.assessmentArtifact.path,'utf8')) as ReportJSON;
            const report:AssessmentReport2={...r,notes:r.notes.map(decisionFromJSON),tempo:{...r.tempo,intervals:r.tempo.intervals.map(i=>({...i,from:positionFromJSON(i.from),to:positionFromJSON(i.to)}))}};
            assessment=evaluateAssessment2(e.label,report);
          }
          if(encode(following)!==encode(original.following)||encode(assessment)!==encode(original.assessment)) throw new Error('Reused evaluation differs');
          cost=original.cost;const checks=old.causality[`${id} ${e.id}`]??[];reusedPrefixes+=checks.length;if(checks.some(c=>!c.pass)) prefixPassed=false;
          detail={reused:true,record:original.record,assessmentArtifact:original.assessmentArtifact,cost,following,assessment};
        } else {
          const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);
          if(!c.ok||c.performance.diagnostics.length) throw new Error('Score does not compile');
          const handoff:Handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
          const audio=readWav(readFileSync(e.audioPath));if(audio.length!==e.label.audio!.samples) throw new Error('Audio length differs');
          const candidate=new EventChain1(),factory=id===EVENT_CHAIN_1?()=>candidate:legacyListener(entry!.factory,entry!.legacy);
          const run=executeSeam(factory,score,handoff,audio,DELIVERY);cost=run.cost;if(cost) freshCosts.push(cost);
          following=run.started.ok?evaluateFollowing(e.label,run.record):null;
          const report=id===EVENT_CHAIN_1&&run.started.ok?candidate.assessment():null;assessment=report?evaluateAssessment2(e.label,report):null;
          let checks:ReturnType<typeof seamCausality>=[];
          const baselineChecks=original?['s1-90','s2-90','h-s1-90-1000','h-s2-90-1000','sil-h-s2-90-1000','w2-h-s2-90-1000']:['sb-s2-90-b1-50','sb-s2-90-b2-50','sil-sb-s2-90-b2-50','w2-sb-s2-90-b2-50'];
          if(id===EVENT_CHAIN_1||baselineChecks.includes(e.id)) {
            checks=run.started.ok?seamCausality(id===EVENT_CHAIN_1?()=>new EventChain1():legacyListener(entry!.factory,entry!.legacy),score,handoff,audio,DELIVERY,run.record):[];
            newPrefixes+=checks.length;if(checks.length!==6||checks.some(c=>!c.pass)) prefixPassed=false;
          }
          detail={reused:false,started:run.started,cost,following,assessment,causality:checks,record:run.record.map(decisionToJSON),
            report:report?{...report,notes:report.notes.map(decisionToJSON),tempo:{...report.tempo,intervals:report.tempo.intervals.map(i=>({...i,from:positionToJSON(i.from),to:positionToJSON(i.to)}))}}:null};
        }
        pool.push({label:e.label,following,assessment});if(cost) costs.push(cost);
        const cursor=following?cursorGates(e.label,following):null,assess=assessmentGates(e.label,assessment);
        const gates={cursor:cursor?.failed??['refused'],assessment:assess.failed,passed:(cursor?.passed??false)&&assess.passed};
        if(gates.passed) passed++;
        if(original) {if(gates.passed) regressionPassed++;regressionDetails[e.id]={detail,gates};}
        else {
          if(cursor?.passed) newCursorPassed++;if(assess.passed) newAssessmentPassed++;
          const a=artifact(`${id.replace('@','-')}.${e.id}.json`,{listener:id,example:e.id,detail,gates});
          perExample[e.id]={kind:e.kind,control:e.control,tempo:e.tempo,stretch:manifest.stretches.find(s=>s.id===e.of)??null,gates,artifact:a};
          console.log(`${id} ${e.id}: cursor ${gates.cursor.join(',')||'pass'} assessment ${gates.assessment.join(',')||'pass'}`);
        }
      }
      const regressions=artifact(`${id.replace('@','-')}.regressions.json`,regressionDetails);
      const bySubstage={stage1:pooledGates(pool.filter(p=>/^(s[12]|sil-s[12]|w2-s[12])-\d+$/.test(p.label.id))),hesitation:pooledGates(pool.filter(p=>/^(h-|sil-h-|w2-h-)/.test(p.label.id))),slowedBar:pooledGates(pool.filter(p=>/^(sb-|sil-sb-|w2-sb-)/.test(p.label.id))),
        bar1:pooledGates(pool.filter(p=>/^sb-.*-b1-/.test(p.label.id))),bar2:pooledGates(pool.filter(p=>/^sb-.*-b2-/.test(p.label.id)))};
      const pooled=pooledGates(pool),cost=costGates(prefixPassed,costs),max=(xs:Cost[],f:(c:Cost)=>number)=>xs.length?Math.max(...xs.map(f)):null;
      results[id]=perExample;perListener[id]={pooled,bySubstage,cost,counts:{examples:pool.length,passed,newCursorPassed,newAssessmentPassed,regressionPassed,newPrefixes,reusedPrefixes},regressions,
        freshCost:{machine:freshCosts[0]?.machine,maxSustained:max(freshCosts,c=>c.sustainedRatio),maxP99Ms:max(freshCosts,c=>c.p99Ms),maxBacklogMs:max(freshCosts,c=>c.maxBacklogMs)},
        passed:pool.length===264&&passed===264&&pooled.every(p=>p.passed)&&Object.values(bySubstage).every(g=>g.every(p=>p.passed))&&cost.passed};
    }
    const sources=[...new Set([...Object.keys(old.sourceHashes).filter(p=>!p.startsWith('reports/')&&!p.startsWith('research/')),preregistration,'research/slowed-bar-026.md','bench/src/stages/slowedBar1.ts','bench/src/stages/run026.ts',...producerPaths.map(p=>relative(EXPERIMENT,resolve(root,p)))])];
    const summary={id:runId,kind:'stage-listener',policy:'development-contract-2',preregistration,preregistrationCommit:preregCommit,gitCommit:commit,startedAt,finishedAt:new Date().toISOString(),evaluators:{following:FOLLOWING_EVALUATOR,assessment:ASSESSMENT_EVALUATOR_2,gates:STAGE_GATES},
      set:{id:manifest.id,dir:setDir,sha256,freeze:JSON.parse(readFileSync(join(setDir,'freeze.json'),'utf8'))},regression:{summary:{path:REGRESSION,sha256:sha(oldBytes)},sourceCommit:old.gitCommit,validation,reused:reuse,records:720,assessments:144},delivery:DELIVERY,listeners:[...BASELINES,EVENT_CHAIN_1],results,perListener,sourceHashes:Object.fromEntries(sources.map(p=>[p,sha(readFileSync(resolve(EXPERIMENT,p)))]))};
    writeFileSync(join(publicDir,'summary.json'),JSON.stringify(summary)+'\n');
    artifact('attempt.json',{runId,commit,startedAt,state:'completed',summarySha256:sha(readFileSync(join(publicDir,'summary.json')))});
    console.log(`Completed ${runId}; public bytes ${readFileSync(join(publicDir,'summary.json')).length}`);
  } catch(error) {
    const failure={runId,commit,startedAt,state:'failed',error:String(error),results,perListener};artifact('failure.json',failure);writeFileSync(join(publicDir,'attempt.json'),encode(failure));throw error;
  }
}
