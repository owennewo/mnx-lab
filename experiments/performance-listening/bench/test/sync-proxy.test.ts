import { expect,it } from 'vitest';
import { evaluateProxy,positionAt,validateProxy,type ProxyReference } from '../src/proxy/reference.ts';
import { magnitudeSpectrum,spectralFollower1 } from '../src/candidates/spectralFollower1.ts';
import { rational } from '../src/types.ts';
import { execute } from '../src/run/runner.ts';
import { readFileSync } from 'node:fs';
const reference:ProxyReference={kind:'linear-sync-proxy',duration:2,allowance:.15,uncertainty:'unmeasured',anchors:[{seconds:0,quarter:0,route:1},{seconds:1,quarter:2,route:1},{seconds:2,quarter:3,route:1}]};
it('interpolates the actual bracketing sync anchors, retaining unknown acoustic precision',()=>{
 expect(positionAt(reference,.5)).toEqual({quarter:1,route:1,qps:2});expect(positionAt(reference,1.5)).toEqual({quarter:2.5,route:1,qps:1});
 expect(()=>validateProxy({...reference,anchors:[reference.anchors[1]!,reference.anchors[0]!]})).toThrow();
 const record=Array.from({length:200},(_,i)=>{const t=(i+1)/100;return{id:`p${i}`,madeAt:t,refersTo:t,kind:'position' as const,confidence:1,candidates:[{position:{quarters:rational(Math.round(positionAt(reference,t)!.quarter*100),100),route:1},weight:1}]};});
 const e=evaluateProxy(reference,record);expect(e.summary.agreement).toBe(1);expect(e.referenceUncertainty).toBe('unmeasured');expect(e.summary.wrongReferenceExposure).toBe(0);
});
it('reports signed timing residuals and exact silence rejection without inventing timing precision',()=>{
 const r={...reference,kind:'digital-silence' as const,anchors:[],uncertainty:'exact-silence' as const};
 expect(evaluateProxy(r,[{id:'u',kind:'unsupported',madeAt:0,refersTo:0}]).summary.agreement).toBe(1);
 const e=evaluateProxy(reference,[{id:'p',kind:'position',madeAt:0,refersTo:0,confidence:1,candidates:[{position:{quarters:rational(0),route:1},weight:1}]}]);
 expect(e.summary.residualSeconds.signedMean).toBeLessThan(0);expect(e.summary.deadlineMisses).toBeGreaterThan(0);
});
it('finds a known sinusoid without peeking at later samples, and rejects digital silence',()=>{
 const n=2048,signal=Float64Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*75*i/n)),spectrum=magnitudeSpectrum(signal);
 expect(Array.from(spectrum).indexOf(Math.max(...spectrum))).toBe(75);
 const score=JSON.parse(readFileSync(new URL('../../contracts/handwritten.score.mnx.json',import.meta.url),'utf8'));
 const r=execute(spectralFollower1,score,{bpm:120,unit:'quarter'},new Float32Array(24000));
 expect(r.record.every(d=>d.kind==='unsupported')).toBe(true);
});
