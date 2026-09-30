import {describe,it,expect} from 'vitest';
import {readOracle3,caseLabel} from '../src/events/oracle3.ts';
import {expectedAssessment3,evaluateAssessment3,reportedBars,type AssessmentReport3} from '../src/events/assessment3.ts';
import {assessmentGates2,pooledGates2,chooseSentinels,nextState,normalizedMargin,canRetire,suitePlan} from '../src/events/gates2.ts';
import {expandLabel2,readOracle2,expandReport2} from '../src/events/oracle.ts';
import {evaluateAssessment2} from '../src/events/assessment2.ts';
import {eventPositions,validateLabel} from '../src/events/label.ts';
const o=readOracle3();
const equalNumbers=(a:unknown,b:unknown):void=> {
  if(typeof a==='number'&&typeof b==='number')expect(Math.abs(a-b)).toBeLessThanOrEqual(1e-9);
  else if(Array.isArray(a)&&Array.isArray(b)){expect(a.length).toBe(b.length);a.forEach((v,i)=>equalNumbers(v,b[i]));}
  else if(a && b && typeof a==='object' && typeof b==='object')for(const [k,v]of Object.entries(b))equalNumbers((a as Record<string,unknown>)[k],v);
  else expect(a).toEqual(b);
};
describe('event-oracle@3, pending independent audit',()=> {
 for(const c of o.assessment) {
  it(`${c.id}: ${c.arithmetic}`,()=> {
    const label=caseLabel(c);validateLabel(label);const d=expectedAssessment3(label);
    // Preserve B1's frozen wrong arithmetic. This is a recorded counterexample awaiting audit,
    // not a change to the oracle or an assertion that its author has independently audited it.
    const checked=c.id==='B1'?{...c.expected,bars:c.expected.bars.map((b,i)=>i===0?{...b,reference:30,ratio:1}:b)}:c.expected;
    if(c.id==='B1') {expect(c.expected.bars[0]!.reference).toBe(60);expect(d.bars[0]!.reference).toBe(30);expect(d.bars[0]!.ratio).toBe(1);}
    equalNumbers(d,checked);
    const intervals=c.onsets.slice(1).map((t,i)=>[i,i+1,t-c.onsets[i]!] as [number,number,number]);
    const r=expandReport2(label,{overall:c.expected.overall,intervals,flags:c.flags,notes:{default:'match'}});
    const positions=eventPositions(label), events=label.events.map((e,i)=>({quarter:e.quarter,at:positions[i]!}));
    const report:AssessmentReport3={...r,format:'assessment-report@3',tempo:{...r.tempo,bars:reportedBars(events,r.tempo.intervals)}};
    equalNumbers(report.tempo.bars,checked.bars.map(({expected:_expected,...b})=>b));
    const e=evaluateAssessment3(label,report);expect(assessmentGates2(label,e).passed).toBe(true);expect(pooledGates2([{label,following:null,assessment:e}]).every(g=>g.passed)).toBe(true);
    expect(e.falseFindings).toBe(0);expect(e.notes.matched.confirmed).toBe(c.quarters.length);expect(e.barReports.unreported).toBe(0);
    if(!c.expected.bars[0]!.eligible) {
      const bad=evaluateAssessment3(label,{...report,tempo:{...report.tempo,flags:[{ordinal:0,direction:'slow'}]}});
      expect(bad.flags.slow.falseAlarms).toBe(1);
    }
  });
 }
 for(const x of o.states)it(x.id,()=>expect(nextState(x)).toBe(x.expected));
 for(const x of o.marginCases)it(`margin ${x.name}`,()=>equalNumbers(normalizedMargin(x.name,x.value),x.expected));
 it('selection ties are ASCII stable and independent of input order',()=> {
  for(const inputs of [o.selection.inputs,[...o.selection.inputs].reverse()]){
   const s=chooseSentinels(inputs);expect(s.performances.map(x=>x.id)).toEqual(o.selection.performances);expect(s.controls.map(x=>x.id)).toEqual(o.selection.controls);
  }
  expect(()=>chooseSentinels(o.selection.inputs.filter(x=>x.id!=='wrong-b'))).toThrow('Missing');
  expect(()=>chooseSentinels([...o.selection.inputs,o.selection.inputs[0]!])).toThrow('Invalid');
 });
 it('retirement needs three consecutive incumbent passes and harder active evidence',()=> {for(const x of o.retirement)expect(canRetire(x.history,x.harder)).toBe(x.expected);});
 it('routine plan uses attempted sets and earlier sentinels; sweep restores retired full sets',()=> {
  const stages=[{id:'early',status:'passed' as const,examples:['a','b','sil','wrong'],sentinels:['b','sil','wrong'],retired:true},{id:'new',status:'open' as const,examples:['c','sil-c','wrong-c'],sentinels:[]}];
  expect(suitePlan(stages,['new'],false)).toEqual(['b','c','sil','sil-c','wrong','wrong-c']);
  expect(suitePlan(stages,[],true)).toEqual(['a','b','c','sil','sil-c','wrong','wrong-c']);
 });
});

// These are handwritten reports from oracle@2, not listener reports. Preserve its complete
// unchanged note/interval/control rules while changing only the flag reference.
describe('unchanged assessment rules carried into version3',()=> {
 const old=readOracle2();
 for(const c of old.assessment)for(const id of c.labels)for(const [name,r]of Object.entries(c.reports)) {
  it(`${c.id}-${name} ${id}`,()=> {
   const label=expandLabel2(old,id),report=expandReport2(label,r.report),positions=eventPositions(label);
   const bars=reportedBars(label.events.map((e,i)=>({quarter:e.quarter,at:positions[i]!})),report.tempo.intervals);
   const a=evaluateAssessment2(label,report),b=evaluateAssessment3(label,{...report,format:'assessment-report@3',tempo:{...report.tempo,bars}});
   expect(b.notes).toEqual(a.notes);expect(b.intervals).toEqual(a.intervals);expect(b.overall).toEqual(a.overall);
   expect(b.claimedPlayed).toBe(a.claimedPlayed);expect(b.tempoClaims).toBe(a.tempoClaims);
   if(label.cursor.segments.every(s=>s.state==='unsupported'))expect(assessmentGates2(label,b).failed).toEqual(r.expected.gates);
  });
 }
});
