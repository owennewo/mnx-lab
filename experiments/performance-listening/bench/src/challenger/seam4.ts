/** Seam-4 representation helpers; old kernel/chain remain frozen. */
import { SerialLane3, StreamingInput3, prefixEqual3, offlineLength3, normalizeLogPower3 } from './streaming3.ts';
import { reducePitch } from './observation2.ts';
import { readObservationOracle3, evaluate3 } from './validateObservation3.ts';
import { readObservationOracle2, evaluateHandCase, type HandCase } from './validateObservation2.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENT, sha256 } from '../io.ts';
export const floatBits=(bits:string)=>{const b=Buffer.from(bits,'hex');return b.readFloatBE(0);};
export function hand4(x:unknown):unknown {
 if(Array.isArray(x))return x.map(hand4);
 if(x&&typeof x==='object'){
  const v=x as Record<string,unknown>;
  if('f32Bits'in v)return floatBits(v.f32Bits as string);
  if('numerator'in v&&'denominator'in v)return (v.numerator as number)/(v.denominator as number);
  if('special'in v)return v.special==='NaN'?NaN:Infinity;
  return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,hand4(v)]));
 }
 return x;
}
export function equal4(a:unknown,b:unknown):boolean {
 if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=1e-12;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal4(v,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object')return Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>equal4(v,(b as Record<string,unknown>)[k]));
 return a===b;
}
export function oracle4(){const b=readFileSync(join(EXPERIMENT,'bench/oracle-events/observation-seam-4.json')),f=JSON.parse(readFileSync(join(EXPERIMENT,'bench/oracle-events/freeze-observation-seam-4.json'),'utf8'));if(sha256(b)!==f.sha256)throw new Error('Frozen seam4 changed');const cases=JSON.parse(b.toString()).cases as HandCase[];if(cases.length!==f.cases)throw new Error('Bad count');return cases;}
const rejected=(f:()=>unknown)=>{try{f();return false;}catch{return true;}};
export function evaluate4(c:HandCase):unknown {
 const v=hand4(c.input) as Record<string,any>; // Oracle fixtures carry heterogeneous operations.
 switch(c.op){
 case 'floatValues':{const p=v.j*48000/22050,k=Math.floor(p),f=p-k;return k+1<v.audio.length?Math.fround(v.audio[k]*(1-f)+v.audio[k+1]*f):null;}
 case 'physicalPitch':{const a=new Float32Array(88);for(const [b,x]of v.bins)a[b]=x;return reducePitch(Array.from(a));}
 case 'floatPitch':{const a=new Float32Array(88);a[v.bin]=v.value;return reducePitch(Array.from(a));}
 case 'scheduleBoundary':return {offlineLeading:3840,liveLeading:43844-v.modelLength,scheduled:v.inputSamples>=v.next};
 case 'normalize':return normalizeLogPower3(v.logPower);
 case 'invalidStart':return rejected(()=>new SerialLane3().start(v.cost,v.emissions));
 case 'invalidStamp':{return rejected(()=>{const l=new SerialLane3();l.completion=v.previous;return l.call(v.delivery,v.cost,v.emissions);});}
 case 'invalidLength':return rejected(()=>offlineLength3(v.length));
 case 'lifecycle4':{
  const s=new StreamingInput3(),l=new SerialLane3(),completions:number[]=[];l.start(v.setup,v.startEmissions);completions.push(l.completion);let modelCalls=0;
  for(const f of v.feeds){const input=f.values?Float32Array.from(f.values):new Float32Array(f.samples);if(s.feed(input)){modelCalls++;if(f.zeroMaps)s.frames(new Float32Array(172*88));}l.call(s.samples/48000,f.service,f.emissions);completions.push(l.completion);}
  const duration=s.samples/48000,h=JSON.stringify(l.history);s.finish();l.call(duration,v.finish,v.finishEmissions);completions.push(l.completion);
  const historyUnchanged=h===JSON.stringify(l.history),work=l.work,ratio=l.cost(duration).ratio;s.reset();l.start(v.resetSetup,v.resetEmissions);
  return {completions,modelCalls,work,ratio,historyUnchanged,resetCompletion:l.completion,resetSamples:s.samples,resetGenerated:s.generated,resetNext:s.nextSamples,resetWatermark:s.watermark,resetHistory:l.history,resetWork:l.work,resetRetainedInput:s.retainedInput,resetRetainedModel:s.retainedModel};
 }
 case 'chunkTrace':{
  const s=new StreamingInput3(),rows=[];for(const chunk of v.chunks){const prev=s.generated;s.feed(Float32Array.from(chunk));rows.push({generated:s.generated,newValues:s.generated===prev?[]:Array.from(s.window().slice(43844-(s.generated-prev))),retainedInput:s.retainedInput,offset:Math.min(s.samples,Math.floor(s.generated*48000/22050))});}return rows;
 }
 case 'ringTrace':{
  const s=new StreamingInput3();for(let from=0;from<v.samples;from+=v.chunk)s.feed(Float32Array.from({length:Math.min(v.chunk,v.samples-from)},(_,i)=>from+i));
  const other=new StreamingInput3();other.feed(Float32Array.from({length:v.samples},(_,i)=>i));const w=s.window();return {generated:s.generated,retainedInput:s.retainedInput,retainedModel:s.retainedModel,windowStart:s.generated-43844,first:w[0],last:w.at(-1),byteEqual:Buffer.from(w.buffer).equals(Buffer.from(other.window().buffer))};
 }
 case 'prefixTrace':{
  const run=(x:any)=>{const l=new SerialLane3();l.start(x.setup);const records=[],times=[];for(const c of x.calls){const es=l.call(c.samples/48000,c.service,c.emissions);records.push(...es.map(e=>({...e,deliverySamples:c.samples})));times.push(l.completion);}return {records,times};};const a=run(v.a),b=run(v.b);return {equal:prefixEqual3(a.records,b.records,v.cutoff),a:a.times,b:b.times};
 }
 case 'offlineTensor':{
  const padded=new Float32Array(v.length+3840);for(let i=0;i<v.length;i++)padded[3840+i]=i;const rows=[];
  for(let start=0;start<padded.length;start+=36164){const w=new Float32Array(43844);w.set(padded.subarray(start,start+43844));const nonzero=Array.from(w).flatMap((x,i)=>x?[i]:[]);rows.push({start,tail:Math.max(0,43844-(padded.length-start)),nonzeroFrom:nonzero[0],nonzeroTo:nonzero.at(-1),firstNonzero:w[nonzero[0]!],lastNonzero:w[nonzero.at(-1)!]});}return rows;
 }
 default:return evaluate3({...c,input:v});
 }
}
function physicalEqual4(actual:unknown, expected:unknown):boolean {
 if(expected && typeof expected==='object' && 'f32Bits' in expected){if(typeof actual!=='number')return false;const b=Buffer.alloc(4);b.writeFloatBE(actual);return b.toString('hex')===(expected as {f32Bits:string}).f32Bits;}
 if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((v,i)=>physicalEqual4(actual[i],v));
 if(expected && typeof expected==='object' && !('numerator' in expected)){return !!actual&&typeof actual==='object'&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>physicalEqual4((actual as Record<string,unknown>)[k],v));}
 return equal4(actual,hand4(expected));
}
export function checks4(){return oracle4().map(c=>{const actual=evaluate4(c),expected=hand4(c.expected);return {id:c.id,actual,expected,agrees:physicalEqual4(actual,c.expected),arithmetic:c.arithmetic};});}
export function inherited4(){return [...readObservationOracle2().map(c=>({id:'seam2-'+c.id,actual:evaluateHandCase(c),expected:hand4(c.expected)})),...readObservationOracle3().filter(c=>!['S5','O11'].includes(c.id)).map(c=>({id:'seam3-'+c.id,actual:evaluate3(c),expected:hand4(c.expected)}))].map(c=>({...c,agrees:equal4(c.actual,c.expected)}));}
