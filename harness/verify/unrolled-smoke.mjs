import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serveStatic } from './staticServer.mjs';
import { loadCorpus } from './check-scenarios.mjs';
import { devtoolsPort, connect, client, waitFor, settle, SCORE_READY } from './browserHarness.mjs';
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
  // The staff view and repeats mode are stored preferences, not URL state.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "localStorage.setItem('mnx-lab.view','notation');localStorage.setItem('mnx-lab.unrolled','1');",
  });
  await cdp.send('Page.navigate', {
    url: `http://127.0.0.1:${server.port}/workbench/#/scenario/spec/repeats-alternate-endings-simple?at=2`,
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
  // The player's performance can be ready before the viewer has painted the
  // unrolled score, and under load it is.
  await waitFor(cdp, SCORE_READY, 'the unrolled score');
  await settle(cdp);
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
    // Playing repaints ink, never the layout. (A pause then parks the edit
    // cursor on the playhead — core-single-cursor.md — which is a cursor move,
    // and a cursor move re-renders like any other; so the identity is held
    // across a stretch of PLAYING, not across the pause.)
    await delay(150);
    check(viewer.shadowRoot.querySelector('svg')===svg,'Playback caused a relayout');
    player.pause();await delay(50);
    // Re-queried: the pause parked the edit cursor, which re-renders, so the
    // node held from before is detached. And pressed where it is drawn — the
    // press places the cursor on the visit it names, and the cursor seeks.
    const first=viewer.shadowRoot.querySelector('svg [data-source-id="w0:'+CSS.escape(key)+'"]');
    const box=first.getBoundingClientRect();
    first.dispatchEvent(new PointerEvent('pointerdown',{clientX:box.x+box.width/2,clientY:box.y+box.height/2,button:0,isPrimary:true,bubbles:true,composed:true}));await delay(120);
    check(viewer.playbackState.ordinal===0,'Click did not seek exact occurrence');
    viewer.selection={...viewer.selection,selectedNoteIds:[key]};await viewer.updateComplete;await delay(50);
    const selected=[...viewer.shadowRoot.querySelectorAll('.notehead.selected')];
    check(selected.length===2,'Written selection did not light both visits');
    // THROUGH THE SCORE FRAME, AND THROUGH ITS BUTTON. The settings pad moved
    // inside <mnx-score-frame> (core-score-frame.md) and is rendered there only
    // while its pad is open — so the page's own root has not held one for some
    // time, and this read null and died on setting .open, before testing
    // anything it is here for. smoke:focus reaches the frame's chrome the same
    // way. The pad arrives pinned; opening it is the button's job now.
    const frame=page.shadowRoot.querySelector('mnx-score-frame');
    check(frame,'The scenario page has no score frame');
    const gear=[...frame.shadowRoot.querySelectorAll('.tools-row .btn')]
      .find(b=>b.getAttribute('aria-label')==='Settings');
    check(gear,'The score frame offers no Settings button');
    gear.click();await frame.updateComplete;await delay(50);
    const settings=frame.shadowRoot.querySelector('mnx-settings-pad');
    check(settings,'The Settings button opened no pad');
    await settings.updateComplete;
    // The REPEATS row is a two-way field now, not a checkbox: one click
    // flips it (roadmap/proposed/workbench-settings-card.md).
    const toggle=settings.shadowRoot.querySelector('.field[data-row="repeats"]');toggle.click();await delay(100);
    check(localStorage.getItem('mnx-lab.unrolled')==='0' && !viewer.unrolled,'Toggle did not update preference and viewer');
    check(location.hash.includes('at=2'),'Toggle erased ordinal route');
    toggle.click();await delay(100);
    check(localStorage.getItem('mnx-lab.unrolled')==='1' && viewer.unrolled,'Toggle did not restore unrolled');
    location.hash='#/scenario/lab/navigation/ds-final-ending';
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
  // The review page is one section per scenario that declares `unrolled`
  // and one pair per committed `expected.unrolled*.svg`; count them from the corpus
  // so a new navigation scenario grows the expectation instead of breaking it.
  const expected = { sections: 0, pairs: 0 };
  for (const scenario of loadCorpus()) {
    if (!JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8')).unrolled) continue;
    expected.sections++;
    expected.pairs += fs.readdirSync(scenario.dir).filter((name) => /^expected\.unrolled(\.tab)?\.svg$/.test(name)).length;
  }
  await cdp.send('Page.navigate', {
    url: `http://127.0.0.1:${review.port}/unrolled.html#lab/navigation/ds-final-ending`,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(
    'Unrolled review',
    await cdp.evaluate(
      `(async()=>{await document.fonts.ready;const sections=document.querySelectorAll('section'),pairs=document.querySelectorAll('.pair'),blocked=[...sections].filter(s=>s.textContent.includes('Blocked:'));if(sections.length!==${expected.sections}||pairs.length!==${expected.pairs}||blocked.length)throw new Error('Review evidence missing: '+sections.length+' sections, '+pairs.length+' pairs, '+blocked.length+' blocked (expected ${expected.sections}/${expected.pairs}/0)');return {sections:sections.length,pairs:pairs.length};})()`,
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
  // Litter, not a failure: Chrome goes on flushing its cache after it reports
  // exit, so this races and sometimes loses. Throwing here from `finally`
  // REPLACES whatever the smoke was reporting — see docs/browser-smokes.md.
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
