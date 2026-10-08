// The piece library (chain campaign Phase 6): short named pieces that each show one
// thing, written as mnx-sound/2 fixtures — the music, the setup it was written for and
// measured checks. The app plays a piece through the user's session (lines matched to
// parts by instrument) or loads it with its own setup as an example. Deterministic:
// --check verifies web/data/pieces/ is current.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {BLOCK_TYPES} from '../web/host/blocks.js';
import {validateFixture} from '../web/contract/index.js';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const check=process.argv.includes('--check'),dir='web/data/pieces',CONTRACT='mnx-sound/2';

// --- Setups ----------------------------------------------------------------------------
const STANDARD=[64,59,55,50,45,40],UKE=[69,64,60,67];
const layout=strings=>({strings:strings.map(pitch=>({pitch})),capo:0});
const strip=send=>({levelDb:0,pan:0,mute:false,solo:false,sends:{room:send}});
const block=(type,preset,id=type)=>({id,type,state:'on',preset,basePreset:preset,params:{...Object.fromEntries(Object.entries(BLOCK_TYPES[type].params).map(([k,d])=>[k,d.default])),...BLOCK_TYPES[type].presets[preset]}});
const guitar=(design,{id='guitar',name='Guitar',strings=STANDARD,chain=[],send=.3,levelDb=0}={})=>({id,name,instrument:{kind:'plucked',design,layout:layout(strings)},chain,strip:{...strip(send),levelDb}});
const keys=({id='keys',name='Keys',send=.15,levelDb=0}={})=>({id,name,instrument:{kind:'keys',design:{id:'basic-piano'}},chain:[],strip:{...strip(send),levelDb}});
const kit=({id='kit',name='Kit',send=.15,levelDb=0}={})=>({id,name,instrument:{kind:'kit',design:{id:'basic-kit'}},chain:[],strip:{...strip(send),levelDb}});
const session=parts=>({contract:CONTRACT,session:{buses:[block('room','Studio','room')],master:{volumeDb:0,ceilingDb:-1}},parts});

// --- Music -----------------------------------------------------------------------------
// Bar/beat clock from a tempo map [[bar, bpm], …]; every piece starts 0.2 s in.
function clock(map,beatsPerBar=4){
 return (bar,beat=0)=>{let t=.2,b=0;const x=bar+beat/beatsPerBar;
  for(let k=0;k<map.length;k++){const [from,bpm]=map[k],to=k+1<map.length?map[k+1][0]:Infinity,end=Math.min(x,to);if(end>from)t+=(end-Math.max(from,b))*beatsPerBar*60/bpm;b=to;if(x<=to)break;}
  return Math.round(t*1e6)/1e6;};
}
const r6=x=>Math.round(x*1e6)/1e6;
const GUITAR_OPEN={1:64,2:59,3:55,4:50,5:45,6:40},UKE_OPEN={1:69,2:64,3:60,4:67};
const SHAPES={E:[[6,0],[5,2],[4,2],[3,1],[2,0],[1,0]],A:[[5,0],[4,2],[3,2],[2,2],[1,0]],D:[[4,0],[3,2],[2,3],[1,2]],G:[[6,3],[5,2],[4,0],[3,0],[2,0],[1,3]],
 C:[[5,3],[4,2],[3,0],[2,1],[1,0]],Am:[[5,0],[4,2],[3,2],[2,1],[1,0]],Em:[[6,0],[5,2],[4,2],[3,0],[2,0],[1,0]],F:[[4,3],[3,2],[2,1],[1,1]]};
