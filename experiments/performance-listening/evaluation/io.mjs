import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const bench = fileURLToPath(new URL('../', import.meta.url));
export const root = path.resolve(bench, '../..');
export const hash = data => crypto.createHash('sha256').update(data).digest('hex');
export const readJSON = file => JSON.parse(fs.readFileSync(file,'utf8'));
export function writeJSON(file, value) { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n'); }
export function wav(samples, rate) {
  const b=Buffer.alloc(44+samples.length*4);
  b.write('RIFF'); b.writeUInt32LE(b.length-8,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16);
  b.writeUInt16LE(3,20); b.writeUInt16LE(1,22); b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*4,28);
  b.writeUInt16LE(4,32); b.writeUInt16LE(32,34); b.write('data',36); b.writeUInt32LE(samples.length*4,40);
  samples.forEach((x,i)=>b.writeFloatLE(x,44+i*4)); return b;
}
export function readWav(file) {
  const b=fs.readFileSync(file);
  if (b.toString('ascii',0,4)!=='RIFF'||b.readUInt16LE(20)!==3||b.readUInt16LE(22)!==1||b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==b.length-44) throw Error('Expected bench mono float WAV');
  return {sampleRate:b.readUInt32LE(24),samples:Float32Array.from({length:(b.length-44)/4},(_,i)=>b.readFloatLE(44+i*4)),hash:hash(b)};
}
export function filesHash(dir, exclude=()=>false) {
  const out={};
  function walk(d) { for (const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const p=path.join(d,e.name), rel=path.relative(dir,p);
    if (exclude(rel)) continue;
    if (e.isDirectory()) walk(p); else out[rel]=hash(fs.readFileSync(p));
  }}
  walk(dir); return out;
}
