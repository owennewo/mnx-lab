// Instrument host in a real AudioWorklet (headless Chrome, OfflineAudioContext) must
// render bit-identically to renderOffline in Node, with batches streamed into the
// running worklet. Run against `npm start`; isolated profile; set PLAYWRIGHT_MODULE /
// CHROME_PATH as for tests/studio-browser.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {renderOffline} from '../web/host/offline.js';
import {hostAssets} from '../web/host/node-assets.js';
import {INSTRUMENTS} from '../web/host/instruments/index.js';
import {CONTRACT} from '../web/contract/index.js';
const specifier=process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright';
const {chromium}=await import(specifier);
const base=(process.env.STUDIO_URL||'http://localhost:8080').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await (await browser.newContext()).newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const failures=[];const step=async(name,fn)=>{try{await fn();console.log('ok  ',name);}catch(e){failures.push(name);console.log('FAIL',name,'—',e.message.split('\n')[0]);}};
await page.goto(base+'/host/host-check.html');await page.waitForFunction(()=>window.hostCheckReady);

const rate=48000,seconds=6,effects={enabled:true,driveOn:true,vibratoOn:false,tremoloOn:true,echoOn:true,drive:6,driveMix:.3,tone:6000,vibratoRate:4,tremoloRate:3,vibrato:0,vibratoMix:0,tremolo:.25,echoMix:.3,division:.5,feedback:.4,echoTone:5000,pingPong:true};
const setup={contract:CONTRACT,session:{},
 parts:[{id:'a',instrument:{kind:'test-tone',design:'x'},inserts:effects,send:.7,pan:-.4},{id:'b',instrument:{kind:'test-tone',design:'x'},send:.2,levelDb:-3,pan:.3},{id:'c',instrument:{kind:'theremin',design:'x'}}]};
const notes=[];let at=.05;for(let i=0;i<70;i++){at+=.03+((i*7919)%13)/150;notes.push({id:`n${i}`,part:i%3?'a':'b',at:Math.round(at*rate)/rate,duration:.05+((i*31)%9)/20,velocity:.4+((i*17)%5)/10,target:{pitch:45+(i*11)%30},
 ...(i%5===0?{techniques:[{type:'vibrato',depthCents:25,rateHz:5}]}:i%7===0?{techniques:[{type:'bend',points:[{at:0,cents:-100},{at:.3,cents:0}]}]}:{})});}
const node=opts=>renderOffline({setup,rate,seconds,instruments:INSTRUMENTS,assets:hostAssets(),...opts});
const compare=(browserOut,nodeOut,label)=>{
 assert.equal(browserOut.L.length,nodeOut.frames,label+' length');
 for(const [c,key] of [[0,'L'],[1,'R']])for(let i=0;i<nodeOut.frames;i++)if(!Object.is(Math.fround(browserOut[key][i]),nodeOut.audio[c][i]))throw Error(`${label}: channel ${c} frame ${i}: ${browserOut[key][i]} vs ${nodeOut.audio[c][i]}`);
};
const reference=node({notes});
assert.ok(reference.audio[0].some(x=>Math.abs(x)>.01));

await step('worklet all-at-once render is bit-identical to Node renderOffline',async()=>{
 const out=await page.evaluate(a=>window.renderInWorklet(a),{setup,batches:[{notes}],deliverAt:[],seconds,rate});
 compare(out,reference,'all at once');
 assert.deepEqual(out.diagnostics.map(d=>d.code).filter(c=>c!=='approximated'),['unsupported-kind']);
 assert.equal(out.sounding,notes.length);
});

await step('worklet with streamed batches (suspend/resume) is bit-identical to all at once',async()=>{
 const horizon=.05,batches=[];for(let t=0;t<seconds;t+=.75)batches.push({through:t+.75,notes:notes.filter(n=>n.at>=t&&n.at<t+.75)});
 // Deliver each batch on the render quantum at or before through − horizon.
 const deliverAt=batches.slice(0,-1).map(b=>Math.floor((b.through-horizon)*rate/128)*128/rate);
 const out=await page.evaluate(a=>window.renderInWorklet(a),{setup,batches,deliverAt,seconds,rate});
 compare(out,reference,'streamed');
});

await step('worklet seek (cancel + reschedule) equals Node',async()=>{
 const batches=[{through:3,notes:notes.filter(n=>n.at<3.2)},{through:seconds,cancel:{from:3},notes:notes.filter(n=>n.at>=3).map(n=>({...n,id:'s'+n.id,target:{pitch:n.target.pitch+5}}))}];
 const out=await page.evaluate(a=>window.renderInWorklet(a),{setup,batches,deliverAt:[Math.floor((3-.05)*rate/128)*128/rate],seconds,rate});
 compare(out,node({batches}),'seek');
});

await step('plucked technique study in the worklet (streamed batches) equals Node',async()=>{
 const f=JSON.parse(fs.readFileSync('web/contract/fixtures/plucked-techniques.json')),seconds=19,batches=[];
 for(let t=0;t<seconds;t+=1)batches.push({through:t+1,notes:f.notes.filter(n=>n.at>=t&&n.at<t+1)});
 const deliverAt=batches.slice(0,-1).map(b=>Math.floor((b.through-.1)*rate/128)*128/rate);
 const out=await page.evaluate(a=>window.renderInWorklet(a),{setup:f.setup,batches,deliverAt,seconds,rate});
 compare(out,renderOffline({setup:f.setup,notes:f.notes,rate,seconds,instruments:INSTRUMENTS,assets:hostAssets()}),'plucked');
});

await step('multi-part mix (plucked + keys + kit, batches with upsert and cancel) in the worklet equals Node',async()=>{
 const f=JSON.parse(fs.readFileSync('web/contract/fixtures/multi-part-mix.json')),seconds=f.render.seconds;
 const deliverAt=f.batches.slice(0,-1).map(b=>Math.floor((b.through-.1)*rate/128)*128/rate);
 const out=await page.evaluate(a=>window.renderInWorklet(a),{setup:f.setup,batches:f.batches,deliverAt,seconds,rate});
 compare(out,renderOffline({setup:f.setup,batches:f.batches,rate,seconds,instruments:INSTRUMENTS,assets:hostAssets()}),'multi-part');
 assert.deepEqual(out.diagnostics.filter(d=>d.severity!=='info'),[]);
});

await browser.close();
if(errors.length)console.log('Page errors:',errors);
if(failures.length||errors.length){console.log(`${failures.length} host browser step(s) failed`);process.exit(1);}
console.log('Host worklet: all steps passed');