const UKE_SHAPES={C:[[4,0],[3,0],[2,0],[1,3]],Am:[[4,2],[3,0],[2,0],[1,0]],F:[[4,2],[3,0],[2,1],[1,0]],G7:[[4,0],[3,2],[2,1],[1,2]]};
function writer(part){
 let k=0;const notes=[];
 const add=(at,duration,velocity,target,extra={})=>{const n={id:`${part}-${++k}`,part,at:r6(at),duration:r6(duration),velocity,target,...extra};notes.push(n);return n;};
 const pitched=(at,duration,velocity,pitch,extra)=>add(at,duration,velocity,{pitch},extra);
 const fretted=(open,at,duration,velocity,string,fret,extra={})=>pitched(at,duration,velocity,open[string]+fret,{fingering:{string,fret},...extra});
 // A chord as one gesture; `top` keeps only the highest-numbered n strings from string 1 up (light up strums).
 const chord=(open,shapes,name,at,duration,velocity,gesture,{top,extra={}}={})=>{
  const shape=top?shapes[name].filter(([s])=>s<=top):shapes[name],g=gesture&&{id:`${part}-g${++k}`,...gesture};
  return shape.map(([string,fret])=>fretted(open,at,duration,velocity,string,fret,{...(g?{gesture:g}:{}),...extra}));
 };
 return {notes,add,pitched,fretted,chord,piece:(at,velocity,piece,duration=.1)=>add(at,duration,velocity,{piece})};
}
const tempo=(at,bpm,id='tempo')=>({id,at:r6(at),type:'tempo',bpm});
const down=spread=>({type:'strum',direction:'down',spreadSeconds:spread}),up=spread=>({type:'strum',direction:'up',spreadSeconds:spread});
const baseChecks=parts=>[{kind:'noDiagnostics',severity:'warning'},{kind:'peakBelow',dbfs:-.5},...parts.map(part=>({kind:'partActive',part,aboveDb:-40}))];
const seconds=(notes,tail=2.5)=>Math.ceil((Math.max(...notes.map(n=>n.at+n.duration))+tail)*10)/10;
const pieces=[];
const piece=(id,group,name,description,setup,notes,controls,expect,tail)=>pieces.push({contract:CONTRACT,fixture:{id,name,group,description},setup,notes,controls,render:{rate:48000,seconds:seconds(notes,tail)},expect});

// Strum patterns: eighth-note slots with a direction (D/U) or rest.
function strumBar(w,t,bar,name,pattern,{open=GUITAR_OPEN,shapes=SHAPES,downSpread=.02,upSpread=.015,top=4,accent=.8,light=.6}={}){
 const slots=[...pattern].map((c,i)=>[c,i]).filter(([c])=>c!=='.'),eighth=(t(bar,1)-t(bar,0))/2,first=[];
 slots.forEach(([c,i],k)=>{const at=t(bar,i/2),next=k+1<slots.length?t(bar,slots[k+1][1]/2):t(bar+1,0),dur=(next-at)*.95,beat=i%2===0;
  const notes=w.chord(open,shapes,name,at,dur,c==='D'?(i%4===0?accent:light):light-.1,c==='D'?down(downSpread):up(upSpread),c==='U'&&top?{top}:{});if(!k)first.push(...notes);});
 return {first,eighth};
}

