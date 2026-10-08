// Chord gestures (chain campaign C18): the stream says how a chord is played, as Guitar
// Pro's brush and arpeggio and MNX's arpeggio do. Members are notes on one part that
// share `gesture.id`, the same written onset and the same gesture. Member k of N, in the
// order the gesture meets them, starts spread·k/(N−1) after the written onset; every
// member keeps its written end (a strummed chord stops together), but at least half its
// written length.
//
//  strum  direction is the STROKE. down: from the highest-numbered string towards
//         string 1 (on a standard guitar, low to high pitch; on a re-entrant ukulele,
//         string 4 G4 first). up: the reverse. Instruments without strings play a down
//         strum rising in pitch.
//  roll   direction is the PITCH, as MNX's arpeggio: up rises, down falls.
import {PIECES} from './core.js';

export const GESTURES=Object.freeze(['strum','roll']);
export const GESTURE_FIELDS=Object.freeze(['type','direction','spreadSeconds']);
// True when the stroke or roll meets lower sounding pitches first on a pitched, stringless instrument.
export const rising=g=>g.type==='strum'?g.direction==='down':g.direction==='up';
const sameGesture=(a,b)=>GESTURE_FIELDS.every(k=>a.gesture[k]===b.gesture[k])&&a.at===b.at;
// Members by gesture id, in id order; members that disagree with the first are split
// off and play as written (`mismatched`).
export function gestureGroups(notes){
 const groups=new Map(),mismatched=[];
 for(const n of [...notes].filter(n=>n.gesture&&GESTURES.includes(n.gesture.type)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
  const g=groups.get(n.gesture.id);
  if(!g)groups.set(n.gesture.id,[n]);else if(sameGesture(g[0],n))g.push(n);else mismatched.push(n);
 }
 return {groups,mismatched};
}
// Generic order: by sounding pitch (kit pieces in vocabulary order), ties by id.
export function pitchOrder(members,gesture){
 const key=n=>n.target.pitch??PIECES.indexOf(n.target.piece),up=rising(gesture);
 return [...members].sort((a,b)=>(up?key(a)-key(b):key(b)-key(a))||(a.id<b.id?-1:a.id>b.id?1:0));
}
// → Map note id → {at, duration} for members in gesture order.
export function gestureTimes(order,gesture){
 const n=order.length,out=new Map();
 order.forEach((note,k)=>{const at=note.at+(n>1?gesture.spreadSeconds*k/(n-1):0),end=note.at+note.duration;out.set(note.id,{at,duration:Math.max(end-at,note.duration/2)});});
 return out;
}
