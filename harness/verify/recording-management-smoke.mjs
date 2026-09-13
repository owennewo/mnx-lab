// Production Studio + production Worker, real local D1/R2 and real HTTP streams.
// Run after npm run build. No live account, upload or external media is used.
import fs from 'node:fs';
import http from 'node:http';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { serveStatic } from './staticServer.mjs';
import { devtoolsPort, connect, client } from './browserHarness.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk={...await exportJWK(publicKey),kid:'smoke',alg:'RS256',use:'sig'};
const jwt=await new SignJWT({type:'app',email:'owner@example.test'}).setProtectedHeader({alg:'RS256',kid:'smoke'}).setIssuer('urn:mnx-library-local').setAudience('smoke').setSubject('owner').setIssuedAt().setExpirationTime('1h').sign(privateKey);
const mf=new Miniflare({modules:true,scriptPath:root+'dist/mnx_lab/index.js',compatibilityDate:'2026-06-01',d1Databases:['LIBRARY_DB'],r2Buckets:['LIBRARY_BUCKET'],bindings:{LIBRARY_ACCESS_ISSUER:'urn:mnx-library-local',LIBRARY_ACCESS_AUD:'smoke',LIBRARY_LOCAL_JWKS:JSON.stringify({keys:[jwk]})}});
const db=await mf.getD1Database('LIBRARY_DB'), bucket=await mf.getR2Bucket('LIBRARY_BUCKET');
for(const name of fs.readdirSync(root+'migrations').sort()) {const sql=fs.readFileSync(root+'migrations/'+name,'utf8').replace(/--[^\n]*/g,'').trim();await db.batch(sql.split(/;\s*(?=(?:CREATE|ALTER)\b)/).map(s=>db.prepare(s)));}
await db.prepare('INSERT INTO users VALUES (?,?,1,?)').bind('alice','owner@example.test','now').run();
const score=JSON.parse(fs.readFileSync(root+'scenarios/lab/20-tab-part/01-standard-tuning-both/document.mnx.json'));score.global.measures[0].repeatStart={};score.global.measures.at(-1).repeatEnd={};
const bytes=Buffer.from(JSON.stringify(score));await bucket.put('renditions/fixture',bytes);
await db.prepare('INSERT INTO pieces (id,owner,created_at,updated_at) VALUES (?,?,?,?)').bind('piece','alice','now','now').run();
await db.prepare('INSERT INTO renditions (id,piece_id,format,role,filename,sha256,r2_key,bytes,producer,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind('score','piece','mnx','original','score.mnx.json','fixture','renditions/fixture',bytes.length,'test','now').run();
await db.prepare('UPDATE pieces SET canonical_rendition_id=? WHERE id=?').bind('score','piece').run();
const staticServer=await serveStatic(root+'dist/client');
let uploads=0, canonicalReads=0;
function sendBody(response, res) {
  if (!response.body) { res.end(); return; }
  const stream=Readable.fromWeb(response.body);
  // Native audio cancels range requests on seek/source changes. Propagate that
  // cancellation upstream, otherwise Miniflare waits for abandoned response bodies.
  res.once('close',()=>stream.destroy()); stream.on('error',()=>res.destroy()); stream.pipe(res);
}
const proxy=http.createServer(async(req,res)=>{try {
  const url=`http://127.0.0.1:${proxy.address().port}${req.url}`;
  const headers=new Headers(Object.entries(req.headers).filter(([,v])=>typeof v==='string'));
  if(req.url.startsWith('/api/')) {
    headers.set('Cf-Access-Jwt-Assertion',jwt); if(req.method==='PUT'&&req.url.startsWith('/api/library/uploads/'))uploads++;
    const r=await mf.dispatchFetch(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const responseHeaders=Object.fromEntries(r.headers);
    // Simulate a canonical pointer changing between the paired metadata/file reads.
    if(req.url.endsWith('/canonical') && ++canonicalReads===1)responseHeaders['x-library-rendition']='prior-score';
    res.writeHead(r.status,responseHeaders);sendBody(r,res);
  } else {
    const r=await fetch(`http://127.0.0.1:${staticServer.port}${req.url}`);res.writeHead(r.status,Object.fromEntries(r.headers));sendBody(r,res);
  }
}catch(e){res.writeHead(500).end(String(e));}});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync('/tmp/recording-management-');
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws,c;
try {
  ws=new WebSocket(await connect(await devtoolsPort(profile)));await new Promise(r=>ws.addEventListener('open',r));c=client(ws);await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Page.navigate',{url:`http://127.0.0.1:${proxy.address().port}/studio/#/piece/piece`});
  for(let i=0;i<100;i++){if(await c.evaluate(`!!document.querySelector('mnx-studio')?.shadowRoot?.querySelector('mnx-studio-piece')?.shadowRoot?.querySelector('mnx-player')?.performance`))break;await new Promise(r=>setTimeout(r,100));}
  const result=await c.evaluate(`(async()=>{
    const check=(v,m)=>{if(!v)throw new Error(m)},delay=ms=>new Promise(r=>setTimeout(r,ms));
    const page=document.querySelector('mnx-studio').shadowRoot.querySelector('mnx-studio-piece'),player=page.shadowRoot.querySelector('mnx-player');check(!!player.performance,'Score did not load');
    const sheet=()=>page.shadowRoot.querySelector('mnx-studio-recordings');
    const select=async id=>{const el=player.shadowRoot.querySelector('[aria-label="Playback source"]');el.value=id;el.dispatchEvent(new Event('change',{bubbles:true}));await delay(150);await page.updateComplete;await sheet()?.updateComplete;};
    const input=async(label,value,type='input')=>{const el=sheet().shadowRoot.querySelector('[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event(type,{bubbles:true}));await sheet().updateComplete;};
    const button=text=>[...sheet().shadowRoot.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    const saved=async n=>{for(let i=0;i<120;i++){await delay(50);if(page.snapshot.recordings.length===n&&!sheet()?.busy)break;}check(page.snapshot.recordings.length===n&&!sheet()?.error,sheet()?.error||'Recording did not save');};
    check(!page.shadowRoot.querySelector('[slot=source-tools]'),'Synth has recording details');
    await select('add-recording');check(!!sheet(),'Empty library cannot add');
    check(player.sourceId==='synth','Add action changed playback source');
    check(!sheet().shadowRoot.querySelector('textarea, [aria-label="Import sync JSON"]'),'Sync editor remains');
    await input('Recording name','YouTube take');await input('YouTube URL','https://foreign.test/video');
    button('Attach recording').click();await delay(100);check(sheet().error.includes('YouTube'),'Invalid URL accepted');
    await input('YouTube URL','https://youtu.be/M7lc1UVf-VE');button('Attach recording').click();await saved(1);
    const youtubeId=page.snapshot.recordings[0].id;
    check(sheet().recordingId===youtubeId,'New recording was not selected');
    check(sheet().shadowRoot.querySelector('a.source-link')?.href==='https://www.youtube.com/watch?v=M7lc1UVf-VE','Saved link hidden');
    check(sheet().shadowRoot.textContent.includes('No sync points'),'Missing unsynced state');
    await select('add-recording');await input('Recording name','Uploaded take');await input('Recording type','audio','change');
    const hz=48000,pcm=new Uint8Array(44+hz*300*2),v=new DataView(pcm.buffer);const str=(s,o)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));str('RIFF',0);v.setUint32(4,pcm.length-8,true);str('WAVEfmt ',8);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,hz,true);v.setUint32(28,hz*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str('data',36);v.setUint32(40,pcm.length-44,true);
    const dt=new DataTransfer();dt.items.add(new File([pcm],'take.wav',{type:'audio/wav'}));const file=sheet().shadowRoot.querySelector('[aria-label="Audio file"]');file.files=dt.files;file.dispatchEvent(new Event('change',{bubbles:true}));await sheet().updateComplete;
    button('Attach recording').click();await saved(2);
    const audioId=page.snapshot.recordings.find(r=>r.kind==='audio').id;
    check(sheet().recordingId===audioId,'Uploaded recording not selected');
    check(!sheet().shadowRoot.textContent.includes('YouTube take'),'Panel lists other recordings');
    await player.startSource();await delay(150);check(player.playback.state==='playing','Uploaded audio did not play');player.pause();
    // An operator import supplies timings; the panel only reads them.
    await page.client.saveRecording('piece',audioId,page.snapshot.piece.revision,{name:'Uploaded take',rawSync:[[0,1],[1,6,240],[2,11]]});
    await page.refreshSnapshot();await select(youtubeId);check(sheet().recordingId===youtubeId,'Selection did not change details');await select(audioId);
    const stats=[...sheet().shadowRoot.querySelectorAll('dd')].map(el=>el.textContent);
    check(stats[0]==='3'&&stats[1].includes('Performed bar 1')&&stats[1].includes('1 s')&&stats[2].includes('Performed bar 3')&&stats[2].includes('11 s'),'Wrong sync statistics');
    await input('Recording name','Renamed take');button('Save changes').click();await delay(300);await saved(2);
    check(page.snapshot.recordings.find(r=>r.id===audioId).syncpoints==='[[0,1],[1,6,240],[2,11]]','Rename changed sync data');
    await input('Recording name','Conflict draft');await page.client.changeTags('piece',sheet().snapshot.piece.revision,{add:[{dimension:'practice',value:'today'}]});
    button('Save changes').click();await delay(250);check(sheet().conflict,'Stale write did not conflict');
    button('Reload and review').click();await delay(250);check(!sheet().conflict&&sheet().name==='Renamed take','Reload did not restore saved recording');
    await select(youtubeId);button('Delete recording').click();await sheet().updateComplete;button('Keep recording').click();await sheet().updateComplete;check(page.snapshot.recordings.length===2,'Cancel deleted recording');
    button('Delete recording').click();await sheet().updateComplete;button('Confirm deletion').click();await saved(1);
    check(!sheet()&&player.sourceId==='synth','Delete did not close details and return to synth');
    await select(audioId);page.shadowRoot.querySelector('[slot=source-tools]').click();await delay(200);
    check(sheet()?.recordingId===audioId,'Details button did not open selected recording');
    page.shadowRoot.querySelector('button[slot=actions]').click();await page.updateComplete;check(!sheet()&&page.shadowRoot.querySelector('mnx-studio-tags'),'Tags did not replace panel');
    return {audioId};
  })()`);
  await c.send('Page.reload');await new Promise(r=>setTimeout(r,1200));
  const reloaded=await c.evaluate(`(async()=>{for(let i=0;i<100;i++){const page=document.querySelector('mnx-studio')?.shadowRoot?.querySelector('mnx-studio-piece'),p=page?.shadowRoot?.querySelector('mnx-player');if(p?.performance&&p.recordings.length===1)return p.recordings;await new Promise(r=>setTimeout(r,50));}return [];})()`);
  assert.equal(reloaded[0]?.id,result.audioId);assert.equal(reloaded[0]?.name,'Renamed take');assert.equal(reloaded[0]?.syncpoints.length,3);assert.equal(uploads,1);assert.ok(canonicalReads>=3);
  await c.send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await c.evaluate(`(async()=>{const page=document.querySelector('mnx-studio').shadowRoot.querySelector('mnx-studio-piece'),player=page.shadowRoot.querySelector('mnx-player');await player.selectSource(player.recordings[0].id);await page.updateComplete;page.shadowRoot.querySelector('[slot=source-tools]').click();await new Promise(r=>setTimeout(r,250));const sheet=page.shadowRoot.querySelector('mnx-studio-recordings');if(sheet.getBoundingClientRect().width>360)throw Error('Panel overflows mobile');})()`);
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/recording-management-mobile.png',Buffer.from(shot.result.data,'base64'));
  assert.deepEqual(c.logs,[]);console.log('Recording management smoke OK',JSON.stringify({uploads,...result,reloaded:reloaded.length}));
} catch(e) {if(c){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/recording-management-failure.png',Buffer.from(shot.result.data,'base64'));}throw e;}
finally {
  if(c&&ws?.readyState===WebSocket.OPEN)await Promise.race([c.send('Browser.close'),new Promise(r=>setTimeout(r,1000))]);
  ws?.close();if(chrome.exitCode===null)chrome.kill();if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),new Promise(r=>setTimeout(r,1000))]);
  proxy.closeAllConnections();await new Promise(r=>proxy.close(r));staticServer.server.closeAllConnections();await new Promise(r=>staticServer.server.close(r));await mf.dispose();await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
