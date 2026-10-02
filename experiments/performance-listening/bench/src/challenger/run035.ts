/** Committed, source-tagged full-set challenger exploration. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import {rational} from '../../../../../src/audio/time.ts';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import {decisionToJSON,positionToJSON} from '../../../listen/json.ts';
import {topOfScore} from '../../../listen/positions.ts';
import {partIds,validateRecord} from '../../../listen/validate.ts';
import {evaluateAssessment3,type AssessmentReport3,type AssessmentEvaluation3} from '../events/assessment3.ts';
import {assessmentGates2,pooledGates2,cursorGates,costGates} from '../events/gates2.ts';
import {evaluateFollowing,type FollowingEvaluation} from '../events/following.ts';
import {validateLabel} from '../events/label.ts';
import {readOracle4} from '../events/oracle4.ts';
import {readWav} from '../generate/wav.ts';
import {encode,EXPERIMENT} from '../io.ts';
import {sha,requireOutsideGit} from '../ladder/privateSets.ts';
import {assetPath,type StageExample2} from '../stages/stage1v2.ts';
import {executeSeam,seamCausality} from '../seam/runner.ts';
import {BasicPitchChain,type ObservationEvent} from './chain.ts';
import {BasicPitchLive} from './live.ts';
import {NativeModel} from './native.ts';
import {freezeGuitars,GUITAR_SET} from './guitars.ts';

type Artifact={path:string;sha256:string};
type Row={example:StageExample2;label:StageExample2['label'];assessment:AssessmentEvaluation3|null;following:FollowingEvaluation|null;failed:string[];artifact:Artifact};
const PYTHON='/home/williao/dev/guitar-nn/.venv-basic-pitch/bin/python', MODEL='/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx';
const MODEL_HASH='2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec';
const DELIVERY={sampleRate:48000,chunkSamples:480};
const serialize=(r:AssessmentReport3)=>({...r,notes:r.notes.map(decisionToJSON),tempo:{...r.tempo,intervals:r.tempo.intervals.map(i=>({...i,from:positionToJSON(i.from),to:positionToJSON(i.to)}))}});
function aggregate(rows:Row[]) {
 const perf=rows.filter(r=>r.example.kind==='performance'),pool=pooledGates2(rows).filter(g=>!['recovery','extrasHeld'].includes(g.gate));
 const sum=(f:(r:Row)=>number)=>perf.reduce((s,r)=>s+f(r),0);
 return {examples:rows.length,performances:perf.length,controls:rows.length-perf.length,passed:rows.filter(r=>!r.failed.length).length,
   performancePassed:perf.filter(r=>!r.failed.length).length,controlPassed:rows.filter(r=>r.example.kind==='control'&&!r.failed.length).length,
   falseFindings:sum(r=>r.assessment?.falseFindings??0),notes:sum(r=>r.assessment?.expected.notes.length??0),
   falseMissing:sum(r=>r.assessment?.notes.missing.falseAlarms??0),missingFound:sum(r=>r.assessment?.notes.missing.detected??0),missingOf:sum(r=>r.assessment?.notes.missing.positives??0),
   intervals:{within:sum(r=>r.assessment?.intervals.within??0),matched:sum(r=>r.assessment?.intervals.matched??0),unreported:sum(r=>r.assessment?.intervals.unreported??0),maxError:Math.max(0,...perf.flatMap(r=>r.assessment?.intervals.errors.map(e=>Math.abs(e.seconds))??[]))},
   failureKinds:Object.fromEntries([...new Set(rows.flatMap(r=>r.failed))].map(k=>[k,rows.filter(r=>r.failed.includes(k)).length])),pool,
   allPassed:rows.length>0&&rows.every(r=>!r.failed.length)&&pool.every(g=>g.passed)};
}
if(import.meta.url===`file://${process.argv[1]}`) {
 const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g035[a]?\-challenger-basic-pitch$/.test(runId));
 const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
 assert.equal(git('status','--porcelain'),'','Commit all code first');
 const commit=git('rev-parse','HEAD'),preregPath='experiments/performance-listening/reports/035-challenger-basic-pitch.md';
 const preregCommit=git('log','--diff-filter=A','--format=%H','--',preregPath).split('\n').at(-1)!;
 git('merge-base','--is-ancestor',preregCommit,'origin/main');assert(readFileSync(resolve(repo,preregPath),'utf8').startsWith(git('show',`${preregCommit}:${preregPath}`)));
 assert.equal(git('rev-parse',`${runId}-source`),commit);assert.equal(sha(readFileSync(MODEL)),MODEL_HASH);
 const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);
 assert(!existsSync(privateDir)&&!existsSync(publicDir),'Never overwrite a run');mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
 const artifact=(name:string,v:unknown):Artifact=>{const path=join(privateDir,name);assert(!existsSync(path));writeFileSync(path,encode(v));return {path,sha256:sha(readFileSync(path))};};
 const binary=(name:string,v:Float32Array):Artifact=>{const path=join(privateDir,name);assert(!existsSync(path));writeFileSync(path,Buffer.from(v.buffer,v.byteOffset,v.byteLength));return {path,sha256:sha(readFileSync(path))};};
 const verify=(a:Artifact)=>{const bytes=readFileSync(isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path));assert.equal(sha(bytes),a.sha256,a.path);return bytes;};
 const startedAt=new Date().toISOString(),start=performance.now();
 const paths=git('ls-files','--','src/audio','src/model','experiments/performance-listening').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p)&&!p.includes('/runs/')&&!p.includes('/archive/')&&!p.includes('/reports/'));
 const sourceHashes=Object.fromEntries([...paths,'package-lock.json','experiments/performance-listening/bench/package.json',preregPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha(readFileSync(resolve(repo,p)))]));
 const common={id:runId,kind:'challenger-exploration',modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:preregCommit,preregistration:'reports/035-challenger-basic-pitch.md',startedAt,sourceHashes,modelSha256:MODEL_HASH,delivery:DELIVERY,evaluators:{following:'following-evaluator@2',assessment:'assessment-evaluator@3',gates:'stage-gates@2',oracle:'event-oracle@4'},liveVerdict:'exploratory; seam audit pending',promotion:false};
 const rows:Row[]=[],liveRows:object[]=[];let native:NativeModel|null=null;
 const checkSummary=(v:object)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert(s.results.path&&s.results.sha256&&s.groups&&s.perExample);return Buffer.byteLength(encode(v));};
 try {
  readOracle4();
  const sets=['contract2-stage1-v3','contract2-hesitation-v1','contract2-slowed-bar-v1','contract2-four-bar-tempo-v1','contract2-held-note-hesitation-v1','contract2-rushed-bar-v1','contract2-missing-event-v1'];
  const union=new Map<string,StageExample2>(),setHashes:object[]=[];
  for(const id of sets){const dir=join(root,id),bytes=readFileSync(join(dir,'manifest.json'));assert.equal(sha(bytes),JSON.parse(readFileSync(join(dir,'freeze.json'),'utf8')).sha256);
    const m=JSON.parse(bytes.toString());setHashes.push({id,path:join(dir,'manifest.json'),sha256:sha(bytes)});
    for(const [path,hash]of Object.entries(m.assets as Record<string,string>))assert.equal(sha(readFileSync(assetPath(path))),hash,path);
    for(const e of m.examples as StageExample2[]){validateLabel(e.label);if(union.has(e.id))assert.deepEqual(e,union.get(e.id));else union.set(e.id,e);}
  }assert.equal(union.size,1164);
  // Reuse every existing sweep record only with unchanged musical producers and inputs.
  const oldPath=join(EXPERIMENT,'runs/g034-missing-event-sweep/summary.json'),oldBytes=readFileSync(oldPath),old=JSON.parse(oldBytes.toString());
  let producerChecks=0;
  for(const [path,hash]of Object.entries(old.sourceHashes as Record<string,string>))if(path.endsWith('.ts')){assert.equal(sha(readFileSync(resolve(EXPERIMENT,path))),hash,`Changed prior producer ${path}`);producerChecks++;}
  const checked=new Set<string>();
  const verifyReferences=(v:unknown):void=>{
    if(!v||typeof v!=='object')return;
    if('path'in v&&'sha256'in v&&typeof v.path==='string'&&typeof v.sha256==='string'){
      const a=v as Artifact;if((isAbsolute(a.path)||a.path.startsWith('runs/')||a.path.startsWith('archive/'))&&!checked.has(a.path)){const b=verify(a);checked.add(a.path);if(a.path.endsWith('.json'))verifyReferences(JSON.parse(b.toString()));}
    }
    for(const x of Object.values(v))verifyReferences(x);
  };
  verifyReferences(old);const oldResults=JSON.parse(verify(old.results).toString());assert.deepEqual(Object.keys(oldResults).sort(),[...union.keys()].sort());
  const reuse=artifact('sweep-reuse.json',{summary:{path:oldPath,sha256:sha(oldBytes)},producerChecks,checkedArtifacts:checked.size,sets:setHashes,incumbent:old.groups,baselines:old.baselines,unchanged:true});
  const parents=JSON.parse(readFileSync(join(root,'contract2-hesitation-v1/manifest.json'),'utf8')).examples as StageExample2[];
  const guitars=freezeGuitars(root,repo,parents);const guitarManifest={path:join(root,GUITAR_SET,'manifest.json'),sha256:sha(readFileSync(join(root,GUITAR_SET,'manifest.json')))};
  const examples=[...guitars.examples,...union.values()];assert.equal(examples.length,1740);
  const dry={...common,results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},groups:{dry:true},perExample:examples.map(e=>[e.id,[]]),status:'dry'};
  artifact('dry-assembly.json',{checkedBeforeMeasuring:true,bytes:checkSummary(dry)});
  const unique=new Map<string,{path:string;sha256:string;duration:number}>();for(const e of examples){const hash=e.label.audio!.sha256;assert.equal(sha(readFileSync(e.audioPath)),hash);unique.set(hash,{path:e.audioPath,sha256:hash,duration:e.label.duration});}
  const request=artifact('observation-request.json',{out:join(privateDir,'observations'),audio:[...unique.values()]});
  console.log(`Offline inference on ${unique.size} unique audio hashes; ${examples.length} assessments`);
  execFileSync(PYTHON,[join(EXPERIMENT,'bench/src/challenger/observations.py'),request.path],{stdio:'inherit',maxBuffer:64<<20});
  const observationIndex=JSON.parse(readFileSync(join(privateDir,'observations/index.json'),'utf8')) as Record<string,{raw:Artifact;decoded:Artifact}>;
  const identity={path:join(privateDir,'observations/identity.json'),sha256:sha(readFileSync(join(privateDir,'observations/identity.json')))};
  for(const e of examples) {
    const obs=observationIndex[e.label.audio!.sha256]!;assert(obs);verify(obs.raw);const decoded=JSON.parse(verify(obs.decoded).toString());
    const events=decoded.events as ObservationEvent[],score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
    const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
    const candidate=new BasicPitchChain(events);assert(candidate.start(score,handoff,DELIVERY).ok);candidate.feed(new Float32Array(),e.label.duration);
    const notes=candidate.finish().map(d=>({...d,madeAt:e.label.duration}));validateRecord(notes);const report=candidate.assessment(),assessment=evaluateAssessment3(e.label,report),gates=assessmentGates2(e.label,assessment);
    const a=artifact(`${e.id}.assessment.json`,{example:e.id,inputLabelSha256:sha(encode(e.label)),observations:obs,report:serialize(report),assessment,gates});
    rows.push({example:e,label:e.label,assessment,following:null,failed:gates.failed,artifact:a});
    if(rows.length%200===0)console.log(`assessment ${rows.length}/${examples.length}`);
  }
  const results=artifact('results.json',Object.fromEntries(rows.map(r=>[r.example.id,{artifact:r.artifact,failed:r.failed}])));
  const groups:Record<string,ReturnType<typeof aggregate>>={sine:aggregate(rows.filter(r=>union.has(r.example.id)))};
  for(const id of ['tonejs-acoustic','martin','spanish','fender']){
    const own=rows.filter(r=>r.example.id.startsWith(`${id}-`));groups[`${id}:clean`]=aggregate(own.filter(r=>!r.example.of.startsWith(`${id}-h-`)));groups[`${id}:hesitation`]=aggregate(own.filter(r=>r.example.of.startsWith(`${id}-h-`)));}
  const passedGuitars=Object.keys(groups).filter(k=>k.endsWith(':clean')&&groups[k]!.allPassed);
  artifact('assessment-groups.json',groups);
  // Independent exact stimulus-token diagnostic isolates the front end from the unchanged assessment chain.
  const ideal:object[]=[];
  for(const e of guitars.examples.filter(e=>e.kind==='performance'&&!e.of.includes('-h-'))){
    const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
    const tokens=e.label.performance.events.flatMap(p=>p.notes.map(n=>({midi:e.label.events[p.index]!.notes.find(x=>x.noteKey===n.noteKey)!.midi,onset:n.onset!,end:n.end!,availableAt:e.label.duration,confidence:1})));
    const chain=new BasicPitchChain(tokens);assert(chain.start(score,{from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1},DELIVERY).ok);chain.feed(new Float32Array(),e.label.duration);chain.finish();
    const evaluation=evaluateAssessment3(e.label,chain.assessment());ideal.push({id:e.id,privilegedInput:true,gates:assessmentGates2(e.label,evaluation)});
  }
  const diagnostic=artifact('ideal-front-end-diagnostic.json',ideal);
  const loadStart=performance.now();native=new NativeModel(MODEL);const loadMs=performance.now()-loadStart;
  const liveExamples=guitars.examples.filter(e=>!e.of.includes('-h-'));assert.equal(liveExamples.length,96);
  const tensors:object[]=[],tensorHashes=new Set<string>();
  for(const edge of [0,15] as const)for(const e of liveExamples){
    const audio=readWav(readFileSync(e.audioPath)),score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
    const handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
    const listener=new BasicPitchLive(native,edge),run=executeLive(listener,score,handoff,audio),following=evaluateFollowing(e.label,run.record),gates=cursorGates(e.label,following);
    const causality=seamCausality(()=>new BasicPitchLive(native!,edge),score,handoff,audio,DELIVERY,run.record),cost=costGates(causality.every(c=>c.pass),run.cost?[run.cost]:[]);
    const a=artifact(`${e.id}.edge${edge}.live.json`,{example:e.id,edge,record:run.record.map(decisionToJSON),following,gates,cost:run.cost,costGates:cost,causality,frames:listener.frames});
    liveRows.push({id:e.id,edge,kind:e.kind,gates:gates.failed,costGates:cost.failed,cost:run.cost,prefixes:causality.length,prefixesPass:causality.every(c=>c.pass),reached:following.byEvent.reached,of:following.byEvent.of,maxDelay:Math.max(0,...following.byEvent.events.flatMap(x=>x.delay===null?[]:[x.delay])),artifact:a});
    if(edge===0&&listener.parity&&!tensorHashes.has(e.label.audio!.sha256)) {
      tensorHashes.add(e.label.audio!.sha256);const p=listener.parity;
      tensors.push({id:e.id,input:binary(`${e.id}.input.f32`,p.input),note:binary(`${e.id}.note.f32`,p.maps.note),onset:binary(`${e.id}.onset.f32`,p.maps.onset),contour:binary(`${e.id}.contour.f32`,p.maps.contour)});
    }
    if(liveRows.length%12===0)console.log(`live ${liveRows.length}/192`);
  }
  await native.close();native=null;
  const parityRequest=artifact('parity-request.json',{model:MODEL,tensors,out:join(privateDir,'parity.json')});
  execFileSync(PYTHON,[join(EXPERIMENT,'bench/src/challenger/parity.py'),parityRequest.path],{stdio:'inherit'});
  const parity={path:join(privateDir,'parity.json'),sha256:sha(readFileSync(join(privateDir,'parity.json')))};
  const live=artifact('live-results.json',liveRows);
  const decision=passedGuitars.length>=3?'D1':'D3'; // D2 requires a specific repair justified in report, not an automatic oracle shortcut.
  const summary={...common,status:'measured',decision,results,groups,passedGuitars,perExample:rows.map(r=>[r.example.id,r.failed]),
    live,parity,identity,diagnostic,reuse,guitarManifest,sets:setHashes,uniqueAudio:unique.size,nativeLoadMs:loadMs,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-start)/1000};
  const bytes=checkSummary(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary));artifact('completed.json',{publicBytes:bytes,exceedsSizeTarget:bytes>300000,summarySha256:sha(readFileSync(join(publicDir,'summary.json')))});
  console.log(encode({decision,passedGuitars,groups,publicBytes:bytes,elapsedSeconds:summary.elapsedSeconds}));
 }catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,measuredAssessments:rows.length,measuredLive:liveRows.length});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'infrastructure-failed',failure,completedAssessments:rows.map(r=>r.artifact),completedLive:liveRows,finishedAt:new Date().toISOString()}));throw error;}
 finally{if(native)await native.close();}
}
function executeLive(listener:BasicPitchLive,score:MnxStructure,handoff:Parameters<typeof executeSeam>[2],audio:Float32Array){return executeSeam(()=>listener,score,handoff,audio,DELIVERY);}
