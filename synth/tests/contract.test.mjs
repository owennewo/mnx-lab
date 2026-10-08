import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as contract from '../web/contract/index.js';
import {CONTRACT,KINDS,TECHNIQUES,CONTROLS,PRIMITIVES,PIECES,CHOKE_CUTS,CAPABILITIES,GENERIC_CAPABILITIES,DIAGNOSTICS,frameAt,pieceFromGm,
 ContractError,validateNote,validateControl,validateSetup,validateLayout,validateEventLog,lower,LOWERING,pitchCurve,techniqueCents,
 EXPECTATIONS,effectiveEvents,validateFixture,checkEvents,pitchOrder,gestureTimes,gestureGroups} from '../web/contract/index.js';
import {schemaErrors,defSchema} from './support/json-schema-lite.mjs';

const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const schema=read('web/contract/mnx-sound-2.schema.json');
const FIXTURES=fs.readdirSync(new URL('../web/contract/fixtures/',import.meta.url)).filter(f=>f.endsWith('.json')).sort();
const fixture=name=>read('web/contract/fixtures/'+name);
const deepFreeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(deepFreeze);}return x;};
const note=(extra={})=>({id:'n1',part:'p',at:1,duration:.5,velocity:.7,target:{pitch:60},...extra});
const setup=(parts=[{id:'p',instrument:{kind:'plucked',design:'rounded-steel'}}])=>({contract:CONTRACT,session:{},parts});
const rejects=(fn,id,pattern)=>assert.throws(fn,e=>e instanceof ContractError&&(id===undefined||e.id===id)&&(!pattern||pattern.test(e.message)));
const schemaOk=(name,value)=>schemaErrors(schema,value,defSchema(schema,name));

test('frame rule reproduces the pre-host planner rounding, including half-sample ties',()=>{
 // Six reference-performance edges at 44.1 kHz are exact ties that float seconds would round down.
 for(const f of [769200,829200,889200,949200,937200])assert.equal(frameAt(f/48000,44100),Math.round(f*44100/48000));
 for(const rate of [44100,48000,96000])for(let f=0;f<48000*30;f+=7)assert.equal(frameAt(f/48000,rate),Math.round(f*rate/48000));
 assert.equal(frameAt(0,48000),0);assert.throws(()=>frameAt(NaN,48000));assert.throws(()=>frameAt(1,0));
});

test('capabilities are coherent with the vocabulary',()=>{
 assert.deepEqual(Object.keys(CAPABILITIES),[...KINDS]);
 for(const caps of [...Object.values(CAPABILITIES),GENERIC_CAPABILITIES]){
  assert.equal(caps.contract,CONTRACT);assert.ok(Number.isInteger(caps.revision)&&caps.revision>=1);
  assert.ok(caps.techniques.every(t=>TECHNIQUES.includes(t)),caps.kind);assert.ok(caps.primitives.every(p=>PRIMITIVES.includes(p)),caps.kind);
  assert.ok(caps.controls.every(c=>CONTROLS.includes(c)),caps.kind);assert.ok(caps.horizonSeconds>=0);
 }
 assert.equal(CAPABILITIES.plucked.horizonSeconds,.1);assert.equal(CAPABILITIES.keys.basic,true);assert.equal(CAPABILITIES.kit.basic,true);
 assert.deepEqual(CAPABILITIES.kit.pieces,PIECES);assert.equal(CAPABILITIES.kit.targets,'piece');
 for(const [piece,cut] of Object.entries(CHOKE_CUTS))assert.ok(PIECES.includes(piece)&&cut.every(p=>PIECES.includes(p)));
});

test('GM drum numbers map onto the kit vocabulary',()=>{
 assert.deepEqual([36,38,37,42,44,46,49,51,50,47,43].map(pieceFromGm),['kick','snare','side-stick','hihat-closed','hihat-pedal','hihat-open','crash','ride','tom-high','tom-mid','tom-low']);
 assert.equal(pieceFromGm(39),null);assert.equal(pieceFromGm(81),null);
 const mapped=new Set([...Array(128).keys()].map(pieceFromGm).filter(Boolean));assert.deepEqual([...mapped].sort(),[...PIECES].sort());
});

