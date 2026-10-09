import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTRACT,effectiveEvents} from '../web/contract/index.js';
import {HostCore} from '../web/host/host-core.js';
import {renderOffline} from '../web/host/offline.js';
import {hostAssets} from '../web/host/node-assets.js';
import {TestTone} from '../web/host/instruments/test-tone.js';
import {MASTER_LOOKAHEAD_SECONDS} from '../web/host/blocks.js';

const instruments={'test-tone':TestTone},assets=hostAssets();
const read=p=>JSON.parse(fs.readFileSync(p));
const ROOM={id:'room',type:'room',params:{level:.18,decay:.6,predelay:8,damping:8500,width:.8}};
const chain=[{id:'drive',type:'drive',params:{gain:8,mix:.4}},{id:'echo',type:'echo',params:{mix:.4,beats:.75,feedback:.5,pingPong:true}}];
const setup=(parts,{buses=[ROOM],master={volumeDb:-3}}={})=>({contract:CONTRACT,session:{buses,master},parts:parts??[
 {id:'a',instrument:{kind:'test-tone',design:'x'},chain,strip:{pan:-.3,sends:{room:.6}}},
 {id:'b',instrument:{kind:'test-tone',design:'x'},strip:{levelDb:-4,pan:.5,sends:{room:.2}}}]});
// Dense overlapping material with lowered techniques, so release dependencies and
// pitch curves cross every batch boundary.
function material(seed=1,count=60){
 let s=seed;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
 const notes=[];let at=.05;
 for(let i=0;i<count;i++){
  at+=.02+rnd()*.12;const t=rnd();
  notes.push({id:`n${i}`,part:rnd()<.5?'a':'b',at:Math.round(at*48000)/48000,duration:.03+rnd()*.4,velocity:.3+rnd()*.6,target:{pitch:40+Math.floor(rnd()*36)},
   ...(t<.15?{techniques:[{type:'bend',points:[{at:0,cents:0},{at:.4,cents:200}]}]}:t<.3?{techniques:[{type:'vibrato',depthCents:30,rateHz:6}]}:t<.4?{techniques:[{type:'mute',kind:'palm'}]}:{})});
 }
 return notes;
}
const same=(x,y,label)=>{
 assert.equal(x.frames,y.frames,label+' length');
 for(let c=0;c<2;c++){const a=x.audio[c],b=y.audio[c];for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))assert.fail(`${label}: channel ${c} frame ${i}: ${a[i]} vs ${b[i]}`);}
};
const render=(opts)=>renderOffline({setup:setup(),seconds:9,instruments,assets,...opts});

test('batching invariance: all at once, lookahead batches and late upserts render identically',()=>{
 const notes=material(),whole=render({notes});
 assert.ok(whole.audio[0].some(x=>Math.abs(x)>.01),'material is audible');
 for(const size of [.25,.5,1.3]){
  const batches=[];for(let t=0;t<9;t+=size){const through=t+size;batches.push({through,notes:notes.filter(n=>n.at>=t&&n.at<through)});}
  // Deliver each batch at the latest legal moment: every onset is exactly at or after the commit point.
  same(whole,render({batches}),`batches of ${size} s`);
 }
 // A future note first scheduled with other values and upserted before it is committed.
 const draft=structuredClone(notes);draft[30]={...draft[30],duration:.05,velocity:.1,target:{pitch:90}};
 const cut=notes[30].at-.2;
 same(whole,render({batches:[{through:cut,notes:draft.filter(n=>n.at<cut+.2)},{through:9,notes:[notes[30],...notes.filter(n=>n.at>=cut+.2)]}]}),'upsert');
});

test('batching invariance with cancel and reschedule (seek) equals the effective event log',()=>{
 const notes=material(7),batches=[{through:3,notes:notes.filter(n=>n.at<3.4)},{through:9,cancel:{from:3},notes:material(9).map(n=>({...n,id:'r'+n.id,at:n.at+3})).filter(n=>n.at<9)}];
 const {notes:all}=effectiveEvents({batches});
 same(render({notes:all}),render({batches}),'seek');
 assert.ok(all.some(n=>n.at<3&&n.at+n.duration>3),'a note sounding across the cancel point keeps playing');
});

