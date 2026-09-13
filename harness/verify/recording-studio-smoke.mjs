// Run after npm run build. Production Studio with a fixture LibraryClient and
// seekable HTTP PCM; authorization and R2 behavior are covered by library-access.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=JSON.parse(fs.readFileSync(root+'scenarios/lab/20-tab-part/01-standard-tuning-both/document.mnx.json'));
const hz=8000, pcm=Buffer.alloc(44+hz*30*2);
pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(hz,24);pcm.writeUInt32LE(hz*2,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(pcm.length-44,40);
for(let i=0;i<hz*30;i++)pcm.writeInt16LE(Math.round(500*Math.sin(i*2*Math.PI*220/hz)),44+i*2);
let ranges=0;
const audio=http.createServer((req,res)=>{
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??''),start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),pcm.length-1):pcm.length-1;
 if(match)ranges++;
 res.writeHead(match?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${pcm.length}`}:{})});res.end(pcm.subarray(start,end+1));
});
await new Promise(r=>audio.listen(0,'127.0.0.1',r));
const server=await serveStatic(root+'dist/client'),profile=fs.mkdtempSync('/tmp/recording-studio-');
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
 ws=new WebSocket(await connect(await devtoolsPort(profile)));await new Promise(r=>ws.addEventListener('open',r));const c=client(ws);
 await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`const realFetch=window.fetch;window.fetch=(...args)=>String(args[0]).includes('/api/')?Promise.resolve(new Response('{}',{status:401})):realFetch(...args);`});
 await c.send('Page.navigate',{url:`http://127.0.0.1:${server.port}/studio/`});
 for(let i=0;i<80;i++){if(await c.evaluate(`!!customElements.get('mnx-studio-piece')`))break;await new Promise(r=>setTimeout(r,100));}
 const result=await c.evaluate(`(async()=>{
   const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
   document.body.replaceChildren();const page=document.createElement('mnx-studio-piece');page.style.height='800px';
   const score=${JSON.stringify(fixture)};score.global.measures[0].repeatStart={};score.global.measures.at(-1).repeatEnd={};
   let gate;page.client={canonical:async id=>{if(id==='next')await new Promise(r=>gate=r);return {bytes:new TextEncoder().encode(JSON.stringify(score)),filename:'fixture.mnx.json'};},piece:async id=>({snapshot:{piece:{id,revision:0},tags:[],recordings:[{id:'audio',kind:'audio',name:'Studio take',syncpoints:JSON.stringify([[0,1],[1,6],[2,11]])},{id:'youtube',kind:'youtube',name:'Linked video',external_id:'M7lc1UVf-VE',syncpoints:'[[0,1],[1,6],[2,11]]'}]}}),opened:async()=>{},recordingUrl:()=>${JSON.stringify(`http://127.0.0.1:${audio.address().port}/audio.wav`)}};
   page.pieceId='first';document.body.append(page);
   for(let i=0;i<100&&!page.shadowRoot?.querySelector('mnx-player')?.performance;i++)await delay(50);
   const player=page.shadowRoot.querySelector('mnx-player'),viewer=page.shadowRoot.querySelector('mnx-document-viewer');
   check(player.recordings.length===2&&player.recordings[0].name==='Studio take','Studio did not pass audio rows to player');
   check(player.recordings[1].kind==='youtube'&&player.recordings[1].video==='M7lc1UVf-VE','Studio missed YouTube rows');
   check(await player.selectSource('audio'),'Studio source could not map');await player.play();await delay(150);
   check(player.playback.state==='playing'&&viewer.playbackState.highlight.length>0,'Studio media did not follow');
   const frame=page.shadowRoot.querySelector('mnx-score-frame');check(frame.shadowRoot.querySelector('.readout').textContent.includes('#'),'Frame did not read media position');
   await player.seekScorePosition({ordinal:1,metricOffset:{num:0n,den:1n}});check(Math.abs(player.playback.mediaTime-6)<.1,'HTTP audio could not seek');
   page.pieceId='next';await page.updateComplete;await delay(60);check(!player.playback||!player.playback.wantsPlayback,'Old piece played during loading');
   gate();await delay(250);check(player.documentId==='library:next'&&player.sourceId==='synth','New piece retained old source');page.remove();
   return {studioRows:true,httpSeek:true,frameReadout:true,navigationStops:true};
 })()`);
 assert.ok(ranges>0,'Browser did not request a byte range');console.log('recording Studio OK',JSON.stringify({...result,ranges}));
 if(c.logs.length)throw new Error(c.logs.join('\n'));
} finally {ws?.close();chrome.kill();server.server.close();audio.close();}
