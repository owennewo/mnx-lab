// Rig 3.0.0: a named session holding one mnx-sound/2 setup. Earlier rig versions are
// not imported (chain campaign C2); invalid files are rejected with a message.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RIG_VERSION,makeRig,validateRig} from '../web/host/rig.js';
import {CONTRACT} from '../web/contract/index.js';
const fixture=JSON.parse(fs.readFileSync('web/contract/fixtures/multi-part-mix.json'));
test('a rig wraps a valid setup, round-trips through JSON and never shares the input',()=>{
 const rig=makeRig('Evening session',fixture.setup);
 assert.equal(rig.rig,RIG_VERSION);assert.notEqual(rig.setup,fixture.setup);assert.deepEqual(rig.setup,fixture.setup);
 assert.deepEqual(validateRig(JSON.parse(JSON.stringify(rig))),rig);
});
test('earlier rig versions and broken rigs are rejected with a reason',()=>{
 assert.throws(()=>validateRig({schemaVersion:2,rigVersion:'2.0.0',name:'old'}),/rig 3\.0\.0/);
 assert.throws(()=>validateRig({schemaVersion:1,instrument:{},layers:{}}),/rig 3\.0\.0/);
 assert.throws(()=>validateRig({rig:RIG_VERSION,name:'',setup:fixture.setup}),/name/);
 assert.throws(()=>validateRig({rig:RIG_VERSION,name:'x',setup:{...fixture.setup,contract:'mnx-sound/1'}}),/mnx-sound\/2/);
 const badSend=structuredClone(fixture.setup);badSend.parts[0].strip={sends:{hall:.5}};
 assert.throws(()=>validateRig({rig:RIG_VERSION,name:'x',setup:badSend}),/unknown bus hall/);
 assert.equal(CONTRACT,'mnx-sound/2');
});