test('valid notes, controls and setups pass; unknown fields are ignored and preserved',()=>{
 const n=deepFreeze(note({future:{x:1},techniques:[{type:'bend',points:[{at:0,cents:0},{at:.5,cents:100}],curve:'smooth'},{type:'flutter',rate:3}],
  fingering:{string:2,fret:1},nuance:{intonationCents:1,attackBendCents:2,excitation:{positionDelta:.01,hardnessDelta:0},breath:3}}));
 assert.equal(validateNote(n),n);
 assert.equal(validateNote(note({target:{piece:'cowbell'}})).target.piece,'cowbell');
 const c=deepFreeze({id:'c1',part:'p',at:0,type:'sustainPedal',value:.5,extra:true});assert.equal(validateControl(c),c);
 assert.ok(validateControl({id:'c2',part:'p',at:0,type:'breathController',value:'anything'}));
 const s=deepFreeze({...setup([{id:'p',instrument:{kind:'plucked',design:'soft-nylon',layout:{strings:[69,64,60,67].map(pitch=>({pitch})),capo:2}},send:.5,levelDb:-6,pan:.25,mute:false,seed:7,inserts:{},player:{}},
  {id:'q',instrument:{kind:'theremin',design:{any:'object'},layout:'ignored for non-plucked kinds'}}]),session:{tempo:{bpm:120},room:{enabled:true},master:{gainDb:-3},extra:1}});
 assert.equal(validateSetup(s),s);
});

test('invalid notes are rejected with an error naming the note',()=>{
 const bad={
  velocity:note({velocity:1.2}),duration:note({duration:0}),negativeAt:note({at:-1}),bothTargets:note({target:{pitch:60,piece:'kick'}}),noTarget:note({target:{}}),
  pitch:note({target:{pitch:130}}),piece:note({target:{piece:''}}),string:note({fingering:{string:0}}),fret:note({fingering:{string:1,fret:-1}}),
  techniques:note({techniques:{type:'bend'}}),noType:note({techniques:[{points:[]}]}),bendEmpty:note({techniques:[{type:'bend',points:[]}]}),
  bendOrder:note({techniques:[{type:'bend',points:[{at:.5,cents:0},{at:.2,cents:100}]}]}),bendRange:note({techniques:[{type:'bend',points:[{at:1.5,cents:0}]}]}),
  twoBends:note({techniques:[{type:'bend',points:[{at:0,cents:0}]},{type:'bend',points:[{at:0,cents:50}]}]}),
  vibrato:note({techniques:[{type:'vibrato',depthCents:20}]}),vibratoRate:note({techniques:[{type:'vibrato',depthCents:20,rateHz:0}]}),
  slide:note({techniques:[{type:'slide',direction:'up'}]}),slideSpan:note({techniques:[{type:'slide',direction:'in',span:0}]}),
  legatoVia:note({techniques:[{type:'legato',from:'n0',via:'tap'}]}),legatoSelf:note({techniques:[{type:'legato',from:'n1',via:'hammer'}]}),
  legatoGlide:note({techniques:[{type:'legato',from:'n0',via:'hammer',glide:.2}]}),
  mute:note({techniques:[{type:'mute',kind:'soft'}]}),deadAmount:note({techniques:[{type:'mute',kind:'dead',amount:.5}]}),
  harmonic:note({techniques:[{type:'harmonic',kind:'flageolet'}]}),nuance:note({nuance:{intonationCents:500}}),excitation:note({nuance:{excitation:{positionDelta:2}}}),
 };
 for(const [name,n] of Object.entries(bad))rejects(()=>validateNote(n),'n1',undefined,name);
 rejects(()=>validateNote(note({id:'has space'})),'has space');rejects(()=>validateNote(note({part:''})),'n1');rejects(()=>validateNote(null),undefined);
});

