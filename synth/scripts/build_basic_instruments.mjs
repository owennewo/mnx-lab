// Build the basic keys and kit DSPs (labelled "basic", D9) for the instrument host.
// Pinned FAUST toolchain (scripts/faust.mjs); library and source hashes are recorded so tests/basic-instruments.test.mjs can detect stale assets.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {compileWasm} from './faust.mjs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const hash=x=>createHash('sha256').update(x).digest('hex'),root='web/generated/basic';
fs.mkdirSync(root,{recursive:true});
const report={builderSha256:hash(fs.readFileSync('scripts/build_basic_instruments.mjs')),instruments:{}};
for(const [kind,source,className] of [['keys','dsp/keys-basic.dsp','KeysDSP'],['kit','dsp/kit-basic.dsp','KitDSP']]){
 // -ftz 2 (bit-mask flush to zero), as the Engine2 guitar: decaying recursions stay cheap.
 const {bytes,meta}=compileWasm(source,{out:`${root}/${kind}.wasm`,className,ftz:2});
 Object.assign(meta,{kind,basic:true,sourceSha256:hash(fs.readFileSync(source)),wasmSha256:hash(bytes)});
 fs.writeFileSync(`${root}/${kind}.json`,JSON.stringify(meta,null,2)+'\n');
 report.instruments[kind]={source,sourceSha256:meta.sourceSha256,wasmSha256:meta.wasmSha256,inputs:meta.inputs,outputs:meta.outputs};
}
fs.writeFileSync(`${root}/build.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
