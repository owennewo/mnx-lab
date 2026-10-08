// Synth app end-to-end flows, chain first (chain campaign Phase 6). Run against
// `npm start` (or STUDIO_URL, e.g. a server on dist/app). Isolated browser profile;
// set PLAYWRIGHT_MODULE / CHROME_PATH as for the other browser tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateRig} from '../web/host/rig.js';
const specifier=process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright';
const {chromium}=await import(specifier);
const out=process.env.APP_TEST_OUTPUT||'build/browser-ui',base=(process.env.STUDIO_URL||'http://localhost:8080').replace(/\/$/,'');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('dialog',d=>d.type()==='prompt'?d.accept(page.nextPrompt??''):d.accept());
const failures=[];const step=async(name,fn)=>{try{await fn();console.log('ok  ',name);}catch(e){failures.push(name);console.log('FAIL',name,'—',e.message.split('\n').slice(0,8).join(' | '));await page.screenshot({path:`${out}/app-fail-${name.replace(/\W+/g,'-')}.png`}).catch(()=>{});}};
const sessionData=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('synth2.session')));
const data=key=>page.evaluate(k=>document.documentElement.dataset[k],key);
const ready=async(p=page)=>p.waitForSelector('html[data-ready="true"]');
const resetPeak=()=>page.evaluate(()=>{document.documentElement.dataset.peak='0';});
const sounding=async(timeout=15000)=>{await resetPeak();await page.waitForFunction(()=>Number(document.documentElement.dataset.peak||0)>1e-3,undefined,{timeout});};
const stopped=()=>page.waitForFunction(()=>document.documentElement.dataset.audioState==='stopped');
const play=()=>page.getByRole('button',{name:/^(Play|Restart)$/}).click(),stop=()=>page.getByRole('button',{name:'Stop',exact:true}).click();
const menu=async(button,item)=>{await page.getByRole('button',{name:button}).click();await page.getByRole('menuitem',{name:item}).click();};
const addPart=name=>menu('+ Add part',new RegExp('^'+name));
const addEffect=(part,fx)=>menu(`Add an effect to ${part}`,new RegExp('^'+fx));
const chainOf=async id=>(await sessionData()).setup.parts.find(p=>p.id===id).chain.map(b=>`${b.type}:${b.state}`);
const piece=id=>page.getByRole('combobox',{name:'Piece'}).selectOption(id);
const example=async name=>{await menu('Session menu','Examples…');await page.getByRole('menuitem',{name:new RegExp('^'+name)}).click();await page.getByRole('status').filter({hasText:'Loaded '+name}).last().waitFor();};
const openInspect=async()=>{if(!await page.locator('details.inspect[open]').count())await page.locator('details.inspect summary').click();};
const openFile=async(name,text,p=page)=>{await p.getByRole('button',{name:'Session menu'}).click();await p.locator('input[aria-label="Open a rig, event log or fixture"]').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});};
let exportedRig;

