import test from 'node:test';
import assert from 'node:assert/strict';
import {Player} from '../web/app/player.js';

function fakePlayer(){
 const p=new Player(),calls=[];
 p.context={currentTime:0,resume:async()=>{calls.push(['resume']);}};
 p.host={configure:async setup=>calls.push(['configure',setup]),schedule:async batch=>calls.push(['schedule',batch]),cancel:async arg=>calls.push(['cancel',arg])};
 p.ensure=async()=>{};
 return {p,calls};
}
const material={length:2,notes:[{id:'note',part:'guitar',at:0,duration:1,velocity:.7,target:{pitch:64}}],controls:[]};
test('Stop silences a preview even when the passage transport is not playing',async()=>{
 const {p,calls}=fakePlayer();await p.configure({parts:[{id:'guitar'}]});await p.preview(material.notes[0]);
 assert.equal(p.playing,false);await p.stop();assert.deepEqual(calls.at(-1),['cancel',{from:0,silence:true}]);
});
test('play, loop, stop and restart retain unique note ids and stop all audio',async()=>{
 const {p,calls}=fakePlayer(),states=[];p.addEventListener('state',e=>states.push(e.detail.playing));
 try{
  await p.play({parts:[{id:'guitar'}]},material,{loop:true});
  const first=calls.find(c=>c[0]==='schedule')[1];p.context.currentTime=1.4;p.tick();
  const second=calls.filter(c=>c[0]==='schedule').at(-1)[1];assert.notEqual(first.notes[0].id,second.notes[0].id);assert.equal(second.notes[0].at,2.25);
  await p.stop();assert.equal(p.playing,false);assert.equal(calls.at(-1)[0],'cancel');
  await p.play({parts:[{id:'guitar'}]},material,{loop:false});const restart=calls.filter(c=>c[0]==='schedule').at(-1)[1];assert.notEqual(restart.notes[0].id,first.notes[0].id);
  await p.stop();assert.deepEqual(states,[true,false,true,false]);
 }finally{clearInterval(p.timer);}
});
test('Stop during audio initialization prevents a delayed preview or passage starting afterwards',async()=>{
 for(const type of ['preview','play']){
  const {p,calls}=fakePlayer();let ready;p.ensure=()=>new Promise(resolve=>{ready=resolve;});
  const pending=type==='preview'?p.preview(material.notes[0]):p.play({parts:[]},material);
  await p.stop();ready();await pending;assert.ok(!calls.some(c=>c[0]==='schedule'));assert.equal(p.playing,false);
 }
});
test('starting a passage clears any prior preview notes',async()=>{
 const {p,calls}=fakePlayer();try{await p.configure({parts:[]});await p.preview(material.notes[0]);await p.play({parts:[]},material);
  assert.equal(calls.filter(c=>c[0]==='cancel').length,1);
 }finally{await p.stop();}
});
test('session previews explicitly restore their setup after playing a different fixture',async()=>{
 const {p,calls}=fakePlayer(),fixture={parts:[{id:'uke'}]},session={parts:[{id:'guitar'}]};
 await p.play(fixture,{...material,notes:material.notes.map(n=>({...n,part:'uke'}))},{loop:false});await p.stop();
 await p.preview(material.notes[0],session);
 assert.deepEqual(calls.filter(c=>c[0]==='configure').at(-1),['configure',session]);assert.deepEqual(p.setup,session);
 assert.equal(calls.filter(c=>c[0]==='schedule').at(-1)[1].notes[0].part,'guitar');
});
test('repeats keep chord gestures and legato chains within their own iteration',async()=>{
 const {p,calls}=fakePlayer(),g={id:'c1',type:'strum',direction:'down',spreadSeconds:.02};
 const m={length:2,controls:[],notes:[{id:'a',part:'guitar',at:0,duration:1,velocity:.7,target:{pitch:52},gesture:g},{id:'b',part:'guitar',at:0,duration:1,velocity:.7,target:{pitch:56},gesture:g},
  {id:'c',part:'guitar',at:.5,duration:.4,velocity:.7,target:{pitch:58},techniques:[{type:'legato',from:'b',via:'hammer'}]}]};
 try{
  await p.play({parts:[{id:'guitar'}]},m,{loop:true});p.context.currentTime=1.4;p.tick();
  const [first,second]=calls.filter(c=>c[0]==='schedule').map(c=>c[1].notes);
  for(const notes of [first,second]){const ids=new Set(notes.map(n=>n.id));assert.equal(new Set(notes.filter(n=>n.gesture).map(n=>n.gesture.id)).size,1);assert.ok(ids.has(notes[2].techniques[0].from));}
  assert.notEqual(first[0].gesture.id,second[0].gesture.id);
 }finally{await p.stop();}
});

