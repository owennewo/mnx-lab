// Compile/validate future note plans on the page thread, not the audio thread.
// This prepares event metadata only: audio and thwack remain entirely realtime.
import {latestPluckEvents} from './note-ownership.js';
const stringOf=e=>Number(e.key[1]);
const isTrigger=e=>/^s[0-5]-trigger$/.test(e.key);
export function prepareOwnedEvents(events){
 const compiled=latestPluckEvents(events),banks=Array.from({length:6},()=>new Map());
 for(const e of events)if(e.noteStart!==undefined){const bank=banks[stringOf(e)];if(!bank.has(e.noteStart))bank.set(e.noteStart,{start:e.noteStart,events:[]});bank.get(e.noteStart).events.push(e);}
 return {events:compiled,banks:banks.map(bank=>[...bank.values()].sort((a,b)=>a.start-b.start).map(n=>({...n,events:[...n.events].sort((a,b)=>a.frame-b.frame)})))};
}
export class PreparedNoteOwnershipSchedule{
 constructor(prepared){this.banks=prepared.banks;this.events=prepared.events;this.states=Array.from({length:6},()=>({value:0,frame:-1}));}
 replace(events,position){return this.replacePrepared(prepareOwnedEvents(events),position);}
 replacePrepared(prepared,position){
  const states=this.states.map(s=>({...s}));
  for(const e of this.events){if(e.frame>=position)break;if(isTrigger(e))states[stringOf(e)]={value:e.value,frame:e.frame};}
  const banks=[],retained=[];
  for(let s=0;s<6;s++){
   let active;for(const n of this.banks[s]){if(n.start>=position)break;active=n;}
   const future=prepared.banks[s].filter(n=>n.start>=position),next=future[0]?.start??Infinity;
   banks[s]=active?[active,...future]:future;
   // Preserve the latest played note even after its release; older long notes
   // cannot return. Its uncut curve can extend if the next pluck is delayed.
   if(active)for(const e of active.events){
    const reset=isTrigger(e)&&e.value===0,frame=reset?Math.min(e.frame,next-1):e.frame;
    if(frame>=position&&(reset||frame<next))retained.push(frame===e.frame?e:{...e,frame});
   }
  }
  retained.sort((a,b)=>a.frame-b.frame);
  const incoming=prepared.events.filter(e=>e.frame>=position&&(e.noteStart===undefined||e.noteStart>=position));
  const result=[];let a=0,b=0;
  while(a<retained.length||b<incoming.length)result.push(b===incoming.length||(a<retained.length&&retained[a].frame<=incoming[b].frame)?retained[a++]:incoming[b++]);
  const nextStates=states.map(s=>({...s}));
  for(const e of result)if(isTrigger(e)){
   const s=stringOf(e),state=nextStates[s];
   if(e.noteStart!==undefined&&e.value===1&&(state.value!==0||state.frame>=e.frame))throw Error('Future pluck edit leaves no low trigger sample');
   nextStates[s]={value:e.value,frame:e.frame};
  }
  // Commit only after checking the replacement against actually played edges.
  this.banks=banks;this.events=result;this.states=states;return result;
 }
}