await page.goto(base+'/');await ready();
await step('app loads with one guitar lane, a Room bus and a master, and no errors',async()=>{
 assert.equal(await data('parts'),'1');assert.ok(await page.getByRole('button',{name:/^RETURN BUS/}).count());assert.ok(await page.getByRole('button',{name:/^MASTER/}).count());
 assert.equal(errors.length,0,errors.join('; '));await page.screenshot({path:`${out}/app-desktop.png`});
});
await step('the selected instrument previews a note and Stop silences it',async()=>{
 await page.getByRole('button',{name:'Hear a note',exact:true}).click();await sounding();await stop();await stopped();
 await page.waitForFunction(()=>document.querySelector('#meter')?.style.width==='0%');
});
await step('play produces audio, Stop stops',async()=>{await play();await sounding();await stop();await stopped();});
await step('keys and kit lanes join the session; a band piece plays all three without warnings, each strip meters its part',async()=>{
 await addPart('Keys');await addPart('Kit');assert.equal(await data('parts'),'3');
 assert.equal(await page.locator('.no-line').count(),2,'the guitar piece has no keys or kit line');await piece('band-groove');assert.equal(await page.locator('.no-line').count(),0);
 await play();await sounding();await page.waitForTimeout(2500);
 for(const id of ['guitar','keys','kit'])assert.ok(await page.evaluate(id=>parseFloat(document.querySelector(`[data-meter="${id}"]`)?.style.width||'0')>0,id),`${id} strip meter moves`);
 assert.equal(await page.locator('.diagnostics-list li.warning,.diagnostics-list li.error').count(),0);await stop();await page.screenshot({path:`${out}/app-three-parts.png`});
});
await step('effects are added from + and their state pill toggles On ⇄ Off',async()=>{
 await addEffect('Guitar','Drive');await addEffect('Guitar','Echo');assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on']);
 await page.getByRole('button',{name:/^Drive is on/}).click();assert.deepEqual(await chainOf('guitar'),['drive:off','echo:on']);
 assert.ok(await page.locator('.block.effect.state-off').count(),'an Off block is drawn as a dotted chip');
 await page.getByRole('button',{name:/^Drive is off/}).click();assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on']);
});
await step('blocks reorder by keyboard and by drag, Delete removes, Undo and Redo restore',async()=>{
 await page.getByRole('button',{name:/^Echo, on/}).click();await page.keyboard.press('Alt+ArrowLeft');assert.deepEqual(await chainOf('guitar'),['echo:on','drive:on']);
 await page.locator('.lane[data-part="guitar"] .block.effect',{hasText:'Drive'}).dragTo(page.locator('.lane[data-part="guitar"] .block.effect',{hasText:'Echo'}),{targetPosition:{x:5,y:40}});
 assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on']);
 await page.locator('.lane[data-part="guitar"] .block.effect',{hasText:'Drive'}).dragTo(page.locator('.lane[data-part="kit"]'),{targetPosition:{x:600,y:40}});
 assert.deepEqual(await chainOf('kit'),['drive:on']);assert.deepEqual(await chainOf('guitar'),['echo:on']);
 await page.getByRole('button',{name:'Undo'}).click();await page.waitForTimeout(600);assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on']);
 await page.getByRole('button',{name:/^Echo, on/}).click();await page.keyboard.press('Delete');assert.deepEqual(await chainOf('guitar'),['drive:on']);
 await page.waitForTimeout(600);await page.getByRole('button',{name:'Undo'}).click();assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on']);
 await page.getByRole('button',{name:'Redo'}).click();assert.deepEqual(await chainOf('guitar'),['drive:on']);
 await page.getByRole('button',{name:'Undo'}).click();assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on']);
});
await step('the effect editor changes presets, echo time and duplicates; live while playing',async()=>{
 await play();await sounding();await page.getByRole('button',{name:/^Echo, on/}).click();
 await page.getByRole('combobox',{name:'Preset'}).selectOption('Slapback');let echo=(await sessionData()).setup.parts[0].chain[1];assert.equal(echo.params.beats,.25);
 await page.getByRole('button',{name:'1/4',exact:true}).click();echo=(await sessionData()).setup.parts[0].chain[1];assert.equal(echo.params.beats,1);assert.equal(echo.preset,undefined);
 const dial=page.getByRole('slider',{name:'Feedback'});await dial.focus();await page.keyboard.press('ArrowUp');assert.ok((await sessionData()).setup.parts[0].chain[1].params.feedback>.12);
 await page.getByRole('button',{name:'Duplicate',exact:true}).click();assert.deepEqual(await chainOf('guitar'),['drive:on','echo:on','echo:on']);
 await sounding();await stop();await page.screenshot({path:`${out}/app-effect.png`});
});
await step('mute and solo on the strips: muted lane dims, solo dims the others',async()=>{
 await page.getByRole('button',{name:'Mute Keys'}).click();assert.equal((await sessionData()).setup.parts[1].strip.mute,true);assert.ok(await page.locator('.lane-row.dimmed').count()===1);
 await page.getByRole('button',{name:'Mute Keys'}).click();await page.getByRole('button',{name:'Solo Kit'}).click();assert.equal(await page.locator('.lane-row.dimmed').count(),2);
 await page.getByRole('button',{name:'Solo Kit'}).click();assert.equal(await page.locator('.lane-row.dimmed').count(),0);
});
await step('a live knob edit on the guitar makes an own copy of the design; Save design survives a reload',async()=>{
 await page.getByRole('button',{name:/^Guitar instrument/}).click();await play();await sounding();
 const dial=page.getByRole('slider',{name:'Bass sustain'});await dial.focus();await page.keyboard.press('ArrowUp');
 const d=(await sessionData()).setup.parts[0].instrument.design;assert.equal(d.factory,false);assert.match(d.name,/edited/);await stop();
 page.nextPrompt='My test design';await page.getByRole('button',{name:'Save design…'}).click();await page.getByRole('status').filter({hasText:'Design saved.'}).waitFor();
 await page.reload();await ready();assert.ok(await page.getByRole('combobox',{name:'Design'}).locator('option',{hasText:'My test design'}).count());
});
await step('a ukulele lane has four strings and plays the ukulele piece without diagnostics',async()=>{
 await addPart('Ukulele');const uke=(await sessionData()).setup.parts.find(p=>p.name==='Ukulele');assert.equal(uke.instrument.layout.strings.length,4);
 await page.getByRole('tab',{name:'Layout'}).click();assert.equal(await page.locator('.strings li').count(),4);
 await piece('ukulele-strum');assert.equal(await page.locator('.lane[data-part="ukulele"] .no-line').count(),0,'the ukulele line goes to the ukulele');
 await play();await sounding();await page.waitForTimeout(1500);assert.equal(await page.locator('.diagnostics-list li.warning,.diagnostics-list li.error').count(),0);await stop();
});
await step('master: volume and ceiling knobs, limiter and peak readouts',async()=>{
 await page.getByRole('button',{name:/^MASTER/}).click();await play();await sounding();await page.waitForTimeout(800);
 assert.match(await page.locator('#master-peak-text').textContent(),/dB/);
 const dial=page.getByRole('slider',{name:'Volume'});await dial.focus();await page.keyboard.press('ArrowUp');assert.ok((await sessionData()).setup.session.master.volumeDb>0);
 await stop();await page.screenshot({path:`${out}/app-master.png`});
});
await step('Reset returns an effect, the guitar design, a strip, the bus and the master to their defaults; Level trims the guitar',async()=>{
 const guitar=async()=>(await sessionData()).setup.parts[0];
 await page.getByRole('button',{name:/^Echo, on/}).first().click();const preset=(await guitar()).chain[1].basePreset;
 const fb=page.getByRole('slider',{name:'Feedback'});await fb.focus();await page.keyboard.press('ArrowUp');assert.equal((await guitar()).chain[1].preset,undefined);
 await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal((await guitar()).chain[1].preset,preset,'effect back to its preset');
 await page.getByRole('button',{name:/^Guitar instrument/}).click();await page.getByRole('combobox',{name:'Design'}).selectOption('clear-steel');
 const lv=page.getByRole('slider',{name:'Level',exact:true});await lv.focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowUp');
 let d=(await guitar()).instrument.design;assert.ok(d.trimDb>0,'Level trims the design');assert.equal(d.source,'clear-steel');
 await page.getByRole('button',{name:'Reset',exact:true}).click();d=(await guitar()).instrument.design;assert.equal(d.id,'clear-steel');assert.equal(d.trimDb,undefined,'back to the factory design');
 await page.getByRole('button',{name:'Guitar channel strip',exact:true}).click();const pan=page.getByRole('slider',{name:'Pan'});await pan.focus();await page.keyboard.press('ArrowLeft');
 await page.getByRole('button',{name:'Mute',exact:true}).click();await page.getByRole('button',{name:'Reset',exact:true}).click();
 const st=(await guitar()).strip;assert.deepEqual([st.levelDb,st.pan,st.mute,st.solo,st.sends.room],[0,0,false,false,.3]);
 await page.getByRole('button',{name:/^RETURN BUS/}).click();await page.getByRole('combobox',{name:'Preset'}).selectOption('Hall');
 const dec=page.getByRole('slider',{name:'Decay'});await dec.focus();await page.keyboard.press('ArrowUp');await page.getByRole('button',{name:'Reset',exact:true}).click();
 assert.equal((await sessionData()).setup.session.buses[0].preset,'Hall','bus back to its last preset');
 await page.getByRole('button',{name:/^MASTER/}).click();const vol=page.getByRole('slider',{name:'Volume'});await vol.focus();await page.keyboard.press('PageDown');
 await page.getByRole('button',{name:'Reset',exact:true}).click();assert.deepEqual([(await sessionData()).setup.session.master.volumeDb,(await sessionData()).setup.session.master.ceilingDb],[0,-1]);
 await page.getByRole('button',{name:/^RETURN BUS/}).click();await page.getByRole('combobox',{name:'Preset'}).selectOption('Studio');
});
await step('the Room bus switches off and back on',async()=>{
 await page.getByRole('button',{name:/^RETURN BUS/}).click();await page.getByRole('group',{name:'Bus state'}).getByRole('button',{name:'Off'}).click();
 assert.equal((await sessionData()).setup.session.buses[0].state,'off');await page.getByRole('group',{name:'Bus state'}).getByRole('button',{name:'On'}).click();
});
await step('export is a valid rig 3.0.0; it imports back; old rig files and broken JSON are refused without replacing the session',async()=>{
 await page.getByRole('button',{name:'Session menu'}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('menuitem',{name:/^Export session/}).click()]);
 exportedRig=JSON.parse(fs.readFileSync(await download.path(),'utf8'));validateRig(exportedRig);assert.equal(exportedRig.setup.parts.length,4);
 const before=await sessionData();
 for(const [name,text,message] of [['broken.json','{broken',/not JSON/],['old.rig.json',JSON.stringify({schemaVersion:2,rigVersion:'2.0.0',name:'old',session:{},parts:[]}),/rig 3\.0\.0/]]){
  await openFile(name,text);await page.getByRole('alert').filter({hasText:message}).waitFor();assert.deepEqual(await sessionData(),before);}
 await openFile('back.rig.json',JSON.stringify({...exportedRig,name:'Imported back'}));await page.getByRole('status').filter({hasText:'Loaded Imported back.'}).waitFor();
 assert.equal((await sessionData()).name,'Imported back');assert.equal(await data('parts'),'4');
});
await step('named session saves, reopens after reload, and A/B compares saved with edited',async()=>{
 page.nextPrompt='Evening session';await page.getByRole('button',{name:'Save session',exact:true}).click();await page.getByRole('status').filter({hasText:'Session saved.'}).waitFor();
 await page.getByRole('button',{name:'Mute Keys'}).click();await page.getByRole('button',{name:'A · Saved'}).click();await page.getByRole('status').filter({hasText:/Hearing the saved version/}).waitFor();
 await page.getByRole('button',{name:'B · Edited'}).click();assert.equal(await page.locator('.compare-banner').count(),0);
 await page.reload();await ready();await menu('Session menu','Open “Evening session”');assert.equal((await sessionData()).name,'Evening session');
 assert.equal((await sessionData()).setup.parts[1].strip.mute,false,'the saved version, before the mute');
});
await step('the Piece picker changes only the music; a line nobody plays shows a ghost lane that adds the part',async()=>{
 const before=(await sessionData()).setup;await piece('guitar-strums');assert.deepEqual((await sessionData()).setup,before,'the rig is unchanged');assert.equal((await sessionData()).piece,'guitar-strums');
 await example('Guitar – strums');assert.equal(await data('parts'),'1');await piece('band-groove');assert.equal(await data('parts'),'1');assert.equal(await data('ghosts'),'2');
 await page.getByRole('button',{name:'Add a keys part'}).click();assert.equal(await data('parts'),'2');assert.equal(await data('ghosts'),'1');
 await page.screenshot({path:`${out}/app-ghost.png`,fullPage:true});
});
await step('the Examples menu lists every piece with its description, without overlapping or clipped items',async()=>{
 await menu('Session menu','Examples…');const items=page.locator('.menu .menu-item');assert.ok(await items.count()>=12);
 assert.ok(await page.evaluate(()=>{const r=[...document.querySelectorAll('.menu .menu-item')].map(e=>e.getBoundingClientRect());return r.every((a,i)=>!i||a.top>=r[i-1].bottom-.5);}),'items do not overlap');
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].every(e=>e.scrollHeight<=e.clientHeight+1)),'descriptions are not clipped');
 await page.keyboard.press('Escape');
});
await step('an example loads its setup and piece; its checks pass in the browser worker; an edit turns them into an analysis',async()=>{
 await example('Ukulele – re-entrant strum');const s=await sessionData();assert.equal(s.piece,'ukulele-strum');assert.deepEqual(s.setup.parts.map(p=>p.id),['ukulele']);
 await openInspect();await page.getByRole('button',{name:'Run checks'}).click();await page.waitForFunction(()=>document.documentElement.dataset.checks,undefined,{timeout:120000});
 assert.equal(await data('checks'),'true');assert.ok(await page.getByText('All checks pass.').count());
 await play();await sounding();await stop();await page.screenshot({path:`${out}/app-example.png`,fullPage:true});
 await page.getByRole('button',{name:'Mute Ukulele'}).click();assert.equal(await page.getByRole('button',{name:'Run checks'}).count(),0);
 assert.ok(await page.getByRole('button',{name:'Analyse what I’m hearing'}).count());
 await page.evaluate(()=>{delete document.documentElement.dataset.checks;});await page.getByRole('button',{name:'Analyse what I’m hearing'}).click();
 await page.waitForFunction(()=>document.documentElement.dataset.checks==='analysed',undefined,{timeout:120000});assert.ok(await page.locator('.inspect table').count(),'note labels shown');
});
// Each example brings its own part ids, created while the host has long been running:
// they must sound at their first note, not after a delay as long as the session so far.
await step('examples played back to back with different parts each sound on time; a test fixture opens from Inspect',async()=>{
 for(const name of ['Band – four-bar groove','Kit – groove','Keys – pedal','Guitar – recorded','Band – slow ballad']){
  await example(name);await resetPeak();await play();
  await page.waitForFunction(()=>Number(document.documentElement.dataset.peak||0)>1e-3,undefined,{timeout:2500}).catch(()=>{throw Error(`${name} silent 2.5 s after Play`);});await stop();
 }
 await openInspect();await page.getByRole('combobox',{name:'Test fixture'}).selectOption('kit-chokes');await page.getByRole('status').filter({hasText:'kit-chokes'}).last().waitFor();
 assert.ok(await page.getByRole('button',{name:'Run checks'}).count(),'a test fixture is checkable as written');
});
await step('Export what I’m hearing gives an event log that opens back with its music',async()=>{
 await example('Guitar – fingerpicked');await piece('guitar-dynamics');
 await page.getByRole('button',{name:'Session menu'}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('menuitem',{name:/^Export what I’m hearing/}).click()]);
 const log=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(log.contract,'mnx-sound/2');assert.ok(log.notes.length>40);
 await example('Kit – groove');await openFile('hearing.events.json',JSON.stringify(log));
 // The earlier example's toast can still be showing: wait for the opened file itself.
 await page.waitForFunction(()=>typeof JSON.parse(localStorage.getItem('synth2.session')).piece==='object');
 const s=await sessionData();assert.equal(typeof s.piece,'object');assert.equal(s.setup.parts[0].instrument.design.id,'soft-nylon');
 assert.ok(await page.getByRole('combobox',{name:'Piece'}).locator('option',{hasText:'(file)'}).count());await play();await sounding();await stop();
});
await step('phone width: lanes become lists, a block opens a sheet, no horizontal overflow',async()=>{
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'chain view fits');
 await addEffect('Guitar','Echo');await page.getByRole('button',{name:/^Echo, on/}).first().click();assert.ok(await page.locator('.detail.open').isVisible());await page.screenshot({path:`${out}/app-mobile-sheet.png`});
 await page.getByRole('button',{name:'Close'}).click();assert.equal(await page.locator('.detail.open').count(),0);await page.screenshot({path:`${out}/app-mobile.png`,fullPage:true});
 await openInspect();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'the Inspect panel fits');
 await page.setViewportSize({width:1440,height:1000});
});