test('invalid controls, layouts, setups and event logs are rejected',()=>{
 rejects(()=>validateControl({id:'c',part:'p',at:0,type:'sustainPedal',value:2}),'c');
 rejects(()=>validateControl({id:'c',part:'p',at:0,type:'mute',value:1}),'c');
 rejects(()=>validateControl({id:'c',part:'p',at:-1,type:'mute',value:true}),'c');
 rejects(()=>validateControl({id:'c',at:0,type:'tempo',bpm:500}),'c');rejects(()=>validateControl({id:'c',part:'p',at:0,type:'tempo',bpm:90}),'c');rejects(()=>validateControl({id:'c',at:0,type:'mute',value:true}),'c');
 assert.doesNotThrow(()=>validateControl({id:'c',at:0,type:'tempo',bpm:90}),'tempo is session-wide');
 rejects(()=>validateLayout({strings:Array(7).fill({pitch:60})},'p'),'p');
 rejects(()=>validateLayout({strings:[{pitch:30}]},'p'),'p');rejects(()=>validateLayout({strings:[{pitch:60}],capo:13},'p'),'p');rejects(()=>validateLayout({strings:[]},'p'),'p');
 rejects(()=>validateSetup({...setup(),contract:'mnx-sound/1'}));rejects(()=>validateSetup({...setup(),parts:[]}));
 rejects(()=>validateSetup(setup([{id:'p',instrument:{kind:'keys',design:'x'}},{id:'p',instrument:{kind:'kit',design:'y'}}])),'p',/duplicate/);
 rejects(()=>validateSetup(setup([{id:'p',instrument:{kind:'plucked',design:7}}])),'p');
 rejects(()=>validateSetup(setup([{id:'p',instrument:{kind:'plucked',design:'x',layout:{strings:[{pitch:90}]}}}])),'p');
 for(const [k,v] of [['strip',{levelDb:20}],['strip',{pan:-2}],['strip',{mute:'no'}],['strip',{solo:1}],['strip',{sends:{room:.5}}],['seed',0],['chain',{}],['chain',[{id:'a',type:'drive'},{id:'a',type:'echo'}]],
  ['chain',[{id:'a',type:'drive',state:'loud'}]],['chain',[{id:'a',type:'drive',params:{gain:'12'}}]],['chain',[{id:'bad id',type:'drive'}]],['chain',[{id:'a',type:''}]]])
  rejects(()=>validateSetup(setup([{id:'p',instrument:{kind:'keys',design:'x'},[k]:v}])),'p');
 const withBus=(bus,parts)=>({contract:CONTRACT,session:{buses:[bus]},parts:parts??[{id:'p',instrument:{kind:'keys',design:'x'},strip:{sends:{room:.4}}}]});
 assert.ok(validateSetup(withBus({id:'room',type:'room',params:{level:.2}})));
 rejects(()=>validateSetup(withBus({id:'room',type:'room',state:'bypass'})),'session');
 rejects(()=>validateSetup(setup([{id:'p',instrument:{kind:'keys',design:'x'},chain:[{id:'e1',type:'echo',state:'bypass'}]}])),'p');
 rejects(()=>validateSetup({contract:CONTRACT,session:{buses:[{id:'r',type:'room'},{id:'r',type:'room'}]},parts:[{id:'p',instrument:{kind:'keys',design:'x'}}]}),'session',/duplicate/);
 rejects(()=>validateSetup({contract:CONTRACT,session:{master:{ceilingDb:3}},parts:[{id:'p',instrument:{kind:'keys',design:'x'}}]}),'session');
 assert.ok(validateSetup(setup([{id:'p',instrument:{kind:'keys',design:'x'},chain:[{id:'e1',type:'echo'},{id:'e2',type:'echo',state:'off',params:{pingPong:false,mix:.2}},{id:'z',type:'not-yet-known'}]}])),'duplicates and unknown types are structurally valid');
 const log=(notes,controls=[])=>({contract:CONTRACT,setup:setup(),notes,controls});
 assert.ok(validateEventLog(log([note({id:'a'}),note({id:'b',at:2,techniques:[{type:'legato',from:'a',via:'pull'}]})])));
 rejects(()=>validateEventLog(log([note({part:'other'})])),'n1',/unknown part/);
 rejects(()=>validateEventLog(log([note(),note()])),'n1',/duplicate/);
 rejects(()=>validateEventLog(log([note({id:'a',at:3}),note({id:'b',at:2,techniques:[{type:'legato',from:'a',via:'pull'}]})])),'b',/earlier/);
 rejects(()=>validateEventLog(log([note({id:'b',at:2,techniques:[{type:'legato',from:'missing',via:'pull'}]})])),'b');
 rejects(()=>validateEventLog(log([],[{id:'c',part:'p',at:0,type:'mute',value:true},{id:'c',part:'p',at:1,type:'mute',value:false}])),'c',/duplicate/);
});

