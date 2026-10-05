/** Guarded instrument-only run. No native inference or listener execution. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EXPERIMENT, encode, sha256 } from '../io.ts';
import { requireOutsideGit } from '../ladder/privateSets.ts';
import { oracle5, check5, inherited5, probes5 } from './seam5.ts';
const [dataRoot,runId] = process.argv.slice(2);
assert(dataRoot && runId && /^g042a?-challenger-finish-length$/.test(runId),'Usage run042.ts <data-root> <unused-run-id>');
const repo=resolve(EXPERIMENT,'../..'), git=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:32<<20}).trim();
assert.equal(git('status','--porcelain'),'','Commit implementation before checks');
const commit=git('rev-parse','HEAD'),report='experiments/performance-listening/reports/042-challenger-finish-length.md';
const prereg=git('log','--diff-filter=A','--format=%H','--',report).split('\n').at(-1)!;
git('merge-base','--is-ancestor',prereg,'origin/main');
assert.equal(git('show',`${prereg}:${report}`),readFileSync(resolve(repo,report),'utf8').trim(),'Preregistration changed');
assert.equal(git('rev-parse',`${runId}-source^{commit}`),commit,'Source tag must pin HEAD');
const privateDir=join(requireOutsideGit(dataRoot),'instrument-runs',runId), publicDir=join(EXPERIMENT,'runs',runId);
assert(!existsSync(privateDir)&&!existsSync(publicDir),'Run ID already exists');
const common={id:runId,modelAndTool:'GPT-6.1-Sol (high) in Codex',gitCommit:commit,preregistrationCommit:prereg,
 definition:'observation-seam@5',independentAudit:false,nativeInferences:0,listenersExecuted:0,cursorVerdicts:0,suiteChanges:0,
 heldOutReservedFinalAccesses:0,stopping:{main:0,challenger:2,mainVersions:3,mainComparisons:11,challengerVersions:3,challengerComparisons:4,explorationSpent:true,qualificationVersionsSpent:0,qualificationSlotsSpent:0}};
type Artifact={path:string;sha256:string};
type CaseRow={id:string;agrees:boolean;artifact:Artifact};
const assemble=(status:string,cases:CaseRow[],validation:Artifact|null,elapsedSeconds:number)=>({...common,status,cases,validation,elapsedSeconds,
 decision:'Independent seam5 audit and separate native 041 implementation review before formal guitar-stage judgment.'});
const dry=JSON.parse(encode(assemble('dry',[{id:'dry',agrees:true,artifact:{path:join(privateDir,'dry.json'),sha256:'0'.repeat(64)}}],null,0)));
assert.equal(dry.cases[0].artifact.sha256.length,64); assert.equal(dry.nativeInferences,0);
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
const artifact=(name:string,value:unknown):Artifact=>{const path=join(privateDir,name);writeFileSync(path,encode(value),{flag:'wx'});return {path,sha256:sha256(readFileSync(path))};};
const start=performance.now(),startedAt=new Date().toISOString();
const attempt=artifact('attempt.json',{...common,startedAt,dryAssembly:true});
const results:CaseRow[]=[];
try {
 const baseline=git('rev-parse',`${prereg}^`);
 const scopes=['experiments/performance-listening/bench','experiments/performance-listening/listen','experiments/performance-listening/contracts','experiments/performance-listening/runs','experiments/performance-listening/archive/ladder-1/runs','experiments/performance-listening/sources','src/model','src/audio'];
 const protectedPaths=git('ls-tree','-r','--name-only',baseline,'--',...scopes).split('\n').filter(Boolean);
 const protectedHashes:Record<string,string>={};
 for(const p of protectedPaths){const bytes=readFileSync(resolve(repo,p));const old=execFileSync('git',['show',`${baseline}:${p}`],{cwd:repo,maxBuffer:32<<20});assert.equal(sha256(bytes),sha256(old),`Protected source changed ${p}`);protectedHashes[p]=sha256(bytes);}
 const sourcePaths=['bench/src/challenger/seam5.ts','bench/src/challenger/run042.ts','bench/test/observation-seam-5.test.ts','bench/oracle-events/observation-seam-5.json','bench/oracle-events/freeze-observation-seam-5.json','contracts/observation-seam-5.md','reports/042-challenger-finish-length.md','../../package-lock.json'];
 const sourceHashes=Object.fromEntries(sourcePaths.map(p=>[p,sha256(readFileSync(resolve(EXPERIMENT,p)))]));
 const provenance=artifact('provenance.json',{baseline,protectedHashes,sourceHashes,nativeReviewOwner:'lab-review-041; independent work outside this experiment'});
 for(const c of oracle5()){const checked=check5(c);results.push({id:c.id,agrees:checked.agrees,artifact:artifact(`case-${c.id}.json`,checked)});}
 for(const c of inherited5())results.push({id:c.id,agrees:c.agrees,artifact:artifact(`inherited-${c.id}.json`,c)});
 const probes=probes5(),validation=artifact('validation.json',{probes,coverage:'Five scalar cases only; unchanged seam rules; no native adoption, acoustic, device or cold-start claim.'});
 const pass=results.every(r=>r.agrees)&&probes.every(p=>p.detected);
 const summary={...assemble(pass?'D1-agreement-pending-independent-audit':'D2-mixed',results,validation,(performance.now()-start)/1000),attempt,provenance,sourceHashes,startedAt,finishedAt:new Date().toISOString(),counts:{newCases:5,inheritedCases:results.length-5,agree:results.filter(r=>r.agrees).length,probesDetected:probes.filter(p=>p.detected).length,protectedFiles:protectedPaths.length}};
 writeFileSync(join(publicDir,'summary.json'),encode(summary),{flag:'wx'});
 console.log(encode({id:runId,status:summary.status,counts:summary.counts,elapsedSeconds:summary.elapsedSeconds,publicBytes:Buffer.byteLength(encode(summary))}));
} catch(error){
 const failure=artifact('failure.json',{message:String(error),stack:error instanceof Error?error.stack:null,completed:results.length});
 writeFileSync(join(publicDir,'summary.json'),encode({...assemble('D3-infrastructure',results,failure,(performance.now()-start)/1000),attempt,startedAt}),{flag:'wx'});
 throw error;
}
