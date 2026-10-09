// Scalar WASM decoder used by the fail-closed Engine2 knock optimization.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const leb=x=>{const out=[];do{const n=x&127;x=Math.floor(x/128);out.push(n|(x?128:0));}while(x);return Buffer.from(out);};
class Reader{
 constructor(bytes){this.bytes=bytes;this.pos=0;}
 byte(){assert.ok(this.pos<this.bytes.length);return this.bytes[this.pos++];}
 unsigned(){let v=0,m=1;for(let i=0;i<5;i++){const b=this.byte();v+=(b&127)*m;if(!(b&128))return v;m*=128;}throw Error('Unsupported integer');}
 signed(n=5){for(let i=0;i<n;i++)if(!(this.byte()&128))return;throw Error('Unsupported signed integer');}
 take(n){assert.ok(this.pos+n<=this.bytes.length);const b=this.bytes.subarray(this.pos,this.pos+n);this.pos+=n;return b;}
}
export function sectionsOf(bytes){const r=new Reader(bytes);assert.deepEqual(r.take(8),Buffer.from([0,97,115,109,1,0,0,0]));const sections=[];while(r.pos<bytes.length){const id=r.byte();sections.push({id,payload:r.take(r.unsigned())});}return sections;}
export function decodeBody(body){
 const r=new Reader(body),locals=r.unsigned();for(let i=0;i<locals;i++){r.unsigned();assert.ok([0x7f,0x7e,0x7d,0x7c].includes(r.byte()));}
 const prefix=body.subarray(0,r.pos),instructions=[];
 while(r.pos<body.length){
  const start=r.pos,op=r.byte();let arg;
  if([2,3,4].includes(op))r.signed();
  else if([0x10,0x0c,0x0d,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x3f,0x40].includes(op))arg=r.unsigned();
  else if(op===0x0e){const n=r.unsigned();for(let i=0;i<=n;i++)r.unsigned();}
  else if(op===0x11){r.unsigned();r.unsigned();}
  else if(op>=0x28&&op<=0x3e)arg=[r.unsigned(),r.unsigned()];
  else if(op===0x41)r.signed();else if(op===0x42)r.signed(10);
  else if(op===0x43)arg=r.take(4).readFloatLE();else if(op===0x44)r.take(8);
  else if(op===0xfc){const x=r.unsigned();if(x>7)throw Error('Unsupported extended instruction');}
  else assert.ok([0,1,5,0x0b,0x0f,0x1a,0x1b].includes(op)||(op>=0x45&&op<=0xc4),`Unsupported opcode ${op}`);
  instructions.push({start,end:r.pos,op,arg,bytes:body.subarray(start,r.pos)});
 }
 return {prefix,instructions};
}
export function codeBodies(bytes){const code=sectionsOf(bytes).find(s=>s.id===10),r=new Reader(code.payload),count=r.unsigned(),bodies=[];for(let i=0;i<count;i++)bodies.push(r.take(r.unsigned()));assert.equal(r.pos,r.bytes.length);return bodies;}

// This is deliberately NOT a general optimizer: reject every other DSP build.
// Retain all original indices, memory, latches, counters and body history.
// Only a pure waveform whose selector/window is zero gains a real WASM branch.
// The active branch contains the original byte-for-byte f32 operation order.
export function inactiveKnockGuard(input){
 const bytes=Buffer.from(input);
 // Raw FAUST output of dsp/engine2 compiled from the fixed staging path (see
 // scripts/build_engine2.mjs); FAUST embeds include paths in the binary's data.
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'0324233da79dae7ccf1ecb90eeb1c21742f373e7914bbc6f7c82ddbe9aae9eef','Unexpected Engine2 raw binary');
 const sections=sectionsOf(bytes),bodies=codeBodies(bytes),body=bodies[1],ins=decodeBody(body).instructions,sites=[],parts=[];
 const shape='43,41,2a,41,2a,94,41,2a,43,5b,41,2a,43,5b,72,41,2a,43,5b,6c,b2,94,41,2a,20,94,10,43,41,2a,20,94,10,94,92,94,43,41,2a,20,94,94,10,94,41,2a,20,94,43,5d,b2,94,94,92';
 const concat=items=>Buffer.concat(items.map(x=>x.bytes));let cursor=0;
 for(let i=0;i<ins.length;i++){
  if(ins[i].op!==0x43||ins[i].arg!==Math.fround(.65))continue;
  const term=ins.slice(i,i+54);if(term.map(x=>x.op.toString(16)).join(',')!==shape)continue;
  const string=sites.length;assert.equal(term[8].arg,-1);assert.equal(term[12].arg,string);assert.equal(term[17].arg,2);
  assert.equal(term[26].arg,4);assert.equal(term[32].arg,4);assert.equal(term[42].arg,2);
  assert.equal(term[27].arg,Math.fround(.45));assert.equal(term[36].arg,-1);assert.equal(term[48].arg,Math.fround(.025));
  assert.deepEqual(term[7].arg,term[11].arg);assert.equal(term[24].arg,term[30].arg);assert.equal(term[24].arg,term[39].arg);assert.equal(term[24].arg,term[46].arg);
  // i32 selector (0/1) AND the original f32 time-window comparison.
  const condition=Buffer.concat([concat(term.slice(6,20)),concat(term.slice(44,50)),Buffer.from([0x71])]);
  const start=term[0].start,end=term[52].end;
  parts.push(body.subarray(cursor,start),condition,Buffer.from([0x04,0x7d]),body.subarray(start,end),Buffer.from([0x05,0x43,0,0,0,0,0x0b]));
  sites.push({string,functionIndex:8,start,end,ageLocal:term[24].arg,selectorOffset:term[7].arg[1],trialOffset:term[16].arg[1]});cursor=end;i+=52;
 }
 assert.equal(sites.length,6,'Expected six knock waveforms');parts.push(body.subarray(cursor));bodies[1]=Buffer.concat(parts);
 sections.find(s=>s.id===10).payload=Buffer.concat([leb(bodies.length),...bodies.flatMap(b=>[leb(b.length),b])]);
 const result=Buffer.concat([bytes.subarray(0,8),...sections.flatMap(s=>[Buffer.from([s.id]),leb(s.payload.length),s.payload])]);
 assert.ok(WebAssembly.validate(result),'Guarded module invalid');
 for(const api of ['imports','exports'])assert.deepEqual(WebAssembly.Module[api](new WebAssembly.Module(result)),WebAssembly.Module[api](new WebAssembly.Module(bytes)));
 return {bytes:result,sites};
}