test('the batching test is sensitive: rendering past the horizon changes the output',()=>{
 const notes=material(3),whole=render({notes}),host=new HostCore({rate:48000,block:128,instruments,assets});
 host.configure(setup());const L=new Float32Array(whole.frames),R=new Float32Array(whole.frames);
 for(let t=0;t<9;t+=.5){
  host.schedule({notes:notes.filter(n=>n.at>=t&&n.at<t+.5),through:t+.5});
  while(host.position<Math.min(whole.frames,Math.round((t+.5)*48000))){const at=host.position,n=Math.min(128,whole.frames-at),[l,r]=host.render(n);L.set(l.subarray(0,n),at);R.set(r.subarray(0,n),at);}
 }
 assert.ok(L.some((x,i)=>!Object.is(x,whole.audio[0][i])),'ignoring the horizon must be detectable');
});

test('block-size invariance: 16, 37 and 128-frame blocks render identically',()=>{
 const notes=material(5),a=render({notes,block:128});
 same(a,render({notes,block:16}),'16');same(a,render({notes,block:37}),'37');
});

const rms=(x,a,b)=>{let e=0;for(let i=a;i<b;i++)e+=x[i]*x[i];return Math.sqrt(e/(b-a));};
const tone=[{id:'x',part:'a',at:.1,duration:1,velocity:.8,target:{pitch:69}}];
const one=(part={},{buses=[],controls=[],seconds=1.5,notes=tone,master}={})=>renderOffline({setup:setup([{id:'a',instrument:{kind:'test-tone',design:'x'},...part}],{buses,master}),notes,controls,seconds,instruments,assets});

test('strip level, pan, send and mute behave as documented',()=>{
 const base=one(),half=one({strip:{levelDb:-6.0206}});
 assert.ok(Math.abs(rms(half.audio[0],24000,48000)/rms(base.audio[0],24000,48000)-.5)<1e-3,'level −6 dB halves amplitude');
 const left=one({strip:{pan:-1}});assert.ok(left.audio[1].every(x=>Math.abs(x)<1e-12)&&rms(left.audio[0],24000,48000)>.01,'hard left');
 same(base,one({strip:{pan:0}}),'pan 0 is transparent');
 const wet={id:'room',type:'room',params:{level:.8,decay:3,predelay:0}},sendless=one({strip:{sends:{room:0}}},{buses:[wet]}),sent=one({strip:{sends:{room:1}}},{buses:[wet]});
 assert.ok(rms(sendless.audio[0],60000,72000)<1e-6&&rms(sent.audio[0],60000,72000)>1e-3,'no reverb tail without a send');
 const off=one({strip:{sends:{room:1}}},{buses:[{...wet,state:'off'}]});assert.ok(rms(off.audio[0],60000,72000)<1e-6,'a bus that is off adds nothing');
 const muted=one({},{controls:[{id:'m1',part:'a',at:.5,type:'mute',value:true},{id:'m2',part:'a',at:.8,type:'mute',value:false}]});
 assert.ok(rms(muted.audio[0],Math.round((.506+MASTER_LOOKAHEAD_SECONDS)*48000),Math.round(.8*48000))<1e-12,'muted within 5 ms (after the master look-ahead)');
 assert.ok(rms(muted.audio[0],Math.round(.81*48000),Math.round(1*48000))>.01,'unmuted');
 assert.ok(rms(one({strip:{mute:true}}).audio[0],0,72000)<1e-12,'a muted strip is silent from the start');
});

test('solo: soloed parts play, the others are silent',()=>{
 const notes=[{id:'x',part:'a',at:.1,duration:1,velocity:.8,target:{pitch:69}},{id:'y',part:'b',at:.1,duration:1,velocity:.8,target:{pitch:57}}];
 const two=strips=>renderOffline({setup:setup([{id:'a',instrument:{kind:'test-tone',design:'x'},strip:strips[0]},{id:'b',instrument:{kind:'test-tone',design:'x'},strip:strips[1]}],{buses:[]}),notes,seconds:1.2,instruments,assets});
 const onlyB=renderOffline({setup:setup([{id:'b',instrument:{kind:'test-tone',design:'x'}}],{buses:[]}),notes:[notes[1]],seconds:1.2,instruments,assets});
 const solo=two([{},{solo:true}]);
 for(let i=0;i<solo.frames;i++)assert.ok(Math.abs(solo.audio[0][i]-onlyB.audio[0][i])<1e-9,`frame ${i}: only the soloed part sounds`);
});

