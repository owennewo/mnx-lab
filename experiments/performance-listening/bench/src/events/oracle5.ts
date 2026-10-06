/** event-oracle@5: frozen hand cases for stage-gates@3. This adapter never derives expected answers. */
import {readFileSync} from 'node:fs';
import {sha} from '../ladder/privateSets.ts';
import {chooseSentinels,type SentinelInput} from './gates2.ts';
import {chooseSentinels3,exampleMargin3,type Clock,type Control3,type MarginEvidence,type Performance3,type Substage3} from './gates3.ts';
type Num=number|string;
export interface MarginCase5 extends Omit<MarginEvidence,'clock'> {id:string;clock:Clock;arithmetic:string;expected?:number;reject?:boolean}
export interface SelectionCase5 {id:string;substage:Substage3;performances:(Omit<Performance3,'margin'>&{margin:Num})[];
 controls:Control3[];expected?:{performances:string[];controls:string[]};reject?:boolean;arithmetic:string}
export interface Oracle5 {format:'event-oracle@5';author:string;definition:string;implements:string;tolerance:number;
 marginCases:MarginCase5[];selectionCases:SelectionCase5[];refusals:SelectionCase5[]}
export function readOracle5():Oracle5 {
 const bytes=readFileSync(new URL('../../oracle-events/oracle-5.json',import.meta.url));
 const freeze=JSON.parse(readFileSync(new URL('../../oracle-events/freeze-5.json',import.meta.url),'utf8'));
 if(sha(bytes)!==freeze.sha256)throw new Error('event-oracle@5 changed since freezing');
 return JSON.parse(bytes.toString());
}
const num=(v:Num)=>typeof v==='string'?Number(v):v;
const performances=(c:SelectionCase5):Performance3[]=>c.performances.map(p=>({...p,margin:num(p.margin)}));
export interface Check5 {group:string;id:string;agrees:boolean;actual:unknown;expected:unknown}
const attempt=<T>(f:()=>T):{value?:T;error?:string}=>{try{return {value:f()};}catch(e){return {error:(e as Error).message};}};
export type Chooser=(c:SelectionCase5)=>{performances:string[];controls:string[]};
export const chooser3:Chooser=c=>chooseSentinels3(c.substage,performances(c),c.controls);
/** stage-gates@2's frozen rule over the same inputs: no deviation filter, name tie-break. Comparison only. */
export const chooser2:Chooser=c=>{
 const ps=performances(c),score=new Map(ps.map(p=>[p.id,p.score]));
 const inputs:SentinelInput[]=[...ps.map(p=>({id:p.id,score:p.score,kind:'performance' as const,margin:p.margin})),
  ...c.controls.map(x=>({id:x.id,score:score.get(x.parent)!,kind:x.kind,margin:x.margin}))];
 const r=chooseSentinels(inputs);return {performances:r.performances.map(x=>x.id),controls:r.controls.map(x=>x.id)};
};
export function validateOracle5(o:Oracle5,choose:Chooser=chooser3,margin:(e:MarginEvidence)=>number=e=>exampleMargin3(e).margin):Check5[] {
 const out:Check5[]=[];
 for(const c of o.marginCases) {
  const r=attempt(()=>margin(c));
  const agrees=c.reject?r.error!==undefined:r.value!==undefined&&Math.abs(r.value-c.expected!)<=o.tolerance;
  out.push({group:'margin',id:c.id,agrees,actual:r.value??r.error,expected:c.reject?'refused':c.expected});
 }
 for(const [group,cases] of [['selection',o.selectionCases],['refusal',o.refusals]] as const)for(const c of cases) {
  const r=attempt(()=>choose(c));
  const agrees=c.reject?r.error!==undefined:r.value!==undefined&&JSON.stringify(r.value)===JSON.stringify(c.expected);
  out.push({group,id:c.id,agrees,actual:r.value??r.error,expected:c.reject?'refused':c.expected});
 }
 return out;
}
/** Wrong answers and wrong rules the validation must catch. */
export function faultSensitivity5(o:Oracle5) {
 const wrong:[string,(c:Oracle5)=>void][]=[
  ['G1 delay headroom',c=>{c.marginCases[0]!.expected=.45;}],
  ['G3a p99 read on a guitar stage',c=>{c.marginCases[2]!.expected=.01;}],
  ['G11 late event ranked',c=>{delete c.marginCases[11]!.reject;c.marginCases[11]!.expected=0;}],
  ['K2 name tie-break',c=>{c.selectionCases[1]!.expected!.performances=['h-s1-45-2000','h-s1-45-300','h-s1-63-700'];}],
  ['K3 faster first',c=>{c.selectionCases[2]!.expected!.performances=['s2-99','s1-99','s1-90'];}],
  ['K6 nearer factor first',c=>{c.selectionCases[5]!.expected!.performances=['sb-s2-45-b1-90','sb-s2-45-b2-70','sb-s2-90-b2-70'];}],
  ['Z1 undefined severity accepted',c=>{delete c.refusals[0]!.reject;c.refusals[0]!.expected={performances:['wn-a'],controls:['sil-wn-a','w2-wn-a']};}]];
 const answers=wrong.map(([name,mutate])=>{const copy=structuredClone(o);mutate(copy);const failed=validateOracle5(copy).filter(c=>!c.agrees);return {name,detected:failed.length>0,failed:failed.map(c=>`${c.group}:${c.id}`)};});
 const p99=(e:MarginEvidence)=>exampleMargin3({...e,clock:e.p99===undefined?e.clock:'chunk-p99'}).margin;
 const rules:[string,Chooser|null,((e:MarginEvidence)=>number)|null,string[]][]=[
  ['stage-gates@2 rule (no deviation filter, name tie-break)',chooser2,null,['selection:K1-deviation-only','selection:K2-pause-then-tempo']],
  ['p99 entry kept on a guitar stage',null,p99,['margin:G3a-p99-absent']]];
 return [...answers,...rules.map(([name,ch,m,must])=>{
  const failed=validateOracle5(o,ch??chooser3,m??undefined).filter(c=>!c.agrees).map(c=>`${c.group}:${c.id}`);
  return {name,detected:must.every(id=>failed.includes(id)),failed};
 })];
}
