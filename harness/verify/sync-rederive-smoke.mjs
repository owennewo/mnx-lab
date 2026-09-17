// Run after npm run build. Production Studio with a fixture LibraryClient and
// real PCM (the sync-bar smoke's recipe): a sync made when the score had three
// bars is opened on a score that now has six, and must FOLLOW all six — derived
// from its segments, not read from the stale tuples beside them — and the
// refreshed tuples are written back. An imported sync Studio has not seen is
// stamped with the score's shape; one stamped for other bars says so
// (roadmap/inprogress/studio-sync-rederive.md).
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bar=n=>({sequences:[{content:[{duration:{base:'whole'},notes:[{id:`n${n}`,pitch:{step:'E',octave:3}}]}]}]});
const score={mnx:{version:1},global:{measures:[{time:{count:4,unit:4}},{},{},{},{},{}]},parts:[{id:'guitar',name:'Guitar',measures:[1,2,3,4,5,6].map(bar)}]};
const hz=8000, seconds=30, pcm=Buffer.alloc(44+hz*seconds*2);
pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(hz,24);pcm.writeUInt32LE(hz*2,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(hz*seconds*2,40);
for(let i=0;i<hz*seconds;i++)pcm.writeInt16LE(Math.round(500*Math.sin(i*2*Math.PI*220/hz)),44+i*2);
const audio=http.createServer((req,res)=>{
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??''),start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),pcm.length-1):pcm.length-1;
 res.writeHead(match?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${pcm.length}`}:{})});res.end(pcm.subarray(start,end+1));
});
await new Promise(r=>audio.listen(0,'127.0.0.1',r));
const server=await serveStatic(root+'dist/client'),profile=fs.mkdtempSync('/tmp/sync-rederive-');
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required','--window-size=1280,800','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
// One open segment from 1 s at 120 bpm: two seconds a bar. Its stored tuples stop at the third bar.
const segments={version:1,beat:[1,4],cuts:[1],closed:false,segments:[{name:'Segment 1',beats:null,bpm:120}]};
const staleTuples=[[0,1],[1,3],[2,5],[3,7]];
const importedTuples=[[0,0],[1,2],[2,4],[3,6],[4,8],[5,10],[6,12]];
let ws;
try {
 ws=new WebSocket(await connect(await devtoolsPort(profile)));await new Promise(r=>ws.addEventListener('open',r));const c=client(ws);
 await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:820,deviceScaleFactor:1,mobile:false});
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`const realFetch=window.fetch;window.fetch=(...args)=>String(args[0]).includes('/api/')?Promise.resolve(new Response('{}',{status:401})):realFetch(...args);`});
 await c.send('Page.navigate',{url:`http://127.0.0.1:${server.port}/studio/`});
 for(let i=0;i<80;i++){if(await c.evaluate(`!!customElements.get('mnx-studio-piece')`))break;await new Promise(r=>setTimeout(r,100));}
 const result=await c.evaluate(`(async()=>{
   const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
   const until=async(fn,m)=>{for(let i=0;i<120;i++){if(fn())return;await delay(50);}throw new Error(m);};
   document.body.replaceChildren();document.body.style.margin='0';const page=document.createElement('mnx-studio-piece');page.style.height='800px';page.style.display='block';
   const none={selectedId:null,crop_start:null,crop_end:null,cropped_duration:null};
   const rows=[
     {id:'studio-00000000-0000-4000-8000-000000000001',kind:'audio',name:'Studio take',syncpoints:${JSON.stringify(JSON.stringify(staleTuples))},provenance:JSON.stringify({format:'studio-sync-segments',raw:${JSON.stringify(segments)},...none})},
     {id:'studio-00000000-0000-4000-8000-000000000002',kind:'audio',name:'Imported, never opened',syncpoints:${JSON.stringify(JSON.stringify(importedTuples))},provenance:JSON.stringify({format:'soundslice-sync-array',raw:${JSON.stringify(importedTuples)},...none})},
     {id:'studio-00000000-0000-4000-8000-000000000003',kind:'audio',name:'Imported, other bars',syncpoints:${JSON.stringify(JSON.stringify(importedTuples))},provenance:JSON.stringify({format:'soundslice-sync-array',raw:${JSON.stringify(importedTuples)},...none,scoreShape:'4x1/1'})}];
   let revision=0;const saves=[];
   const snapshot=()=>({piece:{id:'first',revision},tags:[],recordings:rows.map(r=>({...r}))});
   page.client={canonical:async()=>({bytes:new TextEncoder().encode(${JSON.stringify(JSON.stringify(score))}),filename:'fixture.mnx.json'}),piece:async()=>({snapshot:snapshot()}),opened:async()=>{},
     recordingUrl:()=>${JSON.stringify(`http://127.0.0.1:${audio.address().port}/audio.wav`)},
     saveRecording:async(piece,id,expected,change)=>{check(expected===revision,'stale revision sent: '+expected+' at '+revision);saves.push({id,change});revision++;const row=rows.find(r=>r.id===id);
       if(change.rawSync!==undefined){row.syncpoints=change.rawSync.syncpoints===null?null:JSON.stringify(change.rawSync.syncpoints);row.provenance=JSON.stringify({format:change.rawSync.format,raw:change.rawSync.segments,...none});}
       if(change.scoreShape!==undefined)row.provenance=JSON.stringify({...JSON.parse(row.provenance),scoreShape:change.scoreShape});
       return {snapshot:snapshot()};}};
   page.pieceId='first';document.body.append(page);
   await until(()=>page.shadowRoot?.querySelector('mnx-player')?.performance,'no performance');
   const player=page.shadowRoot.querySelector('mnx-player');
   // First sight of an imported sync: stamped with the score's shape, once; the stamped one and the Studio one are left alone.
   await until(()=>saves.length===1,'the unstamped imported sync was not stamped');
   await delay(400);
   check(saves.length===1&&saves[0].id===rows[1].id&&saves[0].change.scoreShape==='6x1/1'&&saves[0].change.rawSync===undefined,'wrong stamp: '+JSON.stringify(saves));
   check(JSON.parse(rows[1].syncpoints).length===7,'the stamp touched the sync');
   // The Studio sync: stored tuples stop at bar 3, the score has six. It plays by its segments.
   check(await player.selectSource(rows[0].id)!==undefined,'source');
   await until(()=>player.sourceId===rows[0].id&&player.playback.mediaDuration>0,'audio did not prepare');
   await until(()=>saves.length===2,'the refreshed tuples were not written back: '+JSON.stringify(saves.map(s=>s.id)));
   const refreshed=saves[1];
   check(refreshed.id===rows[0].id&&refreshed.change.rawSync.format==='studio-sync-segments'&&JSON.stringify(refreshed.change.rawSync.segments)===${JSON.stringify(JSON.stringify(segments))},'the write-back changed the segments');
   check(JSON.stringify(refreshed.change.rawSync.syncpoints)===JSON.stringify([[0,1],[1,3],[2,5],[3,7],[4,9],[5,11],[6,13]]),'not one point per bar of the score as it is now: '+JSON.stringify(refreshed.change.rawSync.syncpoints));
   check(!player.playback.syncIssue&&!player.playback.alignmentIssue,'sync issue: '+(player.playback.syncIssue||player.playback.alignmentIssue));
   // What PLAYS is anchored to the end of bar 6 at 13 s; the stale tuples stopped at 7 s.
   await until(()=>player.playback.mediaBounds?.endSeconds===13,'the playing map is not the derived one: '+JSON.stringify(player.playback.mediaBounds));
   await delay(600);
   check(saves.length===2,'the echo of the write-back caused another write: '+saves.length);
   check(player.sourceId===rows[0].id,'the echo re-cued the source');
   // The Source sheet says which imported sync to distrust.
   [...page.shadowRoot.querySelectorAll('button[slot=actions]')].find(b=>b.textContent.includes('Source')).click();
   await until(()=>page.shadowRoot.querySelector('mnx-studio-source')?.shadowRoot?.querySelectorAll('.source').length===4,'no Source sheet');
   const sheet=page.shadowRoot.querySelector('mnx-studio-source').shadowRoot;
   const sub=name=>[...sheet.querySelectorAll('.source')].find(s=>s.textContent.includes(name)).querySelector('.sub').textContent;
   check(sub('Studio take').includes('follows the whole score'),'Studio take: '+sub('Studio take'));
   check(sub('Imported, never opened').includes('follows the whole score'),'never opened: '+sub('Imported, never opened'));
   check(sub('Imported, other bars').includes('may be out of date'),'other bars: '+sub('Imported, other bars'));
   await player.selectSource(rows[2].id);
   await until(()=>!!sheet.querySelector('[data-out-of-date]'),'no out-of-date explanation for the playing recording');
   player.pause();
   return {saves:saves.length,points:refreshed.change.rawSync.syncpoints.length};
 })()`);
 if(process.env.SYNC_REDERIVE_SHOT){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.SYNC_REDERIVE_SHOT,Buffer.from(shot.result.data,'base64'));}
 console.log('sync rederive OK',JSON.stringify(result));
 if(c.logs.length)throw new Error(c.logs.join('\n'));
} finally {ws?.close();chrome.kill();server.server.close();audio.close();}