test('master: volume, and a limiter that never lets a sample past the ceiling',()=>{
 const loud=Array.from({length:12},(_,i)=>({id:`l${i}`,part:'a',at:.1+i*.01,duration:1,velocity:1,target:{pitch:45+i*3}}));
 const r=one({strip:{levelDb:12}},{notes:loud,master:{volumeDb:12,ceilingDb:-1}}),ceiling=10**(-1/20);
 let peak=0;for(const c of r.audio)for(const x of c)peak=Math.max(peak,Math.abs(x));
 assert.ok(peak<=ceiling*(1+1e-6),`peak ${peak} ≤ ceiling ${ceiling}`);assert.ok(peak>ceiling*.95,'and it gets there');assert.ok(r.limited>0,'limiting is reported');
 const quiet=one({},{master:{volumeDb:-12}}),normal=one({},{master:{volumeDb:0}});
 assert.ok(Math.abs(rms(quiet.audio[0],24000,48000)/rms(normal.audio[0],24000,48000)-10**(-12/20))<1e-3,'volume −12 dB');
});

test('diagnostics: invalid, late, unknown and unsupported material is reported, never thrown',()=>{
 const host=new HostCore({rate:48000,block:128,instruments,assets}),seen=[];host.on('diagnostic',d=>seen.push(d));
 const config=host.configure(setup([{id:'a',instrument:{kind:'test-tone',design:'x'}},{id:'z',instrument:{kind:'theremin',design:'x'}}]));
 assert.deepEqual(config.map(d=>d.code),['unsupported-kind']);
 const codes=r=>r.map(d=>d.code);
 assert.deepEqual(codes(host.schedule({notes:[{id:'bad',part:'a',at:0,duration:0,velocity:1,target:{pitch:60}},{id:'nopart',part:'q',at:0,duration:1,velocity:1,target:{pitch:60}},
  {id:'ok',part:'a',at:1,duration:.5,velocity:.5,target:{pitch:60},techniques:[{type:'whammy'}]},{id:'silent',part:'z',at:1,duration:1,velocity:1,target:{pitch:60}}],
  controls:[{id:'c1',part:'a',at:1,type:'sustainPedal',value:1},{id:'c2',part:'a',at:1,type:'breath',value:1},{id:'c3',part:'q',at:1,type:'mute',value:true}]})),
  ['invalid-note','invalid-note','unknown-technique','dropped','unknown-control','invalid-control']);
 for(let i=0;i<375;i++)host.render(128);// one second
 assert.deepEqual(codes(host.schedule({notes:[{id:'late',part:'a',at:1.01,duration:.5,velocity:.5,target:{pitch:60}},{id:'ok',part:'a',at:1.5,duration:.5,velocity:.5,target:{pitch:61}}]})),['late-note','late-edit']);
 assert.equal(host.parts.get('a').notes.get('ok').note.target.pitch,60,'committed note kept');
 assert.deepEqual(codes(host.schedule({notes:[{id:'future',part:'a',at:1.2,duration:.5,velocity:.5,target:{pitch:60}}]})),[],'outside the horizon: no diagnostic');
 assert.equal(seen.length,1+6+2,'every diagnostic is also emitted');
 assert.doesNotThrow(()=>{for(let i=0;i<100;i++)host.render(128);});
});

test('sounding acknowledgements: each scheduled onset once, in order; cancelled notes never',()=>{
 const notes=material(17,40),r=render({notes:[...notes],batches:[{through:9,notes},{cancel:{ids:['n39']}}]});
 const expected=notes.filter(n=>n.id!=='n39'||n.at<9).map(n=>n.id);
 assert.deepEqual(r.sounding.map(s=>s.id).sort(),[...new Set(expected)].sort());
 assert.ok(r.sounding.every((s,i)=>i===0||r.sounding[i-1].at<=s.at));
});

test('cancel with silence cuts sounding notes at `from` without changing anything before it',()=>{
 // Dry parts and no room, so only the instrument's own sound is measured after the cut.
 const dry=setup([{id:'a',instrument:{kind:'test-tone',design:'x'}},{id:'b',instrument:{kind:'test-tone',design:'x'}}],{buses:[]});
 const notes=material(19,30),from=1.5,whole=render({setup:dry,notes:notes.filter(n=>n.at<from)}),host=new HostCore({rate:48000,block:128,instruments,assets});
 host.configure(dry);host.schedule({notes});const L=new Float32Array(whole.frames);
 while(host.position<whole.frames){const at=host.position;if(at===Math.round(from*48000)-2400)host.cancel({from,silence:true});
  const n=Math.min(128,whole.frames-at,at<Math.round(from*48000)-2400?Math.round(from*48000)-2400-at:128);L.set(host.render(n)[0].subarray(0,n),at);}
 const cut=Math.round(from*48000);
 for(let i=0;i<cut;i++)assert.ok(Object.is(L[i],whole.audio[0][i]),`frame ${i} before the cut is unchanged`);
 const sounding=notes.filter(n=>n.at<from&&n.at+n.duration>from+.06);assert.ok(sounding.length,'material has notes across the cut');
 const tail=(x,a,b)=>{let e=0;for(let i=a;i<b;i++)e+=x[i]*x[i];return Math.sqrt(e/(b-a));};
 assert.ok(tail(L,cut+Math.round(.06*48000),cut+Math.round(.3*48000))<tail(whole.audio[0],cut+Math.round(.06*48000),cut+Math.round(.3*48000))*.5,'cut notes stop sounding');
});

