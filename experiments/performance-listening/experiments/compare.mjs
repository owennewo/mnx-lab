import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {bench,root,readJSON,writeJSON,readWav,filesHash,hash} from '../evaluation/io.mjs';
import {harmonicDictionary,templateDictionary,createScorer} from '../detectors/spectral.mjs';
import {detectDSP} from '../detectors/stream.mjs';
import {createNeural} from '../detectors/neural.mjs';
import {evaluate,assessment,counts} from '../evaluation/metrics.mjs';
const audio=path.resolve(process.argv[2]??path.join(bench,'output/audio-v1'));
const output=path.resolve(process.argv[3]??path.join(bench,'output/run-v1'));
const limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]??Infinity);
if(fs.existsSync(output))throw Error(`Refusing to overwrite ${output}; choose a new run directory.`);
const manifestFile=path.join(audio,'manifest.json'),manifest=readJSON(manifestFile),config=readJSON(path.join(bench,'experiments/baseline.json'));
if(manifest.sampleRate!==config.sampleRate)throw Error('Sample-rate mismatch');
const samples=new Map();
for(const record of manifest.records){
 const loaded=readWav(path.join(audio,record.file));
 if(loaded.hash!==record.audioHash||loaded.sampleRate!==config.sampleRate)throw Error('Audio hash/sample rate mismatch: '+record.file);
 samples.set(record.file,loaded.samples);
}
const templates=new Map(manifest.records.filter(r=>r.split==='template'&&r.preset===config.templatePreset).map(r=>[r.actual[0].pitch,samples.get(r.file)]));
const harmonic=createScorer(harmonicDictionary(config),'harmonic',config);
const template=createScorer(templateDictionary(templates,config),'template',config);
const provenance={version:1,createdAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 sourceHashes:filesHash(bench,p=>/^(node_modules|output|findings)(\/|$)/.test(p)),manifestHash:hash(fs.readFileSync(manifestFile)),config,
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length},
 algorithms:{harmonic:'v1: twelve 1/h harmonics, Gaussian bin width .8, greedy matching pursuit',template:'v1: isolated archtop .45–.75s mean magnitude, nonnegative coordinate descent',shared:'Hann trailing FFT; two-frame activity gate; no restrike detector; coefficients uncalibrated'},
 audioDirectory:path.relative(output,audio),audioManifest:manifest,limit:Number.isFinite(limit)?limit:null};
const results=[];let neural,failures=0;
try{neural=await createNeural(config);provenance.neural=neural.provenance;}catch(error){provenance.neural={status:'unavailable',reason:String(error)};failures++;}
const records=manifest.records.filter(r=>r.split==='evaluation').slice(0,limit);
for(const record of records) {
 const pcm=samples.get(record.file),duration=pcm.length/config.sampleRate;
 for(const [strategy,scorer] of [['harmonic',harmonic],['template',template],['neural',null]]) {
  for(const mode of ['offline',...config.streamChunks.map(n=>`stream-${n}`)]) {
   const base={fixture:record.id,preset:record.preset,category:record.category,strategy,mode,audioHash:record.audioHash};
   if(strategy==='neural'&&(mode!=='offline'||!neural)){
    results.push({...base,status:'unavailable',reason:!neural?provenance.neural.reason:'Upstream adapter requires whole-file context; causal neural inference is not implemented.'});continue;
   }
   try {
    const detection=strategy==='neural'?await neural.detect(pcm):detectDSP(pcm,scorer,config,mode==='offline'?pcm.length:Number(mode.split('-')[1]));
    const metrics=evaluate(record.actual,detection.events,duration,config);
    results.push({...base,status:'ok',duration,detection,metrics,assessment:assessment(record.target,record.actual,detection.events,config)});
   }catch(error){results.push({...base,status:'failed',reason:String(error)});failures++;}
  }
 }
 writeJSON(path.join(output,'results.json'),{...provenance,results});
 console.log(`${record.preset}/${record.id}: ${results.length} outcomes, ${failures} failures`);
}
neural?.dispose();
function summarize(selected){
 const good=selected.filter(r=>r.status==='ok');
 const sum=f=>good.reduce((s,r)=>s+f(r),0);
 const onset=counts(sum(r=>r.metrics.onset.tp),sum(r=>r.metrics.onset.fp),sum(r=>r.metrics.onset.fn));
 const active=counts(sum(r=>r.metrics.active.tp),sum(r=>r.metrics.active.fp),sum(r=>r.metrics.active.fn));
 const activeFrames=sum(r=>r.metrics.activeFrames);
 return {runs:good.length,unavailable:selected.filter(r=>r.status==='unavailable').length,failed:selected.filter(r=>r.status==='failed').length,onset,active,
 exactChordRate:activeFrames?sum(r=>r.metrics.exactActiveFrames)/activeFrames:null,
 realTimeFactor:good.length?sum(r=>r.detection.cpuMs)/1000/sum(r=>r.duration):null,
 maxBacklog:good.some(r=>r.detection.maxBacklog!==null)?Math.max(...good.map(r=>r.detection.maxBacklog??0)):null,
 falseAccusations:sum(r=>r.assessment.falseAccusations),missedUnexpectedAttacks:sum(r=>r.assessment.missedUnexpectedAttacks),unassessedTargetEvents:sum(r=>r.assessment.unassessedTargetEvents)};
}
const groups={};
for(const result of results){const key=`${result.strategy}/${result.mode}/${result.preset}`;groups[key]??=[];groups[key].push(result);}
const summary={...provenance,audioManifest:undefined,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,summarize(v)])),
 categories:Object.fromEntries([...new Set(results.map(r=>`${r.strategy}/${r.mode}/${r.preset}/${r.category}`))].map(k=>[k,summarize(results.filter(r=>`${r.strategy}/${r.mode}/${r.preset}/${r.category}`===k))]))};
writeJSON(path.join(output,'summary.json'),summary);
console.log(`Comparison saved: ${output}`);
if(failures)process.exitCode=1;
