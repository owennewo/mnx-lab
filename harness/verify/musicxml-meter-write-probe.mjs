// A bounded authoring probe, not a corpus-wide support claim.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn,execFileSync } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
import {validateRootExt} from '../../worker/generated/validate-extensions.mjs';
import { devtoolsPort,connect,client,waitFor } from './browserHarness.mjs';
import { serveStatic } from './staticServer.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=process.env.MUSICXML_WRITE_DIR??'/tmp/mnx-musicxml-meter-write';await fs.mkdir(out,{recursive:true});
const site=await serveStatic(path.join(root,'dist/client'));
const profile=await fs.mkdtemp('/tmp/mnx-write-browser-');
const chrome=spawn(process.env.CHROME_BIN??'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
const report={fixture:'11a-TimeSignatures',shell:'workbench',applicationCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'First-bar meter: remove, create, change, common/cut display data, grammar rejection, exact undo/redo, JSON clipboard/MNX reopen',actions:[]};
try{
 ws=new WebSocket(await connect(await devtoolsPort(profile)));await once(ws,'open');const c=client(ws);
 await c.send('Runtime.enable');await c.send('Page.enable');await c.send('DOM.enable');
 await c.send('Browser.grantPermissions',{origin:`http://127.0.0.1:${site.port}`,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
 report.browser=(await c.send('Browser.getVersion')).result;
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await c.send('Page.navigate',{url:`http://127.0.0.1:${site.port}/workbench/`});
 const app="document.querySelector('mnx-workbench')";
 const page=`${app}.shadowRoot.querySelector('mnx-scenario-page')`;
 const viewer=`${page}.shadowRoot.querySelector('mnx-document-viewer')`;
 const session=`${page}.editor.session`;
 await waitFor(c,`!!${app}?.shadowRoot?.querySelector('#local-file')`,'file input');
 const input=await c.send('Runtime.evaluate',{expression:`${app}.shadowRoot.querySelector('#local-file')`});
 await c.send('DOM.setFileInputFiles',{objectId:input.result.result.objectId,files:[path.join(root,'converters/fixtures/musicxml-suite/xmlFiles/11a-TimeSignatures.musicxml')]});
 await waitFor(c,`!!${page}?.editor && !!${viewer}?.shadowRoot?.querySelector('svg')`,'imported editable score');
 await c.evaluate(`${viewer}.focus()`);
 const read=()=>c.evaluate(`${session}.doc`);
 const key=async(code,key,vk,modifiers=0)=>{report.actions.push({code,key,modifiers});await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,key,windowsVirtualKeyCode:vk,modifiers});await c.send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk,modifiers});};

 const find=tag=>`(()=>{const roots=[document];while(roots.length){const r=roots.shift();const hit=r.querySelector('${tag}');if(hit)return hit;for(const e of r.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}return null;})()`;
 const inspector=find('mnx-rung-inspector');
 const snapshot=async name=>{const d=await read();assert.equal(validateMnx(d),true,JSON.stringify(validateMnx.errors));assert.equal(validateRootExt(d._x.mnxLab),true,JSON.stringify(validateRootExt.errors));await fs.writeFile(path.join(out,name+'.mnx.json'),JSON.stringify(d,null,2)+'\n');return d;};
 const exact=async expected=>{try{await waitFor(c,`JSON.stringify(${session}.doc)===${JSON.stringify(JSON.stringify(expected))}`,'exact document state');}catch(error){report.debug={actual:await read(),expected,inspector:await c.evaluate(`(${inspector})?.shadowRoot?.textContent`)};throw error;}};
 await key('Digit5','%',53,8);
 await waitFor(c,`${session}.selectionLevel==='measure'`,'bar selection');
 const type=async text=>{report.actions.push({type:'text',text});for(const ch of text){await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:ch,text:ch});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:ch});}};
 const close=async()=>{for(let i=0;i<3&&await c.evaluate(`!!(${inspector})`);i++)await key('Escape','Escape',27);await c.evaluate(`${viewer}.focus()`);};
 const command=async(text,submit=true)=>{await key('Digit5','%',53,8);await waitFor(c,`${session}.selectionLevel==='measure'`,'bar selection before command');await key('Enter','Enter',13);await waitFor(c,`!!(${inspector})`,'rung inspector');await type(text);if(submit)await key('Enter','Enter',13);};
 const history=async(before,after)=>{await close();await key('KeyZ','z',90,2);await exact(before);await key('KeyY','y',89,2);await exact(after);};
 const changes=[['remove','time inherit',null],['create','time 5/4',{count:5,unit:4}],['change','time 6/4',{count:6,unit:4}],['common','time common',{count:4,unit:4,display:'common'}],['cut','time cut',{count:2,unit:2,display:'cut'}],['wide','time 33/4',{count:33,unit:4}],['fine','time 3/128',{count:3,unit:128}]];
 report.tasks=[];
 await snapshot('initial');
 for(const [name,text,value]of changes){const before=await read();const expected=structuredClone(before);if(value)expected.global.measures[0].time=value;else delete expected.global.measures[0].time;
 const content=expected.parts[0].measures[0].sequences[0].content;content.splice(1);if(name==='create')content.push({duration:{base:'quarter'},rest:{}});if(name==='wide')for(let i=0;i<29;i++)content.push({duration:{base:'quarter'},rest:{}});if(name==='change')content.push({duration:{base:'quarter'},rest:{}},{duration:{base:'quarter'},rest:{}});
 await command(text);await exact(expected);const after=await snapshot(name);await history(before,after);report.tasks.push({task:name,command:text,verdict:'supported',expected:value,unrelatedData:'all notes and all other measures exactly preserved; only first-bar meter and expected trailing rest padding change',undoRedo:'exact'});}
 report.rejections=[];
 for(const text of ['time 3+2/8','time 0/4','time 3/256','time 1025/4','time 9007199254740993/4','time 3/4 single-number']){
 const before=await read();await command(text);await waitFor(c,`!!(${inspector})?.shadowRoot?.querySelector('.error')?.textContent`,'grammar rejection');await exact(before);
 const error=await c.evaluate(`(${inspector}).shadowRoot.querySelector('.error').textContent`);report.rejections.push({command:text,error,documentUnchanged:true});const shot=await c.send('Page.captureScreenshot');await fs.writeFile(path.join(out,'rejected-'+report.rejections.length+'.png'),Buffer.from(shot.result.data,'base64'));await close();}
 const beforeCancel=await read();await command('time 4/4',false);await close();await exact(beforeCancel);report.cancellation='typed valid command then Escape: document unchanged';
 const copySelector=`(()=>{const roots=[document];while(roots.length){const r=roots.shift();const hit=r.querySelector('button[title="copy the document as JSON"]');if(hit)return hit;for(const e of r.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}return null;})()`;
 await c.evaluate(`(()=>{const roots=[document];while(roots.length){const r=roots.shift();const b=[...r.querySelectorAll('button')].find(b=>b.textContent.trim().toUpperCase()==='JSON');if(b){b.click();return;}for(const e of r.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}})()`);
 await waitFor(c,`!!(${copySelector})`,'JSON copy');await c.evaluate(`(${copySelector}).click()`);const copied=await c.evaluate('navigator.clipboard.readText()');const final=await read();assert.deepEqual(JSON.parse(copied),final);const saved=path.join(out,'copied.mnx.json');await fs.writeFile(saved,copied);
 const inputAgain=await c.send('Runtime.evaluate',{expression:`${app}.shadowRoot.querySelector('#local-file')`});await c.send('DOM.setFileInputFiles',{objectId:inputAgain.result.result.objectId,files:[saved]});await waitFor(c,`${app}.localDocument?.fileName==='copied.mnx.json' && !${app}.openingLocalFile`,'reopened meter document');await exact(final);
 report.persistence={route:'JSON copy → external file save → Open MNX',verdict:'exact final document equality',scope:'final 3/128 state (original whole note retained, with an overfill diagnostic); other intermediate states not individually reopened'};
 report.consoleErrors=c.logs;
}catch(error){report.error=error.message;process.exitCode=1;}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();site.server.close();try{await fs.rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
console.log(JSON.stringify(report,null,2));
