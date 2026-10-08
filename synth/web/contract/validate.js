// Validators: strict on known fields, unknown fields ignored (and preserved,
// since inputs are returned unmodified). Errors name the offending object id.
import {CONTRACT,TECHNIQUES,CONTROLS} from './core.js';
import {GESTURES,gestureGroups} from './gesture.js';

export class ContractError extends Error{constructor(message,id){super(id===undefined?message:`${id}: ${message}`);this.name='ContractError';this.id=id;}}
const ID=/^[A-Za-z0-9_.:-]{1,128}$/;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=(id,message)=>{throw new ContractError(message,id);};
const obj=(x,id,label)=>{if(!isObject(x))fail(id,`${label} must be an object`);return x;};
const num=(x,min,max,id,label)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)fail(id,`${label} must be a number in ${min}–${max}`);return x;};
const int=(x,min,max,id,label)=>{num(x,min,max,id,label);if(!Number.isInteger(x))fail(id,`${label} must be an integer`);return x;};
const opt=(o,key,check)=>{if(o[key]!==undefined)check(o[key]);};
const ident=(x,id,label)=>{if(typeof x!=='string'||!ID.test(x))fail(id,`${label} must be an id ([A-Za-z0-9_.:-], 1–128 chars)`);return x;};
const bool=(x,id,label)=>{if(typeof x!=='boolean')fail(id,`${label} must be true or false`);return x;};
const oneOf=(x,values,id,label)=>{if(!values.includes(x))fail(id,`${label} must be one of ${values.join(', ')}`);return x;};

// Known technique fields only; an unknown technique type is not an error (D11).
const techniqueChecks={
 bend(t,id){
  if(!Array.isArray(t.points)||!t.points.length||t.points.length>256)fail(id,'bend.points must hold 1–256 points');
  let last=-1;for(const p of t.points){obj(p,id,'bend point');num(p.at,0,1,id,'bend point at');num(p.cents,-2400,2400,id,'bend point cents');if(p.at<last)fail(id,'bend points must be in ascending order');last=p.at;}
 },
 vibrato(t,id){num(t.depthCents,0,200,id,'vibrato.depthCents');num(t.rateHz,.1,20,id,'vibrato.rateHz');opt(t,'start',x=>num(x,0,1,id,'vibrato.start'));
  opt(t,'delaySeconds',x=>num(x,0,60,id,'vibrato.delaySeconds'));opt(t,'fadeSeconds',x=>num(x,0,10,id,'vibrato.fadeSeconds'));opt(t,'phase',x=>num(x,-1e3,1e3,id,'vibrato.phase'));},
 slide(t,id){oneOf(t.direction,['in','out'],id,'slide.direction');opt(t,'cents',x=>num(x,-2400,2400,id,'slide.cents'));opt(t,'span',x=>num(x,0,1,id,'slide.span'));opt(t,'fretted',x=>bool(x,id,'slide.fretted'));if(t.span===0)fail(id,'slide.span must be above 0');},
 legato(t,id){ident(t.from,id,'legato.from');oneOf(t.via,['hammer','pull','slide'],id,'legato.via');opt(t,'glide',x=>num(x,0,1,id,'legato.glide'));if(t.via!=='slide'&&t.glide!==undefined)fail(id,'legato.glide applies only to slides');},
 mute(t,id){oneOf(t.kind,['palm','dead'],id,'mute.kind');opt(t,'amount',x=>num(x,0,1,id,'mute.amount'));if(t.kind==='dead'&&t.amount!==undefined)fail(id,'mute.amount applies only to palm mutes');},
 harmonic(t,id){oneOf(t.kind,['natural','artificial','pinch','tap','semi','feedback'],id,'harmonic.kind');},
 letRing(){},
};
export function validateTechnique(t,id){
 obj(t,id,'technique');if(typeof t.type!=='string'||!t.type)fail(id,'technique.type must be a non-empty string');
 techniqueChecks[t.type]?.(t,id);return t;
}

