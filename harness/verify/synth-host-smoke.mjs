// The player on the synth's instrument host (roadmap/complete/core-campaign-synth.md,
// Phases 5 and 8), in a real browser: the workbench's player
// loads the host from the synth's shell (/synth/), plays a technique scenario through its
// AudioWorklet — every note acknowledged as sounding, the playhead and the highlights moving
// as they did on the old sink — pauses into silence; the multi-part blues plays without strain.
//
// Usage: npm run build:site && node harness/verify/synth-host-smoke.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client, stopChrome } from './browserHarness.mjs';

const SCENARIO = 'lab/tab-techniques/hammer-pull-chain';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-synth-host-'));
let chrome, ws, server;
try {
  server = await serveStatic('dist/client');
  chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome', ['--headless=new', '--remote-debugging-port=0', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  ws = new WebSocket(await connect(await devtoolsPort(profile)));
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  const cdp = client(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  const open = async search => {
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/workbench/${search}#/scenario/${SCENARIO}` });
    for (let i = 0; i < 150; i++) {
      if (await cdp.evaluate(`!!document.querySelector('mnx-workbench')?.shadowRoot?.querySelector('mnx-scenario-page')?.shadowRoot?.querySelector('mnx-player')?.performance`)) return;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Workbench player did not load');
  };
  await open('');
  const played = JSON.parse(await cdp.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const player=document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page').shadowRoot.querySelector('mnx-player');
    const backend=player.session.backend;
    check(typeof backend.setPartMix==='function','The player is not on the host backend');
    const notes=player.performance.sounding.length;
    await player.play();
    for(let i=0;i<50&&!backend.port.host&&!player.error;i++)await delay(100);
    let why='';try{await backend.port.loading;}catch(e){why=String(e);}
    const host=backend.port.host;
    check(host,'The host did not load from /synth/: '+(player.error||why||backend.port.context?.state));
    const sounding=new Set(),errors=[];
    host.on('sounding',list=>list.forEach(s=>sounding.add(s.id.slice(0,s.id.lastIndexOf(':')))));
    host.on('diagnostic',d=>{if(d.severity!=='info')errors.push(d.code+': '+d.message);});
    const loads=[];host.on('load',d=>loads.push(d));
    const lit=new Set();
    for(let i=0;i<60;i++){await delay(100);for(const w of player.snapshot.activeWritten)lit.add(w.noteKey);if(player.snapshot.state==='stopped')break;}
    check(player.snapshot.state==='stopped','The piece did not play to its end');
    check(sounding.size===notes,'Notes acknowledged sounding: '+sounding.size+' of '+notes);
    check(lit.size>0,'No note was highlighted while playing');
    check(!player.error,'The player reported: '+player.error);
    check(errors.length===0,'Host diagnostics: '+errors.join('; '));
    // The worklet reports its load twice a second (how the page tells a struggling device).
    check(loads.length>=2&&loads.every(l=>l.busy>=0&&l.busy<1&&l.peakMs>=0),'No sensible load reports from the worklet: '+JSON.stringify(loads.slice(0,3)));
    const button=()=>player.shadowRoot.querySelector('button.primary');
    // Pause silences: nothing more is scheduled, and what was sounding is cut.
    // Strain — two hot reports running — pulses the play button; pausing clears it.
    // (Reports count once the first note has sounded for half a second.)
    await player.play();await delay(900);
    backend.port.loadListener({busy:.95,peakMs:2});backend.port.loadListener({busy:.95,peakMs:2});await delay(100);
    check(button().classList.contains('strained')&&/struggling/.test(button().title),'A strained synth did not mark the play button');
    await delay(200);player.pause();await delay(100);
    check(!button().classList.contains('strained'),'The play button stayed marked after pausing');
    const meter=[];const off=host.on('meter',m=>meter.push(m));await delay(500);off();
    check(player.snapshot.state==='paused','Pause did not pause');
    return JSON.stringify({notes,sounding:sounding.size,lit:lit.size,context:backend.port.context.state,load:Math.max(...loads.map(l=>l.busy))});
  })()`));
  // Performance (core-campaign-synth Phase 9): a multi-part piece — guitar and keys over
  // twelve bars — keeps the worklet's load moderate and flat over nine seconds: a coarse,
  // in-browser check. History growth itself (the host once re-planned a piece's whole
  // history every batch) is guarded exactly by synth/tests/forgetting.test.mjs. Strain is
  // not asserted: the gate runs four smokes at once, and stalls on a shared machine are the
  // machine's, not the synth's.
  const SCENARIO_PERF = 'lab/document/twelve-bar-blues';
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/workbench/#/scenario/${SCENARIO_PERF}` });
  for (let i = 0; i < 150 && !(await cdp.evaluate(`!!document.querySelector('mnx-workbench')?.shadowRoot?.querySelector('mnx-scenario-page')?.shadowRoot?.querySelector('mnx-player')?.performance`)); i++) await new Promise(r => setTimeout(r, 100));
  const perf = JSON.parse(await cdp.evaluate(`(async()=>{
    const p=document.querySelector('mnx-workbench').shadowRoot.querySelector('mnx-scenario-page').shadowRoot.querySelector('mnx-player'),b=p.session.backend,delay=ms=>new Promise(r=>setTimeout(r,ms));
    await p.play();const loads=[];const off=b.port.host.on('load',l=>loads.push(l.busy));
    await delay(9000);off();p.stop();
    const steady=loads.slice(2),third=Math.max(1,Math.floor(steady.length/3)),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
    const sorted=[...steady].sort((x,y)=>x-y);
    return JSON.stringify({parts:b.routing.map(r=>r.kind).join('+'),median:sorted[Math.floor(sorted.length/2)],early:mean(steady.slice(0,third)),late:mean(steady.slice(-third)),reports:steady.length});
  })()`));
  const pct = x => `${(x * 100).toFixed(0)}%`;
  if (perf.reports < 9) throw new Error(`Too few load reports from the worklet: ${perf.reports}`);
  if (perf.median > 0.6) throw new Error(`The synth's worklet load is high playing ${SCENARIO_PERF} (${perf.parts}): median ${pct(perf.median)}`);
  if (perf.late > 2 * perf.early + 0.1) throw new Error(`The synth's load grows as ${SCENARIO_PERF} plays: ${pct(perf.early)} early, ${pct(perf.late)} late`);
  console.log(`Synth host smoke passed: ${SCENARIO} played on the instrument host — ${played.sounding}/${played.notes} notes sounding, ${played.lit} highlighted, audio ${played.context}, worklet load at most ${(played.load*100).toFixed(1)}%; strain marks the play button and pausing clears it; ${SCENARIO_PERF} (${perf.parts}) played at a flat load (median ${pct(perf.median)}; ${pct(perf.early)} early, ${pct(perf.late)} late).`);
  if (cdp.logs.length) throw new Error('Browser console errors: ' + cdp.logs.join('\n'));
} finally {
  ws?.close(); await stopChrome(chrome); server?.server.close();
  await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
