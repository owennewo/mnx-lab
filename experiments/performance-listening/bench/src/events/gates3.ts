/** stage-gates@3 (event instruments 5): guitar margins without chunk p99, and R10's sentinel rule. */
import {normalizedMargin} from './gates2.ts';
export {cursorGates,costGates,assessmentGates2,pooledGates2,nextState,canRetire,suitePlan} from './gates2.ts';
export const STAGE_GATES_3='stage-gates@3';
export type Clock='compute-inclusive'|'chunk-p99';
/** Gate measurements of one example, as its recorded evaluations give them. */
export interface MarginEvidence {
 clock:Clock;supported:boolean;onEvent?:number;ahead?:number;rejection?:number;exposure:number;longest:number;
 delays?:(number|null)[];overallError?:number|null;intervals?:{expectedSeconds:number;errorSeconds:number}[];
 sustained:number;p99?:number;gates:boolean;causality:boolean[];
}
export interface Entry {name:string;headroom:number}
const finite=(v:unknown,what:string):number=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`Missing ${what}`);return v;};
const clamp=(name:string,m:number)=>{if(!Number.isFinite(m)||m < -1e-12)throw new Error(`Failed margin ${name}`);return Math.max(0,m);};
/** Every applicable headroom entry; throws (refuses) on failed or absent binary evidence. */
export function marginEntries(e:MarginEvidence):Entry[] {
 if(!e.gates||!e.causality.length||e.causality.some(c=>!c))throw new Error('Failed sentinel evidence');
 const out:Entry[]=[{name:'binary',headroom:1},
  {name:'exposure',headroom:normalizedMargin('exposure',finite(e.exposure,'exposure'))},
  {name:'episode',headroom:normalizedMargin('episode',finite(e.longest,'longest'))},
  {name:'sustained',headroom:normalizedMargin('sustained',finite(e.sustained,'sustained'))}];
 if(e.clock==='chunk-p99')out.push({name:'p99',headroom:normalizedMargin('p99',finite(e.p99,'p99'))});
 else if(e.clock!=='compute-inclusive')throw new Error('Unknown clock');
 if(e.supported) {
  out.push({name:'onEvent',headroom:normalizedMargin('onEvent',finite(e.onEvent,'onEvent'))},
   {name:'ahead',headroom:normalizedMargin('ahead',finite(e.ahead,'ahead'))});
  for(const d of e.delays??[])out.push({name:'delay',headroom:d===null?0:normalizedMargin('delay',finite(d,'delay'))});
  if(e.overallError!==null&&e.overallError!==undefined)out.push({name:'overall',headroom:normalizedMargin('overall',finite(e.overallError,'overall'))});
  for(const i of e.intervals??[]) {
   const tolerance=Math.max(.1*finite(i.expectedSeconds,'interval'),.03);
   out.push({name:'interval',headroom:clamp('interval',(tolerance-Math.abs(finite(i.errorSeconds,'interval error')))/tolerance)});
  }
 } else out.push({name:'rejection',headroom:normalizedMargin('rejection',finite(e.rejection,'rejection'))});
 return out;
}
/** The example's margin and the entries that reach it. */
export function exampleMargin3(e:MarginEvidence):{margin:number;limiting:string[]} {
 const entries=marginEntries(e),margin=Math.min(...entries.map(x=>x.headroom));
 return {margin,limiting:[...new Set(entries.filter(x=>x.headroom===margin).map(x=>x.name))]};
}

export interface Performance3 {id:string;score:string;deviation:string|null;tempo:number;pause?:number;factor?:number;margin:number}
export interface Control3 {id:string;parent:string;kind:'silence'|'wrong-score';handedScore?:string;margin:number}
export interface Substage3 {id?:string;deviation:string|null}
const ascii=(a:string,b:string)=>a<b?-1:a>b?1:0;
/** Severity tuple; larger is harder. Throws for a deviation this version does not define. */
export function severity(deviation:string|null,p:Performance3):number[] {
 const tempo=finite(p.tempo,`tempo of ${p.id}`);
 if(deviation===null)return [-tempo];
 if(deviation==='hesitation')return [finite(p.pause,`pause of ${p.id}`),-tempo];
 if(deviation==='slowed-bar'||deviation==='rushed-bar')return [Math.abs(finite(p.factor,`factor of ${p.id}`)-1),-tempo];
 throw new Error(`No severity defined for ${deviation}`);
}
const harder=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return b[i]!-a[i]!;return 0;};
export function chooseSentinels3(substage:Substage3,performances:readonly Performance3[],controls:readonly Control3[]) {
 const ids=[...performances,...controls].map(x=>x.id);
 if(new Set(ids).size!==ids.length)throw new Error('Duplicate example ID');
 for(const x of [...performances,...controls])if(typeof x.margin!=='number'||!Number.isFinite(x.margin)||x.margin<0)throw new Error(`Invalid margin ${x.id}`);
 const byId=new Map(performances.map(p=>[p.id,p]));
 for(const c of controls)if(!byId.has(c.parent))throw new Error(`Control ${c.id} has no evaluated parent`);
 const candidates=performances.filter(p=>p.deviation===substage.deviation);
 if(!candidates.length)throw new Error('No candidate performance');
 const sev=new Map(candidates.map(p=>[p.id,severity(substage.deviation,p)]));
 const order=(a:{id:string;margin:number;s:number[]},b:{id:string;margin:number;s:number[]})=>a.margin-b.margin||harder(a.s,b.s)||ascii(a.id,b.id);
 const chosen=candidates.map(p=>({id:p.id,margin:p.margin,s:sev.get(p.id)!})).sort(order).slice(0,3).map(p=>p.id);
 const scores=[...new Set(candidates.map(p=>p.score))].sort(ascii);
 const pool=controls.filter(c=>sev.has(c.parent)).map(c=>({...c,score:byId.get(c.parent)!.score,s:sev.get(c.parent)!}));
 const chosenControls=scores.flatMap(score=>(['silence','wrong-score'] as const).map(kind=>{
  const first=pool.filter(c=>c.score===score&&c.kind===kind).sort(order)[0];
  if(!first)throw new Error(`Missing ${kind} control for ${score}`);return first.id;
 }));
 return {performances:chosen,controls:chosenControls};
}