export function validateNote(n){
 const id=isObject(n)&&typeof n.id==='string'?n.id:undefined;
 obj(n,id,'note');ident(n.id,id,'note.id');ident(n.part,id,'note.part');
 num(n.at,0,86400,id,'note.at');num(n.duration,0,3600,id,'note.duration');if(n.duration===0)fail(id,'note.duration must be above 0');
 num(n.velocity,0,1,id,'note.velocity');
 obj(n.target,id,'note.target');
 if((n.target.pitch===undefined)===(n.target.piece===undefined))fail(id,'note.target needs exactly one of pitch or piece');
 opt(n.target,'pitch',x=>num(x,0,127,id,'target.pitch'));
 opt(n.target,'piece',x=>{if(typeof x!=='string'||!x)fail(id,'target.piece must be a non-empty string');});
 opt(n,'fingering',f=>{obj(f,id,'note.fingering');int(f.string,1,12,id,'fingering.string');opt(f,'fret',x=>num(x,0,36,id,'fingering.fret'));});
 opt(n,'techniques',ts=>{
  if(!Array.isArray(ts))fail(id,'note.techniques must be an array');
  const seen=new Set();
  for(const t of ts){validateTechnique(t,id);if(techniqueChecks[t.type]){if(seen.has(t.type))fail(id,`at most one ${t.type} technique per note`);seen.add(t.type);}}
  if(seen.has('legato')&&ts.find(t=>t.type==='legato').from===n.id)fail(id,'legato.from cannot reference the note itself');
 });
 opt(n,'gesture',g=>{obj(g,id,'note.gesture');ident(g.id,id,'gesture.id');if(typeof g.type!=='string'||!g.type)fail(id,'gesture.type must be a non-empty string');
  if(GESTURES.includes(g.type)){oneOf(g.direction,['down','up'],id,'gesture.direction');num(g.spreadSeconds,0,2,id,'gesture.spreadSeconds');}});
 opt(n,'nuance',x=>{obj(x,id,'note.nuance');opt(x,'intonationCents',v=>num(v,-100,100,id,'nuance.intonationCents'));opt(x,'attackBendCents',v=>num(v,-100,100,id,'nuance.attackBendCents'));
  opt(x,'excitation',e=>{obj(e,id,'nuance.excitation');opt(e,'positionDelta',v=>num(v,-.5,.5,id,'excitation.positionDelta'));opt(e,'hardnessDelta',v=>num(v,-40,40,id,'excitation.hardnessDelta'));});});
 return n;
}

const controlChecks={sustainPedal:(c,id)=>num(c.value,0,1,id,'sustainPedal.value'),mute:(c,id)=>bool(c.value,id,'mute.value'),tempo:(c,id)=>num(c.bpm,20,400,id,'tempo.bpm')};
// Session-wide controls name no part.
export const sessionControl=c=>c?.type==='tempo';
export function validateControl(c){
 const id=isObject(c)&&typeof c.id==='string'?c.id:undefined;
 obj(c,id,'control');ident(c.id,id,'control.id');num(c.at,0,86400,id,'control.at');
 if(sessionControl(c)){if(c.part!==undefined)fail(id,`${c.type} is session-wide and names no part`);}else ident(c.part,id,'control.part');
 if(typeof c.type!=='string'||!c.type)fail(id,'control.type must be a non-empty string');
 controlChecks[c.type]?.(c,id);return c;
}
export const knownControl=c=>CONTROLS.includes(c.type);
export const knownTechnique=t=>TECHNIQUES.includes(t.type);

