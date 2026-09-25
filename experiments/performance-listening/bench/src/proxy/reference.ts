import { type Decision, value, round } from '../types.ts';
import { validateDecisions } from '../validate.ts';
export interface Anchor { seconds: number; quarter: number; route: number }
export interface ProxyReference {
  kind: 'linear-sync-proxy' | 'cross-piece-negative-proxy' | 'digital-silence';
  duration: number; anchors: Anchor[]; allowance: .15; uncertainty: 'unmeasured' | 'exact-silence';
}
export function validateProxy(r:ProxyReference):void{
 if(!Number.isFinite(r.duration)||r.duration<=.15||r.allowance!==.15)throw new Error('Invalid proxy duration/allowance');
 if(r.kind==='linear-sync-proxy'){
  if(r.uncertainty!=='unmeasured'||r.anchors.length<2)throw new Error('Sync interpolation must retain unmeasured uncertainty');
  for(let i=0;i<r.anchors.length;i++){const a=r.anchors[i]!;if(!Number.isFinite(a.seconds)||!Number.isFinite(a.quarter)||a.quarter<0||!Number.isSafeInteger(a.route)||a.route<1)throw new Error('Invalid anchor');if(i&& (a.seconds<=r.anchors[i-1]!.seconds||a.quarter<=r.anchors[i-1]!.quarter||a.route!==r.anchors[i-1]!.route))throw new Error('Non-monotone or ambiguous-route proxy');}
  if(r.anchors[0]!.seconds>1/48000||r.anchors.at(-1)!.seconds<r.duration-1/48000)throw new Error('Proxy anchors do not cover the decoded crop');
 }else if(!['cross-piece-negative-proxy','digital-silence'].includes(r.kind)||r.anchors.length||r.uncertainty!==(r.kind==='digital-silence'?'exact-silence':'unmeasured'))throw new Error('Invalid negative reference');
}
export function positionAt(r:ProxyReference,t:number){
 if(r.kind!=='linear-sync-proxy')return null;
 let i=0;for(let j=1;j<r.anchors.length;j++)if(r.anchors[j]!.seconds<t)i=j;
 const a=r.anchors[Math.min(i,r.anchors.length-2)]!,b=r.anchors[Math.min(i+1,r.anchors.length-1)]!;
 const qps=(b.quarter-a.quarter)/(b.seconds-a.seconds);
 return {quarter:a.quarter+(t-a.seconds)*qps,route:a.route,qps};
}
function latest(record:readonly Decision[],t:number,available=t){let result:Decision|undefined;for(const d of record)if(d.kind!=='note'&&d.madeAt<=available+1e-9&&d.refersTo<=t+1e-9&&(!result||d.refersTo>result.refersTo||d.refersTo===result.refersTo&&d.madeAt>=result.madeAt))result=d;return result;}
function judge(r:ProxyReference,t:number,d:Decision|undefined){
 if(!d)return {agrees:false,claim:false,residual:null as number|null,quarterResidual:null as number|null};
 const ref=positionAt(r,t);
 if(!ref)return {agrees:d.kind==='unsupported',claim:d.kind==='position',residual:null,quarterResidual:null};
 if(d.kind!=='position')return {agrees:false,claim:false,residual:null,quarterResidual:null};
 const same=d.candidates.filter(c=>c.position.route===ref.route).map(c=>value(c.position.quarters)-ref.quarter).sort((a,b)=>Math.abs(a)-Math.abs(b));
 const error=same[0]??null;
 return {agrees:error!==null&&Math.abs(error)<=.25+1e-9&&d.candidates.every(c=>c.position.route===ref.route&&Math.abs(value(c.position.quarters)-ref.quarter)<=.25+1e-9),claim:true,residual:error===null?null:error/ref.qps,quarterResidual:error};
}
export function evaluateProxy(r:ProxyReference,record:readonly Decision[]){
 validateProxy(r);validateDecisions(record);if(record.some(d=>d.madeAt>r.duration+1e-9||d.kind==='note'))throw new Error('Invalid proxy decision horizon/kind');
 const points=[];let covered=0,agreed=0,missed=0,exposed=0,longest=0,current=0;const residuals:number[]=[];
 for(let k=1;k<=Math.ceil(r.duration/.05);k++){
  const t=Math.min(k*.05,r.duration);if(t<.15-1e-9)continue;
  const decision=latest(record,t),j=judge(r,t,decision);if(decision)covered++;if(j.agrees)agreed++;
  const width=Math.max(0,t-Math.max((k-1)*.05,.15));
  if(j.claim&&!j.agrees){exposed+=width;current+=width;longest=Math.max(longest,current);}else current=0;
  const instants=[t,...record.filter(d=>d.madeAt>t&&d.madeAt<=t+.2+1e-9&&d.refersTo<=t).map(d=>d.madeAt)];
  const timely=instants.some(now=>judge(r,t,latest(record,t,now)).agrees);if(!timely)missed++;
  if(j.residual!==null)residuals.push(j.residual);
  points.push({time:round(t),reference:positionAt(r,t)?.quarter??null,decision:decision?.id??null,agreement:j.agrees,residualSeconds:j.residual,quarterResidual:j.quarterResidual,timely});
 }
 const absolute=residuals.map(Math.abs).sort((a,b)=>a-b),n=points.length;
 return {evaluator:'sync-proxy-evaluator@1',referenceKind:r.kind,referenceUncertainty:r.uncertainty,interpretation:'Agreement with the declared proxy; no verified timing-accuracy or formal retention claim.',points,
  summary:{points:n,agreement:round(agreed/n),coverage:round(covered/n),deadlineMisses:round(missed/n),wrongReferenceExposure:round(exposed/(r.duration-.15)),longestWrongReferenceSeconds:round(longest),
   residualSeconds:{signedMean:residuals.length?round(residuals.reduce((a,b)=>a+b,0)/residuals.length):null,absoluteMedian:absolute.length?round(absolute[Math.ceil(absolute.length*.5)-1]!):null,absoluteP95:absolute.length?round(absolute[Math.ceil(absolute.length*.95)-1]!):null,absoluteMax:absolute.length?round(absolute.at(-1)!):null,denominator:residuals.length}}};
}
