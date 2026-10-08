// Build only into a fresh staging directory; publish atomically and retain the
// preceding generated bundle. Never recursively remove a caller-supplied path.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('..',import.meta.url));
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function inventory(dir,prefix=''){
 return fs.readdirSync(dir).sort().flatMap(name=>{
  const file=path.join(dir,name),rel=prefix+name,stat=fs.lstatSync(file);
  assert.ok(!stat.isSymbolicLink(),`Build contains a symlink: ${rel}`);
  if(stat.isDirectory())return inventory(file,rel+'/');
  assert.ok(stat.isFile(),`Unexpected build entry: ${rel}`);return [rel];
 }).sort();
}
export function verifyBundle(dir,manifestName){
 assert.ok(['app-manifest.json','lib-manifest.json'].includes(manifestName));
 const found=inventory(dir);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,manifestName)));
 assert.equal(manifest.name,manifestName==='app-manifest.json'?'synth-app':'@mnx-lab/synth');
 assert.ok(manifest.files&&typeof manifest.files==='object'&&!Array.isArray(manifest.files),'Missing file hashes');
 const names=Object.keys(manifest.files).sort();
 for(const file of names){
  assert.ok(file&&!file.includes('\\')&&!path.posix.isAbsolute(file)&&file.split('/').every(p=>p&&p!=='.'&&p!=='..'),`Unsafe manifest path: ${file}`);
  assert.match(manifest.files[file],/^[a-f0-9]{64}$/);assert.equal(hash(fs.readFileSync(path.join(dir,file))),manifest.files[file],`Changed bundle file: ${file}`);
 }
 assert.deepEqual(found,[...names,manifestName].sort(),'Bundle has undeclared files');return manifest;
}
export function beginBuild(output,manifestName){
 const destination=path.resolve(output),relative=path.relative(ROOT,destination),root=path.parse(destination).root;
 assert.ok(destination!==root&&destination!==path.resolve(os.homedir()),'Refusing a broad build output');
 assert.ok(relative&&(!relative.startsWith('..')?relative.startsWith('dist'+path.sep):path.relative(destination,ROOT).startsWith('..')),'Build output must be under dist/ or a separate temporary/export directory');
 // Do not follow any symlink in the output ancestry.
 for(let p=destination;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))assert.ok(!fs.lstatSync(p).isSymbolicLink(),`Symlink in output path: ${p}`);
 if(fs.existsSync(destination)){
  assert.ok(fs.statSync(destination).isDirectory(),'Build output is not a directory');
  if(fs.readdirSync(destination).length)verifyBundle(destination,manifestName);
 }
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 const staging=fs.mkdtempSync(path.join(path.dirname(destination),'.synth-build-'));
 return {out:staging,destination,commit(){
  verifyBundle(staging,manifestName);let previous;
  if(fs.existsSync(destination)){
   if(fs.readdirSync(destination).length)verifyBundle(destination,manifestName);
   previous=destination+'.previous-'+randomUUID();fs.renameSync(destination,previous);
  }
  try{fs.renameSync(staging,destination);}catch(e){if(previous&&!fs.existsSync(destination))fs.renameSync(previous,destination);throw e;}
  return {destination,previous};
 }};
}
