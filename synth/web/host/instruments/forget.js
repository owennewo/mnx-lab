// Forgetting (host-core.js forget): an instrument re-plans its remembered notes on every
// batch, so it folds the notes the host forgets into the state its planner carries from
// note to note, and plans the rest from there. A planner works in onset order, so only a
// LEADING run of forgotten notes can be folded — exactly as if they were still planned —
// and a chord gesture only as a whole (a member left behind would be timed without the
// rest). Forgotten notes not yet at the front wait, in `pending`, for a later fold.
const byOnset=(a,b)=>a.frame-b.frame||(a.id<b.id?-1:a.id>b.id?1:0);
export function leadingForgotten(entries,pending,ready=()=>true){
 const sorted=[...entries].sort(byOnset);let k=0;
 while(k<sorted.length&&pending.has(sorted[k].id)&&ready(sorted[k]))k++;
 let prefix=sorted.slice(0,k);
 const later=new Set(sorted.slice(k).map(e=>e.note.gesture?.id).filter(Boolean));
 const cut=prefix.findIndex(e=>later.has(e.note.gesture?.id));
 if(cut>=0)prefix=prefix.slice(0,cut);
 return prefix;
}
/** Folds the leading forgotten notes that are `ready` through `fold(prefix)` (which may
 *  return false to wait) and drops them. */
export function forgetLeading(instrument,ids,order,fold,ready){
 instrument.pending??=new Set();
 for(const id of ids)if(instrument.entries.has(id))instrument.pending.add(id);
 if(!instrument.pending.size)return;
 const prefix=leadingForgotten(order(),instrument.pending,ready);
 if(!prefix.length||fold(prefix)===false)return;
 for(const e of prefix){instrument.entries.delete(e.id);instrument.pending.delete(e.id);}
}
