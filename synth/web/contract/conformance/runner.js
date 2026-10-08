// Conformance runner: renders a fixture through an injected renderer and checks
// each expectation (format.js documents the definitions). The renderer is
// render({setup, notes, controls, batches, rate, seconds}) → {audio:[L,R],
// diagnostics, probes}; the contract package never imports a host.
import {effectiveEvents,validateFixture} from './format.js';
import {techniqueCents} from '../lower.js';
import {mono,fundamental,cents,envelope,levelAt,peakAfter,decayTime,onsetFlux,spectralCentroid,db} from './measure.js';

const PITCH_TECHNIQUES=new Set(['bend','vibrato','slide','legato']);
const SEVERITY={info:0,warning:1,error:2};
const hz=pitch=>440*2**((pitch-69)/12);

export async function runFixture(fixture,{render}){
 validateFixture(fixture);
 const {rate,seconds}=fixture.render,{notes,controls}=effectiveEvents(fixture),byId=new Map(notes.map(n=>[n.id,n]));
 const full=await render({setup:fixture.setup,...(fixture.batches?{batches:fixture.batches}:{notes,controls}),rate,seconds});
 const cache=new Map(),isolated=async(ids,label=ids.join('+'))=>{
  if(!cache.has(label)){const set=new Set(ids),list=notes.filter(n=>set.has(n.id));cache.set(label,render({setup:fixture.setup,notes:list,controls:controls.filter(c=>c.part===undefined||list.some(n=>n.part===c.part)),rate,seconds}));}
  return cache.get(label);
 };
 // A note with its legato ancestors, which it continues.
 const chain=id=>{const out=[];for(let n=byId.get(id);n;n=byId.get(n.techniques?.find(t=>t.type==='legato')?.from))out.unshift(n.id);return out;};
 const plain=n=>{const {techniques,...rest}=n;return {...rest,id:n.id+'.plain'};};
 // Each result is the expectation as written plus pass and what was measured (kept
 // apart, so a measured maxCents never overwrites the expected one). Checks run
 // concurrently, so an async renderer can overlap their (cached) isolated renders.
 const results=await Promise.all(fixture.expect.map(async e=>{
  const r={...e,pass:false,measured:{}};
  try{const {pass,error,...measured}=await check(e);Object.assign(r,{pass,measured},error?{error}:{});}catch(error){r.error=String(error.message||error);}
  return r;
 }));
 return {fixture:fixture.fixture.id,pass:results.every(r=>r.pass),results,diagnostics:full.diagnostics};

 async function check(e){
  const n=e.note&&byId.get(e.note);
  switch(e.kind){
   case 'pitch':{
    const signal=mono((await isolated(chain(e.note))).audio),previous=byId.get(n.techniques?.find(t=>t.type==='legato')?.from);
    const curve=x=>e.curve==='commanded'?(n.techniques??[]).filter(t=>PITCH_TECHNIQUES.has(t.type)).reduce((s,t)=>s+techniqueCents(t,n,Math.min(1,Math.max(0,x)),previous),0):0;
    const env=envelope(signal,rate),peak=peakAfter(env,n.at,n.at+n.duration),errors=[];
    const from=n.at+Math.max(.03,(e.from??0)*n.duration),to=n.at+Math.min(n.duration-.02,(e.to??1)*n.duration);
    for(let t=from;t+.04<=to;t+=.01){
     const x0=(t-n.at)/n.duration,x1=(t+.04-n.at)/n.duration;
     if(Math.abs(curve(x1)-curve(x0))>50||levelAt(env,t+.02)<peak-40)continue;
     const expected=hz(n.target.pitch+curve((x0+x1)/2)/100),{hz:actual}=fundamental(signal,rate,expected,[t,t+.04]);
     errors.push(Number.isFinite(actual)?Math.abs(cents(actual,expected)):Infinity);
    }
    if(errors.length<3)return {pass:false,error:'fewer than three measurable windows',windows:errors.length};
    const sorted=[...errors].sort((a,b)=>a-b),median=sorted[sorted.length>>1],max=sorted.at(-1);
    return {pass:median<=e.toleranceCents&&max<=e.maxCents,medianCents:median,maxCents:max,windows:errors.length};
   }
   case 'onsetAt':{
    // Every note stays scheduled (a gesture's order depends on all its members) and only
    // this one is heard; the same note alone, without its gesture, is the reference, so the
    // attack's own rise time cancels.
    const onset=async list=>{const out=await render({setup:fixture.setup,notes:list,controls,rate,seconds}),env=envelope(mono(out.audio),rate,.001),from=Math.max(0,n.at-.005),peak=peakAfter(env,from,n.at+e.seconds+.3);
     let i=Math.floor(from/env.hop);while(i<env.levels.length&&env.levels[i]<peak-20)i++;return i*env.hop;};
    const {gesture,...alone}=n,measured=await onset(notes.map(x=>x.id===n.id?x:{...x,velocity:0}))-await onset([alone]);
    return {pass:Math.abs(measured-e.seconds)<=(e.toleranceSeconds??.003),seconds:measured};
   }
   case 'noNewAttack':{
    const ref=plain(n),flux=onsetFlux(mono((await isolated(chain(e.note))).audio),rate,n.at);
    const refFlux=onsetFlux(mono((await render({setup:fixture.setup,notes:[ref],controls:[],rate,seconds})).audio),rate,n.at);
    const ratio=flux/Math.max(1e-12,refFlux);return {pass:ratio<=(e.maxFluxRatio??.25),ratio};
   }
   case 'decayRatio':{
    const a=decayTime(envelope(mono((await isolated(chain(e.note))).audio),rate),n.at),ref=byId.get(e.reference);
    const b=decayTime(envelope(mono((await isolated(chain(e.reference))).audio),rate),ref.at);
    return {pass:a/b<=e.max,ratio:a/b,seconds:a,referenceSeconds:b};
   }
   case 'silentWithin':case 'sustainedPast':{
    const env=envelope(mono((await isolated(chain(e.note))).audio),rate),peak=peakAfter(env,n.at,n.at+n.duration+.1);
    const t=e.kind==='silentWithin'?n.at+e.seconds:n.at+n.duration+e.seconds,level=levelAt(env,t)-peak;
    return {pass:e.kind==='silentWithin'?level<=e.belowDb:level>=e.aboveDb,relativeDb:level};
   }
   case 'releasedWithin':{
    const c=controls.find(x=>x.id===e.control),out=await isolated(notes.filter(x=>x.part===c.part).map(x=>x.id),'part:'+c.part);
    const env=envelope(mono(out.audio),rate),level=levelAt(env,c.at+e.seconds)-levelAt(env,c.at);
    return {pass:level<=e.belowDb,relativeDb:level};
   }
   case 'choked':{
    const by=byId.get(e.by),both=mono((await isolated([e.note,e.by])).audio),alone=mono((await isolated([e.by])).audio),own=mono((await isolated([e.note])).audio);
    const residual=both.map((x,i)=>x-alone[i]),env=envelope(residual,rate),peak=peakAfter(envelope(own,rate),n.at,n.at+.1);
    const level=peakAfter(env,by.at+e.seconds,by.at+e.seconds+.2)-peak;return {pass:level<=e.belowDb,relativeDb:level};
   }
   case 'distinctPieces':{
    const features=[];for(const id of e.notes){const x=byId.get(id),s=mono((await isolated([id])).audio);
     features.push([Math.log2(Math.max(20,spectralCentroid(s,rate,x.at))),Math.log2(Math.max(.005,decayTime(envelope(s,rate),x.at,30)))]);}
    let min=Infinity,pair;for(let i=0;i<features.length;i++)for(let j=i+1;j<features.length;j++){const d=Math.hypot(features[i][0]-features[j][0],features[i][1]-features[j][1]);if(d<min){min=d;pair=[e.notes[i],e.notes[j]];}}
    return {pass:min>=(e.minDistance??1),minDistance:min,closest:pair};
   }
   case 'activeStrings':{
    const energy=full.probes?.[e.part]?.stringEnergy;if(!energy)return {pass:false,error:'renderer exposes no string probe'};
    const count=energy.filter(x=>x>1e-12).length;return {pass:count===e.count,count};
   }
   case 'partActive':{
    const out=await isolated(notes.filter(x=>x.part===e.part).map(x=>x.id),'part:'+e.part);let peak=0;for(const c of out.audio)for(const x of c)peak=Math.max(peak,Math.abs(x));
    return {pass:db(peak)>e.aboveDb,peakDb:db(peak)};
   }
   case 'clickFree':{
    const ids=notes.filter(x=>e.part===undefined||x.part===e.part).map(x=>x.id),out=await isolated(ids,'part:'+(e.part??'*'));
    let step=0;for(const c of out.audio)for(let i=1;i<c.length;i++)step=Math.max(step,Math.abs(c[i]-c[i-1]));return {pass:step<=e.maxStep,maxStep:step};
   }
   case 'peakBelow':{let peak=0;for(const c of full.audio)for(const x of c)peak=Math.max(peak,Math.abs(x));return {pass:db(peak)<=e.dbfs,peakDb:db(peak)};}
   case 'diagnostic':return {pass:full.diagnostics.some(d=>d.code===e.code&&(e.note===undefined||d.noteId===e.note))};
   case 'noDiagnostics':{const min=SEVERITY[e.severity??'warning'],bad=full.diagnostics.filter(d=>SEVERITY[d.severity]>=min);return {pass:!bad.length,found:bad.map(d=>`${d.code}:${d.noteId??d.part??''}`)};}
   default:throw Error('Unknown expectation '+e.kind);
  }
 }
}
