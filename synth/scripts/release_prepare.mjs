// Prepare (not promote/publish) immutable private app/library candidates. Build
// twice; compare complete bytes; exercise the actual tarball outside checkout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hash,verifyBundle} from './build_output.mjs';
import {archiveBundle,unpackBundle,verifyCandidate} from './release_artifacts.mjs';
import {render} from '../web/host/node.js';
import {sourceSnapshot} from './release_sources.mjs';
const ROOT=fileURLToPath(new URL('..',import.meta.url));process.chdir(ROOT);
assert.ok(Number(process.versions.node.split('.')[0])>=22,'Node 22 or newer is required');
const pkg=JSON.parse(fs.readFileSync('package.json'));assert.match(pkg.version,/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const before=sourceSnapshot(),sourceHash=hash(JSON.stringify(before)),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'synth-release-'));
try{
 execFileSync(process.execPath,['tests/pieces.test.mjs'],{stdio:'inherit'});
 const names={lib:`mnx-lab-synth-${pkg.version}.tgz`,app:`synth-app-${pkg.version}.tar.gz`},artifacts={},bundles={};
 for(const kind of ['lib','app']){
  const manifestName=kind+'-manifest.json',top=kind==='lib'?'package':`synth-app-${pkg.version}`;
  const builds=[];
  for(const round of [1,2]){const dir=path.join(tmp,kind+round);execFileSync(process.execPath,[`scripts/build_${kind}.mjs`,dir],{stdio:'inherit'});builds.push(archiveBundle(dir,manifestName,top));}
  assert.deepEqual(builds[0],builds[1],`${kind} archive is not reproducible`);artifacts[names[kind]]=builds[0];bundles[kind]=verifyBundle(path.join(tmp,kind+'1'),manifestName);
 }
 const consumer=path.join(tmp,'consumer');fs.mkdirSync(consumer);const extracted=path.join(consumer,'node_modules/@mnx-lab/synth');
 unpackBundle(artifacts[names.lib],extracted,'lib-manifest.json','package');fs.copyFileSync('scripts/release_consumer.mjs',path.join(consumer,'probe.mjs'));
 const smoke=JSON.parse(execFileSync(process.execPath,['probe.mjs'],{cwd:consumer,encoding:'utf8'}).trim());
 const fixture=JSON.parse(fs.readFileSync('web/contract/fixtures/multi-part-mix.json'));
 const reference=render({setup:fixture.setup,batches:fixture.batches,rate:48000,seconds:fixture.render.seconds});
 const pcm=Buffer.concat(reference.audio.map(c=>Buffer.from(c.buffer,c.byteOffset,c.byteLength)));
 assert.equal(smoke.pcmSha256,hash(pcm),'Packaged consumer audio differs from the checkout');assert.equal(smoke.frames,reference.audio[0].length);assert.equal(smoke.version,pkg.version);
 unpackBundle(artifacts[names.app],path.join(tmp,'extracted-app'),'app-manifest.json',`synth-app-${pkg.version}`);
 const pins=JSON.parse(fs.readFileSync('dsp/faust-toolchain.json')),metadata={};
 for(const [name,sha] of Object.entries(bundles.app.files).filter(([n])=>n.endsWith('.wasm')))metadata[name]=sha;
 for(const name of Object.keys(metadata)){
  const meta=JSON.parse(fs.readFileSync(path.join(tmp,'app1',name.replace(/\.wasm$/,'.json'))));
  assert.equal(meta.version,pins.version,`Compiler pin: ${name}`);
  assert.ok(Object.keys(meta.librarySha256??{}).length,`Missing library pins: ${name}`);
  for(const [lib,sha] of Object.entries(meta.librarySha256))assert.equal(sha,pins.librarySha256[lib],`Library pin: ${lib}`);
 }
 for(const name of ['RELEASE-NOTES.md','THIRD_PARTY_NOTICES.md'])artifacts[name]=fs.readFileSync(name);
 artifacts['provenance.json']=Buffer.from(JSON.stringify({schema:'synth-provenance/1',version:pkg.version,sourceSha256:sourceHash,sources:before,
  git:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()},
  node:process.version,platform:process.platform,architecture:process.arch,faustPins:pins,runtimeWasm:metadata,
  checks:{reproducibleArchives:true,packagedConsumer:smoke,manifestIntegrity:true,pinnedMetadata:true},
  pending:['full-release-gate','built-app-browser','user-listening','distribution-notice-review'],limitations:['Live callback deadline acceptance is unresolved.','Native rendering is guitar-only.'],
  distribution:'private-local-only; no public licence granted'},null,2)+'\n');
 artifacts['SHA256SUMS']=Buffer.from(Object.keys(artifacts).sort().map(n=>`${hash(artifacts[n])}  ${n}\n`).join(''));
 const manifest={schema:'synth-candidate/1',status:'prepared-not-promoted',version:pkg.version,sourceSha256:sourceHash,
  archives:names,files:Object.fromEntries(Object.keys(artifacts).sort().map(n=>[n,hash(artifacts[n])]))};
 artifacts['candidate.json']=Buffer.from(JSON.stringify(manifest,null,2)+'\n');assert.equal(hash(JSON.stringify(sourceSnapshot())),sourceHash,'Sources changed while preparing the candidate');
 // Fixed parent only. Never remove or replace an existing candidate directory.
 const parent=path.resolve('dist/releases');for(let p=parent;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))assert.ok(!fs.lstatSync(p).isSymbolicLink(),'Release output contains a symlink');
 // Candidate identity includes provenance, not just source content: preparing
 // the same sources after a clean commit must create a new immutable candidate.
 fs.mkdirSync(parent,{recursive:true});const destination=path.join(parent,`${pkg.version}-candidate-${hash(artifacts['candidate.json']).slice(0,16)}`);
 if(fs.existsSync(destination)){
  verifyCandidate(destination);for(const [name,bytes] of Object.entries(artifacts))assert.deepEqual(fs.readFileSync(path.join(destination,name)),bytes,'Existing candidate differs; it will not be replaced');
 }else{const staging=fs.mkdtempSync(path.join(parent,'.candidate-'));for(const [name,bytes] of Object.entries(artifacts))fs.writeFileSync(path.join(staging,name),bytes,{flag:'wx'});verifyCandidate(staging);fs.renameSync(staging,destination);}
 console.log(`Prepared private candidate: ${destination}\nArchive reproduction and packaged consumer PASS. Browser/listening/release gate remain pending.`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
