/** Re-freeze stage 1 with the approved distant score, preserving v2's audio bytes. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { controlLabel, scoreEvents } from '../events/label.ts';
import { encode } from '../io.ts';
import { requireOutsideGit, sha } from '../ladder/privateSets.ts';
import { assetPath, readStageSet2, STAGE_1_SET_2, type StageManifest2 } from './stage1v2.ts';
export const STAGE_1_SET_3 = 'contract2-stage1-v3';
export const DISTANT_SCORE = 'sources/w2-two-bar-leaps.mnx.json';
export function freezeStage1v3(root: string) {
  const {manifest: before, sha256: parentHash} = readStageSet2(join(root,STAGE_1_SET_2));
  const out = join(requireOutsideGit(root), STAGE_1_SET_3);
  if (existsSync(out)) throw new Error('Stage v3 already exists; never overwrite it');
  const bytes = readFileSync(assetPath(DISTANT_SCORE)), score = JSON.parse(bytes.toString()) as MnxStructure;
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('w2 does not compile cleanly');
  const wrongEvents = scoreEvents(compiled.performance), pitches=wrongEvents.map(e=>e.notes[0]!.midi);
  const pair = (v:number[],i:number) => `${v[i+1]!-v[i]!},${v[i+2]!-v[i+1]!}`;
  for (const e of before.examples.filter(e=>e.kind==='performance')) {
    const played=e.label.events.map(e=>e.notes[0]!.midi);
    if (Math.max(...pitches)>=Math.min(...played)) throw new Error('w2 register is not distant');
    for(let i=0;i+2<pitches.length;i++) for(let j=0;j+2<played.length;j++) if(pair(pitches,i)===pair(played,j)) throw new Error('Three-note intervals coincide');
    const wrongRhythm=wrongEvents.map(e=>e.quarter).join(','), rightRhythm=e.label.events.map(e=>e.quarter).join(',');
    if(wrongRhythm===rightRhythm) throw new Error('w2 rhythm coincides');
  }
  const examples = before.examples.map(e=> {
    if (e.control!=='wrong-score') return structuredClone(e);
    const base=before.examples.find(b=>b.id===e.of)!;
    const id=`w2-${e.of}`;
    return {...e,id,score:'w2',scorePath:DISTANT_SCORE,label:controlLabel({ id, performance:compiled.performance,
      score:{path:DISTANT_SCORE,sha256:sha(bytes)},handedQuartersPerMinute:90,duration:e.label.duration,audio:e.label.audio!,control:'wrong-score',
      extras:base.label.performance.events.flatMap(p=>p.notes.map(n=>({onset:n.onset!,end:n.end!,midi:base.label.events[p.index]!.notes.find(s=>s.noteKey===n.noteKey)!.midi}))),
      recipe:{stage:1,of:e.of,parent:before.id},note:`${e.of}'s frozen audio handed the distant w2 score.`})};
  });
  const assets: Record<string,string> = {[DISTANT_SCORE]:sha(bytes)};
  for(const e of examples) {assets[e.scorePath]=sha(readFileSync(assetPath(e.scorePath))); assets[e.audioPath]=sha(readFileSync(e.audioPath));}
  const manifest: StageManifest2={...before,id:STAGE_1_SET_3,examples,assets,recipe:{...before.recipe,note:`v2 audio byte-identical, w1 moved to stage 2; distant w2 here. Parent manifest ${parentHash}.`}};
  const encoded=encode(manifest); mkdirSync(out,{recursive:true}); writeFileSync(join(out,'manifest.json'),encoded);
  writeFileSync(join(out,'freeze.json'),encode({sha256:sha(encoded),frozenBeforeCandidate:true,parent:{id:before.id,sha256:parentHash},structuralChecks:{register:true,rhythm:true,noTransposedTriples:true},reusedWavs:16}));
  return {out,sha256:sha(encoded),examples:examples.length};
}
if(import.meta.url===`file://${process.argv[1]}`) console.log(freezeStage1v3(process.argv[2]!));
