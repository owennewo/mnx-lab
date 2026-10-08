// Loudness compensation for the plucked instrument (chain campaign Phase 4, C11). The
// model (web/data/instrument-v2/loudness.json, scripts/measure_loudness.mjs) gives each
// factory design's loudness across a pitch grid. A part's loudness is the power mean of
// the curve over its strings; the gain brings it to one target, so designs and layouts
// play alike and the design's Level (trimDb) is a plain trim around that.
export const LOUDNESS_GRID=Object.freeze([36,40,44,48,52,56,60,64,68,72,76]);
// Per-pluck A-weighted loudness that lands a strummed, standard-tuned take near −24 dB(A)
// at a 0 dB strip and master, with the master limiter only touching the darkest designs' strum peaks.
export const LOUDNESS_TARGET_DB=-32;
// Gated loudness of A-weighted audio (IEC 61672 A curve by bilinear transform, 0 dB at
// 1 kHz): 400 ms blocks, 75 % overlap, −70 dB absolute and −10 dB relative gates as in
// BS.1770. A-weighting, not BS.1770's K-weighting, because it follows hearing at
// moderate levels and on small speakers, where a dark design's deep bass barely
// counts; K-weighting left bass-heavy designs 7–9 dB quieter to the ear.
const A_POLES_HZ=[20.598997,20.598997,107.65265,737.86223],A_LOW_HZ=[12194.217,12194.217];
function sections(rate){
 const k=2*rate,w=f=>2*Math.PI*f;
 const high=A_POLES_HZ.map(f=>{const a=(k-w(f))/(k+w(f));return {g:k/(k+w(f)),a,hp:true};}),low=A_LOW_HZ.map(f=>{const a=(k-w(f))/(k+w(f));return {g:w(f)/(k+w(f)),a,hp:false};});
 return [...high,...low];
}
function filter(x,secs,gain=1){
 const y=Float64Array.from(x);
 for(const {g,a,hp} of secs){let px=0,py=0;for(let i=0;i<y.length;i++){const v=y[i],o=g*(hp?v-px:v+px)+a*py;px=v;py=o;y[i]=o;}}
 if(gain!==1)for(let i=0;i<y.length;i++)y[i]*=gain;
 return y;
}
const cache=new Map();
function aWeighting(rate){
 if(!cache.has(rate)){
  const secs=sections(rate),n=rate,sine=Float64Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*1000*i/rate)),y=filter(sine,secs);
  let e=0;for(let i=n/2;i<n;i++)e+=y[i]*y[i];cache.set(rate,{secs,gain:1/Math.sqrt(2*e/(n/2))});
 }
 return cache.get(rate);
}
export function gatedLoudness(audio,rate){
 const {secs,gain}=aWeighting(rate),ch=audio.map(c=>filter(c,secs,gain)),n=Math.round(.4*rate),step=Math.round(n/4),blocks=[];
 for(let s=0;s+n<=ch[0].length;s+=step){let e=0;for(const c of ch)for(let i=s;i<s+n;i++)e+=c[i]*c[i];blocks.push(e/n);}
 const level=e=>10*Math.log10(Math.max(e,1e-30)),mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
 const abs=blocks.filter(e=>level(e)>-70);if(!abs.length)return -120;
 const rel=level(mean(abs))-10,kept=abs.filter(e=>level(e)>rel);return level(mean(kept));
}
const at=(curve,pitch)=>{
 const g=LOUDNESS_GRID,p=Math.min(g.at(-1),Math.max(g[0],pitch));let i=0;while(i<g.length-2&&p>g[i+1])i++;
 return curve[i]+(curve[i+1]-curve[i])*(p-g[i])/(g[i+1]-g[i]);
};
// A design's curve: its own factory basis, else the design it was copied from, else the
// mean of all factory curves (never no compensation, which would leave it 12–15 dB quiet).
export function loudnessCurve(model,design){
 const designs=model?.designs;if(!designs)return null;
 const own=designs[design.basis]??designs[design.source]??designs[design.id];if(own)return own;
 const all=Object.values(designs);return all.length?all[0].map((_,i)=>all.reduce((s,c)=>s+c[i],0)/all.length):null;
}
// → dB of makeup gain for a design's curve on a layout, or 0 without a model.
export function layoutCompensationDb(curve,layout){
 if(!curve)return 0;const capo=layout.capo??0;
 const power=layout.strings.reduce((sum,s)=>sum+10**(at(curve,s.pitch+capo)/10),0)/layout.strings.length;
 return LOUDNESS_TARGET_DB-10*Math.log10(power);
}
