// The reference cases and how each is rendered (Node host, packaged assets, 48 kHz).
import fs from 'node:fs';
import crypto from 'node:crypto';
import {effectiveEvents} from '../../web/contract/index.js';
import {render} from '../../web/host/node.js';
import {referenceSession} from '../../web/host/workloads.js';
const read=p=>JSON.parse(fs.readFileSync(p));
export function referenceCases(){
 const fixtures=[...fs.readdirSync('web/contract/fixtures').map(f=>'web/contract/fixtures/'+f),...fs.readdirSync('web/data/pieces').filter(f=>f!=='index.json').map(f=>'web/data/pieces/'+f)].filter(f=>f.endsWith('.json')).sort();
 return [...fixtures.map(path=>({id:(path.includes('/pieces/')?'piece:':'fixture:')+read(path).fixture.id,path})),{id:'session:reference',session:'rounded-steel'}];
}
export function renderCase(c){
 let r;
 if(c.path){const f=read(c.path),{notes,controls}=effectiveEvents(f);r=render({setup:f.setup,...(f.batches?{batches:f.batches}:{notes,controls}),rate:48000,seconds:f.render.seconds});}
 else{const s=referenceSession(read('web/data/material/guitar-takes.json'),{guitarDesign:c.session});r=render({setup:s.setup,notes:s.notes,controls:s.controls,rate:48000,seconds:s.seconds});}
 const x=new Float32Array(r.frames*2);for(let i=0;i<r.frames;i++){x[2*i]=r.audio[0][i];x[2*i+1]=r.audio[1][i];}
 let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));
 return {frames:r.frames,peak,sha256:crypto.createHash('sha256').update(new Uint8Array(x.buffer)).digest('hex')};
}