// --- lower() --------------------------------------------------------------------------------
const TECH={
 bend:{type:'bend',points:[{at:0,cents:0},{at:.5,cents:200},{at:1,cents:200}]},
 vibrato:{type:'vibrato',depthCents:20,rateHz:5,delaySeconds:.1},
 slide:{type:'slide',direction:'in'},
 legato:{type:'legato',from:'prev',via:'hammer'},
 mute:{type:'mute',kind:'palm',amount:.6},
 harmonic:{type:'harmonic',kind:'natural'},
 letRing:{type:'letRing'},
};
const prev=note({id:'prev',at:.5,target:{pitch:58}});
const resolve=id=>id==='prev'?prev:undefined;
const kinds={...CAPABILITIES,generic:GENERIC_CAPABILITIES};
const codes=r=>r.diagnostics.map(d=>d.code).sort();

test('lower() covers every technique for every kind and never throws',()=>{
 assert.deepEqual(Object.keys(TECH),[...TECHNIQUES]);
 for(const [kind,caps] of Object.entries(kinds))for(const [type,t] of Object.entries(TECH)){
  const n=deepFreeze(note({techniques:[t]})),r=lower(n,caps,{resolve});
  if(caps.techniques.includes(type)){assert.deepEqual(r.note.techniques,[t],`${kind}/${type}`);assert.deepEqual(r.diagnostics,[],`${kind}/${type}`);continue;}
  assert.deepEqual(r.note.techniques,[],`${kind}/${type} must not pass through`);
  assert.ok(r.diagnostics.length,`${kind}/${type} must explain itself`);
  assert.ok(r.diagnostics.every(d=>d.noteId==='n1'&&d.part==='p'&&DIAGNOSTICS[d.code]),`${kind}/${type}`);
  assert.deepEqual(lower(n,caps,{resolve}),r,'deterministic');
 }
});

test('lowering amounts reproduce the mnx expression flattening',()=>{
 const keys=CAPABILITIES.keys,V=1/127;
 let r=lower(note({techniques:[TECH.mute]}),keys);
 assert.equal(r.note.duration,.5*3/5);assert.equal(r.note.velocity,.7-15*V);assert.deepEqual(r.primitives.damping,{at:0,amount:.6});assert.deepEqual(codes(r),['approximated']);
 r=lower(note({techniques:[{type:'mute',kind:'dead'}]}),keys);
 assert.equal(r.note.duration,.5/8);assert.equal(r.note.velocity,.7-20*V);assert.deepEqual(r.primitives.damping,{at:0,amount:1});
 r=lower(note({techniques:[{type:'mute',kind:'palm'}]}),keys);assert.equal(r.primitives.damping.amount,.5);
 r=lower(note({techniques:[TECH.harmonic]}),CAPABILITIES.plucked);
 assert.equal(r.note.velocity,.7-10*V);assert.deepEqual(r.primitives.timbre,['harmonic']);assert.deepEqual(codes(r),['approximated']);
 r=lower(note({techniques:[TECH.letRing]}),GENERIC_CAPABILITIES);assert.equal(r.note.duration,LOWERING.letRingSeconds);assert.equal(r.primitives.release,'ring');
 r=lower(note({duration:5,techniques:[TECH.letRing]}),GENERIC_CAPABILITIES);assert.equal(r.note.duration,5,'let ring never shortens');
 r=lower(note({techniques:[TECH.letRing,TECH.mute]}),CAPABILITIES.kit);assert.deepEqual(codes(r),['approximated','dropped','dropped','dropped','dropped'],'one-shot kit pieces have no gate or damping');
 r=lower(note({techniques:[TECH.mute,TECH.letRing]}),GENERIC_CAPABILITIES);assert.equal(r.note.duration,2,'mute shortens first, let ring then extends');
 r=lower(note({techniques:[TECH.mute,TECH.letRing]}),keys);assert.equal(r.note.duration,.3);assert.deepEqual(r.note.techniques,[TECH.letRing],'keys rings natively');
 r=lower(note({velocity:.05,techniques:[{type:'mute',kind:'dead'}]}),keys);assert.equal(r.note.velocity,0,'velocity clamps at zero');
 r=lower(note({techniques:[TECH.legato]}),keys,{resolve});
 assert.deepEqual(r.primitives.extendPrevious,{id:'prev',until:1});assert.equal(r.note.velocity,.7-25*V);
});

