// npm run build:embed, then node harness/verify/youtube-smoke.mjs [--live]
// Default: deterministic official-API stand-in. --live: actual YouTube, never
// substitutes network responses. Both use the production CSP and referrer policy.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root=path.resolve(import.meta.dirname,'../..'),live=process.argv.includes('--live'),format=process.env.MNX_EMBED_FORMAT??'esm';
const headers=Object.fromEntries(fs.readFileSync(root+'/public/_headers','utf8').split('\n').filter(s=>s.startsWith('  ')).map(s=>{const at=s.indexOf(':');return [s.slice(0,at).trim(),s.slice(at+1).trim()];}));
const fixture=JSON.parse(fs.readFileSync(root+'/scenarios/lab/20-tab-part/01-standard-tuning-both/document.mnx.json'));
fixture.global.measures[0].repeatStart={};fixture.global.measures.at(-1).repeatEnd={};
const js=`(async()=>{
  const api=${format==='iife'?'window.MnxLab':"await import('/mnx-lab.esm.js')"};
  const frame=document.createElement('mnx-score-frame'),viewer=document.createElement('mnx-document-viewer'),player=document.createElement('mnx-player');
  frame.style.height='100vh';player.slot='player';frame.append(viewer,player);document.body.append(frame);
  window.test={frame,viewer,player};window.test.binding=api.bindPlayback(frame,viewer,player);
  test.binding.setDocument({id:'youtube-smoke',name:'YouTube recording',lastUpdated:0,mnxJson:${JSON.stringify(fixture)}});
  player.recordings=[{id:'youtube',kind:'youtube',name:'Official API example',video:'M7lc1UVf-VE',syncpoints:[[0,1],[1,6],[1,9,240],[2,14]]},{id:'second',kind:'youtube',name:'Another selection',video:'M7lc1UVf-VE',syncpoints:[[0,2],[1,8],[2,18]]}];
  await player.updateComplete;window.test.ready=true;
})()`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://test');res.setHeader('Content-Security-Policy',headers['Content-Security-Policy']);res.setHeader('Referrer-Policy',headers['Referrer-Policy']);
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>html,body{margin:0;height:100%;color-scheme:light}body{font:14px sans-serif}</style>${format==='iife'?'<script src="/mnx-lab.js"></script>':''}<script src="/test.js" defer></script></head><body></body></html>`);}
  if(url.pathname==='/test.js'){res.setHeader('Content-Type','text/javascript');return res.end(js);}
  const file=path.resolve(root+'/dist/embed','.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+'/dist/embed/')||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.woff2')?'font/woff2':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync('/tmp/youtube-smoke-'),chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws,c;
const fake=`window.__ytInstances=[];window.YT={Player:class{
 constructor(frame,{events}){this.frame=frame;this.events=events;this.time=0;this.state=5;this.rate=1;this.volume=70;this.plays=0;this.last=performance.now();__ytInstances.push(this);queueMicrotask(()=>events.onReady());}
 getCurrentTime(){const now=performance.now();if(this.state===1)this.time+=(now-this.last)/1000*this.rate;this.last=now;return this.time;}
 getDuration(){return 30;}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}getAvailablePlaybackRates(){return [.5,1,1.5,2];}getVolume(){return this.volume;}
 setPlaybackRate(rate){this.rate=rate;queueMicrotask(()=>this.events.onPlaybackRateChange({data:rate}));}setVolume(volume){this.volume=volume;}
 cueVideoById({startSeconds}){this.time=startSeconds;this.state=5;this.rate=1;queueMicrotask(()=>{this.events.onPlaybackRateChange({data:1});this.events.onStateChange({data:5});});}
 seekTo(time){this.time=time;this.last=performance.now();}playVideo(){this.plays++;this.last=performance.now();this.state=1;queueMicrotask(()=>this.events.onStateChange({data:1}));}
 pauseVideo(){this.getCurrentTime();this.state=2;}destroy(){this.destroyed=true;this.frame.remove();}
}};window.onYouTubeIframeAPIReady?.();`;
try{
 ws=new WebSocket(await connect(await devtoolsPort(profile)));await new Promise(r=>ws.addEventListener('open',r));c=client(ws);
 await c.send('Runtime.enable');await c.send('Page.enable');await c.send('Network.enable');
 let scripts=0;
 if(!live){await c.send('Fetch.enable',{patterns:[{urlPattern:'https://www.youtube.com/*'}]});ws.addEventListener('message',async event=>{
   const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;
   const {requestId,request}=message.params;const script=request.url.includes('/iframe_api');if(script)scripts++;
   if(script)await new Promise(r=>setTimeout(r,120));
   await c.send('Fetch.fulfillRequest',{requestId,responseCode:script&&scripts===1?503:200,responseHeaders:[{name:'Content-Type',value:script?'text/javascript':'text/html'}],body:Buffer.from(script?fake:'<!doctype html><html><body>YouTube API fixture</body></html>').toString('base64')});
 });}
 const wait=async(expr,seconds=20)=>{for(let i=0;i<seconds*10;i++){if(await c.evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expr+'; '+await c.evaluate(`JSON.stringify({issue:test.player.playback?.issue,error:test.player.shadowRoot.textContent.slice(-800)})`));};
 await c.send('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});
 await c.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await wait('window.test?.ready');
 await c.evaluate(`test.player.seek(1);const rate=test.player.shadowRoot.querySelector('input[aria-label="Playback rate"]');rate.value='1.5';rate.dispatchEvent(new Event('input'));test.player.selectSource('youtube')`);await wait(`!!test.frame.shadowRoot.querySelector('.youtube-notice')`);
 if(!await c.evaluate(`(()=>{const root=test.frame.shadowRoot,notice=root.querySelector('.youtube-notice'),pane=root.querySelector('.video-pane');return !pane.hidden && pane.contains(notice) && !test.player.shadowRoot.querySelector('.youtube-notice') && root.querySelector('.video-surface').hidden;})()`))throw new Error('Consent did not appear in the left pane');
 await c.evaluate(`[...test.frame.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Cancel').click()`);
 await wait(`test.frame.shadowRoot.querySelector('.video-pane').hidden`);
 await c.evaluate(`test.player.selectSource('youtube')`);
 await wait(`!!test.frame.shadowRoot.querySelector('.youtube-notice')`);
 if(await c.evaluate(`!!document.querySelector('script[src*="youtube.com"]') || !!test.frame.shadowRoot.querySelector('iframe')`))throw new Error('YouTube loaded before consent');
 await c.evaluate(`[...test.frame.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Agree and load YouTube').click()`);
 if(!live){
   await new Promise(r=>setTimeout(r,30));await c.evaluate(`test.player.selectSource('second');test.player.selectSource('youtube')`);
   await wait(`test.player.playback?.kind==='youtube' && !test.player.playback.loading`,25);
   await c.evaluate(`[...test.player.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Retry video').click()`);
 }
 await wait(`test.player.playback?.kind==='youtube' && !test.player.playback.loading`,25);
 const ready=await c.evaluate(`({source:test.player.sourceId,issue:test.player.playback.issue,state:test.player.playback.state,time:test.player.playback.mediaTime,iframe:test.frame.shadowRoot.querySelector('iframe')?.src})`);
 console.log('YouTube ready',JSON.stringify({live,format,...ready}));
 if(ready.issue)throw new Error(ready.issue);
 await wait(`test.player.playback.rate===1.5`);
 const geometry=await c.evaluate(`(()=>{const f=test.frame.shadowRoot.querySelector('iframe'),b=f.getBoundingClientRect();return {width:b.width,height:b.height,top:b.top,bottom:b.bottom,referrer:f.referrerPolicy,controls:new URL(f.src).searchParams.get('controls')};})()`);
 if(geometry.width<200||geometry.height<200||geometry.bottom>900||geometry.controls!=='1')throw new Error('Invalid video geometry '+JSON.stringify(geometry));
 const controls=await c.evaluate(`(()=>{const root=test.frame.shadowRoot, video=root.querySelector('iframe').getBoundingClientRect(), buttons=root.querySelector('.video-controls').getBoundingClientRect();return buttons.top>=video.bottom && buttons.left>=video.left && buttons.right<=video.right && !test.player.shadowRoot.querySelector('.youtube-panel');})()`);
 if(!controls)throw new Error('YouTube controls are not beneath the left video');
 await c.evaluate(`[...test.frame.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Terms and privacy').click()`);
 await wait(`!!test.frame.shadowRoot.querySelector('.youtube-notice')`);
 await c.evaluate(`[...test.frame.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Close notice').click()`);
 const layout=await c.evaluate(`(()=>{const root=test.frame.shadowRoot, video=root.querySelector('iframe'), score=root.querySelector('.score');window.originalVideo=video;const divider=root.querySelector('.video-divider');divider.dispatchEvent(new KeyboardEvent('keydown',{key:'Home'}));return video.getBoundingClientRect().right<=score.getBoundingClientRect().left;})()`);
 if(!layout)throw new Error('Video is not left of the score');
 await new Promise(r=>setTimeout(r,100));
 if(!await c.evaluate(`test.frame.shadowRoot.querySelector('iframe').getBoundingClientRect().width===200`))throw new Error('Minimum video width failed');
 await c.evaluate(`test.frame.shadowRoot.querySelector('.video-divider').dispatchEvent(new KeyboardEvent('keydown',{key:'End'}))`);
 await new Promise(r=>setTimeout(r,100));
 if(!await c.evaluate(`Math.abs(test.frame.shadowRoot.querySelector('iframe').getBoundingClientRect().width-test.frame.clientWidth*.75)<1 && originalVideo===test.frame.shadowRoot.querySelector('iframe')`))throw new Error('Maximum width or stable iframe failed');
 const divider=await c.evaluate(`(()=>{const b=test.frame.shadowRoot.querySelector('.video-divider').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+100};})()`);
 await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...divider});
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...divider,button:'left',clickCount:1});
 await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:divider.x+1,y:divider.y,button:'left',buttons:1});
 await new Promise(r=>setTimeout(r,100));
 await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:divider.y,button:'left',buttons:1});
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1,y:divider.y,button:'left',clickCount:1});
 await new Promise(r=>setTimeout(r,100));
 if(!await c.evaluate(`test.frame.shadowRoot.querySelector('iframe').getBoundingClientRect().width===200 && originalVideo===test.frame.shadowRoot.querySelector('iframe') && originalVideo.style.pointerEvents==='' `))throw new Error('Pointer resize failed '+await c.evaluate(`JSON.stringify({width:test.frame.shadowRoot.querySelector('iframe').getBoundingClientRect().width,pointer:test.frame.shadowRoot.querySelector('iframe').style.pointerEvents})`));
 if(live){
  await new Promise(r=>setTimeout(r,2000));
  const b=await c.evaluate(`(()=>{const b=test.frame.shadowRoot.querySelector('iframe').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...b,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...b,button:'left',clickCount:1});
 }else await c.evaluate(`test.player.play()`);
 await wait(`test.player.playback.state==='playing'`,15);
 await new Promise(r=>setTimeout(r,1000));
 const playing=await c.evaluate(`({time:test.player.playback.mediaTime,ordinal:test.player.scorePosition?.ordinal,highlight:test.viewer.playbackState.highlight.length,rates:test.player.playback.capabilities.rate.values,issue:test.player.playback.issue})`);
 console.log('YouTube playing',JSON.stringify(playing));
 if(!playing.highlight||playing.ordinal!==1)throw new Error('YouTube clock did not follow the mapped repeat');
 await c.evaluate(`test.player.pause()`);await c.evaluate(`test.player.seekScorePosition({ordinal:0,metricOffset:{num:0n,den:1n}})`);
 const sought=await c.evaluate(`({time:test.player.playback.mediaTime,ordinal:test.player.scorePosition?.ordinal,issue:test.player.playback.issue})`);console.log('YouTube seek',JSON.stringify(sought));
 if(sought.ordinal!==0)throw new Error('YouTube score seek failed');
 await c.evaluate(`test.frame.shadowRoot.querySelector('.video-divider').dispatchEvent(new KeyboardEvent('keydown',{key:'End'}))`);
 await c.send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,300));
 const mobile=await c.evaluate(`(()=>{const b=test.frame.shadowRoot.querySelector('iframe').getBoundingClientRect();return {width:b.width,height:b.height,bottom:b.bottom};})()`);
 if(mobile.width<200||mobile.width>270||mobile.height<200||mobile.bottom>800)throw new Error('Invalid narrow viewport '+JSON.stringify(mobile));
 await c.evaluate(`test.player.play()`);await wait(`test.player.playback.state==='playing'`);
 // Focusing the score takes the tray away and pauses the video; the mark brings the tray back and Play resumes.
 await c.evaluate(`test.frame.shadowRoot.querySelector('.focus-mark').click()`);await wait(`test.frame.focused && !test.frame.shadowRoot.querySelector('.strip.bottom') && !test.player.playback.wantsPlayback`);
 await c.evaluate(`test.frame.shadowRoot.querySelector('.focus-mark').click()`);await wait(`!test.frame.focused && !!test.frame.shadowRoot.querySelector('.strip.bottom')`);
 await c.evaluate(`test.player.play()`);await wait(`test.player.playback.state==='playing'`);
 if(!live){
  const tab=await c.send('Target.createTarget',{url:'about:blank'});await wait(`!test.player.playback.wantsPlayback`);
  await c.send('Page.bringToFront');await c.send('Target.closeTarget',{targetId:tab.result.targetId});
  await new Promise(r=>setTimeout(r,150));if(await c.evaluate(`test.player.playback.wantsPlayback`))throw new Error('Hidden tab resumed automatically');
  await c.evaluate(`test.player.play()`);await wait(`test.player.playback.state==='playing'`);
  await c.evaluate(`test.frame.shadowRoot.querySelector('iframe').requestFullscreen()`);await new Promise(r=>setTimeout(r,150));
  if(!await c.evaluate(`test.player.playback.wantsPlayback`))throw new Error('Fullscreen incorrectly paused video');
  await c.evaluate(`document.exitFullscreen()`);
  await c.evaluate(`const cover=document.createElement('div');cover.id='cover';cover.style.cssText='position:fixed;inset:0;z-index:999999;background:white';document.body.append(cover)`);await wait(`!test.player.playback.wantsPlayback`);
  await c.evaluate(`document.getElementById('cover').remove();test.player.play()`);await wait(`test.player.playback.state==='playing'`);
  await c.evaluate(`test.frame.style.visibility='hidden'`);await wait(`!test.player.playback.wantsPlayback`);await c.evaluate(`test.frame.style.visibility=''`);await new Promise(r=>setTimeout(r,150));
  if(await c.evaluate(`test.player.playback.wantsPlayback`))throw new Error('Visibility resumed autoplay');
  await c.evaluate(`test.player.selectSource('second')`);await wait(`!test.player.playback.loading`);if(scripts!==2)throw new Error('API loaded more than once');
  await c.evaluate(`test.player.selectSource('synth');test.player.selectSource('youtube');test.player.selectSource('second')`);await wait(`test.player.sourceId==='second'&&!test.player.playback.loading`);
 }
 const shot=await c.send('Page.captureScreenshot');fs.writeFileSync(`/tmp/youtube-${live?'live':format}.png`,Buffer.from(shot.result.data,'base64'));
 await c.evaluate(`[...test.frame.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Close video').click()`);
 await wait(`test.player.sourceId==='synth' && !test.player.playback.wantsPlayback`);
 if(!await c.evaluate(`test.frame.shadowRoot.querySelector('.video-pane').hidden && test.frame.shadowRoot.querySelector('.score').getBoundingClientRect().left===test.frame.getBoundingClientRect().left`))throw new Error('Video pane remained after switching to synth');
 await c.evaluate(`test.player.remove()`);
 if(!live && await c.evaluate(`__ytInstances.some(p=>!p.destroyed)`))throw new Error('YouTube instance leaked');
 if(c.logs.length)throw new Error(c.logs.join('\n'));
 console.log('YouTube smoke OK',JSON.stringify({live,format,geometry,mobile,scripts}));
}catch(error){if(c){const shot=await c.send('Page.captureScreenshot');if(shot.result?.data)fs.writeFileSync(`/tmp/youtube-${live?'live':format}-failure.png`,Buffer.from(shot.result.data,'base64'));}console.error('YouTube smoke FAILED',error.message);process.exitCode=1;}
finally{
 if(chrome.exitCode===null){
  const done=new Promise(r=>chrome.once('exit',r));
  if(c&&ws?.readyState===WebSocket.OPEN)await Promise.race([c.send('Browser.close'),new Promise(r=>setTimeout(r,1000))]);
  await Promise.race([done,new Promise(r=>setTimeout(r,2000))]);
  if(chrome.exitCode===null){chrome.kill();await done;}
 }
 ws?.close();server.close();
 await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
