// Independent validation of a prepared candidate and its actual packaged
// consumer. No browser claims; release_check adds the required browser gate.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hash} from './build_output.mjs';
import {sourceSnapshot} from './release_sources.mjs';
import {verifyCandidate,unpackBundle,archiveBundle} from './release_artifacts.mjs';
import {render} from '../web/host/node.js';
const ROOT=fileURLToPath(new URL('..',import.meta.url));process.chdir(ROOT);
assert.ok(process.argv[2],'Usage: npm run release:verify -- dist/releases/CANDIDATE');
const dir=path.resolve(process.argv[2]),candidate=verifyCandidate(dir),provenance=JSON.parse(fs.readFileSync(path.join(dir,'provenance.json')));
assert.equal(candidate.version,JSON.parse(fs.readFileSync('package.json')).version);
assert.equal(provenance.sourceSha256,candidate.sourceSha256);assert.equal(hash(JSON.stringify(provenance.sources)),candidate.sourceSha256);
assert.equal(hash(JSON.stringify(sourceSnapshot())),candidate.sourceSha256,'Candidate is stale: prepare a candidate from the current sources');
const sums=Object.keys(candidate.files).filter(n=>n!=='SHA256SUMS').sort().map(n=>`${candidate.files[n]}  ${n}\n`).join('');
assert.equal(fs.readFileSync(path.join(dir,'SHA256SUMS'),'utf8'),sums,'Checksum inventory differs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'synth-verify-'));
try{
 const consumer=path.join(tmp,'consumer');fs.mkdirSync(consumer);
 for(const kind of ['lib','app']){
  const dirOut=kind==='lib'?path.join(consumer,'node_modules/@mnx-lab/synth'):path.join(tmp,'app');
  const top=kind==='lib'?'package':`synth-app-${candidate.version}`,archive=fs.readFileSync(path.join(dir,candidate.archives[kind]));
  const bundle=unpackBundle(archive,dirOut,kind+'-manifest.json',top);assert.equal(bundle.version,candidate.version);
  assert.deepEqual(archiveBundle(dirOut,kind+'-manifest.json',top),archive,'Archive encoding differs');
  const rebuilt=path.join(tmp,kind+'-rebuilt');execFileSync(process.execPath,[`scripts/build_${kind}.mjs`,rebuilt],{stdio:'pipe'});
  assert.deepEqual(archiveBundle(rebuilt,kind+'-manifest.json',top),archive,'Archive does not reproduce from the checkout');
 }
 fs.copyFileSync('scripts/release_consumer.mjs',path.join(consumer,'probe.mjs'));
 const smoke=JSON.parse(execFileSync(process.execPath,['probe.mjs'],{cwd:consumer,encoding:'utf8'}));
 assert.deepEqual(smoke,provenance.checks.packagedConsumer);
 const fixture=JSON.parse(fs.readFileSync('web/contract/fixtures/multi-part-mix.json')),reference=render({setup:fixture.setup,batches:fixture.batches,rate:48000,seconds:fixture.render.seconds});
 assert.equal(smoke.pcmSha256,hash(Buffer.concat(reference.audio.map(c=>Buffer.from(c.buffer,c.byteOffset,c.byteLength)))));
 assert.equal(hash(JSON.stringify(sourceSnapshot())),candidate.sourceSha256,'Sources changed during verification');
 console.log('PASS: candidate checksums, exact archive inventories, reproduction and actual isolated packaged consumer. Browser/listening acceptance NOT included.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
