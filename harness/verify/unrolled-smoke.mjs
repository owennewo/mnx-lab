import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-unrolled-'));
let chrome, ws, server, review;
try {
  server = await serveStatic('dist/client');
  review = await serveStatic(process.env.UNROLLED_REVIEW_DIR ?? 'dist/review');
  chrome = spawn(
    process.env.CHROME_BIN ?? 'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-gpu',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  const cdp = client(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', {
    url: `http://127.0.0.1:${server.port}/#/scenario/spec/repeats-alternate-endings-simple?unrolled=1&view=notation&at=2`,
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    ready = await cdp.evaluate(
      `!!document.querySelector('mnx-workbench')?.shadowRoot?.querySelector('mnx-scenario-page')?.shadowRoot?.querySelector('mnx-player')?.performance`,
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Unrolled workbench did not load');
  console.log(
    'Unrolled interaction',
    await cdp.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m)},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const page=document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page');
    const player=page.shadowRoot.querySelector('mnx-player');
    let viewer=page.shadowRoot.querySelector('mnx-document-viewer');
    check(viewer.unrolled,'Route did not enable unrolled');
    check(viewer.playbackState.ordinal===2,'Initial ordinal was lost');
    const key=player.performance.written.find(w=>w.ordinal===2).noteKey;
    check(viewer.shadowRoot.querySelector('[data-source-id="w2:'+CSS.escape(key)+'"]'),'Repeated geometry missing');
    await player.play();await delay(100);
    const svg=viewer.shadowRoot.querySelector('svg');
    const playing=[...svg.querySelectorAll('.playback-ink')];
    check(playing.length && playing.every(n=>n.dataset.sourceId.startsWith('w2:')),'Playback highlighted another occurrence');
    player.pause();await delay(50);
    check(viewer.shadowRoot.querySelector('svg')===svg,'Playback caused a relayout');
    const first=svg.querySelector('[data-source-id="w0:'+CSS.escape(key)+'"]');
    first.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}));await delay(80);
    check(viewer.playbackState.ordinal===0,'Click did not seek exact occurrence');
    viewer.selection={...viewer.selection,selectedNoteIds:[key]};await viewer.updateComplete;await delay(50);
    const selected=[...viewer.shadowRoot.querySelectorAll('.notehead.selected')];
    check(selected.length===2,'Written selection did not light both visits');
    const settings=page.shadowRoot.querySelector('mnx-settings-pad');settings.open=true;await settings.updateComplete;
    // The REPEATS row is a two-way field now, not a checkbox: one click
    // flips it (roadmap/proposed/workbench-settings-card.md).
    const toggle=settings.shadowRoot.querySelector('.field[data-row="repeats"]');toggle.click();await delay(100);
    check(!location.hash.includes('unrolled=1') && !viewer.unrolled,'Toggle did not update route and viewer');
    check(location.hash.includes('at=2'),'Toggle erased ordinal route');
    location.hash='#/scenario/lab/navigation/ds-final-ending?view=notation&unrolled=1';
    for(let i=0;i<100 && player.documentId!=='lab/navigation/ds-final-ending';i++)await delay(50);
    await delay(100);viewer=page.shadowRoot.querySelector('mnx-document-viewer');
    // The corpus probe uses whole notes crossing each slice. Split its first
    // bar only in this isolated browser fixture to exercise excluded ink.
    const probe=structuredClone(viewer.mnxDoc);
    probe.mnxJson.parts[0].measures[0].sequences[0].content=Array.from({length:4},(_,i)=>({duration:{base:'quarter'},notes:[{id:'probe'+i,pitch:{step:'G',octave:4}}]}));
    const isolated=document.createElement('mnx-document-viewer');
    isolated.mnxDoc=probe;isolated.unrolled=true;isolated.view='notation';isolated.style.cssText='display:block;width:1000px;height:600px';
    document.body.append(isolated);viewer=isolated;await viewer.updateComplete;await delay(100);
    const excluded=viewer.shadowRoot.querySelector('.notehead.unperformed');
    check(excluded,'Partial entry has no visible unperformed marker '+JSON.stringify({unrolled:viewer.unrolled,doc:player.documentId,notes:[...viewer.shadowRoot.querySelectorAll('[data-source-id]')].map(n=>n.dataset.sourceId),error:viewer.shadowRoot.textContent.slice(-400)}));
    let clicks=0;viewer.addEventListener('note-selected',()=>clicks++);
    excluded.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}));await delay(30);
    check(clicks===0,'Unperformed note activated');
    const id=excluded.dataset.sourceId,ordinal=Number(id.match(/^w([0-9]+):/)[1]);
    check(!viewer.revealOccurrence({ordinal,noteKey:excluded.dataset.writtenSourceId}),'Unperformed note was revealed as a playback target');
    viewer.remove();player.stop();return {route:true,toggle:true,occurrenceSeek:true,selection:true,playbackPaint:true,partialEntry:true};
  })()`),
  );
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/unrolled-workbench.png', Buffer.from(screenshot.result.data, 'base64'));
  await cdp.send('Page.navigate', {
    url: `http://127.0.0.1:${review.port}/unrolled.html#lab/navigation/ds-final-ending`,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(
    'Unrolled review',
    await cdp.evaluate(
      `(async()=>{await document.fonts.ready;const sections=document.querySelectorAll('section'),pairs=document.querySelectorAll('.pair');if(sections.length!==16||pairs.length!==18)throw new Error('Review evidence missing');return {sections:sections.length,pairs:pairs.length};})()`,
    ),
  );
  const reviewShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/unrolled-review.png', Buffer.from(reviewShot.result.data, 'base64'));
  if (cdp.logs.length) throw new Error(cdp.logs.join('\n'));
  console.log('Unrolled smoke OK');
} finally {
  ws?.close();
  if (chrome && chrome.exitCode === null) {
    const done = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await done;
  }
  server?.server.close();
  review?.server.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
