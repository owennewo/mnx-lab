/** 047 complete storage/allocation and native payload comparison; no formal claim. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import {rational} from '../../../../../src/audio/time.ts';
import type {Handoff} from '../../../listen/contract.ts';
import {decisionToJSON} from '../../../listen/json.ts';
import {partIds} from '../../../listen/validate.ts';
import {topOfScore} from '../../../listen/positions.ts';
import {evaluateFollowing} from '../events/following.ts';
import {cursorGates} from '../events/gates2.ts';
import {readWav} from '../generate/wav.ts';
import {assetPath,type StageExample2} from '../stages/stage1v2.ts';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {requireOutsideGit} from '../ladder/privateSets.ts';
import {machine} from '../run/runner.ts';
import {prefixEqual3} from './streaming3.ts';
import {IncrementalModel041} from './incremental041.ts';
import {execute047} from './live047.ts';
import {compareInput047,synthetic047} from './compareInput047.ts';
type Artifact={path:string;sha256:string};
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g047a?-challenger-input-buffers$/.test(runId));
const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit implementation first');
const commit=git('rev-parse','HEAD'),reportPath='experiments/performance-listening/reports/047-challenger-input-buffers.md';
const prereg=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${reportPath}`),readFileSync(resolve(repo,reportPath),'utf8').trim());
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID exists');
const sourcePaths=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources','experiments/performance-listening/research/input-buffers-047.md').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sourcePaths,'package-lock.json',reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:prereg,sourceHashes,
 listener:'basic-pitch-chain@4-input-buffers',parent:'basic-pitch-chain@3',definition:'observation-seam@5',stageClaim:false,promotion:false,newVersions:1,formalComparisons:0,
 suiteMode:'complete active development-guitar storage/native parity; unchanged comparator/offline evidence cited; no stage/baseline sweep',machine:machine(),heldOutReservedAccesses:0};
const shape=(v:any)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert(s.results.path&&s.results.sha256.length===64&&Array.isArray(s.perExample)&&s.counts);return Buffer.byteLength(encode(v));};
shape({...common,results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},counts:{},perExample:[]});
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked=new Map<string,string>();
const verify=(a:Artifact)=>{const p=isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path),b=readFileSync(p);assert.equal(sha256(b),a.sha256,p);if(p.startsWith(root+'/'))checked.set(p,a.sha256);return b;};
const old=(id:string)=>{const path=`runs/${id}/summary.json`,bytes=readFileSync(join(EXPERIMENT,path)),summary=JSON.parse(bytes.toString());
 for(const [p,h]of Object.entries(summary.sourceHashes as Record<string,string>))if(/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Frozen producer changed ${p}`);
 return {summary,citation:{path,sha256:sha256(bytes)},results:JSON.parse(verify(summary.results).toString())};};
const startedAt=new Date().toISOString(),tick=performance.now(),rows:any[]=[],prefixRows:any[]=[],kernelRows:any[]=[];let model:IncrementalModel041|null=null;
const attempt=artifact('attempt.json',{...common,startedAt,dryAssembly:true});
const hostPath=join(privateDir,'host.jsonl'),hostSamples:any[]=[];let lastSample=0,highLoad=0;
let ownPane:string|null=null,ownSession:string|null=null,hostViolation:string|null=null;
const sampleHost=(force=false)=>{
 const now=performance.now();if(!force&&hostSamples.length&&now-lastSample<20000)return;
 const inventory=JSON.parse(execFileSync('herdr',['agent','list'],{encoding:'utf8',timeout:10000}));assert(Array.isArray(inventory.result?.agents),'Missing Herdr inventory');
 const agents=inventory.result.agents.map((a:any)=>({pane:a.pane_id,name:a.name??null,state:a.agent_status,session:a.agent_session?.value??null,cwd:a.cwd}));
 if(ownPane===null){const own=agents.filter((a:any)=>a.state==='working'&&a.name==='dave'&&a.cwd==='/home/williao/dev/mnx-lab');assert.equal(own.length,1,'Cannot identify own pane');ownPane=own[0].pane;ownSession=own[0].session;}
 assert(agents.some((a:any)=>a.pane===ownPane&&a.session===ownSession),'Own identity lost');
 const load=readFileSync('/proc/loadavg','utf8').trim().split(/\s+/).slice(0,3).map(Number);assert(load.every(Number.isFinite));
 const gap=hostSamples.length?(now-lastSample)/1000:0,competing=agents.filter((a:any)=>a.pane!==ownPane&&a.state==='working');highLoad=load[0]>4?highLoad+1:0;
 const reasons=[...(competing.length?['other-agent-working']:[]),...(!hostSamples.length&&load[0]>=2?['start-load-not-below-2']:[]),...(highLoad>=2?['two-loads-above-4']:[]),...(gap>30?['gap-over-30s']:[])];
 const sample={at:new Date().toISOString(),monotonicMs:now,load,gapSeconds:gap,ownPane,ownSession,agents,reasons};appendFileSync(hostPath,JSON.stringify(sample)+'\n');hostSamples.push(sample);lastSample=now;
 if(reasons.length){hostViolation=reasons.join(', ');throw new Error('Host violation: '+hostViolation);}
};
const hostArtifact=()=>({path:hostPath,sha256:sha256(readFileSync(hostPath))});
try{
 const preflight=join(privateDir,'write-preflight.json');writeFileSync(preflight,encode({writeAccess:true}),{flag:'wx'});
 const prior39=old('g039-challenger-dominant-pitch'),prior41=old('g041a-challenger-incremental-neural'),prior45=old('g045-challenger-quiet-host-stage');
 const identity=JSON.parse(verify(prior39.summary.identity).toString());assert.equal(sha256(readFileSync(identity.modelPath)),identity.modelSha256);
 const graph=JSON.parse(verify(prior41.summary.graph).toString());verify({path:graph.path,sha256:graph.sha256});assert.equal(graph.sha256,'e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d');
 const manifestArtifact={path:join(root,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'};
 const examples=JSON.parse(verify(manifestArtifact).toString()).examples as StageExample2[];assert.equal(examples.length,576);
 sampleHost(true);const synthetic=artifact('synthetic.json',synthetic047());sampleHost();
 // Kernel comparisons precede any inference and leave a saved row per example.
 for(const e of examples){sampleHost();verify({path:e.audioPath,sha256:e.label.audio!.sha256});assert.equal(sha256(readFileSync(assetPath(e.scorePath))),e.label.score.sha256!);
  const comparison=compareInput047(readWav(readFileSync(e.audioPath))),a=artifact(`${e.id}.kernel.json`,{id:e.id,inputLabelSha256:sha256(encode(e.label)),...comparison});
  const {digest:_digest,...compact}=comparison;kernelRows.push({id:e.id,...compact,artifact:a});
 }
 const baseline=kernelRows.reduce((a,r)=>({rawSliceArrays:a.rawSliceArrays+r.baseline.rawSliceArrays,rawSliceElements:a.rawSliceElements+r.baseline.rawSliceElements,windowArrays:a.windowArrays+r.baseline.windowArrays,windowBytes:a.windowBytes+r.baseline.windowBytes}),{rawSliceArrays:0,rawSliceElements:0,windowArrays:0,windowBytes:0});
 const candidate=kernelRows.reduce((a,r)=>({rawArrays:a.rawArrays+r.candidate.rawArrays,rawBytes:a.rawBytes+r.candidate.rawBytes,windowArrays:a.windowArrays+r.candidate.windowArrays,windowBytes:a.windowBytes+r.candidate.windowBytes,ringBytes:a.ringBytes+r.candidate.ringBytes,growths:a.growths+r.candidate.growths,maxRawCapacity:Math.max(a.maxRawCapacity,r.candidate.maxRawCapacity)}),{rawArrays:0,rawBytes:0,windowArrays:0,windowBytes:0,ringBytes:0,growths:0,maxRawCapacity:0});
 const allocationReduction=1-candidate.windowBytes/baseline.windowBytes,resourcePass=allocationReduction>=.95&&candidate.growths===0&&candidate.maxRawCapacity<=1024;
 const kernelResults=artifact('kernel-results.json',{rows:kernelRows,baseline,candidate,allocationReduction,resourcePass});
 sampleHost();const loadStart=performance.now();model=new IncrementalModel041(graph.path);const sharedLoad=(performance.now()-loadStart)/1000;
 const directSamples=new Set<string>();
 for(const e of examples){sampleHost();
  const old41=JSON.parse(verify(prior41.results.rows.find((r:any)=>r.id===e.id).live).toString());
  const old45=JSON.parse(verify(prior45.results.rows.find((r:any)=>r.implementation==='challenger'&&r.id===e.id).artifact).toString());
  const old39=JSON.parse(verify(prior39.results[e.id].artifact).toString());verify(old39.observations.masked);verify(old39.observations.decoded);
  const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
  const handoff:Handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
  const audio=readWav(readFileSync(e.audioPath));assert.equal(audio.length/48000,e.label.duration);
  const execute=(input:Float32Array)=>{sampleHost();const x=execute047(model!,score,handoff,input);sampleHost();return x;};
  const run=execute(audio),following=evaluateFollowing(e.label,run.record),cg=cursorGates(e.label,following);
  const payloadParity41=prefixEqual3(run.payloads,old41.payloads,audio.length),payloadParity45=prefixEqual3(run.payloads,old45.payloads,audio.length);
  const requestDigest=(calls:any[])=>calls.filter(x=>x.inputHash).map(x=>[x.samples,x.inputHash,x.indices,x.cropBegin,x.cropLength]);
  const requestParity=JSON.stringify(requestDigest(run.calls))===JSON.stringify(requestDigest(old41.calls))&&JSON.stringify(requestDigest(run.calls))===JSON.stringify(requestDigest(old45.calls));
  const kernel=kernelRows.find(r=>r.id===e.id);assert.deepEqual(run.allocations,kernel.candidate);
  const primary=artifact(`${e.id}.live.json`,{id:e.id,inputLabelSha256:sha256(encode(e.label)),record:run.record.map(decisionToJSON),payloads:run.payloads,calls:run.calls,cost:run.cost,allocations:run.allocations,following,cursorFailed:cg.failed,payloadParity41,payloadParity45,requestParity,offlineCitation:prior39.results[e.id].artifact,offlineUnchanged:true});
  const guitar=(e.label.provenance.recipe as {sampleSource:string}).sampleSource,part=e.of.includes('-h-')?'hesitation':'clean';
  const row={id:e.id,guitar,part,kind:e.kind,control:e.control,artifact:primary,payloadParity41,payloadParity45,requestParity,offlineVerified:true,costRatio:run.cost.ratio,cursorFailed:cg.failed,prefixes:[] as any[]};rows.push(row);
  const cutoff=Math.floor(audio.length*.5/480)*480,future=audio.slice();for(let j=cutoff;j<future.length;j++)future[j]=j%2?.125:-.125;
  const savePrefix=(kind:string,input:Float32Array)=>{const replay=execute(input),pass=prefixEqual3(run.payloads,replay.payloads,cutoff),a=artifact(`${e.id}.prefix-${kind}.json`,{cutoff,kind,pass,payloads:replay.payloads,calls:replay.calls,cost:replay.cost,allocations:replay.allocations});row.prefixes.push({pass,artifact:a});prefixRows.push({id:e.id,pass,artifact:a});};
  savePrefix('bounded',future.subarray(0,cutoff));const key=`${guitar}:${part}`;
  if(e.kind==='performance'&&!directSamples.has(key)){directSamples.add(key);for(const kind of ['zero','alternating']){const changed=audio.slice();for(let j=cutoff;j<changed.length;j++)changed[j]=kind==='zero'?0:j%2?.125:-.125;savePrefix(`full-${kind}`,changed);}}
  if(rows.length%24===0)console.log(JSON.stringify({nativeExamples:rows.length,total:576,parity:rows.every(r=>r.payloadParity41&&r.payloadParity45&&r.requestParity),prefixes:prefixRows.length,elapsedSeconds:(performance.now()-tick)/1000}));
 }
 await model.close();model=null;sampleHost(true);
 const parity=rows.every(r=>r.payloadParity41&&r.payloadParity45&&r.requestParity&&r.offlineVerified)&&prefixRows.every(r=>r.pass);
 const decision=parity&&resourcePass?'D1':parity?'D2':'D3';
 const validation=artifact('validation.json',{manifest:manifestArtifact,verifiedPrivateArtifacts:Object.fromEntries(checked),citations:[prior39.citation,prior41.citation,prior45.citation],graph:prior41.summary.graph,identity:prior39.summary.identity,protectedProducerBytesUnchanged:true});
 const results=artifact('results.json',{rows,prefixes:prefixRows,kernelResults,synthetic,baseline,candidate,allocationReduction,resourcePass,parity});
 const summary={...common,status:'measured',decision,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000,attempt,validation,host:hostArtifact(),hostChecks:{samples:hostSamples.length,maxGapSeconds:Math.max(...hostSamples.map(s=>s.gapSeconds)),maxLoad1:Math.max(...hostSamples.map(s=>s.load[0])),valid:true,ownPane,ownSession},sharedLoad,graph:prior41.summary.graph,results,
 counts:{kernelExamples:kernelRows.length,kernelFeeds:baseline.rawSliceArrays,kernelRequests:baseline.windowArrays,nativeExamples:rows.length,payloadIdentities41:rows.filter(r=>r.payloadParity41).length,payloadIdentities45:rows.filter(r=>r.payloadParity45).length,requestIdentities:rows.filter(r=>r.requestParity).length,offlineVerified:rows.filter(r=>r.offlineVerified).length,prefixes:prefixRows.length,prefixesAgree:prefixRows.filter(r=>r.pass).length},allocation:{baseline,candidate,windowByteReduction:allocationReduction,resourcePass,scope:'explicit source allocations/capacity only'},
 informational:{cursorPassed:rows.filter(r=>!r.cursorFailed.length).length,costPassed:rows.filter(r=>r.costRatio<=.25).length,costMax:Math.max(...rows.map(r=>r.costRatio)),stageClaim:false},perExample:rows.map(r=>[r.id,r.payloadParity41,r.payloadParity45,r.requestParity,r.costRatio,r.cursorFailed]),stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:4,challengerComparisons:7,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};
 const bytes=shape(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});artifact('completed.json',{summarySha256:sha256(readFileSync(join(publicDir,'summary.json'))),publicBytes:bytes,exceedsSizeTarget:bytes>300000});console.log(encode({decision,counts:summary.counts,allocation:summary.allocation,informational:summary.informational,bytes,elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,kernelExamples:kernelRows.length,nativeExamples:rows.length});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'D3-infrastructure',hostViolation,host:existsSync(hostPath)?hostArtifact():null,startedAt,finishedAt:new Date().toISOString(),attempt,failure,kernelRows,completedExamples:rows,prefixes:prefixRows}),{flag:'wx'});throw error;}
finally{if(model)await model.close();}