test('renderOffline labels every scheduled note with frames and technique handling',()=>{
 const notes=material(23,20),r=render({notes});
 assert.equal(r.labels.length,notes.length);
 for(const l of r.labels){const n=notes.find(x=>x.id===l.id);assert.equal(l.onsetFrame,Math.round(n.at*48000));assert.equal(l.pitch,n.target.pitch);
  assert.deepEqual(l.techniques,(n.techniques??[]).map(t=>({type:t.type,native:false})));assert.ok(l.endFrame>l.onsetFrame);}
});

// A part whose id first appears after the host has rendered (a fixture or session
// switch while audio runs) starts its instrument clock at that host frame: its
// instrument output equals the same part rendered from frame 0, sample for sample.
test('parts created mid-session play at their scheduled frames, exactly as from frame 0',async()=>{
 const {INSTRUMENTS}=await import('../web/host/instruments/index.js');
 const fixture=name=>read(`web/contract/fixtures/${name}.json`),lead=2,frames=Math.round(5*48000);
 const capture=(host,id)=>{const inst=host.parts.get(id).instrument,render=inst.render.bind(inst),out=[[],[]];
  inst.render=n=>{const y=render(n);for(let c=0;c<2;c++)out[c].push(Float32Array.from(y[c].subarray(0,n)));return y;};return out;};
 const flat=chunks=>{const x=new Float32Array(chunks.reduce((n,c)=>n+c.length,0));let k=0;for(const c of chunks){x.set(c,k);k+=c.length;}return x;};
 for(const name of ['ukulele-layout','keys-pedal','kit-chokes']){
  const f=fixture(name),id=f.setup.parts[0].id,{notes,controls}=effectiveEvents(f);
  const fresh=new HostCore({rate:48000,block:128,instruments:INSTRUMENTS,assets});fresh.configure(f.setup);fresh.schedule({notes,controls});
  const a=capture(fresh,id);while(fresh.position<frames)fresh.render(128);
  // Another session runs for `lead` seconds first; then the fixture's parts replace it.
  const late=new HostCore({rate:48000,block:128,instruments:INSTRUMENTS,assets}),other=read('web/data/pieces/guitar-fingerpick.json');
  late.configure(other.setup);late.schedule({notes:other.notes});while(late.position<lead*48000)late.render(128);
  late.configure(f.setup);late.schedule({notes:notes.map(n=>({...n,at:n.at+lead})),controls:controls.map(c=>({...c,at:c.at+lead}))});
  const b=capture(late,id),start=late.position;while(late.position<start+frames)late.render(128);
  for(let c=0;c<2;c++){const x=flat(a[c]),y=flat(b[c]);assert.equal(y.length,x.length,name);let peak=0;
   for(let i=0;i<x.length;i++){peak=Math.max(peak,Math.abs(x[i]));if(!Object.is(x[i],y[i]))assert.fail(`${name} channel ${c} frame ${i}: ${y[i]} vs ${x[i]}`);}
   assert.ok(peak>1e-3,`${name} sounds`);}
 }
});

// --- Chains (chain campaign C7–C10) ------------------------------------------------
const steady=[{id:'s',part:'a',at:.05,duration:3,velocity:.7,target:{pitch:57}}];
const chainRun=(blocks,opts={})=>one({chain:blocks},{notes:steady,seconds:3,...opts});
const maxStep=(x,a,b)=>{let m=0;for(let i=Math.max(1,a);i<b;i++)m=Math.max(m,Math.abs(x[i]-x[i-1]));return m;};