export function validateLayout(layout,id){
 obj(layout,id,'layout');
 if(!Array.isArray(layout.strings)||layout.strings.length<1||layout.strings.length>6)fail(id,'layout.strings must hold 1–6 strings this contract revision');
 for(const s of layout.strings){obj(s,id,'layout string');num(s.pitch,36,76,id,'layout string pitch');}
 opt(layout,'capo',x=>int(x,0,12,id,'layout.capo'));
 return layout;
}
// mnx-sound/2 setup (chain campaign C9, C13). The contract fixes the structure:
// parts with an instrument, an ordered insert chain and a channel strip; return
// buses; the master. Block types and parameter values belong to the host's block
// catalogue, which reports unknown types and bad values instead of throwing (D11).
const STATES=['on','off'];
function validateBlock(b,owner,label,states=STATES){
 obj(b,owner,label);ident(b.id,owner,`${label}.id`);
 if(typeof b.type!=='string'||!b.type)fail(owner,`${label}.type must be a non-empty string`);
 opt(b,'state',x=>oneOf(x,states,owner,`${label} ${b.id} state`));
 opt(b,'params',x=>{obj(x,owner,`${label} ${b.id} params`);for(const [k,v] of Object.entries(x))if(typeof v!=='boolean'&&(typeof v!=='number'||!Number.isFinite(v)))fail(owner,`${label} ${b.id} param ${k} must be a finite number or a boolean`);});
 return b;
}
export function validateSetup(s){
 obj(s,undefined,'setup');if(s.contract!==CONTRACT)fail(undefined,`setup.contract must be '${CONTRACT}'`);
 obj(s.session,'session','setup.session');
 opt(s.session,'master',m=>{obj(m,'session','session.master');opt(m,'volumeDb',x=>num(x,-60,12,'session','master.volumeDb'));opt(m,'ceilingDb',x=>num(x,-24,0,'session','master.ceilingDb'));});
 const buses=new Set();
 opt(s.session,'buses',list=>{
  if(!Array.isArray(list)||list.length>8)fail('session','session.buses must be an array of at most 8 buses');
  for(const b of list){validateBlock(b,'session','bus',['on','off']);if(buses.has(b.id))fail('session',`duplicate bus id ${b.id}`);buses.add(b.id);}
 });
 if(!Array.isArray(s.parts)||!s.parts.length||s.parts.length>16)fail(undefined,'setup.parts must hold 1–16 parts');
 const ids=new Set();
 for(const p of s.parts){
  const id=isObject(p)&&typeof p.id==='string'?p.id:undefined;obj(p,id,'part');ident(p.id,id,'part.id');
  if(ids.has(p.id))fail(id,'duplicate part id');ids.add(p.id);
  opt(p,'name',x=>{if(typeof x!=='string'||x.length>120)fail(id,'part.name must be a string of at most 120 characters');});
  obj(p.instrument,id,'part.instrument');if(typeof p.instrument.kind!=='string'||!p.instrument.kind)fail(id,'instrument.kind must be a non-empty string');
  if(typeof p.instrument.design!=='string'&&!isObject(p.instrument.design))fail(id,'instrument.design must be a design id or a design object');
  if(p.instrument.kind==='plucked')opt(p.instrument,'layout',l=>validateLayout(l,id));
  opt(p,'chain',chain=>{
   if(!Array.isArray(chain)||chain.length>16)fail(id,'part.chain must be an array of at most 16 blocks');
   const blocks=new Set();for(const b of chain){validateBlock(b,id,'block');if(blocks.has(b.id))fail(id,`duplicate block id ${b.id}`);blocks.add(b.id);}
  });
  opt(p,'strip',st=>{
   obj(st,id,'part.strip');opt(st,'levelDb',x=>num(x,-60,12,id,'strip.levelDb'));opt(st,'pan',x=>num(x,-1,1,id,'strip.pan'));
   opt(st,'mute',x=>bool(x,id,'strip.mute'));opt(st,'solo',x=>bool(x,id,'strip.solo'));
   opt(st,'sends',x=>{obj(x,id,'strip.sends');for(const [bus,v] of Object.entries(x)){if(!buses.has(bus))fail(id,`send to unknown bus ${bus}`);num(v,0,1,id,`send ${bus}`);}});
  });
  opt(p,'seed',x=>int(x,1,4294967295,id,'part.seed'));
 }
 return s;
}

// A complete event log: setup plus notes and controls with unique ids, known
// parts, and cross-note references that point to earlier notes on the same part.
export function validateEventLog(log){
 obj(log,undefined,'event log');if(log.contract!==CONTRACT)fail(undefined,`contract must be '${CONTRACT}'`);
 validateSetup(log.setup);
 const parts=new Set(log.setup.parts.map(p=>p.id));
 checkEvents(log.notes??[],log.controls??[],parts,new Map());
 return log;
}
export function checkEvents(notes,controls,parts,known){
 if(!Array.isArray(notes)||!Array.isArray(controls))fail(undefined,'notes and controls must be arrays');
 for(const n of notes){validateNote(n);if(!parts.has(n.part))fail(n.id,`unknown part ${n.part}`);if(known.has(n.id))fail(n.id,'duplicate note id');known.set(n.id,n);}
 for(const n of notes){const l=n.techniques?.find(t=>t.type==='legato');if(!l)continue;const from=known.get(l.from);
  if(!from||from.part!==n.part||!(from.at<n.at))fail(n.id,'legato.from must name an earlier note on the same part');}
 // A chord gesture's members share part, written onset and gesture.
 const parted=new Map();for(const n of notes)if(n.gesture)parted.set(n.gesture.id,[...(parted.get(n.gesture.id)??[]),n]);
 for(const [gid,members] of parted){if(new Set(members.map(n=>n.part)).size>1)fail(members[1].id,`gesture ${gid} spans parts`);if(gestureGroups(members).mismatched.length)fail(gestureGroups(members).mismatched[0].id,`gesture ${gid} members differ in onset or gesture`);}
 const cids=new Set();
 for(const c of controls){validateControl(c);if(!sessionControl(c)&&!parts.has(c.part))fail(c.id,`unknown part ${c.part}`);if(cids.has(c.id))fail(c.id,'duplicate control id');cids.add(c.id);}
}
