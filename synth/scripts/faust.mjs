// Compile a DSP with the pinned FAUST toolchain (dsp/faust-toolchain.json): the same
// compiler version and the same library files that built every published asset.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const PINS=JSON.parse(fs.readFileSync(new URL('../dsp/faust-toolchain.json',import.meta.url)));
// FAUST embeds the absolute source and include paths in the WASM data section, so
// every source is compiled from a fixed staging copy that mirrors dsp/: the same
// binary then comes out of any checkout.
export const STAGE='/tmp/guitar-faust-dsp';
const staged=file=>{const rel=path.relative('dsp',file);if(rel.startsWith('..'))throw Error(`DSP sources live under dsp/: ${file}`);return path.join(STAGE,rel);};
function stage(source,include){
 for(const dir of include){fs.rmSync(staged(dir),{recursive:true,force:true});fs.mkdirSync(staged(dir),{recursive:true});for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.dsp')))fs.copyFileSync(path.join(dir,f),path.join(staged(dir),f));}
 fs.mkdirSync(path.dirname(staged(source)),{recursive:true});fs.copyFileSync(source,staged(source));
}
// → {bytes, meta} with meta.librarySha256 recorded and FAUST's code/path fields removed.
export function compileWasm(source,{out,className,processName,ftz=1,include=[]}){
 fs.mkdirSync(path.dirname(out),{recursive:true});stage(source,include);
 const args=['-lang','wasm','-cn',className,...(processName?['-pn',processName]:[]),'-single','-ftz',String(ftz),...include.flatMap(dir=>['-I',staged(dir)]),staged(source),'-o',path.resolve(out)];
 const run=spawnSync(process.env.FAUST||'faust',args,{stdio:'inherit'});
 if(run.status!==0)throw Error(`FAUST failed on ${source}`);
 const meta=JSON.parse(fs.readFileSync(out.replace(/\.wasm$/,'.json')));
 assert.equal(meta.version,PINS.version,`FAUST ${meta.version} is not the pinned ${PINS.version}`);
 const librarySha256=Object.fromEntries(meta.library_list.filter(p=>p.endsWith('.lib')).map(p=>[path.basename(p),sha256(fs.readFileSync(p))]));
 for(const [name,hash] of Object.entries(librarySha256))assert.equal(hash,PINS.librarySha256[name],`FAUST library ${name} differs from the pinned file`);
 for(const key of ['code','include_pathnames','library_list'])delete meta[key];
 return {bytes:fs.readFileSync(out),meta:{...meta,librarySha256}};
}
