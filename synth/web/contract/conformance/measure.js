// Audio measurements for conformance expectations. Plain JS, deterministic.
// fundamental() ports scripts/pitch_estimator.py exactly: Hann
// window, 8× zero padding to a power of two, the largest bin within ±4 % of the
// expected frequency, and log-parabolic interpolation.

export function fft(re,im){
 const n=re.length;
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){
  const angle=-2*Math.PI/len,wr=Math.cos(angle),wi=Math.sin(angle);
  for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){
   const a=i+k,b=a+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;
   re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}
 }
}
const hann=n=>Float64Array.from({length:n},(_,i)=>n===1?1:.5-.5*Math.cos(2*Math.PI*i/(n-1)));
export function spectrum(segment,padding=8){
 const nfft=padding*2**Math.ceil(Math.log2(segment.length)),re=new Float64Array(nfft),im=new Float64Array(nfft),w=hann(segment.length);
 for(let i=0;i<segment.length;i++)re[i]=segment[i]*w[i];
 fft(re,im);const amplitude=new Float64Array(nfft/2+1);for(let i=0;i<amplitude.length;i++)amplitude[i]=Math.hypot(re[i],im[i]);
 return {amplitude,nfft};
}
export function fundamental(signal,rate,expected,[start,end]){
 const segment=signal.subarray(Math.round(start*rate),Math.round(end*rate)),{amplitude,nfft}=spectrum(segment);
 let index=-1,best=-1,max=1e-30;
 for(let i=0;i<amplitude.length;i++){max=Math.max(max,amplitude[i]);const f=i*rate/nfft;if(f>expected*.96&&f<expected*1.04&&amplitude[i]>best){best=amplitude[i];index=i;}}
 if(index<1)return {hz:NaN,ratio:0};
 const y=[-1,0,1].map(k=>Math.log(Math.max(amplitude[index+k],1e-30))),offset=.5*(y[0]-y[2])/(y[0]-2*y[1]+y[2]);
 return {hz:(index+offset)*rate/nfft,ratio:amplitude[index]/max};
}
export const mono=([L,R])=>Float64Array.from(L,(x,i)=>.5*(x+R[i]));
export const cents=(hz,reference)=>1200*Math.log2(hz/reference);
export const db=x=>20*Math.log10(Math.max(x,1e-12));
// RMS level in dB per `hop` seconds.
export function envelope(signal,rate,hop=.01){
 const n=Math.max(1,Math.round(hop*rate)),out=[];
 for(let i=0;i+n<=signal.length;i+=n){let e=0;for(let k=i;k<i+n;k++)e+=signal[k]*signal[k];out.push(db(Math.sqrt(e/n)));}
 return {levels:out,hop:n/rate};
}
export const levelAt=(env,t)=>env.levels[Math.min(env.levels.length-1,Math.max(0,Math.floor(t/env.hop)))]??-240;
export function peakAfter(env,from,to=Infinity){let p=-240;for(let i=Math.max(0,Math.floor(from/env.hop));i<env.levels.length&&i*env.hop<to;i++)p=Math.max(p,env.levels[i]);return p;}
// Seconds from `onset` until the level stays dropDb below the peak after it.
export function decayTime(env,onset,dropDb=40){
 const start=Math.floor(onset/env.hop);let peak=-240,at=start;for(let i=start;i<Math.min(env.levels.length,start+Math.round(.1/env.hop));i++)if(env.levels[i]>peak){peak=env.levels[i];at=i;}
 for(let i=at;i<env.levels.length;i++)if(env.levels[i]<peak-dropDb&&env.levels.slice(i).every(x=>x<peak-dropDb))return (i-start)*env.hop;
 return Infinity;
}
// New attack energy at `at`: the rise in energy above 2 kHz from the 20 ms before to
// the 20 ms after. A pluck adds contact noise; legato only moves existing harmonics
// (per-bin flux would count those moves as new energy).
export function onsetFlux(signal,rate,at,{band=2000,window=.02}={}){
 const n=Math.round(window*rate),i=Math.round(at*rate),energy=s=>{const {amplitude,nfft}=spectrum(s,1);let e=0;for(let k=0;k<amplitude.length;k++)if(k*rate/nfft>=band)e+=amplitude[k]**2;return e;};
 return Math.max(0,energy(signal.subarray(i,i+n))-energy(signal.subarray(Math.max(0,i-n),i)));
}
export function spectralCentroid(signal,rate,start,seconds=.1){
 const seg=signal.subarray(Math.round(start*rate),Math.round((start+seconds)*rate)),{amplitude,nfft}=spectrum(seg,1);
 let w=0,s=0;for(let k=1;k<amplitude.length;k++){const p=amplitude[k]**2;w+=p;s+=p*k*rate/nfft;}return w?s/w:0;
}
