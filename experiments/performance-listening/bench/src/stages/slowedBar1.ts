/** 026: one bar under a piecewise tempo map, with unchanged earlier evidence. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { controlLabel, perfectLabel, LABEL_FORMAT_2, validateLabel } from '../events/label.ts';
import { writeWav } from '../generate/wav.ts';
import { encode } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { mixSines, windowNotes, SAMPLE_RATE } from '../ladder/render.ts';
import { HESITATION_SET, readHesitationSet } from './hesitation1.ts';
import { assetPath } from './stage1v2.ts';
import { DISTANT_SCORE } from './stage1v3.ts';
export const SLOWED_BAR_SET = 'contract2-slowed-bar-v1';
export const SLOW_FACTORS = [0.5,0.6,0.7,0.8,0.9] as const;
export interface SlowedBarManifest extends Omit<ReturnType<typeof readHesitationSet>['manifest'], 'version'> {
  version: 4;
  stretches: { id: string; parent: string; ordinal: number; factor: number; checkedBoundaries: number; identicalNotePcm: number; roundedLengthNotes: number }[];
}
export function slowedSample(q: number, base: number, ordinal: number, factor: number) {
  return Math.round((q+Math.min(4,Math.max(0,q-4*ordinal))*(1/factor-1))*60/base*SAMPLE_RATE);
}
export function readSlowedBarSet(dir: string) {
  const bytes=readFileSync(join(requireOutsideGit(dir),'manifest.json'));
  if(sha(bytes)!==JSON.parse(readFileSync(join(dir,'freeze.json'),'utf8')).sha256) throw new Error('Slowed-bar manifest changed');
  const manifest=JSON.parse(bytes.toString()) as SlowedBarManifest;
  if(manifest.id!==SLOWED_BAR_SET||manifest.version!==4||manifest.examples.length!==264||manifest.stretches.length!==40) throw new Error('Unexpected slowed-bar set');
  for(const [path,hash] of Object.entries(manifest.assets)) if(sha(readFileSync(assetPath(path)))!==hash) throw new Error(`Changed asset ${path}`);
  manifest.examples.forEach(e=>validateLabel(e.label));
  return {manifest,sha256:sha(bytes)};
}
export function freezeSlowedBar(root: string) {
  const {manifest:parent,sha256:parentHash}=readHesitationSet(join(root,HESITATION_SET));
  const out=join(requireOutsideGit(root),SLOWED_BAR_SET);
  if(existsSync(out)) throw new Error('Slowed-bar set exists; never overwrite');
  const wrongBytes=readFileSync(assetPath(DISTANT_SCORE)), wrong=compilePerformance(JSON.parse(wrongBytes.toString()) as MnxStructure);
  if(!wrong.ok||wrong.performance.diagnostics.length) throw new Error('Wrong score does not compile');
  mkdirSync(out,{recursive:true});
  const examples=structuredClone(parent.examples), assets={...parent.assets}, stretches:SlowedBarManifest['stretches']=[];
  for(const base of parent.examples.filter(e=>/^s2-\d+$/.test(e.id)&&e.kind==='performance')) {
    const score=JSON.parse(readFileSync(assetPath(base.scorePath),'utf8')) as MnxStructure, c=compilePerformance(score);
    if(!c.ok||c.performance.diagnostics.length||base.label.events.length!==8) throw new Error('Expected clean eight-event s2');
    const original=readFileSync(base.audioPath);
    for(const ordinal of [0,1]) for(const factor of SLOW_FACTORS) {
      const length=slowedSample(8,base.tempo,ordinal,factor);
      const rendered=windowNotes(score,0,8,q=>slowedSample(q,base.tempo,ordinal,factor),length,480);
      const pcm=mixSines(rendered,length,-12,480,SAMPLE_RATE), bytes=writeWav(pcm);
      const id=`sb-${base.id}-b${ordinal+1}-${Math.round(factor*100)}`, audioPath=join(out,`${id}.wav`);
      // Independent integration over eight explicit unit intervals, not the rendering map.
      const rates=Array.from({length:8},(_,i)=>base.tempo*(Math.floor(i/4)===ordinal?factor:1));
      const ends=[0];for(const rate of rates) ends.push(ends.at(-1)!+60/rate);
      let identicalNotePcm=0,roundedLengthNotes=0;
      for(const [i,n] of rendered.entries()) {
        if(n.scoreQuarter!==i||n.fromSample!==Math.round(ends[i]!*SAMPLE_RATE)||n.toSample!==Math.round(ends[i+1]!*SAMPLE_RATE)||n.midi!==base.label.events[i]!.notes[0]!.midi) throw new Error(`Boundary/pitch changed ${id} ${i}`);
        if(Math.floor(i/4)!==ordinal) {
          const old=base.label.performance.events[i]!.notes[0]!, from=Math.round(old.onset!*SAMPLE_RATE), to=Math.round(old.end!*SAMPLE_RATE);
          if(n.toSample-n.fromSample===to-from) {
            for(let j=0;j<to-from;j++) if(pcm[n.fromSample+j]!==original.readInt16LE(44+(from+j)*2)) throw new Error(`Unchanged-note PCM differs ${id} ${i}`);
            identicalNotePcm++;
          } else { if(Math.abs(n.toSample-n.fromSample-(to-from))>1) throw new Error('Rounding exceeds one sample'); roundedLengthNotes++; }
        }
      }
      if(rendered.length!==8||length!==Math.round(ends[8]!*SAMPLE_RATE)) throw new Error('Note count or duration differs');
      writeFileSync(audioPath,bytes);const audioHash=sha(bytes);assets[audioPath]=audioHash;
      const audio={path:`${id}.wav`,sampleRate:SAMPLE_RATE,samples:length,sha256:audioHash},duration=length/SAMPLE_RATE;
      const label=perfectLabel({id,performance:c.performance,score:base.label.score as {path:string;sha256:string},handedQuartersPerMinute:90,duration,audio,rendered,sampleRate:SAMPLE_RATE,format:LABEL_FORMAT_2,
        recipe:{stage:2,deviation:'slowed-bar',base:base.id,ordinal,factor}});
      label.cursor.segments.forEach((s,i)=>{if(s.from!==rendered[i]!.fromSample/SAMPLE_RATE||s.truth!==i||s.admissible.join(',')!==String(i)) throw new Error('Cursor label differs');});
      examples.push({...base,id,of:id,audioPath,label});
      stretches.push({id,parent:base.id,ordinal,factor,checkedBoundaries:16,identicalNotePcm,roundedLengthNotes});
      const silId=`sil-${id}`,silPath=join(out,`${silId}.wav`),silBytes=writeWav(new Int16Array(length));
      if(silBytes.length!==bytes.length||silBytes.subarray(44).some(x=>x!==0)) throw new Error('Invalid silence control');
      writeFileSync(silPath,silBytes);const silHash=sha(silBytes);assets[silPath]=silHash;
      examples.push({...base,id:silId,kind:'control',control:'silence',of:id,audioPath:silPath,
        label:controlLabel({id:silId,performance:c.performance,score:base.label.score as {path:string;sha256:string},handedQuartersPerMinute:90,duration,audio:{...audio,path:`${silId}.wav`,sha256:silHash},control:'silence',extras:[],recipe:{stage:2,of:id},note:`Digital silence as long as ${id}.`})});
      const wrongId=`w2-${id}`;
      examples.push({...base,id:wrongId,kind:'control',control:'wrong-score',of:id,score:'w2',scorePath:DISTANT_SCORE,audioPath,
        label:controlLabel({id:wrongId,performance:wrong.performance,score:{path:DISTANT_SCORE,sha256:sha(wrongBytes)},handedQuartersPerMinute:90,duration,audio,control:'wrong-score',
          extras:rendered.map(n=>({onset:n.fromSample/SAMPLE_RATE,end:n.toSample/SAMPLE_RATE,midi:n.midi})),recipe:{stage:2,of:id},note:`${id}'s audio handed distant w2.`})});
    }
  }
  const manifest:SlowedBarManifest={...parent,id:SLOWED_BAR_SET,version:4,parent:{id:parent.id,sha256:parentHash},examples,assets,stretches,
    recipe:{...parent.recipe,note:'026: stage-1 and hesitation examples unchanged; one s2 bar at 50/60/70/80/90% base tempo, either bar independently, with paired controls.'}};
  const bytes=encode(manifest);writeFileSync(join(out,'manifest.json'),bytes);
  writeFileSync(join(out,'freeze.json'),encode({sha256:sha(bytes),frozenBeforeComparisonRunner:true,parent:manifest.parent,checkedPerformances:stretches.length,regressionExamples:parent.examples.length}));
  readSlowedBarSet(out);return {out,sha256:sha(bytes),examples:examples.length,stretches:stretches.length};
}
if(import.meta.url===`file://${process.argv[1]}`) console.log(freezeSlowedBar(process.argv[2]!));
