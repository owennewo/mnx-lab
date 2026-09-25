import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { magnitudeSpectrum } from '../candidates/spectralFollower1.ts';
export const WINDOW=2048, RATE=12000, STEP=1/16;
export type Version=1|2;
export interface Frame { clock:number; center:number; rms:number; feature:Float64Array }
const normalize=(v:Float64Array)=>{const n=Math.hypot(...v);if(n)for(let i=0;i<v.length;i++)v[i]/=n;return v;};
export function templates(score:MnxStructure,version:Version){
 const c=compilePerformance(score);if(!c.ok||c.performance.diagnostics.length)throw new Error('Clean score required');
 const q=(r:{num:bigint;den:bigint})=>4*Number(r.num)/Number(r.den),measures=c.performance.measures.slice(0,4);
 const maxQ=measures.reduce((s,m)=>s+q(m.metricDuration),0);
 if(!maxQ||measures.some(m=>m.occurrence!==1))throw new Error('Unambiguous initial route required');
 const notes=c.performance.sounding.filter(n=>q(n.position)<maxQ).map(n=>({onset:q(n.position),duration:q(n.duration),midi:n.midi}));
 return Array.from({length:Math.ceil(maxQ/STEP)+1},(_,i)=>{
  const t=i*STEP,v=new Float64Array(version===1?12:73);
  for(const n of notes){const age=t-n.onset;if(age<0||age>=Math.max(n.duration,.25)+.5)continue;
   if(version===1)v[n.midi%12]+=Math.exp(-age/.65);
   else for(let h=1;h<=4;h++){const bin=Math.round(n.midi+12*Math.log2(h))-36;if(bin>=0&&bin<v.length)v[bin]+=Math.exp(-age/.65)*[1,.65,.4,.3][h-1]!;}
  }
  return normalize(v);
 });
}
export function frames(audio:Float32Array,version:Version):Frame[]{
 const ring=new Float64Array(WINDOW);let samples=0,written=0,accum=0,id=0;const output:Frame[]=[];
 for(let start=0;start<audio.length;start+=480){
  const end=Math.min(start+480,audio.length),clock=end/48000;
  for(let i=start;i<end;i++){accum+=audio[i]!;samples++;if(samples%4===0){ring[written%WINDOW]=accum/4;written++;accum=0;}}
  if(written>=WINDOW&&id%2===0){
   const window=Float64Array.from({length:WINDOW},(_,i)=>ring[(written+i)%WINDOW]!),spectrum=magnitudeSpectrum(window),feature=new Float64Array(version===1?12:73);
   for(let bin=Math.ceil(70*WINDOW/RATE);bin<Math.floor((version===1?2000:4000)*WINDOW/RATE);bin++){
    const midi=69+12*Math.log2(bin*RATE/WINDOW/440),nearest=Math.round(midi);
    if(Math.abs(midi-nearest)<.45){if(version===1)feature[((nearest%12)+12)%12]+=Math.sqrt(spectrum[bin]!);else if(nearest>=36&&nearest<=108)feature[nearest-36]+=Math.sqrt(spectrum[bin]!);}
   }
   output.push({clock,center:Math.max(0,clock-WINDOW/RATE/2),rms:Math.sqrt(window.reduce((s,x)=>s+x*x,0)/WINDOW),feature:normalize(feature)});
  }
  id++;
 }
 return output;
}
export const similarity=(a:Float64Array,b:Float64Array)=>Math.max(0,Math.min(1,a.reduce((s,x,i)=>s+x*b[i]!,0)));
export function quantiles(values:number[]){const v=[...values].sort((a,b)=>a-b);return {n:v.length,min:v[0]??null,p05:v[Math.max(0,Math.ceil(v.length*.05)-1)]??null,median:v[Math.ceil(v.length*.5)-1]??null,p95:v[Math.ceil(v.length*.95)-1]??null,max:v.at(-1)??null};}
export function frontier(rows:{positive:number;wrong:number|null;dust:number;audible:boolean}[]){
 // A cutoff just above a value excludes its complete tie group without rounding it.
 const next=(v:number)=>{const bits=new DataView(new ArrayBuffer(8));bits.setFloat64(0,v);bits.setBigUint64(0,bits.getBigUint64(0)+1n);return bits.getFloat64(0);};
 const thresholds=[...new Set([0,1+Number.EPSILON,...rows.flatMap(r=>[r.positive,r.wrong??0,r.dust]).flatMap(v=>[v,next(v)])])].sort((a,b)=>a-b);
 const evaluate=(threshold:number)=>{
  const wrong=rows.filter(r=>r.wrong!==null);
  return {threshold,positive:rows.filter(r=>r.audible&&r.positive>=threshold).length/rows.length,wrong:wrong.length?wrong.filter(r=>r.audible&&r.wrong!>=threshold).length/wrong.length:0,dust:rows.filter(r=>r.audible&&r.dust>=threshold).length/rows.length};
 };
 const feasible=thresholds.map(evaluate).filter(r=>r.wrong<=.05&&r.dust<=.05);
 return {tested:thresholds.length,atOriginal:evaluate(.65),best:feasible.sort((a,b)=>b.positive-a.positive||a.threshold-b.threshold)[0]!};
}
