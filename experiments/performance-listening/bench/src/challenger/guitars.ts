import assert from 'node:assert/strict';
import { existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync } from 'node:fs';
import {join} from 'node:path';
import type {StageExample2} from '../stages/stage1v2.ts';
import {assetPath} from '../stages/stage1v2.ts';
import {encode} from '../io.ts';
import {sha} from '../ladder/privateSets.ts';
import {loadSet,mixSamples,tonejsMidi,type SampleSource} from '../ladder/samples.ts';
import {writeWav} from '../generate/wav.ts';
import {validateLabel} from '../events/label.ts';
export const GUITAR_SET='contract2-challenger-guitar-v1';
/** Read development sources only. No held-out manifest or sample is inspected. */
export function developmentSources(root:string,repo:string):SampleSource[]{
  const tone=join(root,'samples/tonejs-instruments-622c2f1/guitar-acoustic');
  const sources:SampleSource[]=[{id:'tonejs-acoustic',name:'steel-string acoustic',group:'development',origin:'University of Iowa',source:'tonejs-instruments@622c2f1',licence:'CC-BY-3.0',attribution:'Nicholas Brosowsky tonejs-instruments',files:readdirSync(tone).filter(f=>f.endsWith('.wav')).map(f=>({midi:tonejsMidi(f),path:join(tone,f),sha256:sha(readFileSync(join(tone,f)))}))}];
  for(const id of ['martin','spanish','fender']) {
    const dir=join(repo,'public/samples',`${id}-guitar-v1`),m=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
    const chosen=new Map<number,{midi:number;file:string;layer?:number;take?:number;sha256:string}>();
    for(const s of m.samples){const c=chosen.get(s.midi);if(!c||(s.layer??0)>(c.layer??0)||((s.layer??0)===(c.layer??0)&&(s.take??0)<(c.take??0)))chosen.set(s.midi,s);}
    sources.push({id,name:m.name,group:'development',source:dir,origin:m.name,licence:m.license,attribution:m.name,files:[...chosen.values()].map(s=>({midi:s.midi,path:join(dir,s.file),sha256:s.sha256}))});
  }
  return sources;
}
export function freezeGuitars(root:string,repo:string,parents:StageExample2[]) {
  const out=join(root,GUITAR_SET);assert(!existsSync(out),'Never overwrite guitar set');mkdirSync(out);
  const examples:StageExample2[]=[],assets:Record<string,string>={},sources=developmentSources(root,repo),construction:object[]=[];
  for(const source of sources){const samples=loadSet(source,join(root,'samples/decoded-48k'));
    for(const base of parents.filter(e=>e.kind==='performance')) {
      const id=`${source.id}-${base.id}`, audioPath=join(out,`${id}.wav`);
      const rendered=base.label.performance.events.flatMap(p=>p.notes.map(n=>{const e=base.label.events[p.index]!, sn=e.notes.find(x=>x.noteKey===n.noteKey)!;
        assert(n.onset!==undefined&&n.end!==undefined);const fromSample=Math.round(n.onset!*48000),toSample=Math.round(n.end!*48000);
        assert(Math.abs(fromSample/48000-p.onset!)<1e-12);return {fromSample,toSample,midi:sn.midi!,hz:440*2**((sn.midi!-69)/12),scoreQuarter:e.quarter,scoreDuration:{num:1,den:1},noteKey:n.noteKey};}));
      const mixed=mixSamples(rendered,samples,base.label.audio!.samples,10**(-12/20));writeFileSync(audioPath,writeWav(mixed.pcm));
      const hash=sha(readFileSync(audioPath));assets[audioPath]=hash;
      for(const parent of parents.filter(e=>e.of===base.id)) {
        const x=structuredClone(parent);x.id=`${source.id}-${parent.id}`;x.of=id;x.label.id=x.id;x.audioPath=audioPath;
        if(x.control==='silence'){x.audioPath=join(out,`${x.id}.wav`);const pcm=new Int16Array(base.label.audio!.samples);assert(pcm.every(v=>v===0));writeFileSync(x.audioPath,writeWav(pcm));assets[x.audioPath]=sha(readFileSync(x.audioPath));}
        x.label.audio={...x.label.audio!,path:x.audioPath,sha256:assets[x.audioPath]!};
        x.label.provenance={...x.label.provenance,recipe:{...(x.label.provenance.recipe as Record<string,unknown>),renderer:'sample-render@1',sampleSource:source.id},note:'Exact stimulus schedule inherited; sample internal attack timing is not independently annotated.'};
        validateLabel(x.label);assets[x.scorePath]=sha(readFileSync(assetPath(x.scorePath)));examples.push(x);
      }
      construction.push({id,parent:base.id,rendered,shifts:mixed.shifts,source:source.id});
    }
  }
  assert.equal(examples.length,576);const manifest={id:GUITAR_SET,version:1,partition:'development',examples,assets,sources,construction};
  const bytes=encode(manifest);writeFileSync(join(out,'manifest.json'),bytes);writeFileSync(join(out,'freeze.json'),encode({sha256:sha(bytes),frozenBeforeCandidate:true}));return manifest;
}
