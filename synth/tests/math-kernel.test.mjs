// The WASM math kernel (web/audio/math-kernel.js) must return exactly what the JS
// imports return. tanh is a port, checked here on a dense sample and exhaustively by
// scripts/verify_math_kernel.mjs; the memoized functions call the JS import on a
// miss, so they are checked for exactness under repeats and slot collisions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mathKernel,mathKernelBytes,MEMOIZED} from '../web/audio/math-kernel.js';
import {JS_MATH_IMPORTS,FAUST_MATH_IMPORTS} from '../web/audio/math-imports.js';
const u=new Uint32Array(1),f=new Float32Array(u.buffer),fromBits=b=>{u[0]=b;return f[0];};
const same=(a,b)=>Object.is(a,b)||(a!==a&&b!==b);
const EDGES=[0,-0,Infinity,-Infinity,NaN,1,-1,.5,-.5,2,22,-22,1e-30,-1e-30,2**-28,2**-27,2**-54,1e30,-1e30,0.34657359,1.03972077,3.4028235e38,1.4e-45,-1.4e-45].map(Math.fround);

test('the kernel assembles deterministically into a valid module exporting every function',()=>{
 const a=mathKernelBytes(),b=mathKernelBytes();assert.deepEqual(a,b);assert.ok(WebAssembly.validate(a));
 const k=mathKernel(JS_MATH_IMPORTS);for(const name of ['_tanhf',...MEMOIZED])assert.equal(typeof k[name],'function',name);
});

test('tanh equals Math.fround(Math.tanh(x)) on every 4099th float32 pattern, branch edges and specials',()=>{
 const k=mathKernel(JS_MATH_IMPORTS);let checked=0;
 const check=x=>{checked++;const a=k._tanhf(x),e=JS_MATH_IMPORTS._tanhf(x);if(!same(a,e))assert.fail(`tanh(${x}): ${a} vs ${e}`);};
 for(let b=0;b<2**32;b+=4099)check(fromBits(b));
 // Dense runs around fdlibm's branch thresholds (|x| = 2^-28, 0.5 ln2, 1, 1.5 ln2, 22) on both signs.
 for(const t of [2**-28,.34657359,1,1.03972077,22])for(const s of [1,-1]){u[0]=0;f[0]=Math.fround(t);const c=u[0];for(let d=-2000;d<=2000;d++)check(s*fromBits(c+d));}
 EDGES.forEach(check);assert.ok(checked>1e6);
});

test('memoized functions return the JS import exactly under repeats and slot collisions',()=>{
 const k=mathKernel(JS_MATH_IMPORTS),rand=(()=>{let s=12345;return ()=>(s=Math.imul(s^s>>>15,0x2c1b3c6d)+0x9e3779b9>>>0)/2**32;})();
 for(const name of MEMOIZED){
  const binary=name==='_powf',js=JS_MATH_IMPORTS[name],fn=k[name];
  // A small pool so most calls hit, plus 20k distinct values that keep evicting slots.
  const pool=[...EDGES,...Array.from({length:200},()=>Math.fround((rand()-.5)*20))];
  for(let i=0;i<60000;i++){
   const x=i%3?pool[(rand()*pool.length)|0]:Math.fround((rand()-.5)*1000),y=binary?(i%2?pool[(rand()*pool.length)|0]:Math.fround(rand()*4-2)):undefined;
   const a=binary?fn(x,y):fn(x),e=binary?js(x,y):js(x);if(!same(a,e))assert.fail(`${name}(${x}${binary?','+y:''}): ${a} vs ${e}`);
  }
  // Swapped arguments and ±0 keys are distinct entries.
  if(binary){assert.ok(same(fn(2,3),js(2,3)));assert.ok(same(fn(3,2),js(3,2)));assert.ok(same(fn(-0,-1),js(-0,-1)));assert.ok(same(fn(0,-1),js(0,-1)));}
  else{assert.ok(same(fn(-0),js(-0)));assert.ok(same(fn(0),js(0)));}
 }
});

test('the FAUST imports route through the kernel and keep every other JS function',()=>{
 const env=FAUST_MATH_IMPORTS.env,kernel=['_tanhf',...MEMOIZED];
 assert.deepEqual(Object.keys(env).sort(),Object.keys(JS_MATH_IMPORTS).sort());
 for(const name of Object.keys(env))assert.equal(env[name]===JS_MATH_IMPORTS[name],!kernel.includes(name),name);
 for(const name of kernel)for(const x of EDGES)assert.ok(same(name==='_powf'?env[name](x,x):env[name](x),name==='_powf'?JS_MATH_IMPORTS[name](x,x):JS_MATH_IMPORTS[name](x)),name);
});
