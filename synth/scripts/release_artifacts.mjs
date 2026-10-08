// Deterministic, deliberately small USTAR writer/reader. Release bundles contain
// regular files only: no links, extended headers, devices or extraction escapes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {hash,verifyBundle} from './build_output.mjs';

const safe=name=>typeof name==='string'&&name.length>0&&!name.includes('\\')&&!name.includes('\0')&&!path.posix.isAbsolute(name)&&name.split('/').every(p=>p&&p!=='.'&&p!=='..');
const field=(header,offset,length,value)=>{
 const b=Buffer.from(value);assert.ok(b.length<length,`Tar field too long: ${value}`);b.copy(header,offset);
};
const octal=(header,offset,length,value)=>field(header,offset,length,value.toString(8).padStart(length-1,'0'));
function headerFor(name,size){
 assert.ok(safe(name),`Unsafe archive path: ${name}`);
 const h=Buffer.alloc(512);let base=name,prefix='';
 if(Buffer.byteLength(base)>=100){const split=name.lastIndexOf('/');prefix=name.slice(0,split);base=name.slice(split+1);assert.ok(split>0);}
 field(h,0,100,base);field(h,345,155,prefix);octal(h,100,8,0o644);octal(h,108,8,0);octal(h,116,8,0);
 octal(h,124,12,size);octal(h,136,12,0);h.fill(32,148,156);h[156]=48;Buffer.from('ustar\0').copy(h,257);Buffer.from('00').copy(h,263);
 const checksum=h.reduce((a,b)=>a+b,0);Buffer.from(checksum.toString(8).padStart(6,'0')+'\0 ').copy(h,148);return h;
}
export function archiveBundle(dir,manifestName,top){
 assert.ok(safe(top)&&!top.includes('/'));const manifest=verifyBundle(dir,manifestName),chunks=[];
 for(const name of [...Object.keys(manifest.files),manifestName].sort()){
  const bytes=fs.readFileSync(path.join(dir,name));chunks.push(headerFor(top+'/'+name,bytes.length),bytes,Buffer.alloc((512-bytes.length%512)%512));
 }
 chunks.push(Buffer.alloc(1024));return gzipSync(Buffer.concat(chunks),{level:9});
}
export function archiveFiles(bytes){
 const tar=gunzipSync(bytes,{maxOutputLength:32*1024*1024}),files=new Map();let offset=0,ended=false;
 const string=(h,start,length)=>h.subarray(start,start+length).toString('utf8').split('\0')[0];
 const number=(h,start,length)=>{const s=string(h,start,length).trim();assert.match(s,/^[0-7]+$/,'Invalid tar number');return parseInt(s,8);};
 while(offset+512<=tar.length){
  const h=tar.subarray(offset,offset+512);offset+=512;
  if(h.every(b=>b===0)){assert.ok(tar.length-offset>=512&&tar.subarray(offset).every(b=>b===0),'Invalid tar ending');ended=true;break;}
  assert.equal(string(h,257,6),'ustar','Unsupported archive format');assert.equal(h[156],48,'Only regular archive files are allowed');
  const checksum=h.reduce((a,b,i)=>a+(i>=148&&i<156?32:b),0);assert.equal(number(h,148,8),checksum,'Tar checksum mismatch');
  const prefix=string(h,345,155),name=(prefix?prefix+'/':'')+string(h,0,100),size=number(h,124,12);
  assert.ok(safe(name),`Unsafe archive path: ${name}`);assert.ok(!files.has(name),'Duplicate archive entry');
  assert.ok(offset+size<=tar.length,'Truncated archive');files.set(name,tar.subarray(offset,offset+size));offset+=Math.ceil(size/512)*512;
 }
 assert.ok(ended&&files.size,'Missing archive ending/files');return files;
}
export function unpackBundle(bytes,destination,manifestName,top){
 assert.ok(safe(top)&&!top.includes('/'));assert.ok(!fs.existsSync(destination),'Extract only to a fresh directory');
 for(let p=path.resolve(destination);p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))assert.ok(!fs.lstatSync(p).isSymbolicLink(),'Symlink in extraction path');
 const files=archiveFiles(bytes);for(const name of files.keys())assert.ok(name.startsWith(top+'/'),'Unexpected archive root');
 fs.mkdirSync(destination,{recursive:true});
 for(const [name,data] of files){const target=path.join(destination,name.slice(top.length+1));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data,{flag:'wx'});}
 return verifyBundle(destination,manifestName);
}
export function verifyCandidate(dir){
 assert.ok(!fs.lstatSync(dir).isSymbolicLink(),'Candidate path is a symlink');
 assert.ok(fs.lstatSync(path.join(dir,'candidate.json')).isFile(),'Candidate manifest is not a regular file');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'candidate.json')));
 assert.equal(manifest.schema,'synth-candidate/1');assert.equal(manifest.status,'prepared-not-promoted');
 const names=Object.keys(manifest.files).sort();
 assert.match(manifest.sourceSha256,/^[a-f0-9]{64}$/);
 for(const kind of ['app','lib'])assert.ok(names.includes(manifest.archives?.[kind]),`Missing ${kind} archive`);
 assert.deepEqual(fs.readdirSync(dir).sort(),[...names,'candidate.json'].sort(),'Undeclared candidate files');
 for(const name of names){assert.ok(safe(name)&&!name.includes('/'),'Unsafe candidate file');assert.ok(fs.lstatSync(path.join(dir,name)).isFile());assert.equal(hash(fs.readFileSync(path.join(dir,name))),manifest.files[name],`Changed candidate file: ${name}`);}
 return manifest;
}
