// Separate, fail-closed scalar WASM experiment, not a production transform.
// Binary section/instruction encodings:
// https://webassembly.github.io/spec/core/binary/modules.html
// https://webassembly.github.io/spec/core/binary/instructions.html
// Append per-call-site helpers and private globals without moving old indices.
// Exact finite float32 argument bits key each site's last finite result.
// Nonfinite inputs/results keep calling the original import. Power exponent 2
// uses the independently tested multiply path; sin/tanh/audio state are untouched.
import assert from 'node:assert/strict';
const leb=x=>{const b=[];do{const v=x&127;x=Math.floor(x/128);b.push(v|(x?128:0));}while(x);return Buffer.from(b);};
class Reader{
 constructor(bytes){this.bytes=bytes;this.pos=0;}
 byte(){assert.ok(this.pos<this.bytes.length,'Unexpected binary EOF');return this.bytes[this.pos++];}
 unsigned(){let v=0,m=1;for(let i=0;i<5;i++){const b=this.byte();v+=(b&127)*m;if(!(b&128)){assert.ok(v<=0xffffffff,'Integer overflow');return v;}m*=128;}throw Error('Unsupported integer encoding');}
 signed(n=5){for(let i=0;i<n;i++)if(!(this.byte()&128))return;throw Error('Unsupported signed encoding');}
 take(n){assert.ok(n>=0&&this.pos+n<=this.bytes.length,'Binary field exceeds section');const b=this.bytes.subarray(this.pos,this.pos+n);this.pos+=n;return b;}
 string(){return this.take(this.unsigned()).toString('utf8');}
 done(){assert.equal(this.pos,this.bytes.length,'Unexpected trailing bytes');}
}
const instruction=(op,index)=>Buffer.concat([Buffer.from([op]),leb(index)]);
const join=(...items)=>Buffer.concat(items.flat().map(x=>typeof x==='number'?Buffer.from([x]):x));
const local=i=>instruction(0x20,i),get=i=>instruction(0x23,i),set=i=>instruction(0x24,i);
const finite=i=>join(local(i),0x8b,Buffer.from([0x43,0,0,0x80,0x7f]),0x5d);
function helper(site){
 const n=site.arity,g=site.globalStart,valid=g,key=g+1,result=g+n+1,tmp=n;
 const hit=[get(valid)];for(let i=0;i<n;i++)hit.push(local(i),Buffer.from([0xbc]),get(key+i),Buffer.from([0x46,0x71]));
 const original=[...Array.from({length:n},(_,i)=>local(i)),instruction(0x10,site.importIndex),instruction(0x21,tmp)];
 const check=[finite(0)];for(let i=1;i<n;i++)check.push(finite(i),Buffer.from([0x71]));check.push(finite(tmp),Buffer.from([0x71,0x04,0x40]));
 const store=[];for(let i=0;i<n;i++)store.push(local(i),Buffer.from([0xbc]),set(key+i));
 store.push(local(tmp),set(result),Buffer.from([0x41,1]),set(valid),Buffer.from([0x0b]));
 const memo=join(hit,0x04,0x7d,get(result),0x05,original,check,store,local(tmp),0x0b);
 // One temporary f32 local follows the imported function's parameters.
 const body=site.name==='_powf'?join(Buffer.from([1,1,0x7d]),local(1),Buffer.from([0x43,0,0,0,0x40,0x5b,0x04,0x7d]),local(0),local(0),0x94,0x05,memo,0x0b,0x0b):join(Buffer.from([1,1,0x7d]),memo,0x0b);
 return body;
}
function rewrite(body,targets,append){
 const r=new Reader(body),locals=r.unsigned();for(let i=0;i<locals;i++){r.unsigned();assert.ok([0x7f,0x7e,0x7d,0x7c].includes(r.byte()),'Unsupported local type');}
 const parts=[body.subarray(0,r.pos)],scopes=[];
 while(r.pos<body.length){
  const start=r.pos,op=r.byte();let replacement;
  if(op===0x10){const index=r.unsigned();if(targets.has(index)){const helper=append(targets.get(index),start,scopes.filter(op=>op===0x03).length);if(helper!==null)replacement=instruction(op,helper);}}
  else if([0x02,0x03,0x04].includes(op)){r.signed();scopes.push(op);}
  else if(op===0x0b)scopes.pop();
  else if([0x0c,0x0d,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x3f,0x40].includes(op))r.unsigned();
  else if(op===0x0e){const n=r.unsigned();for(let i=0;i<=n;i++)r.unsigned();}
  else if(op===0x11){r.unsigned();r.unsigned();}
  else if(op>=0x28&&op<=0x3e){r.unsigned();r.unsigned();}
  else if(op===0x41)r.signed();else if(op===0x42)r.signed(10);
  else if(op===0x43)r.take(4);else if(op===0x44)r.take(8);
  else if(op===0xfc){const x=r.unsigned();if(x<=7){}else if(x===8||x===10){r.unsigned();r.unsigned();}else if(x===9||x===11)r.unsigned();else throw Error('Unsupported extended instruction');}
  else assert.ok([0,1,5,0x0b,0x0f,0x1a,0x1b].includes(op)||(op>=0x45&&op<=0xc4),`Unsupported instruction 0x${op.toString(16)}`);
  parts.push(replacement??body.subarray(start,r.pos));
 }
 return Buffer.concat(parts);
}
export function effectsMemoProbe(bytes,{cacheSite=()=>true}={}){
 bytes=Buffer.from(bytes);assert.ok(WebAssembly.validate(bytes),'Input module invalid');
 assert.ok(bytes.subarray(0,8).equals(Buffer.from([0,97,115,109,1,0,0,0])),'Unsupported module header');
 const r=new Reader(bytes);r.take(8);const sections=[];
 while(r.pos<bytes.length){const id=r.byte();sections.push({id,payload:r.take(r.unsigned())});}
 const get=(id,optional=false)=>{const x=sections.filter(s=>s.id===id);assert.ok(x.length<=1,'Duplicate section');if(!optional)assert.equal(x.length,1,`Missing section ${id}`);return x[0];};
 const types=[],t=new Reader(get(1).payload),typeCount=t.unsigned();
 for(let i=0;i<typeCount;i++){assert.equal(t.byte(),0x60,'Unsupported type layout');types.push({params:[...t.take(t.unsigned())],results:[...t.take(t.unsigned())]});}t.done();
 const im=new Reader(get(2).payload),importCount=im.unsigned(),targets=new Map(),names=new Set();
 for(let i=0;i<importCount;i++){
  const module=im.string(),name=im.string();assert.equal(im.byte(),0,'Only function imports supported');const type=im.unsigned();assert.ok(type<types.length,'Import type invalid');
  if(module==='env'&&['_expf','_cosf','_tanf','_powf'].includes(name)){
   assert.ok(!names.has(name),'Duplicate target import');names.add(name);const arity=name==='_powf'?2:1;
   assert.deepEqual(types[type],{params:Array(arity).fill(0x7d),results:[0x7d]},'Math import ABI changed');targets.set(i,{name,type,arity,importIndex:i});
  }
 }im.done();assert.ok(targets.size,'No supported math imports');
 const functions=get(3),f=new Reader(functions.payload),functionCount=f.unsigned(),entries=f.take(functions.payload.length-f.pos),fr=new Reader(entries);
 for(let i=0;i<functionCount;i++)assert.ok(fr.unsigned()<types.length,'Function type invalid');fr.done();
 let globals=get(6,true),globalCount=0,globalEntries=Buffer.alloc(0);
 if(globals){
  const g=new Reader(globals.payload);globalCount=g.unsigned();const start=g.pos;
  for(let i=0;i<globalCount;i++){
   assert.ok([0x7f,0x7e,0x7d,0x7c].includes(g.byte()),'Unsupported global type');assert.ok(g.byte()<=1,'Unsupported global mutability');
   const op=g.byte();if(op===0x41)g.signed();else if(op===0x42)g.signed(10);else if(op===0x43)g.take(4);else if(op===0x44)g.take(8);else throw Error('Unsupported global initializer');
   assert.equal(g.byte(),0x0b,'Unsupported global expression');
  }g.done();globalEntries=globals.payload.subarray(start);
 }
 const code=get(10),c=new Reader(code.payload);assert.equal(c.unsigned(),functionCount,'Code/function count mismatch');
 const sites=[],skippedSites=[],addedGlobals=[],bodies=[];
 for(let i=0;i<functionCount;i++){
  const body=rewrite(c.take(c.unsigned()),targets,(target,offset,loopDepth)=>{
   const descriptor={...target,functionIndex:importCount+i,offset,loopDepth};
   if(!cacheSite(descriptor)){skippedSites.push(descriptor);return null;}
   const site={...descriptor,helperIndex:importCount+functionCount+sites.length,globalStart:globalCount+addedGlobals.length};sites.push(site);
   for(let k=0;k<target.arity+1;k++)addedGlobals.push(Buffer.from([0x7f,1,0x41,0,0x0b]));
   addedGlobals.push(Buffer.from([0x7d,1,0x43,0,0,0,0,0x0b]));return site.helperIndex;
  });bodies.push(join(leb(body.length),body));
 }c.done();assert.ok(sites.length,'No target call instructions');
 functions.payload=join(leb(functionCount+sites.length),entries,sites.map(s=>leb(s.type)));
 code.payload=join(leb(functionCount+sites.length),bodies,sites.map(s=>{const b=helper(s);return join(leb(b.length),b);}));
 const globalPayload=join(leb(globalCount+addedGlobals.length),globalEntries,addedGlobals);
 if(globals)globals.payload=globalPayload;
 else{const at=sections.findIndex(s=>s.id>6);assert.ok(at>=0,'Global insertion point unavailable');sections.splice(at,0,{id:6,payload:globalPayload});}
 const result=join(bytes.subarray(0,8),sections.map(s=>join(s.id,leb(s.payload.length),s.payload)));
 assert.ok(WebAssembly.validate(result),'Transformed module invalid');
 const a=new WebAssembly.Module(bytes),b=new WebAssembly.Module(result);
 assert.deepEqual(WebAssembly.Module.imports(b),WebAssembly.Module.imports(a),'Import ABI changed');
 assert.deepEqual(WebAssembly.Module.exports(b),WebAssembly.Module.exports(a),'Export ABI changed');
 return {bytes:result,originalFunctionCount:functionCount,originalGlobalCount:globalCount,addedGlobalCount:addedGlobals.length,
  sites,skippedSites,siteCounts:Object.fromEntries([...names].sort().map(name=>[name,sites.filter(s=>s.name===name).length]))};
}
