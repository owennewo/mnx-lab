/** Guarded full-workload diagnosis, no formal stage claim. */
import assert from 'node:assert/strict';
import {fork,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync,readdirSync,readlinkSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {assetPath} from '../stages/stage1v2.ts';
import {prefixEqual3} from './streaming3.ts';
import {decisionFromJSON} from '../../../listen/json.ts';
import {assess046,targets046} from './harness046.ts';
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&/^g046a?-challenger-full-workload-trace$/.test(runId!));
const repo=resolve(EXPERIMENT,'../..'),git=(...a:string[])=>execFileSync('git',a,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit source before running');
const commit=git('rev-parse','HEAD'),report='experiments/performance-listening/reports/046-challenger-full-workload-trace.md';
const prereg=git('log','--diff-filter=A','--format=%H','--',report).split('\n').at(-1)!;git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${report}`),readFileSync(resolve(repo,report),'utf8').trim());assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const privateDir=resolve(dataRoot,'diagnostic-runs',runId!),publicDir=join(EXPERIMENT,'runs',runId!);assert(!existsSync(privateDir)&&!existsSync(publicDir));
const sourcePaths=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sourcePaths,'package-lock.json',report].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,gitCommit:commit,preregistrationCommit:prereg,modelAndTool:'GPT-6.1-Sol (high) in Codex',sourceHashes,stageClaim:false,promotion:false,newVersions:0,heldOutReservedAccesses:0,suiteMode:'full 576-example challenger workload and 592 prefixes per arm; diagnostic only'};
const shape=(s:any)=>{assert.equal(s.id,runId);assert(Array.isArray(s.arms));assert(s.results.path&&s.results.sha256.length===64);return Buffer.byteLength(encode(s));};shape({...common,arms:[],results:{path:'dry',sha256:'0'.repeat(64)}});
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown)=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked:Record<string,string>={};const verify=(a:{path:string;sha256:string})=>{const bytes=readFileSync(a.path);assert.equal(sha256(bytes),a.sha256,a.path);checked[a.path]=a.sha256;return a.path.endsWith('.json')?JSON.parse(bytes.toString()):bytes;};
const startedAt=new Date().toISOString(),started=performance.now(),rows:any[]=[],arms:any[]=[],hostPath=join(privateDir,'host.jsonl'),schedulerPath=join(privateDir,'scheduler.jsonl');
let hostLast=0,hostSamples=0,maxGap=0,maxLoad=0,highLoad=0,ownPane:string|null=null,ownSession:string|null=null;
const sampleHost=()=>{const now=performance.now(),inventory=JSON.parse(execFileSync('herdr',['agent','list'],{encoding:'utf8',timeout:10000}));assert(Array.isArray(inventory.result?.agents));
 const agents=inventory.result.agents.map((a:any)=>({pane:a.pane_id,state:a.agent_status,name:a.name??null,session:a.agent_session?.value??null,cwd:a.cwd}));
 if(ownPane===null){const own=agents.filter((a:any)=>a.state==='working'&&a.name==='dave'&&a.cwd==='/home/williao/dev/mnx-lab');assert.equal(own.length,1);ownPane=own[0].pane;ownSession=own[0].session;}
 assert(agents.some((a:any)=>a.pane===ownPane&&a.session===ownSession));const load=readFileSync('/proc/loadavg','utf8').trim().split(/\s+/).slice(0,3).map(Number),gap=hostSamples?(now-hostLast)/1000:0;highLoad=load[0]!>4?highLoad+1:0;
 const reasons=[...(agents.some((a:any)=>a.pane!==ownPane&&a.state==='working')?['other-agent-working']:[]),...(!hostSamples&&load[0]!>=2?['start-load-not-below-2']:[]),...(highLoad>=2?['two-high-loads']:[]),...(gap>30?['host-sampling-gap']:[])];
 appendFileSync(hostPath,JSON.stringify({at:new Date().toISOString(),mono:now,load,gap,ownPane,ownSession,agents,reasons})+'\n');hostLast=now;hostSamples++;maxGap=Math.max(maxGap,gap);maxLoad=Math.max(maxLoad,load[0]!);assert.equal(reasons.length,0,reasons.join(','));};
try{
 const readPrior=(id:string)=>{const p=join(EXPERIMENT,'runs',id,'summary.json'),b=readFileSync(p),s=JSON.parse(b.toString());for(const [p,h]of Object.entries(s.sourceHashes as Record<string,string>))if(/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,p);return {s,r:verify(s.results),citation:{path:relative(EXPERIMENT,p),sha256:sha256(b)}};};
 const p39=readPrior('g039-challenger-dominant-pitch'),p41=readPrior('g041a-challenger-incremental-neural'),p45=readPrior('g045-challenger-quiet-host-stage');
 const graph=verify(p41.s.graph);verify({path:graph.path,sha256:graph.sha256});assert.equal(graph.sha256,'e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d');
 const manifestArtifact={path:resolve(dataRoot,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'},manifest=verify(manifestArtifact);assert.equal(manifest.examples.length,576);
 const examples=manifest.examples.map((e:any)=>{verify({path:e.audioPath,sha256:e.label.audio.sha256});verify({path:assetPath(e.scorePath),sha256:e.label.score.sha256});
 const old39=p39.r[e.id].artifact,old41=p41.r.rows.find((r:any)=>r.id===e.id).live,old45=p45.r.rows.find((r:any)=>r.id===e.id&&r.implementation==='challenger').artifact;
 const o=verify(old39);verify(o.observations.decoded);verify(old41);verify(old45);
 return {...e,scorePath:assetPath(e.scorePath),guitar:e.label.provenance.recipe.sampleSource,part:e.of.includes('-h-')?'hesitation':'clean',old39,old41,old45};});
 const validation=artifact('validation.json',{checked:Object.fromEntries(Object.entries(checked).filter(([p])=>!p.startsWith(repo+'/'))),trackedChecks:Object.fromEntries(Object.entries(checked).filter(([p])=>p.startsWith(repo+'/')).map(([p,h])=>[relative(repo,p),h])),manifest:manifestArtifact,graph:p41.s.graph,citations:[p39.citation,p41.citation,p45.citation],trackedPathsAreRepositoryRelative:true});
 // Prior summary objects contain bounded result rows, not loaded live record graphs.
 sampleHost();
 for(const arm of ['A','B']){
  const armDir=join(privateDir,arm);mkdirSync(armDir);const config=artifact(`config-${arm}.json`,{graph:graph.path,privateDir,armDir,examples});
  const child=fork(resolve(EXPERIMENT,'bench/src/challenger/child046.ts'),[config.path,arm],{execArgv:['--import','tsx','--cpu-prof',`--cpu-prof-dir=${armDir}`,'--heap-prof','--heap-prof-interval=131072',`--heap-prof-dir=${armDir}`,'--trace-event-categories=v8',`--trace-event-file-pattern=${armDir}/trace.json`],stdio:['ignore','pipe','pipe','ipc']});
  let done:any=null,failed:Error|null=null;const snapshotArtifacts:any[]=[];child.stdout!.on('data',b=>appendFileSync(join(privateDir,`${arm}.stdout.log`),b));child.stderr!.on('data',b=>appendFileSync(join(privateDir,`${arm}.stderr.log`),b));
  const monitor=setInterval(()=>{try{const threads:any[]=[];for(const tid of readdirSync(`/proc/${child.pid}/task`))try{threads.push({tid:Number(tid),sched:readFileSync(`/proc/${child.pid}/task/${tid}/schedstat`,'utf8').trim()});}catch{}
   const processes:any[]=[];for(const pid of readdirSync('/proc').filter(p=>/^\d+$/.test(p)))try{const comm=readFileSync(`/proc/${pid}/comm`,'utf8').trim();if(/codex|claude|node|python|workerd|chrome/.test(comm)){const raw=readFileSync(`/proc/${pid}/stat`,'utf8'),tail=raw.slice(raw.lastIndexOf(')')+2).split(' ');let cwd:string|null=null;try{cwd=readlinkSync(`/proc/${pid}/cwd`);}catch{}processes.push({pid:Number(pid),comm,cpuTicks:Number(tail[11])+Number(tail[12]),cwd});}}catch{}
   appendFileSync(schedulerPath,JSON.stringify({at:new Date().toISOString(),epochMs:Date.now(),mono:performance.now(),pid:child.pid,arm,threads,processes})+'\n');if(performance.now()-hostLast>=20000)sampleHost();
  }catch(error){failed=error as Error;child.kill('SIGKILL');}},200);
  await new Promise<void>((res,rej)=>{child.on('message',(message:any)=>{try{
   if(message.type==='done'){done=message;return;}
   if(message.type==='snapshot'){snapshotArtifacts.push({id:message.id,path:message.path,sha256:sha256(readFileSync(message.path))});return;}
   if(message.type==='example-end'){const target=rows.some(r=>r.arm===arm&&r.id===message.id&&r.targets.some((t:any)=>!t.inference&&t.wallMs>=100));artifact(`${arm}.${message.id}.end.json`,message);child.send({ack:message.id,target});return;}
   assert.equal(message.type,'execution');const d=message.result,e=examples.find((e:any)=>e.id===d.id);assert(e);const parentStart=performance.now(),targets=targets046(d);
   const path=join(privateDir,`${arm}.${d.id}.${d.kind}.json`);if(arm==='B')writeFileSync(path,encode(d),{flag:'wx'});const saved={path,sha256:sha256(readFileSync(path))};
   let identity=true,identity41:boolean|null=null,evaluation:any=null;
   if(d.kind==='primary'){const old45=JSON.parse(readFileSync(e.old45.path,'utf8')),old41=JSON.parse(readFileSync(e.old41.path,'utf8'));identity=prefixEqual3(d.payloads,old45.payloads,Math.round(e.label.duration*48000));identity41=prefixEqual3(d.payloads,old41.payloads,Math.round(e.label.duration*48000));
    if(arm==='A')evaluation=d.evaluation;else{const old=JSON.parse(readFileSync(e.old39.path,'utf8')),events=JSON.parse(readFileSync(old.observations.decoded.path,'utf8')).events;evaluation=assess046(JSON.parse(readFileSync(e.scorePath,'utf8')),e,{old,events},d.record.map(decisionFromJSON));}
   }else{const primary=JSON.parse(readFileSync(join(privateDir,`${arm}.${d.id}.primary.json`),'utf8'));identity=prefixEqual3(primary.payloads,d.payloads,d.cutoff);}
   const evaluationArtifact=evaluation?artifact(`${arm}.${d.id}.evaluation.json`,evaluation):null;
   const row={arm,id:d.id,kind:d.kind,artifact:saved,evaluation:evaluationArtifact,identity,identity41,reportIdentical:evaluation?.reportIdentical??null,cursorFailed:evaluation?.cursorFailed??null,assessmentFailed:evaluation?.assessmentFailed??null,cost:d.cost,services:d.trace.length/8,targets,gcEvents:d.gc.length,maxGcMs:Math.max(0,...d.gc.map((g:any)=>g.duration)),maxNoInferenceMs:Math.max(...Array.from({length:d.trace.length/8},(_,i)=>d.inference.includes(i)?0:d.trace[i*8+1]-d.trace[i*8])),memoryBefore:d.memoryBefore,memoryAfter:d.memoryAfter,parentEvidenceMs:performance.now()-parentStart,parentMemory:process.memoryUsage()};rows.push(row);assert(identity&&identity41!==false&&evaluation?.reportIdentical!==false,'Payload/report identity');
   if(d.kind==='primary'&&rows.filter(r=>r.arm===arm&&r.kind==='primary').length%12===0)console.log(JSON.stringify({arm,completed:rows.filter(r=>r.arm===arm&&r.kind==='primary').length,targets:rows.filter(r=>r.arm===arm).flatMap(r=>r.targets).filter(t=>!t.inference&&t.wallMs>=100).length,heap:d.memoryAfter.heapUsed,elapsedSeconds:(performance.now()-started)/1000}));
   child.send({ack:d.id});
  }catch(error){failed=error as Error;child.kill('SIGKILL');rej(error);}});child.on('error',rej);child.on('exit',code=>{clearInterval(monitor);if(code===0&&done&&!failed)res();else rej(failed??Error(`Arm ${arm} exit ${code}`));});});
  sampleHost();const profiles=readdirSync(armDir).filter(p=>!p.endsWith('.heapsnapshot')).map(name=>({path:join(armDir,name),sha256:sha256(readFileSync(join(armDir,name)))}));assert(profiles.some(p=>p.path.endsWith('.cpuprofile')));assert(profiles.some(p=>p.path.endsWith('.heapprofile')));assert(profiles.some(p=>p.path.endsWith('trace.json')));
  const own=rows.filter(r=>r.arm===arm),primary=own.filter(r=>r.kind==='primary');assert.equal(primary.length,576);assert.equal(own.length,1168);arms.push({arm,examples:primary.length,executions:own.length,identical:primary.filter(r=>r.identity&&r.identity41).length,assessmentIdentical:primary.filter(r=>r.reportIdentical).length,prefixesAgree:own.filter(r=>r.kind!=='primary'&&r.identity).length,noInferenceTargets:own.flatMap(r=>r.targets.filter((t:any)=>!t.inference&&t.wallMs>=100).map((t:any)=>({id:r.id,kind:r.kind,...t}))),maxNoInferenceMs:Math.max(...own.map(r=>r.maxNoInferenceMs)),maxPrimaryCost:Math.max(...primary.map(r=>r.cost.ratio)),maxHeap:Math.max(...own.map(r=>r.memoryAfter.heapUsed)),profiles,snapshots:snapshotArtifacts,done});
 }
 const results=artifact('results.json',{rows,arms}),host={path:hostPath,sha256:sha256(readFileSync(hostPath))},scheduler={path:schedulerPath,sha256:sha256(readFileSync(schedulerPath))};
 const summary={...common,status:'measured-awaiting-attribution',startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-started)/1000,validation,results,host,scheduler,hostChecks:{samples:hostSamples,maxGap,maxLoad,ownPane,ownSession},arms,counts:{examples:576,measurements:rows.length,verifiedArtifacts:Object.keys(checked).length},stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:3,challengerComparisons:6,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};shape(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});console.log(JSON.stringify({complete:true,arms:arms.map(a=>({arm:a.arm,targets:a.noInferenceTargets,maxNoInferenceMs:a.maxNoInferenceMs,maxHeap:a.maxHeap})),elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completed:rows.length});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'infrastructure-failure',startedAt,failure,completed:rows}),{flag:'wx'});throw error;}
