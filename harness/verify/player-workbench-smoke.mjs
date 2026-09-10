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
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.port}/#/scenario/spec/repeats-alternate-endings-simple?at=2`});
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
    check(player.snapshot?.state!=='playing' && !viewer.playbackState.highlight.length,'An edit retained positional playback highlights');
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
