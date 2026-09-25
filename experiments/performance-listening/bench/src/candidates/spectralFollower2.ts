import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational, type Listener, type Emission } from '../types.ts';
export const SPECTRAL_2='spectral-follower@2';
const N=2048, RATE=12000, STEP=1/16;
import { magnitudeSpectrum } from './spectralFollower1.ts';
const LOW=36, HIGH=108, HARMONICS=[1,.65,.4,.3];
function normalize(v:Float64Array){const norm=Math.hypot(...v);if(norm)for(let i=0;i<v.length;i++)v[i]/=norm;return v;}
export function spectralFollower2():Listener{
 let ring=new Float64Array(N),written=0,samples=0,accum=0,id=0,frames=0,bpm=0,maxQ=16,templates:Float64Array[]=[],path=new Float64Array(0),lastClock=0,estimate=0,similarity=0,rms=0;
 return {
  start(score,tempo,delivery){
   if(delivery.sampleRate!==48000||delivery.chunkSamples!==480)throw new Error('Fixed delivery required');
   const c=compilePerformance(score);if(!c.ok||c.performance.diagnostics.length)throw new Error('Score must compile cleanly');
   const q=(r:{num:bigint;den:bigint})=>4*Number(r.num)/Number(r.den),measures=c.performance.measures.slice(0,4);maxQ=measures.reduce((sum,m)=>sum+q(m.metricDuration),0);
   if(!maxQ||measures.some(m=>m.occurrence!==1))throw new Error('Initial four-bar route must be unambiguous');
   const notes=c.performance.sounding.filter(n=>q(n.position)<maxQ).map(n=>({onset:q(n.position),duration:q(n.duration),midi:n.midi}));
   templates=Array.from({length:Math.ceil(maxQ/STEP)+1},(_,i)=>{const t=i*STEP,v=new Float64Array(HIGH-LOW+1);for(const n of notes){const age=t-n.onset;if(age>=0&&age<Math.max(n.duration,.25)+.5)for(let h=1;h<=HARMONICS.length;h++){const bin=Math.round(n.midi+12*Math.log2(h))-LOW;if(bin>=0&&bin<v.length)v[bin]+=Math.exp(-age/.65)*HARMONICS[h-1]!;}}return normalize(v);});
   ring=new Float64Array(N);written=samples=accum=id=frames=lastClock=estimate=similarity=rms=0;bpm=tempo.bpm;path=new Float64Array(templates.length).fill(Infinity);
  },
  feed(chunk,clock){
   for(const x of chunk){accum+=x;samples++;if(samples%4===0){ring[written%N]=accum/4;written++;accum=0;}}
   if(written>=N&&id%2===0){
    const window=Float64Array.from({length:N},(_,i)=>ring[(written+i)%N]!);rms=Math.sqrt(window.reduce((s,x)=>s+x*x,0)/N);
    const spectrum=magnitudeSpectrum(window),chroma=new Float64Array(HIGH-LOW+1);
    for(let bin=Math.ceil(70*N/RATE);bin<Math.floor(4000*N/RATE);bin++){
     const midi=69+12*Math.log2(bin*RATE/N/440),nearest=Math.round(midi);if(Math.abs(midi-nearest)<.45&&nearest>=LOW&&nearest<=HIGH)chroma[nearest-LOW]+=Math.sqrt(spectrum[bin]!);
    }
    normalize(chroma);const center=Math.max(0,clock-N/RATE/2),expected=center*bpm/60,next=new Float64Array(path.length).fill(Infinity),similarities=templates.map(v=>v.reduce((sum,x,i)=>sum+x*chroma[i]!,0));
    let best=Infinity,bestIndex=0;
    for(let i=0;i<path.length;i++){
     const q=i*STEP;if(q<Math.max(0,.8*expected-.25)||q>Math.min(maxQ,1.2*expected+.25))continue;
     let prior=frames===0?Math.abs(q-expected)*.1:Infinity;
     if(frames)for(let advance=0;advance<=2;advance++)if(i>=advance)prior=Math.min(prior,path[i-advance]!+.02*(advance-(clock-lastClock)*bpm/60/STEP)**2);
     next[i]=prior*.98+(1-similarities[i]!)+.02*Math.abs(q-expected);
     if(next[i]!<best){best=next[i]!;bestIndex=i;}
    }
    if(Number.isFinite(best))for(let i=0;i<next.length;i++)next[i]-=best;
    path=next;estimate=Math.min(maxQ,bestIndex*STEP+(clock-center)*bpm/60);similarity=Math.max(0,Math.min(1,similarities[bestIndex]??0));frames++;lastClock=clock;
   }
   const heard=frames>0&&rms>1e-4&&similarity>=.65;
   const emission:Emission=heard?{id:`spectral2-${++id}`,kind:'position',refersTo:clock,confidence:similarity,candidates:[{position:{quarters:rational(Math.round((estimate+(clock-lastClock)*bpm/60)*1e6),1e6),route:1},weight:1}]}:{id:`spectral2-${++id}`,kind:'unsupported',refersTo:clock,reason:frames===0?'warming causal window':rms<=1e-4?'silence':'weak score agreement'};
   return [emission];
  },
  finish(){return [];},
 };
}
