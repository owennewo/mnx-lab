import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { templates, frames, similarity, quantiles, frontier, STEP, WINDOW, RATE, type Version } from './features.ts';
import { readWav } from '../generate/wav.ts';
import { positionAt, validateProxy, type ProxyReference } from '../proxy/reference.ts';
import { EXPERIMENT, encode } from '../io.ts';
import { value, type Decision } from '../types.ts';
import { machine } from '../run/runner.ts';
const set=resolve(process.argv[2]??''),id='g003-recognition-at-sync',sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
for(let at=set;;at=dirname(at)){if(existsSync(join(at,'.git')))throw new Error('Private evidence must stay outside git');if(at===dirname(at))break;}
const bytes=readFileSync(join(set,'manifest.json')),manifest=JSON.parse(bytes.toString('utf8'));
if(sha(bytes)!==JSON.parse(readFileSync(join(set,'freeze.json'),'utf8')).sha256||sha(bytes)!=='80c8a6358751f356e164f75389dd50d49a2a0da6ad094f95847bd304eb5c5b8b')throw new Error('Expected unchanged experiment 002 set');
for(const [path,hash] of Object.entries(manifest.assets))if(sha(readFileSync(path))!==hash)throw new Error('Frozen asset changed');
const positive=manifest.examples.find((e:{id:string})=>e.id==='winner-positive'),negative=manifest.examples.find((e:{id:string})=>e.id==='winner-audio-dust-score'),silent=manifest.examples.find((e:{id:string})=>e.id==='digital-silence');
const reference=positive.reference as ProxyReference;validateProxy(reference);
const git=(...args:string[])=>execFileSync('git',args,{cwd:join(EXPERIMENT,'../..'),encoding:'utf8'}).trim();
if(git('status','--porcelain','--','experiments/performance-listening/bench/src','experiments/performance-listening/contracts/recognition-diagnostic-1.md','src/model','src/audio'))throw new Error('Commit diagnostic code and plan first');
const publicDir=join(EXPERIMENT,'runs',id),out=join(dirname(set),id);if(existsSync(out)||existsSync(publicDir))throw new Error('Diagnostic exists; never overwrite a run');
const historyPath=join(dirname(set),'sync-proxy-batch.json'),history=JSON.parse(readFileSync(historyPath,'utf8'));
if(history.runs.some((r:{status:string})=>r.status!=='complete')||history.assessments+2>12||history.cpuSeconds>=7200)throw new Error('Budget or incomplete run');
history.assessments+=2;history.runs.push({runId:id,kind:'privileged-alignment-diagnostic',status:'started',cpuSeconds:0});writeFileSync(historyPath,encode(history));mkdirSync(out);
const cpuStart=process.cpuUsage(),cpuNow=()=>{const c=process.cpuUsage(cpuStart);return(c.user+c.system)/1e6;};
try{
 const audio=readWav(readFileSync(positive.audioPath)),silence=readWav(readFileSync(silent.audioPath));
 const score=JSON.parse(readFileSync(positive.scorePath,'utf8')),dustScore=JSON.parse(readFileSync(negative.scorePath,'utf8'));
 const details:Record<string,unknown>={},results=[];
 for(const version of [1,2] as Version[]){
  const oldId=version===1?'g002a-spectral1-winner-sync-proxy':'g002b-spectral2-winner-sync-proxy';
  const old=JSON.parse(readFileSync(join(EXPERIMENT,'runs',oldId,'summary.json'),'utf8'));
  for(const [path,hash] of Object.entries(old.sourceHashes))if(sha(readFileSync(join(EXPERIMENT,path)))!==hash)throw new Error('Frozen implementation changed');
  const recordBytes=readFileSync(join(set,'runs',oldId,'records.json'));if(sha(recordBytes)!==old.privateRecordsSha256)throw new Error('Frozen decisions changed');
  const records=JSON.parse(recordBytes.toString('utf8'))[`spectral-follower@${version}/winner-positive`] as Decision[];
  const byClock=new Map(records.map(d=>[d.madeAt.toFixed(9),d]));
  const heard=frames(audio,version),winner=templates(score,version),dust=templates(dustScore,version),maxQ=(winner.length-1)*STEP;
  const audit:number[]=[];
  const rows=heard.map(f=>{
   const scores=winner.map(t=>similarity(t,f.feature)),dustScores=dust.map(t=>similarity(t,f.feature));
   const q=positionAt(reference,f.center)!.quarter,expected=f.center*manifest.nominalBpm/60;
   const inside=(i:number)=>i*STEP>=Math.max(0,.8*expected-.25)&&i*STEP<=Math.min(maxQ,1.2*expected+.25);
   const near=scores.filter((_,i)=>Math.abs(i*STEP-q)<=.25+1e-9),far=scores.filter((_,i)=>Math.abs(i*STEP-q)>.25+1e-9),localFar=scores.filter((_,i)=>inside(i)&&Math.abs(i*STEP-q)>.25+1e-9);
   if(!near.length)throw new Error('Reference outside template span');
   const dustLocal=dustScores.filter((_,i)=>inside(i));if(!dustLocal.length)throw new Error('No Dust competitor');
   const nearest=scores[Math.max(0,Math.min(scores.length-1,Math.round(q/STEP)))]!;
   const d=byClock.get(f.clock.toFixed(9));
   if(d?.kind==='position'&&value(d.candidates[0]!.position.quarters)<maxQ-1e-6){
    const chosen=value(d.candidates[0]!.position.quarters)-WINDOW/RATE/2*manifest.nominalBpm/60;
    const index=Math.round(chosen/STEP);if(index<0||index>=scores.length||Math.abs(index*STEP-chosen)>2e-6)throw new Error('Cannot recover original template cell');
    audit.push(Math.abs(scores[index]!-d.confidence!));
   }
   return {clock:f.clock,center:f.center,quarter:q,nearest,positive:Math.max(...near),wrong:localFar.length?Math.max(...localFar):null,globalWrong:far.length?Math.max(...far):null,dust:Math.max(...dustLocal),audible:f.rms>1e-4,
    offsets:[-.2,-.1,0,.1,.2].map(offset=>{const time=f.center+offset;if(time<0||time>reference.duration)return null;const at=positionAt(reference,time)!.quarter;return scores[Math.max(0,Math.min(scores.length-1,Math.round(at/STEP)))]!;})};
  });
  if(!audit.length||Math.max(...audit)>2e-6)throw new Error(`Feature reconstruction audit failed for ${version}`);
  const silenceFrames=frames(silence,version);if(silenceFrames.some(f=>f.rms>0||f.feature.some(v=>v!==0)))throw new Error('Silence reconstruction is nonzero');
  const margins=(key:'wrong'|'globalWrong')=>{const eligible=rows.filter(r=>r[key]!==null),m=eligible.map(r=>r.positive-r[key]!);return{count:eligible.length,wins:m.filter(v=>v>1e-9).length,ties:m.filter(v=>Math.abs(v)<=1e-9).length,losses:m.filter(v=>v< -1e-9).length,quantiles:quantiles(m)};};
  const common=rows.filter(r=>r.offsets.every(v=>v!==null));
  const threshold=frontier(rows);
  const offsets=[-.2,-.1,0,.1,.2].map((seconds,i)=>({seconds,count:common.length,accepted:common.filter(r=>r.audible&&r.offsets[i]!>=.65).length,rate:common.filter(r=>r.audible&&r.offsets[i]!>=.65).length/common.length}));
  results.push({version,frames:rows.length,clockSpan:[rows[0]!.clock,rows.at(-1)!.clock],audit:{compared:audit.length,maxAbsoluteDifference:Math.max(...audit)},nearest:{acceptance:rows.filter(r=>r.audible&&r.nearest>=.65).length/rows.length,similarity:quantiles(rows.map(r=>r.nearest))},localPositive:{similarity:quantiles(rows.map(r=>r.positive))},localWrong:{similarity:quantiles(rows.flatMap(r=>r.wrong===null?[]:[r.wrong])),margins:margins('wrong')},globalWrong:{margins:margins('globalWrong')},dust:{similarity:quantiles(rows.map(r=>r.dust))},silence:{frames:silenceFrames.length,rejection:1},threshold,offsets,interpretation:threshold.best.positive>=.95?'Single-cutoff separation is possible in this optimistic diagnostic; calibration merits a frozen end-to-end test.':'Even optimistic local alignment cannot reach 95% acceptance with each competitor at most 5%; prioritize discrimination before another tracker revision.'});
  details[`spectral-follower@${version}`]=rows;
  if(cpuNow()>300||history.cpuSeconds+cpuNow()>7200)throw new Error('Diagnostic CPU cap exceeded');
 }
 const cpuSeconds=cpuNow(),files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(join(dir,d.name)):[join(dir,d.name)]);
 const sourceFiles=[...files(join(EXPERIMENT,'bench/src')),join(EXPERIMENT,'contracts/recognition-diagnostic-1.md')];
 writeFileSync(join(out,'frames.json'),encode(details));
 const summary={id,kind:'privileged-alignment-diagnostic',policy:'recognition-diagnostic-1',set:manifest.id,setSha256:sha(bytes),gitCommit:git('rev-parse','HEAD'),machine:machine(),sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p.slice(EXPERIMENT.length),sha(readFileSync(p))])),reference:'Original sync interpolation at causal window center; acoustic precision unmeasured.',results,cpuSeconds,budget:{newCandidateVersions:0,chargedDiagnosticAssessments:2,totalCandidateVersions:history.candidateVersions.length,totalAssessments:history.assessments,totalCpuSeconds:history.cpuSeconds+cpuSeconds},decision:'Diagnostic complete; no candidate retention or scope expansion.',privateFramesSha256:sha(readFileSync(join(out,'frames.json')))};
 writeFileSync(join(out,'summary.json'),encode(summary));mkdirSync(publicDir,{recursive:true});writeFileSync(join(publicDir,'summary.json'),encode(summary));
 history.cpuSeconds+=cpuSeconds;Object.assign(history.runs.at(-1),{status:'complete',cpuSeconds,decision:summary.decision});writeFileSync(historyPath,encode(history));
 console.log(JSON.stringify({id,results,cpuSeconds,budget:summary.budget},null,2));
}catch(error){const cpuSeconds=cpuNow();history.cpuSeconds+=cpuSeconds;Object.assign(history.runs.at(-1),{status:'infrastructure-failure',cpuSeconds,error:String(error)});writeFileSync(historyPath,encode(history));writeFileSync(join(out,'failure.json'),encode(history.runs.at(-1)));throw error;}
