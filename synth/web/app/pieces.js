// Pieces (chain campaign Phase 6): short named pieces in the fixture format: the music,
// the setup it was written for, and checks. arrange() plays a piece through a session:
// each of the piece's lines goes to the first unused session part of its instrument
// kind; a guitar line on other strings loses its fingering and is moved by octaves into
// the part's range; a part on the line's own strings is preferred. Lines no part plays,
// and parts with no line, are reported.
import {effectiveEvents} from '../host/index.js';

export const DEFAULT_PIECE='guitar-strums';
const sameLayout=(a,b)=>!!a&&!!b&&a.strings.length===b.strings.length&&a.strings.every((s,i)=>s.pitch===b.strings[i].pitch)&&(a.capo??0)===(b.capo??0);
// Frets usable for refitted lines: comfortable reach above the lowest open string.
const REACH=19;
function fit(line,part,notes){
 const layout=part.instrument.layout;if(sameLayout(line.layout,layout))return null;
 const capo=layout.capo??0,pitches=layout.strings.map(s=>s.pitch),lo=Math.min(...pitches)+capo,hi=Math.max(...pitches)+capo+REACH;
 const written=notes.map(n=>n.target.pitch).filter(p=>p!==undefined);let shift=0,outside=Infinity;
 for(const k of [0,-12,12,-24,24]){const n=written.filter(p=>p+k<lo||p+k>hi).length;if(n<outside){shift=k;outside=n;}}
 return p=>{let x=p+shift;while(x<lo)x+=12;while(x>hi)x-=12;return x;};
}
// → {notes, controls, length, lines:[{id, name, kind, layout, part}], silent:[part ids]}
export function arrange(piece,setup){
 const {notes,controls}=effectiveEvents(piece),taken=new Set();
 const lines=piece.setup.parts.map(pp=>({id:pp.id,name:pp.name??pp.id,kind:pp.instrument.kind,layout:pp.instrument.layout,part:null}));
 // First a part on the strings the line was written for (a ukulele line to a ukulele), then any part of its kind.
 for(const exact of [true,false])for(const l of lines){if(l.part)continue;
  const p=setup.parts.find(x=>x.instrument.kind===l.kind&&!taken.has(x.id)&&(!exact||l.kind!=='plucked'||sameLayout(l.layout,x.instrument.layout)));if(p){taken.add(p.id);l.part=p.id;}}
 const byLine=new Map(lines.map(l=>[l.id,l])),folds=new Map();
 for(const l of lines)if(l.part&&l.kind==='plucked')folds.set(l.id,fit(l,setup.parts.find(p=>p.id===l.part),notes.filter(n=>n.part===l.id)));
 const tag=(l,id)=>`${l.part}:${id}`,out=[];
 for(const n of notes){
  const l=byLine.get(n.part);if(!l?.part)continue;const fold=folds.get(l.id),x={...n,id:tag(l,n.id),part:l.part};
  if(n.gesture)x.gesture={...n.gesture,id:tag(l,n.gesture.id)};
  if(n.techniques)x.techniques=n.techniques.map(t=>t.type==='legato'?{...t,from:tag(l,t.from)}:t);
  if(fold){delete x.fingering;if(n.target.pitch!==undefined)x.target={pitch:fold(n.target.pitch)};}
  out.push(x);
 }
 const ctl=[];for(const c of controls){if(c.part===undefined){ctl.push(c);continue;}const l=byLine.get(c.part);if(l?.part)ctl.push({...c,id:tag(l,c.id),part:l.part});}
 const length=piece.render?.seconds??Math.max(1,...notes.map(n=>n.at+n.duration))+2;
 return {notes:out,controls:ctl,length,lines,silent:setup.parts.filter(p=>!taken.has(p.id)).map(p=>p.id)};
}
