// Contract notes → per-string DSP events for the plucked instrument. For a plain
// plucked note this is the pre-host automation() law event for event (same
// expressions, insertion order and stable sort), followed by the instrument-setup
// pitch law and latest-pluck ownership, so the standard layout renders as before.
// Native techniques add pitch curves, legato chains without re-plucks, finger
// damping for mutes, and let-ring.
import {clamp} from '../../model/presets.js';
import {excitationValue} from '../../model/performance.js';
import {latestPluckEvents} from '../../model/note-ownership.js';
import {vibratoCents,techniqueCents,diagnostic,frameAt,gestureGroups,pitchOrder,gestureTimes} from '../../contract/index.js';
import {isNeutralSetup} from './plucked-design.js';

const ATTACK_BEND_SECONDS=.045;
// The excitation is computed only from a pluck to the end of its attack window: 0.1 s
// (past the DSP's 4096-sample contact delay) or 40 release time constants, after which
// its filters hold less than −150 dB. The release constant is the DSP's own law.
export function excitationWindowSeconds(params,velocity,hardness){
 const tau=Math.min(.04,params.pluck_release_time*.6/Math.max(.025,hardness)*(1+2*params.velocity_tone*(1-velocity)));
 return Math.max(.1,40*tau);
}
// A hammer-on or pull-off changes the vibrating length at once; jumping the
// waveguide's delay length is a waveform discontinuity (a click), so the pitch
// moves over 5 ms with an event every sample (coarser steps still click).
export const LEGATO_GLIDE_SECONDS=.005;
// Palm mute: finger damping that shortens the decay to a fraction r of the free
// string's. Stage 5 multiplies the loop gain every period by m + (1 − m)·sustain,
// where m is the release (finger-muted) gain, so sustain is solved per note from
// the string's own loop law rather than mapped linearly (which damps almost at once).
// The target decay is also capped in seconds: a palm mute is short on any guitar,
// including long-sustain electrics.
export const palmDecayRatio=amount=>.05+.9*(1-amount)**2;
export const palmMaxSeconds=amount=>.15+1.2*(1-amount);
export function palmSustain(amount,frequency,decaySeconds,releaseSeconds){
 const rho=.001**(1/(frequency*decaySeconds)),ratio=Math.min(palmDecayRatio(amount),palmMaxSeconds(amount)/decaySeconds),finger=rho**(1/ratio-1);
 const mute=Math.min(1,.001**(1/(frequency*releaseSeconds))/rho);
 return Math.max(0,Math.min(1,(finger-mute)/(1-mute)));
}
const byOnset=(a,b)=>a.frame-b.frame||(a.id<b.id?-1:a.id>b.id?1:0);

