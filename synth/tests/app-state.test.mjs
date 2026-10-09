// App state (chain campaign): sessions are named mnx-sound/2 setups, saved designs and
// sessions survive damaged storage, chain edits keep ids unique, and undo works in steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STORE,Store,storedCollection,saveOwnDesign,factoryDesigns,defaultSession,loadSession,exportRig,importRig,partRig,newPart,partIds,
 addBlock,duplicateBlock,removeBlock,moveBlock,applyPreset,History} from '../web/app/state.js';
import {validateSetup,BLOCK_TYPES} from '../web/host/index.js';
const factory=factoryDesigns(JSON.parse(fs.readFileSync('web/data/instrument-v2/presets.json')));
function storage(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}
const guitar=session=>session.setup.parts[0];

test('a new session is a valid mnx-sound/2 setup with a guitar, a Room bus and a master',()=>{
 const s=defaultSession(factory);assert.ok(validateSetup(s.setup));
 assert.equal(guitar(s).instrument.kind,'plucked');assert.deepEqual(s.setup.session.buses.map(b=>b.type),['room']);assert.equal(s.setup.session.master.volumeDb,0);assert.equal(s.piece,'guitar-strums','a new session plays a piece from the library');
 assert.deepEqual(STORE,{session:'synth2.session',designs:'synth2.designs',sessions:'synth2.sessions'},'fresh storage keys (C2)');
});
test('named save persists the actual edited design and reload preserves every value',()=>{
 const s=storage(),store=new Store(s),session=defaultSession(factory),p=guitar(session),original=structuredClone(p.instrument.design);
 p.instrument.design={...structuredClone(original),factory:false,name:'Rounded steel · edited'};
 p.instrument.design.instrument.parameters.decay=7.25;p.instrument.design.instrument.parameters.thwack_soak=11.5;
 const expected=structuredClone(p.instrument.design),designs=saveOwnDesign(store,[],p,'My actual edits','saved-test');
 assert.equal(designs[0].instrument.parameters.decay,7.25);assert.equal(designs[0].instrument.parameters.thwack_soak,11.5);
 assert.deepEqual(store.get(STORE.designs,[]),designs);assert.deepEqual(designs[0].instrument,expected.instrument);assert.deepEqual(factory[0],original);
 store.set(STORE.session,session);assert.deepEqual(loadSession(store.get(STORE.session)),session);
 const rig=exportRig(session);assert.equal(rig.rig,'3.0.0');assert.deepEqual(importRig(JSON.parse(JSON.stringify(rig))).setup,session.setup);
});
test('failed named save keeps both the edited session and prior library intact',()=>{
 const s=storage(),store=new Store(s),p=guitar(defaultSession(factory)),prior=[{name:'Existing'}];
 s.setItem(STORE.designs,JSON.stringify(prior));const before=structuredClone(p);s.setItem=()=>{throw Error('Quota exceeded');};
 assert.throws(()=>saveOwnDesign(store,prior,p,'Unstored','new'),/Could not save/);assert.deepEqual(p,before);assert.deepEqual(prior,[{name:'Existing'}]);assert.equal(s.getItem(STORE.designs),JSON.stringify(prior));
});
test('invalid JSON is retained on read and recoverable before an ordinary edit overwrites it',()=>{
 const s=storage(),store=new Store(s),raw='{damaged session';s.setItem(STORE.session,raw);
 assert.equal(store.get(STORE.session,null),null);assert.equal(s.getItem(STORE.session),raw);
 const session=defaultSession(factory);assert.equal(store.set(STORE.session,session),true);
 assert.equal(s.getItem(STORE.session+'.before-recovery'),raw);assert.deepEqual(store.get(STORE.session),session);
 s.setItem(STORE.session,'later broken');store.get(STORE.session,null);store.set(STORE.session,session);
 assert.equal(s.getItem(STORE.session+'.before-recovery'),raw);assert.equal(s.getItem(STORE.session+'.before-recovery-1'),'later broken');
});
test('schema-invalid sessions, old rig formats and failed recovery writes cannot destroy original data',()=>{
 const s=storage(),store=new Store(s),raw=JSON.stringify({schemaVersion:2,rigVersion:'2.0.0',name:'old'});s.setItem(STORE.session,raw);
 assert.throws(()=>loadSession(store.get(STORE.session)));assert.throws(()=>importRig(JSON.parse(raw)),/rig 3\.0\.0/);store.protect(STORE.session);
 s.setItem=()=>{throw Error('Storage unavailable');};assert.equal(store.set(STORE.session,defaultSession(factory)),false);assert.equal(s.getItem(STORE.session),raw);
});
test('damaged design/session libraries do not break startup or the menu; valid entries survive and damaged bytes are retained',()=>{
 const s=storage(),store=new Store(s),good=structuredClone(factory[0]);
 const raw=JSON.stringify([good,{schemaVersion:999}]);s.setItem(STORE.designs,raw);
 assert.deepEqual(storedCollection(store,STORE.designs,d=>factoryDesigns([d])[0]),[good]);assert.equal(s.getItem(STORE.designs),raw);assert.ok(store.recover.has(STORE.designs));
 assert.ok(store.set(STORE.designs,[good]));assert.equal(s.getItem(STORE.designs+'.before-recovery'),raw);
 s.setItem(STORE.sessions,JSON.stringify({not:'an array'}));assert.deepEqual(storedCollection(store,STORE.sessions,loadSession),[]);
 assert.equal(s.getItem(STORE.sessions),JSON.stringify({not:'an array'}));assert.ok(store.recover.has(STORE.sessions));
});
test('unavailable storage still supports a usable in-memory session and never claims a successful save',()=>{
 const store=new Store(null);assert.deepEqual(storedCollection(store,STORE.designs,d=>d,factory),factory);assert.equal(store.set(STORE.session,defaultSession(factory)),false);
 assert.throws(()=>saveOwnDesign(store,[],guitar(defaultSession(factory)),'Unsaved','id'),/Could not save/);
});
test('chain edits: add, duplicate, move within and across lanes, remove, presets; ids stay unique and the setup valid',()=>{
 const s=defaultSession(factory),setup=s.setup,g=guitar(s),keys=newPart('keys',{factory,taken:partIds(setup)});setup.parts.push(keys);
 const d=addBlock(setup,g,'drive'),e=addBlock(setup,g,'echo');assert.deepEqual(g.chain.map(b=>b.id),['drive','echo']);assert.equal(d.preset,Object.keys(BLOCK_TYPES.drive.presets)[0]);
 const e2=duplicateBlock(setup,g,1);assert.equal(e2.id,'echo-2');assert.deepEqual(e2.params,e.params);assert.notEqual(e2.params,e.params);
 moveBlock(g,2,g,0);assert.deepEqual(g.chain.map(b=>b.id),['echo-2','drive','echo']);
 moveBlock(g,0,g,3);assert.deepEqual(g.chain.map(b=>b.id),['drive','echo','echo-2']);
 moveBlock(g,0,keys,0);assert.deepEqual(keys.chain.map(b=>b.id),['drive']);assert.deepEqual(g.chain.map(b=>b.id),['echo','echo-2']);
 assert.equal(addBlock(setup,keys,'drive').id,'drive-2','ids unique across the whole session');
 applyPreset(g.chain[0],'Slapback');assert.equal(g.chain[0].params.beats,.25);assert.equal(g.chain[0].preset,'Slapback');
 removeBlock(g,1);assert.deepEqual(g.chain.map(b=>b.id),['echo']);assert.ok(validateSetup(setup));
 const one=partRig(s,keys);assert.deepEqual(one.setup.parts.map(p=>p.id),[keys.id]);assert.deepEqual(one.setup.session.buses.map(b=>b.id),['room']);
});
test('undo history: one step per burst, redo after undo, a new edit clears redo',()=>{
 const h=new History();h.record('a');h.record('a');h.record('b');
 assert.equal(h.undo('c'),'b');assert.equal(h.undo('b'),'a');assert.equal(h.undo('a'),null);
 assert.equal(h.redo('a'),'b');assert.ok(h.canRedo);h.record('b');assert.equal(h.canRedo,false);
});
