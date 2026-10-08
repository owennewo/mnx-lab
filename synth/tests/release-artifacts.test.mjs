import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {hash} from '../scripts/build_output.mjs';
import {archiveBundle,archiveFiles,unpackBundle,verifyCandidate} from '../scripts/release_artifacts.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'synth-artifacts-test-'));test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
const bundle=path.join(tmp,'bundle');fs.mkdirSync(bundle);
const files={'package.json':Buffer.from('{"private":true}'),'host/very-long-module-name.js':Buffer.from('export const value=42;')};
for(const [name,b] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(bundle,name)),{recursive:true});fs.writeFileSync(path.join(bundle,name),b);}
const manifest={name:'@mnx-lab/synth',version:'0.1.0',files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)]))};
fs.writeFileSync(path.join(bundle,'lib-manifest.json'),JSON.stringify(manifest));
const archive=()=>archiveBundle(bundle,'lib-manifest.json','package');
const altered=(fn)=>{const tar=gunzipSync(archive());fn(tar);return gzipSync(tar);};
const checksum=h=>{h.fill(32,148,156);const sum=h.subarray(0,512).reduce((a,b)=>a+b,0);Buffer.from(sum.toString(8).padStart(6,'0')+'\0 ').copy(h,148);};

test('archives reproduce byte-for-byte independent of file timestamps; extract actual bytes and exact inventory',()=>{
 const a=archive();fs.utimesSync(path.join(bundle,'package.json'),12345,54321);assert.deepEqual(archive(),a);
 assert.deepEqual([...archiveFiles(a).keys()].sort(),Object.keys(manifest.files).concat('lib-manifest.json').map(n=>'package/'+n).sort());
 const extracted=path.join(tmp,'consumer');assert.deepEqual(unpackBundle(a,extracted,'lib-manifest.json','package'),manifest);
 assert.equal(fs.readFileSync(path.join(extracted,'host/very-long-module-name.js'),'utf8'),files['host/very-long-module-name.js'].toString());
 assert.throws(()=>unpackBundle(a,extracted,'lib-manifest.json','package'),/fresh directory/);
});
test('archives reject traversal, symlinks, corrupt checksums, duplicate entries and truncation before extraction',()=>{
 const traversal=altered(h=>{h.fill(0,0,100);Buffer.from('../escape').copy(h);checksum(h);});assert.throws(()=>archiveFiles(traversal),/Unsafe archive path/);
 const link=altered(h=>{h[156]=50;checksum(h);});assert.throws(()=>archiveFiles(link),/Only regular/);
 const corrupt=altered(h=>h[5]^=1);assert.throws(()=>archiveFiles(corrupt),/checksum/);
 const t=gunzipSync(archive()),firstLength=512+Math.ceil(files['host/very-long-module-name.js'].length/512)*512;
 assert.throws(()=>archiveFiles(gzipSync(Buffer.concat([t.subarray(0,firstLength),t]))),/Duplicate archive/);
 assert.throws(()=>archiveFiles(gzipSync(t.subarray(0,t.length-1024))),/ending/);
 const target=path.join(tmp,'bad-extraction');assert.throws(()=>unpackBundle(traversal,target,'lib-manifest.json','package'));assert.ok(!fs.existsSync(target));
});
test('candidate verification rejects changed, undeclared and symlink artifacts and never claims promotion',()=>{
 const dir=path.join(tmp,'candidate');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'lib.tgz'),archive());
 const candidate={schema:'synth-candidate/1',status:'prepared-not-promoted',sourceSha256:hash('source'),archives:{lib:'lib.tgz',app:'lib.tgz'},files:{'lib.tgz':hash(archive())}};
 fs.writeFileSync(path.join(dir,'candidate.json'),JSON.stringify(candidate));assert.equal(verifyCandidate(dir).status,'prepared-not-promoted');
 fs.writeFileSync(path.join(dir,'extra'),'unrelated');assert.throws(()=>verifyCandidate(dir),/Undeclared/);fs.unlinkSync(path.join(dir,'extra'));
 fs.writeFileSync(path.join(dir,'lib.tgz'),'changed');assert.throws(()=>verifyCandidate(dir),/Changed candidate/);fs.unlinkSync(path.join(dir,'lib.tgz'));
 fs.symlinkSync(path.join(bundle,'package.json'),path.join(dir,'lib.tgz'));assert.throws(()=>verifyCandidate(dir));
});
