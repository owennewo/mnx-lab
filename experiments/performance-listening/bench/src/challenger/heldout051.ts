/** 051 fixed held-out stimulus construction; no listener or evaluation changes. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {EXPERIMENT,encode,sha256} from '../io.ts';
import {loadSet,mixSamples,tonejsMidi,type SampleSource} from '../ladder/samples.ts';
import {writeWav} from '../generate/wav.ts';
import {validateLabel} from '../events/label.ts';
import {assetPath,type StageExample2} from '../stages/stage1v2.ts';
export const HELDOUT_SET='contract2-challenger-heldout-guitar-v1';
export const HELDOUT_GUITARS=['tonejs-nylon','tonejs-electric','shinyguitar'];
export function freezeHeldout051(root:string,repo:string){
 const dir=join(root,HELDOUT_SET);assert(!existsSync(dir),'Never overwrite held-out stimuli');
 const sources:SampleSource[]=[];
 for(const [id,set,origin] of [['tonejs-nylon','guitar-nylon','Freesound 11573 quartertone classicalguitar-multisampled'],['tonejs-electric','guitar-electric','Karoryfer']]){
  const source=join(root,'samples/tonejs-instruments-622c2f1',set!);
  sources.push({id:id!,name:set!,source:'tonejs-instruments@622c2f1/'+set,origin:origin!,group:'held-out',licence:'CC-BY-3.0',attribution:'Nicholas Brosowsky tonejs-instruments',files:readdirSync(source).filter(f=>f.endsWith('.wav')).map(f=>({midi:tonejsMidi(f),path:join(source,f),sha256:sha256(readFileSync(join(source,f)))}))});
 }
 const sampleDir=join(repo,'experiments/performance-listening/bench/samples/shinyguitar-v1'),m=JSON.parse(readFileSync(join(sampleDir,'manifest.json'),'utf8'));
 const chosen=new Map<number,any>();for(const s of m.samples){const c=chosen.get(s.midi);if(!c||(s.layer??0)>(c.layer??0)||((s.layer??0)===(c.layer??0)&&(s.take??0)<(c.take??0)))chosen.set(s.midi,s);}
 sources.push({id:'shinyguitar',name:m.name,source:'public/samples/shinyguitar-v1',origin:'Karoryfer',group:'held-out',licence:m.license,attribution:m.name,files:[...chosen.values()].map(s=>({midi:s.midi,path:relative(EXPERIMENT,join(sampleDir,s.file)),sha256:s.sha256}))});
 const parentPath=join(root,'contract2-hesitation-v1/manifest.json'),noisePath=join(root,'contract2-challenger-guitar-noise-v1/manifest.json');
 const pb=readFileSync(parentPath),nb=readFileSync(noisePath);assert.equal(sha256(nb),'961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8');
 const parent=JSON.parse(pb.toString()),noise=JSON.parse(nb.toString()),parents=parent.examples as StageExample2[];
 assert.equal(parents.length,144);assert.equal(sha256(pb),JSON.parse(readFileSync(join(root,'contract2-hesitation-v1/freeze.json'),'utf8')).sha256);
 mkdirSync(dir);const examples:StageExample2[]=[],assets:Record<string,string>={},construction:any[]=[];
 for(const source of sources){const samples=loadSet({...source,files:source.files.map(f=>({...f,path:assetPath(f.path)}))},join(root,'samples/decoded-heldout-051-48k'));
  for(const base of parents.filter(e=>e.kind==='performance')){
   const id=`${source.id}-${base.id}`,audioPath=join(dir,`${id}.wav`);
   const rendered=base.label.performance.events.flatMap(p=>p.notes.map(n=>{const e=base.label.events[p.index]!,sn=e.notes.find(x=>x.noteKey===n.noteKey)!;assert(n.onset!==undefined&&n.end!==undefined);const fromSample=Math.round(n.onset!*48000),toSample=Math.round(n.end!*48000);assert(Math.abs(fromSample/48000-p.onset!)<1e-12);return {fromSample,toSample,midi:sn.midi!,hz:440*2**((sn.midi!-69)/12),scoreQuarter:e.quarter,scoreDuration:{num:1,den:1},noteKey:n.noteKey};}));
   const mixed=mixSamples(rendered,samples,base.label.audio!.samples,10**(-12/20));writeFileSync(audioPath,writeWav(mixed.pcm),{flag:'wx'});assets[audioPath]=sha256(readFileSync(audioPath));
   for(const p of parents.filter(e=>e.of===base.id)){
    const x=structuredClone(p);x.id=`${source.id}-${p.id}`;x.of=id;x.label.id=x.id;x.audioPath=audioPath;
    if(x.control==='silence'){
     const old=noise.examples.find((e:StageExample2)=>e.of===`tonejs-acoustic-${base.id}`&&e.control==='silence');assert(old);x.audioPath=old.audioPath;assert.equal(sha256(readFileSync(x.audioPath)),old.label.audio.sha256);assets[x.audioPath]=old.label.audio.sha256;
     x.label.provenance=structuredClone(old.label.provenance);
    }
    x.label.audio={...x.label.audio!,path:x.audioPath,sha256:assets[x.audioPath]!};
    x.label.provenance={...x.label.provenance,recipe:{...x.label.provenance.recipe as object,renderer:'sample-render@1',sampleSource:source.id},note:x.control==='silence'?'Identical frozen 038 quiet-noise control; no score note performed.':'Exact stimulus schedule inherited; sample internal attack timing is not independently annotated.'};
    validateLabel(x.label);assets[x.scorePath]=sha256(readFileSync(assetPath(x.scorePath)));examples.push(x);
   }
   construction.push({id,parent:base.id,rendered,shifts:mixed.shifts,source:source.id});
  }
 }
 assert.equal(examples.length,432);const manifest={id:HELDOUT_SET,version:1,partition:'held-out-confirmation',renderer:'sample-render@1',level:10**(-12/20),parents:{path:parentPath,sha256:sha256(pb)},noise:{path:noisePath,sha256:sha256(nb)},sources,examples,assets,construction};
 const bytes=encode(manifest);writeFileSync(join(dir,'manifest.json'),bytes,{flag:'wx'});writeFileSync(join(dir,'freeze.json'),encode({sha256:sha256(bytes),frozenBeforeInference:true}),{flag:'wx'});return manifest;
}
