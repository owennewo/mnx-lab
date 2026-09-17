// Run after npm run build. Production Studio with a fixture LibraryClient and
// real PCM: the tray's sync bar makes a sync from nothing, the score follows it
// without the source being re-cued, and the save carries segments plus one
// point per bar (roadmap/inprogress/studio-sync-bar.md).
// SYNC_BAR_SHOT=<path.png> also writes a screenshot of the zoomed bar.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
// Six bars: 4/4, with bar 4 in 2/4 — 22 beats.
const bar=(n,base)=>({sequences:[{content:[{duration:{base},notes:[{id:`n${n}`,pitch:{step:'E',octave:3}}]}]}]});
const score={mnx:{version:1},global:{measures:[{time:{count:4,unit:4}},{},{},{time:{count:2,unit:4}},{time:{count:4,unit:4}},{}]},
 parts:[{id:'guitar',name:'Guitar',measures:[bar(1,'whole'),bar(2,'whole'),bar(3,'whole'),bar(4,'half'),bar(5,'whole'),bar(6,'whole')]}]};
const hz=8000, seconds=30, pcm=Buffer.alloc(44+hz*seconds*2);
pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(hz,24);pcm.writeUInt32LE(hz*2,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(pcm.length-44,40);
for(let i=0;i<hz*seconds;i++)pcm.writeInt16LE(Math.round(500*Math.sin(i*2*Math.PI*220/hz)),44+i*2);
const audio=http.createServer((req,res)=>{
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??''),start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),pcm.length-1):pcm.length-1;
 res.writeHead(match?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${pcm.length}`}:{})});res.end(pcm.subarray(start,end+1));
});
await new Promise(r=>audio.listen(0,'127.0.0.1',r));
const server=await serveStatic(root+'dist/client'),profile=fs.mkdtempSync('/tmp/sync-bar-');
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required','--window-size=1280,800','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
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
   const until=async(fn,m)=>{for(let i=0;i<100;i++){if(fn())return;await delay(50);}throw new Error(m);};
   document.body.replaceChildren();document.body.style.margin='0';const page=document.createElement('mnx-studio-piece');page.style.height='800px';page.style.display='block';
   const row={id:'studio-00000000-0000-4000-8000-000000000001',kind:'audio',name:'Studio take',syncpoints:null,provenance:null};
   let revision=0;const saves=[];
   const snapshot=()=>({piece:{id:'first',revision},tags:[],recordings:[{...row}]});
   page.client={canonical:async()=>({bytes:new TextEncoder().encode(${JSON.stringify(JSON.stringify(score))}),filename:'fixture.mnx.json'}),piece:async()=>({snapshot:snapshot()}),opened:async()=>{},
     recordingUrl:()=>${JSON.stringify(`http://127.0.0.1:${audio.address().port}/audio.wav`)},
     saveRecording:async(piece,id,expected,change)=>{check(expected===revision,'stale revision sent');saves.push(change);revision++;row.syncpoints=change.rawSync.syncpoints===null?null:JSON.stringify(change.rawSync.syncpoints);row.provenance=JSON.stringify({format:change.rawSync.format,raw:change.rawSync.segments});return {snapshot:snapshot()};}};
   page.pieceId='first';document.body.append(page);
   await until(()=>page.shadowRoot?.querySelector('mnx-player')?.performance,'no performance');
   const player=page.shadowRoot.querySelector('mnx-player'),root=player.shadowRoot;
   check(!root.querySelector('.bar-toggle'),'The toggle showed for the synth');
   check(await player.selectSource(row.id)!==undefined,'source');await until(()=>player.sourceId===row.id&&player.playback.mediaDuration>0,'audio did not prepare');
   await player.updateComplete;const toggle=root.querySelector('.bar-toggle');check(toggle,'No rail/sync toggle for a recording');
   toggle.querySelector('button[aria-label^="Sync bar"]').click();await player.updateComplete;
   const bar=root.querySelector('mnx-sync-bar');check(bar&&!root.querySelector('.rail'),'Sync bar did not replace the rail');
   await bar.updateComplete;const sr=bar.shadowRoot;
   check(bar.getBoundingClientRect().height<=44,'Sync bar is taller than the rail slot: '+bar.getBoundingClientRect().height);
   check(sr.querySelectorAll('.cut.parked').length===2&&sr.querySelector('.lab').textContent==='Unsynced','Handles not parked on an unsynced bar');
   check(root.querySelector('output').textContent.trim().startsWith('0:0'),'Readout did not switch to recording time');
   const seekTo=async s=>{const t=sr.querySelector('.track').getBoundingClientRect();sr.querySelector('.track').dispatchEvent(new MouseEvent('click',{clientX:t.left+t.width*s/bar.duration,bubbles:true,composed:true}));await until(()=>Math.abs(player.playback.mediaTime-s)<.05,'media seek to '+s);await player.updateComplete;await bar.updateComplete;await until(()=>Math.abs(bar.time-s)<.05,'bar time '+s);};
   const press=async label=>{const b=[...sr.querySelectorAll('.pop button')].find(x=>x.textContent.trim().startsWith(label)||x.getAttribute('aria-label')===label);check(b,'No '+label+' control');b.click();await bar.updateComplete;};
   // Start handle at 1 s: the left is unsynced. End handle at 25 s: the right is unsynced.
   await seekTo(1);sr.querySelector('.cut.parked').click();await bar.updateComplete;await press('To playhead');
   check(Math.abs(bar.segments.cuts[0]-1)<.05&&!bar.segments.closed,'Start handle not placed at the playhead: '+JSON.stringify(bar.segments));
   sr.querySelector('button.cut').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));await bar.updateComplete;
   check([...sr.querySelectorAll('.lab')].map(l=>l.textContent).join('|')==='Pre-roll|Segment 1','Left of the start handle is not pre-roll');
   await seekTo(25);sr.querySelector('.cut.parked').click();await bar.updateComplete;await press('To playhead');
   check(bar.segments.closed&&Math.abs(bar.segments.cuts[1]-25)<.05,'End handle not placed');const [a,z]=bar.segments.cuts;
   sr.querySelector('.bar').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));await bar.updateComplete;
   check([...sr.querySelectorAll('.lab')].map(l=>l.textContent).join('|')==='Pre-roll|Segment 1|Post-roll','Right of the end handle is not post-roll');
   // Tempo by tapping, then the whole count by stepping: 24 s at 55 bpm is 22 beats.
   sr.querySelector('button.lab').click();await bar.updateComplete;
   for(let i=0;i<4;i++){await press('Tap');await delay(500);}
   check(bar.segments.segments[0].beats>40,'Tapping set no tempo');
   while(bar.segments.segments[0].beats>22)await press('One beat fewer');
   check(bar.segments.segments[0].beats===22,'Count did not step to 22');
   // The score follows the new sync in place.
   await seekTo(15);await until(()=>player.playback.scorePosition,'Score did not follow the authored sync');
   check(player.playback.scorePosition.ordinal===3,'Bar 4 (2/4) is not where its beats put it: '+player.playback.scorePosition.ordinal);
   await player.play();await until(()=>player.playback.state==='playing','did not play');
   // A split lands on the nearest beat and costs no timing.
   player.pause();await seekTo(13.2);await press('Split at playhead');
   check(bar.segments.cuts.length===3&&Math.abs(bar.segments.cuts[1]-(a+11*(z-a)/22))<1e-3,'Split did not snap to beat 11: '+bar.segments.cuts[1]);
   check(bar.segments.segments.map(s=>s.beats).join()==='11,11','Split did not divide the count');
   const name=sr.querySelector('.pop input');name.value='Verse';name.dispatchEvent(new Event('change'));await bar.updateComplete;
   check(bar.segments.segments[1].name==='Verse','Rename did not land');
   await player.play();
   // Selecting a cut zooms to it; a nudge moves it 10 ms and keeps both counts.
   const cuts=sr.querySelectorAll('button.cut');cuts[1].click();await bar.updateComplete;
   check(sr.querySelector('.mini')&&sr.querySelectorAll('.tick').length>10,'Selecting a cut did not zoom to the beats');
   const before=bar.segments.cuts[1];await press('Nudge 10 milliseconds');
   check(Math.abs(bar.segments.cuts[1]-before-.01)<1e-6&&bar.segments.segments.map(s=>s.beats).join()==='11,11','Nudge');
   root.querySelector('button[aria-label="Click on the beats"]').click();await player.updateComplete;
   // The debounced save, and its echo through the snapshot, must not re-cue the source.
   await delay(1100);await page.updateComplete;await player.updateComplete;await delay(100);
   check(saves.length>=1,'Nothing was saved');const last=saves.at(-1).rawSync;
   check(last.format==='studio-sync-segments'&&last.segments.cuts.length===3,'Save did not carry the segments');
   check(last.syncpoints.length===7&&last.syncpoints.every((p,i)=>p[0]===i)&&last.syncpoints[0][1]===a&&last.syncpoints[6][1]===z,'Save did not carry one point per bar: '+JSON.stringify(last.syncpoints));
   check(player.sourceId===row.id&&player.playback.state==='playing','The save echo re-cued the source');
   check(player.recordings[0].syncSegments.cuts.length===3,'Stored segments did not come back to the player');
   check(root.querySelector('button[aria-label="Click on the beats"]').getAttribute('aria-pressed')==='true','Click toggle');
   player.pause();await delay(150);
   // The zoomed window moves: by its minimap, by two fingers (a wheel), and after the playhead when it is sought away.
   const mini=()=>sr.querySelector('.mini'),thumbAt=()=>parseFloat(sr.querySelector('.mini i').style.left);
   check(mini().getBoundingClientRect().height>=12,'The minimap is too thin to catch: '+mini().getBoundingClientRect().height);
   const pointer=(type,x,id=7)=>mini().dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:mini().getBoundingClientRect().top+6,button:0,bubbles:true,composed:true}));
   const box=mini().getBoundingClientRect(),start=thumbAt(),grab=box.left+box.width*(start+5)/100;
   pointer('pointerdown',grab);pointer('pointermove',grab+box.width*.2);pointer('pointerup',grab+box.width*.2);await bar.updateComplete;
   check(Math.abs(thumbAt()-start-20)<1,'Dragging the minimap did not move the window: '+start+' → '+thumbAt());
   const dragged=thumbAt(),held=bar.time;await delay(300);
   check(thumbAt()===dragged&&bar.time===held,'A window moved by hand did not stay where it was put');
   const wheel=new WheelEvent('wheel',{deltaX:-sr.querySelector('.track').getBoundingClientRect().width/4,bubbles:true,composed:true,cancelable:true});
   sr.querySelector('.track').dispatchEvent(wheel);await bar.updateComplete;
   check(wheel.defaultPrevented&&thumbAt()<dragged-1,'A horizontal wheel did not pan the window: '+dragged+' → '+thumbAt());
   const vertical=new WheelEvent('wheel',{deltaY:40,bubbles:true,composed:true,cancelable:true});sr.querySelector('.track').dispatchEvent(vertical);
   check(!vertical.defaultPrevented,'A vertical wheel over the bar was taken from the page');
   // A seek made elsewhere (the video's own scrubber) brings the window to the sound.
   const far=thumbAt()<25?26:2;
   bar.time=far;await bar.updateComplete;
   const shownFrom=thumbAt()/100*bar.duration;
   check(far>=shownFrom-.01&&far<=shownFrom+16.01,'The window did not follow the playhead to '+far+' (shows '+shownFrom.toFixed(1)+'…)');
   // A pinch changes the scale (a trackpad's arrives as Ctrl+wheel): out far enough is the whole recording, and back.
   const thumbWide=()=>parseFloat(sr.querySelector('.mini i')?.style.width??'100'),track=()=>sr.querySelector('.track');
   const pinch=async dy=>{const t=track().getBoundingClientRect(),e=new WheelEvent('wheel',{deltaY:dy,ctrlKey:true,clientX:t.left+t.width/2,clientY:t.top+4,bubbles:true,composed:true,cancelable:true});track().dispatchEvent(e);await bar.updateComplete;return e;};
   const narrow=thumbWide();check((await pinch(30)).defaultPrevented&&thumbWide()>narrow+5,'Pinching out did not widen the window: '+narrow+' → '+thumbWide());
   await pinch(400);check(!sr.querySelector('.mini'),'Pinched all the way out, the bar is not the whole recording');
   await pinch(-120);check(sr.querySelector('.mini')&&thumbWide()<60,'Pinching back in did not zoom: '+thumbWide());
   // A drag is the bar's, not the handle's: it ends when the pointer comes up anywhere, and a hover never moves a cut.
   const cut=()=>sr.querySelectorAll('button.cut')[1]??sr.querySelector('button.cut'),barEl=sr.querySelector('.bar');
   const at=()=>cut().getBoundingClientRect().left+8,y=barEl.getBoundingClientRect().top+20;
   const fire=(el,type,x,extra={})=>el.dispatchEvent(new PointerEvent(type,{pointerId:11,pointerType:'mouse',button:0,buttons:1,clientX:x,clientY:y,bubbles:true,composed:true,...extra}));
   const x0=at(),cutsBefore=bar.segments.cuts.slice();
   const cutsNow=()=>JSON.stringify(bar.segments.cuts);
   fire(cut(),'pointerdown',x0);fire(barEl,'pointermove',x0+30);fire(barEl,'pointermove',x0+40);await bar.updateComplete;
   check(cutsNow()!==JSON.stringify(cutsBefore),'Dragging a cut did not move it');
   fire(track(),'pointerup',x0+40,{buttons:0});await bar.updateComplete;const dropped=cutsNow();
   fire(barEl,'pointermove',x0+90,{buttons:0});fire(barEl,'pointermove',x0-60,{buttons:0});await bar.updateComplete;
   check(cutsNow()===dropped,'Hovering after a drag moved the cut again');
   // …and a pointerup that never arrives does not leave the drag armed.
   fire(cut(),'pointerdown',at());fire(barEl,'pointermove',at()+20);await bar.updateComplete;const lost=cutsNow();
   fire(barEl,'pointermove',at()+80,{buttons:0});fire(barEl,'pointermove',at()+120,{buttons:0});await bar.updateComplete;
   check(cutsNow()===lost,'A drag whose pointerup was lost kept following the hover');
   return {saves:saves.length,points:last.syncpoints.length};
 })()`);
 if(process.env.SYNC_BAR_SHOT){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.SYNC_BAR_SHOT,Buffer.from(shot.result.data,'base64'));}
 console.log('sync bar OK',JSON.stringify(result));
 if(c.logs.length)throw new Error(c.logs.join('\n'));
} finally {ws?.close();chrome.kill();server.server.close();audio.close();}