test('pitch techniques lower to exact curves, or are dropped where pitch cannot move',()=>{
 const g=GENERIC_CAPABILITIES;
 let r=lower(note({techniques:[TECH.bend]}),g);assert.deepEqual(r.primitives.pitchCurve,[{at:0,cents:0},{at:.5,cents:200},{at:1,cents:200}]);
 r=lower(note({techniques:[{type:'bend',points:[{at:.2,cents:100},{at:.6,cents:0}]}]}),g);
 assert.deepEqual(r.primitives.pitchCurve,[{at:0,cents:100},{at:.2,cents:100},{at:.6,cents:0},{at:1,cents:0}],'pre-bend holds, release holds');
 r=lower(note({techniques:[TECH.slide]}),g);assert.deepEqual(r.primitives.pitchCurve,[{at:0,cents:-200},{at:.25,cents:0},{at:1,cents:0}]);
 r=lower(note({techniques:[{type:'slide',direction:'out',cents:-500,span:.3,fretted:true}]}),g);
 assert.ok(r.primitives.pitchCurve.every(p=>p.cents%100===0));assert.equal(r.primitives.pitchCurve.at(-1).cents,-500);assert.equal(r.primitives.pitchCurve[0].cents,0);
 r=lower(note({techniques:[TECH.vibrato]}),g);
 assert.equal(r.primitives.pitchCurve.length,Math.ceil(.5*5*LOWERING.vibratoPointsPerCycle)+1);
 assert.ok(r.primitives.pitchCurve.every(p=>p.cents===techniqueCents(TECH.vibrato,note(),p.at)));
 r=lower(note({techniques:[{type:'legato',from:'prev',via:'slide'}]}),g,{resolve});
 assert.equal(r.primitives.pitchCurve[0].cents,-200);assert.equal(r.primitives.pitchCurve.find(p=>p.at===LOWERING.glide).cents,0);
 assert.equal(r.note.velocity,.7,'slides do not re-attack softer');
 for(const caps of [CAPABILITIES.keys,CAPABILITIES.kit])for(const t of [TECH.bend,TECH.vibrato,TECH.slide]){
  r=lower(note({techniques:[t]}),caps);assert.deepEqual(codes(r),['dropped']);assert.equal(r.primitives.pitchCurve,undefined);
 }
 // Several pitch techniques sum on one curve.
 r=lower(note({techniques:[TECH.bend,TECH.slide]}),g);assert.equal(r.primitives.pitchCurve.find(p=>p.at===.25).cents,100);
});

test('vibrato curve matches the pre-host player law exactly (golden equivalence depends on it)',()=>{
 // performance.js: vibrato_cents*clamp((age-delay)/.2,0,1)*sin(2π·hz·age+phase)
 const n=note({duration:2}),t={type:'vibrato',depthCents:3,rateHz:5,delaySeconds:.18,phase:2.1};
 for(let i=0;i<=400;i++){const age=i/200,x=age/2,expected=3*Math.max(0,Math.min(1,(age-.18)/.2))*Math.sin(2*Math.PI*5*age+2.1);
  assert.equal(techniqueCents(t,n,x),expected,`age ${age}`);}
});

test('unknown techniques and unresolved references are diagnosed, never thrown',()=>{
 const odd=deepFreeze(note({techniques:[{type:'flutter',depth:9},{type:'legato',from:'missing',via:'pull'},{type:'whammy'}]}));
 for(const caps of Object.values(kinds)){
  const r=lower(odd,caps,{resolve});
  assert.equal(r.diagnostics.filter(d=>d.code==='unknown-technique').length,2);
  if(!caps.techniques.includes('legato'))assert.ok(r.diagnostics.some(d=>d.code==='unresolved-reference'&&d.reference==='missing'));
  assert.ok(!r.note.techniques.some(t=>t.type==='flutter'||t.type==='whammy'));
 }
 const later=note({id:'later',at:9}),r=lower(note({techniques:[{type:'legato',from:'later',via:'hammer'}]}),CAPABILITIES.keys,{resolve:()=>later});
 assert.ok(r.diagnostics.some(d=>d.code==='unresolved-reference'),'forward references are not followed');assert.equal(r.primitives.extendPrevious,undefined);
 assert.deepEqual(lower(note(),CAPABILITIES.plucked),{note:note(),primitives:{},diagnostics:[]});
});

