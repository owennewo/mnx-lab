// Explicit experimental event semantics, not a migration of factory 1.4.0.
export const LEGACY_NOTE_POLICY='legacy-1.4.0';
export const LATEST_NOTE_POLICY='latest-pluck-v1';
export function validateNotePolicy(policy){
 if(policy!==LEGACY_NOTE_POLICY&&policy!==LATEST_NOTE_POLICY)throw Error('Unknown note ownership policy: '+policy);
 return policy;
}
// The string of an `s0-`…`s5-` key (0–5), else undefined. Called per event on every re-plan,
// so by character code rather than a regular expression.
const stringOf=event=>{const k=event.key,s=k.charCodeAt(1)-48;return k.charCodeAt(0)===115&&k.charCodeAt(2)===45&&s>=0&&s<=5?s:undefined;};
// `s<n>-trigger`, for a key stringOf has accepted.
const isTriggerKey=key=>key.length===10&&key.endsWith('-trigger');

// Keep the uncut trajectories, including historical onsets. Cutting this bank
// would freeze a ringing note if a future pluck were subsequently delayed or
// removed, or resurrect an older long note after a newer short note ended.
export class NoteOwnershipSchedule{
 constructor(events){this.replace(events);}
 replace(events,position){
  const raw=position===undefined?events:([
   ...this.raw.filter(e=>e.noteStart!==undefined&&e.noteStart<position),
   ...events.filter(e=>e.frame>=position&&(e.noteStart===undefined||e.noteStart>=position)),
  ]);
  const compiled=latestPluckEvents(raw);
  if(position!==undefined){
   // An edit cannot retroactively create the low sample that a new rising
   // edge requires. Retain the actual past trigger state, not a newly cut
   // version of that past. Reject too-late edits instead of losing a pluck.
   const states=Array.from({length:6},()=>({value:0,frame:-1}));
   for(const e of this.events)if(e.frame<position&&/^s[0-5]-trigger$/.test(e.key))states[stringOf(e)]={value:e.value,frame:e.frame};
   for(const e of compiled){
    if(e.frame<position||!/^s[0-5]-trigger$/.test(e.key))continue;
    const s=stringOf(e),state=states[s];
    if(e.noteStart!==undefined&&e.value===1&&(state.value!==0||state.frame>=e.frame))throw Error('Future pluck edit leaves no low trigger sample');
    states[s]={value:e.value,frame:e.frame};
   }
  }
  this.raw=raw.map(e=>({...e}));this.events=compiled;
  return position===undefined?compiled:compiled.filter(e=>e.frame>=position);
 }
}

// Also usable before native TSV export, where noteStart metadata is lost. `strip` returns
// plain {frame,key,value} events, without the ownership metadata (the planner's form).
export function latestPluckEvents(events,strip=false){
 const notes=Array.from({length:6},()=>new Map()),owner=new Array(events.length);
 for(let i=0;i<events.length;i++){
  const e=events[i];
  if(!Number.isInteger(e.frame)||e.frame<0||!Number.isFinite(e.value)||typeof e.key!=='string')throw Error('Invalid note event');
  if(e.noteStart===undefined)continue; // Direct manual controls remain direct.
  const s=stringOf(e);
  if(s===undefined||!Number.isInteger(e.noteStart)||e.noteStart<0||e.frame<e.noteStart)throw Error('Invalid owned note event');
  let n=notes[s].get(e.noteStart);
  if(!n){n={start:e.noteStart,triggers:0,resets:[]};notes[s].set(e.noteStart,n);}
  owner[i]=n;
  if(isTriggerKey(e.key)&&e.value===1){
   if(e.frame!==e.noteStart)throw Error('Owned pluck must trigger at its onset');
   n.triggers++;
  }
  if(isTriggerKey(e.key)&&e.value===0)n.resets.push(e.frame);
 }
 for(const bank of notes){
  const ordered=[...bank.values()].sort((a,b)=>a.start-b.start);
  for(let i=0;i<ordered.length;i++){
   const n=ordered[i];
   if(n.triggers!==1)throw Error('Ambiguous or missing same-string pluck onset');
   if(n.resets.length!==1||n.resets[0]<=n.start)throw Error('Owned pluck requires one later trigger reset');
   n.next=ordered[i+1]?.start??Infinity;
   // At least one low DSP sample is needed between two rising edges.
   if(n.next-n.start<2)throw Error('Same-string plucks require at least two samples between onsets');
   n.reset=Math.min(n.resets[0],n.next-1);
  }
 }
 const result=[],copy=strip?(e,frame)=>({frame,key:e.key,value:e.value}):(e,frame)=>({...e,frame});
 for(let i=0;i<events.length;i++){
  const e=events[i],n=owner[i];
  if(!n){result.push(copy(e,e.frame));continue;}
  if(isTriggerKey(e.key)&&e.value===0)result.push(copy(e,n.reset));
  else if(e.frame<n.next)result.push(copy(e,e.frame));
 }
 return result.sort((a,b)=>a.frame-b.frame);
}
