import { expect, it } from 'vitest';
import { golden, position } from '../oracle-v2/fixtures.ts';
import { evaluateV2 } from '../src/v2/evaluate.ts';
import { compareV2 } from '../src/v2/retain.ts';
import type { GoldenV2, RecordedRun } from '../src/v2/types.ts';
function pair() {
  const positive=golden(), wrong=golden(), silence=golden();
  wrong.example='wrong';wrong.role='wrong-score';wrong.intended.scoreSha256='2'.repeat(64);
  wrong.labels=[{start:0,end:1,state:'unsupported',answerableFrom:0,evidence:'handwritten negative control'}];
  silence.example='silence';silence.role='silence';silence.group.piece='synthetic-silence';silence.labels=structuredClone(wrong.labels);
  const goldens=[positive,wrong,silence];
  function run(candidate:string,wrongUntil:number):RecordedRun {return {
    id:candidate,candidate,setHash:'a'.repeat(64),instrumentHash:'b'.repeat(64),measurements:goldens.map(g=>({
      evaluation:evaluateV2(g,[position(1),g.role==='positive'?position(.125,wrongUntil,'fix'):{id:'fix',refersTo:0,madeAt:wrongUntil,kind:'unsupported'}]),
      causality:{checks:3,pass:true},cost:{machine:'williao-G3-3579',sustainedRatio:.01,p99Ms:.1,maxBacklogMs:0},
    })),
  };}
  return {goldens,base:run('comparator',.2),candidate:run('candidate',0),run};
}
it('selects development-only improvement, never formal retention',()=>{
  const p=pair();const result=compareV2(p.base,p.candidate,p.goldens);
  expect(result.decision).toBe('provisional');expect(result.improvement).toEqual({absolute:{lower:.2,upper:.2},relative:{lower:1,upper:1}});expect(result.recovery).toBe('untested');
});
it('rejects definite failure and keeps uncertain exposure inconclusive',()=>{
  const p=pair();expect(compareV2(p.base,p.run('bad',.1),p.goldens).decision).toBe('reject');
  const e=p.candidate.measurements[0]!.evaluation;
  e.supportedCorrect={lower:.9,upper:1};e.exposure.fraction={lower:0,upper:.1};e.exposure.seconds={lower:0,upper:.1};e.exposure.longestSeconds={lower:0,upper:.1};
  expect(compareV2(p.base,p.candidate,p.goldens).decision).toBe('inconclusive');
});
it('missing controls and insufficient reference coverage cannot promote',()=>{
  const p=pair();p.goldens.pop();p.base.measurements.pop();p.candidate.measurements.pop();
  expect(compareV2(p.base,p.candidate,p.goldens).holds).toContain('Synthetic silence control missing');
  const q=pair();const g=q.goldens[0]!;g.labels=[{start:0,end:.5,state:'unknown',reason:'unchecked',evidence:'oracle'}, {...g.labels[0]!,start:.5,answerableFrom:.5} as GoldenV2['labels'][number]];
  for(const run of [q.base,q.candidate])run.measurements[0]!.evaluation=evaluateV2(g,[position(.125)]);
  const result=compareV2(q.base,q.candidate,q.goldens);expect(result.decision).toBe('inconclusive');expect(result.holds.join(' ')).toContain('80%');
});
it('refuses incompatible evidence, missing costs and duplicate examples',()=>{
  const p=pair();p.candidate.measurements[0]!.evaluation.evidenceId='bad';expect(()=>compareV2(p.base,p.candidate,p.goldens)).toThrow(/evidence/);
  const q=pair();q.candidate.measurements[0]!.cost.p99Ms=NaN;expect(()=>compareV2(q.base,q.candidate,q.goldens)).toThrow(/measurement/);
  const r=pair();r.candidate.measurements[0]=r.candidate.measurements[1]!;expect(()=>compareV2(r.base,r.candidate,r.goldens)).toThrow(/examples/);
});
it('stops on zero improvement headroom and does not invent reserved evidence',()=>{
  const p=pair();expect(compareV2(p.candidate,p.candidate,p.goldens).decision).toBe('stop-no-headroom');
  for(const g of p.goldens)g.partition='reserved';
  for(const run of [p.base,p.candidate])for(let i=0;i<p.goldens.length;i++)run.measurements[i]!.evaluation={...run.measurements[i]!.evaluation,evidenceId:evaluateV2(p.goldens[i]!,[]).evidenceId,partition:'reserved'};
  expect(compareV2(p.base,p.candidate,p.goldens).decision).toBe('inconclusive');
});
it('does not invent a finite relative-gain bound when comparator exposure could be zero',()=>{
  const p=pair();for(const m of p.base.measurements)m.evaluation.exposure.fraction={lower:0,upper:.2};
  const result=compareV2(p.base,p.candidate,p.goldens);expect(result.improvement?.relative).toBeNull();expect(result.decision).toBe('inconclusive');
});
