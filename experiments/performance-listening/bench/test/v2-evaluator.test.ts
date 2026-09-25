import { expect, it } from 'vitest';
import { evaluateV2 } from '../src/v2/evaluate.ts';
import { validateGoldenV2 } from '../src/v2/validate.ts';
import { rational } from '../src/types.ts';
import { golden, position } from '../oracle-v2/fixtures.ts';
it('works the uncertainty oracle, including exact tolerance boundaries',()=>{
  for (const [q,lower,upper,indeterminate] of [[.125,1,1,0],[0,1,1,0],[.4,0,1,20],[1,0,0,0]]) {
    const e=evaluateV2(golden(),[position(q!)]);
    expect(e.supportedCorrect).toEqual({lower,upper}); expect(e.denominators.indeterminate).toBe(indeterminate);
    expect(e.exposure.seconds).toEqual({lower:1-upper!,upper:1-lower!});
    expect(e.deadlineMiss).toEqual({lower:1-upper!,upper:1-lower!});
  }
});
it('integrates moving-truth exposure at the tolerance crossing, independent of grid',()=>{
  const g=golden();if(g.labels[0]!.state!=='supported')throw Error();
  g.labels[0]!.truth={route:1,start:{lower:0,upper:0},end:{lower:1,upper:1}};
  const e=evaluateV2(g,[position(0)]);
  expect(e.supportedCorrect).toEqual({lower:.25,upper:.25});expect(e.exposure.seconds).toEqual({lower:.75,upper:.75});
  const shifted=evaluateV2(g,[position(.013)]);
  expect(shifted.exposure.seconds).toEqual({lower:.737,upper:.737});
});
it('does not hide unknown reference time or missing decisions',()=>{
  const g=golden(), l=g.labels[0]!;g.labels=[{start:0,end:.5,state:'unknown',reason:'unchecked',evidence:'oracle'}, {...l,start:.5,answerableFrom:.5} as typeof l];
  const e=evaluateV2(g,[position(.125)]);expect(e.denominators).toMatchObject({unknown:10,supported:10,answerable:10});expect(e.referenceCoverage).toBe(.5);
  const empty=evaluateV2(g,[]);expect(empty.coverage).toEqual({lower:0,upper:0});expect(empty.deadlineMiss).toEqual({lower:1,upper:1});expect(empty.exposure.seconds).toEqual({lower:0,upper:0});
});
it('preserves answerability boundaries and continuous false exposure',()=>{
  const g=golden();g.role='wrong-score';g.labels=[{start:0,end:1,state:'unsupported',answerableFrom:.15,evidence:'distinguishing event + allowance'}];
  const e=evaluateV2(g,[position(0),{id:'reject',kind:'unsupported',madeAt:.3,refersTo:.3}]);
  expect(e.denominators).toMatchObject({pending:2,unsupported:18});
  expect(e.points.filter(p=>p.verdict==='correctRejection')).toHaveLength(15);
  expect(e.exposure.seconds).toEqual({lower:.15,upper:.15});expect(e.denominators.answerableSeconds).toBe(.85);
});
it('allows a timely correction without erasing live wrong exposure',()=>{
  const g=golden();const e=evaluateV2(g,[position(1),{...position(.125,.3,'fix'),supersedes:'p'}]);
  expect(e.exposure.seconds).toEqual({lower:.3,upper:.3});expect(e.deadlineMiss).toEqual({lower:.05,upper:.05});
  expect(e.points[0]!.deadlineMiss).toEqual({lower:1,upper:1});expect(e.points[1]!.deadlineMiss).toEqual({lower:0,upper:0});
});
it('separates route equivalence from annotation uncertainty',()=>{
  const g=golden();expect(evaluateV2(g,[position(.125,0,'p',2)]).supportedCorrect).toEqual({lower:0,upper:0});
  const l=g.labels[0]!;if(l.state!=='supported')throw Error();l.alternatives=[{route:2,start:{lower:4,upper:4},end:{lower:4,upper:4}}];
  const d=position(.125);if(d.kind!=='position')throw Error();d.candidates[0]!.weight=.5;d.candidates.push({position:{quarters:rational(4),route:2},weight:.5});
  expect(evaluateV2(g,[d]).supportedCorrect).toEqual({lower:1,upper:1});d.candidates[1]!.position.quarters=rational(5);
  expect(evaluateV2(g,[d]).exposure.seconds).toEqual({lower:1,upper:1});
});
it('rejects gaps, broad uncertainty, missing provenance and future records',()=>{
  const g=golden();g.labels[0]!.start=.1;expect(()=>validateGoldenV2(g)).toThrow(/tile/);
  const broad=golden();if(broad.labels[0]!.state!=='supported')throw Error();broad.labels[0]!.truth.start.upper=.251;expect(()=>validateGoldenV2(broad)).toThrow(/uncertainty/);
  const missing=golden();missing.provenance.reviewer='';expect(()=>validateGoldenV2(missing)).toThrow(/provenance/);
  expect(()=>evaluateV2(golden(),[position(0,1.1)])).toThrow(/audio contract/);
});
