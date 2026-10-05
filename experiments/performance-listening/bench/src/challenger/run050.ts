/** 050 quiet-host formal guitar sweep; retained allocation variant and amended baseline scope. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync,existsSync,mkdirSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import {rational} from '../../../../../src/audio/time.ts';
import type {Handoff} from '../../../listen/contract.ts';
import {decisionToJSON,positionToJSON} from '../../../listen/json.ts';
import {partIds,validateRecord} from '../../../listen/validate.ts';
import {topOfScore} from '../../../listen/positions.ts';
import {evaluateFollowing} from '../events/following.ts';
import {evaluateAssessment3,type AssessmentReport3} from '../events/assessment3.ts';
import {assessmentGates2,cursorGates,pooledGates2} from '../events/gates2.ts';
import {readOracle4} from '../events/oracle4.ts';
import {validateLabel} from '../events/label.ts';
import {readWav} from '../generate/wav.ts';
import {assetPath,type StageExample2} from '../stages/stage1v2.ts';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {requireOutsideGit} from '../ladder/privateSets.ts';
import {machine} from '../run/runner.ts';
import {BasicPitchChain2} from './chain2.ts';
import {prefixEqual3} from './streaming3.ts';
import {IncrementalModel041} from './incremental041.ts';
import {IncrementalModel048} from './incremental048.ts';
import {execute047} from './live047.ts';
import {executeComparator043} from './compare043.ts';
import {EventChain3} from '../listeners/eventChain3.ts';
import {CANDIDATES} from '../ladder/candidates.ts';
import {legacyListener} from '../seam/legacy.ts';

type Artifact={path:string;sha256:string};
const DELIVERY={sampleRate:48000,chunkSamples:480},PREREG='reports/050-challenger-optimized-stage.md';
const GUITARS=['tonejs-acoustic','martin','spanish','fender'];
const serialize=(r:AssessmentReport3)=>({...r,notes:r.notes.map(decisionToJSON),tempo:{...r.tempo,intervals:r.tempo.intervals.map(i=>({...i,from:positionToJSON(i.from),to:positionToJSON(i.to)}))}});
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g050a?-challenger-optimized-stage$/.test(runId));
const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit implementation first');
const commit=git('rev-parse','HEAD'),reportPath=`experiments/performance-listening/${PREREG}`;
const prereg=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${reportPath}`),readFileSync(join(EXPERIMENT,PREREG),'utf8').trim());
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID exists');
const sourcePaths=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sourcePaths,'package-lock.json',reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:prereg,sourceHashes,listener:'basic-pitch-chain@5-note-output',offlineListener:'basic-pitch-chain@2',definition:'observation-seam@5',independentAudit:true,stageClaim:true,promotion:false,newVersions:0,suiteMode:'full guitar sweep; baselines clean only; sines retired',delivery:DELIVERY,machine:machine(),heldOutReservedAccesses:0};
const shape=(v:unknown)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert(s.results.path&&s.results.sha256.length===64&&Array.isArray(s.perExample)&&s.groups);return Buffer.byteLength(encode(v));};
shape({...common,results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},groups:{},perExample:[]});
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked=new Map<string,string>();
const verify=(a:Artifact)=>{const p=isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path),b=readFileSync(p);assert.equal(sha256(b),a.sha256,p);checked.set(isAbsolute(a.path)&&p.startsWith(root+'/')?p:relative(EXPERIMENT,p),a.sha256);return b;};
const writeCheck=join(root,'preflight',`${runId}-write-check`);writeFileSync(writeCheck,'050',{flag:'wx'});assert.equal(readFileSync(writeCheck,'utf8'),'050');unlinkSync(writeCheck);
const startedAt=new Date().toISOString(),tick=performance.now(),rows:any[]=[],prefixRows:any[]=[];let model:IncrementalModel048|null=null;
const attempt=artifact('attempt.json',{...common,startedAt,dryAssembly:true});
const hostPath=join(privateDir,'host.jsonl'),hostSamples:any[]=[];let lastSample=0,highLoad=0;
let ownPane:string|null=null,ownSession:string|null=null,hostViolation:string|null=null;
const sampleHost=(force=false)=>{
 const now=performance.now();if(!force&&hostSamples.length&&now-lastSample<20000)return;
 const inventory=JSON.parse(execFileSync('herdr',['agent','list'],{encoding:'utf8',timeout:10000}));
 assert(Array.isArray(inventory.result?.agents),'Missing Herdr inventory');
 const agents=inventory.result.agents.map((a:any)=>({pane:a.pane_id,name:a.name??null,state:a.agent_status,session:a.agent_session?.value??null,cwd:a.cwd}));
 if(ownPane===null){const own=agents.filter((a:any)=>a.state==='working'&&a.name==='dave'&&a.cwd==='/home/williao/dev/mnx-lab');assert.equal(own.length,1,'Cannot identify experimenter pane');ownPane=own[0].pane;ownSession=own[0].session;}
 const mine=agents.find((a:any)=>a.pane===ownPane&&a.session===ownSession);assert(mine,'Experimenter identity lost');
 const load=readFileSync('/proc/loadavg','utf8').trim().split(/\s+/).slice(0,3).map(Number);assert(load.every(Number.isFinite));
 const gap=hostSamples.length?(now-lastSample)/1000:0;
 const competing=agents.filter((a:any)=>a.pane!==ownPane&&a.state==='working');
 highLoad=load[0]>4?highLoad+1:0;
 const reasons=[...(competing.length?['other-agent-working']:[]),...(!hostSamples.length&&load[0]>=2?['start-load-not-below-2']:[]),...(highLoad>=2?['two-consecutive-loads-above-4']:[]),...(gap>30?['sampling-gap-over-30s']:[])];
 const sample={at:new Date().toISOString(),monotonicMs:now,load,gapSeconds:gap,ownPane,ownSession,inheritedPane:process.env.HERDR_PANE_ID??null,agents,reasons};
 appendFileSync(hostPath,JSON.stringify(sample)+'\n');hostSamples.push(sample);lastSample=now;
 if(reasons.length){hostViolation=reasons.join(', ');throw new Error('Quiet-host violation: '+hostViolation);}
};
const hostArtifact=()=>({path:hostPath,sha256:sha256(readFileSync(hostPath))});
try{
 readOracle4();
 const old=(id:string)=>{const path=`runs/${id}/summary.json`,b=readFileSync(join(EXPERIMENT,path)),s=JSON.parse(b.toString());
  for(const [p,h]of Object.entries(s.sourceHashes as Record<string,string>)){
   const tracked=relative(repo,resolve(EXPERIMENT,p));assert.equal(sha256(execFileSync('git',['show',`${s.gitCommit}:${tracked}`],{cwd:repo,maxBuffer:64<<20})),h,`Pinned prior source ${p}`);
   if((/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))&&!/bench\/src\/challenger\/(run|verify|postStats)/.test(p))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Prior producer changed ${p}`);
  }
  return {summary:s,citation:{path,sha256:sha256(b)},results:JSON.parse(verify(s.results).toString())};};
 const prior39=old('g039-challenger-dominant-pitch'),prior41=old('g041a-challenger-incremental-neural'),prior48=old('g048-challenger-output-copies');
 const identity=JSON.parse(verify(prior39.summary.identity).toString());
 assert.equal(sha256(readFileSync(identity.modelPath)),identity.modelSha256);assert.equal(identity.modelSha256,'2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec');
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:'/home/williao/dev/guitar-nn',encoding:'utf8'}).trim(),identity.guitarNNCommit);
 assert.equal(execFileSync('git',['status','--porcelain'],{cwd:'/home/williao/dev/guitar-nn',encoding:'utf8'}).trim(),'');
 assert.equal(sha256(readFileSync('/home/williao/dev/guitar-nn/environments/basic-pitch/requirements.lock')),identity.lockSha256);
 assert.deepEqual(JSON.parse(readFileSync('/home/williao/dev/guitar-nn/benchmarks/basic-pitch/config.json','utf8')),identity.config);
 const runtimeVersions=JSON.parse(execFileSync('/home/williao/dev/guitar-nn/.venv-basic-pitch/bin/python',['-c',"import importlib.metadata as m,sysconfig,json,re;print(json.dumps(dict(sorted((re.sub(r'[-_.]+','-',d.metadata['Name']).lower(),d.version) for d in m.distributions(path=[sysconfig.get_path('purelib')])))))"],{encoding:'utf8'}));assert.deepEqual(runtimeVersions,identity.versions);
 for(const name of ['inference','note_creation','__init__'])assert.equal(sha256(readFileSync(`/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/${name}.py`)),sha256(readFileSync(`/home/williao/dev/guitar-nn/benchmarks/basic-pitch/sources/basic_pitch-${name}.py`)));
 const manifestArtifact={path:join(root,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'},manifest=JSON.parse(verify(manifestArtifact).toString());
 const examples=manifest.examples as StageExample2[];assert.equal(examples.length,576);const offline=new Map<string,any>(),live41=new Map<string,any>();
 for(const e of examples){validateLabel(e.label);verify({path:e.audioPath,sha256:e.label.audio!.sha256});verify({path:assetPath(e.scorePath),sha256:e.label.score.sha256!});
  const old39=JSON.parse(verify(prior39.results[e.id].artifact).toString());assert.equal(old39.inputLabelSha256,sha256(encode(e.label)));verify(old39.observations.masked);const decoded=JSON.parse(verify(old39.observations.decoded).toString());assert.equal(decoded.audioSha256,e.label.audio!.sha256);offline.set(e.id,{old:old39,events:decoded.events});
  const prior=prior48.results.rows.find((r:any)=>r.id===e.id);assert(prior);live41.set(e.id,JSON.parse(verify(prior.artifacts.candidate).toString()));
 }
 const graph=JSON.parse(verify(prior41.summary.graph).toString());verify({path:graph.path,sha256:graph.sha256});assert.equal(graph.sha256,'e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d');
 const auditPaths=['bench/oracle-events/audit-observation-seam-4.md','bench/oracle-events/audit-observation-seam-5.md','bench/oracle-events/implementation-review-041.md'];
 const validation=artifact('validation.json',{manifest:manifestArtifact,verifiedArtifacts:Object.fromEntries(checked),citations:[prior39.citation,prior41.citation,prior48.citation],graph:prior41.summary.graph,identity:prior39.summary.identity,runtimeVersions,audits:auditPaths.map(p=>({path:p,sha256:sha256(readFileSync(join(EXPERIMENT,p)))})),protectedProducerBytesUnchanged:true});
 sampleHost(true);const loadStart=performance.now();model=new IncrementalModel048(graph.path);const sharedLoad=(performance.now()-loadStart)/1000;
 const baselines=CANDIDATES.filter(c=>['clock@1','clock-follower@1','online-time-warp@8','online-time-warp@12','online-time-warp@14'].includes(c.id));assert.equal(baselines.length,4);
 const implementations=[{id:'challenger',factory:null},{id:'incumbent',factory:()=>new EventChain3()},...baselines.map(c=>({id:c.id,factory:legacyListener(c.factory,c.legacy)}))];
 for(const impl of implementations){const directSamples=new Set<string>();console.log(`Starting ${impl.id}: ${impl.id==='challenger'||impl.id==='incumbent'?576:96} examples`);
  for(const e of examples.filter(e=>impl.id==='challenger'||impl.id==='incumbent'||!e.of.includes('-h-'))){
   sampleHost();const guitar=(e.label.provenance.recipe as {sampleSource:string}).sampleSource;assert(GUITARS.includes(guitar));const part=e.of.includes('-h-')?'hesitation':'clean';
   const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
   const handoff:Handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
   const audio=readWav(readFileSync(e.audioPath));assert.equal(audio.length/48000,e.label.duration);
   const execute=(input:Float32Array)=>{sampleHost();const result=impl.factory?executeComparator043(impl.factory,score,handoff,input):execute047(model! as unknown as Pick<IncrementalModel041,'predict'>,score,handoff,input);sampleHost();return result;};
   const run=execute(audio),following=evaluateFollowing(e.label,run.record),cg=cursorGates(e.label,following);
   let report:AssessmentReport3|null=null,reportIdentical:boolean|null=null,liveIdentical:boolean|null=null;
   if(impl.id==='challenger'){
    const chain=new BasicPitchChain2(offline.get(e.id).events);assert(chain.start(score,handoff,DELIVERY).ok);chain.feed(new Float32Array(),e.label.duration);validateRecord(chain.finish().map(d=>({...d,madeAt:e.label.duration})));report=chain.assessment();
    reportIdentical=JSON.stringify(serialize(report))===JSON.stringify(offline.get(e.id).old.report);liveIdentical=prefixEqual3(run.payloads,live41.get(e.id).payloads,audio.length);
   }else if(impl.id==='incumbent')report=(run as ReturnType<typeof executeComparator043>).listener instanceof EventChain3?(run as ReturnType<typeof executeComparator043> & {listener:EventChain3}).listener.assessment():null;
   const assessment=report?evaluateAssessment3(e.label,report):null,ag=assessmentGates2(e.label,assessment);
   const a=artifact(`${impl.id}.${e.id}.json`,{implementation:impl.id,id:e.id,inputLabelSha256:sha256(encode(e.label)),record:run.record.map(decisionToJSON),payloads:run.payloads,calls:run.calls,cost:run.cost,following,cursorGates:cg,report:report?serialize(report):null,assessment,assessmentGates:ag,reportIdentical,liveIdentical,observations:impl.id==='challenger'?offline.get(e.id).old.observations:null});
   const row={implementation:impl.id,id:e.id,guitar,part,kind:e.kind,control:e.control,label:e.label,following,assessment,cursorFailed:cg.failed,assessmentFailed:ag.failed,costRatio:run.cost.ratio,costPass:run.cost.ratio<=.25,reportIdentical,liveIdentical,artifact:a,prefixes:[] as any[]};rows.push(row);
   const cutoff=Math.floor(audio.length*.5/480)*480,future=audio.slice();for(let j=cutoff;j<future.length;j++)future[j]=j%2?.125:-.125;
   const replay=execute(future.subarray(0,cutoff)),pass=prefixEqual3(run.payloads,replay.payloads,cutoff);
   const pa=artifact(`${impl.id}.${e.id}.prefix-bounded.json`,{cutoff,kind:'bounded-alternating',pass,payloads:replay.payloads,calls:replay.calls,cost:replay.cost});row.prefixes.push({pass,artifact:pa});prefixRows.push({implementation:impl.id,id:e.id,pass,artifact:pa});
   const key=`${guitar}:${part}`;
   if(e.kind==='performance'&&!directSamples.has(key)){directSamples.add(key);
    for(const kind of ['zero','alternating']){const changed=audio.slice();for(let j=cutoff;j<changed.length;j++)changed[j]=kind==='zero'?0:j%2?.125:-.125;
     const direct=execute(changed),pass=prefixEqual3(run.payloads,direct.payloads,cutoff),pa=artifact(`${impl.id}.${e.id}.prefix-full-${kind}.json`,{cutoff,kind,pass,payloads:direct.payloads,calls:direct.calls,cost:direct.cost});row.prefixes.push({pass,artifact:pa});prefixRows.push({implementation:impl.id,id:e.id,pass,artifact:pa});
    }
   }
   const done=rows.filter(r=>r.implementation===impl.id);if(done.length%12===0)console.log(encode({implementation:impl.id,completed:done.length,total:impl.id==='challenger'||impl.id==='incumbent'?576:96,cursorPassed:done.filter(r=>!r.cursorFailed.length).length,assessmentPassed:done.filter(r=>!r.assessmentFailed.length).length,costMax:Math.max(...done.map(r=>r.costRatio)),prefixesAgree:done.every(r=>r.prefixes.every((p:any)=>p.pass)),elapsedSeconds:(performance.now()-tick)/1000}));
  }
 }
 await model.close();model=null;sampleHost(true);
 const aggregate=(own:any[])=>{
  const performances=own.filter(r=>r.kind==='performance'),controls=own.filter(r=>r.kind==='control'),sum=(f:(r:any)=>number)=>performances.reduce((s,r)=>s+f(r),0),pools=pooledGates2(own);
  return {examples:own.length,performances:performances.length,controls:controls.length,cursorPassed:own.filter(r=>!r.cursorFailed.length).length,assessmentPassed:own.filter(r=>!r.assessmentFailed.length).length,performanceCursorPassed:performances.filter(r=>!r.cursorFailed.length).length,performanceAssessmentPassed:performances.filter(r=>!r.assessmentFailed.length).length,controlCursorPassed:controls.filter(r=>!r.cursorFailed.length).length,controlAssessmentPassed:controls.filter(r=>!r.assessmentFailed.length).length,costPassed:own.filter(r=>r.costPass).length,maxCost:Math.max(...own.map(r=>r.costRatio)),eventsReached:sum(r=>r.following.byEvent.reached),events:sum(r=>r.following.byEvent.of),maxDelay:Math.max(0,...performances.flatMap(r=>r.following.byEvent.events.flatMap((e:any)=>e.delay===null?[]:[e.delay]))),falseFindings:sum(r=>r.assessment?.falseFindings??0),matchedNotes:sum(r=>r.assessment?.notes.matched.confirmed??0),expectedNotes:sum(r=>r.assessment?.expected.notes.length??0),intervalsWithin:sum(r=>r.assessment?.intervals.within??0),intervalsMatched:sum(r=>r.assessment?.intervals.matched??0),pools,prefixes:own.reduce((s,r)=>s+r.prefixes.length,0),prefixesPass:own.every(r=>r.prefixes.every((p:any)=>p.pass)),allPassed:own.every(r=>!r.cursorFailed.length&&!r.assessmentFailed.length&&r.costPass&&r.prefixes.every((p:any)=>p.pass))&&pools.every(p=>p.passed)};
 };
 const groups:Record<string,ReturnType<typeof aggregate>>={};
 for(const impl of implementations){groups[`${impl.id}:all`]=aggregate(rows.filter(r=>r.implementation===impl.id));for(const g of GUITARS)for(const part of impl.id==='challenger'||impl.id==='incumbent'?['clean','hesitation']:['clean'])groups[`${impl.id}:${g}:${part}`]=aggregate(rows.filter(r=>r.implementation===impl.id&&r.guitar===g&&r.part===part));}
 const challenger=rows.filter(r=>r.implementation==='challenger'),identityPass=challenger.every(r=>r.reportIdentical&&r.liveIdentical),allPrefixes=prefixRows.every(p=>p.pass),incumbentFails=GUITARS.every(g=>['clean','hesitation'].every(p=>!groups[`incumbent:${g}:${p}`]!.allPassed));
 const allPassed=groups['challenger:all']!.allPassed&&GUITARS.every(g=>['clean','hesitation'].every(p=>groups[`challenger:${g}:${p}`]!.allPassed)),decision=allPassed&&identityPass&&allPrefixes&&incumbentFails?'D1':'D2';
 const results=artifact('results.json',{rows,prefixes:prefixRows,groups});
 const summary={...common,status:'measured',decision,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000,attempt,validation,host:hostArtifact(),hostChecks:{samples:hostSamples.length,maxGapSeconds:Math.max(...hostSamples.map(s=>s.gapSeconds)),maxLoad1:Math.max(...hostSamples.map(s=>s.load[0])),valid:true,ownPane,ownSession},sharedLoad,graph:prior41.summary.graph,results,groups,criterion:{challengerPass:allPassed,identityPass,allPrefixes,incumbentFails},counts:{examples:examples.length,measurements:rows.length,prefixes:prefixRows.length,prefixesAgree:prefixRows.filter(p=>p.pass).length,livePayloadsIdentical:challenger.filter(r=>r.liveIdentical).length,offlineReportsIdentical:challenger.filter(r=>r.reportIdentical).length,verifiedArtifacts:checked.size},perExample:examples.map(e=>[e.id,...implementations.map(impl=>{const r=rows.find(r=>r.implementation===impl.id&&r.id===e.id);return r?[r.cursorFailed,r.assessmentFailed,r.costRatio]:null;})]),stopping:{main:0,challenger:decision==='D1'?0:2,mainVersions:3,mainComparisons:11,challengerVersions:5,challengerComparisons:10,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};
 const bytes=shape(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});artifact('completed.json',{summarySha256:sha256(readFileSync(join(publicDir,'summary.json'))),publicBytes:bytes,exceedsSizeTarget:bytes>300000});console.log(encode({decision,counts:summary.counts,criterion:summary.criterion,bytes,elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completedMeasurements:rows.length});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:hostViolation?'D3-host-void':'D3-infrastructure',hostViolation,host:existsSync(hostPath)?hostArtifact():null,startedAt,finishedAt:new Date().toISOString(),attempt,failure,completedExamples:rows.map(r=>({implementation:r.implementation,id:r.id,artifact:r.artifact,prefixes:r.prefixes})),prefixes:prefixRows}),{flag:'wx'});throw error;}
finally{if(model)await model.close();}
