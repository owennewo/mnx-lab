import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { spectralFollower2 } from '../src/candidates/spectralFollower2.ts';
import { execute } from '../src/run/runner.ts';
import { evaluateProxy, type ProxyReference } from '../src/proxy/reference.ts';
import { rational } from '../src/types.ts';
const root=new URL('../../',import.meta.url);
const reference:ProxyReference={kind:'linear-sync-proxy',duration:1,allowance:.15,uncertainty:'unmeasured',anchors:[{seconds:0,quarter:0,route:1},{seconds:1,quarter:2,route:1}]};
it('does not credit positive rejection as following, even with complete decisions and no wrong exposure',()=>{
 const e=evaluateProxy(reference,[{id:'u',kind:'unsupported',madeAt:0,refersTo:0}]);
 expect(e.summary.coverage).toBe(1);expect(e.summary.agreement).toBe(0);expect(e.summary.wrongReferenceExposure).toBe(0);expect(e.summary.deadlineMisses).toBe(1);expect(e.summary.residualSeconds.denominator).toBe(0);
});
it('credits a correction within the deadline without erasing its original live error',()=>{
 const bad={id:'bad',kind:'position' as const,madeAt:.2,refersTo:.2,confidence:1,candidates:[{position:{quarters:rational(10),route:1},weight:1}]};
 const correction={...bad,id:'correction',supersedes:'bad',madeAt:.39,refersTo:.2,candidates:[{position:{quarters:rational(2,5),route:1},weight:1}]};
 const e=evaluateProxy(reference,[bad,correction]);
 expect(e.points.find(p=>p.time===.2)).toMatchObject({agreement:false,timely:true});expect(e.summary.wrongReferenceExposure).toBeGreaterThan(0);
 expect(evaluateProxy(reference,[bad,{...correction,madeAt:.41}]).points.find(p=>p.time===.2)?.timely).toBe(false);
});
it('harmonic revision hears a simple score tone, rejects silence and preserves its complete prefix',()=>{
 const score=JSON.parse(readFileSync(new URL('contracts/handwritten.score.mnx.json',root),'utf8'));
 const tone=Float32Array.from({length:24000},(_,i)=>[1,.4225,.16,.09].reduce((s,a,h)=>s+.2*a*Math.sin(2*Math.PI*261.625565*(h+1)*i/48000),0));
 const run=(pcm:Float32Array)=>execute(spectralFollower2,score,{bpm:60,unit:'quarter'},pcm).record;
 const a=run(tone),changed=tone.slice();changed.fill(0,12000);
 expect(a.some(d=>d.kind==='position')).toBe(true);
 expect(run(new Float32Array(24000)).every(d=>d.kind==='unsupported')).toBe(true);
 expect(run(changed).filter(d=>d.madeAt<=.25)).toEqual(a.filter(d=>d.madeAt<=.25));
});
it('preserves each real run implementation and the shared frozen reference identity',()=>{
 const ids=['g002a-spectral1-winner-sync-proxy','g002b-spectral2-winner-sync-proxy'];
 const runs=ids.map(id=>JSON.parse(readFileSync(new URL(`runs/${id}/summary.json`,root),'utf8')));
 for(const run of runs)for(const [path,hash] of Object.entries(run.sourceHashes))expect(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex')).toBe(hash);
 expect(runs[0].setSha256).toBe(runs[1].setSha256);expect(runs[0].comparator.examples.map((e:{metrics:unknown})=>e.metrics)).toEqual(runs[1].comparator.examples.map((e:{metrics:unknown})=>e.metrics));
});
