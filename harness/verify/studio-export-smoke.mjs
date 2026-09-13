// Run after npm run build: node harness/verify/studio-export-smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root=fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const server=await serveStatic(root+'/dist/client');
const profile=fs.mkdtempSync('/tmp/studio-export-chrome-');
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-popup-blocking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
 const port=await devtoolsPort(profile); ws=new WebSocket(await connect(port));await new Promise(r=>ws.addEventListener('open',r));const c=client(ws);
 await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('mnx-studio.view','tab'); localStorage.setItem('mnx-studio.display',JSON.stringify({title:'hide',clefs:'hide',timeSignatures:'hide'})); const realFetch=window.fetch;window.fetch=(...args)=>String(args[0]).includes('/api/')?Promise.resolve(new Response('{}',{status:401})):realFetch(...args);`});
 await c.send('Page.navigate',{url:`http://127.0.0.1:${server.port}/studio/`});
 for(let i=0;i<80;i++){if(await c.evaluate(`!!customElements.get('mnx-studio-library')`))break; await new Promise(r=>setTimeout(r,250));}
 const fixture=JSON.parse(fs.readFileSync(root+'/scenarios/lab/20-tab-part/01-standard-tuning-both/document.mnx.json'));
 assert.equal(await c.evaluate(`(async()=>{document.body.replaceChildren();const page=document.createElement('mnx-studio-library'); window.testPage=page;window.testPiece={id:'test',title:'Export test',revision:1,chips:[],favourite:false,opened_at:null};page.client={facets:async()=>({total:1,facets:[]}),pieces:async()=>({pieces:[testPiece],next:null}),canonical:async()=>({bytes:new TextEncoder().encode(JSON.stringify(${JSON.stringify(fixture)})),filename:'test.mnx.json'})};document.body.append(page);await page.updateComplete;await new Promise(r=>setTimeout(r,100));return page.shadowRoot.textContent.includes('Actions');})()`),true);
 for (const theme of ['dark', 'light']) {
 await c.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
 await c.evaluate(`document.documentElement.style.colorScheme = '${theme}'`);
 for (const view of ['tab', 'notation', 'both']) {
 await c.evaluate(`localStorage.setItem('mnx-studio.view', '${view}')`);
 await c.evaluate(`(async()=>{const select=testPage.shadowRoot.querySelector('select');select.value='pdf';await testPage.exportPiece(testPiece,{target:select});if(testPage.error)throw new Error(testPage.error);return testPage.exportNotice;})()`);
 const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();const target=targets.find(t=>t.type==='page'&&t.url==='about:blank');
 const pw=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>pw.addEventListener('open',r));const p=client(pw);
 const result=await p.evaluate(`({pages:document.querySelectorAll('.page').length,frets:document.querySelectorAll('.fret-number').length,notes:document.querySelectorAll('.notehead').length,title:document.querySelectorAll('h1').length,text:document.querySelector('header').textContent})`);
 assert.ok(result.pages > 0);
 assert.equal(result.title,0);
 assert.equal(result.frets > 0, view !== 'notation');
 assert.equal(result.notes > 0, view !== 'tab');
 const ink = await p.evaluate(`({frets: [...document.querySelectorAll('.fret-number')].map(n => getComputedStyle(n).fill), masks: [...document.querySelectorAll('.fret-bg')].map(n => getComputedStyle(n).fill), notes: [...document.querySelectorAll('.notehead')].map(n => getComputedStyle(n).fill)})`);
 for (const fill of [...ink.frets, ...ink.notes]) assert.equal(fill, 'rgb(17, 17, 17)', `${theme} ${view}: dark print ink`);
 if (view !== 'notation') assert.ok(ink.masks.length > 0);
 for (const fill of ink.masks) assert.equal(fill, 'rgb(255, 255, 255)', `${theme} ${view}: white fret masks`);
 console.log(theme, view, result, ink);
 // A preview must still print after Vite reloads (or the user leaves) Studio.
 if (theme === 'light' && view === 'both') {
   await p.evaluate(`window.print = () => { document.body.dataset.printCalled = 'yes'; }`);
   await c.send('Page.navigate', {url: 'about:blank'});
   for (let attempt = 0; attempt < 40; attempt++) {
     if (await c.evaluate(`location.href === 'about:blank'`)) break;
     await new Promise(resolve => setTimeout(resolve, 50));
   }
   await p.evaluate(`document.querySelector('button').click()`);
   assert.equal(await p.evaluate(`document.body.dataset.printCalled`), 'yes', 'Print button survives opener navigation');
 }
 const pdf=await p.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});fs.writeFileSync(`/tmp/studio-export-${theme}-${view}.pdf`,Buffer.from(pdf.result.data,'base64'));
 const screenshot=await c.send('Page.captureScreenshot',{});fs.writeFileSync('/tmp/studio-export-library.png',Buffer.from(screenshot.result.data,'base64'));
 await p.send('Page.close'); pw.close();
 }
 }
}finally{ws?.close();chrome.kill();await new Promise(r=>chrome.once('exit',r));server.server.close();fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
