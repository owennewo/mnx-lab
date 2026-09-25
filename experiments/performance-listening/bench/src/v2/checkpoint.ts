import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { golden, position } from '../../oracle-v2/fixtures.ts';
import { evaluateV2 } from './evaluate.ts';
import { compareV2 } from './retain.ts';
import { nextAction, type BatchState } from './driver.ts';
import type { RecordedRun } from './types.ts';
import { EXPERIMENT, encode } from '../io.ts';
const args=process.argv.slice(2).filter(arg=>arg!=='--check');
if(args.length>1)throw new Error('Usage: tsx src/v2/checkpoint.ts [output-directory] [--check]');
const output=resolve(args[0] ?? join(EXPERIMENT,'bench/oracle-v2/recorded'));
const check=process.argv.includes('--check');
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const g=golden();
const cases=[.125,0,.4,1].map(q=>({name:`constant-position-${q}`,golden:g,record:[position(q)],evaluation:evaluateV2(g,[position(q)])}));
const moving=golden();if(moving.labels[0]!.state!=='supported')throw Error();moving.labels[0]!.truth={route:1,start:{lower:0,upper:0},end:{lower:1,upper:1}};
cases.push({name:'moving-truth',golden:moving,record:[position(0)],evaluation:evaluateV2(moving,[position(0)])});
const wrong=golden();wrong.example='wrong-score';wrong.role='wrong-score';wrong.intended.scoreSha256='2'.repeat(64);wrong.labels=[{state:'unsupported',start:0,end:1,answerableFrom:0,evidence:'handwritten negative control'}];
const silence=structuredClone(wrong);silence.example='silence';silence.role='silence';silence.group.piece='synthetic-silence';
const goldens=[g,wrong,silence];
const paths=['bench/src/v2/types.ts','bench/src/v2/validate.ts','bench/src/v2/evaluate.ts','bench/src/v2/retain.ts','bench/src/v2/partitions.ts','bench/src/v2/driver.ts','bench/src/v2/checkpoint.ts','bench/oracle-v2/fixtures.ts','bench/oracle-v2/README.md','contracts/instrument-v2.md','bench/src/v2/anchor-limits.ts','bench/src/v2/run-pair.ts'];
const hashes=Object.fromEntries(paths.map(path=>[path,sha(readFileSync(join(EXPERIMENT,path)))]));
const instrumentHash=sha(encode(hashes));
function run(id:string,until:number):RecordedRun{return {id,candidate:`handwritten-${id}`,setHash:sha(encode(goldens)),instrumentHash,measurements:goldens.map(g=>({evaluation:evaluateV2(g,[position(1),g.role==='positive'?position(.125,until,'fix'):{id:'fix',refersTo:0,madeAt:until,kind:'unsupported'}]),causality:{checks:3,pass:true},cost:{machine:'williao-G3-3579',sustainedRatio:.01,p99Ms:.1,maxBacklogMs:0}}))};}
const base=run('comparator',.2),candidate=run('improved',0),failed=run('failed',.1);
const uncertain=structuredClone(candidate);uncertain.id='uncertain';uncertain.candidate='handwritten-uncertain';
uncertain.measurements[0]!.evaluation.supportedCorrect={lower:.9,upper:1};uncertain.measurements[0]!.evaluation.exposure.fraction={lower:0,upper:.1};uncertain.measurements[0]!.evaluation.exposure.seconds={lower:0,upper:.1};uncertain.measurements[0]!.evaluation.exposure.longestSeconds={lower:0,upper:.1};
const decisions=[candidate,failed,uncertain].map(run=>({run,result:compareV2(base,run,goldens)}));
if(decisions.map(d=>d.result.decision).join(',')!=='provisional,reject,inconclusive')throw new Error('Retention oracle mismatch');
const state:BatchState={contract:'research-contract-1',instrumentChecked:true,evidenceHolds:[
 'Solo guitar and four bars confirmed; precise score/route/crop time-origin correspondence is not independently established',
 'No reviewed beat trajectory with ±0.125-quarter bounds or 80% answerable coverage',
 'Wrong-score distinguishing events and nominal-tempo envelope remain unreviewed',
 'No frozen real development manifest; reserved and microphone acceptance groups unallocated',
],candidateVersions:[],assessments:[],research:{questions:['How should independent recording annotations and uncertainty be recorded?'],sources:['research/asap-annotation-practice.md','research/nasap-independent-review.md']}};
const result={kind:'instrument-verification',version:2,claims:'Handwritten evaluator and decision-rule fixtures only. Cost and causality fields in retention fixtures are stipulated inputs, not measurements. No candidate ran and no real labels were accepted.',sourceHashes:hashes,instrumentHash,cases,retention:{goldens,base,decisions},batch:state,next:nextAction(state)};
const content=encode(result);
if(check){if(readFileSync(join(output,'checkpoint.json'),'utf8')!==content)throw new Error('Instrument checkpoint does not reproduce');console.log('V2 instrument checkpoint reproduces byte-for-byte.');}
else {
 if(existsSync(output))throw new Error('Checkpoint exists; preserve history rather than overwrite it');
 const dirty=execFileSync('git',['status','--porcelain','--',...paths.map(p=>join(EXPERIMENT,p))],{encoding:'utf8'}).trim();
 if(dirty)throw new Error('Commit the instrument and oracle before recording its checkpoint');
 mkdirSync(output,{recursive:true});writeFileSync(join(output,'checkpoint.json'),content);
 writeFileSync(join(output,'metadata.json'),encode({kind:result.kind,gitCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checkpointSha256:sha(content),instrumentHash}));
 console.log(`Recorded ${output}; next action: ${result.next.action}`);
}