// --- fixtures and schema ----------------------------------------------------------------------
test('every fixture validates, round-trips and matches the JSON schema',()=>{
 assert.deepEqual(FIXTURES,['chord-gestures.json','keys-pedal.json','kit-chokes.json','multi-part-mix.json','plucked-techniques.json','ukulele-layout.json']);
 for(const name of FIXTURES){
  const f=deepFreeze(fixture(name));
  assert.equal(validateFixture(f),f,name);assert.deepEqual(schemaOk('fixture',f),[],name);
  const copy=JSON.parse(JSON.stringify(f));assert.deepEqual(copy,f);assert.ok(validateFixture(copy));
  const {notes,controls}=effectiveEvents(f);
  assert.ok(validateEventLog({contract:CONTRACT,setup:f.setup,notes,controls}),name);
  assert.deepEqual(schemaOk('eventLog',{contract:CONTRACT,setup:f.setup,notes,controls}),[],name);
 }
});

test('fixtures cover every technique, kind, control, choke and batching operation',()=>{
 const all=FIXTURES.map(fixture),notes=all.flatMap(f=>effectiveEvents(f).notes),controls=all.flatMap(f=>effectiveEvents(f).controls);
 assert.deepEqual([...new Set(notes.flatMap(n=>n.techniques??[]).map(t=>t.type))].sort(),[...TECHNIQUES].sort());
 assert.deepEqual([...new Set(all.flatMap(f=>f.setup.parts.map(p=>p.instrument.kind)))].sort(),[...KINDS].sort());
 assert.ok(controls.some(c=>c.type==='sustainPedal'&&c.value===1)&&controls.some(c=>c.type==='sustainPedal'&&c.value===0));
 assert.deepEqual([...new Set(notes.filter(n=>n.target.piece).map(n=>n.target.piece).filter(p=>PIECES.includes(p)))].sort(),[...PIECES].sort());
 assert.ok(notes.some(n=>n.target.piece&&!PIECES.includes(n.target.piece)),'an unknown piece is exercised');
 const kit=fixture('kit-chokes.json');for(const e of kit.expect.filter(e=>e.kind==='choked')){
  const [open,by]=[e.note,e.by].map(id=>kit.notes.find(n=>n.id===id));assert.ok(CHOKE_CUTS[by.target.piece].includes(open.target.piece));}
 const uke=fixture('ukulele-layout.json').setup.parts[0].instrument.layout.strings.map(s=>s.pitch);
 assert.deepEqual(uke,[69,64,60,67],'reentrant: string 4 is not the lowest');
 assert.ok(FIXTURES.map(fixture).flatMap(f=>f.expect).every(e=>EXPECTATIONS[e.kind]));
 const gestures=notes.filter(n=>n.gesture).map(n=>`${n.gesture.type}:${n.gesture.direction}`);
 for(const g of ['strum:down','strum:up','roll:up'])assert.ok(gestures.includes(g),`a ${g} gesture is exercised`);
});

