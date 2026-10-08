import test from 'node:test';
import assert from 'node:assert/strict';
import {effectsMemoProbe} from '../scripts/wasm_effects_memo_probe.mjs';
import {FAUST_MATH_IMPORTS} from '../web/audio/math-imports.js';
const leb=x=>{const bytes=[];do{const b=x&127;x=Math.floor(x/128);bytes.push(b|(x?128:0));}while(x);return bytes;};
const section=(id,bytes)=>Buffer.from([id,...leb(bytes.length),...bytes]);
const str=s=>[...leb(s.length),...Buffer.from(s)];
function fixture(names=['_cosf'],calls=[0],{arity=1,globals=0,prefix=[],suffix=[]}={}){
 const bodies=calls.map((index,k)=>[0,...(typeof prefix==='function'?prefix(k):prefix),...Array.from({length:arity},(_,i)=>[0x20,i]).flat(),0x10,...leb(index),...(typeof suffix==='function'?suffix(k):suffix),0x0b]);
 return Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),
  section(1,[1,0x60,arity,...Array(arity).fill(0x7d),1,0x7d]),
  section(2,[...leb(names.length),...names.flatMap(n=>[...str('env'),...str(n),0,0])]),
  section(3,[...leb(calls.length),...calls.map(()=>0)]),
  ...(globals?[section(6,[...leb(globals),...Array.from({length:globals},()=>[0x7f,0,0x41,0,0x0b]).flat()])]:[]),
  section(7,[...leb(calls.length+(globals?1:0)),...calls.flatMap((_,i)=>[...str('f'+i),0,...leb(names.length+i)]),...(globals?[...str('legacy'),3,0]:[])]),
  section(10,[...leb(bodies.length),...bodies.flatMap(b=>[...leb(b.length),...b])])]);
}
const instantiate=(bytes,imports=FAUST_MATH_IMPORTS)=>new WebAssembly.Instance(new WebAssembly.Module(bytes),imports).exports;
test('optional loop filtering leaves sample-loop imports direct without changing default transforms or results',()=>{
 const source=fixture(['_expf'],[0,0],{prefix:k=>k?[0x03,0x7d]:[],suffix:k=>k?[0x0b]:[]});
 const all=effectsMemoProbe(source),filtered=effectsMemoProbe(source,{cacheSite:site=>site.loopDepth===0});
 assert.equal(all.sites.length,2);assert.equal(filtered.sites.length,1);assert.equal(filtered.skippedSites.length,1);assert.equal(filtered.skippedSites[0].loopDepth,1);
 const a=instantiate(source),b=instantiate(filtered.bytes);
 for(const key of ['f0','f1'])for(const value of [0,-0,.1,-.1,1,NaN,Infinity,-Infinity])assert.ok(Object.is(a[key](value),b[key](value)));
});
test('each decoded call site has an independent exact-bit cache, with first-zero and signed-zero misses',()=>{
 const original=fixture(['_tanf'],[0,0]),probe=effectsMemoProbe(original);let calls=0;
 const imports={env:{_tanf:x=>{calls++;return Math.tan(x);}}},a=instantiate(original,imports),b=instantiate(probe.bytes,imports);
 assert.equal(probe.sites.length,2);assert.equal(probe.addedGlobalCount,6);
 for(const key of ['f0','f1']){
  const before=calls;assert.equal(b[key](0),0);assert.equal(calls,before+1,'first zero must call import');
  assert.equal(b[key](0),0);assert.equal(calls,before+1,'repeated exact key should hit');
  assert.ok(Object.is(b[key](-0),-0));assert.equal(calls,before+2,'negative zero is a distinct key');
  assert.ok(Object.is(b[key](-0),-0));assert.equal(calls,before+2);
 }
 for(const x of [1,-1,.1,-.1,2**-149,Math.fround(3.402823466e38),Infinity,-Infinity,NaN])for(let repeat=0;repeat<2;repeat++)assert.ok(Object.is(a.f0(x),b.f0(x)));
 const second=instantiate(probe.bytes,imports),before=calls;second.f0(.1);assert.equal(calls,before+1,'cache must not be shared between instances');
});
test('nonfinite inputs and results call through every time and preserve previous finite entries',()=>{
 const original=fixture(['_expf']),probe=effectsMemoProbe(original);let calls=0;
 const imports={env:{_expf:x=>{calls++;return Math.exp(x);}}},b=instantiate(probe.bytes,imports);
 assert.equal(b.f0(0),1);assert.equal(calls,1);assert.equal(b.f0(0),1);assert.equal(calls,1);
 for(const x of [Infinity,-Infinity,NaN,1000]){
  const before=calls;for(let repeat=0;repeat<2;repeat++)assert.ok(Object.is(b.f0(x),Math.fround(Math.exp(x))));
  assert.equal(calls,before+2,'nonfinite input/result must not be cached');
  const after=calls;assert.equal(b.f0(0),1);assert.equal(calls,after,'failed cache fill must leave previous finite key intact');
 }
});
test('power uses multiply only for exponent two; other finite powers use both exact keys',()=>{
 const original=fixture(['_powf'],[0],{arity:2}),probe=effectsMemoProbe(original),a=instantiate(original);let calls=0;
 const b=instantiate(probe.bytes,{env:{_powf:(x,y)=>{calls++;return Math.pow(x,y);}}});
 for(const x of [0,-0,1,-1,2,-2,2**-149,2**-126,Math.fround(3.402823466e38),Infinity,-Infinity,NaN]){
  const before=calls;assert.ok(Object.is(a.f0(x,2),b.f0(x,2)));assert.equal(calls,before,'squares bypass the import');
 }
 for(const [x,y] of [[3,.5],[3,.5],[4,.5],[4,1],[4,1],[-0,1],[-0,1],[0,1],[0,-0],[0,0],[-1,.5],[-1,.5],[Infinity,1],[Infinity,1],[3,NaN],[3,NaN]])assert.ok(Object.is(a.f0(x,y),b.f0(x,y)));
 const before=calls;b.f0(7,3);assert.equal(calls,before+1);b.f0(7,3);assert.equal(calls,before+1);b.f0(7,4);assert.equal(calls,before+2);b.f0(8,4);assert.equal(calls,before+3);
});
test('audio-rate sine and tanh imports are not redirected or cached',()=>{
 const source=fixture(['_cosf','_sinf','_tanhf'],[0,1,2]),probe=effectsMemoProbe(source),counts={_cosf:0,_sinf:0,_tanhf:0};
 const imports={env:Object.fromEntries(Object.keys(counts).map(name=>[name,x=>{counts[name]++;return FAUST_MATH_IMPORTS.env[name](x);}])),},a=instantiate(source),b=instantiate(probe.bytes,imports);
 for(let repeat=0;repeat<4;repeat++)for(let i=0;i<3;i++)assert.equal(b['f'+i](.25),a['f'+i](.25));
 assert.deepEqual(counts,{_cosf:1,_sinf:4,_tanhf:4});assert.equal(probe.sites.length,1);
});
test('appended private globals/helpers preserve existing exports across multi-byte index boundaries',()=>{
 const source=fixture(['_cosf'],Array(128).fill(0),{globals:129}),probe=effectsMemoProbe(source),a=instantiate(source),b=instantiate(probe.bytes);
 assert.equal(probe.originalGlobalCount,129);assert.equal(probe.sites[0].helperIndex,129);assert.equal(b.legacy.value,a.legacy.value);
 for(const i of [0,63,127])for(const x of [0,.1,1])assert.equal(a['f'+i](x),b['f'+i](x));
});
test('decoder skips literal immediates and rejects unsupported layouts rather than guessing',()=>{
 const source=fixture(['_cosf'],[0],{prefix:[0x43,0x10,0,0,0,0x1a]});assert.equal(effectsMemoProbe(source).sites.length,1);
 assert.throws(()=>effectsMemoProbe(Buffer.from([0])),/invalid/);
 const unknown=fixture(['_cosf'],[0],{prefix:[0xd0,0x6f,0x1a]});assert.ok(WebAssembly.validate(unknown));assert.throws(()=>effectsMemoProbe(unknown),/Unsupported instruction/);
 assert.throws(()=>effectsMemoProbe(fixture(['_sinf'])),/No supported/);
 assert.throws(()=>effectsMemoProbe(fixture(['_cosf','_cosf'])),/Duplicate target/);
 const abi=Buffer.from(fixture()),at=abi.indexOf(Buffer.from([0x60,1,0x7d,1,0x7d]));abi[at+4]=0x7f;assert.ok(WebAssembly.validate(abi));assert.throws(()=>effectsMemoProbe(abi),/ABI changed/);
});
