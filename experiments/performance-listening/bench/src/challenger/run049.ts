/** 049 exact-cache eligibility only; no model inference or listener evaluation. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {requireOutsideGit} from '../ladder/privateSets.ts';
import {readWav} from '../generate/wav.ts';
import {assetPath,type StageExample2} from '../stages/stage1v2.ts';
import {StreamingInput047} from './streaming047.ts';
import {selectedFrames} from './observation2.ts';
type Artifact={path:string;sha256:string};
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g049a?-challenger-dsp-cache$/.test(runId));
const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit source first');
const commit=git('rev-parse','HEAD'),reportPath='experiments/performance-listening/reports/049-challenger-dsp-cache.md';
const prereg=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${reportPath}`),readFileSync(resolve(repo,reportPath),'utf8').trim());
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID exists');
const sources=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources','experiments/performance-listening/research/dsp-cache-049.md').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sources,'package-lock.json',reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:prereg,sourceHashes,parent:'basic-pitch-chain@5-note-output',listenerVersionAdded:false,newVersions:0,stageClaim:false,promotion:false,nativeInferenceCalls:0,heldOutReservedAccesses:0,suiteMode:'complete exact-cache eligibility census; unchanged native/offline/prefix evidence cited'};
const shape=(v:any)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert(s.results.path&&s.results.sha256.length===64&&Array.isArray(s.perExample)&&s.counts);return Buffer.byteLength(encode(v));};
shape({...common,results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},counts:{},perExample:[]});
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked=new Map<string,string>();
const verify=(a:Artifact)=>{const p=isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path),b=readFileSync(p);assert.equal(sha256(b),a.sha256,p);if(p.startsWith(root+'/'))checked.set(p,a.sha256);return b;};
const old=(id:string)=>{const path=`runs/${id}/summary.json`,bytes=readFileSync(join(EXPERIMENT,path)),summary=JSON.parse(bytes.toString());
 for(const [p,h]of Object.entries(summary.sourceHashes as Record<string,string>)){
  const tracked=relative(repo,resolve(EXPERIMENT,p));assert.equal(sha256(execFileSync('git',['show',`${summary.gitCommit}:${tracked}`],{cwd:repo,maxBuffer:64<<20})),h,`Pinned reference source ${p}`);
  if((/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))&&!/bench\/src\/challenger\/(run|verify|postStats)/.test(p))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Frozen producer changed ${p}`);
 }
 return {summary,citation:{path,sha256:sha256(bytes)},results:JSON.parse(verify(summary.results).toString())};};
const startedAt=new Date().toISOString(),tick=performance.now(),rows:any[]=[];
const attempt=artifact('attempt.json',{...common,startedAt,dryAssembly:true});
const host=()=>({at:new Date().toISOString(),load:readFileSync('/proc/loadavg','utf8').trim(),inventory:JSON.parse(execFileSync('herdr',['agent','list'],{encoding:'utf8',timeout:10000})),formalTiming:false});
try{
 artifact('write-preflight.json',{writeAccess:true});
 const startHost=artifact('host-start.json',host()),prior48=old('g048-challenger-output-copies'),prior39=old('g039-challenger-dominant-pitch');
 const graph=JSON.parse(verify(prior48.summary.graph).toString());verify({path:graph.path,sha256:graph.sha256});assert.equal(graph.sha256,'e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d');
 const graphMeta=JSON.parse(execFileSync('/home/williao/dev/guitar-nn/.venv-basic-pitch/bin/python',[join(EXPERIMENT,'bench/src/challenger/inspectDsp049.py'),graph.path],{encoding:'utf8',env:{...process.env,PYTHONPATH:'/tmp/listening-041-tools'}}));
 const inspection=artifact('graph-inspection.json',graphMeta);assert.equal(graphMeta.sha256,graph.sha256);assert.equal(graphMeta.hop,256);
 const identity=JSON.parse(verify(prior39.summary.identity).toString());verify({path:identity.modelPath,sha256:identity.modelSha256});
 const signalPath='/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/layers/signal.py',signal={path:signalPath,sha256:sha256(readFileSync(signalPath))};
 const manifestArtifact={path:join(root,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'};
 const examples=JSON.parse(verify(manifestArtifact).toString()).examples as StageExample2[];assert.equal(examples.length,576);
 for(const e of examples){
  verify({path:e.audioPath,sha256:e.label.audio!.sha256});assert.equal(sha256(readFileSync(assetPath(e.scorePath))),e.label.score.sha256!);
  const oldRow=prior48.results.rows.find((r:any)=>r.id===e.id),reference=JSON.parse(verify(oldRow.artifacts.candidate).toString());
  // Complete native evidence is cited unchanged; it is never turned into a new timing claim.
  const prefixCitations=oldRow.prefixes.map((p:any)=>{const record=JSON.parse(verify(p.artifact).toString());assert(record.pass&&p.pass);return p.artifact;});
  const offline=JSON.parse(verify(prior39.results[e.id].artifact).toString());verify(offline.observations.masked);verify(offline.observations.decoded);
  const audio=readWav(readFileSync(e.audioPath));assert.equal(audio.length/48000,e.label.duration);
  const state=new StreamingInput047();state.reset();const requests:any[]=[];let previous:Buffer|null=null,wholeHits=0,phasePairs=0,overlapPairs=0,feeds=0;
  const previousStorage=Buffer.alloc(43844*4); // bounded census snapshot, not a listener allocation
  for(let from=0;from<audio.length;from+=480){
   feeds++;const request=state.feed(audio.slice(from,Math.min(from+480,audio.length)));if(!request)continue;
   const selection=selectedFrames(state.samples,0,state.watermark);if(!selection.indices.length)continue;
   const bytes=Buffer.from(request.input.buffer,request.input.byteOffset,request.input.byteLength),hash=sha256(bytes),start=request.generated-43844;
   const memoHit=previous!==null&&previous.equals(bytes);if(memoHit)wholeHits++;
   let phaseOverlaps=0,overlaps=0;
   for(let k=requests.length-1;k>=0;k--){const delta=start-requests[k]!.windowStart;if(delta>=43844)break;if(delta>0){overlaps++;if(delta%graphMeta.hop===0)phaseOverlaps++;}}
   overlapPairs+=overlaps;phasePairs+=phaseOverlaps;
   const begin=Math.max(0,Math.min(...selection.indices)-10);
   const q={samples:state.samples,generated:request.generated,windowStart:start,inputHash:hash,indices:selection.indices,cropBegin:begin,cropLength:172-begin,memoHit,overlapPairs:overlaps,phaseOverlapPairs:phaseOverlaps,shift:requests.length?request.generated-requests.at(-1)!.generated:null};
   requests.push(q);bytes.copy(previousStorage);previous=previousStorage;state.watermark=selection.coordinates.at(-1)!;
  }
  const digest=(xs:any[])=>xs.map(x=>[x.samples,x.inputHash,x.indices,x.cropBegin,x.cropLength]);
  const actual=digest(requests),expected=digest(reference.calls.filter((x:any)=>x.inputHash));const parity=JSON.stringify(actual)===JSON.stringify(expected);
  const detail=artifact(`${e.id}.json`,{id:e.id,labelSha256:sha256(encode(e.label)),feeds,requests,wholeHits,phasePairs,overlapPairs,requestParity:parity,reference:oldRow.artifacts.candidate,prefixCitations,offlineCitation:prior39.results[e.id].artifact,snapshotBytes:previousStorage.byteLength,allocations:state.allocations});
  const guitar=(e.label.provenance.recipe as {sampleSource:string}).sampleSource,part=e.of.includes('-h-')?'hesitation':'clean';
  rows.push({id:e.id,guitar,part,kind:e.kind,control:e.control,artifact:detail,feeds,requests:requests.length,wholeHits,phasePairs,overlapPairs,requestParity:parity,prefixCitations:prefixCitations.length});
  if(rows.length%96===0)console.log(JSON.stringify({examples:rows.length,parity:rows.every(r=>r.requestParity),wholeHits:rows.reduce((n,r)=>n+r.wholeHits,0),phasePairs:rows.reduce((n,r)=>n+r.phasePairs,0),elapsedSeconds:(performance.now()-tick)/1000}));
 }
 const sum=(k:string)=>rows.reduce((n,r)=>n+r[k],0),counts={examples:rows.length,feeds:sum('feeds'),requests:sum('requests'),wholeHits:sum('wholeHits'),phasePairs:sum('phasePairs'),overlapPairs:sum('overlapPairs'),requestsIdentical:rows.filter(r=>r.requestParity).length,primaryCitations:rows.length,prefixCitations:sum('prefixCitations'),offlineCitations:rows.length};
 const parity=rows.every(r=>r.requestParity),decision=!parity?'D3':counts.wholeHits||counts.phasePairs?'D1':'D2';
 const endHost=artifact('host-end.json',host());
 const validation=artifact('validation.json',{manifest:manifestArtifact,verifiedPrivateArtifacts:Object.fromEntries(checked),citations:[prior48.citation,prior39.citation],graph:prior48.summary.graph,identity:prior39.summary.identity,signal,unchangedProducers:true});
 const results=artifact('results.json',{rows,counts,parity,decision,opportunity:{wholeDSPCallsAvoided:counts.wholeHits,phaseEligiblePairs:counts.phasePairs,snapshotBytesPerExecution:43844*4,snapshotCopies:counts.requests,snapshotCopiedBytes:counts.requests*43844*4,scope:'census allocation and necessary eligibility only; no implemented cache, native work measurement or speed claim'}});
 const summary={...common,status:'measured',decision,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000,attempt,validation,inspection,results,host:{start:startHost,end:endHost,formalTiming:false},counts,opportunity:{wholeDSPCallsAvoided:counts.wholeHits,phaseEligiblePairs:counts.phasePairs},perExample:rows.map(r=>[r.id,r.requests,r.wholeHits,r.phasePairs,r.requestParity]),stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:5,challengerComparisons:9,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};
 const bytes=shape(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});artifact('completed.json',{summarySha256:sha256(readFileSync(join(publicDir,'summary.json'))),publicBytes:bytes,exceedsSizeTarget:bytes>300000});console.log(encode({decision,counts,bytes,elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completedExamples:rows});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'D3-infrastructure',startedAt,attempt,failure}),{flag:'wx'});throw error;}
