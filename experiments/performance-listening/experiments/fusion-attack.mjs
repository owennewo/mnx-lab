import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {bench, root, readJSON, readWav, writeJSON, hash, filesHash} from '../evaluation/io.mjs';
import {harmonicDictionary, createScorer} from '../detectors/spectral.mjs';
import {detectDSP} from '../detectors/stream.mjs';
import {evaluate, assessment, counts, quantile, attacks} from '../evaluation/metrics.mjs';
const output = path.resolve(process.argv[2] ?? path.join(bench,'output/fusion-attack-v1'));
if(fs.existsSync(output)) throw Error('Refusing to overwrite '+output);
const config=readJSON(path.join(bench,'experiments/baseline.json'));
const plan=readJSON(path.join(bench,'experiments/fusion-attack.json'));
const scorer=createScorer(harmonicDictionary(config),'harmonic',config);
const recipes=[{id:'F-000',config}];
for(const threshold of plan.thresholds) for(const refractorySeconds of plan.refractorySeconds) for(const associationSeconds of plan.associationSeconds)
 recipes.push({id:`F-001-${String(recipes.length).padStart(2,'0')}`,config:{...config,fusion:{threshold,refractorySeconds,associationSeconds}}});
function loadAudio(name) {
 const directory=path.join(bench,'output',name), bytes=fs.readFileSync(path.join(directory,'manifest.json')), manifest=JSON.parse(bytes);
 if(manifest.sampleRate!==config.sampleRate) throw Error('Sample rate mismatch');
 const records=manifest.records.filter(r=>r.split==='evaluation').map(r=>{
  const wav=readWav(path.join(directory,r.file));
  if(wav.hash!==r.audioHash || wav.sampleRate!==config.sampleRate) throw Error('Frozen audio mismatch '+r.file);
  return {...r,pcm:wav.samples};
 });
 return {directory,manifest,manifestHash:hash(bytes),records};
}
const baselinePath=process.env.FUSION_PARENT_RESULTS ?? path.join(bench,'output/run-v1/results.json');
const archived=readJSON(baselinePath).results;
const provenance={createdAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHashes:filesHash(bench,p=>/^(node_modules|output|findings)(\/|$)/.test(p)),plan,recipes,environment:{node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform,arch:process.arch}};
writeJSON(path.join(output,'provenance.json'),provenance);
const group=r=>r.category==='overlap'?'arpeggio':r.category==='restrike'?'repeated':r.category;
function summarize(rows) {
 const sum=f=>rows.reduce((s,r)=>s+f(r),0);
 const metric=k=>counts(sum(r=>r.metrics[k].tp),sum(r=>r.metrics[k].fp),sum(r=>r.metrics[k].fn));
 return {cases:rows.length,onset:metric('onset'),active:metric('active'),falseAccusations:sum(r=>r.assessment.falseAccusations),missedUnexpectedAttacks:sum(r=>r.assessment.missedUnexpectedAttacks),unassessedTargetEvents:sum(r=>r.assessment.unassessedTargetEvents),latencyP95:quantile(rows.flatMap(r=>r.latencies.map(x=>x.seconds)),.95),maxBacklog:Math.max(0,...rows.map(r=>r.detection.maxBacklog)),cpuMs:sum(r=>r.detection.cpuMs),duration:sum(r=>r.duration)};
}
function compare(parent,candidate,timings) {
 const a=summarize(parent),b=summarize(candidate),categories={};
 for(const category of new Set(parent.map(group))) categories[category]={parent:summarize(parent.filter(r=>group(r)===category)),candidate:summarize(candidate.filter(r=>group(r)===category))};
 const commonA=[],commonB=[];
 parent.forEach((r,i)=>{
  const other=new Map(candidate[i].latencies.map(l=>[l.truth,l.seconds]));
  for(const l of r.latencies) if(other.has(l.truth)) {commonA.push(l.seconds);commonB.push(other.get(l.truth));}
 });
 const cpuRatio=quantile(timings.candidate,.5)/quantile(timings.parent,.5);
 const common={count:commonA.length,parentP95:quantile(commonA,.95),candidateP95:quantile(commonB,.95)};
 const failures=[];
 const repeat=categories.repeated;
 for(const metric of ['precision','recall']) if(!repeat || repeat.candidate.onset[metric]===null || !(repeat.candidate.onset[metric]>repeat.parent.onset[metric])) failures.push('repeat '+metric+' did not improve');
 for(const [name,pair] of [['overall',{parent:a,candidate:b}],...['single','arpeggio','strum'].filter(k=>categories[k]).map(k=>[k,categories[k]])])
  for(const metric of ['onset','active']) if(pair.candidate[metric].f1 < pair.parent[metric].f1-plan.budgets.regressionF1Drop) failures.push(name+' '+metric+' F1 regression');
 if(b.falseAccusations>a.falseAccusations) failures.push('more false accusations');
 if(cpuRatio>plan.budgets.cpuRatio) failures.push('processing budget');
 if(b.latencyP95===null || b.latencyP95-a.latencyP95>plan.budgets.p95IncreaseSeconds) failures.push('latency budget');
 if(!common.count || common.candidateP95-common.parentP95>plan.budgets.p95IncreaseSeconds) failures.push('common-match latency budget');
 return {parent:a,candidate:b,categories,byPreset:Object.fromEntries([...new Set(parent.map(r=>r.preset))].map(p=>[p,{parent:summarize(parent.filter(r=>r.preset===p)),candidate:summarize(candidate.filter(r=>r.preset===p))}])),timings,cpuRatio,common,failures,eligible:!failures.length};
}
async function run(audio,selected,label) {
 const outcomes=new Map(selected.map(r=>[r.id,[]])), timings=new Map(selected.map(r=>[r.id,[]]));
 // Warm both branch shapes before recording wall time. Never share derived spectra.
 for(const recipe of selected) detectDSP(audio.records.find(r=>r.actual.length).pcm,scorer,recipe.config,plan.chunkSize);
 for(let pass=0;pass<plan.timingRepeats;pass++) {
  const totals=new Map(selected.map(r=>[r.id,0]));
  for(let index=0;index<audio.records.length;index++) {
   const record=audio.records[index];
   const order=(index+pass)%2?[...selected].reverse():selected;
   for(const recipe of order) {
    const detection=detectDSP(record.pcm,scorer,recipe.config,plan.chunkSize);
    totals.set(recipe.id,totals.get(recipe.id)+detection.cpuMs);
    if(pass===0) {
     const duration=record.pcm.length/config.sampleRate, metrics=evaluate(record.actual,detection.events,duration,config),truth=attacks(record.actual);
     outcomes.get(recipe.id).push({fixture:record.id,preset:record.preset,category:record.category,strategy:recipe.id,mode:'stream-256',status:'ok',audioHash:record.audioHash,duration,detection,metrics,assessment:assessment(record.target,record.actual,detection.events,config),latencies:metrics.matched.map(p=>({truth:p.expected,seconds:detection.events[p.predicted].emittedAt-truth[p.expected].start}))});
    }
   }
  }
  for(const recipe of selected) timings.get(recipe.id).push(totals.get(recipe.id));
  writeJSON(path.join(output,label+'-timing-checkpoint.json'),Object.fromEntries(timings));
  console.log(`${label} pass ${pass+1}/${plan.timingRepeats} complete`);
 }
 const summaries=selected.slice(1).map(r=>({id:r.id,...compare(outcomes.get('F-000'),outcomes.get(r.id),{parent:timings.get('F-000'),candidate:timings.get(r.id)})}));
 writeJSON(path.join(output,label+'-results.json'),{...provenance,audioDirectory:path.relative(output,audio.directory),audioManifest:audio.manifest,manifestHash:audio.manifestHash,results:[...outcomes.values()].flat()});
 writeJSON(path.join(output,label+'-summary.json'),summaries);
 return {summaries,outcomes};
}
const development=loadAudio('audio-v1');
const dev=await run(development,recipes,'development');
// Musical and decision-sample identity against the archived pre-fusion parent.
const musical=events=>events.map(({pitch,start,end,confidence,decisionSample})=>({pitch,start,end,confidence,decisionSample}));
for(const result of dev.outcomes.get('F-000')) {
 const original=archived.find(r=>r.strategy==='harmonic'&&r.mode==='stream-256'&&r.fixture===result.fixture&&r.preset===result.preset);
 if(!original || original.audioHash!==result.audioHash || JSON.stringify(musical(original.detection.events))!==JSON.stringify(musical(result.detection.events))) throw Error('Parent changed: '+result.preset+'/'+result.fixture);
}
const rank=(a,b)=>b.categories.repeated.candidate.onset.f1-a.categories.repeated.candidate.onset.f1 || b.candidate.onset.f1-a.candidate.onset.f1 || a.id.localeCompare(b.id);
const eligible=dev.summaries.filter(r=>r.eligible).sort(rank), best=eligible[0]??[...dev.summaries].sort(rank)[0];
const selection={id:best.id,developmentEligible:best.eligible,disposition:best.eligible?'provisional':'revise',parentIdentityCases:dev.outcomes.get('F-000').length,reason:best.failures,lockedAt:new Date().toISOString()};
writeJSON(path.join(output,'selection.json'),selection);
console.log('Locked selection',selection);
const held=await run(loadAudio('audio-fusion-heldout-v1'),[recipes[0],recipes.find(r=>r.id===best.id)],'heldout');
writeJSON(path.join(output,'decision.json'),{...selection,disposition:best.eligible&&held.summaries[0].eligible?'keep-provisionally':'revise',heldoutFailures:held.summaries[0].failures});
console.log('Done',output);
