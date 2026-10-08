// Audio block assets (dsp/blocks → web/generated/blocks) are current, built by the
// pinned toolchain, and match the catalogue: every effect and bus type has an asset
// whose controls cover the parameters the host maps onto it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {BLOCK_TYPES,defaultParams} from '../web/host/blocks.js';
import {FaustNode} from '../web/host/faust-node.js';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const build=read('web/generated/blocks/build.json'),sources=fs.readdirSync('dsp/blocks').filter(f=>f.endsWith('.dsp')).sort();
test('block assets are current and built by the pinned toolchain',()=>{
 assert.equal(build.builderSha256,sha(fs.readFileSync('scripts/build_blocks.mjs')),'scripts/build_blocks.mjs changed: run node scripts/build_blocks.mjs');
 assert.deepEqual(Object.keys(build.blocks).sort(),sources.map(f=>f.replace('.dsp','')));
 for(const [name,b] of Object.entries(build.blocks)){
  assert.equal(b.sourceSha256,sha(fs.readFileSync(b.source)),`${b.source} changed: run node scripts/build_blocks.mjs`);
  assert.equal(sha(fs.readFileSync(`web/generated/blocks/${name}.wasm`)),b.wasmSha256,name);
  assert.equal(read(`web/generated/blocks/${name}.json`).version,read('dsp/faust-toolchain.json').version);
 }
});
test('every catalogue type has an asset that accepts all of its mapped controls',()=>{
 for(const [type,def] of Object.entries(BLOCK_TYPES)){
  const a={module:new WebAssembly.Module(fs.readFileSync(`web/generated/blocks/${type}.wasm`)),meta:read(`web/generated/blocks/${type}.json`)},node=new FaustNode(a.module,a.meta,48000);
  const controls=def.controls(defaultParams(type),{bpm:96});assert.doesNotThrow(()=>node.set(controls),type);
  assert.deepEqual([Number(a.meta.inputs),Number(a.meta.outputs)],[2,2],type);
  for(const [k,d] of Object.entries(def.params))if(d.type!=='boolean'){assert.ok(d.min<=d.default&&d.default<=d.max,`${type}.${k} default in range`);for(const name of Object.keys(def.presets))assert.ok(def.presets[name][k]===undefined||(def.presets[name][k]>=d.min&&def.presets[name][k]<=d.max),`${type} preset ${name} ${k}`);}
 }
 const m=read('web/generated/blocks/master.json');assert.deepEqual([Number(m.inputs),Number(m.outputs)],[2,3],'master: stereo in, stereo + limiter gain out');
});
