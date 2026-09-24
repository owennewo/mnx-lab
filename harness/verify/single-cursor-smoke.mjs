// Run after npm run build. ONE cursor (roadmap/proposed/core-single-cursor.md)
// in production Studio: a fixture LibraryClient, a tab score with a repeat and
// two endings (bars 0 1 | 0 2 3 as performed), and the scripted YouTube
// stand-in from youtube-smoke.mjs as the clock — four seconds a visit, so
// where the video is says which visit the playhead is on. Its seekTo lands
// 200 ms late, as YouTube's does, so a seek has a moment in flight.
//
// Paused, the arrows move the video; → at the first ending loops back and says
// Pass 2; a bar selection plays from its first event and Play collapses it.
// Playing, a fret is refused with Pause to edit, and ←/→ presses are counted
// into ONE seek of whole bars. A pause parks the cursor on the playhead without
// seeking, and the next move seeks again.
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(root + 'scenarios/lab/40-navigation/02-repeats-and-marks-on-tab/document.mnx.json'));
// Visit k starts at 1 + 4k seconds.
const sync = JSON.stringify([[0, 1], [1, 5], [2, 9], [3, 13], [4, 17], [5, 21]]);
const fake = `window.__ytInstances=[];window.YT={Player:class{
 constructor(frame,{events}){this.frame=frame;this.events=events;this.time=0;this.state=5;this.rate=1;this.volume=70;this.last=performance.now();__ytInstances.push(this);queueMicrotask(()=>events.onReady());}
 getCurrentTime(){const now=performance.now();if(this.state===1)this.time+=(now-this.last)/1000*this.rate;this.last=now;return this.time;}
 getDuration(){return 30;}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}getAvailablePlaybackRates(){return [.5,1,1.5,2];}getVolume(){return this.volume;}
 setPlaybackRate(rate){this.rate=rate;queueMicrotask(()=>this.events.onPlaybackRateChange({data:rate}));}setVolume(volume){this.volume=volume;}
 mute(){this.muted=true;}unMute(){this.muted=false;}isMuted(){return !!this.muted;}
 cueVideoById({startSeconds}){this.time=startSeconds;this.state=5;this.rate=1;queueMicrotask(()=>{this.events.onPlaybackRateChange({data:1});this.events.onStateChange({data:5});});}
 seekTo(time){setTimeout(()=>{this.time=time;this.last=performance.now();},200);}playVideo(){this.last=performance.now();this.state=1;queueMicrotask(()=>this.events.onStateChange({data:1}));}
 pauseVideo(){this.getCurrentTime();this.state=2;queueMicrotask(()=>this.events.onStateChange({data:2}));}destroy(){this.destroyed=true;this.frame.remove();}
}};window.onYouTubeIframeAPIReady?.();`;

