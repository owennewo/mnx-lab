/** 048 complete output-copy and fresh numerical comparison; no formal claim. */
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
import {IncrementalModel048} from './incremental048.ts';
type Artifact={path:string;sha256:string};
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g048a?-challenger-output-copies$/.test(runId));
const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit implementation first');
const commit=git('rev-parse','HEAD'),reportPath='experiments/performance-listening/reports/048-challenger-output-copies.md';
const prereg=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${reportPath}`),readFileSync(resolve(repo,reportPath),'utf8').trim());
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID exists');
const sourcePaths=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources','experiments/performance-listening/research/output-copies-048.md').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sourcePaths,'package-lock.json',reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:prereg,sourceHashes,
 listener:'basic-pitch-chain@5-note-output',parent:'basic-pitch-chain@4-input-buffers',definition:'observation-seam@5',stageClaim:false,promotion:false,newVersions:1,formalComparisons:0,
 suiteMode:'complete active development-guitar paired native note/output-copy parity; unchanged offline evidence cited; no stage/baseline sweep',machine:machine(),heldOutReservedAccesses:0};
const shape=(v:any)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert(s.results.path&&s.results.sha256.length===64&&Array.isArray(s.perExample)&&s.counts);return Buffer.byteLength(encode(v));};
shape({...common,results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},counts:{},perExample:[]});
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked=new Map<string,string>();
const verify=(a:Artifact)=>{const p=isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path),b=readFileSync(p);assert.equal(sha256(b),a.sha256,p);if(p.startsWith(root+'/'))checked.set(p,a.sha256);return b;};
const old=(id:string)=>{const path=`runs/${id}/summary.json`,bytes=readFileSync(join(EXPERIMENT,path)),summary=JSON.parse(bytes.toString());
 for(const [p,h]of Object.entries(summary.sourceHashes as Record<string,string>)){
  const tracked=relative(repo,resolve(EXPERIMENT,p));assert.equal(sha256(execFileSync('git',['show',`${summary.gitCommit}:${tracked}`],{cwd:repo,maxBuffer:64<<20})),h,`Pinned reference source ${p}`);
  // 047's record-only writer maintenance is not a changed live/offline producer.
  if((/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))&&!/bench\/src\/challenger\/(run|verify|postStats)/.test(p))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Frozen producer changed ${p}`);
 }
 return {summary,citation:{path,sha256:sha256(bytes)},results:JSON.parse(verify(summary.results).toString())};};
