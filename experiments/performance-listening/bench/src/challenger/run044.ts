/** Guarded bounded diagnosis, never a stage evaluation. */
import assert from 'node:assert/strict';
import {fork,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,readlinkSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {assetPath} from '../stages/stage1v2.ts';
import {prefixEqual3} from './streaming3.ts';
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&/^g044a?-challenger-stall-diagnosis$/.test(runId!));
const repo=resolve(EXPERIMENT,'../..'),git=(...a:string[])=>execFileSync('git',a,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit source before running');
const commit=git('rev-parse','HEAD'),report='experiments/performance-listening/reports/044-challenger-stall-diagnosis.md';
const prereg=git('log','--diff-filter=A','--format=%H','--',report).split('\n').at(-1)!;git('merge-base','--is-ancestor',prereg,'origin/main');assert.equal(git('show',`${prereg}:${report}`),readFileSync(resolve(repo,report),'utf8').trim());assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit);
const privateDir=resolve(dataRoot,'diagnostic-runs',runId!),publicDir=join(EXPERIMENT,'runs',runId!);assert(!existsSync(privateDir)&&!existsSync(publicDir));
const sourcePaths=git('ls-files','--','src/audio','src/model','experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/sources').split('\n').filter(p=>/\.(ts|mjs|py|json|md)$/.test(p));
const sourceHashes=Object.fromEntries([...sourcePaths,'package-lock.json',report].map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const common={id:runId,gitCommit:commit,preregistrationCommit:prereg,modelAndTool:'GPT-6.1-Sol (high) in Codex',sourceHashes,stageClaim:false,promotion:false,newVersions:0,heldOutReservedAccesses:0,suiteMode:'fixed 99-example diagnostic panel, two harness arms; no stage verdict'};
const shape=(s:any)=>{assert.equal(s.id,runId);assert(Array.isArray(s.arms));assert(s.results.path&&s.results.sha256.length===64);return Buffer.byteLength(encode(s));};shape({...common,arms:[],results:{path:'dry',sha256:'0'.repeat(64)}});
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown)=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const checked:Record<string,string>={};const verify=(a:{path:string;sha256:string})=>{const bytes=readFileSync(a.path);assert.equal(sha256(bytes),a.sha256,a.path);checked[a.path]=a.sha256;return a.path.endsWith('.json')?JSON.parse(bytes.toString()):bytes;};
const ancestors=new Set<number>();let ancestor=process.pid;while(ancestor>1){ancestors.add(ancestor);try{const stat=readFileSync(`/proc/${ancestor}/stat`,'utf8');ancestor=Number(stat.slice(stat.lastIndexOf(')')+2).split(' ')[1]);}catch{break;}}
const startedAt=new Date().toISOString(),started=performance.now(),rows:any[]=[],host:any[]=[];
const snapshot=()=>{const processes:any[]=[];for(const pid of readdirSync('/proc').filter(p=>/^\d+$/.test(p))){try{const raw=readFileSync(`/proc/${pid}/stat`,'utf8'),tail=raw.slice(raw.lastIndexOf(')')+2).split(' '),comm=readFileSync(`/proc/${pid}/comm`,'utf8').trim();if(/codex|claude|node|npm|python|vitest|workerd|chrome/.test(comm)){let cwd:string|null=null;try{cwd=readlinkSync(`/proc/${pid}/cwd`);}catch{}processes.push({pid:Number(pid),comm,cpuTicks:Number(tail[11])+Number(tail[12]),cwd});}}catch{}}
 return {at:new Date().toISOString(),mono:performance.now(),load:readFileSync('/proc/loadavg','utf8').trim(),processes};};
