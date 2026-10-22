// The loop (roadmap/inprogress/studio-player-practice.md) in the workbench's real browser:
// a selection becomes the loop from the tray's Loop field, the score draws it, a count-in
// counts on its chip, a handle dragged with the mouse moves its end, a seek out of it while
// playing leaves it, and Clear takes it off the score.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client, stopChrome, until } from './browserHarness.mjs';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-loop-'));
let chrome, ws, server;
const PAGE = `document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page')`;
const PLAYER = `${PAGE}.shadowRoot.querySelector('mnx-player')`;
const VIEWER = `${PAGE}.shadowRoot.querySelector('mnx-document-viewer')`;
try {
  server = await serveStatic('dist/client');
  chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome', ['--headless=new', '--remote-debugging-port=0', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1400,900', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  const cdp = client(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('mnx-lab.view','notation');localStorage.removeItem('mnx-player-practice');" });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/workbench/#/scenario/lab/document/twelve-bar-blues` });
  await until(cdp, `!!${PLAYER}?.performance && !!${VIEWER}?.shadowRoot.querySelector('svg')`);
  const mouse = async (type, x, y) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });

  // Bars 2–3 selected in the editor: the Loop field loops them, and the score draws it.
  console.log('select', await cdp.evaluate(`(async()=>{
    const page=${PAGE},viewer=${VIEWER},player=${PLAYER},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const check=(v,m)=>{if(!v)throw new Error(m);};
    page.session.handleIntent({type:'goToMeasure',measureIndex:1});page.editor.sessionMoved();await delay(100);
    viewer.focus();
    const key=(key,code,o={})=>viewer.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,composed:true,...o}));
    key('%','Digit5',{shiftKey:true});await delay(60);key('ArrowRight','ArrowRight',{shiftKey:true});await delay(300);
    check(player.loopCandidate?.first===1&&player.loopCandidate?.last===2,'The editor did not report bars 2–3: '+JSON.stringify(player.loopCandidate));
    player.shadowRoot.querySelector('.field.loop .toggle').click();await delay(300);
    check(player.loop?.first===1&&player.loop?.last===2,'The Loop field did not loop the selection');
    check(player.shadowRoot.querySelector('.field.loop .toggle').textContent.trim()==='2–3','The field does not name bars 2–3');
    check(viewer.playbackState.loop?.label==='Loop 2–3','The score was not told of the loop');
    const marker=viewer.shadowRoot.querySelector('svg g.loop-marker'),wash=viewer.shadowRoot.querySelectorAll('svg .loop-wash');
    check(marker&&wash.length>0,'The score draws no loop marker');
    check(marker.querySelector('.loop-chip text')?.textContent==='Loop 2–3','The chip does not name the loop');
    check(player.shadowRoot.querySelectorAll('.lane.looped').length===2,'The rail does not tint the loop\\u2019s two bars');
    return 'bars 2–3';
  })()`));

  // A count-in: the chip counts it, then the music plays the loop.
  console.log('count-in', await cdp.evaluate(`(async()=>{
    const player=${PLAYER},viewer=${VIEWER},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const check=(v,m)=>{if(!v)throw new Error(m);};
    player.setPracticeOptions({...player.practiceOptions,countIn:1,repeats:2,then:'stop'});
    await player.play();
    for(let i=0;i<300&&!player.snapshot?.loop?.counting;i++)await delay(50);
    check(player.snapshot?.loop?.counting?.of===4,'No count-in: '+JSON.stringify({state:player.snapshot?.state,playback:player.playback?.state,issue:player.playback?.issue,k:player.snapshot?.loop?.k,counting:player.snapshot?.loop?.counting}));
    for(let i=0;i<40&&!viewer.playbackState.loop?.counting;i++)await delay(50);
    check(viewer.shadowRoot.querySelector('svg .loop-chip text')?.textContent.startsWith('Count-in'),'The chip does not count the count-in');
    for(let i=0;i<120&&player.snapshot?.loop?.counting;i++)await delay(50);
    check(player.snapshot?.state==='playing'&&player.scorePosition?.ordinal===1,'After the count-in the loop does not play from bar 2');
    // Paused in the loop's second bar, Play goes back to its first, on the same repeat.
    for(let i=0;i<120&&player.scorePosition?.ordinal!==2;i++)await delay(50);
    const k=player.snapshot?.loop?.k;
    player.pause();await delay(100);
    check(player.scorePosition?.ordinal===2,'The pause did not keep its place in bar 3');
    await player.play();await delay(100);
    check(player.scorePosition?.ordinal===1&&player.snapshot?.loop?.k===k,'Play after a pause did not start the loop again on its repeat: '+JSON.stringify({at:player.scorePosition?.ordinal,k:player.snapshot?.loop?.k,was:k}));
    player.pause();await delay(100);
    return 'counted';
  })()`));

  // The end handle dragged with the mouse to bar 5.
  const at = await cdp.evaluate(`(()=>{
    const p=${PLAYER},rail=p.shadowRoot.querySelector('.rail'),handle=p.shadowRoot.querySelector('.loop-handle.last');
    const h=handle.getBoundingClientRect(),cells=[...rail.querySelectorAll('.cell')].map(c=>c.getBoundingClientRect());
    return JSON.stringify({x:h.left+h.width/2,y:h.top+10,tx:cells[4].left+cells[4].width/2,ty:cells[4].top+cells[4].height/2});
  })()`).then(JSON.parse);
  await mouse('mouseMoved', at.x, at.y); await mouse('mousePressed', at.x, at.y);
  await mouse('mouseMoved', (at.x + at.tx) / 2, at.ty); await mouse('mouseMoved', at.tx, at.ty);
  const card = await cdp.evaluate(`${PLAYER}.shadowRoot.querySelector('.loop-card')?.textContent`);
  await mouse('mouseReleased', at.tx, at.ty);
  console.log('drag', await cdp.evaluate(`(async()=>{
    const player=${PLAYER},viewer=${VIEWER},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const check=(v,m)=>{if(!v)throw new Error(m);};
    await delay(200);
    check(${JSON.stringify(card ?? '')}==='End · bar 5 · 4 bars','The drag card did not name the drop: '+${JSON.stringify(card ?? '')});
    check(player.loop?.first===1&&player.loop?.last===4,'The drag did not move the end to bar 5: '+JSON.stringify(player.loop));
    check(viewer.playbackState.loop?.label==='Loop 2–5','The score did not follow the drag');
    return 'bars 2–5';
  })()`));

  // Paused, the cursor may wander off and the loop stays; playing, a seek out of it leaves it.
  console.log('leave', await cdp.evaluate(`(async()=>{
    const page=${PAGE},player=${PLAYER},viewer=${VIEWER},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const check=(v,m)=>{if(!v)throw new Error(m);};
    page.session.handleIntent({type:'goToMeasure',measureIndex:9});page.editor.sessionMoved();await delay(500);
    check(player.loop?.first===1,'A paused cursor move cleared the loop');
    await player.play();await delay(300);
    const at=player.scorePosition?.ordinal;
    check(at>=1&&at<=4,'Play did not start inside the loop: '+at);
    player.seek(9);await delay(200);
    check(player.loop===null&&viewer.playbackState.loop===null,'A seek out of the loop while playing did not leave it');
    check(!viewer.shadowRoot.querySelector('svg g.loop-marker'),'The marker outlived the loop');
    player.stop();
    return 'left';
  })()`));

  // Clear from the options.
  console.log('clear', await cdp.evaluate(`(async()=>{
    const player=${PLAYER},viewer=${VIEWER},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const check=(v,m)=>{if(!v)throw new Error(m);};
    player.setLoopBars({first:0,last:0});await delay(100);
    player.shadowRoot.querySelector('.field.loop .more').click();await delay(100);
    const pop=player.shadowRoot.querySelector('.pop.loop');
    check(pop&&pop.textContent.includes('Count-in')&&pop.textContent.includes('Speed trainer'),'The options do not open');
    [...pop.querySelectorAll('button')].find(b=>b.textContent.trim()==='Clear loop').click();await delay(200);
    check(player.loop===null&&!viewer.shadowRoot.querySelector('svg g.loop-marker'),'Clear loop left a loop');
    return 'cleared';
  })()`));
  if (cdp.logs.length) throw new Error(cdp.logs.join('\n'));
  console.log('Loop smoke OK');
} finally {
  ws?.close(); await stopChrome(chrome);
  server?.server.close();
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
