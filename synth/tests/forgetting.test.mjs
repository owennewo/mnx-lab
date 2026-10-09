// Forgetting (host-core.js forget, instruments/forget.js): a long piece delivered in live
// batches, with the host forgetting finished notes and each instrument folding them into
// its planning state, renders exactly as the same piece scheduled all at once — and the
// instruments end up remembering only the last few seconds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT,frameAt} from '../web/contract/index.js';
import {HostCore,FORGET_SECONDS} from '../web/host/host-core.js';
import {INSTRUMENTS} from '../web/host/instruments/index.js';
import {hostAssets} from '../web/host/node-assets.js';

const RATE=48000,BLOCK=128,SECONDS=40,assets=hostAssets();
const STANDARD=[64,59,55,50,45,40].map(pitch=>({pitch}));
const setup={contract:CONTRACT,session:{buses:[{id:'room',type:'room',state:'on',params:{}}],master:{volumeDb:0,ceilingDb:-1}},parts:[
 // Wide ringing: free-ringing strings, so finger muting carries from note to note.
 {id:'g',instrument:{kind:'plucked',design:'wide-ringing',layout:{strings:STANDARD}},chain:[],strip:{sends:{room:.3}}},
 {id:'k',instrument:{kind:'keys',design:{id:'basic-piano'}},chain:[],strip:{sends:{room:.2}}},
 {id:'d',instrument:{kind:'kit',design:{id:'basic-kit'}},chain:[],strip:{}}]};
