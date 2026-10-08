// Build Engine2 (the plucked instrument's guitar DSP, dsp/engine2/) into
// web/generated/instrument-v2/, with the inactive-knock guard and the exact per-site
// coefficient cache. By default the build must reproduce the published binary byte
// for byte. --publish writes a binary built from changed DSP (which also needs a new
// GUITAR_ENGINE.sourceSha256); --republish writes a new binary of the same source (toolchain-level
// changes only).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {compileWasm,sha256} from './faust.mjs';
import {effectsMemoProbe} from './wasm_effects_memo_probe.mjs';
import {inactiveKnockGuard} from './wasm_inactive_knock_guard.mjs';
import {GUITAR_ENGINE} from '../web/model/instrument-v2.js';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const publish=process.argv.includes('--publish'),republish=process.argv.includes('--republish'),dir='dsp/engine2',out='web/generated/instrument-v2',raw='build/engine2';
const engine=JSON.parse(fs.readFileSync('web/data/instrument-v2/engine.json'));

// Guitar: the source hash is over the DSP files in name order (the published ABI id).
const names=fs.readdirSync(dir).filter(f=>f.endsWith('.dsp')).sort(),sourceSha256=sha256(Buffer.concat(names.map(n=>fs.readFileSync(`${dir}/${n}`))));
// compileWasm stages sources at a fixed path (FAUST embeds paths in the binary).
const guitar=compileWasm(`${dir}/instrument-stage6.dsp`,{out:`${raw}/guitar.wasm`,className:'GuitarDSP',ftz:2,include:[dir]});
const guarded=inactiveKnockGuard(guitar.bytes),cached=effectsMemoProbe(guarded.bytes,{cacheSite:site=>site.loopDepth===0});
assert.ok(cached.skippedSites.length===6&&cached.skippedSites.every(site=>site.name==='_expf'),'Unexpected sample-loop coefficient sites');

const built={guitar:cached.bytes},report={sourceSha256,sources:Object.fromEntries(names.map(n=>[`${dir}/${n}`,sha256(fs.readFileSync(`${dir}/${n}`))])),
 rawGuitarSha256:sha256(guitar.bytes),guitar:sha256(built.guitar),
 transforms:{memo:sha256(fs.readFileSync('scripts/wasm_effects_memo_probe.mjs')),knockGuard:sha256(fs.readFileSync('scripts/wasm_inactive_knock_guard.mjs'))}};
fs.writeFileSync(`${raw}/build.json`,JSON.stringify(report,null,2)+'\n');
for(const [name,bytes] of Object.entries(built))fs.writeFileSync(`${raw}/${name}.candidate.wasm`,bytes);
const same=Object.entries(built).every(([name,bytes])=>sha256(bytes)===engine.browserAssets[name]&&sha256(fs.readFileSync(`${out}/${name}.wasm`))===engine.browserAssets[name]);
if(same){assert.equal(sourceSha256,GUITAR_ENGINE.sourceSha256,'Engine2 source hash differs from GUITAR_ENGINE');console.log('Engine2 reproduces the published binary:',report.guitar);}
else if(!publish&&!republish)throw Error(`Built Engine2 binary differs from the published one (candidates in ${raw}); --publish for a versioned DSP change, --republish for a toolchain-only change after golden equivalence passes`);
else{
 if(publish)assert.notEqual(sourceSha256,GUITAR_ENGINE.sourceSha256,'Same Engine2 source: use --republish for toolchain-only changes');
 else assert.equal(sourceSha256,GUITAR_ENGINE.sourceSha256,'Changed Engine2 source: use --publish and a new GUITAR_ENGINE.sourceSha256');
 fs.mkdirSync(out+'/raw',{recursive:true});
 const json=name=>JSON.parse(fs.readFileSync(`${out}/${name}.json`));
 fs.writeFileSync(`${out}/raw/guitar.wasm`,guitar.bytes);
 fs.writeFileSync(`${out}/guitar.wasm`,built.guitar);fs.writeFileSync(`${out}/guitar.json`,JSON.stringify({...json('guitar'),...guitar.meta,sourceSha256,candidateWasmSha256:report.guitar,liveThwack:true},null,2)+'\n');
 fs.writeFileSync('web/data/instrument-v2/engine.json',JSON.stringify({...engine,sourceSha256,browserAssets:{guitar:report.guitar},build:report},null,2)+'\n');
 console.log(`${publish?'Published':'Republished'} Engine2:`,report.guitar);
}