const server = await serveStatic(root + 'dist/client'), profile = fs.mkdtempSync(`${os.tmpdir()}/single-cursor-`);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await new Promise(r => ws.addEventListener('open', r));
  const c = client(ws);
  await c.send('Page.enable'); await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await c.send('Fetch.enable', { patterns: [{ urlPattern: 'https://www.youtube.com/*' }] });
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data); if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params, script = request.url.includes('/iframe_api');
    await c.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: script ? 'text/javascript' : 'text/html' }],
      body: Buffer.from(script ? fake : '<!doctype html><html><body>YouTube API fixture</body></html>').toString('base64') });
  });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `const realFetch=window.fetch;window.fetch=(...args)=>String(args[0]).includes('/api/')?Promise.resolve(new Response('{}',{status:401})):realFetch(...args);` });
  await c.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/studio/` });
  for (let i = 0; i < 80; i++) { if (await c.evaluate(`!!customElements.get('mnx-studio-piece')`)) break; await new Promise(r => setTimeout(r, 100)); }
  const result = await c.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m);},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const until=async(f,m,ms=8000)=>{for(let t=0;t<ms;t+=50){if(f())return;await delay(50);}throw new Error('Timed out: '+m);};
    document.body.replaceChildren();const page=document.createElement('mnx-studio-piece');page.style.height='800px';
    const score=${JSON.stringify(fixture)};
    // A canonical rendition id is what opens a save session, and the editor binds with it.
    page.client={canonical:async()=>({bytes:new TextEncoder().encode(JSON.stringify(score)),filename:'fixture.mnx.json',renditionId:'r1'}),
      piece:async id=>({snapshot:{piece:{id,revision:0,canonical_rendition_id:'r1'},tags:[],recordings:[{id:'yt',kind:'youtube',name:'Video',external_id:'M7lc1UVf-VE',syncpoints:${JSON.stringify(sync)}}]}}),
      opened:async()=>{},savePrefs:async()=>{},recordingUrl:()=>''};
    page.pieceId='piece';document.body.append(page);
    await until(()=>page.editor&&page.shadowRoot?.querySelector('mnx-player')?.performance,'the editor to bind');
    const player=page.shadowRoot.querySelector('mnx-player'),viewer=page.shadowRoot.querySelector('mnx-document-viewer'),editor=page.editor,session=editor.session;
    check(await player.selectSource('yt'),'YouTube source did not map');player.pause();
    await until(()=>window.__ytInstances?.length&&player.playback?.kind==='youtube','the video');
    const video=()=>__ytInstances.at(-1).getCurrentTime();
    const key=(code,text)=>viewer.dispatchEvent(new KeyboardEvent('keydown',{key:text??code,code,bubbles:true,composed:true,cancelable:true}));
    const label=()=>{const l=page.shadowRoot.querySelector('mnx-editor-surfaces mnx-cursor-label');return l&&!l.hidden?l.text:'';};
    let seeks=0;player.addEventListener('seek',()=>seeks++);
    const near=(a,b,m)=>check(Math.abs(a-b)<0.35,m+': '+a.toFixed(2)+' vs '+b);

    // Paused: → walks bar 0 into bar 1, and the video follows once the cursor rests.
    while(session.performedOrdinal===0)key('ArrowRight');
    check(session.performedOrdinal===1&&session.cursor.measureIndex===1,'→ did not reach bar 1');
    await delay(650);
    check(player.scorePosition?.ordinal===1,'The playhead did not follow the cursor');
    near(video(),5,'The video did not follow the cursor');

    // A press seeks at once, and while YouTube is still getting there the tray
    // keeps a score position — the rail must not blink out ("no score position").
    const probe=viewer.shadowRoot.querySelector('svg [data-source-id]');
    if(probe){
      const box=probe.getBoundingClientRect(),lost=[];
      probe.dispatchEvent(new PointerEvent('pointerdown',{clientX:box.x+box.width/2,clientY:box.y+box.height/2,button:0,isPrimary:true,bubbles:true,composed:true}));
      for(let t=0;t<500;t+=20){if(!player.scorePosition)lost.push(t);await delay(20);}
      check(lost.length===0,'The score position dropped out during a seek at '+lost.join(',')+' ms');
      editor.handleIntent({type:'goToMeasure',measureIndex:1});await delay(650);
    }

    // → at the first ending loops back to the repeat start, on pass 2, and says so.
    while(session.performedOrdinal===1)key('ArrowRight');
    check(session.performedOrdinal===2&&session.cursor.measureIndex===0,'→ at the first ending did not loop back');
    await until(()=>label()==='Pass 2','the Pass 2 label');
    await delay(650);near(video(),9,'The video did not follow the loop back');

    // A bar selection plays from its first event, and Play collapses it.
    key('ArrowRight');check(session.cursor.measureIndex===0&&session.cursor.onset.num>0,'→ did not reach the second event');
    await delay(650);near(video(),9+2,'The video did not follow into the bar');
    editor.handleIntent({type:'goToLevel',level:'measure'});
    await delay(650);near(video(),9,'A bar selection did not put the video at the bar');
    await player.play();
    await until(()=>player.playback?.wantsPlayback&&session.selectionLevel==='note','Play to collapse the selection');
    check(session.cursor.onset.num===0&&session.performedOrdinal===2,'Play did not collapse to the first event');

    // Playing: a fret is refused, and says why.
    const before=editor.document;key('Digit1','1');
    check(editor.document===before,'A fret was written while playing');
    await until(()=>label()==='Pause to edit','the Pause to edit label');

    // Playing: → → is ONE seek, two visits on from the visit playing.
    let base=seeks,head=player.scorePosition.ordinal;key('ArrowRight');key('ArrowRight');
    await delay(550);
    check(seeks===base+1,'Two presses made '+(seeks-base)+' seeks');
    check(player.scorePosition.ordinal===Math.min(4,head+2),'→ → went to '+player.scorePosition.ordinal+' from '+head);
    // ← ×4 is ONE seek, to the start of the bar three before the one playing.
    base=seeks;head=player.scorePosition.ordinal;for(let i=0;i<4;i++)key('ArrowLeft');
    await delay(550);
    check(seeks===base+1,'Four presses made '+(seeks-base)+' seeks');
    const target=Math.max(0,head-3);
    check(player.scorePosition.ordinal===target,'← ×4 went to '+player.scorePosition.ordinal+' from '+head);
    near(video(),1+4*target+0.25,'← ×4 did not land at the bar start');

    // A pause parks the cursor on the playhead — and does not seek: the exact time is kept.
    await delay(300);base=seeks;const at=video();player.pause();
    await until(()=>!player.playback?.wantsPlayback,'the pause');
    await delay(250);
    check(seeks===base,'Pausing seeked');
    check(session.performedOrdinal===player.scorePosition.ordinal,'The cursor did not park on the playhead');
    near(video(),at,'Pausing moved the video');
    // …and the next move is a seek again.
    key('ArrowRight');await delay(650);
    check(seeks===base+1,'A move after the pause did not seek');
    return {paused:true,loopLabel:true,playCollapse:true,refused:true,barSeeks:true,park:true};
  })()`);
  console.log('single cursor OK', JSON.stringify(result));
  if (c.logs.length) throw new Error(c.logs.join('\n'));
} finally { ws?.close(); chrome.kill(); server.server.close(); }
