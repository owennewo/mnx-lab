// Copied into a fresh consumer directory by release_prepare/check. Every bare
// import resolves from the extracted tarball, never from this checkout.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as synth from '@mnx-lab/synth';
import {render} from '@mnx-lab/synth/node';
import {runFixture} from '@mnx-lab/synth/conformance';
import fixture from '@mnx-lab/synth/fixtures/multi-part-mix.json' with {type:'json'};
import pkg from '@mnx-lab/synth/package.json' with {type:'json'};
const actual=fs.realpathSync(new URL(import.meta.resolve('@mnx-lab/synth/node'))),base=fs.realpathSync('node_modules/@mnx-lab/synth');
assert.ok(actual.startsWith(base+'/'),'Consumer resolved outside its extracted package');
assert.equal(synth.CONTRACT,'mnx-sound/2');assert.ok(synth.InstrumentHost&&synth.renderOffline&&synth.makeRig&&synth.BLOCK_TYPES);
assert.equal(pkg.private,true);assert.ok(import.meta.resolve('@mnx-lab/synth/processor'));assert.ok(import.meta.resolve('@mnx-lab/synth/schema'));
const result=render({setup:fixture.setup,batches:fixture.batches,rate:48000,seconds:fixture.render.seconds});
const digest=createHash('sha256');for(const channel of result.audio)digest.update(Buffer.from(channel.buffer,channel.byteOffset,channel.byteLength));
const checks=await runFixture(fixture,{render});assert.ok(checks.pass,JSON.stringify(checks.results.filter(r=>!r.pass)));
console.log(JSON.stringify({version:pkg.version,contract:synth.CONTRACT,frames:result.audio[0].length,pcmSha256:digest.digest('hex'),conformance:true}));
