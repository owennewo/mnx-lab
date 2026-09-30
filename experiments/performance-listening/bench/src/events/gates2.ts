/** stage-gates@2: unchanged numerical gates, explicit suite state and deterministic margins. */
import type { AssessmentEvaluation3 } from './assessment3.ts';
import type { AssessmentEvaluation2 } from './assessment2.ts';
import type { PerformanceLabel } from './label.ts';
import type { FollowingEvaluation } from './following.ts';
import { assessmentGates, pooledGates } from './gates.ts';
export { cursorGates, costGates } from './gates.ts';
export const STAGE_GATES_2='stage-gates@2';
const numerical=(e:AssessmentEvaluation3|null):AssessmentEvaluation2|null=>e?{...e,evaluator:'assessment-evaluator@2'}:null;
export const assessmentGates2=(label:PerformanceLabel,e:AssessmentEvaluation3|null)=>assessmentGates(label,numerical(e));
export const pooledGates2=(examples:readonly {label:PerformanceLabel;following:FollowingEvaluation|null;assessment:AssessmentEvaluation3|null}[])=>
  pooledGates(examples.map(e=>({...e,assessment:numerical(e.assessment)})));
export type Status='open'|'passed'|'confirmed';
export interface StateCheck {before:Status;attempted:boolean;fullSweep:boolean;passed:boolean;sentinelsPassed:boolean}
export function nextState(x:StateCheck):Status {
  if(!x.sentinelsPassed || (x.fullSweep || x.attempted) && !x.passed)return 'open';
  if(x.before==='open')return x.attempted && x.passed ? 'passed':'open';
  if(x.fullSweep && x.passed)return 'confirmed';
  return x.before;
}
export function canRetire(history:readonly boolean[],harderActiveEvidence:boolean):boolean {
  return harderActiveEvidence && history.length>=3 && history.slice(-3).every(Boolean);
}
export interface SentinelInput {id:string;score:string;kind:'performance'|'silence'|'wrong-score';margin:number}
const ascii=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function chooseSentinels(inputs:readonly SentinelInput[]) {
  if(new Set(inputs.map(x=>x.id)).size!==inputs.length || inputs.some(x=>!Number.isFinite(x.margin)||x.margin<0))throw new Error('Invalid sentinel evidence');
  const sorted=[...inputs].sort((a,b)=>a.margin-b.margin || ascii(a.id,b.id));
  const performances=sorted.filter(x=>x.kind==='performance');
  if(!performances.length)throw new Error('No performances');
  const scores=[...new Set(performances.map(x=>x.score))].sort(ascii);
  const controls=scores.flatMap(score=>(['silence','wrong-score'] as const).map(kind=> {
    const c=sorted.find(x=>x.score===score&&x.kind===kind);if(!c)throw new Error(`Missing ${kind} for ${score}`);return c;
  }));
  return {performances:performances.slice(0,3),controls};
}
export type MarginName='onEvent'|'rejection'|'ahead'|'exposure'|'episode'|'delay'|'overall'|'sustained'|'p99';
export function normalizedMargin(name:MarginName,value:number):number {
  const m=name==='onEvent'||name==='rejection'?(value-.95)/.05:
    name==='ahead'?(.01-value)/.01:name==='exposure'||name==='overall'?(.05-Math.abs(value))/.05:
    name==='episode'?(.5-value)/.5:name==='delay'?(.2-value)/.2:name==='sustained'?(.25-value)/.25:(10-value)/10;
  if(!Number.isFinite(m)||m < -1e-12)throw new Error(`Failed margin ${name}`);
  return Math.max(0,m);
}
/** Measurements already evaluated under their named instruments, no listener execution. */
export function exampleMargin(d:{following:FollowingEvaluation;assessment:AssessmentEvaluation2;
  cost:{sustainedRatio:number;p99Ms:number};gates:{passed:boolean};causality:{pass:boolean}[]}):number {
  if(!d.gates.passed||!d.causality.length||d.causality.some(c=>!c.pass))throw new Error('Failed sentinel evidence');
  const f=d.following,s=f.asDecided.seconds,a=d.assessment;
  const ms=[1,normalizedMargin('exposure',f.exposure.seconds/s.answerable),normalizedMargin('episode',f.exposure.longest),
    normalizedMargin('sustained',d.cost.sustainedRatio),normalizedMargin('p99',d.cost.p99Ms)];
  if(s.supportedAnswerable>0) {
    ms.push(normalizedMargin('onEvent',s.onEvent/s.supportedAnswerable),normalizedMargin('ahead',s.ahead/s.supportedAnswerable));
    ms.push(...f.byEvent.events.map(e=>!e.reached || e.delay===null?0:normalizedMargin('delay',e.delay)));
    if(a.overall.expected!==null)ms.push(normalizedMargin('overall',a.overall.error!));
    ms.push(...a.intervals.errors.map(e=> {
      const tolerance=Math.max(.1*e.expected,.03);return Math.max(0,(tolerance-Math.abs(e.seconds))/tolerance);
    }));
  } else ms.push(normalizedMargin('rejection',s.correctRejection/s.answerable));
  return Math.min(...ms);
}
export interface PlanSubstage {id:string;status:Status;examples:string[];sentinels:string[];retired?:boolean}
export function suitePlan(stages:readonly PlanSubstage[],attempted:readonly string[],fullSweep:boolean):string[] {
  if(attempted.some(id=>!stages.some(s=>s.id===id)))throw new Error('Unknown attempted substage');
  const ids=stages.flatMap(s=>fullSweep || attempted.includes(s.id)?s.examples:s.status==='open'?[]:s.sentinels);
  return [...new Set(ids)].sort(ascii);
}
