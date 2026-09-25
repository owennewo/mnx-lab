import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { clockFollower } from '../candidates/clockFollower.ts';
import { readWav } from '../generate/wav.ts';
import { execute } from '../run/runner.ts';
import type { Listener, Decision } from '../types.ts';
import { evaluateV2 } from './evaluate.ts';
import { compareV2 } from './retain.ts';
import { evidenceHolds } from './validate.ts';
import type { GoldenV2, RecordedRun } from './types.ts';
export interface ReviewedInput { golden: GoldenV2; scoreBytes: Buffer; wavBytes: Buffer; reviewBytes: Buffer }
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
/** This entry takes frozen, independently reviewed assets. It never prepares labels.
 * Reserved/final reads need the one-time access transaction and are excluded here. */
export function runDevelopmentPair(inputs: ReviewedInput[], createListener:()=>Listener, pins:{candidate:string; candidateCodeSha256:string; instrumentHash:string; setHash:string; runId:string}) {
  if (pins.candidate==='clock-follower@1')throw new Error('Candidate identity must differ from the comparator');
  if (!inputs.length || Object.values(pins).some(v=>!v) || [pins.candidateCodeSha256,pins.instrumentHash,pins.setHash].some(v=>!/^[a-f0-9]{64}$/.test(v)))throw new Error('Missing frozen run pins');
  const loaded=inputs.map(input=>{
    const g=input.golden,holds=evidenceHolds(g);
    if(g.partition!=='development')throw new Error('This runner cannot inspect reserved/final data');
    if(holds.length)throw new Error(holds.join('; '));
    if(sha(input.scoreBytes)!==g.intended.scoreSha256 || sha(input.wavBytes)!==g.audio.sha256 || sha(input.reviewBytes)!==g.provenance.evidenceSha256)throw new Error('Reviewed asset hash mismatch');
    const reference=evaluateV2(g,[]);
    if((g.role==='positive'||g.role==='interruption') && reference.referenceCoverage<.8)throw new Error('Insufficient independently answerable reference time');
    if(!Number.isSafeInteger(g.intended.tempo.bpm))throw new Error('clock-follower@1 needs an independently supplied integer-BPM handoff; do not silently round labels');
    const pcm=readWav(input.wavBytes);
    if(pcm.length!==g.audio.samples)throw new Error('Decoded sample count mismatch');
    return {g,pcm,score:JSON.parse(input.scoreBytes.toString('utf8')) as MnxStructure};
  });
  if(new Set(inputs.map(i=>i.golden.example)).size!==inputs.length || new Set(inputs.map(i=>i.golden.set)).size!==1)throw new Error('Duplicate examples or mixed sets');
  const before=process.cpuUsage(),wall=performance.now();
  const records:Record<string,Decision[]>={};
  const run=(candidate:string,factory:()=>Listener):RecordedRun=>({id:`${pins.runId}-${candidate==='clock-follower@1'?'comparator':'candidate'}`,candidate,setHash:pins.setHash,instrumentHash:pins.instrumentHash,measurements:loaded.map(({g,pcm,score})=>{
    const executed=execute(factory,score,g.intended.tempo,pcm);records[`${candidate}/${g.example}`]=executed.record;
    let pass=true;
    // Complete records before each cut must survive both silence and non-silent futures.
    for(const fraction of [.25,.5,.75])for(const future of ['silence','alternating']){
      const sample=Math.max(1,Math.min(pcm.length-1,Math.floor(pcm.length*fraction)));
      const changed=pcm.slice();for(let i=sample;i<changed.length;i++)changed[i]=future==='silence'?0:(i%2?.125:-.125);
      const rerun=execute(factory,score,g.intended.tempo,changed);
      const prefix=(record:Decision[])=>record.filter(d=>d.madeAt<=sample/48000);
      pass &&= JSON.stringify(prefix(executed.record))===JSON.stringify(prefix(rerun.record));
    }
    return {evaluation:evaluateV2(g,executed.record),causality:{checks:6,pass},cost:{machine:executed.cost.machine.hostname,sustainedRatio:executed.cost.sustainedRatio,p99Ms:executed.cost.p99Ms,maxBacklogMs:executed.cost.maxBacklogMs}};
  })});
  const comparator=run('clock-follower@1',clockFollower),candidate=run(pins.candidate,createListener);
  const cpu=process.cpuUsage(before);
  return {pins,comparator,candidate,records,decision:compareV2(comparator,candidate,inputs.map(i=>i.golden)),resources:{cpuSeconds:(cpu.user+cpu.system)/1e6,wallSeconds:(performance.now()-wall)/1000},limits:'Development comparison only. Costs measured by the v1 copy-isolating runner on this machine; no physical microphone latency claim.'};
}
