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
  // A PRESS ON THE SCORE MOVES THE SCRUBBER TO THE BEAT IT NAMED.
  //
  // Seeking used to be bar-shaped: `seek(ordinal)` landed on the bar's first
  // beat whatever was pressed, so pressing beat 3 of the bar already playing
  // looked like the scrubber ignoring the press. The assertion needs no
  // arithmetic on the performance — two presses in ONE bar, at different
  // written offsets, must leave the transport in two different places. Under
  // the old rule both landed on the barline and these were equal.
  //
  // And a press on a REST moved nothing at all: a rest is not in the layout's
  // activation index so it never became a note seek, while the host's own
  // fallback stood down because something carrying a name was under the
  // pointer. That was the owner's report.
  console.log('a press seeks to its beat',await cdp.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const page=document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page');
    location.hash='#/scenario/lab/document/twelve-bar-blues';
    const player=page.shadowRoot.querySelector('mnx-player');
    for(let i=0;i<120 && player.documentId!=='lab/document/twelve-bar-blues';i++)await delay(50);
    for(let i=0;i<120 && !player.performance;i++)await delay(50);
    const viewer=page.shadowRoot.querySelector('mnx-document-viewer');
    viewer.view='both';await delay(600);
    const svg=viewer.renderRoot.querySelector('#projection-container svg');
    const press=el=>{
      const r=el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,
        button:0,isPrimary:true,bubbles:true,composed:true,cancelable:true}));
    };
    // Where the transport stands, as a comparable rational.
    const at=()=>player.snapshot?.position ?? null;
    const cmp=(a,b)=>{const d=a.num*b.den-b.num*a.den;return d<0n?-1:d>0n?1:0;};
    // Two noteheads in ONE bar, at different written offsets. Not filtered for
    // visibility: the press carries its own measured coordinates and the hit
    // test reads the engraving, not what happens to be scrolled into view — and
    // at the default headless window almost nothing is.
    const notes=[...svg.querySelectorAll('.notehead[data-source-id]')]
      .map(el=>({el,w:player.performance.written.find(w=>w.noteKey===el.getAttribute('data-source-id'))}))
      .filter(n=>n.w);
    let pair=null;
    for(const a of notes){
      const b=notes.find(x=>x.w.ordinal===a.w.ordinal && cmp(x.w.metricOffset,a.w.metricOffset)>0);
      if(b){pair={first:a,second:b};break;}
    }
    check(pair,'no two on-screen noteheads share a bar at different beats');

    press(pair.first.el);await delay(400);
    const early=at();
    check(early,'a press on a notehead left the transport nowhere');
    press(pair.second.el);await delay(400);
    const late=at();
    check(cmp(late,early)>0,
      'two beats of one bar seeked to the same place — the press is still bar-shaped');

    // A REST: it must move the scrubber at all, and to its own bar.
    const rest=[...svg.querySelectorAll('.rest[data-source-id]')][0];
    check(rest,'the fixture drew no rest to press');
    // Scrolled to, not filtered for: this fixture holds exactly one rest and it
    // is below the viewer's fold. Its own box is no guide — a SMuFL glyph's
    // rect is the whole em square, several staves tall.
    rest.scrollIntoView({block:'center'});await delay(700);
    // Re-queried: scrolling re-engraves, and the node held across it is
    // detached — it reports a zero rect and swallows the press in silence.
    const svg2=viewer.renderRoot.querySelector('#projection-container svg');
    const rest2=[...svg2.querySelectorAll('.rest[data-source-id]')][0];
    check(rest2,'the rest was gone after scrolling to it');
    check(rest2.getBoundingClientRect().width>0,'the rest measured as detached ink');
    const restBar=Number(rest.getAttribute('data-source-id').match(/@m(\\d+)/)[1]);
    // Aimed at the glyph's own BASELINE, not the centre of its rect: a SMuFL
    // text box is the whole em square, several staves tall, so its midpoint can
    // sit on the system below — and the bar at that x down there is a different
    // bar. scoreGeometry.inkBox reads the baseline for the same reason.
    const ctm=svg2.getScreenCTM(),pt=svg2.createSVGPoint();
    pt.x=rest2.x.baseVal.getItem(0).value;
    pt.y=rest2.y.baseVal.getItem(0).value;
    const aim=pt.matrixTransform(ctm);
    rest2.dispatchEvent(new PointerEvent('pointerdown',{
      clientX:aim.x,clientY:aim.y,
      button:0,isPrimary:true,bubbles:true,composed:true,cancelable:true}));
    await delay(400);
    const onRest=at();
    check(cmp(onRest,late)!==0,'a press on a rest moved the scrubber nowhere at all');
    // SOME performed visit of that bar — a repeated bar has several, and which
    // one an explicit seek chooses is the pass model's business, not this
    // test's. What must hold is that the transport is inside one of them.
    const add=(a,b)=>({num:a.num*b.den+b.num*a.den,den:a.den*b.den});
    const visits=player.performance.measures.filter(m=>m.measureIndex===restBar);
    check(visits.length>0,'the fixture no longer performs the bar holding the rest');
    const R=r=>String(r.num)+'/'+String(r.den);
    check(visits.some(m=>cmp(onRest,m.position)>=0 && cmp(onRest,add(m.position,m.duration))<0),
      'a press on the rest in bar '+restBar+' left the transport at '+R(onRest)+
      ', outside every performed copy of it ('+visits.map(m=>R(m.position)+'+'+R(m.duration)).join(', ')+')');
    player.stop();
    return {twoBeats:true,restSeeks:restBar};
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
  server?.server.close();review?.server.close();
  // A temp profile left behind is litter, not a failure. Chrome goes on
  // flushing its cache for a moment after it reports exit, so this races and
  // loses — and when it threw from `finally` it REPLACED whatever the smoke
  // was actually reporting, assertion message and all.
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}
}