test('chord gestures: validated, consistent members, ordered by stroke or pitch, written ends kept',()=>{
 const m=(id,pitch,g={},extra={})=>({id,part:'p',at:1,duration:.5,velocity:.7,target:{pitch},gesture:{id:'g',type:'strum',direction:'down',spreadSeconds:.06,...g},...extra});
 rejects(()=>validateNote(m('a',60,{direction:'sideways'})),'a');rejects(()=>validateNote(m('a',60,{spreadSeconds:3})),'a');rejects(()=>validateNote({...m('a',60),gesture:{type:'strum'}}),'a');
 assert.doesNotThrow(()=>validateNote(m('a',60,{type:'rasgueado',direction:undefined,spreadSeconds:undefined})),'an unknown gesture type is not an error (D11)');
 const parts=new Set(['p','q']);
 assert.throws(()=>checkEvents([m('a',60),m('b',64,{},{at:1.1})],[],parts,new Map()),/differ/);
 assert.throws(()=>checkEvents([m('a',60),m('b',64,{},{part:'q'})],[],parts,new Map()),/spans parts/);
 const chord=[m('c',64),m('a',48),m('b',55),m('d',60)],g=chord[0].gesture;
 assert.deepEqual(pitchOrder(chord,g).map(n=>n.id),['a','b','d','c'],'a down strum rises in pitch without strings');
 assert.deepEqual(pitchOrder(chord,{...g,direction:'up'}).map(n=>n.id),['c','d','b','a']);
 assert.deepEqual(pitchOrder(chord,{...g,type:'roll',direction:'down'}).map(n=>n.id),['c','d','b','a'],'a roll names the pitch direction (MNX)');
 const t=gestureTimes(pitchOrder(chord,g),g);
 assert.deepEqual([...t.values()].map(x=>+x.at.toFixed(6)),[1,1.02,1.04,1.06]);assert.ok([...t.values()].every(x=>Math.abs(x.at+x.duration-1.5)<1e-9),'members end together');
 assert.equal(gestureTimes([m('a',60,{},{duration:.04}),m('b',64,{},{duration:.04})],{...g,spreadSeconds:.06}).get('b').duration,.02,'at least half the written length');
 const {groups,mismatched}=gestureGroups([m('a',60),m('b',64,{direction:'up'}),{...m('c',67),gesture:undefined}]);
 assert.deepEqual([...groups.get('g')].map(n=>n.id),['a']);assert.deepEqual(mismatched.map(n=>n.id),['b']);
});

test('batches apply upserts and cancels in order',()=>{
 const f=fixture('multi-part-mix.json'),{notes,controls}=effectiveEvents(f),byId=new Map(notes.map(n=>[n.id,n]));
 assert.equal(byId.get('g4').duration,.8,'second batch upserts g4');assert.equal(byId.get('g4').target.pitch,62);
 assert.equal(byId.has('dc1'),false,'cancel from 5 s removes the crash at 5.5 s');assert.ok(byId.has('dr1'));
 assert.ok(notes.every((n,i)=>i===0||notes[i-1].at<=n.at));assert.deepEqual(controls.map(c=>c.id),['tempo','kp1','kp2']);
 // Every edit lands after the previous batch's horizon, so it is never late (D15).
 const horizon=Math.max(...Object.values(CAPABILITIES).map(c=>c.horizonSeconds));
 for(let i=1;i<f.batches.length;i++){const delivered=f.batches[i-1].through-horizon,b=f.batches[i];
  assert.ok([...(b.notes??[]),...(b.controls??[])].every(e=>e.at>=delivered+horizon),`batch ${i}`);
  if(b.cancel?.from!==undefined)assert.ok(b.cancel.from>=delivered+horizon);}
 assert.deepEqual(effectiveEvents({notes:[note()],controls:[]}).notes,[note()]);
 assert.deepEqual(effectiveEvents({batches:[{notes:[note(),note({id:'n2'})]},{cancel:{ids:['n1']}}]}).notes.map(n=>n.id),['n2']);
 assert.deepEqual(effectiveEvents({batches:[{notes:[note()]},{cancel:{from:0},notes:[note({id:'n3',at:2})]}]}).notes.map(n=>n.id),['n3'],'cancel applies before the batch');
 assert.equal(effectiveEvents({batches:[{notes:[note({duration:2})]},{cancel:{from:2}}]}).notes[0].duration,2,'a note that already started keeps playing');
});

test('invalid fixtures are rejected',()=>{
 const base=()=>structuredClone(fixture('plucked-techniques.json'));
 const cases=[
  f=>{f.expect.push({kind:'loudness',note:'b1'});},f=>{f.expect.push({kind:'pitch',note:'nope',curve:'nominal',toleranceCents:5,maxCents:9});},
  f=>{f.expect.push({kind:'pitch',note:'b1',toleranceCents:5,maxCents:9});},f=>{f.expect.push({kind:'pitch',note:'b1',curve:'nominal',toleranceCents:5,maxCents:9,from:.8,to:.2});},
  f=>{f.expect.push({kind:'decayRatio',note:'pm1',reference:'ghost',max:.5});},f=>{f.expect=[];},f=>{f.render.rate=22050;},f=>{f.render.seconds=0;},
  f=>{f.batches=[{notes:f.notes}];},f=>{delete f.fixture.description;},f=>{f.notes[0].velocity=3;},f=>{f.notes.push(structuredClone(f.notes[0]));f.notes.at(-1).part='bass';},
  f=>{const n=f.notes.find(n=>n.id==='h2');n.at=12;},f=>{f.notes.push({...structuredClone(f.notes[0]),at:18});},
  f=>{f.batches=[{through:4,notes:f.notes},{through:2}];delete f.notes;},f=>{f.batches=[{notes:f.notes,cancel:{from:1,ids:[]}}];delete f.notes;},
 ];
 for(const [i,change] of cases.entries()){const f=base();change(f);assert.throws(()=>validateFixture(f),ContractError,`case ${i}`);}
});

