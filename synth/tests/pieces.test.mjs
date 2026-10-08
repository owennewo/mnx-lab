// The piece library (chain campaign Phase 6): generated and current, every piece a valid
// fixture whose checks pass as written, and arrange() plays any piece through a session.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateFixture,runFixture} from '../web/contract/conformance/index.js';
import {checkEvents} from '../web/contract/index.js';
import {pooledHostRender} from './support/host-renderer.mjs';
import {arrange} from '../web/app/pieces.js';
const index=JSON.parse(fs.readFileSync('web/data/pieces/index.json')).pieces,piece=id=>JSON.parse(fs.readFileSync(`web/data/pieces/${id}.json`));
test('the piece library is current, short and covers every kind',()=>{
 execFileSync(process.execPath,['scripts/build_pieces.mjs','--check']);
 assert.ok(index.length>=12);const kinds=new Set();
 for(const {id} of index){const p=piece(id);validateFixture(p);assert.ok(p.render.seconds<=30,`${id} is short`);assert.ok(p.expect.length,`${id} has checks`);p.setup.parts.forEach(x=>kinds.add(x.instrument.kind));}
 assert.deepEqual([...kinds].sort(),['keys','kit','plucked']);
});
test('every piece passes its checks as written',async()=>{
 const pool=pooledHostRender();
 try{const runs=await Promise.all(index.map(async ({id})=>[id,await runFixture(piece(id),{render:pool.render})]));
  for(const [id,r] of runs)assert.ok(r.pass,`${id}: ${JSON.stringify(r.results.filter(x=>!x.pass))}`);}
 finally{await pool.close();}
});
test('arrange: lines go to parts of the same kind; extra lines and parts are reported; ids stay unique and linked',()=>{
 const band=piece('band-groove'),setup=parts=>({contract:'mnx-sound/2',session:{},parts});
 const g={id:'lead',instrument:{kind:'plucked',design:'clear-steel',layout:band.setup.parts[0].instrument.layout}},k2={id:'organ',instrument:{kind:'keys',design:{id:'basic-piano'}}};
 const m=arrange(band,setup([g]));
 assert.deepEqual(m.lines.map(l=>[l.id,l.part]),[['guitar','lead'],['keys',null],['kit',null]]);assert.deepEqual(m.silent,[]);
 assert.ok(m.notes.every(n=>n.part==='lead'));assert.deepEqual(m.controls.map(c=>c.type),['tempo'],'controls of unplayed lines are dropped');
 checkEvents(m.notes,m.controls,new Set(['lead']),new Map());
 const two=arrange(piece('guitar-legato'),setup([g,{...g,id:'second'},k2]));assert.deepEqual(two.silent,['second','organ']);
 assert.ok(two.notes.filter(n=>n.techniques?.some(t=>t.type==='legato')).every(n=>two.notes.some(x=>x.id===n.techniques.find(t=>t.type==='legato').from)),'legato sources renamed with their notes');
});
test('arrange: a guitar line on other strings drops its fingering and moves by octaves into the part’s range',()=>{
 const uke={id:'u',instrument:{kind:'plucked',design:'nail-nylon',layout:{strings:[69,64,60,67].map(pitch=>({pitch})),capo:0}}};
 const m=arrange(piece('guitar-strums'),{contract:'mnx-sound/2',session:{},parts:[uke]});
 assert.ok(m.notes.length&&m.notes.every(n=>!n.fingering&&n.target.pitch>=60&&n.target.pitch<=88));
 const same=arrange(piece('ukulele-strum'),{contract:'mnx-sound/2',session:{},parts:[uke]});assert.ok(same.notes.every(n=>n.fingering),'written for these strings: kept as written');
 const guitar={id:'g',instrument:{kind:'plucked',design:'clear-steel',layout:{strings:[64,59,55,50,45,40].map(pitch=>({pitch})),capo:0}}};
 assert.deepEqual(arrange(piece('ukulele-strum'),{contract:'mnx-sound/2',session:{},parts:[guitar,uke]}).lines.map(l=>l.part),['u'],'a ukulele line goes to the ukulele, not the first plucked part');
});
