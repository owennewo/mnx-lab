import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mnx-player-workbench-'));
let chrome,ws,server,review;
try{
  server=await serveStatic('dist/client');review=await serveStatic('dist/review');
  chrome=spawn(process.env.CHROME_BIN??'google-chrome',['--headless=new','--remote-debugging-port=0','--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  ws=new WebSocket(await connect(await devtoolsPort(profile)));await new Promise(r=>ws.addEventListener('open',r,{once:true}));const cdp=client(ws);
  await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('mnx-lab.view','notation');"});
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.port}/workbench/#/scenario/spec/repeats-alternate-endings-simple?at=2`});
  let ready=false;for(let i=0;i<100;i++){ready=await cdp.evaluate(`!!document.querySelector('mnx-workbench')?.shadowRoot?.querySelector('mnx-scenario-page')?.shadowRoot?.querySelector('mnx-player')?.performance`);if(ready)break;await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw new Error('Workbench player did not load');
  console.log('workbench player',await cdp.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const page=document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page');
    const player=page.shadowRoot.querySelector('mnx-player'),viewer=page.shadowRoot.querySelector('mnx-document-viewer');
    check(viewer.playbackState.ordinal===2 && viewer.playbackState.inspectionIteration===1,'Ordinal route did not preserve separate inspection');
    const selection=JSON.stringify(viewer.selection);await player.play();await delay(100);
    check(player.snapshot.state==='playing','Workbench did not play');check(JSON.stringify(viewer.selection)===selection,'Playback changed editor selection');
    location.hash='#/scenario/spec/repeats-alternate-endings-simple?at=1';await delay(120);
    check(viewer.playbackState.ordinal===1,'Same-score route update did not seek');
    const beforeEdit=viewer.mnxDoc.mnxJson;await player.play();viewer.focus();viewer.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',code:'ArrowUp',altKey:true,bubbles:true,composed:true}));await delay(100);
    check(viewer.mnxDoc.mnxJson!==beforeEdit,'Edit input did not change the document');
    await delay(200);
    // AN EDIT KEEPS THE SESSION (core-player-live-edit.md, campaign item 22):
    // the transport carries its state and its place across a keystroke instead
    // of being stopped and rewound. This used to assert the opposite — the
    // pre-item-22 contract, which only playbackHost.ts was converted away from,
    // so the workbench went on stopping playback on every edit.
    check(player.snapshot?.state==='playing','An edit stopped the transport: live edit keeps the session');
    // What must NOT survive is a highlight belonging to the OLD revision. The
    // ink is the proof: a key the edited score no longer draws paints nothing.
    const lit=[...viewer.shadowRoot.querySelectorAll('.playback-ink')];
    check(viewer.playbackState.highlight.length>0,'An edit left the playhead with nothing highlighted');
    check(viewer.playbackState.highlight.every(o=>o.ordinal===viewer.playbackState.ordinal),
      'A highlight outlived the traversal it was positioned in');
    check(lit.length>0,'The highlight names notes the edited score does not draw: a stale revision');
    location.hash='#/scenario/spec/jumps-dal-segno';
    for(let i=0;i<100 && player.documentId!=='spec/jumps-dal-segno';i++)await delay(50);
    for(let i=0;i<100 && !player.performance;i++)await delay(50);
    const measures=player.performance.measures,back=measures.findIndex((m,i)=>i>0 && m.measureIndex<measures[i-1].measureIndex);
    check(back>0,'D.S. fixture has no return');
    const reached=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('D.S. return never arrived')),10000);const onBar=e=>{if(e.detail.ordinal===measures[back].ordinal){clearTimeout(timeout);player.removeEventListener('bar',onBar);resolve();}};player.addEventListener('bar',onBar);});
    player.seek(measures[back-1].ordinal);await player.play();await reached;
    check(page.shadowRoot.querySelector('mnx-document-viewer').playbackState.ordinal===measures[back].ordinal,'Viewer missed D.S. return');player.stop();
    return {routing:true,selection:true,editReset:true,dalSegno:true};
  })()`));
  // THE PLAYHEAD STANDS IN A REST. A rest sounds nothing, so it is absent
  // from the backend's highlight — which is built from note attacks — and the
  // page went blank at every silence: on the notation staff the rest simply
  // never lit, and the tab staff, which draws no rest at all, had nothing to
  // light. `model/restSpans.ts` resolves the written position the backend
  // already reports into the drawn rests there, and this proves the two ends
  // meet in a real browser: the rest glyph takes the voice colour, and the tab
  // staff's pill (invisible until now, by stylesheet) appears beside it.
  console.log('rest under the playhead',await cdp.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const page=document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page');
    location.hash='#/scenario/lab/document/navigation-playground';
    const player=page.shadowRoot.querySelector('mnx-player');
    for(let i=0;i<120 && player.documentId!=='lab/document/navigation-playground';i++)await delay(50);
    for(let i=0;i<120 && !player.performance;i++)await delay(50);
    const viewer=page.shadowRoot.querySelector('mnx-document-viewer');
    viewer.view='both'; // the tab staff has to be on the page to be judged
    await delay(400);
    // Bar 3 (index 2) opens with a whole rest in the fingerboard part — long
    // enough that the playhead is still inside it when this looks.
    const at=player.performance.measures.findIndex(m=>m.measureIndex===2);
    check(at>=0,'The fixture no longer performs the bar that holds the rest');
    player.seek(at);await player.play();await delay(300);
    const rest=viewer.shadowRoot.querySelector('.rest.playback-ink');
    check(rest,'The notation rest under the playhead never took the playback colour');
    const pill=viewer.shadowRoot.querySelector('.tab-rest-pill.playback-ink');
    check(pill,'The tab staff showed nothing where the playhead was resting');
    // Hollow, so it cannot be read as a note, and coloured like the voice.
    const painted=getComputedStyle(pill);
    check(painted.fill==='none','The rest pill is filled — it reads as a sounding note');
    check(painted.display!=='none','The rest pill is still hidden while lit');
    check(painted.strokeDasharray && painted.strokeDasharray!=='none','The rest pill is not dashed');
    // And it goes away again: silence marked only while the playhead is in it.
    player.stop();await delay(300);
    check(!viewer.shadowRoot.querySelector('.tab-rest-pill.playback-ink'),'The rest pill outlived the playhead');
    check(!viewer.shadowRoot.querySelector('.rest.playback-ink'),'The lit rest outlived the playhead');
    return {notationRest:true,tabPill:true,cleared:true};
  })()`));
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${review.port}/performance.html`});
  let listen=false;for(let i=0;i<100;i++){listen=await cdp.evaluate(`!!document.querySelector('mnx-player')?.performance`);if(listen)break;await new Promise(r=>setTimeout(r,100));}
  if(!listen)throw new Error('Static review Listen did not initialize');
  console.log('review Listen',await cdp.evaluate(`(async()=>{
    const player=document.querySelector('mnx-player');await player.play();await new Promise(r=>setTimeout(r,120));
    if(player.snapshot.state!=='playing'||!player.closest('section').querySelector('.playing'))throw new Error('Review playback/highlight failed');player.stop();return true;
  })()`));
  if(cdp.logs.length)throw new Error(cdp.logs.join('\n'));
  console.log('Player workbench/review smoke OK');
}finally{
  ws?.close();if(chrome && chrome.exitCode===null){const done=new Promise(r=>chrome.once('exit',r));chrome.kill();await done;}
  server?.server.close();review?.server.close();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