test('the JSON schema agrees with the validators on structural rules',()=>{
 const shapes=[
  note({velocity:1.2}),note({duration:0}),note({target:{pitch:60,piece:'kick'}}),note({target:{}}),note({fingering:{string:0}}),note({id:'has space'}),
  note({techniques:[{type:'bend',points:[]}]}),note({techniques:[{type:'vibrato',depthCents:20}]}),note({techniques:[{type:'slide',direction:'up'}]}),
  note({techniques:[{type:'slide',direction:'in',span:0}]}),note({techniques:[{type:'legato',from:'n0',via:'tap'}]}),note({techniques:[{type:'mute',kind:'soft'}]}),
  note({techniques:[{type:'harmonic',kind:'flageolet'}]}),note({nuance:{intonationCents:500}}),
 ];
 for(const n of shapes){assert.throws(()=>validateNote(n),ContractError);assert.notDeepEqual(schemaOk('note',n),[],JSON.stringify(n));}
 for(const n of [note(),note({target:{piece:'kick'}}),note({techniques:[{type:'flutter'}],extra:1}),...Object.values(TECH).map(t=>note({techniques:[t]}))]){
  assert.ok(validateNote(n));assert.deepEqual(schemaOk('note',n),[],JSON.stringify(n));}
 // Validator-only rules: the schema accepts these, validate.js rejects them.
 for(const n of [note({techniques:[{type:'bend',points:[{at:.5,cents:0},{at:.2,cents:1}]}]}),note({techniques:[{type:'letRing'},{type:'letRing'}]}),
  note({techniques:[{type:'legato',from:'n1',via:'hammer'}]}),note({techniques:[{type:'mute',kind:'dead',amount:1}]})]){
  assert.deepEqual(schemaOk('note',n),[]);assert.throws(()=>validateNote(n),ContractError);}
 assert.notDeepEqual(schemaOk('control',{id:'c',part:'p',at:0,type:'mute',value:1}),[]);
 assert.notDeepEqual(schemaOk('setup',{...setup(),contract:'mnx-sound/1'}),[]);
 assert.notDeepEqual(schemaOk('setup',setup([{id:'p',instrument:{kind:'plucked',design:'x',layout:{strings:[{pitch:90}]}}}])),[]);
 for(const bad of [setup([{id:'p',instrument:{kind:'keys',design:'x'},chain:[{id:'a',type:'drive',state:'loud'}]}]),setup([{id:'p',instrument:{kind:'keys',design:'x'},strip:{pan:3}}]),
  {contract:CONTRACT,session:{buses:[{id:'r',type:'room',state:'bypass'}]},parts:[{id:'p',instrument:{kind:'keys',design:'x'}}]}])assert.notDeepEqual(schemaOk('setup',bad),[]);
 // Validator-only setup rules: duplicate block/bus ids, sends to unknown buses, param value types.
 for(const x of [setup([{id:'p',instrument:{kind:'keys',design:'x'},chain:[{id:'a',type:'drive'},{id:'a',type:'echo'}]}]),setup([{id:'p',instrument:{kind:'keys',design:'x'},strip:{sends:{hall:.5}}}]),
  setup([{id:'p',instrument:{kind:'keys',design:'x'},chain:[{id:'a',type:'drive',params:{gain:'x'}}]}])]){assert.deepEqual(schemaOk('setup',x),[]);assert.throws(()=>validateSetup(x),ContractError);}
});

test('the TypeScript declarations name exactly the runtime exports',()=>{
 const dts=fs.readFileSync(new URL('../web/contract/index.d.ts',import.meta.url),'utf8');
 const declared=[...dts.matchAll(/^export (?:const|function|class) (\w+)/gm)].map(m=>m[1]).sort();
 assert.deepEqual(declared,Object.keys(contract).sort());
});
