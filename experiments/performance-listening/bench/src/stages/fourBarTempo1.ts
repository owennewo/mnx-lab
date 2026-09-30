/** Future tempo evidence only: no listener or new assessment evaluator is invoked here. */
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {compilePerformance} from '../../../../../src/audio/performance.ts';
import type {MnxStructure} from '../../../../../src/model/mnx.ts';
import {perfectLabel,controlLabel,validateLabel,LABEL_FORMAT_2,scoreEvents} from '../events/label.ts';
import {mixSines,windowNotes,SAMPLE_RATE} from '../ladder/render.ts';
import {sha,requireOutsideGit} from '../ladder/privateSets.ts';
import {writeWav,readWav} from '../generate/wav.ts';
import {encode} from '../io.ts';
import {assetPath,type StageExample2} from './stage1v2.ts';
export const FOUR_BAR_SET='contract2-four-bar-tempo-v1';
export const FOUR_BAR_SCORE='sources/s3-four-bar-melody.mnx.json';
const EXPECTED_PITCHES=[60,62,64,65,67,69,71,72,71,69,67,65,64,62,60,62];
const TEMPI=[45,63,90,99],FACTORS=[.5,.6,.7,.8,.9];
export interface FourBarManifest {id:string;version:1;partition:'development';handedQuartersPerMinute:90;
  recipe:Record<string,unknown>;examples:StageExample2[];assets:Record<string,string>}