test('chains: any order and duplicates render deterministically; order matters',()=>{
 const drive={id:'d',type:'drive',params:{gain:24,mix:1}},echo={id:'e',type:'echo',params:{mix:.5,beats:.25,feedback:.4}};
 const a=chainRun([drive,echo]);same(a,chainRun([drive,echo]),'repeat render');
 const b=chainRun([echo,drive]);assert.ok(a.audio[0].some((x,i)=>Math.abs(x-b.audio[0][i])>1e-4),'drive→echo differs from echo→drive');
 const twice=chainRun([echo,{...echo,id:'e2'}]);assert.equal(twice.diagnostics.length,0);const single=chainRun([echo]);assert.ok(twice.audio[0].some((x,i)=>Math.abs(x-single.audio[0][i])>1e-4),'a duplicated echo is a second, independent block');
 const batches=[{through:.5,notes:steady},{through:1.5,notes:[]},{through:3,notes:[]}];same(chainRun([drive,echo]),renderOffline({setup:setup([{id:'a',instrument:{kind:'test-tone',design:'x'},chain:[drive,echo]}],{buses:[]}),batches,seconds:3,instruments,assets}),'batched');
});

test('block states: an Off block passes the dry signal, lets its tail ring and then is never computed',()=>{
 const host=new HostCore({rate:48000,block:128,instruments,assets});
 host.configure(setup([{id:'a',instrument:{kind:'test-tone',design:'x'},chain:[{id:'d',type:'drive',state:'off',params:{gain:24,mix:1}}]}],{buses:[]}));
 const node=host.parts.get('a').chain.nodes.get('d');let calls=0;const orig=node.node.render.bind(node.node);node.node.render=(x,n)=>{calls++;return orig(x,n);};
 host.schedule({notes:steady});for(let i=0;i<200;i++)host.render(128);
 assert.equal(calls,0,'an Off block that never sounded costs nothing');
 const dry=chainRun([]),byp=chainRun([{id:'d',type:'drive',state:'off',params:{gain:24,mix:1}}]),on=chainRun([{id:'d',type:'drive',params:{gain:24,mix:1}}]);
 for(let i=0;i<dry.frames;i++)assert.ok(Math.abs(dry.audio[0][i]-byp.audio[0][i])<1e-9,`frame ${i}: Off equals dry`);
 assert.ok(on.audio[0].some((x,i)=>Math.abs(x-dry.audio[0][i])>1e-3),'On changes the sound');
 const sleeper=new HostCore({rate:48000,block:128,instruments,assets});sleeper.configure(setup([{id:'a',instrument:{kind:'test-tone',design:'x'},chain:[{id:'e',type:'echo',params:{mix:.5,beats:.25,feedback:.4}}]}],{buses:[]}));sleeper.schedule({notes:[{id:'c',part:'a',at:.05,duration:.05,velocity:.9,target:{pitch:69}}]});
 for(let i=0;i<20;i++)sleeper.render(128);
 sleeper.configure(setup([{id:'a',instrument:{kind:'test-tone',design:'x'},chain:[{id:'e',type:'echo',state:'off',params:{mix:.5,beats:.25,feedback:.4}}]}],{buses:[]}));
 const tail=[];for(let i=0;i<40;i++)tail.push(...sleeper.render(128)[0]);assert.ok(tail.slice(4000).some(x=>Math.abs(x)>1e-4),'the echo repeats keep ringing after Off');
 for(let i=0;i<2000;i++)sleeper.render(128);assert.ok(sleeper.parts.get('a').chain.nodes.get('e').asleep,'once quiet, an Off block stops computing');
});

test('live structure edits (add, remove, reorder, state) are click-free',()=>{
 const host=new HostCore({rate:48000,block:128,instruments,assets}),base=[{id:'a',instrument:{kind:'test-tone',design:'x'}}];
 const drive={id:'d',type:'drive',params:{gain:18,mix:1}},trem={id:'t',type:'tremolo',params:{depth:.5,rate:4}},echo={id:'e',type:'echo',params:{mix:.4,beats:.25,feedback:.3}};
 host.configure(setup([{...base[0],chain:[drive]}],{buses:[]}));host.schedule({notes:steady});
 const L=[],edits=[[.6,[drive,trem]],[1,[trem,drive]],[1.4,[trem,drive,echo]],[1.8,[{...trem,state:'off'},drive,echo]],[2.2,[drive]],[2.6,[{...drive,state:'off'}]]];
 let k=0;while(host.position<3*48000){if(k<edits.length&&host.position>=edits[k][0]*48000){host.configure(setup([{...base[0],chain:edits[k][1]}],{buses:[]}));k++;}L.push(...host.render(128)[0]);}
 const x=Float32Array.from(L),steadyStep=maxStep(x,.3*48000,.55*48000);
 for(const [t] of edits){const at=Math.round(t*48000);assert.ok(maxStep(x,at-256,at+48000*.05)<steadyStep*3+1e-3,`edit at ${t}s: step ${maxStep(x,at-256,at+2400).toFixed(4)} vs steady ${steadyStep.toFixed(4)}`);}
});