try{
 const oldPath=join(EXPERIMENT,'runs/g043-challenger-guitar-stage/summary.json'),oldBytes=readFileSync(oldPath),old=JSON.parse(oldBytes.toString()),results=verify(old.results),graph=verify(old.graph);verify({path:graph.path,sha256:graph.sha256});assert.equal(graph.sha256,'e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d');
 for(const [p,h] of Object.entries(old.sourceHashes as Record<string,string>))if(/^(bench\/src\/|listen\/|\.\.\/\.\.\/src\/)/.test(p)||p.endsWith('package-lock.json'))assert.equal(sha256(readFileSync(resolve(EXPERIMENT,p))),h,`Frozen source changed ${p}`);
 const manifestArtifact={path:resolve(dataRoot,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8'},manifest=verify(manifestArtifact);
 const examples=manifest.examples.filter((e:any)=>!e.of.includes('-h-')||e.of==='fender-h-s2-90-2000');assert.equal(examples.length,99);
 const previous=new Map<string,any>();for(const e of examples){verify({path:e.audioPath,sha256:e.label.audio.sha256});verify({path:assetPath(e.scorePath),sha256:e.label.score.sha256});const row=results.rows.find((r:any)=>r.implementation==='challenger'&&r.id===e.id);assert(row);previous.set(e.id,verify(row.artifact));}
 const validation=artifact('validation.json',{checked,oldSummary:{path:oldPath,sha256:sha256(oldBytes)},manifest:manifestArtifact,graph:old.graph,panel:examples.map((e:any)=>e.id)});
 const config=artifact('config.json',{graph:graph.path,privateDir,examples:examples.map((e:any)=>({id:e.id,scorePath:assetPath(e.scorePath),audioPath:e.audioPath}))});
 const arms:any[]=[];
 for(const arm of ['A','B']){
  const armDir=join(privateDir,arm);mkdirSync(armDir);host.push(snapshot());
  const child=fork(resolve(EXPERIMENT,'bench/src/challenger/child044.ts'),[config.path,arm],{execArgv:['--import','tsx','--cpu-prof',`--cpu-prof-dir=${armDir}`,'--trace-event-categories=v8',`--trace-event-file-pattern=${armDir}/trace.json`],stdio:['ignore','pipe','pipe','ipc']});
  let stdout='',stderr='',done:any=null;let previousHost=host.at(-1);let interference=false;child.stdout!.on('data',b=>{stdout+=b;});child.stderr!.on('data',b=>{stderr+=b;});
  const timer=setInterval(()=>{const s=snapshot();for(const p of s.processes){const old=previousHost.processes.find((q:any)=>q.pid===p.pid);if(/codex|claude/.test(p.comm)&&!ancestors.has(p.pid)&&old&&p.cpuTicks-old.cpuTicks>=5){interference=true;child.kill('SIGTERM');}}previousHost=s;const threads:any[]=[];try{for(const tid of readdirSync(`/proc/${child.pid}/task`)){try{threads.push({tid:Number(tid),sched:readFileSync(`/proc/${child.pid}/task/${tid}/schedstat`,'utf8').trim()});}catch{}}}catch{}host.push({...s,child:child.pid,arm,threads});},200);
  await new Promise<void>((resolveDone,reject)=>{
   child.on('message',(message:any)=>{try{if(message.type==='done'){done=message;return;}assert.equal(message.type,'example');const r=message.result,e=examples.find((e:any)=>e.id===r.id);assert(e);
    const path=join(privateDir,`${arm}.${r.id}.json`);if(arm==='B')writeFileSync(path,encode(r),{flag:'wx'});const saved={path,sha256:sha256(readFileSync(path))};
    const identity=prefixEqual3(r.payloads,previous.get(r.id).payloads,Math.round(e.label.duration*48000));const targets:any[]=[],services=r.trace.length/8;
    for(let i=0;i<services;i++){const [start,end,cpu0,cpu1,wait0,wait1]=r.trace.slice(i*8,i*8+6),wall=end-start;if(wall<50)continue;
     const overlap=r.gc.reduce((sum:number,g:any)=>sum+Math.max(0,Math.min(end,g.end)-Math.max(start,g.start)),0);targets.push({service:i,samples:i===0?0:Math.min(i*480,Math.round(e.label.duration*48000)),inference:r.inference.includes(i),wallMs:wall,cpuMs:(cpu1-cpu0)/1e6,runqueueMs:(wait1-wait0)/1e6,gcOverlapMs:overlap,explanationFraction:(overlap+(wait1-wait0)/1e6)/wall});}
    const row={arm,id:r.id,artifact:saved,identity,cost:r.cost,services,targets,gcEvents:r.gc.length,maxGcMs:Math.max(0,...r.gc.map((g:any)=>g.duration)),maxNoInferenceMs:Math.max(...Array.from({length:services},(_,i)=>r.inference.includes(i)?0:r.trace[i*8+1]-r.trace[i*8]))};rows.push(row);console.log(JSON.stringify({arm,completed:rows.filter(r=>r.arm===arm).length,id:r.id,ratio:r.cost.ratio,maxNoInferenceMs:row.maxNoInferenceMs,identity,targets:targets.length}));child.send({ack:r.id});
   }catch(error){child.kill('SIGKILL');reject(error);}});
   child.on('error',reject);child.on('exit',(code)=>{clearInterval(timer);if(code===0&&done&&!interference)resolveDone();else reject(Error(`Arm ${arm} exit ${code}: ${stderr}`));});
  });
  host.push(snapshot());artifact(`${arm}.console.json`,{stdout,stderr,done});
  const profiles=readdirSync(armDir).map(name=>({path:join(armDir,name),sha256:sha256(readFileSync(join(armDir,name)))}));assert(profiles.some(p=>p.path.endsWith('.cpuprofile')));assert(profiles.some(p=>p.path.endsWith('trace.json')));
  const own=rows.filter(r=>r.arm===arm);assert.equal(own.length,99);arms.push({arm,examples:own.length,identical:own.filter(r=>r.identity).length,noInferenceTargets:own.flatMap(r=>r.targets.filter((t:any)=>!t.inference&&t.wallMs>=100).map((t:any)=>({id:r.id,...t}))),maxNoInferenceMs:Math.max(...own.map(r=>r.maxNoInferenceMs)),maxCost:Math.max(...own.map(r=>r.cost.ratio)),profiles});
 }
 const result=artifact('results.json',{rows,arms}),hostArtifact=artifact('host.json',host);
 const summary={...common,status:'measured-awaiting-attribution',startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-started)/1000,validation,results:result,host:hostArtifact,arms,counts:{examples:99,measurements:rows.length,identical:rows.filter(r=>r.identity).length,verifiedArtifacts:Object.keys(checked).length},stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:3,challengerComparisons:5,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};shape(summary);writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});console.log(JSON.stringify({complete:true,arms,elapsedSeconds:summary.elapsedSeconds}));
}catch(error){const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completed:rows.length});writeFileSync(join(publicDir,'summary.json'),encode({...common,status:'infrastructure-failure',startedAt,failure,completed:rows}),{flag:'wx'});throw error;}
