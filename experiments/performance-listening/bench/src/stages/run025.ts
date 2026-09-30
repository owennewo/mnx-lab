/** One committed, pre-registered single-hesitation comparison; private evidence is never overwritten. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Handoff } from '../../../listen/contract.ts';
import { decisionToJSON, positionToJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { ASSESSMENT_EVALUATOR_2, evaluateAssessment2, type AssessmentEvaluation2 } from '../events/assessment2.ts';
import { evaluateFollowing, FOLLOWING_EVALUATOR, type FollowingEvaluation } from '../events/following.ts';
import { assessmentGates, costGates, cursorGates, pooledGates, STAGE_GATES } from '../events/gates.ts';
import type { PerformanceLabel } from '../events/label.ts';
import { readOracle, readOracle2 } from '../events/oracle.ts';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { CANDIDATES } from '../ladder/candidates.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { EventChain1, EVENT_CHAIN_1 } from '../listeners/eventChain1.ts';
import { legacyListener } from '../seam/legacy.ts';
import { executeSeam, seamCausality } from '../seam/runner.ts';
import { BASELINES } from './run023.ts';
import { assetPath } from './stage1v2.ts';
import { HESITATION_SET, readHesitationSet } from './hesitation1.ts';
const DELIVERY={sampleRate:48000,chunkSamples:480};
const SOURCES=[
  'contracts/development-contract-2.md','contracts/event-instruments-2.md','contracts/vocabulary-v2.md',
  'bench/oracle-events/oracle-2.json','bench/oracle-events/audit-2.md','reports/025-single-hesitation.md',
  'research/hesitation-025.md','bench/src/listeners/eventChain1.ts','bench/src/stages/hesitation1.ts','bench/src/stages/run025.ts','bench/src/stages/stage1v3.ts',
  'bench/src/stages/run023.ts','bench/src/stages/stage1v2.ts','bench/src/events/label.ts','bench/src/events/following.ts','bench/src/events/assessment2.ts','bench/src/events/gates.ts',
  'bench/src/seam/runner.ts','bench/src/seam/legacy.ts','bench/src/run/runner.ts','bench/src/ladder/candidates.ts',
  'bench/src/candidates/clockFollower.ts','bench/src/candidates/onlineTimeWarp8.ts','bench/src/candidates/onlineTimeWarp12.ts','bench/src/candidates/onlineTimeWarp14.ts',
  'bench/src/candidates/onlineTimeWarp1.ts','bench/src/candidates/onlineTimeWarp2.ts','bench/src/candidates/onlineTimeWarpConfigurable.ts',
  'listen/contract.ts','listen/json.ts','listen/positions.ts','listen/validate.ts','listen/liveView.ts','listen/backend.ts',
  'bench/src/ladder/render.ts','bench/src/generate/wav.ts','bench/src/stages/stage1.ts','bench/src/ladder/privateSets.ts','bench/src/io.ts',
  'sources/s1-one-bar-c4-f4.mnx.json','sources/s2-two-bar-scale.mnx.json','sources/w2-two-bar-leaps.mnx.json',
];
if(import.meta.url===`file://${process.argv[1]}`) {
  const [setDir,runId,preregistration]=process.argv.slice(2);
  if(!setDir||!runId||!preregistration||!/^g025[a-z]?-[a-z0-9-]+$/.test(runId)) throw new Error('Usage: run025.ts <set-dir> <new-run-id> <preregistration>');
  const git=(...args:string[])=>execFileSync('git',args,{cwd:EXPERIMENT,encoding:'utf8'}).trim();
  if(git('status','--porcelain','--','.')) throw new Error('Commit experiment code before running');
  git('cat-file','-e',`HEAD:experiments/performance-listening/${preregistration}`);
  const preregCommit=git('log','--diff-filter=A','--format=%H','--',preregistration).split('\n').at(-1)!;
  git('merge-base','--is-ancestor',preregCommit,'origin/main');
  const publicDir=resolve(EXPERIMENT,'runs',runId), privateDir=join(requireOutsideGit(setDir),'runs',runId);
  if(existsSync(publicDir)||existsSync(privateDir)) throw new Error('Run ID exists; never overwrite');
  const {manifest,sha256}=readHesitationSet(setDir);
  if(manifest.id!==HESITATION_SET) throw new Error('Run only the pre-registered hesitation set');
  readOracle();readOracle2();
  const g024=JSON.parse(readFileSync(resolve(EXPERIMENT,'runs/g024-event-chain-stage1/summary.json'),'utf8'));
  const commit=git('rev-parse','HEAD'), startedAt=new Date().toISOString();
  mkdirSync(privateDir,{recursive:true}); mkdirSync(publicDir,{recursive:true});
  writeFileSync(join(privateDir,'attempt.json'),encode({runId,commit,startedAt,state:'started'}));
  const results:Record<string,Record<string,unknown>>={}, perListener:Record<string,unknown>={}, causality:Record<string,unknown>={};
  try {
    for(const id of [...BASELINES,EVENT_CHAIN_1]) {
      const perExample:Record<string,unknown>={}, pool:{label:PerformanceLabel;following:FollowingEvaluation|null;assessment:AssessmentEvaluation2|null}[]=[], costs:{sustainedRatio:number;p99Ms:number}[]=[];
      let prefixPassed=true;
      for(const e of manifest.examples) {
        const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure;
        const c=compilePerformance(score);if(!c.ok||c.performance.diagnostics.length) throw new Error('Score does not compile cleanly');
        const handoff:Handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
        const audio=readWav(readFileSync(e.audioPath));if(audio.length!==e.label.audio!.samples) throw new Error('Length differs');
        const candidate=new EventChain1(), entry=CANDIDATES.find(c=>c.id===id);
        const factory=id===EVENT_CHAIN_1 ? ()=>candidate : legacyListener(entry!.factory,entry!.legacy);
        const run=executeSeam(factory,score,handoff,audio,DELIVERY);
        const recordPath=join(privateDir,`${id.replace('@','-')}.${e.id}.json`);
        writeFileSync(recordPath,encode({listener:id,example:e.id,started:run.started,record:run.record.map(decisionToJSON)}));
        const recordHash=sha(readFileSync(recordPath));
        const following=run.started.ok?evaluateFollowing(e.label,run.record):null;
        const report=id===EVENT_CHAIN_1&&run.started.ok?candidate.assessment():null;
        const assessment=report?evaluateAssessment2(e.label,report):null;
        let artifact=null;
        if(report) {
          const path=join(privateDir,`${id.replace('@','-')}.${e.id}.assessment.json`);
          writeFileSync(path,encode({...report,notes:report.notes.map(decisionToJSON),tempo:{...report.tempo,intervals:report.tempo.intervals.map(i=>({...i,from:positionToJSON(i.from),to:positionToJSON(i.to)}))}}));
          artifact={path,sha256:sha(readFileSync(path))};
        }
        const cursor=following?cursorGates(e.label,following):null, assessmentGate=assessmentGates(e.label,assessment);
        pool.push({label:e.label,following,assessment});if(run.cost) costs.push(run.cost);
        const original=g024.results[id][e.id]??null;
        if(original&&recordHash!==original.record.sha256) throw new Error(`${id} ${e.id}: changed regression record`);
        if(original&&e.kind==='performance'&&id===EVENT_CHAIN_1&&artifact?.sha256!==original.assessmentArtifact.sha256) throw new Error(`${e.id}: changed regression assessment`);
        const insertion=manifest.insertions.find(i=>i.id===e.id);
        const pause=insertion?{from:insertion.gapFromSample/48000,to:(insertion.gapFromSample+insertion.gapSamples)/48000,liveChanges:run.record.filter(d=>d.kind!=='note'&&d.madeAt>=insertion.gapFromSample/48000&&d.madeAt<(insertion.gapFromSample+insertion.gapSamples)/48000).length}:null;
        perExample[e.id]={kind:e.kind,control:e.control,tempo:e.tempo,started:run.started,cost:run.cost,following,assessment,
          gates:{cursor,assessment:assessmentGate,passed:(cursor?.passed??false)&&assessmentGate.passed},
          pause,record:{path:recordPath,sha256:recordHash},assessmentArtifact:artifact,g024:original?{identical:true,sha256:original.record.sha256}:null};
        if(id===EVENT_CHAIN_1||['s1-90','s2-90','h-s1-90-1000','h-s2-90-1000','sil-h-s2-90-1000','w2-h-s2-90-1000'].includes(e.id)) {
          const fresh=id===EVENT_CHAIN_1?()=>new EventChain1():legacyListener(entry!.factory,entry!.legacy);
          const checks=run.started.ok?seamCausality(fresh,score,handoff,audio,DELIVERY,run.record):[];
          causality[`${id} ${e.id}`]=checks; if(!checks.length||!checks.every(c=>c.pass)) prefixPassed=false;
        }
        console.log(`${id} ${e.id}: cursor ${cursor?.failed.join(',')||'pass'} assessment ${assessmentGate.failed.join(',')||'pass'}`);
      }
      results[id]=perExample;
      const regressionPool=pool.filter(p=>g024.results[id][p.label.id]), hesitationPool=pool.filter(p=>!g024.results[id][p.label.id]);
      const pooled=pooledGates(pool), bySubstage={regression:pooledGates(regressionPool),hesitation:pooledGates(hesitationPool)}, cost=costGates(prefixPassed,costs);
      perListener[id]={pooled,bySubstage,cost,passed:pool.length===144&&Object.values(perExample).every(v=>(v as {gates:{passed:boolean}}).gates.passed)&&pooled.every(p=>p.passed)&&Object.values(bySubstage).every(g=>g.every(p=>p.passed))&&cost.passed};
    }
    const summary={id:runId,kind:'stage-listener',policy:'development-contract-2',preregistration,preregistrationCommit:preregCommit,gitCommit:commit,startedAt,finishedAt:new Date().toISOString(),
      evaluators:{following:FOLLOWING_EVALUATOR,assessment:ASSESSMENT_EVALUATOR_2,gates:STAGE_GATES,controlApproval:'development-contract-2.md, user 2026-09-30'},
      set:{id:manifest.id,dir:setDir,sha256,freeze:JSON.parse(readFileSync(join(setDir,'freeze.json'),'utf8')),examples:manifest.examples.map(e=>({id:e.id,kind:e.kind,control:e.control,tempo:e.tempo,audioSha256:e.label.audio!.sha256}))},
      delivery:DELIVERY,listeners:[...BASELINES,EVENT_CHAIN_1],results,perListener,causality,
      sourceHashes:Object.fromEntries(SOURCES.map(p=>[p,sha(readFileSync(resolve(EXPERIMENT,p)))]))};
    writeFileSync(join(publicDir,'summary.json'),encode(summary));
    writeFileSync(join(privateDir,'attempt.json'),encode({runId,commit,startedAt,state:'completed',summarySha256:sha(readFileSync(join(publicDir,'summary.json')))}));
  } catch(error) {
    const failure={runId,commit,startedAt,state:'failed',error:String(error),results,perListener,causality};
    writeFileSync(join(privateDir,'failure.json'),encode(failure));writeFileSync(join(publicDir,'attempt.json'),encode(failure));throw error;
  }
}
