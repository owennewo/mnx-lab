import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhitener } from './whitening.mjs';
import { createScorer, harmonicDictionary } from './spectral.mjs';
import { detectDSP } from './stream.mjs';
import { readJSON } from '../evaluation/io.mjs';
const base=readJSON(new URL('../experiments/baseline.json',import.meta.url));
const configured={...base,whitening:{strength:.67,floor:1e-4,maxGain:16}};
test('whitening bypass is exact; silent spectra remain zero; gains bounded and level invariant',()=>{
 const x=Float64Array.from({length:base.fftSize/2+1},(_,i)=>i%31===0?1:.001);
 assert.equal(createWhitener(base)(x),x);
 assert.equal(createWhitener({...configured,whitening:{...configured.whitening,strength:0}})(x),x);
 const w=createWhitener(configured),a=w(x),b=w(Float64Array.from(x,v=>v*.03));
 for(let i=0;i<x.length;i++){assert.ok(a[i]>=x[i]&&a[i]<=16*x[i]+1e-12);assert.ok(Math.abs(a[i]*.03-b[i])<1e-12)}
 assert.ok(w(new Float64Array(x.length)).every(v=>v===0));
});
test('whitening preserves harmonic peak positions while reducing broad-band imbalance',()=>{
 const x=new Float64Array(base.fftSize/2+1);for(const [k,v] of [[20,.01],[40,.01],[400,1],[430,1]])x[k]=v;
 const y=createWhitener(configured)(x);
 assert.deepEqual([...y.keys()].filter(i=>y[i]>0),[20,40,400,430]);
 assert.ok(y[20]/y[400]>x[20]/x[400]);
});
test('whitened stream is causal and invariant to delivery chunks',()=>{
 const c={...configured,fusion:{threshold:.15,refractorySeconds:.09,associationSeconds:.035,mode:'restrike-only',neighborRatio:1}};
 const pcm=Float32Array.from({length:22050},(_,i)=>i<4000||i>18000?0:.05*Math.sin(2*Math.PI*110*i/22050)+.15*Math.sin(2*Math.PI*220*i/22050));
 const run=(x,chunk)=>detectDSP(x,createScorer(harmonicDictionary(c),'harmonic',c),c,chunk).events;
 const id=ns=>ns.map(({availableAt,emittedAt,...n})=>n);
 const full=run(pcm,256);assert.deepEqual(id(full),id(run(pcm,2048)));
 const cut=12032,partial=run(pcm.subarray(0,cut),256);
 const beginnings=ns=>ns.filter(n=>n.decisionSample<=cut).map(n=>[n.pitch,n.start,n.decisionSample,n.kind]);
 assert.deepEqual(beginnings(partial),beginnings(full));
});
