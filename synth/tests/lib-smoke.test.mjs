// The headless library works from its built package alone: reproducible build,
// package exports, Node rendering and (with Playwright configured) the AudioWorklet,
// all bit-identical to the in-repo host.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {hostRender} from './support/host-renderer.mjs';

const ROOT=fileURLToPath(new URL('..',import.meta.url)),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'synth-lib-'));
const build=dir=>execFileSync('node',['scripts/build_lib.mjs',dir],{cwd:ROOT,encoding:'utf8'});
const lib=path.join(tmp,'node_modules','@mnx-lab','synth');
if(process.env.LIB_TEST_PACKAGE_DIR)fs.cpSync(process.env.LIB_TEST_PACKAGE_DIR,lib,{recursive:true});else build(lib);
const fixture=JSON.parse(fs.readFileSync(ROOT+'web/contract/fixtures/multi-part-mix.json'));
const same=(a,b)=>{for(let c=0;c<2;c++){assert.equal(a[c].length,b[c].length);for(let i=0;i<a[c].length;i++)if(!Object.is(Math.fround(a[c][i]),b[c][i]))assert.fail(`channel ${c} frame ${i}`);}};
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('the library build is reproducible and contains no app code',()=>{
 const again=path.join(tmp,'again');build(again);
 assert.equal(fs.readFileSync(path.join(again,'lib-manifest.json'),'utf8'),fs.readFileSync(path.join(lib,'lib-manifest.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(lib,'lib-manifest.json')));
 assert.ok(!Object.keys(manifest.files).some(f=>f.startsWith('studio/')||f.startsWith('app/')||f.endsWith('.html')));
 for(const [f,sha] of Object.entries(manifest.files))assert.equal(execFileSync('sha256sum',[path.join(lib,f)],{encoding:'utf8'}).split(' ')[0],sha,f);
});

test('package exports resolve and the built package renders exactly like the repository',async()=>{
 const probe=path.join(tmp,'probe.mjs');
 fs.writeFileSync(probe,`import * as synth from '@mnx-lab/synth';import {render} from '@mnx-lab/synth/node';import {runFixture} from '@mnx-lab/synth/conformance';
  import fixture from '@mnx-lab/synth/fixtures/multi-part-mix.json' with {type:'json'};export {synth,render,runFixture,fixture};
  export const resolved=import.meta.resolve('@mnx-lab/synth/node');`);
 const {synth,render,runFixture,fixture:packaged,resolved}=await import(pathToFileURL(probe).href);
 assert.equal(synth.CONTRACT,'mnx-sound/2');assert.ok(synth.InstrumentHost&&synth.renderOffline&&synth.makeRig&&synth.BLOCK_TYPES);
 assert.ok(resolved.startsWith(pathToFileURL(lib).href),`resolved inside the built package: ${resolved}`);
 const ours=render({setup:packaged.setup,batches:packaged.batches,rate:48000,seconds:packaged.render.seconds});
 same(hostRender({setup:fixture.setup,batches:fixture.batches,rate:48000,seconds:fixture.render.seconds}).audio,ours.audio);
 const result=await runFixture(packaged,{render});assert.ok(result.pass,JSON.stringify(result.results.filter(r=>!r.pass)));
});

test('the built package runs in an AudioWorklet (headless Chrome) bit-identically',{skip:process.env.PLAYWRIGHT_MODULE?false:'PLAYWRIGHT_MODULE not set'},async()=>{
 fs.writeFileSync(path.join(tmp,'index.html'),`<!doctype html><meta charset="utf-8"><script type="module">
import {InstrumentHost} from './node_modules/@mnx-lab/synth/host/index.js';
window.run=async({setup,batches,seconds})=>{const context=new OfflineAudioContext({numberOfChannels:2,length:Math.round(seconds*48000),sampleRate:48000});
 const host=(await InstrumentHost.create(context)).connect();await host.configure(setup);for(const b of batches){if(b.cancel)await host.cancel(b.cancel);await host.schedule(b);}
 const buffer=await context.startRendering();return [Array.from(buffer.getChannelData(0)),Array.from(buffer.getChannelData(1))];};window.ready=true;</script>`);
 const types={'.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.html':'text/html'};
 const server=http.createServer((req,res)=>{const file=path.join(tmp,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(tmp)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.ready);
  // Everything arrives before rendering starts: the all-at-once equivalent of the batches.
  const audio=await page.evaluate(a=>window.run(a),{setup:fixture.setup,batches:fixture.batches,seconds:fixture.render.seconds});
  same(audio,hostRender({setup:fixture.setup,batches:fixture.batches,rate:48000,seconds:fixture.render.seconds}).audio);assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
});

test('type declarations name exactly the runtime exports of every typed entry point',async()=>{
 const declared=file=>{const src=fs.readFileSync(ROOT+file,'utf8'),names=[...src.matchAll(/^export (?:const|function|class) (\w+)/gm)].map(m=>m[1]);
  for(const m of src.matchAll(/^export \* from '([^']+)'/gm))names.push(...declared(path.posix.join(path.posix.dirname(file),m[1]).replace(/\.js$/,'.d.ts')));return names;};
 for(const [dts,js] of [['web/host/index.d.ts','web/host/index.js'],['web/host/node.d.ts','web/host/node.js'],['web/contract/index.d.ts','web/contract/index.js']])
  assert.deepEqual([...new Set(declared(dts))].sort(),Object.keys(await import(pathToFileURL(ROOT+js).href)).sort(),dts);
});

test('the deployable app build is reproducible and ships only runtime files',()=>{
 const a=path.join(tmp,'app-a'),b=path.join(tmp,'app-b');
 for(const dir of [a,b])execFileSync('node',['scripts/build_app.mjs',dir],{cwd:ROOT,encoding:'utf8'});
 assert.equal(fs.readFileSync(path.join(a,'app-manifest.json'),'utf8'),fs.readFileSync(path.join(b,'app-manifest.json'),'utf8'));
 const files=Object.keys(JSON.parse(fs.readFileSync(path.join(a,'app-manifest.json'))).files);
 assert.deepEqual(files.filter(f=>f.endsWith('.html')).sort(),['index.html']);
 assert.ok(!files.some(f=>/instrument-model|dry-comparison|comparison|instrument-lab|check\.|studio\//.test(f)),'no research pages, research data or the removed studio');
 for(const need of ['app/main.js','app/check-worker.js','host/host-processor.js','generated/basic/keys.wasm','generated/blocks/room.wasm','data/instrument-v2/presets.json','contract/fixtures/kit-chokes.json'])assert.ok(files.includes(need),need);
});
