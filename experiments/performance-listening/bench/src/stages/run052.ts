/** 052: stage-gates@3 margins and guitar sentinels from g050's recorded evidence. Runs no listener. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {requireOutsideGit} from '../ladder/privateSets.ts';
import {chooseSentinels,type SentinelInput} from '../events/gates2.ts';
import {STAGE_GATES_3,chooseSentinels3,exampleMargin3,severity,type Control3,type MarginEvidence,type Performance3} from '../events/gates3.ts';
import {faultSensitivity5,readOracle5,validateOracle5} from '../events/oracle5.ts';

type Artifact={path:string;sha256:string};
const PREREG='reports/052-sentinel-instrument.md',MODEL='Claude Opus 5.5 (high) in Claude Code';
const G050={path:'runs/g050-challenger-optimized-stage/summary.json',sha256:'eb6b51c725a8d4671c77614c80a058f42ba7f9ce6524eea0748dc0f323f0e659'};
const G050_RESULTS='9f3f30312cf73e5457d02a1f37e86e5d6137a331226469ec31f7a19b66ba363e';
const G051={path:'runs/g051-challenger-heldout-confirmation/summary.json'};
const MANIFEST_SHA='961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8';
const SUBSTAGES=[{id:'guitar-stage1',part:'clean',deviation:null},{id:'guitar-silent-hesitation',part:'hesitation',deviation:'hesitation'}] as const;
const [dataRoot,runId]=process.argv.slice(2);assert(dataRoot&&runId&&/^g052a?-sentinel-instrument$/.test(runId),'usage: run052.ts <data-root> <run-id>');
const repo=resolve(EXPERIMENT,'../..'),git=(...a:string[])=>execFileSync('git',a,{cwd:repo,encoding:'utf8',maxBuffer:64<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit implementation first');
const commit=git('rev-parse','HEAD'),reportPath=`experiments/performance-listening/${PREREG}`;
const prereg=git('log','--diff-filter=A','--format=%H','--',reportPath).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');
const preregText=git('show',`${prereg}:${reportPath}`);assert(readFileSync(join(EXPERIMENT,PREREG),'utf8').startsWith(preregText),'Pre-registration changed');
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit,'Tag the source commit first');
const root=requireOutsideGit(dataRoot),privateDir=join(root,'instrument-runs',runId),publicDir=join(EXPERIMENT,'runs',runId);
assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID exists');
const pinned=git('ls-files','--','experiments/performance-listening/bench/src/events','experiments/performance-listening/bench/src/stages/run052.ts',
 'experiments/performance-listening/bench/oracle-events/oracle-5.json','experiments/performance-listening/bench/oracle-events/freeze-5.json',
 'experiments/performance-listening/contracts/event-instruments-5.md',reportPath).split('\n');
const sourceHashes=Object.fromEntries(pinned.map(p=>[relative(EXPERIMENT,resolve(repo,p)),sha256(readFileSync(resolve(repo,p)))]));
const startedAt=new Date().toISOString(),tick=performance.now();
const read=(a:Artifact)=>{const p=a.path.startsWith('/')?a.path:join(EXPERIMENT,a.path),b=readFileSync(p);assert.equal(sha256(b),a.sha256,p);return b;};
const common={id:runId,modelAndTool:MODEL,gitCommit:commit,preregistrationCommit:prereg,sourceHashes,definition:'contracts/event-instruments-5.md',
 instrument:STAGE_GATES_3,oracle:'event-oracle@5',listenerRuns:0,lagOrCostMeasured:false,listener:'basic-pitch-chain@5-note-output',offlineListener:'basic-pitch-chain@2'};
const shape=(v:any)=>{const s=JSON.parse(encode(v));assert.equal(s.id,runId);assert(s.margins.path&&s.margins.sha256.length===64&&s.selections&&s.counts&&s.oracleValidation);return s;};
shape({...common,margins:{path:'x',sha256:'0'.repeat(64)},selections:{},counts:{},oracleValidation:{}});

// 1. The instrument against its frozen oracle, before any evidence is read.
const oracle=readOracle5(),checks=validateOracle5(oracle),faults=faultSensitivity5(oracle);
const oracleValidation={cases:checks.length,agree:checks.filter(c=>c.agrees).length,disagree:checks.filter(c=>!c.agrees).map(c=>`${c.group}:${c.id}`),
 faults:faults.length,faultsDetected:faults.filter(f=>f.detected).length};
assert.equal(oracleValidation.agree,oracleValidation.cases,`Oracle disagreement: ${oracleValidation.disagree}`);assert.equal(oracleValidation.faultsDetected,faults.length);

// 2. The recorded evidence, by hash.
const s050=JSON.parse(read(G050).toString());assert.equal(s050.results.sha256,G050_RESULTS);
const r050=JSON.parse(read(s050.results).toString());
const manifestArtifact={path:join(root,'contract2-challenger-guitar-noise-v1/manifest.json'),sha256:MANIFEST_SHA};
const manifest=new Map<string,any>(JSON.parse(read(manifestArtifact).toString()).examples.map((e:any)=>[e.id,e]));
const evidence=(row:any):MarginEvidence=>{
 const f=row.following,s=f.asDecided.seconds,a=row.assessment,supported=s.supportedAnswerable>0;
 assert.equal(supported,row.kind==='performance',`support ${row.id}`);
 return {clock:'compute-inclusive',supported,exposure:f.exposure.seconds/s.answerable,longest:f.exposure.longest,sustained:row.costRatio,
  gates:!row.cursorFailed.length&&!row.assessmentFailed.length&&row.costPass,causality:row.prefixes.map((p:any)=>p.pass),
  ...(supported?{onEvent:s.onEvent/s.supportedAnswerable,ahead:s.ahead/s.supportedAnswerable,
   delays:f.byEvent.events.map((e:any)=>e.reached&&e.delay!==null?e.delay:null),
   overallError:a.overall.expected===null?null:a.overall.error,
   intervals:a.intervals.errors.map((e:any)=>({expectedSeconds:e.expected,errorSeconds:e.seconds}))}:{rejection:s.correctRejection/s.answerable})};
};
const recipeOf=(row:any)=>{const r=row.label.provenance.recipe;
 if(r.deviation===undefined){assert.equal(r.stage,1);return {deviation:null,tempo:r.tempo};}
 assert.equal(r.deviation,'hesitation');const m=/^s[12]-(\d+)$/.exec(r.base);assert(m,`base ${row.id}`);return {deviation:'hesitation',tempo:Number(m[1]),pause:r.pause};};
const rows050=r050.rows.filter((r:any)=>r.implementation==='challenger');assert.equal(rows050.length,576);
const records=rows050.map((row:any)=>{
 read(row.artifact);const m=manifest.get(row.id);assert(m,`manifest ${row.id}`);
 const {margin,limiting}=exampleMargin3(evidence(row));
 const base={id:row.id,guitar:row.guitar,part:row.part,kind:row.kind,margin,limiting,artifact:row.artifact};
 if(row.kind==='performance'){assert.equal(m.kind,'performance');return {...base,score:m.score,...recipeOf(row)};}
 assert.equal(m.kind,'control');assert.equal(m.control,row.control);return {...base,control:row.control,parent:m.of};
});
const byId=new Map<string,any>(records.map((r:any)=>[r.id,r]));
for(const r of records)if(r.kind==='control'){const p=byId.get(r.parent);assert(p&&p.kind==='performance'&&p.part===r.part,`parent ${r.id}`);r.score=p.score;}
const marginsArtifact=(()=>{mkdirSync(privateDir,{recursive:true});const path=join(privateDir,'margins.json');
 writeFileSync(path,encode({run:runId,instrument:STAGE_GATES_3,evidence:{summary:G050,results:s050.results,manifest:manifestArtifact},records}),{flag:'wx'});
 return {path,sha256:sha256(readFileSync(path))};})();

// 3. Selection, ties, limiting entries and the stage-gates@2-rule comparison.
const ties=(xs:number[])=>{const c=new Map<number,number>();for(const x of xs)c.set(x,(c.get(x)??0)+1);return [...c.values()].filter(n=>n>1).reduce((s,n)=>s+n,0);};
const count=(xs:string[][])=>xs.flat().reduce((m:Record<string,number>,x)=>(m[x]=(m[x]??0)+1,m),{});
const selections:Record<string,any>={},comparison:Record<string,any>={};
for(const st of SUBSTAGES) {
 const pool=records.filter((r:any)=>r.part===st.part),perfs=pool.filter((r:any)=>r.kind==='performance'),ctrls=pool.filter((r:any)=>r.kind==='control');
 const P:Performance3[]=perfs.map((r:any)=>({id:r.id,score:r.score,deviation:r.deviation,tempo:r.tempo,...(r.pause!==undefined?{pause:r.pause}:{}),margin:r.margin}));
 const C:Control3[]=ctrls.map((r:any)=>({id:r.id,parent:r.parent,kind:r.control,margin:r.margin}));
 const chosen=chooseSentinels3({id:st.id,deviation:st.deviation},P,C);
 const candidates=perfs.filter((r:any)=>r.deviation===st.deviation),candidateIds=new Set(candidates.map((r:any)=>r.id));
 const candControls=ctrls.filter((r:any)=>candidateIds.has(r.parent));
 const groups=[...new Set(candControls.map((r:any)=>`${r.score}|${r.control}`))];
 const detail=(id:string)=>{const r=byId.get(id),p=r.kind==='performance'?r:byId.get(r.parent);
  return {id,guitar:r.guitar,score:r.score,kind:r.kind==='performance'?'performance':r.control,margin:r.margin,limiting:r.limiting,
   severity:severity(st.deviation,{...p,margin:0}),tempo:p.tempo,...(p.pause!==undefined?{pause:p.pause}:{}),...(r.parent?{parent:r.parent}:{}),artifact:r.artifact};};
 selections[st.id]={deviation:st.deviation,examples:pool.length,candidates:{performances:candidates.length,controls:candControls.length},
  exactTies:{performances:ties(candidates.map((r:any)=>r.margin)),controls:groups.reduce((s:number,g:any)=>s+ties(candControls.filter((r:any)=>`${r.score}|${r.control}`===g).map((r:any)=>r.margin)),0)},
  limiting:{performances:count(candidates.map((r:any)=>r.limiting)),controls:count(candControls.map((r:any)=>r.limiting))},
  leastMargin:{performance:Math.min(...candidates.map((r:any)=>r.margin)),control:Math.min(...candControls.map((r:any)=>r.margin))},
  performances:chosen.performances.map(detail),controls:chosen.controls.map(detail)};
 const inputs:SentinelInput[]=pool.map((r:any)=>({id:r.id,score:r.score,kind:r.kind==='performance'?'performance':r.control,margin:r.margin}));
 const two=chooseSentinels(inputs);
 comparison[st.id]={performances:two.performances.map(x=>x.id),controls:two.controls.map(x=>x.id),
  identical:JSON.stringify([two.performances.map(x=>x.id),two.controls.map(x=>x.id)])===JSON.stringify([chosen.performances,chosen.controls])};
}

// 4. Held-out margins, informational only: examined confirmation evidence, never a sentinel source.
const s051raw=readFileSync(join(EXPERIMENT,G051.path)),s051=JSON.parse(s051raw.toString()),r051=JSON.parse(read(s051.results).toString());
const held=r051.rows.filter((r:any)=>r.implementation==='challenger').map((row:any)=>({id:row.id,guitar:row.guitar,kind:row.kind,...exampleMargin3(evidence(row))}));
const heldOut={summary:{path:G051.path,sha256:sha256(s051raw)},results:s051.results,examples:held.length,
 perGuitar:Object.fromEntries([...new Set(held.map((r:any)=>r.guitar))].sort().map(g=>{const own=held.filter((r:any)=>r.guitar===g);
  const least=(k:string)=>own.filter((r:any)=>(r.kind==='performance')===(k==='performance')).sort((a:any,b:any)=>a.margin-b.margin)[0];
  return [g,{performance:(({id,margin,limiting})=>({id,margin,limiting}))(least('performance')),control:(({id,margin,limiting})=>({id,margin,limiting}))(least('control'))}];})),
 note:'Informational. The held-out sets are examined confirmation evidence; the contract chooses sentinels from a substage\'s passing evaluation (g050).'};

// 5. Records: the public summary, then the guitar suite record.
const allPerf=records.filter((r:any)=>r.kind==='performance'),allCtrl=records.filter((r:any)=>r.kind==='control');
const counts={examples:records.length,performances:allPerf.length,controls:allCtrl.length,refused:0,artifactsVerified:records.length,
 limiting:{performances:count(allPerf.map((r:any)=>r.limiting)),controls:count(allCtrl.map((r:any)=>r.limiting))},
 leastMargin:{performance:allPerf.reduce((a:any,b:any)=>b.margin<a.margin?b:a),control:allCtrl.reduce((a:any,b:any)=>b.margin<a.margin?b:a)}};
counts.leastMargin.performance=(({id,margin,limiting})=>({id,margin,limiting}))(counts.leastMargin.performance);
counts.leastMargin.control=(({id,margin,limiting})=>({id,margin,limiting}))(counts.leastMargin.control);
const routine=[...new Set(Object.values(selections).flatMap((s:any)=>[...s.performances,...s.controls].map((x:any)=>x.id)))].sort();
const set={id:'contract2-challenger-guitar-noise-v1',manifest:manifestArtifact};
const suite={format:'contract2-suite@2',policy:'contracts/development-contract-2.md',definition:'contracts/event-instruments-5.md',
 selection:'provisional',selectionNote:'Not used by any run until an independent session audits event-oracle@5; the audit makes it "in force", with its path and hash.',
 audit:null,selectionRun:{id:runId,summary:`runs/${runId}/summary.json`},
 promotion:'contracts/development-contract-2.md#amendment-2026-10-06-promotion-and-a-fast-loop',
 listener:{live:'basic-pitch-chain@5-note-output',offline:'basic-pitch-chain@2'},
 instruments:{following:'following-evaluator@2',assessment:'assessment-evaluator@3',gates:STAGE_GATES_3,oracles:['event-oracle@4','event-oracle@5'],seam:'observation-seam@5'},
 stages:SUBSTAGES.map(st=>({id:st.id,deviation:st.deviation,status:'passed',passEvidence:G050,set,
  examples:records.filter((r:any)=>r.part===st.part).map((r:any)=>r.id).sort(),
  candidates:selections[st.id].candidates,sentinels:[...selections[st.id].performances,...selections[st.id].controls]})),
 openSubstages:['guitar-held-note-hesitation','guitar-slowed-bar','guitar-four-bar-tempo','guitar-rushed-bar','guitar-missing-event','guitar-wrong-note-with-w1',
  'guitar-dead-note','guitar-extra-note','guitar-onset-jitter','guitar-frequency-offset','stage3-chords','stage4-microphone','stage5-categories'],
 sweepOnlySets:[{id:'contract2-challenger-heldout-guitar-v1',evidence:heldOut.summary,
  status:'Examined confirmation evidence since 051; development evidence from now on (lesson L11). Runs in full sweeps; chooses no sentinels.'}],
 retiredSets:[{sets:'every sine set (stage 1 and stage 2 on sines)',date:'2026-10-04',authority:'contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule',
  record:'bench/suite-record.json',runs:false}],
 comparators:{policy:'Run once on a set\'s examples the first time it is used, then cited by hash (third amendment, decision 4).',
  listeners:['event-chain@3','clock-follower@1','online-time-warp@8','online-time-warp@12','online-time-warp@14'],
  citations:[{...G050,use:'event-chain@3 on all 576 development examples; the four baselines on the 96 clean examples and their controls'},
   {...heldOut.summary,use:'event-chain@3 and the baselines on the held-out set, as 051 ran them'}]},
 lastFullSweep:'g050-challenger-optimized-stage',nextFullSweepNoLaterThan:55,
 routineRegressionIds:routine,margins:marginsArtifact};
const suitePath=join(EXPERIMENT,'bench/suite-record-guitar.json');writeFileSync(suitePath,encode(suite));
const summary=shape({...common,status:'complete',startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-tick)/1000,
 oracleValidation,evidence:{summary:G050,results:s050.results,manifest:manifestArtifact},margins:marginsArtifact,counts,selections,
 comparisonStageGates2:comparison,heldOut,suiteRecord:{path:'bench/suite-record-guitar.json',sha256:sha256(readFileSync(suitePath)),selection:'provisional'},
 routineRegressionIds:routine});
mkdirSync(publicDir,{recursive:true});writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});
console.log(JSON.stringify({oracle:oracleValidation,counts,ties:Object.fromEntries(Object.entries(selections).map(([k,v]:any)=>[k,v.exactTies])),
 sentinels:Object.fromEntries(Object.entries(selections).map(([k,v]:any)=>[k,[...v.performances,...v.controls].map((x:any)=>`${x.id} ${x.margin.toFixed(4)} ${x.limiting}`)])),
 comparison,heldOut:heldOut.perGuitar,bytes:Buffer.byteLength(encode(summary)),seconds:summary.elapsedSeconds},null,1));
