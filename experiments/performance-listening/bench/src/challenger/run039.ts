/** 039 complete frozen development-guitar assessment comparison, no live claim. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { decisionToJSON, positionToJSON } from '../../../listen/json.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds, validateRecord } from '../../../listen/validate.ts';
import { evaluateAssessment3, type AssessmentReport3, type AssessmentEvaluation3 } from '../events/assessment3.ts';
import { assessmentGates2, pooledGates2 } from '../events/gates2.ts';
import { readOracle4 } from '../events/oracle4.ts';
import { validateLabel } from '../events/label.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { assetPath, type StageExample2 } from '../stages/stage1v2.ts';
import type { ObservationEvent } from './chain.ts';
import { BasicPitchChain2, BASIC_PITCH_CHAIN_2, DOMINANT_PITCH_POLICY } from './chain2.ts';
type Artifact = {path:string;sha256:string};
type OldRecord = {observations:{raw:Artifact;decoded:Artifact};report:object;assessment:AssessmentEvaluation3;gates:{failed:string[]}};
type Row = {id:string;guitar:string;part:string;kind:string;control:string|null;label:StageExample2['label'];following:null;assessment:AssessmentEvaluation3;
  failed:string[];oldFailed:string[];matched:number;oldMatched:number;reportIdentical:boolean;artifact:Artifact};
const serialize=(r:AssessmentReport3)=>({...r,notes:r.notes.map(decisionToJSON),tempo:{...r.tempo,intervals:r.tempo.intervals.map(i=>({...i,from:positionToJSON(i.from),to:positionToJSON(i.to)}))}});
const PYTHON='/home/williao/dev/guitar-nn/.venv-basic-pitch/bin/python';
const PREREG='reports/039-challenger-dominant-pitch.md';
const GUITARS=['tonejs-acoustic','martin','spanish','fender'];
function aggregate(rows:Row[]) {
  const perf=rows.filter(r=>r.kind==='performance'),sum=(f:(r:Row)=>number)=>perf.reduce((s,r)=>s+f(r),0);
  const pools=pooledGates2(rows).filter(g=>!['recovery','extrasHeld'].includes(g.gate));
  return {examples:rows.length,performancePassed:perf.filter(r=>!r.failed.length).length,performances:perf.length,
    wrongPassed:rows.filter(r=>r.control==='wrong-score'&&!r.failed.length).length,wrong:rows.filter(r=>r.control==='wrong-score').length,
    noisePassed:rows.filter(r=>r.control==='silence'&&!r.failed.length).length,noise:rows.filter(r=>r.control==='silence').length,
    oldPassed:rows.filter(r=>!r.oldFailed.length).length,passed:rows.filter(r=>!r.failed.length).length,
    repaired:rows.filter(r=>r.oldFailed.length&&!r.failed.length).length,regressed:rows.filter(r=>!r.oldFailed.length&&r.failed.length).length,
    matchedNotes:sum(r=>r.matched),expectedNotes:sum(r=>r.assessment.expected.notes.length),falseFindings:sum(r=>r.assessment.falseFindings),
    intervals:{within:sum(r=>r.assessment.intervals.within),matched:sum(r=>r.assessment.intervals.matched),unreported:sum(r=>r.assessment.intervals.unreported),maxError:Math.max(0,...perf.flatMap(r=>r.assessment.intervals.errors.map(e=>Math.abs(e.seconds))))},
    reportIdentical:rows.filter(r=>r.reportIdentical).length,pools,allPassed:rows.every(r=>!r.failed.length)&&pools.every(g=>g.passed)};
}
if(import.meta.url===`file://${process.argv[1]}`) {
  const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g039a?-challenger-dominant-pitch$/.test(runId));
  const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
  assert.equal(git('status','--porcelain'),'','Commit all code before measuring');
  const reportPath=`experiments/performance-listening/${PREREG}`,preregCommit=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
  git('merge-base','--is-ancestor',preregCommit,'origin/main');assert(readFileSync(join(EXPERIMENT,PREREG),'utf8').startsWith(git('show',`${preregCommit}:${reportPath}`)));
  const commit=git('rev-parse','HEAD');assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
  const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);
  assert(!existsSync(privateDir)&&!existsSync(publicDir),'Never overwrite a run');mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
  const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha(readFileSync(path))};};
  const checked=new Map<string,string>();
  const verify=(a:Artifact)=>{const path=isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path);if(checked.has(path)){assert.equal(checked.get(path),a.sha256);return readFileSync(path);}const bytes=readFileSync(path);assert.equal(sha(bytes),a.sha256,path);checked.set(path,a.sha256);return bytes;};
  const startedAt=new Date().toISOString(),tick=performance.now(),completed:Artifact[]=[];
  const sources=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
  const sourceHashes=Object.fromEntries([...sources,reportPath,'package-lock.json','experiments/performance-listening/research/dominant-pitch-039.md'].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha(readFileSync(resolve(repo,p)))]));
  const common={id:runId,kind:'offline-decoder-repair',modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,sourceHashes,preregistration:PREREG,preregistrationCommit:preregCommit,startedAt,
    listener:BASIC_PITCH_CHAIN_2,policy:DOMINANT_PITCH_POLICY,evaluators:{assessment:'assessment-evaluator@3',gates:'stage-gates@2',oracle:'event-oracle@4'},stageClaim:false,promotion:false,liveVerdict:'not measured; seam-3 producer and audit remain prerequisite',newVersions:1};
  const rows:Row[]=[];
  const checkSummary=(v:object)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert.equal(s.gitCommit,commit);assert(s.groups&&Array.isArray(s.perExample));for(const k of ['results','validation'])assert(s[k].path&&/^[a-f0-9]{64}$/.test(s[k].sha256));return Buffer.byteLength(encode(v));};
  try {
    readOracle4();
    const prior=[['g035-challenger-basic-pitch','6c63aaf66aa3e830167d40bcab3bec76b952469e36e714db179b38c96feecd2f'],['g036-incumbent-guitar',null],['g038-challenger-quiet-noise','72560e5e4365e14ee48034c2eabc662323e121de1dcf70d4e3fcd02ca44d57c4']].map(([id,expected])=>{
      const path=join(EXPERIMENT,'runs',id!,'summary.json'),bytes=readFileSync(path);if(expected)assert.equal(sha(bytes),expected);const summary=JSON.parse(bytes.toString());
      for(const [p,hash]of Object.entries(summary.sourceHashes as Record<string,string>))if(/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))assert.equal(sha(readFileSync(resolve(EXPERIMENT,p))),hash,`Reused producer changed ${p}`);
      return {summary,citation:{path:relative(EXPERIMENT,path),sha256:sha(bytes)},results:JSON.parse(verify(summary.results).toString())};
    });
    const old35=prior[0]!,old36=prior[1]!,old38=prior[2]!;
    const identity=JSON.parse(verify(old35.summary.identity).toString());assert.deepEqual(JSON.parse(verify(old38.summary.identity).toString()),identity);
    assert.equal(gitExternal('rev-parse','HEAD'),identity.guitarNNCommit);assert.equal(gitExternal('status','--porcelain'),'');
    assert.equal(sha(readFileSync(identity.modelPath)),identity.modelSha256);assert.equal(sha(readFileSync('/home/williao/dev/guitar-nn/environments/basic-pitch/requirements.lock')),identity.lockSha256);
    assert.deepEqual(JSON.parse(readFileSync('/home/williao/dev/guitar-nn/benchmarks/basic-pitch/config.json','utf8')),identity.config);
    const originalPath=join(root,'contract2-challenger-guitar-v1/manifest.json'),originalBytes=readFileSync(originalPath);assert.equal(sha(originalBytes),'7c0537d08b57333b3df4c9ac82cc4f26678dcaebbf48ac72d3a72e2dca502055');
    const original=JSON.parse(originalBytes.toString()) as {examples:StageExample2[];assets:Record<string,string>};
    for(const [p,hash]of Object.entries(original.assets))verify({path:assetPath(p),sha256:hash});
    const manifestBytes=verify(old38.summary.set),manifest=JSON.parse(manifestBytes.toString()) as {examples:StageExample2[]};assert.equal(manifest.examples.length,576);
    const noise=new Map((old38.results as {id:string;artifact:Artifact}[]).map(r=>[r.id,r]));
    const records=new Map<string,OldRecord>(),inputs=new Map<string,{audioSha256:string;duration:number;raw:Artifact;decoded:Artifact}>();
    for(const e of manifest.examples){
      validateLabel(e.label);assert(e.label.score.sha256);verify({path:e.audioPath,sha256:e.label.audio!.sha256});verify({path:assetPath(e.scorePath),sha256:e.label.score.sha256});
      let record:OldRecord;
      if(e.control==='silence') {
        const a=JSON.parse(verify(noise.get(e.id)!.artifact).toString());const first=manifest.examples.find(x=>x.id===a.example)!;assert(first);assert.equal(a.labelSha256,sha(encode(first.label)));for(const key of ['duration','score','handoff','events','performance','cursor'] as const)assert.deepEqual(e.label[key],first.label[key]);record={observations:a.observations,report:a.challenger.report,assessment:a.challenger.assessment,gates:a.challenger.assessmentGates};
      } else {
        assert.deepEqual(e,original.examples.find(p=>p.id===e.id));
        const a=JSON.parse(verify(old35.results[e.id].artifact).toString());assert.equal(a.inputLabelSha256,sha(encode(e.label)));record=a;
        verify(old36.results[e.id].artifact);
      }
      verify(record.observations.raw);const decoded=JSON.parse(verify(record.observations.decoded).toString());assert.equal(decoded.audioSha256,e.label.audio!.sha256);
      const input={audioSha256:e.label.audio!.sha256,duration:e.label.duration,...record.observations};const existing=inputs.get(input.audioSha256);if(existing)assert.deepEqual(existing,input);else inputs.set(input.audioSha256,input);
      records.set(e.id,record);
    }
    const validation=artifact('validation.json',{set:old38.summary.set,parent:{path:originalPath,sha256:sha(originalBytes)},citations:prior.map(p=>p.citation),identity:old35.summary.identity,verifiedArtifacts:Object.fromEntries(checked),reuse:'raw maps and unchanged prior assessments only; no changed decoder result reused',protectedSourcesUnchanged:true});
    artifact('dry-assembly.json',{beforeDecoding:true,bytes:checkSummary({...common,validation,results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},groups:{},perExample:[]})});
    const request=artifact('decode-request.json',{out:join(privateDir,'observations'),identity,audio:[...inputs.values()]});
    console.log(`New decoding on ${inputs.size} raw maps; all 576 assessments`);
    execFileSync(PYTHON,[join(EXPERIMENT,'bench/src/challenger/dominantPitch.py'),request.path],{stdio:'inherit'});
    const indexPath=join(privateDir,'observations/index.json'),index=JSON.parse(readFileSync(indexPath,'utf8')) as Record<string,{masked:Artifact;decoded:Artifact}>;
    const diagnostics=[];
    for(const [hash,obs]of Object.entries(index)){verify(obs.masked);const decoded=JSON.parse(verify(obs.decoded).toString());assert.equal(hash,decoded.audioSha256);diagnostics.push({audioSha256:hash,oldEvents:decoded.oldEvents,newEvents:decoded.newEvents,oldG2:decoded.oldG2,newG2:decoded.newG2,oldPitches:decoded.oldPitches,newPitches:decoded.newPitches,decodeSeconds:decoded.decodeSeconds});}
    for(const e of manifest.examples){
      const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,compiled=compilePerformance(score);assert(compiled.ok);
      const handoff={from:topOfScore(compiled.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
      const observations=index[e.label.audio!.sha256]!,decoded=JSON.parse(readFileSync(observations.decoded.path,'utf8')) as {events:ObservationEvent[]};
      const chain=new BasicPitchChain2(decoded.events);assert(chain.start(score,handoff,{sampleRate:48000,chunkSamples:480}).ok);chain.feed(new Float32Array(),e.label.duration);
      validateRecord(chain.finish().map(d=>({...d,madeAt:e.label.duration})));const report=chain.assessment(),assessment=evaluateAssessment3(e.label,report),gates=assessmentGates2(e.label,assessment),old=records.get(e.id)!;
      const serialized=serialize(report),reportIdentical=JSON.stringify(serialized)===JSON.stringify(old.report);
      const a=artifact(`${e.id}.assessment.json`,{example:e.id,inputLabelSha256:sha(encode(e.label)),observations,report:serialized,assessment,gates,oldGates:old.gates,reportIdentical});completed.push(a);
      const matched=report.notes.filter(n=>n.kind==='note'&&n.verdict==='match').length,oldMatched=(old.report as {notes:{kind:string;verdict:string}[]}).notes.filter(n=>n.kind==='note'&&n.verdict==='match').length;
      rows.push({id:e.id,guitar:(e.label.provenance.recipe as {sampleSource:string}).sampleSource,part:e.of.includes('-h-')?'hesitation':'clean',kind:e.kind,control:e.control,label:e.label,following:null,assessment,failed:gates.failed,oldFailed:old.gates.failed,matched,oldMatched,reportIdentical,artifact:a});
      if(rows.length%96===0)console.log(`assessed ${rows.length}/576`);
    }
    const groups=Object.fromEntries([['all',aggregate(rows)],...GUITARS.flatMap(g=>['clean','hesitation'].map(p=>[`${g}:${p}`,aggregate(rows.filter(r=>r.guitar===g&&r.part===p))]))]);
    const all=aggregate(rows),decision=all.allPassed?'D1':'D2',results=artifact('results.json',Object.fromEntries(rows.map(r=>[r.id,{artifact:r.artifact,failed:r.failed,oldFailed:r.oldFailed}]))),details=artifact('details.json',{diagnostics,groups,formerMartinFailures:rows.filter(r=>r.guitar==='martin'&&r.oldFailed.length).map(r=>({id:r.id,failed:r.failed,matched:r.matched})),changedReports:rows.filter(r=>!r.reportIdentical).map(r=>r.id)});
    const summary={...common,status:'measured',decision,validation,results,details,set:old38.summary.set,citations:prior.map(p=>p.citation),identity:old35.summary.identity,groups,
      observationIndex:{path:indexPath,sha256:sha(readFileSync(indexPath))},uniqueAudio:inputs.size,verifiedArtifacts:checked.size,
      perExample:rows.map(r=>[r.id,r.oldFailed,r.failed,r.matched,r.reportIdentical]),finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000};
    const bytes=checkSummary(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});artifact('completed.json',{publicBytes:bytes,exceedsSizeTarget:bytes>300000,summarySha256:sha(readFileSync(join(publicDir,'summary.json')))});
    console.log(encode({decision,groups,uniqueAudio:inputs.size,publicBytes:bytes,elapsedSeconds:summary.elapsedSeconds}));
  }catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completed});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'infrastructure-failed',failure,completed,finishedAt:new Date().toISOString()}),{flag:'wx'});throw error;}
}
function gitExternal(...args:string[]){return execFileSync('git',args,{cwd:'/home/williao/dev/guitar-nn',encoding:'utf8'}).trim();}
