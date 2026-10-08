// Defined performance workloads. The multi-part reference session: the loose-strum
// guitar take with drive and a dotted echo, basic keys chords (rolled) with the pedal down each
// bar, an 8th-note kit groove with an open-hat choke, every part sending to the Room bus.
// The take's tempo is in the stream (a tempo control), which the echo follows.
import {CONTRACT} from '../contract/index.js';
import {STANDARD_GUITAR} from './instruments/plucked-design.js';
export function referenceSession(material,{guitarDesign}){
 const take=material.takes.find(t=>t.id==='loose-strum'),bpm=take.bpm,beat=60/bpm,end=Math.max(...take.notes.map(n=>n.at+n.duration)),bars=Math.ceil(end/(4*beat));
 const setup={contract:CONTRACT,session:{buses:[{id:'room',type:'room',params:{level:.18,decay:.6,predelay:8,damping:8500,width:.8}}],master:{volumeDb:-3}},parts:[
  {id:'guitar',instrument:{kind:'plucked',design:guitarDesign,layout:STANDARD_GUITAR},chain:[{id:'drive',type:'drive',params:{gain:6,mix:.3,tone:6000}},{id:'echo',type:'echo',params:{mix:.4,beats:.75,feedback:.5,pingPong:true}}],strip:{sends:{room:.5}},seed:20261004},
  {id:'keys',instrument:{kind:'keys',design:'basic-piano'},strip:{levelDb:-6,pan:.3,sends:{room:.3}}},
  {id:'drums',instrument:{kind:'kit',design:'basic-kit'},strip:{levelDb:-4,sends:{room:.15}}}]};
 const notes=take.notes.map(n=>({...n,part:'guitar'})),controls=[{id:'tempo',at:0,type:'tempo',bpm}],chords=[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]];
 for(let bar=0;bar<bars;bar++){
  const at=.15+bar*4*beat;
  const roll={id:`roll${bar}`,type:'roll',direction:'up',spreadSeconds:.03};
  chords[bar%4].forEach((pitch,i)=>notes.push({id:`k${bar}-${i}`,part:'keys',at,duration:3.5*beat,velocity:.45,target:{pitch},gesture:roll}));
  controls.push({id:`pd${bar}`,part:'keys',at,type:'sustainPedal',value:1},{id:`pu${bar}`,part:'keys',at:at+4*beat-.05,type:'sustainPedal',value:0});
  for(let eighth=0;eighth<8;eighth++){const t=at+eighth*beat/2;
   notes.push({id:`h${bar}-${eighth}`,part:'drums',at:t,duration:.1,velocity:eighth%2?.4:.6,target:{piece:eighth===7&&bar%2?'hihat-open':'hihat-closed'}});
   if(eighth%4===0)notes.push({id:`b${bar}-${eighth}`,part:'drums',at:t,duration:.1,velocity:.85,target:{piece:'kick'}});
   if(eighth%4===2)notes.push({id:`s${bar}-${eighth}`,part:'drums',at:t,duration:.1,velocity:.75,target:{piece:'snare'}});}
  if(bar%4===0)notes.push({id:`c${bar}`,part:'drums',at,duration:.1,velocity:.7,target:{piece:'crash'}});
 }
 return {setup,notes,controls,seconds:end+2};
}
