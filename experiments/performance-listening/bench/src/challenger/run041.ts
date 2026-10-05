/** Guarded 041 complete development-guitar live experiment; all verdicts exploratory. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import {rational} from '../../../../../src/audio/time.ts';
import type {Decision,Emission,Handoff} from '../../../listen/contract.ts';
import {decisionToJSON} from '../../../listen/json.ts';
import {partIds,validateRecord} from '../../../listen/validate.ts';
import {topOfScore} from '../../../listen/positions.ts';
import {evaluateFollowing} from '../events/following.ts';
import {cursorGates} from '../events/gates2.ts';
import {validateLabel} from '../events/label.ts';
import {readWav} from '../generate/wav.ts';
import {assetPath,type StageExample2} from '../stages/stage1v2.ts';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {requireOutsideGit} from '../ladder/privateSets.ts';
import {machine} from '../run/runner.ts';
import {BasicPitchChain} from './chain.ts';
import {StreamingInput3,prefixEqual3} from './streaming3.ts';
import {selectedFrames,reducePitch,completedAt} from './observation2.ts';
import {NativeModel} from './native.ts';
import {IncrementalModel041} from './incremental041.ts';
import {checks4,inherited4} from './seam4.ts';

type Artifact={path:string;sha256:string};
type Crop=ReturnType<IncrementalModel041['predict']>;
type Frame={q:number;audioTime:number;deliverySamples:number;deliveryAt:number;availableAt:number;midi:number|null;confidence:number;kind:string};
type Snapshot={input:Float32Array;maps:Crop;indices:number[];samples:number};
const DELIVERY={sampleRate:48000,chunkSamples:480};
const MODEL='/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/saved_models/icassp_2022/nmp.onnx';
const PYTHON='/home/williao/dev/guitar-nn/.venv-basic-pitch/bin/python';
const PREREG='reports/041-challenger-incremental-neural.md';
function execute(model:IncrementalModel041,score:MnxStructure,handoff:Handoff,audio:Float32Array,snapshotCalls:number[]=[]){
 const state=new StreamingInput3(),chain=new BasicPitchChain(),record:Decision[]=[],frames:Frame[]=[],payloads:Record<string,unknown>[]=[];
 const calls:Record<string,unknown>[]=[],snapshots:Snapshot[]=[];let completion=0,work=0,modelCalls=0,maxBacklog=0,maxNeuralFrames=0;
 const start=performance.now();assert(chain.start(structuredClone(score),structuredClone(handoff),{...DELIVERY}).ok);state.reset();
 const setup=(performance.now()-start)/1000;completion=setup;work+=setup;calls.push({kind:'start',samples:0,elapsed:setup,completion,frames:[],decisions:[]});
 for(let from=0;from<audio.length;from+=480){
  const until=Math.min(from+480,audio.length),deliveryAt=until/48000,tick=performance.now();
  const chunk=audio.slice(from,until);chain.feed(chunk,deliveryAt);const request=state.feed(chunk),out:Emission[]=[],batch:Frame[]=[];
  let inputHash:string|null=null,indices:number[]=[],cropBegin:number|null=null,cropLength=0;
  if(request){
   const selection=selectedFrames(state.samples,0,state.watermark);indices=selection.indices;
   if(indices.length){
    const maps=model.predict(request.input,indices);modelCalls++;cropBegin=maps.begin;cropLength=maps.length;maxNeuralFrames=Math.max(maxNeuralFrames,maps.length);
    inputHash=sha256(Buffer.from(request.input.buffer));
    for(let k=0;k<indices.length;k++){
     const j=indices[k]!,q=selection.coordinates[k]!,pitch=reducePitch(Array.from(maps.note.subarray((j-maps.begin)*88,(j-maps.begin+1)*88)));
     const frame:Frame={q,audioTime:q/22050,deliverySamples:until,deliveryAt,availableAt:deliveryAt,...pitch};batch.push(frame);
     out.push(...chain.observe({...frame,availableAt:deliveryAt,silent:frame.midi===null}));state.watermark=q;
    }
    if(snapshotCalls.includes(modelCalls))snapshots.push({input:request.input.slice(),maps,indices:[...indices],samples:until});
   }
  }
  const elapsed=(performance.now()-tick)/1000;completion=completedAt(deliveryAt,completion,elapsed);work+=elapsed;maxBacklog=Math.max(maxBacklog,completion-deliveryAt);
  for(const frame of batch){frame.availableAt=completion;frames.push(frame);payloads.push({...frame});}
  const stamped=out.map(e=>{assert(Number.isFinite(e.refersTo)&&e.refersTo>=0&&e.refersTo<=deliveryAt);return {...e,madeAt:completion} as Decision;});
  record.push(...stamped);payloads.push(...stamped.map(e=>({...decisionToJSON(e),deliverySamples:until})));
  calls.push({kind:'feed',samples:until,elapsed,completion,inputHash,indices,cropBegin,cropLength,frames:batch,decisions:stamped.map(decisionToJSON)});
 }
 const finishStart=performance.now();state.finish();const finish=(performance.now()-finishStart)/1000;completion=completedAt(audio.length/48000,completion,finish);work+=finish;
 calls.push({kind:'finish',samples:audio.length,elapsed:finish,completion,frames:[],decisions:[]});validateRecord(record);
 return {record,frames,payloads,calls,snapshots,cost:{setup,finish,work,ratio:work/(audio.length/48000),audioSeconds:audio.length/48000,maxBacklog,modelCalls,maxNeuralFrames,provisional:true}};
}
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g041a?-challenger-incremental-neural$/.test(runId));
const repo=resolve(EXPERIMENT,'../..'),git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit implementation first');
const commit=git('rev-parse','HEAD'),reportPath=`experiments/performance-listening/${PREREG}`;
const prereg=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${reportPath}`),readFileSync(join(EXPERIMENT,PREREG),'utf8').trim());
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const root=requireOutsideGit(dataRoot),privateDir=join(root,'diagnostic-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID exists');
const sourcePaths=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sourcePaths,'package-lock.json',reportPath].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:prereg,sourceHashes,listener:'basic-pitch-chain@3',offlineListener:'basic-pitch-chain@2',definition:'observation-seam@4',independentAudit:false,cursorVerdict:'exploratory only; independent seam4 audit required',stageClaim:false,promotion:false,delivery:DELIVERY,machine:machine(),heldOutReservedAccesses:0};
const dry={...common,status:'dry',results:{path:join(privateDir,'results.json'),sha256:'0'.repeat(64)},groups:{},cases:[],perExample:[]};
const shape=JSON.parse(encode(dry));assert.equal(shape.id,runId);assert(shape.results.path&&shape.results.sha256.length===64&&Array.isArray(shape.perExample));
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const binary=(name:string,v:Float32Array):Artifact=>{const path=join(privateDir,name);writeFileSync(path,Buffer.from(v.buffer,v.byteOffset,v.byteLength),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked=new Map<string,string>();
const verify=(a:Artifact)=>{const p=isAbsolute(a.path)?a.path:join(EXPERIMENT,a.path),b=readFileSync(p);assert.equal(sha256(b),a.sha256,p);checked.set(p,a.sha256);return b;};
const startedAt=new Date().toISOString(),tick=performance.now(),rows:any[]=[],parities:any[]=[],caseRows:any[]=[];let model:IncrementalModel041|null=null,reference:NativeModel|null=null;
const attempt=artifact('attempt.json',{...common,startedAt,dryAssembly:true});
try{
 const prior39Path=join(EXPERIMENT,'runs/g039-challenger-dominant-pitch/summary.json'),prior39=JSON.parse(readFileSync(prior39Path,'utf8'));
 assert.equal(sha256(readFileSync(prior39Path)),'05cfdb597d7c9d92ea1ed9252b0db1961648e30465ee08e0278489d3a67775a0');
 for(const [p,h]of Object.entries(prior39.sourceHashes as Record<string,string>))if(/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Prior producer changed ${p}`);
 const oldResults=JSON.parse(verify(prior39.results).toString()),identity=JSON.parse(verify(prior39.identity).toString());
 assert.equal(sha256(readFileSync(MODEL)),identity.modelSha256);assert.equal(identity.modelSha256,'2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec');
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:'/home/williao/dev/guitar-nn',encoding:'utf8'}).trim(),identity.guitarNNCommit);
 assert.equal(execFileSync('git',['status','--porcelain'],{cwd:'/home/williao/dev/guitar-nn',encoding:'utf8'}).trim(),'');
 assert.equal(sha256(readFileSync('/home/williao/dev/guitar-nn/environments/basic-pitch/requirements.lock')),identity.lockSha256);
 assert.deepEqual(JSON.parse(readFileSync('/home/williao/dev/guitar-nn/benchmarks/basic-pitch/config.json','utf8')),identity.config);
 const manifestArtifact={path:join(root,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'},manifest=JSON.parse(verify(manifestArtifact).toString());
 const examples=manifest.examples as StageExample2[];assert.equal(examples.length,576);const offline=new Map<string,any>();
 for(const e of examples){validateLabel(e.label);verify({path:e.audioPath,sha256:e.label.audio!.sha256});verify({path:assetPath(e.scorePath),sha256:e.label.score.sha256!});
  const old=JSON.parse(verify(oldResults[e.id].artifact).toString());assert.equal(old.inputLabelSha256,sha256(encode(e.label)));assert.deepEqual(old.gates.failed,[]);verify(old.observations.decoded);offline.set(e.id,old);}
 const prior36Path=join(EXPERIMENT,'runs/g036-incumbent-guitar/summary.json'),prior36=JSON.parse(readFileSync(prior36Path,'utf8'));
 for(const [p,h]of Object.entries(prior36.sourceHashes as Record<string,string>))if(/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Incumbent producer changed ${p}`);
 const prior36Results=JSON.parse(verify(prior36.results).toString());for(const e of examples.filter(e=>e.control!=='silence'))verify(prior36Results[e.id].artifact);
 const prior38=JSON.parse(readFileSync(join(EXPERIMENT,'runs/g038-challenger-quiet-noise/summary.json'),'utf8'));for(const row of JSON.parse(verify(prior38.results).toString()))verify(row.artifact);
 const validation=artifact('validation.json',{manifest:manifestArtifact,verifiedArtifacts:Object.fromEntries(checked),offlineSummary:{path:prior39Path,sha256:sha256(readFileSync(prior39Path))},incumbentSummary:{path:prior36Path,sha256:sha256(readFileSync(prior36Path))},identity:prior39.identity,pinnedSignal:{path:'/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/layers/signal.py',sha256:sha256(readFileSync('/home/williao/dev/guitar-nn/.venv-basic-pitch/lib/python3.11/site-packages/basic_pitch/layers/signal.py'))},unchangedProducers:true});
 for(const c of [...checks4(),...inherited4()])caseRows.push({id:c.id,agrees:c.agrees,artifact:artifact(`case-${c.id}.json`,c)});
 execFileSync(PYTHON,[join(EXPERIMENT,'bench/src/challenger/buildIncremental041.py'),MODEL,join(privateDir,'model')],{env:{...process.env,PYTHONPATH:'/tmp/listening-041-tools'},stdio:'inherit'});
 const graph=JSON.parse(readFileSync(join(privateDir,'model/graph.json'),'utf8'));verify({path:graph.path,sha256:graph.sha256});
 const loadStart=performance.now();model=new IncrementalModel041(graph.path);const sharedLoad=(performance.now()-loadStart)/1000;
 const refStart=performance.now();reference=new NativeModel(MODEL);const referenceLoad=(performance.now()-refStart)/1000;
 const sampled=new Set<string>();
 for(const e of examples){
  const score=JSON.parse(readFileSync(assetPath(e.scorePath),'utf8')) as MnxStructure,c=compilePerformance(score);assert(c.ok);
  const handoff:Handoff={from:topOfScore(c.performance),parts:partIds(score),tempo:{quartersPerMinute:rational(90n)},rate:1};
  const audio=readWav(readFileSync(e.audioPath));assert.equal(audio.length/48000,e.label.duration);
  const callCount=Math.floor(audio.length/4800),capture=!sampled.has(e.label.audio!.sha256),snapshotCalls=capture?[1,Math.ceil(callCount/2),callCount]:[];
  const run=execute(model,score,handoff,audio,snapshotCalls),following=evaluateFollowing(e.label,run.record),gates=cursorGates(e.label,following);
  const live=artifact(`${e.id}.live.json`,{id:e.id,record:run.record.map(decisionToJSON),following,exploratoryGates:gates,cost:run.cost,calls:run.calls,frames:run.frames,payloads:run.payloads,offline:oldResults[e.id].artifact});
  const row={id:e.id,guitar:e.id.split('-s')[0]!.split('-h')[0],kind:e.kind,control:e.control,failed:gates.failed,costRatio:run.cost.ratio,costClears:run.cost.ratio<=.25,reached:following.byEvent.reached,of:following.byEvent.of,maxDelay:Math.max(0,...following.byEvent.events.flatMap(x=>x.delay===null?[]:[x.delay])),maxBacklog:run.cost.maxBacklog,modelCalls:run.cost.modelCalls,maxNeuralFrames:run.cost.maxNeuralFrames,live,prefixes:[] as any[]};rows.push(row);
  if(capture){sampled.add(e.label.audio!.sha256);for(const [i,s]of run.snapshots.entries()){
   const ref=reference.predict(s.input),comparisons=[];let selectionEqual=true,maxError=0,exact=true;
   for(const [name,bins]of [['note',88],['onset',88],['contour',264]] as const){let error=0,changed=0;for(const j of s.indices)for(let b=0;b<bins;b++){const a=s.maps[name][(j-s.maps.begin)*bins+b]!,v=ref[name][j*bins+b]!;assert(Number.isFinite(a)&&Number.isFinite(v));error=Math.max(error,Math.abs(a-v));if(a!==v)changed++;}comparisons.push({name,maxError:error,changed,values:s.indices.length*bins});maxError=Math.max(maxError,error);exact&&=changed===0;}
   for(const j of s.indices){const a=reducePitch(Array.from(s.maps.note.subarray((j-s.maps.begin)*88,(j-s.maps.begin+1)*88))),b=reducePitch(Array.from(ref.note.subarray(j*88,(j+1)*88)));selectionEqual&&=a.midi===b.midi&&a.kind===b.kind;}
   const name=`parity-${sampled.size}-${i}`,a=artifact(`${name}.json`,{id:e.id,samples:s.samples,indices:s.indices,begin:s.maps.begin,length:s.maps.length,input:binary(`${name}.input.f32`,s.input),maps:Object.fromEntries((['note','onset','contour'] as const).map(k=>[k,{candidate:binary(`${name}.${k}.crop.f32`,s.maps[k]),reference:binary(`${name}.${k}.reference.f32`,ref[k])}])),comparisons,maxError,exact,selectionEqual,atol:1e-6,rtol:0});
   parities.push({id:e.id,samples:s.samples,maxError,exact,selectionEqual,length:s.maps.length,artifact:a});
  }}
  for(const fraction of [.25,.5,.75])for(const kind of ['zero','alternating']){
   const cutoff=Math.floor(audio.length*fraction/480)*480,future=audio.slice();for(let j=cutoff;j<future.length;j++)future[j]=kind==='zero'?0:j%2?.125:-.125;
   const replay=execute(model,score,handoff,future.subarray(0,cutoff));const pass=prefixEqual3(run.payloads,replay.payloads,cutoff);
   const a=artifact(`${e.id}.prefix-${fraction}-${kind}.json`,{id:e.id,fraction,kind,cutoff,pass,record:replay.record.map(decisionToJSON),frames:replay.frames,calls:replay.calls,payloads:replay.payloads,cost:replay.cost});row.prefixes.push({fraction,kind,pass,artifact:a});
  }
  if(rows.length%12===0)console.log(encode({completed:rows.length,total:576,costMax:Math.max(...rows.map(r=>r.costRatio)),cursorComparisonsClear:rows.filter(r=>!r.failed.length).length,prefixesAgree:rows.every(r=>r.prefixes.every((p:any)=>p.pass)),elapsedSeconds:(performance.now()-tick)/1000}));
 }
 await model.close();model=null;await reference.close();reference=null;
 const results=artifact('results.json',{rows,parities}),allCases=caseRows.every(c=>c.agrees),allPrefixes=rows.every(r=>r.prefixes.every((p:any)=>p.pass)),parityClear=parities.every(p=>p.maxError<=1e-6&&p.selectionEqual),allLive=rows.every(r=>!r.failed.length&&r.costClears);
 const groups=Object.fromEntries(['tonejs-acoustic','martin','spanish','fender'].map(g=>{const own=rows.filter(r=>r.id.startsWith(g+'-'));return [g,{examples:own.length,performance:own.filter(r=>r.kind==='performance').length,performanceCursorClear:own.filter(r=>r.kind==='performance'&&!r.failed.length).length,controlsCursorClear:own.filter(r=>r.kind==='control'&&!r.failed.length).length,costClear:own.filter(r=>r.costClears).length,maxCost:Math.max(...own.map(r=>r.costRatio)),eventsReached:own.reduce((s,r)=>s+r.reached,0),events:own.reduce((s,r)=>s+r.of,0),maxDelay:Math.max(...own.map(r=>r.maxDelay))}];}));
 const status=allCases&&allPrefixes&&parityClear&&allLive?'D1-compatible-pending-audit':'D2-resolved-limitation';
 const summary={...common,status,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000,attempt,validation,graph:artifact('graph-record.json',graph),sharedLoad,referenceLoad,results,cases:caseRows,groups,counts:{examples:rows.length,cursorComparisonsClear:rows.filter(r=>!r.failed.length).length,costClear:rows.filter(r=>r.costClears).length,prefixes:rows.reduce((s,r)=>s+r.prefixes.length,0),prefixesAgree:rows.reduce((s,r)=>s+r.prefixes.filter((p:any)=>p.pass).length,0),parityWindows:parities.length,exactWindows:parities.filter(p=>p.exact).length,parityClear:parities.filter(p=>p.maxError<=1e-6&&p.selectionEqual).length,maxMapError:Math.max(...parities.map(p=>p.maxError)),caseAgree:caseRows.filter(c=>c.agrees).length,cases:caseRows.length,offlineAssessmentsReused:576,verifiedArtifacts:checked.size},perExample:rows.map(r=>[r.id,r.failed,r.costRatio,r.live]),stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:3,challengerComparisons:4,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};
 writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});artifact('completed.json',{summarySha256:sha256(readFileSync(join(publicDir,'summary.json'))),publicBytes:Buffer.byteLength(encode(summary))});console.log(encode({status,counts:summary.counts,groups,elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completedExamples:rows.length});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'D3-infrastructure',startedAt,finishedAt:new Date().toISOString(),attempt,failure,completedExamples:rows,parities,cases:caseRows}),{flag:'wx'});throw error;}
finally{if(model)await model.close();if(reference)await reference.close();}