const startedAt=new Date().toISOString(),tick=performance.now(),rows:any[]=[],prefixRows:any[]=[],executions:Artifact[]=[];let parent:IncrementalModel041|null=null,candidate:IncrementalModel048|null=null;
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
 const prior39=old('g039-challenger-dominant-pitch'),prior47=old('g047-challenger-input-buffers');
 const identity=JSON.parse(verify(prior39.summary.identity).toString());assert.equal(sha256(readFileSync(identity.modelPath)),identity.modelSha256);
 const graph=JSON.parse(verify(prior47.summary.graph).toString());verify({path:graph.path,sha256:graph.sha256});assert.equal(graph.sha256,'e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d');
 const manifestArtifact={path:join(root,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'};
 const examples=JSON.parse(verify(manifestArtifact).toString()).examples as StageExample2[];assert.equal(examples.length,576);
 sampleHost(true);let t=performance.now();parent=new IncrementalModel041(graph.path);const parentLoad=(performance.now()-t)/1000;sampleHost();
 t=performance.now();candidate=new IncrementalModel048(graph.path);const candidateLoad=(performance.now()-t)/1000;sampleHost();
 const sharedOutput={parent:(parent as unknown as {output:Float32Array}).output.byteLength,candidate:candidate.sharedOutputBytes};
 assert.deepEqual(sharedOutput,{parent:302720,candidate:60544});
 const directSamples=new Set<string>();
 const requestDigest=(calls:any[])=>calls.filter(x=>x.inputHash).map(x=>[x.samples,x.inputHash,x.indices,x.cropBegin,x.cropLength]);
 for(const [ordinal,e] of examples.entries()){sampleHost();verify({path:e.audioPath,sha256:e.label.audio!.sha256});assert.equal(sha256(readFileSync(assetPath(e.scorePath))),e.label.score.sha256!);
  const old47=JSON.parse(verify(prior47.results.rows.find((r:any)=>r.id===e.id).artifact).toString());
  const old39=JSON.parse(verify(prior39.results[e.id].artifact).toString());verify(old39.observations.masked);verify(old39.observations.decoded);
  const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
  const handoff:Handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
  const audio=readWav(readFileSync(e.audioPath));assert.equal(audio.length/48000,e.label.duration);
  const execute=(kind:'parent'|'candidate',input:Float32Array)=>{
   sampleHost();const backend=kind==='parent'?parent!:candidate!;let lastMaps:any=null,previous:{note:Float32Array;hash:string}|null=null,snapshotsStable=true;
   const tensors:any[]=[];
   // execute047 consumes only note. This local boundary cast leaves frozen code unchanged.
   const observed={predict:(x:Float32Array,indices:readonly number[])=>{lastMaps=backend.predict(x,indices);return lastMaps;}} as Pick<IncrementalModel041,'predict'>;
   const run=execute047(observed,score,handoff,input,{afterService:()=>{
    if(previous&&sha256(Buffer.from(previous.note.buffer,previous.note.byteOffset,previous.note.byteLength))!==previous.hash)snapshotsStable=false;
    if(!lastMaps)return;
    const keys=Object.keys(lastMaps).filter(k=>lastMaps[k] instanceof Float32Array),length=lastMaps.length;
    assert.deepEqual(keys,kind==='parent'?['note','onset','contour']:['note']);
    const arrays=Object.fromEntries(keys.map(k=>[k,{elements:lastMaps[k].length,bytes:lastMaps[k].byteLength}]));
    for(const [k,bins]of (kind==='parent'?[['note',88],['onset',88],['contour',264]]:[['note',88]]) as [string,number][])assert.equal(lastMaps[k].length,length*bins);
    const noteSha256=sha256(Buffer.from(lastMaps.note.buffer,lastMaps.note.byteOffset,lastMaps.note.byteLength));
    tensors.push({begin:lastMaps.begin,length,noteSha256,arrays,sliceArrays:keys.length,sliceBytes:keys.reduce((sum,k)=>sum+lastMaps[k].byteLength,0),workerCopyBytes:keys.reduce((sum,k)=>sum+lastMaps[k].byteLength,0)});
    previous={note:lastMaps.note,hash:noteSha256};lastMaps=null;
   }});
   assert.equal(tensors.length,run.cost.modelCalls);const calls=run.calls.filter(x=>x.inputHash);
   const requests=tensors.map((tensor,j)=>({samples:calls[j]!.samples,inputHash:calls[j]!.inputHash,indices:calls[j]!.indices,...tensor}));
   sampleHost();return {...run,requests,snapshotsStable};
  };
  const measured:any={},primaryArtifacts:any={};
  // Fixed alternation makes paired timing order visible; never a selection rule.
  const order:('parent'|'candidate')[]=ordinal%2?['candidate','parent']:['parent','candidate'];
  for(const kind of order){const x=execute(kind,audio),following=evaluateFollowing(e.label,x.record),cg=cursorGates(e.label,following);
   const saved={id:e.id,kind,inputLabelSha256:sha256(encode(e.label)),record:x.record.map(decisionToJSON),payloads:x.payloads,calls:x.calls,cost:x.cost,allocations:x.allocations,requests:x.requests,snapshotsStable:x.snapshotsStable,following,cursorFailed:cg.failed,offlineCitation:prior39.results[e.id].artifact};
   const a=artifact(`${e.id}.${kind}.json`,saved);executions.push(a);measured[kind]=saved;primaryArtifacts[kind]=a;
  }
  const a=measured.parent,b=measured.candidate,noteParity=JSON.stringify(a.requests.map((x:any)=>[x.samples,x.begin,x.length,x.noteSha256]))===JSON.stringify(b.requests.map((x:any)=>[x.samples,x.begin,x.length,x.noteSha256]));
  const requestParity=JSON.stringify(requestDigest(a.calls))===JSON.stringify(requestDigest(b.calls))&&JSON.stringify(requestDigest(b.calls))===JSON.stringify(requestDigest(old47.calls));
  const payloadParity=prefixEqual3(a.payloads,b.payloads,audio.length)&&prefixEqual3(a.payloads,old47.payloads,audio.length)&&prefixEqual3(b.payloads,old47.payloads,audio.length);
  const inputStorageParity=JSON.stringify(a.allocations)===JSON.stringify(b.allocations)&&JSON.stringify(b.allocations)===JSON.stringify(old47.allocations);
  const sum=(x:any)=>x.requests.reduce((r:any,q:any)=>({requests:r.requests+1,neuralFrames:r.neuralFrames+q.length,sliceArrays:r.sliceArrays+q.sliceArrays,sliceBytes:r.sliceBytes+q.sliceBytes,workerCopyBytes:r.workerCopyBytes+q.workerCopyBytes}),{requests:0,neuralFrames:0,sliceArrays:0,sliceBytes:0,workerCopyBytes:0});
  const guitar=(e.label.provenance.recipe as {sampleSource:string}).sampleSource,part=e.of.includes('-h-')?'hesitation':'clean';
  const row={id:e.id,guitar,part,kind:e.kind,control:e.control,order,artifacts:primaryArtifacts,noteParity,requestParity,payloadParity,inputStorageParity,snapshotsStable:a.snapshotsStable&&b.snapshotsStable,offlineVerified:true,parentCounts:sum(a),candidateCounts:sum(b),parentCost:a.cost.ratio,candidateCost:b.cost.ratio,cursorFailed:b.cursorFailed,prefixes:[] as any[]};rows.push(row);
  const cutoff=Math.floor(audio.length*.5/480)*480,future=audio.slice();for(let j=cutoff;j<future.length;j++)future[j]=j%2?.125:-.125;
  const savePrefix=(kind:string,input:Float32Array)=>{const replay=execute('candidate',input),pass=prefixEqual3(b.payloads,replay.payloads,cutoff),pa=artifact(`${e.id}.prefix-${kind}.json`,{cutoff,kind,pass,payloads:replay.payloads,calls:replay.calls,cost:replay.cost,allocations:replay.allocations,requests:replay.requests,snapshotsStable:replay.snapshotsStable});executions.push(pa);row.prefixes.push({pass,artifact:pa});prefixRows.push({id:e.id,pass,artifact:pa});};
  savePrefix('bounded',future.subarray(0,cutoff));const key=`${guitar}:${part}`;
  if(e.kind==='performance'&&!directSamples.has(key)){directSamples.add(key);for(const kind of ['zero','alternating']){const changed=audio.slice();for(let j=cutoff;j<changed.length;j++)changed[j]=kind==='zero'?0:j%2?.125:-.125;savePrefix(`full-${kind}`,changed);}}
  if(rows.length%24===0)console.log(JSON.stringify({pairedExamples:rows.length,total:576,parity:rows.every(r=>r.noteParity&&r.requestParity&&r.payloadParity&&r.inputStorageParity),prefixes:prefixRows.length,elapsedSeconds:(performance.now()-tick)/1000}));
 }
 await parent.close();parent=null;await candidate.close();candidate=null;sampleHost(true);
 const totals=(key:'parentCounts'|'candidateCounts')=>rows.reduce((a,r)=>{for(const k of Object.keys(a))a[k]+=r[key][k];return a;},{requests:0,neuralFrames:0,sliceArrays:0,sliceBytes:0,workerCopyBytes:0} as Record<string,number>);
 const before=totals('parentCounts'),after=totals('candidateCounts'),resourcePass=before.requests===after.requests&&after.sliceArrays*3===before.sliceArrays&&after.sliceBytes*5===before.sliceBytes&&after.workerCopyBytes*5===before.workerCopyBytes&&sharedOutput.candidate*5===sharedOutput.parent;
 const parity=rows.every(r=>r.noteParity&&r.requestParity&&r.payloadParity&&r.inputStorageParity&&r.snapshotsStable&&r.offlineVerified)&&prefixRows.every(r=>r.pass);
 const decision=parity&&resourcePass?'D1':parity?'D2':'D3';
 const validation=artifact('validation.json',{manifest:manifestArtifact,verifiedPrivateArtifacts:Object.fromEntries(checked),citations:[prior39.citation,prior47.citation],graph:prior47.summary.graph,identity:prior39.summary.identity,protectedProducerBytesUnchanged:true});
 const results=artifact('results.json',{rows,prefixes:prefixRows,before,after,sharedOutput,resourcePass,parity});
 const summary={...common,status:'measured',decision,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000,attempt,validation,host:hostArtifact(),hostChecks:{samples:hostSamples.length,maxGapSeconds:Math.max(...hostSamples.map(s=>s.gapSeconds)),maxLoad1:Math.max(...hostSamples.map(s=>s.load[0])),valid:true,ownPane,ownSession},sharedLoad:{parent:parentLoad,candidate:candidateLoad},graph:prior47.summary.graph,results,
 counts:{pairedExamples:rows.length,nativePrimaryExecutions:rows.length*2,noteIdentities:rows.filter(r=>r.noteParity).length,payloadIdentities:rows.filter(r=>r.payloadParity).length,requestIdentities:rows.filter(r=>r.requestParity).length,inputStorageIdentities:rows.filter(r=>r.inputStorageParity).length,offlineVerified:rows.filter(r=>r.offlineVerified).length,prefixes:prefixRows.length,prefixesAgree:prefixRows.filter(r=>r.pass).length},allocation:{before,after,sharedOutput,sliceByteReduction:1-after.sliceBytes/before.sliceBytes,workerCopyReduction:1-after.workerCopyBytes/before.workerCopyBytes,resourcePass,scope:'explicit bridge destination backing bytes and copy elements; native tensors and total allocator traffic excluded'},
 informational:{cursorPassed:rows.filter(r=>!r.cursorFailed.length).length,costPassed:rows.filter(r=>r.candidateCost<=.25).length,parentCostMax:Math.max(...rows.map(r=>r.parentCost)),candidateCostMax:Math.max(...rows.map(r=>r.candidateCost)),stageClaim:false},perExample:rows.map(r=>[r.id,r.noteParity,r.payloadParity,r.requestParity,r.parentCost,r.candidateCost,r.cursorFailed]),stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:5,challengerComparisons:8,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};
 const bytes=shape(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});artifact('completed.json',{summarySha256:sha256(readFileSync(join(publicDir,'summary.json'))),publicBytes:bytes,exceedsSizeTarget:bytes>300000});console.log(encode({decision,counts:summary.counts,allocation:summary.allocation,informational:summary.informational,bytes,elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completedPairs:rows.length,completedExecutions:executions});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'D3-infrastructure',hostViolation,host:existsSync(hostPath)?hostArtifact():null,startedAt,finishedAt:new Date().toISOString(),attempt,failure,completedExamples:rows,prefixes:prefixRows}),{flag:'wx'});throw error;}
finally{if(parent)await parent.close();if(candidate)await candidate.close();}
