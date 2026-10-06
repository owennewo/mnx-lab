/** Read-only check of g052's saved records: hashes, every margin recomputed, the selection re-chosen. Runs no listener. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {EXPERIMENT,sha256} from '../io.ts';
import {chooseSentinels3,exampleMargin3} from '../events/gates3.ts';
const runId=process.argv[2]??'g052-sentinel-instrument';
const s=JSON.parse(readFileSync(join(EXPERIMENT,'runs',runId,'summary.json'),'utf8'));
for(const [p,h] of Object.entries(s.sourceHashes as Record<string,string>))if(p.startsWith('bench/src/events/'))
 assert.equal(sha256(readFileSync(join(EXPERIMENT,p))),h,`${p} changed since ${s.gitCommit}; check out tag ${runId}-source to verify`);
const read=(a:{path:string;sha256:string})=>{const b=readFileSync(a.path.startsWith('/')?a.path:join(EXPERIMENT,a.path));assert.equal(sha256(b),a.sha256,a.path);return b;};
read(s.evidence.summary);read(s.evidence.manifest);
const results=JSON.parse(read(s.evidence.results).toString()),margins=JSON.parse(read(s.margins).toString());
const rows=new Map<string,any>(results.rows.filter((r:any)=>r.implementation==='challenger').map((r:any)=>[r.id,r]));
assert.equal(margins.records.length,rows.size);
for(const m of margins.records) {
 const row=rows.get(m.id),f=row.following,sec=f.asDecided.seconds,a=row.assessment,supported=row.kind==='performance';
 const r=exampleMargin3({clock:'compute-inclusive',supported,exposure:f.exposure.seconds/sec.answerable,longest:f.exposure.longest,sustained:row.costRatio,
  gates:!row.cursorFailed.length&&!row.assessmentFailed.length&&row.costPass,causality:row.prefixes.map((p:any)=>p.pass),
  ...(supported?{onEvent:sec.onEvent/sec.supportedAnswerable,ahead:sec.ahead/sec.supportedAnswerable,delays:f.byEvent.events.map((e:any)=>e.reached&&e.delay!==null?e.delay:null),
   overallError:a.overall.expected===null?null:a.overall.error,intervals:a.intervals.errors.map((e:any)=>({expectedSeconds:e.expected,errorSeconds:e.seconds}))}:{rejection:sec.correctRejection/sec.answerable})});
 assert.equal(r.margin,m.margin,m.id);assert.deepEqual(r.limiting,m.limiting,m.id);
}
const byId=new Map<string,any>(margins.records.map((r:any)=>[r.id,r]));
for(const [id,sel] of Object.entries(s.selections as Record<string,any>)) {
 const part=id==='guitar-stage1'?'clean':'hesitation',pool=margins.records.filter((r:any)=>r.part===part);
 const chosen=chooseSentinels3({deviation:sel.deviation},pool.filter((r:any)=>r.kind==='performance').map((r:any)=>({id:r.id,score:r.score,deviation:r.deviation,tempo:r.tempo,pause:r.pause,margin:r.margin})),
  pool.filter((r:any)=>r.kind==='control').map((r:any)=>({id:r.id,parent:r.parent,kind:r.control,margin:r.margin})));
 assert.deepEqual(chosen.performances,sel.performances.map((x:any)=>x.id),id);assert.deepEqual(chosen.controls,sel.controls.map((x:any)=>x.id),id);
 for(const x of [...sel.performances,...sel.controls])assert.equal(byId.get(x.id).margin,x.margin);
}
const suite=JSON.parse(readFileSync(join(EXPERIMENT,s.suiteRecord.path),'utf8'));
for(const st of suite.stages)assert.deepEqual(st.sentinels.map((x:any)=>x.id),[...s.selections[st.id].performances,...s.selections[st.id].controls].map((x:any)=>x.id));
assert.deepEqual(suite.margins,s.margins);
if(suite.selection==='provisional')assert.equal(sha256(readFileSync(join(EXPERIMENT,s.suiteRecord.path))),s.suiteRecord.sha256);
console.log(`${runId}: ${margins.records.length} margins recomputed exactly; selections and suite record agree (${suite.selection}).`);