// 1. Band – four-bar groove
{
 const t=clock([[0,100]]),g=writer('guitar'),kb=writer('keys'),d=writer('kit');let firstStrum;
 ['Em','C','G','D'].forEach((c,bar)=>{const {first}=strumBar(g,t,bar,c,'D.DU.UDU');if(!bar)firstStrum=first;});
 const pads={Em:[52,55,59,64],C:[48,52,55,60],G:[43,50,55,59],D:[50,54,57,62]},controls=[tempo(0,100)];
 ["Em","C","G","D"].forEach((c,bar)=>{const g2={id:`kr${bar}`,type:'roll',direction:'up',spreadSeconds:.03};
  pads[c].forEach(p=>kb.pitched(t(bar,0),t(bar,4)-t(bar,0)-.05,.45,p,{gesture:g2}));kb.pitched(t(bar,2),t(bar,3.5)-t(bar,2),.45,pads[c][3]+12);
  controls.push({id:`pd${bar}`,part:'keys',at:t(bar,0),type:'sustainPedal',value:1},{id:`pu${bar}`,part:'keys',at:r6(t(bar+1,0)-.05),type:'sustainPedal',value:0});});
 for(let bar=0;bar<4;bar++)for(let e=0;e<8;e++){const at=t(bar,e/2);
  d.piece(at,e%2?.35:.55,bar===2&&e===7?'hihat-open':bar===3&&e===0?'hihat-pedal':'hihat-closed');
  if(e===0||e===3||e===4)d.piece(at,.85,'kick');if(e===2||e===6)d.piece(at,.75,'snare');if(!bar&&!e)d.piece(at,.7,'crash');}
 const s6=firstStrum.find(n=>n.fingering.string===6),s1=firstStrum.find(n=>n.fingering.string===1);
 piece('band-groove','Band','Band – four-bar groove','Guitar strums, rolled keys chords with the pedal, and an eighth-note kit groove with an open hi-hat choked by the pedal. A whole session at once.',
  session([guitar('clear-steel',{levelDb:-5}),keys({levelDb:-6}),kit({levelDb:-5})]),[...g.notes,...kb.notes,...d.notes],controls,
  [...baseChecks(['guitar','keys','kit']),{kind:'onsetAt',note:s6.id,seconds:0},{kind:'onsetAt',note:s1.id,seconds:.02}]);
}
// 2. Band – slow ballad
{
 const t=clock([[0,72]]),g=writer('guitar'),kb=writer('keys'),d=writer('kit'),controls=[tempo(0,72)];
 ['C','Am','F','G'].forEach((c,bar)=>{const shape=SHAPES[c],bass=shape[0],top=s=>shape.find(([x])=>x===s);
  [bass,top(3),top(2),top(1),top(2),top(3),top(2),top(1)].forEach(([s,f],e)=>g.fretted(GUITAR_OPEN,t(bar,e/2),t(bar,e/2+1.5)-t(bar,e/2),e?.5:.62,s,f,{techniques:[{type:'letRing'}]}));});
 const pads={C:[48,55,60,64],Am:[45,52,57,60],F:[41,48,53,57],G:[43,50,55,59]};
 ['C','Am','F','G'].forEach((c,bar)=>{pads[c].forEach(p=>kb.pitched(t(bar,0),t(bar,4)-t(bar,0)-.05,.32,p));
  controls.push({id:`pd${bar}`,part:'keys',at:t(bar,0),type:'sustainPedal',value:1},{id:`pu${bar}`,part:'keys',at:r6(t(bar+1,0)-.05),type:'sustainPedal',value:0});});
 for(let bar=0;bar<4;bar++)for(let beat=0;beat<4;beat++){d.piece(t(bar,beat),.4,'ride');if(beat===1||beat===3)d.piece(t(bar,beat),.5,'side-stick');if(beat===0||beat===2)d.piece(t(bar,beat),.6,'kick');}
 piece('band-ballad','Band','Band – slow ballad','A fingerpicked guitar with a dotted echo (it follows the tempo), soft keys pads with the pedal, and a light ride and side-stick pattern.',
  session([guitar('rounded-steel',{levelDb:-2,chain:[{...block('echo','Dotted echo'),params:{...block('echo','Dotted echo').params,mix:.25}}]}),keys(),kit({levelDb:-3})]),[...g.notes,...kb.notes,...d.notes],controls,baseChecks(['guitar','keys','kit']),3);
}
// 3. Guitar – strums down & up
{
 const t=clock([[0,90]]),g=writer('guitar');let firstDown,firstUp;
 ['E','A'].forEach((c,bar)=>{const {first}=strumBar(g,t,bar,c,'D.DU.UDU',{downSpread:.025,upSpread:.018});if(!bar)firstDown=first;});
 const rake=g.chord(GUITAR_OPEN,SHAPES,'D',t(2,0),t(2,2)-t(2,0),.7,down(.15));
 firstUp=g.chord(GUITAR_OPEN,SHAPES,'D',t(2,2),t(3,0)-t(2,2),.6,up(.1));
 g.chord(GUITAR_OPEN,SHAPES,'E',t(3,0),t(4,0)-t(3,0),.95,down(.03),{extra:{techniques:[{type:'letRing'}]}});
 const s=(notes,str)=>notes.find(n=>n.fingering.string===str).id;
 piece('guitar-strums','Guitar','Guitar – strums down & up','Chord gestures: eighth-note strums down (low string first) and lighter up strums, then a slow rake down and up, and one big strum left ringing.',
  session([guitar('clear-steel',{levelDb:-3})]),g.notes,[tempo(0,90)],
  [...baseChecks(['guitar']),{kind:'onsetAt',note:s(firstDown,6),seconds:0},{kind:'onsetAt',note:s(firstDown,1),seconds:.025},{kind:'onsetAt',note:s(rake,1),seconds:.15},{kind:'onsetAt',note:s(firstUp,1),seconds:0},{kind:'onsetAt',note:s(firstUp,4),seconds:.1}],3);
}
// 4. Guitar – bends, slides & vibrato
{
 const t=clock([[0,80]]),g=writer('guitar'),F=(...a)=>g.fretted(GUITAR_OPEN,...a);const len=(b0,b1,bar=0)=>t(bar,b1)-t(bar,b0);
 const bend=F(t(0,0),len(0,1.5),.7,2,5,{techniques:[{type:'bend',points:[{at:0,cents:0},{at:.3,cents:200},{at:1,cents:200}]}]});
 F(t(0,2),len(2,4),.7,2,5,{techniques:[{type:'bend',points:[{at:0,cents:200},{at:.4,cents:200},{at:.8,cents:0},{at:1,cents:0}]}]});
 const slideIn=F(t(1,0),len(0,1,1),.7,3,7,{techniques:[{type:'slide',direction:'in',cents:-200,span:.25}]});
 F(t(1,1),len(1,2,1),.7,3,9,{techniques:[{type:'legato',from:slideIn.id,via:'slide'}]});
 const vib=F(t(1,2),len(2,4,1),.7,2,8,{techniques:[{type:'vibrato',depthCents:30,rateHz:5.5,delaySeconds:.15}]});
 F(t(2,0),len(0,1,2),.75,1,8,{techniques:[{type:'bend',points:[{at:0,cents:0},{at:.25,cents:100},{at:1,cents:100}]}]});
 F(t(2,1),len(1,4,2),.7,1,10,{techniques:[{type:'vibrato',depthCents:50,rateHz:4.5,delaySeconds:.1}]});
 F(t(3,0),len(0,2,3),.7,2,10,{techniques:[{type:'slide',direction:'out',cents:-700,span:.4}]});
 F(t(3,2),len(2,4,3),.65,3,9,{techniques:[{type:'vibrato',depthCents:15,rateHz:6,delaySeconds:.2}]});
 piece('guitar-bends','Guitar','Guitar – bends, slides & vibrato','A lead line: a full-step bend and a pre-bend release, a slide in and a slide shift, wide and narrow vibrato, a half-step bend and a slide out.',
  session([guitar('bright-metallic')]),g.notes,[tempo(0,80)],
  [...baseChecks(['guitar']),{kind:'pitch',note:bend.id,curve:'commanded',toleranceCents:15,maxCents:35},{kind:'pitch',note:vib.id,curve:'commanded',toleranceCents:15,maxCents:60},{kind:'pitch',note:slideIn.id,curve:'commanded',toleranceCents:15,maxCents:35,from:.3}]);
}
// 5. Guitar – hammer-ons, pull-offs & palm mutes
{
 const t=clock([[0,96]]),g=writer('guitar'),F=(...a)=>g.fretted(GUITAR_OPEN,...a);let hammer;
 for(let beat=0;beat<4;beat++){const s=beat%2?2:1,trip=(t(0,1)-t(0,0))/3,at=t(0,beat);
  const a=F(at,trip*.95,.7,s,5),b=F(at+trip,trip*.95,.6,s,7,{techniques:[{type:'legato',from:a.id,via:'hammer'}]});F(at+2*trip,trip*.95,.55,s,5,{techniques:[{type:'legato',from:b.id,via:'pull'}]});if(!beat)hammer=b;}
 {const a=F(t(1,0),t(1,.5)-t(1,0),.7,3,0),b=F(t(1,.5),t(1,1)-t(1,.5),.6,3,2,{techniques:[{type:'legato',from:a.id,via:'hammer'}]});F(t(1,1),t(1,2)-t(1,1),.6,3,4,{techniques:[{type:'legato',from:b.id,via:'hammer'}]});
  const c=F(t(1,2),t(1,2.5)-t(1,2),.7,1,8),d=F(t(1,2.5),t(1,3)-t(1,2.5),.6,1,5,{techniques:[{type:'legato',from:c.id,via:'pull'}]});F(t(1,3),t(1,4)-t(1,3),.55,1,0,{techniques:[{type:'legato',from:d.id,via:'pull'}]});}
 const palm=[{type:'mute',kind:'palm',amount:.6}];
 for(let bar=2;bar<4;bar++)for(let e=0;e<8;e++){const at=t(bar,e/2),dur=(t(bar,.5)-t(bar,0))*.95;
  if(bar===3&&(e===3||e===7)){F(at,dur*.5,.6,6,0,{techniques:[{type:'mute',kind:'dead'}]});continue;}
  const accent=bar===3&&e===0,tech=accent?{}:{techniques:palm};F(at,accent?dur*2:dur,accent?.9:.65,6,0,tech);if(e%4===0)F(at,accent?dur*2:dur,accent?.85:.6,5,2,tech);}
 piece('guitar-legato','Guitar','Guitar – hammer-ons, pull-offs & palm mutes','Triplet hammer-on/pull-off runs, a hammered climb and a pulled descent (no new picks), then palm-muted chugs with an open accent and dead notes.',
  session([guitar('bridge-electric',{chain:[block('drive','Crunch')],levelDb:-6})]),g.notes,[tempo(0,96)],
  [...baseChecks(['guitar']),{kind:'noNewAttack',note:hammer.id}]);
}
// 6. Guitar – fingerpicked arpeggio
{
 const t=clock([[0,84]]),g=writer('guitar');
 ['C','Am','F','G'].forEach((c,bar)=>{const shape=SHAPES[c],[t1,t2]=[shape[0],shape[1]],top=s=>shape.find(([x])=>x===s);
  [t1,top(3),t2,top(2),t1,top(1),t2,top(2)].forEach(([s,f],e)=>g.fretted(GUITAR_OPEN,t(bar,e/2),t(bar,e/2+1)-t(bar,e/2),e%2?.48:.6,s,f));});
 piece('guitar-fingerpick','Guitar','Guitar – fingerpicked arpeggio','A Travis-style pattern: the thumb alternates the bass on the beat, the fingers pick the treble strings between.',
  session([guitar('soft-nylon')]),g.notes,[tempo(0,84)],baseChecks(['guitar']));
}
// 7. Guitar – sustain & let ring
{
 const t=clock([[0,60]]),g=writer('guitar'),ring=[{type:'letRing'}];
 g.fretted(GUITAR_OPEN,t(0,0),t(0,4)-t(0,0),.75,6,0,{techniques:ring});g.fretted(GUITAR_OPEN,t(1,0),t(1,4)-t(1,0),.75,1,12,{techniques:ring});
 const big=g.chord(GUITAR_OPEN,SHAPES,'G',t(2,0),t(2,1)-t(2,0),.8,down(.04),{extra:{techniques:ring}});
 piece('guitar-sustain','Guitar','Guitar – sustain & let ring','A low open string and a high 12th-fret note left to ring, then a chord struck once and let ring through two bars: decay and the bridge’s sympathetic response.',
  session([guitar('wide-ringing',{levelDb:-2})]),g.notes,[tempo(0,60)],[...baseChecks(['guitar']),{kind:'sustainedPast',note:big.find(n=>n.fingering.string===1).id,seconds:1,aboveDb:-40}],6);
}
// 8. Guitar – soft to hard
{
 const t=clock([[0,90]]),g=writer('guitar');
 for(let k=0;k<8;k++)g.fretted(GUITAR_OPEN,t(Math.floor(k/4),k%4),t(0,1)-t(0,0),r6(.1+.9*k/7),3,2);
 for(let k=0;k<8;k++)g.chord(GUITAR_OPEN,SHAPES,'E',t(2+Math.floor(k/4),k%4),t(0,1)-t(0,0),r6(.15+.85*k/7),down(.02));
 piece('guitar-dynamics','Guitar','Guitar – soft to hard','One note eight times from barely touched to hard, then a chord the same way: how the guitar’s tone and level follow velocity.',
  session([guitar('clear-steel',{levelDb:-3})]),g.notes,[tempo(0,90)],baseChecks(['guitar']));
}
// 9. Guitar – recorded performance
{
 const take=JSON.parse(fs.readFileSync('web/data/material/guitar-takes.json')).takes.find(x=>x.id==='reference');
 const notes=take.notes.map(n=>({...n,part:'guitar'}));
 piece('guitar-recorded','Guitar','Guitar – recorded performance','The recorded reference passage as played, with its own timing, touch, vibrato and intonation: performance travels in the stream.',
  session([guitar('clear-steel')]),notes,[tempo(0,take.bpm)],baseChecks(['guitar']));
}
// 10. Ukulele – re-entrant strum
{
 const t=clock([[0,100]]),u=writer('ukulele');let first;
 ['C','Am','F','G7'].forEach((c,bar)=>{const {first:f}=strumBar(u,t,bar,c,'D.DU.UDU',{open:UKE_OPEN,shapes:UKE_SHAPES,downSpread:.02,upSpread:.015,top:0});if(!bar)first=f;});
 const s=str=>first.find(n=>n.fingering.string===str).id;
 piece('ukulele-strum','Ukulele','Ukulele – re-entrant strum','An island strum on a GCEA ukulele. String 4 is the high G, so a down strum starts high, dips to C and climbs: the strum follows the strings, not the pitch.',
  session([guitar('nail-nylon',{id:'ukulele',name:'Ukulele',strings:UKE})]),u.notes,[tempo(0,100)],
  [...baseChecks(['ukulele']),{kind:'onsetAt',note:s(4),seconds:0},{kind:'onsetAt',note:s(1),seconds:.02}]);
}
// 11. Keys – pedal & rolled chords
{
 const t=clock([[0,76]]),k=writer('keys'),controls=[tempo(0,76)],C=[48,52,55,60];
 for(let beat=0;beat<4;beat++)C.forEach(p=>k.pitched(t(0,beat),(t(0,1)-t(0,0))*.4,.55,p));
 controls.push({id:'pd1',part:'keys',at:t(1,0),type:'sustainPedal',value:1});
 for(const beat of [0,2])C.forEach(p=>k.pitched(t(1,beat),(t(0,1)-t(0,0))*.4,.55,p));
 controls.push({id:'pu1',part:'keys',at:r6(t(2,0)-.05),type:'sustainPedal',value:0});
 const roll=(dir,id)=>({id,type:'roll',direction:dir,spreadSeconds:.12});
 [41,48,53,57,60].forEach(p=>k.pitched(t(2,0),t(2,2)-t(2,0)-.05,.55,p,{gesture:roll('up','r1')}));
 [43,50,55,59,62].forEach(p=>k.pitched(t(2,2),t(3,0)-t(2,2)-.05,.55,p,{gesture:roll('down','r2')}));
 controls.push({id:'pd3',part:'keys',at:t(3,0),type:'sustainPedal',value:1});
 [45,52,57].forEach(p=>k.pitched(t(3,0),t(3,1)-t(3,0),.4,p));
 [72,71,69,67,64,67,69,72].forEach((p,e)=>k.pitched(t(3,e/2),(t(0,.5)-t(0,0))*.8,.5,p));
 controls.push({id:'pu3',part:'keys',at:t(4,0),type:'sustainPedal',value:0});
 piece('keys-pedal','Keys','Keys – pedal & rolled chords','Short chords without the pedal, the same chords with it, a chord rolled up and one rolled down, then a melody over a held chord until the pedal lifts.',
  session([keys()]),k.notes,controls,[...baseChecks(['keys']),{kind:'releasedWithin',control:'pu3',seconds:.5,belowDb:-40}]);
}
// 12. Kit – groove, fill & hi-hat chokes
{
 const t=clock([[0,100]]),d=writer('kit');let open,choke;
 for(let bar=0;bar<3;bar++)for(let e=0;e<8;e++){const at=t(bar,e/2);
  if(bar===2&&e===6)open=d.piece(at,.6,'hihat-open');else if(bar===2&&e===7)choke=d.piece(at,.55,'hihat-pedal');else d.piece(at,e%2?.35:.55,'hihat-closed');
  if(e===0||e===4||(bar===1&&e===5))d.piece(at,.85,'kick');if(e===2||e===6)d.piece(at,.75,'snare');
  if((bar===0&&e===7)||(bar===1&&e===3))d.piece(at,.2,'snare');}
 ['snare','snare','tom-high','tom-high','tom-mid','tom-mid','tom-low','tom-low'].forEach((p,e)=>d.piece(t(3,e/2),.75,p));
 d.piece(t(4,0),.8,'crash');d.piece(t(4,0),.85,'kick');
 piece('kit-groove','Kit','Kit – groove, fill & hi-hat chokes','Two bars of groove with ghost notes on the snare, an open hi-hat closed by the pedal, then a tom fill into a crash.',
  session([kit({levelDb:-2})]),d.notes,[tempo(0,100)],[...baseChecks(['kit']),{kind:'choked',note:open.id,by:choke.id,seconds:.03,belowDb:-40}],3);
}
// 13. Guitar – tempo change: the echo follows
{
 const t=clock([[0,80],[2,120]]),g=writer('guitar');
 for(let bar=0;bar<4;bar++)for(const beat of [0,2])g.fretted(GUITAR_OPEN,t(bar,beat),.15,.75,beat?2:1,5);
 piece('guitar-tempo-echo','Guitar','Guitar – tempo change: the echo follows','Short notes through a dotted echo: two bars at 80 bpm, then the music speeds up to 120 bpm and the echo’s repeats tighten with it. Tempo travels in the stream.',
  session([guitar('clear-steel',{chain:[block('echo','Dotted echo')]})]),g.notes,[tempo(0,80),tempo(t(2,0),120,'tempo2')],baseChecks(['guitar']),3);
}