// Strings for every note, in onset order. Depends only on earlier onsets, so a
// note added at or after the commit point never reassigns an earlier one. `state` is
// what earlier, forgotten notes left behind (each string's last pluck and how long it is
// busy; see foldPlucked); the result carries it on.
export function assignStrings(entries,resolved,rate,state){
 const {slots,slotOf,preset}=resolved,assigned=new Map(),diagnostics=[],lastPluck=new Map(state?.lastPluck),busy=new Map(state?.busy);
 const report=(code,e,fields={})=>diagnostics.push(diagnostic(code,{noteId:e.id,part:e.note.part,...fields}));
 const stringOf=slot=>slots.find(x=>x.slot===slot);
 const frequency=(slot,pitch,cents)=>440*2**((pitch-69+(preset.instrument.strings[slot].tuningCents+cents)/100)/12);
 for(const e of [...entries].sort(byOnset)){
  const n=e.lowered,pitch=n.target.pitch;
  if(pitch===undefined){report('out-of-range',e,{message:'Plucked notes need a pitch target'});continue;}
  const legato=n.techniques?.find(t=>t.type==='legato');let slot,previous;
  if(legato){
   previous=assigned.get(legato.from);
   if(previous&&previous.entry.frame<e.frame)slot=previous.slot;
   else{report('unresolved-reference',e,{technique:'legato',reference:legato.from});previous=undefined;}
  }
  const fingering=n.fingering;
  if(slot===undefined&&fingering){slot=slotOf.get(fingering.string);if(slot===undefined)report('fingering-mismatch',e,{message:`No string ${fingering.string} in this layout`});}
  if(slot===undefined){
   // Voice policy: a free string first, then the lowest fret, then the lowest string number.
   const fits=slots.filter(x=>{const fret=pitch-x.pitch-x.capo;return fret>=0&&fret<=24;});
   fits.sort((a,b)=>Number((busy.get(a.slot)??-1)>e.frame)-Number((busy.get(b.slot)??-1)>e.frame)||(pitch-a.pitch)-(pitch-b.pitch)||a.string-b.string);
   slot=fits[0]?.slot;
  }
  const s=stringOf(slot),fret=s?pitch-s.pitch-s.capo:NaN;
  if(!s||fret<0||fret>24){report('out-of-range',e,{message:'No string can play this pitch'});continue;}
  if(fingering?.fret!==undefined&&slotOf.get(fingering.string)===slot&&Math.abs(fingering.fret-fret)>.01)report('fingering-mismatch',e,{fret,written:fingering.fret});
  const base=frequency(slot,pitch,n.nuance?.intonationCents??0);
  if(!(base>=60&&base<=1400)){report('out-of-range',e,{message:'Outside the 60–1400 Hz string range'});continue;}
  if(!previous){
   const last=lastPluck.get(slot);
   if(last!==undefined&&e.frame-last<2){report('retrigger-conflict',e,{string:s.string});continue;}
   lastPluck.set(slot,e.frame);
  }
  const a={entry:e,slot,string:s.string,fret,setupFret:pitch-s.pitch,pitch,base,previous,root:previous?previous.root:e,until:Infinity};
  if(previous)previous.until=Math.min(previous.until,e.frame);
  assigned.set(e.id,a);busy.set(slot,Math.max(e.endFrame,busy.get(slot)??-1));
 }
 return {assigned,diagnostics,lastPluck,busy};
}

// Chord gestures, natively (C18): strings are assigned as written, then each member
// moves to its place in the stroke (strum: by string number; roll: by pitch) and keeps
// its string. Returns the entries to plan.
export function gestureEntries(entries,resolved,rate,state){
 const {groups}=gestureGroups(entries.map(e=>e.note));if(!groups.size)return entries;
 const {assigned}=assignStrings(entries,resolved,rate,state),byId=new Map(entries.map(e=>[e.id,e])),out=new Map(byId);
 const stringOf=n=>assigned.get(n.id)?.string??0;
 for(const members of groups.values()){
  const g=members[0].gesture,order=g.type==='strum'?[...members].sort((a,b)=>(g.direction==='down'?stringOf(b)-stringOf(a):stringOf(a)-stringOf(b))||(a.id<b.id?-1:1)):pitchOrder(members,g);
  for(const [id,t] of gestureTimes(order,g)){
   const e=byId.get(id),a=assigned.get(id),frame=frameAt(t.at,rate),endFrame=e.cut?Math.max(frame+1,e.endFrame):Math.max(frame+1,frameAt(t.at+t.duration,rate));
   const fingering=a?{...(e.lowered.fingering?.string===a.string?e.lowered.fingering:{}),string:a.string}:e.lowered.fingering;
   out.set(id,{...e,frame,endFrame,lengthFrames:endFrame-frame,lowered:{...e.lowered,at:t.at,duration:t.duration,...(fingering?{fingering}:{})}});
  }
 }
 return [...out.values()];
}

