/** Instrument diagnostics only. All inputs are hand records; never call a listener. */
import {expectedAssessment3,evaluateAssessment3,reportedBars,type AssessmentReport3} from './assessment3.ts';
import {assessmentGates2,pooledGates2,chooseSentinels,nextState,normalizedMargin,canRetire,suitePlan,exampleMargin} from './gates2.ts';
import {expandReport2} from './oracle.ts';
import {withinTolerance} from './assessment2.ts';
import {eventPositions,validateLabel} from './label.ts';
import {caseLabel4,type Oracle4,type BarCase4,type ExampleCase4,type IntervalCase4} from './oracle4.ts';
export interface Check4 {group:string;id:string;agrees:boolean;expected:unknown;actual:unknown}
export function same4(a:unknown,b:unknown):boolean {
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>same4(v,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object')return Object.entries(b).every(([k,v])=>same4((a as Record<string,unknown>)[k],v));
 return a===b;
}
function handReport(c:BarCase4,bars:AssessmentReport3['tempo']['bars'],flags:BarCase4['flags']):AssessmentReport3 {
 const label=caseLabel4(c),sounded=c.onsets.flatMap((t,i)=>t===null?[]:[{i,t}]);
 const intervals=sounded.slice(1).map((b,k)=>[sounded[k]!.i,b.i,b.t-sounded[k]!.t] as [number,number,number]);
 const missing=Object.fromEntries(c.onsets.flatMap((t,i)=>t===null?[[`n${i}`,'missing' as const]]:[]));
 const r=expandReport2(label,{overall:c.expected.overall,intervals,flags,notes:{default:'match',overrides:missing}});
 return {...r,format:'assessment-report@3',tempo:{...r.tempo,bars}};
}
/** Explicit partial synthetic measurements, expanded only to fields the margin consumes. */
function synthetic(x:ExampleCase4):Parameters<typeof exampleMargin>[0] {
 const answerable=x.answerable??1;
 return {following:{asDecided:{seconds:{answerable,supportedAnswerable:x.supported?answerable:0,
  onEvent:(x.onEvent??0)*answerable,ahead:(x.ahead??0)*answerable,correctRejection:(x.rejection??0)*answerable}},
  exposure:{seconds:x.exposure*answerable,longest:x.longest},byEvent:{events:(x.delays??[]).map(delay=>({reached:delay!==null,delay}))}},
  assessment:{overall:{expected:x.supported?60:null,error:x.overallError??0},intervals:{errors:(x.intervals??[]).map(i=>({expected:i.expectedSeconds,seconds:i.errorSeconds}))}},
  cost:{sustainedRatio:x.sustained,p99Ms:x.p99},gates:{passed:x.gates},causality:x.causality.map(pass=>({pass}))} as unknown as Parameters<typeof exampleMargin>[0];
}
function intervalMargin(x:IntervalCase4):number {
 return exampleMargin(synthetic({id:x.id,supported:true,onEvent:1,ahead:0,exposure:0,longest:0,delays:[],overallError:0,
 intervals:[x],sustained:0,p99:0,gates:withinTolerance(x.expectedSeconds,x.errorSeconds),causality:[true]}));
}
const attempt=(fn:()=>unknown)=>{try{return fn();}catch{return 'rejected';}};
const select=(inputs:Parameters<typeof chooseSentinels>[0])=> {
 const s=chooseSentinels(inputs);return {performances:s.performances.map(x=>x.id),controls:s.controls.map(x=>x.id)};
};
export function validateOracle4(o:Oracle4):Check4[] {
 const checks:Check4[]=[];
 const check=(group:string,id:string,expected:unknown,fn:()=>unknown)=> {
  const actual=attempt(fn);checks.push({group,id,expected,actual,agrees:same4(actual,expected)});
 };
 for(const c of o.assessment) {
  check('assessment',c.id,c.expected,()=>{const label=caseLabel4(c);validateLabel(label);return expectedAssessment3(label);});
  check('reported-bars',c.id,c.expected.bars.map(({expected:_e,...b})=>b),()=> {
   const label=caseLabel4(c),r=handReport(c,[],[]),positions=eventPositions(label);
   return reportedBars(label.events.map((e,i)=>({quarter:e.quarter,at:positions[i]!})),r.tempo.intervals);
  });
 }
 const reports=new Map(o.reports.map(c=>{
  const b=o.assessment.find(b=>b.id===c.case)!;const label=caseLabel4(b);
  const assessment=evaluateAssessment3(label,handReport(b,c.bars,c.flags));
  check('report',c.id,c.expected,()=>({...assessment,gatesPassed:assessmentGates2(label,assessment).passed}));
  return [c.id,{label,assessment,following:null}] as const;
 }));
 // Oracle pool shorthand uses readable names; production names are found:kind/falseAlarms:kind.
 const poolName=(s:string)=>s==='slowRecall'?'found:slow':s.replace(/^(slow|fast)FalseAlarms$/,'falseAlarms:$1');
 for(const p of o.pools)check('pool',p.id,p.failed.map(poolName).sort(),()=>pooledGates2(p.reports.map(id=>reports.get(id)!)).filter(g=>!g.passed).map(g=>g.gate).sort());
 for(const s of o.states)check('state',s.id,s.expected,()=>nextState(s));
 for(const x of o.requiredEvidence)check('required-evidence',x.id,x.expected,()=>nextState({...x,passed:Object.values(x.evidence).every(v=>v===true)}));
 check('selection','inherited', {performances:o.selection.performances,controls:o.selection.controls},()=>select(o.selection.inputs));
 for(const x of o.selectionCases)for(const reverse of [false,true])check('selection',`${x.id}${reverse?'-reversed':''}`,
  x.reject?'rejected':{performances:x.performances,controls:x.controls},()=>select((reverse?[...x.inputs].reverse():x.inputs).map(i=>({...i,margin:Number(i.margin)}))));
 const p=o.parentScoreCase;
 check('selection',p.id,p.expected,()=>select([...p.performances.map(x=>({...x,kind:'performance' as const,margin:p.performanceMargin})),
  ...p.controls.map(c=>({id:c.id,kind:c.kind,score:p.performances.find(x=>x.id===c.parent)!.score,margin:c.margin}))]));
 for(const [i,x] of o.marginCases.entries())check('margin',`${i}-${x.name}`,x.expected,()=>normalizedMargin(x.name,x.value));
 for(const x of o.marginRejects)check('margin',x.id,'rejected',()=>normalizedMargin(x.name,Number(x.value)));
 for(const x of o.intervalMargins)check('interval-margin',x.id,x.reject?'rejected':x.expected,()=>intervalMargin(x));
 for(const x of o.exampleMargins)check('example-margin',x.id,x.reject?'rejected':x.expected,()=>exampleMargin(synthetic(x)));
 for(const [i,x] of o.retirement.entries())check('retirement',String(i),x.expected,()=>canRetire(x.history,x.harder));
 for(const x of o.plans)check('plan',x.id,x.reject?'rejected':x.expected,()=>suitePlan(x.stages,x.attempted,x.fullSweep));
 return checks;
}
/** Sensitivity to eight preregistered wrong-answer families; preserves the frozen bytes. */
export function faultSensitivity4(o:Oracle4) {
 const faults:[string,(copy:Oracle4)=>void][]=[
 ['B1 reference',c=>{c.assessment[0]!.expected.bars[0]!.reference=60;}],
 ['B11 boundary',c=>{c.assessment[10]!.expected.bars[3]!.expected='none';c.assessment[10]!.expected.clean=true;}],
 ['flag denominators',c=>{c.reports[1]!.expected.flags.slow.negatives=4;}],
 ['ordinal matching',c=>{c.reports[3]!.expected.barReports.matched=3;}],
 ['state transition',c=>{c.states.find(s=>s.id==='S9')!.expected='passed';}],
 ['rejection margin',c=>{c.marginCases.find(s=>s.name==='rejection')!.expected=.8;}],
 ['interval margin',c=>{c.intervalMargins[1]!.expected=.85;}],
 ['retired plan',c=>{c.plans[2]!.expected=[];}]];
 return faults.map(([name,mutate])=>{const copy=structuredClone(o);mutate(copy);const failed=validateOracle4(copy).filter(c=>!c.agrees);return {name,detected:failed.length>0,failed:failed.map(c=>`${c.group}:${c.id}`)};});
}