// --- Write ---------------------------------------------------------------------------
for(const p of pieces)validateFixture(p);
const index={schema:'synth-pieces/1',note:'Generated by scripts/build_pieces.mjs; do not edit by hand.',pieces:pieces.map(p=>({id:p.fixture.id,name:p.fixture.name,group:p.fixture.group,description:p.fixture.description}))};
const files={'index.json':index,...Object.fromEntries(pieces.map(p=>[`${p.fixture.id}.json`,p]))},text=x=>JSON.stringify(x,null,1)+'\n';
if(check){
 const present=fs.existsSync(dir)?fs.readdirSync(dir).sort():[];
 if(present.join()!==Object.keys(files).sort().join())throw Error(`${dir} has ${present.join(', ')}; expected ${Object.keys(files).sort().join(', ')}`);
 for(const [name,data] of Object.entries(files))if(fs.readFileSync(`${dir}/${name}`,'utf8')!==text(data))throw Error(`${dir}/${name} is stale: run node scripts/build_pieces.mjs`);
 console.log(`${pieces.length} pieces current`);
}else{
 fs.mkdirSync(dir,{recursive:true});for(const f of fs.readdirSync(dir))if(!files[f])fs.rmSync(`${dir}/${f}`);
 for(const [name,data] of Object.entries(files))fs.writeFileSync(`${dir}/${name}`,text(data));
 console.log(pieces.map(p=>`${p.fixture.id.padEnd(20)} ${String(p.notes.length).padStart(4)} notes ${p.render.seconds} s`).join('\n'));
}