const requireThat=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
export function freezeFourBarTempo(root:string) {
  const out=join(requireOutsideGit(root),FOUR_BAR_SET);
  if(existsSync(out))throw new Error('Four-bar evidence exists; never overwrite');
  const bytes=readFileSync(assetPath(FOUR_BAR_SCORE)),score=JSON.parse(bytes.toString()) as MnxStructure;
  const compiled=compilePerformance(score);
  if(!compiled.ok||compiled.performance.diagnostics.length)throw new Error('s3 does not compile');
  const events=scoreEvents(compiled.performance);
  requireThat(compiled.performance.measures.length===4&&events.length===16,'s3 shape');
  for(const [i,e]of events.entries())requireThat(e.quarter===i&&e.at.ordinal===Math.floor(i/4)&&e.notes.length===1&&e.notes[0]!.midi===EXPECTED_PITCHES[i],'s3 note/quarter mismatch');
  const wrongPath='sources/w2-two-bar-leaps.mnx.json',wrongBytes=readFileSync(assetPath(wrongPath)),wrong=compilePerformance(JSON.parse(wrongBytes.toString()));
  if(!wrong.ok||wrong.performance.diagnostics.length)throw new Error('w2 does not compile');
  const wrongEvents=scoreEvents(wrong.performance),wp=wrongEvents.map(e=>e.notes[0]!.midi);
  requireThat(Math.max(...wp)<Math.min(...EXPECTED_PITCHES),'w2 register');
  for(let i=0;i+2<wp.length;i++)for(let j=0;j+2<EXPECTED_PITCHES.length;j++)
    requireThat(!(wp[i+1]!-wp[i]===EXPECTED_PITCHES[j+1]!-EXPECTED_PITCHES[j]&&wp[i+2]!-wp[i+1]===EXPECTED_PITCHES[j+2]!-EXPECTED_PITCHES[j+1]),'w2 interval triple');
  requireThat(wrongEvents.map(e=>e.quarter).join(',')!==events.map(e=>e.quarter).join(','),'w2 rhythm');
  mkdirSync(out,{recursive:true});
  const examples:StageExample2[]=[],assets:Record<string,string>={[FOUR_BAR_SCORE]:sha(bytes),[wrongPath]:sha(wrongBytes)};
  let boundaryChecks=0,silenceChecks=0,wrongScoreChecks=0;
  const recipes=TEMPI.flatMap(tempo=>[{tempo,bar:null as number|null,factor:1},...Array.from({length:4},(_,bar)=>FACTORS.map(factor=>({tempo,bar,factor}))).flat()]);
  for(const {tempo,bar,factor}of recipes) {
    // Score interval is stretched by the part of that interval falling inside the selected bar.
    const seconds=(q:number)=>60/tempo*(q+(bar===null?0:Math.min(4,Math.max(0,q-4*bar))*(1/factor-1)));
    const sample=(q:number)=>Math.round(seconds(q)*SAMPLE_RATE),length=sample(16);
    const notes=windowNotes(score,0,16,sample,length,480);
    const id=bar===null?`s3-${tempo}`:`sb-s3-${tempo}-b${bar+1}-${Math.round(factor*100)}`;
    for(const [i,n]of notes.entries()) {
      // Independent integration of each preceding beat's rate, rather than reuse the generator map.
      const at=(q:number)=> {
        let time=0;for(let beat=0;beat<q;beat++)time+=60/tempo/(bar!==null&&Math.floor(beat/4)===bar?factor:1);
        return Math.round(time*SAMPLE_RATE);
      };
      requireThat(n.fromSample===at(i)&&n.toSample===at(i+1)&&n.scoreQuarter===i&&n.midi===EXPECTED_PITCHES[i],'Independent note boundary mismatch');boundaryChecks+=4;
    }
    const audioPath=join(out,`${id}.wav`),pcm=mixSines(notes,length,-12,480,SAMPLE_RATE),wav=writeWav(pcm);
    writeFileSync(audioPath,wav);assets[audioPath]=sha(wav);
    const audio={path:audioPath,sampleRate:SAMPLE_RATE,samples:length,sha256:sha(wav)};
    const recipe={tempo,bar,factor,synth:'sine',handed:90};
    const label=perfectLabel({id,performance:compiled.performance,score:{path:FOUR_BAR_SCORE,sha256:sha(bytes)},handedQuartersPerMinute:90,
      duration:length/SAMPLE_RATE,audio,rendered:notes,sampleRate:SAMPLE_RATE,recipe,format:LABEL_FORMAT_2});
    examples.push({id,kind:'performance',control:null,of:id,score:'s3',scorePath:FOUR_BAR_SCORE,tempo,audioPath,label});
    for(const control of ['silence','wrong-score'] as const) {
      const controlId=`${control==='silence'?'sil':'w2'}-${id}`,controlPath=control==='silence'?join(out,`${controlId}.wav`):audioPath;
      if(control==='silence') {
        const silence=writeWav(new Int16Array(length));writeFileSync(controlPath,silence);assets[controlPath]=sha(silence);
        const read=readWav(readFileSync(controlPath));requireThat(read.length===pcm.length&&read.every(x=>x===0),'Silence is not exact');silenceChecks++;
      } else {requireThat(sha(readFileSync(controlPath))===audio.sha256,'Wrong-score audio differs');wrongScoreChecks++;}
      const controlAudio={...audio,path:controlPath,sha256:assets[controlPath]!};
      const cl=controlLabel({id:controlId,performance:control==='silence'?compiled.performance:wrong.performance,
        score:{path:control==='silence'?FOUR_BAR_SCORE:wrongPath,sha256:control==='silence'?sha(bytes):sha(wrongBytes)},handedQuartersPerMinute:90,
        duration:label.duration,audio:controlAudio,control,
        extras:control==='silence'?[]:notes.map(n=>({onset:n.fromSample/SAMPLE_RATE,end:n.toSample/SAMPLE_RATE,midi:n.midi})),
        recipe:{...recipe,of:id},note:`Paired ${control} for ${id}; exact same length.`});
      examples.push({id:controlId,kind:'control',control,of:id,score:control==='silence'?'s3':'w2',scorePath:cl.score.path,tempo,audioPath:controlPath,label:cl});
    }
  }
  const manifest:FourBarManifest={id:FOUR_BAR_SET,version:1,partition:'development',handedQuartersPerMinute:90,
    recipe:{renderer:'score-render@1 mixSines',sampleRate:SAMPLE_RATE,peakDbfs:-12,rampSeconds:.01,tempi:TEMPI,slowFactors:FACTORS,
      note:'4 clean and80 independently slowed-bar performances; paired controls. No listener evaluated; labels frozen before next listener comparison.'},examples,assets};
  const encoded=encode(manifest);writeFileSync(join(out,'manifest.json'),encoded);
  const validation={performances:recipes.length,examples:examples.length,notes:recipes.length*16,boundaryChecks,silenceChecks,wrongScoreChecks,measures:4,sourceMidi:EXPECTED_PITCHES};
  writeFileSync(join(out,'freeze.json'),encode({sha256:sha(encoded),frozenBeforeListener:true,validation}));
  return {out,sha256:sha(encoded),validation};
}
export function readFourBarTempo(dir:string) {
  const bytes=readFileSync(join(dir,'manifest.json')),freeze=JSON.parse(readFileSync(join(dir,'freeze.json'),'utf8'));
  requireThat(sha(bytes)===freeze.sha256,'Changed four-bar manifest');const manifest=JSON.parse(bytes.toString()) as FourBarManifest;
  for(const [path,hash]of Object.entries(manifest.assets))requireThat(sha(readFileSync(assetPath(path)))===hash,`Changed ${path}`);
  for(const e of manifest.examples)validateLabel(e.label);
  return {manifest,sha256:sha(bytes),freeze};
}