test('unknown block types pass the signal through and bad parameters are clamped, both reported',()=>{
 const r=chainRun([{id:'q',type:'flanger'},{id:'d',type:'drive',params:{gain:99,colour:1}}]),codes=r.diagnostics.map(d=>d.code).sort();
 assert.deepEqual(codes,['invalid-block','invalid-block','unsupported-block']);
 same(r,chainRun([{id:'d',type:'drive',params:{gain:30}}]),'gain clamped to 30; the unknown block passes through');
});

test('stream tempo: the echo follows tempo controls from their exact frame, at any block size and in batches',()=>{
 const click=[{id:'c',part:'a',at:.05,duration:.02,velocity:.9,target:{pitch:69}}],echo=[{id:'e',type:'echo',params:{mix:1,beats:1,feedback:0,pingPong:false}}];
 const run=(controls,opts={})=>renderOffline({setup:setup([{id:'a',instrument:{kind:'test-tone',design:'x'},chain:echo}],{buses:[]}),notes:click,controls,seconds:2,instruments,assets,...opts});
 // The repeat lands one beat after the click: 0.5 s at the 120 bpm default, 0.4 s at 150 bpm.
 const peakAt=r=>{let k=0,m=0;for(let i=Math.round(.2*48000);i<r.audio[0].length;i++)if(Math.abs(r.audio[0][i])>m){m=Math.abs(r.audio[0][i]);k=i;}return k/48000;};
 assert.ok(Math.abs(peakAt(run([]))-.55)<.03,'default 120 bpm');
 assert.ok(Math.abs(peakAt(run([{id:'t',at:0,type:'tempo',bpm:150}]))-.45)<.03,'150 bpm from the stream');
 const change=[{id:'t0',at:0,type:'tempo',bpm:150},{id:'t1',at:.3001,type:'tempo',bpm:60}],a=run(change);
 same(a,run(change,{block:37}),'37-frame blocks');same(a,run(change,{block:16}),'16-frame blocks');
 same(a,run([],{batches:[{through:.2,notes:click,controls:[change[0]]},{through:2,controls:[change[1]]}]}),'tempo delivered in batches');
 assert.equal(run([{id:'t',at:0,type:'tempo',bpm:150,part:'a'}]).diagnostics.filter(d=>d.code==='invalid-control').length,1,'tempo names no part');
});

test('chord gestures without native support: timed by pitch, invariant, mismatches and unknown types play as written',()=>{
 const m=(id,pitch,g={},extra={})=>({id,part:'a',at:.2,duration:.6,velocity:.7,target:{pitch},gesture:{id:'g',type:'roll',direction:'up',spreadSeconds:.06,...g},...extra});
 const notes=[m('n3',72),m('n1',60),m('n2',67),m('x',64,{direction:'down'}),{...m('u',76),gesture:{id:'h',type:'rasgueado'}}];
 const run=(opts={})=>renderOffline({setup:setup([{id:'a',instrument:{kind:'test-tone',design:'x'}}],{buses:[]}),notes,seconds:1.2,instruments,assets,...opts});
 const r=run(),at=Object.fromEntries(r.labels.map(l=>[l.id,l.onsetFrame/48000]));
 assert.deepEqual([at.n1,at.n2,at.n3].map(x=>+x.toFixed(4)),[.2,.23,.26]);assert.equal(at.x,.2,'a mismatched member plays as written');assert.equal(at.u,.2);
 const ends=Object.fromEntries(r.labels.map(l=>[l.id,l.endFrame]));assert.equal(ends.n1,ends.n3,'members end together');
 assert.deepEqual(r.diagnostics.map(d=>d.code).sort(),['gesture-mismatch','unknown-gesture']);
 same(r,run({block:37}),'37-frame blocks');
 assert.deepEqual(r.sounding.filter(s=>s.id.startsWith('n')).map(s=>s.id),['n1','n2','n3'],'acknowledged once each, at the played onset');
});

