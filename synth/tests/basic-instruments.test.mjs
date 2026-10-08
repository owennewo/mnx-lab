import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CONTRACT,CAPABILITIES,PIECES,pieceFromGm} from '../web/contract/index.js';
import {runFixture} from '../web/contract/conformance/runner.js';
import {mono,envelope,levelAt,peakAfter,db} from '../web/contract/conformance/measure.js';
import {KEY_VOICES,BASE_LEVEL_DB} from '../web/host/instruments/keys.js';
import {hostRender,pooledHostRender} from './support/host-renderer.mjs';

const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fixture=name=>read(`web/contract/fixtures/${name}.json`);
const session={};
const keys=(extra={})=>({contract:CONTRACT,session,parts:[{id:'k',instrument:{kind:'keys',design:'basic-piano'},...extra}]});
const kit={contract:CONTRACT,session,parts:[{id:'d',instrument:{kind:'kit',design:'basic-kit'}}]};
const key=(id,at,duration,pitch,velocity=.6,extra={})=>({id,part:'k',at,duration,velocity,target:{pitch},...extra});
const hit=(id,at,piece,velocity=.8)=>({id,part:'d',at,duration:.1,velocity,target:{piece}});
const peak=r=>{let p=0;for(const c of r.audio)for(const x of c)p=Math.max(p,Math.abs(x));return p;};
const same=(a,b,label)=>{assert.equal(a.frames,b.frames,label);for(let c=0;c<2;c++)for(let i=0;i<a.frames;i++)if(!Object.is(a.audio[c][i],b.audio[c][i]))assert.fail(`${label}: channel ${c} frame ${i}`);};

test('basic DSP assets are current, labelled basic, and built by the pinned toolchain',()=>{
 const build=read('web/generated/basic/build.json');
 assert.equal(build.builderSha256,sha('scripts/build_basic_instruments.mjs'));
 for(const [kind,source] of [['keys','dsp/keys-basic.dsp'],['kit','dsp/kit-basic.dsp']]){
  const meta=read(`web/generated/basic/${kind}.json`);
  assert.equal(meta.sourceSha256,sha(source),`${source} changed: run node scripts/build_basic_instruments.mjs`);
  assert.equal(meta.wasmSha256,sha(`web/generated/basic/${kind}.wasm`));assert.equal(meta.basic,true);
  assert.equal(meta.version,read('dsp/faust-toolchain.json').version);
 }
 assert.equal(CAPABILITIES.keys.basic,true);assert.equal(CAPABILITIES.kit.basic,true);
});

test('conformance: keys pedal study and kit choke study pass their measured expectations',async()=>{
 const pool=pooledHostRender();
 try{
  const runs=await Promise.all(['keys-pedal','kit-chokes'].map(async name=>[name,await runFixture(fixture(name),{render:pool.render})]));
  for(const [name,r] of runs)assert.ok(r.pass,`${name}: ${r.results.filter(x=>!x.pass).map(x=>JSON.stringify(x)).join('; ')}`);
 }finally{await pool.close();}
});

test('keys: pedal holds, release damps, let ring holds, damping shortens, levels stay bounded',()=>{
 const rate=48000,r=(notes,controls=[])=>hostRender({setup:keys(),notes,controls,rate,seconds:6});
 const level=(out,t)=>levelAt(envelope(mono(out.audio),rate),t);
 const plain=r([key('a',.1,.3,48)]),held=r([key('a',.1,.3,48)],[{id:'p',part:'k',at:0,type:'sustainPedal',value:1},{id:'q',part:'k',at:2,type:'sustainPedal',value:0}]);
 assert.ok(level(held,1.5)-level(plain,1.5)>30,'the pedal holds the note past its key release');
 assert.ok(level(held,2.6)<level(held,1.9)-40,'pedal up damps it');
 const ring=r([key('a',.1,.3,48,.6,{techniques:[{type:'letRing'}]})]);assert.ok(level(ring,1.5)-level(plain,1.5)>30,'let ring is native for keys');
 const damped=r([key('a',.1,3,48,.6,{techniques:[{type:'mute',kind:'palm',amount:1}]})]);assert.ok(level(damped,1.5)<level(r([key('a',.1,3,48)]),1.5)-6,'damping shortens');
 const loud=r(Array.from({length:KEY_VOICES-1},(_,i)=>key(`c${i}`,.1,2,36+i*4,1)));assert.ok(peak(loud)<.97,`${KEY_VOICES-1} full-velocity voices stay below the ceiling: ${db(peak(loud)).toFixed(1)} dBFS`);
 const soft=r([key('a',.1,1,60,.2)]),hard=r([key('a',.1,1,60,1)]);assert.ok(peak(hard)>peak(soft)*4,'velocity sets level');
});