// Corruption/quota probes use separate profiles, never the main test's saved sessions.
async function isolatedStorage(seed,run){
 const isolated=await browser.newContext({viewport:{width:1440,height:1000}}),p=await isolated.newPage(),problems=[];
 await isolated.addInitScript(seed);p.on('pageerror',e=>problems.push(e.message));p.on('dialog',d=>d.type()==='prompt'?d.accept(p.nextPrompt??''):d.accept());
 try{await p.goto(base+'/');await ready(p);await run(p);assert.deepEqual(problems,[]);}finally{await isolated.close();}
}
await step('damaged storage starts safely, retains bytes and creates recovery copies before named saves',async()=>{
 await isolatedStorage(()=>{if(!localStorage.getItem('corruption-seeded')){localStorage.setItem('synth2.session','not JSON');localStorage.setItem('synth2.designs','{"wrong":"shape"}');localStorage.setItem('synth2.sessions','{}');localStorage.setItem('corruption-seeded','1');}},async p=>{
  assert.equal(await p.evaluate(()=>localStorage.getItem('synth2.designs')),'{"wrong":"shape"}');
  p.nextPrompt='Recovered design';await p.getByRole('button',{name:'Save design…'}).click();
  assert.equal(await p.evaluate(()=>localStorage.getItem('synth2.designs.before-recovery')),'{"wrong":"shape"}');
  assert.equal(await p.evaluate(()=>localStorage.getItem('synth2.session.before-recovery')),'not JSON');
  p.nextPrompt='Recovered session';await p.getByRole('button',{name:'Save session',exact:true}).click();
  assert.equal(await p.evaluate(()=>localStorage.getItem('synth2.sessions.before-recovery')),'{}');
  await p.reload();await ready(p);assert.ok(await p.getByRole('combobox',{name:'Design'}).locator('option',{hasText:'Recovered design'}).count());
 });
});
await step('storage quota errors never announce a named save or discard the edited design',async()=>{
 await isolatedStorage(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='synth2.designs'||k==='synth2.sessions')throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,k,v);};},async p=>{
  const dial=p.getByRole('slider',{name:'Bass sustain'});await dial.focus();await p.keyboard.press('ArrowUp');
  const value=await dial.getAttribute('aria-valuetext');p.nextPrompt='Must not be saved';await p.getByRole('button',{name:'Save design…'}).click();
  await p.getByRole('alert').filter({hasText:/Could not save the design/}).waitFor();assert.equal(await dial.getAttribute('aria-valuetext'),value);
  assert.equal(await p.evaluate(()=>localStorage.getItem('synth2.designs')),null);assert.equal(await p.getByRole('status').filter({hasText:/Design saved/}).count(),0);
  p.nextPrompt='Unsaved';await p.getByRole('button',{name:'Save session',exact:true}).click();await p.getByRole('alert').filter({hasText:/Could not save the session/}).waitFor();
  assert.equal(await p.evaluate(()=>localStorage.getItem('synth2.sessions')),null);assert.equal(await p.getByRole('status').filter({hasText:/Session saved/}).count(),0);
 });
});
await browser.close();
console.log('page errors:',errors.length?errors:'none');
if(failures.length||errors.length){console.log(`${failures.length} app step(s) failed`);process.exit(1);}
console.log('Synth app check passed.');
