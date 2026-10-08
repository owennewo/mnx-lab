// Build the audio blocks (dsp/blocks/*.dsp: one FAUST program per effect, the room
// bus and the master) with the pinned toolchain into web/generated/blocks/. The
// build is deterministic; tests/blocks.test.mjs checks the assets are current.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileWasm,sha256} from './faust.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const dir='dsp/blocks',out='web/generated/blocks',raw='build/blocks';
export const BLOCK_SOURCES=fs.readdirSync(dir).filter(f=>f.endsWith('.dsp')).sort();
fs.mkdirSync(out,{recursive:true});
const report={builderSha256:sha256(fs.readFileSync('scripts/build_blocks.mjs')),blocks:{}};
for(const file of BLOCK_SOURCES){
 const name=file.replace(/\.dsp$/,''),source=`${dir}/${file}`;
 const {bytes,meta}=compileWasm(source,{out:`${raw}/${name}.wasm`,className:name[0].toUpperCase()+name.slice(1)+'DSP',ftz:2});
 Object.assign(meta,{block:name,sourceSha256:sha256(fs.readFileSync(source)),wasmSha256:sha256(bytes)});
 fs.writeFileSync(`${out}/${name}.wasm`,bytes);fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(meta,null,2)+'\n');
 report.blocks[name]={source,sourceSha256:meta.sourceSha256,wasmSha256:meta.wasmSha256,inputs:Number(meta.inputs),outputs:Number(meta.outputs)};
}
fs.writeFileSync(`${out}/build.json`,JSON.stringify(report,null,2)+'\n');
console.log(Object.entries(report.blocks).map(([n,b])=>`${n}: ${b.inputs}→${b.outputs} ${b.wasmSha256.slice(0,12)}`).join('\n'));