test('keys: stealing keeps one voice spare, reports the stolen note and does not click',()=>{
 const notes=Array.from({length:24},(_,i)=>key(`n${i}`,.1+i*.03,3,40+i,.7)),out=hostRender({setup:keys(),notes,rate:48000,seconds:4});
 const stolen=out.diagnostics.filter(d=>d.code==='voice-stolen');assert.equal(stolen.length,24-(KEY_VOICES-1));
 assert.deepEqual(stolen.map(d=>d.noteId),notes.slice(0,stolen.length).map(n=>n.id),'oldest first');
 // The bar is relative to the keys' calibrated level (0.05 before the loudness calibration).
 let step=0;for(const c of out.audio)for(let i=1;i<c.length;i++)step=Math.max(step,Math.abs(c[i]-c[i-1]));assert.ok(step<.05*10**(BASE_LEVEL_DB.keys/20),`max step ${step}`);
});

test('kit: chokes cut the open hi-hat, unknown pieces are silent and reported, conflicts drop the later hit',()=>{
 const rate=48000,r=notes=>hostRender({setup:kit,notes,rate,seconds:3});
 const open=r([hit('o',.1,'hihat-open')]),choked=r([hit('o',.1,'hihat-open'),hit('c',.5,'hihat-closed')]),closed=r([hit('c',.5,'hihat-closed')]);
 const residual=[0,1].map(c=>choked.audio[c].map((x,i)=>x-closed.audio[c][i])),e=envelope(mono(residual),rate);
 assert.ok(peakAfter(e,.53,.8)<peakAfter(envelope(mono(open.audio),rate),.1,.2)-40,'open hat gone 30 ms after the closed hit');
 const pedal=r([hit('o',.1,'hihat-open'),hit('p',.5,'hihat-pedal')]),pedalAlone=r([hit('p',.5,'hihat-pedal')]);
 assert.ok(peakAfter(envelope(mono([0,1].map(c=>pedal.audio[c].map((x,i)=>x-pedalAlone.audio[c][i]))),rate),.53,.8)<-60,'the pedal chokes it too');
 const unknown=r([hit('u',.1,'cowbell')]);assert.ok(peak(unknown)<1e-12,'silent (only the inherited ~1e-20 room leak)');assert.ok(unknown.diagnostics.some(d=>d.code==='unknown-piece'&&d.noteId==='u'));
 const twice=r([hit('a',.1,'snare'),{...hit('b',.1,'snare'),at:.1+1/rate}]);assert.ok(twice.diagnostics.some(d=>d.code==='retrigger-conflict'&&d.noteId==='b'));
 // Every GM-mapped drum number plays something.
 for(const gm of [35,36,37,38,40,41,42,43,44,45,46,47,48,49,50,51,52,53,55,57,59]){const piece=pieceFromGm(gm);assert.ok(PIECES.includes(piece));assert.ok(peak(r([hit('g',.1,piece)]))>1e-3,piece);}
 const all=r(PIECES.map((p,i)=>hit(p,.1+i*.01,p,1)));assert.ok(peak(all)<.97,'every piece at full velocity at once stays below the ceiling');
});

test('keys and kit render identically all at once, in batches and across block sizes',()=>{
 for(const name of ['keys-pedal','kit-chokes']){
  const f=fixture(name),{seconds}=f.render,whole=hostRender({setup:f.setup,notes:f.notes,controls:f.controls??[],rate:48000,seconds});
  const batches=[];for(let t=0;t<seconds;t+=.17)batches.push({through:t+.17,notes:f.notes.filter(n=>n.at>=t&&n.at<t+.17),controls:(f.controls??[]).filter(c=>c.at>=t&&c.at<t+.17)});
  same(whole,hostRender({setup:f.setup,batches,rate:48000,seconds}),name+' batches');
  same(whole,hostRender({setup:f.setup,notes:f.notes,controls:f.controls??[],rate:48000,seconds,block:16}),name+' block 16');
 }
});