export function planPlucked(entries,resolved,rate,state){
 const {assigned,diagnostics,lastPluck,busy}=assignStrings(entries,resolved,rate,state),{preset}=resolved,exc=preset.instrument.excitation;
 const events=[],law=[],fingerMuted=new Map(state?.fingerMuted);
 const put=(frame,key,value,noteStart,note)=>{const e={frame:Math.round(frame),key,value,noteStart};events.push(e);if(note)law.push([e,note]);};
 const step=Math.max(1,Math.round(rate/200));
 for(const a of [...assigned.values()].sort((x,y)=>byOnset(x.entry,y.entry))){
  const e=a.entry,n=e.lowered,s=a.slot,start=e.frame,owner=a.root.frame,techniques=n.techniques??[];
  const mute=techniques.find(t=>t.type==='mute'),letRing=!e.cut&&techniques.some(t=>t.type==='letRing');
  const params=preset.instrument.parameters,string=preset.instrument.strings[s];
  // Free-ringing strings already ring after note-off; holding them "sounding" would
  // only keep their full bridge loading, so let ring changes nothing there.
  const ring=letRing&&!(string.freeRinging===1&&fingerMuted.get(s)!==true&&!mute);
  const sustain=mute?(mute.kind==='dead'?0:palmSustain(mute.amount??.5,a.base,params.decay*string.decayScale,params.release)):1;
  // Free-ringing strings ignore finger damping; a muted note finger-mutes the string
  // and the next unmuted pluck there restores the design's setting.
  if(string.freeRinging===1&&(mute?fingerMuted.get(s)!==true:fingerMuted.get(s)===true)){put(start,`s${s}-free_ringing`,mute?0:1,owner);fingerMuted.set(s,Boolean(mute));}
  const stop=Math.min(e.endFrame,a.until),ends=e.endFrame<=a.until;
  if(!a.previous){
   const hardness=excitationValue(exc.hardness,n.nuance?.excitation?.hardnessDelta??0,.1,1,.025,40);
   for(const [key,value] of Object.entries({velocity:n.velocity,
    position:excitationValue(exc.position,n.nuance?.excitation?.positionDelta??0,.04,.46,.01,.49),
    hardness,sustain,excite:1,trigger:1}))put(start,`s${s}-${key}`,value,owner);
   put(start+Math.round(.001*rate),`s${s}-trigger`,0,owner);
   put(start+Math.round(excitationWindowSeconds(params,n.velocity,hardness)*rate),`s${s}-excite`,0,owner);
  } else put(start,`s${s}-sustain`,sustain,owner);
  if(ends&&!ring)put(stop,`s${s}-sustain`,0,owner);
  const vibrato=techniques.find(t=>t.type==='vibrato'),curves=techniques.filter(t=>t.type==='bend'||t.type==='slide'||(t.type==='legato'&&t.via==='slide'));
  const attack=a.previous?0:n.nuance?.attackBendCents??0,velocity=a.root.lowered.velocity,seconds=n.duration;
  const hammer=a.previous&&!curves.some(t=>t.type==='legato')?(a.previous.pitch-a.pitch)*100:0,glide=Math.round(LEGATO_GLIDE_SECONDS*rate);
  // Plain and vibrato notes keep the pre-host 200 Hz grid; pitch curves use 1 kHz.
  const grid=curves.length?Math.max(1,Math.round(rate/1000)):step,fine=1;
  for(let frame=start;frame<stop;frame+=hammer&&frame-start<glide?fine:grid){
   const age=(frame-start)/rate,bend=attack*Math.exp(-age/ATTACK_BEND_SECONDS),vib=vibrato?vibratoCents(vibrato,age,seconds):0;
   let cents=bend+vib;
   if(curves.length){const x=(frame-start)/e.lengthFrames;for(const t of curves)cents+=techniqueCents(t,n,x,a.previous?.entry.lowered);}
   if(hammer&&frame-start<glide)cents+=hammer*(1-(frame-start)/glide);
   put(frame,`s${s}-frequency`,clamp(a.base*2**(cents/1200),60,1400),owner,{slot:s,fret:a.setupFret,velocity});
  }
 }
 applySetupLaw(law,preset.instrument.setup,rate);
 events.sort((x,y)=>x.frame-y.frame);
 return {events:latestPluckEvents(events).map(({frame,key,value})=>({frame,key,value})),assigned,diagnostics,state:{lastPluck,busy,fingerMuted}};
}

// instrument-setup.js withInstrumentSetup, per sounding note (a legato target uses
// its own fret; tension settles from the chain's pluck). Neutral setups change nothing.
function applySetupLaw(law,setup,rate){
 if(isNeutralSetup(setup))return;
 for(const [e,{slot,fret,velocity}] of law){
  const age=(e.frame-e.noteStart)/rate,x=fret/12;
  const fretCents=x*(2-x)*setup.fret12Cents[slot]+.5*x*(x-1)*setup.fret24Cents[slot];
  const settlingCents=setup.tensionCents*velocity**2*Math.exp(-age/setup.tensionSeconds);
  e.value=Math.max(60,Math.min(1400,e.value*2**((fretCents+settlingCents)/1200)));
 }
}
