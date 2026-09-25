import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { golden } from '../oracle-v2/fixtures.ts';
import { writeWav } from '../src/generate/wav.ts';
import { clockFollower } from '../src/candidates/clockFollower.ts';
import { runDevelopmentPair, type ReviewedInput } from '../src/v2/run-pair.ts';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const pins={candidate:'test-clock-copy@1',candidateCodeSha256:'a'.repeat(64),instrumentHash:'b'.repeat(64),setHash:'c'.repeat(64),runId:'test-only'};
function input():ReviewedInput{
 const g=golden(),scoreBytes=readFileSync(new URL('../../contracts/handwritten.score.mnx.json',import.meta.url)),wavBytes=writeWav(new Int16Array(48000)),reviewBytes=Buffer.from('Independent test fixture, not real evidence');
 g.intended.scoreSha256=sha(scoreBytes);g.audio.sha256=sha(wavBytes);g.provenance.evidenceSha256=sha(reviewBytes);
 return {golden:g,scoreBytes,wavBytes,reviewBytes};
}
it('executes both actual chunk streams with nontrivial futures and reports the development-only verdict',()=>{
 const r=runDevelopmentPair([input()],clockFollower,pins);
 expect(r.comparator.measurements[0]!.causality).toEqual({checks:6,pass:true});expect(r.candidate.measurements[0]!.causality).toEqual({checks:6,pass:true});
 expect(r.records['clock-follower@1/bounded']).toHaveLength(100);expect(r.records['test-clock-copy@1/bounded']).toEqual(r.records['clock-follower@1/bounded']);
 expect(r.resources.cpuSeconds).toBeGreaterThan(0);expect(r.decision.decision).not.toBe('retain');
});
it('refuses tampered assets, missing precision, unchecked recording facts and reserved data before candidate execution',()=>{
 for(const change of [(i:ReviewedInput)=>{i.wavBytes=Buffer.from('tampered');},(i:ReviewedInput)=>{i.golden.labels=[{start:0,end:1,state:'unknown',reason:'unreviewed',evidence:'test'}];},(i:ReviewedInput)=>{i.golden.provenance.kind='recording';},(i:ReviewedInput)=>{i.golden.partition='reserved';}]){
  const i=input();change(i);let called=false;expect(()=>runDevelopmentPair([i],()=>{called=true;return clockFollower();},pins)).toThrow();expect(called).toBe(false);
 }
});
