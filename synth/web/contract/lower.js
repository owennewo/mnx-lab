// lower(): the shared fallback. Techniques an instrument cannot render natively
// become core primitives with diagnostics. Pure and deterministic; never throws
// on unknown data (D11). Amounts reproduce mnx-lab's expression.ts flattening.
import {diagnostic} from './core.js';
import {knownTechnique} from './validate.js';

const V=1/127; // mnx velocity steps
export const LOWERING=Object.freeze({palm:{gate:3/5,velocity:-15*V},dead:{gate:1/8,velocity:-20*V},legato:{velocity:-25*V},harmonic:{velocity:-10*V},
 letRingSeconds:2,slideCents:-200,slideSpan:.25,glide:.1,vibratoFade:.2,vibratoPointsPerCycle:32,maxCurvePoints:4096});
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const PITCH=new Set(['bend','vibrato','slide','legato']);

// Vibrato at `age` seconds into a note lasting `duration` seconds. Shared by lower()
// and native renderers, so the law (the pre-host player's, with its 0.18 s delay and
// 0.2 s fade when the player supplies them) exists once.
export function vibratoCents(t,age,duration){
 const onset=(t.start??0)*duration+(t.delaySeconds??0),fade=t.fadeSeconds??LOWERING.vibratoFade;
 const amount=fade>0?clamp((age-onset)/fade,0,1):Number(age>=onset);
 return t.depthCents*amount*Math.sin(2*Math.PI*t.rateHz*age+(t.phase??0));
}
// Pitch offset in cents at fraction x of the note for one technique. `previous`
// is the resolved note a legato slide starts from.
export function techniqueCents(t,note,x,previous){
 const age=x*note.duration;
 switch(t.type){
  case 'bend':{
   const p=t.points;if(x<=p[0].at)return p[0].cents;
   for(let i=1;i<p.length;i++)if(x<=p[i].at){const a=p[i-1],b=p[i];if(x===b.at)return b.cents;return a.cents+(b.cents-a.cents)*((x-a.at)/(b.at-a.at));}
   return p[p.length-1].cents;
  }
  case 'vibrato':return vibratoCents(t,age,note.duration);
  case 'slide':{
   const span=t.span??LOWERING.slideSpan,cents=t.cents??LOWERING.slideCents;
   let c=t.direction==='in'?cents*(1-clamp(x/span,0,1)):cents*clamp((x-(1-span))/span,0,1);
   if(t.fretted)c=Math.round(c/100)*100;
   return c;
  }
  case 'legato':{
   if(t.via!=='slide'||!previous?.target||previous.target.pitch===undefined||note.target.pitch===undefined)return 0;
   return (previous.target.pitch-note.target.pitch)*100*(1-clamp(x/(t.glide??LOWERING.glide),0,1));
  }
  default:return 0;
 }
}
const breakpoints=(t,note)=>{
 if(t.type==='bend')return t.points.map(p=>p.at);
 if(t.type==='slide'){const s=t.span??LOWERING.slideSpan;return t.direction==='in'?[s]:[1-s];}
 if(t.type==='legato')return [t.glide??LOWERING.glide];
 if(t.type==='vibrato'){const n=Math.min(LOWERING.maxCurvePoints,Math.ceil(note.duration*t.rateHz*LOWERING.vibratoPointsPerCycle));return Array.from({length:n+1},(_,i)=>i/n);}
 return [];
};
// Combined commanded curve for the given pitch techniques, as breakpoints.
// Fretted slides step, so each step is bracketed by an extra point.
export function pitchCurve(note,techniques,previous){
 const xs=new Set([0,1]);
 for(const t of techniques){for(const x of breakpoints(t,note))xs.add(clamp(x,0,1));if(t.type==='slide'&&t.fretted){for(let i=1;i<64;i++)xs.add(i/64);}}
 return [...xs].sort((a,b)=>a-b).map(at=>({at,cents:techniques.reduce((sum,t)=>sum+techniqueCents(t,note,at,previous),0)}));
}

export function lower(note,capabilities,{resolve}={}){
 const native=new Set(capabilities.techniques),supports=new Set(capabilities.primitives),diagnostics=[];
 const kept=[],lowered=[],ids={noteId:note.id,part:note.part};
 for(const t of note.techniques??[]){
  if(native.has(t.type))kept.push(t);
  else if(knownTechnique(t))lowered.push(t);
  else diagnostics.push(diagnostic('unknown-technique',{...ids,technique:t.type}));
 }
 const out={...note},primitives={};
 if(note.techniques)out.techniques=kept;
 const use=(primitive,t)=>{if(supports.has(primitive))return true;diagnostics.push(diagnostic('dropped',{...ids,technique:t.type,primitive}));return false;};
 let velocity=note.velocity,duration=note.duration,previous;
 const legato=lowered.find(t=>t.type==='legato');
 if(legato){
  previous=resolve?.(legato.from);
  if(!previous||previous.part!==note.part||!(previous.at<note.at)){diagnostics.push(diagnostic('unresolved-reference',{...ids,technique:'legato',reference:legato.from}));previous=undefined;}
 }
 const curveTechniques=[];
 for(const t of lowered){
  const used=[];
  if(PITCH.has(t.type)&&(t.type!=='legato'||(previous&&t.via==='slide'))&&use('pitchCurve',t)){curveTechniques.push(t);used.push('pitchCurve');}
  if(t.type==='legato'&&previous){
   if(use('gate',t)){primitives.extendPrevious={id:previous.id,until:note.at};used.push('gate');}
   if(t.via!=='slide'&&use('velocity',t)){velocity+=LOWERING.legato.velocity;used.push('velocity');}
  }
  if(t.type==='mute'){
   const m=LOWERING[t.kind];
   if(use('gate',t)){duration*=m.gate;used.push('gate');}
   if(use('velocity',t)){velocity+=m.velocity;used.push('velocity');}
   if(use('damping',t)){primitives.damping={at:0,amount:t.kind==='dead'?1:t.amount??.5};used.push('damping');}
  }
  if(t.type==='harmonic'){primitives.timbre=['harmonic'];if(use('velocity',t)){velocity+=LOWERING.harmonic.velocity;used.push('velocity');}}
  if(t.type==='letRing'){if(use('gate',t)){primitives.letRingSeconds=LOWERING.letRingSeconds;used.push('gate');}if(use('damping',t)){primitives.release='ring';used.push('damping');}}
  if(used.length||t.type==='harmonic')diagnostics.push(diagnostic('approximated',{...ids,technique:t.type,primitives:used}));
 }
 // Mutes shorten first; let ring then extends the shortened gate.
 if(primitives.letRingSeconds){duration=Math.max(duration,primitives.letRingSeconds);delete primitives.letRingSeconds;}
 if(curveTechniques.length)primitives.pitchCurve=pitchCurve(note,curveTechniques,previous);
 if(duration!==note.duration){primitives.gate=duration/note.duration;out.duration=duration;}
 velocity=clamp(velocity,0,1);
 if(velocity!==note.velocity){primitives.velocity=velocity-note.velocity;out.velocity=velocity;}
 return {note:out,primitives,diagnostics};
}
