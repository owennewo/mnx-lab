// Performance budget for the instrument host. Run against scripts/serve.py.
// Workloads: every conformance fixture and the multi-part reference session. Measures Node offline, browser
// offline (headless Chrome, OfflineAudioContext + AudioWorklet) and a live
// AudioContext stress run with per-part metering. Minimums over repeated trials.
import fs from 'node:fs';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {renderOffline} from '../web/host/offline.js';
import {hostAssets} from '../web/host/node-assets.js';
import {INSTRUMENTS} from '../web/host/instruments/index.js';
import {HostCore} from '../web/host/host-core.js';
import {referenceSession} from '../web/host/workloads.js';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>JSON.parse(fs.readFileSync(p)),rate=48000,trials=Number(process.env.TRIALS||3);
const TARGETS={browserOffline:5,multiPartOffline:10,basicPartRatio:.25};

const workloads=[];
for(const name of fs.readdirSync('web/contract/fixtures').filter(f=>f.endsWith('.json')).sort()){
 const f=read(`web/contract/fixtures/${name}`);workloads.push({id:`fixture:${f.fixture.id}`,setup:f.setup,batches:f.batches??[{notes:f.notes,controls:f.controls??[]}],seconds:f.render.seconds});
}
const session=referenceSession(read('web/data/material/guitar-takes.json'),{guitarDesign:'rounded-steel'});
workloads.push({id:'multi-part-reference-session',setup:session.setup,batches:[{notes:session.notes,controls:session.controls}],seconds:session.seconds,multiPart:true});

const nodeOffline=w=>{let best=Infinity;for(let i=0;i<trials;i++){const t=performance.now();renderOffline({setup:w.setup,batches:w.batches,rate,seconds:w.seconds,instruments:INSTRUMENTS,assets:hostAssets()});best=Math.min(best,performance.now()-t);}return w.seconds*1000/best;};
const perPart=w=>{const host=new HostCore({rate,block:128,instruments:INSTRUMENTS,assets:hostAssets()});host.configure(w.setup);for(const b of w.batches)host.schedule(b);host.profile(true);
 const frames=Math.round(w.seconds*rate);while(host.position<frames)host.render(Math.min(128,frames-host.position));return host.profileSnapshot();};

const report={date:new Date().toISOString(),machine:{cpu:os.cpus()[0]?.model,cores:os.cpus().length,platform:`${os.platform()} ${os.release()}`,node:process.version},
 build:{commit:execSync('git rev-parse --short HEAD').toString().trim(),dirty:execSync('git status --porcelain').toString().trim().length>0,
  assets:Object.fromEntries(['blocks/build.json','basic/build.json'].map(p=>[p,read(`web/generated/${p}`)])),guitarWasm:read('web/generated/instrument-v2/guitar.json').candidateWasmSha256},
 targets:TARGETS,trials,workloads:{}};
for(const w of workloads){report.workloads[w.id]={audioSeconds:w.seconds,nodeOfflineRtfx:nodeOffline(w)};process.stdout.write('.');}
report.perPart=perPart(workloads.at(-1));

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--autoplay-policy=no-user-gesture-required']});
report.machine.browser=`Chromium ${browser.version()} (headless)`;
// A fresh page per measurement: WASM memories of finished contexts are reclaimed late.
const inPage=async(fn,arg)=>{const page=await browser.newPage();try{await page.goto((process.env.STUDIO_URL||'http://localhost:8080')+'/host/host-check.html');await page.waitForFunction(()=>window.hostCheckReady);return await page.evaluate(fn,arg);}finally{await page.close();}};
for(const w of workloads){let best=Infinity;for(let i=0;i<trials;i++){const r=await inPage(a=>window.renderInWorklet(a),{setup:w.setup,batches:w.batches,deliverAt:[],seconds:w.seconds,rate,timingOnly:true});best=Math.min(best,r.renderMs);}
 report.workloads[w.id].browserOfflineRtfx=w.seconds*1000/best;process.stdout.write('.');}
report.live=await inPage(a=>window.liveProfile(a),{setup:session.setup,notes:session.notes,controls:session.controls,seconds:session.seconds,rate});
await browser.close();

const checks={
 browserOffline:Object.values(report.workloads).every(w=>w.browserOfflineRtfx>=TARGETS.browserOffline),
 multiPart:report.workloads['multi-part-reference-session'].browserOfflineRtfx>=TARGETS.multiPartOffline,
 basicParts:['keys','drums'].every(id=>report.perPart.parts[id].msPerAudioSecond<=TARGETS.basicPartRatio*report.perPart.parts.guitar.msPerAudioSecond)};
report.checks=checks;report.pass=Object.values(checks).every(Boolean);
const dir='output/host-benchmark';fs.mkdirSync(dir,{recursive:true});const file=`${dir}/${report.date.replace(/[:.]/g,'-')}.json`;fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log('\nworkload'.padEnd(36),'node×'.padStart(8),'browser×'.padStart(10));
for(const [id,w] of Object.entries(report.workloads))console.log(id.padEnd(35),w.nodeOfflineRtfx.toFixed(1).padStart(8),w.browserOfflineRtfx.toFixed(1).padStart(10));
console.log('per part ms/s',Object.entries(report.perPart.parts).map(([id,x])=>`${id} ${x.msPerAudioSecond.toFixed(1)}`).join(', '));
console.log('live',JSON.stringify({maximumMs:report.live?.maximumMs,budgetMs:report.live?.budgetMs,overBudget:report.live?.overBudget,blocks:report.live?.blocks,parts:Object.fromEntries(Object.entries(report.live?.parts??{}).map(([k,v])=>[k,+v.msPerAudioSecond.toFixed(1)]))}));
console.log('checks',JSON.stringify(checks),report.pass?'PASS':'FAIL','→',file);
process.exit(report.pass?0:1);