function piece(seed=7){
 let s=seed;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;},q=t=>Math.round(t*RATE)/RATE;
 const notes=[],controls=[];let n=0;
 // Guitar: single notes with fingering, hammer-on/pull-off chains, palm mutes, let ring, strums.
 for(let at=.1;at<SECONDS-2;){
  const r=rnd(),id=()=>`g${n++}`;
  if(r<.15){
   const g={id:`strum${n}`,type:'strum',direction:rnd()<.5?'down':'up',spreadSeconds:.03};
   for(const [string,fret] of [[5,3],[4,2],[3,0],[2,1],[1,0]])notes.push({id:id(),part:'g',at:q(at),duration:.8,velocity:.6,target:{pitch:STANDARD[string-1].pitch+fret},fingering:{string,fret},gesture:g});
   at+=.9;
  }else if(r<.3){
   const string=1+Math.floor(rnd()*5),base=STANDARD[string-1].pitch+2;let prev;
   for(const step of [0,2,0]){const nid=id();notes.push({id:nid,part:'g',at:q(at),duration:.15,velocity:.7,target:{pitch:base+step},fingering:{string},
     ...(prev?{techniques:[{type:'legato',from:prev,via:step>0?'hammer':'pull'}]}:{})});prev=nid;at=q(at+.15);}
   at+=.1;
  }else{
   const string=1+Math.floor(rnd()*5),fret=Math.floor(rnd()*7),t=rnd();
   notes.push({id:id(),part:'g',at:q(at),duration:.1+rnd()*.5,velocity:.4+rnd()*.5,target:{pitch:STANDARD[string-1].pitch+fret},
    fingering:{string,fret},...(t<.3?{techniques:[{type:'mute',kind:'palm',amount:.6}]}:t<.4?{techniques:[{type:'letRing'}]}:{})});
   at+=.08+rnd()*.3;
  }
 }
 // The low E alone (the random notes and strums keep off it): palm-muted, then idle
 // longer than FORGET_SECONDS, then plucked open — the string's finger muting must carry
 // across the fold, or the open note rings damped.
 for(let at=3.05;at<SECONDS-6;at+=7){
  notes.push({id:`e${n++}`,part:'g',at:q(at),duration:.3,velocity:.7,target:{pitch:40},fingering:{string:6,fret:0},techniques:[{type:'mute',kind:'palm',amount:.6}]});
  notes.push({id:`e${n++}`,part:'g',at:q(at+3.5),duration:2,velocity:.7,target:{pitch:43},fingering:{string:6,fret:3}});
 }
 // Keys: dense enough to steal voices; the pedal goes down and up.
 for(let at=.2;at<SECONDS-2;at+=.25+rnd()*.3){
  const chord=rnd()<.3?6:1;for(let i=0;i<chord;i++)notes.push({id:`k${n++}`,part:'k',at:q(at),duration:.2+rnd()*1.2,velocity:.5,target:{pitch:48+Math.floor(rnd()*30)}});
 }
 for(let at=1,down=true;at<SECONDS-2;at+=1.5+rnd()*2,down=!down)controls.push({id:`p${n++}`,part:'k',at:q(at),type:'sustainPedal',value:down?1:0});
 // Kit: hi-hats that choke one another, crashes, kick and snare.
 const pieces=['kick','snare','hihat-closed','hihat-open','hihat-pedal','crash','ride','tom-low'];
 for(let at=.05;at<SECONDS-2;at+=.125+(rnd()<.2?.125:0))notes.push({id:`d${n++}`,part:'d',at:q(at),duration:.1,velocity:.6+rnd()*.3,target:{piece:pieces[Math.floor(rnd()*pieces.length)]}});
 return {notes,controls};
}
function render(host,batches){
 const total=frameAt(SECONDS,RATE),L=new Float32Array(total),R=new Float32Array(total);
 let k=0;
 while(host.position<total){
  while(k<batches.length&&frameAt(batches[k].deliver,RATE)<=host.position)host.schedule(batches[k++]);
  const at=host.position,n=Math.min(BLOCK,total-at),[l,r]=host.render(n);L.set(l.subarray(0,n),at);R.set(r.subarray(0,n),at);
 }
 return [L,R];
}
test('a long piece delivered live, forgetting as it goes, renders exactly as all at once', ()=>{
 const {notes,controls}=piece();
 const whole=new HostCore({rate:RATE,block:BLOCK,instruments:INSTRUMENTS,assets});whole.configure(setup);
 const a=render(whole,[{deliver:0,notes,controls,through:SECONDS}]);
 // Live: every half second, the next half second one second ahead (as HostBackend does).
 const live=new HostCore({rate:RATE,block:BLOCK,instruments:INSTRUMENTS,assets,history:false});live.configure(setup);
 const batches=[];
 for(let t=0;t<SECONDS;t+=.5){
  const from=t===0?-1:t+1,to=t+1.5,inWindow=x=>x.at>=from&&x.at<to;
  batches.push({deliver:t,notes:notes.filter(inWindow),controls:controls.filter(inWindow),through:to});
 }
 assert.equal(batches.reduce((n,b)=>n+b.notes.length,0),notes.length);
 const b=render(live,batches);
 for(let c=0;c<2;c++){
  let diff=-1;for(let i=0;i<a[c].length;i++)if(a[c][i]!==b[c][i]){diff=i;break;}
  assert.equal(diff,-1,`channel ${c} differs from frame ${diff} (${(diff/RATE).toFixed(3)} s)`);
 }
 let peak=0;for(const x of a[0])peak=Math.max(peak,Math.abs(x));assert.ok(peak>1e-3,'the piece is silent');
 // What is remembered is the last few seconds, not the piece.
 for(const id of ['g','k','d']){
  const part=live.parts.get(id),total=notes.filter(x=>x.part===id).length;
  assert.ok(part.notes.size<total/4,`host remembers ${part.notes.size} of ${total} ${id} notes`);
  assert.ok(part.instrument.entries.size<total/4,`instrument ${id} remembers ${part.instrument.entries.size} of ${total}`);
 }
 assert.equal(whole.parts.get('g').notes.size,notes.filter(x=>x.part==='g').length,'all at once forgets nothing');
});
test('forgetting keeps what a remembered note leads from, and offline keeps every note for labels', ()=>{
 const host=new HostCore({rate:RATE,block:BLOCK,instruments:INSTRUMENTS,assets});host.configure(setup);
 const notes=[{id:'a',part:'g',at:.1,duration:.2,velocity:.6,target:{pitch:64},fingering:{string:1}},
  {id:'b',part:'g',at:.3,duration:6,velocity:.6,target:{pitch:66},fingering:{string:1},techniques:[{type:'legato',from:'a',via:'hammer'}]},
  {id:'c',part:'g',at:.5,duration:.2,velocity:.6,target:{pitch:50},fingering:{string:4}}];
 host.schedule({notes,through:7});
 while(host.position<frameAt(FORGET_SECONDS+1,RATE))host.render(BLOCK);
 host.schedule({notes:[],through:8});
 const g=host.parts.get('g');
 assert.deepEqual([...g.forgotten].sort(),['c'],'a stays: b, still sounding, leads from it');
 assert.equal(g.notes.size,3,'offline keeps every note');
 // Folding goes in onset order: c waits behind a, which is still needed.
 assert.deepEqual([...g.instrument.pending],['c']);
 assert.equal(g.instrument.entries.size,3);
});
