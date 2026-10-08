// Per-design measurements for tests/plucked.test.mjs, run in worker threads (one
// factory design per job); the test asserts on what is returned.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CONTRACT} from '../../web/contract/index.js';
import {mono,envelope,levelAt,peakAfter,decayTime,onsetFlux} from '../../web/contract/conformance/measure.js';
import {hostRender} from './host-renderer.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),read=p=>JSON.parse(fs.readFileSync(ROOT+p));
export const setupFor=(design,layout,extra={})=>({contract:CONTRACT,session:{},
 parts:[{id:'gtr',instrument:{kind:'plucked',design,...(layout?{layout}:{})},...extra}]});
// Palm-mute decay ratio, dead-note level, legato onset flux, and let ring against the same note released.
export function techniqueHolds(id){
 const p=read('web/data/instrument-v2/presets.json').find(x=>x.id===id),f=read('web/contract/fixtures/plucked-techniques.json'),N=n=>f.notes.find(x=>x.id===n),rate=48000;
 const r=notes=>mono(hostRender({setup:setupFor(p.id),notes,rate,seconds:19}).audio);
 const [open,pm,dead]=[N('open1'),N('pm1'),N('x1')],{techniques,...plain}=N('h2');
 const ratio=decayTime(envelope(r([pm]),rate),pm.at)/decayTime(envelope(r([open]),rate),open.at);
 const de=envelope(r([dead]),rate),deadDb=levelAt(de,dead.at+.08)-peakAfter(de,dead.at,dead.at+.1);
 const flux=onsetFlux(r([N('h1'),N('h2')]),rate,N('h2').at)/onsetFlux(r([{...plain,id:'plain'}]),rate,N('h2').at);
 const lr=N('lr1'),{techniques:_,...damped}=lr,t=lr.at+lr.duration+1,free=p.instrument.strings.freeRinging[5]===1;
 const ring=levelAt(envelope(r([lr]),rate),t),stop=levelAt(envelope(r([{...damped,id:'damped'}]),rate),t);
 return {ratio,deadDb,flux,ring,stop,free};
}
