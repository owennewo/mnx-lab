/** Read-only component diagnosis of 026's two failures; no new listener evaluation. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readWav } from '../generate/wav.ts';
import { encode, EXPERIMENT } from '../io.ts';
import { sha } from '../ladder/privateSets.ts';
import { sinePitch } from '../listeners/eventChain1.ts';
import { readSlowedBarSet } from './slowedBar1.ts';
if(import.meta.url===`file://${process.argv[1]}`) {
  const [dir]=process.argv.slice(2),out=join(dir!,'runs/g026-single-slowed-bar/pitch-boundary-diagnosis.json');
  if(existsSync(out)) throw new Error('Diagnosis exists; never overwrite');
  if(execFileSync('git',['status','--porcelain'],{cwd:EXPERIMENT,encoding:'utf8'}).trim().split('\n').some(p=>p.includes('bench/'))) throw new Error('Commit diagnostic source before use');
  const {manifest}=readSlowedBarSet(dir!),ids=['sb-s2-63-b1-60','sb-s2-90-b1-90','sb-s2-63-b1-50','sb-s2-90-b1-80'];
  const cases=ids.map(id=>{
    const e=manifest.examples.find(e=>e.id===id)!;const audio=readWav(readFileSync(e.audioPath));
    const onset=e.label.performance.events[3]!.onset!,start=Math.floor((onset-0.04)*100)*480,end=Math.ceil((onset+0.07)*100)*480;
    const windows=[];
    for(let until=start;until<=end;until+=480) windows.push({end:until/48000,heard:sinePitch(audio.slice(until-960,until),48000),truth:e.label.cursor.segments.filter(s=>s.from<=until/48000).at(-1)!.truth});
    return {id,audioSha256:e.label.audio!.sha256,transition:{fromMidi:64,toMidi:65,expectedAt:onset},windows};
  });
  const source='bench/src/stages/diagnose026.ts',commit=execFileSync('git',['rev-parse','HEAD'],{cwd:EXPERIMENT,encoding:'utf8'}).trim();
  const result={kind:'component-diagnosis',commit,source:{path:source,sha256:sha(readFileSync(resolve(EXPERIMENT,source)))},listenerSourceSha256:sha(readFileSync(resolve(EXPERIMENT,'bench/src/listeners/eventChain1.ts'))),method:'Existing sinePitch on exact causal 960-sample windows at 480-sample hops around E4-to-F4. No listener run, tuning or evaluation change.',cases};
  writeFileSync(out,encode(result));console.log(encode({path:out,sha256:sha(readFileSync(out)),cases}));
}
