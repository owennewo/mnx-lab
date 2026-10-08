// FAUST's float math imports served from WASM, so the DSPs' calls stay inside WASM
// instead of crossing into JS (~50 ns each, ~500k calls per audio second in the
// reference session). Every function returns exactly what the JS import returned:
// - _tanhf is V8's Math.tanh (fdlibm tanh + expm1, src/base/ieee754.cc) ported
//   operation for operation in f64; scripts/verify_math_kernel.mjs checks all 2^32
//   float32 inputs against Math.fround(Math.tanh(x)).
// - the others keep calling the JS import and memoize it per function in a
//   direct-mapped table keyed on the exact argument bits (exact by construction).
// The module is assembled here from WAT-like text: no build step, no binary asset.
const OPS={unreachable:0,nop:1,block:2,loop:3,if:4,else:5,end:0x0b,br:0x0c,br_if:0x0d,return:0x0f,call:0x10,drop:0x1a,select:0x1b,
 'local.get':0x20,'local.set':0x21,'local.tee':0x22,'i32.load':0x28,'f32.load':0x2a,'i32.store':0x36,'f32.store':0x38,
 'i32.const':0x41,'i64.const':0x42,'f64.bits':0x44,'i32.eqz':0x45,'i32.eq':0x46,'i32.ne':0x47,'i32.lt_s':0x48,'i32.lt_u':0x49,'i32.gt_s':0x4a,
 'i32.gt_u':0x4b,'i32.le_s':0x4c,'i32.ge_s':0x4e,'i32.ge_u':0x4f,'f64.eq':0x61,'f64.ne':0x62,'f64.lt':0x63,'f64.gt':0x64,'f64.le':0x65,'f64.ge':0x66,
 'i32.add':0x6a,'i32.sub':0x6b,'i32.mul':0x6c,'i32.and':0x71,'i32.or':0x72,'i32.xor':0x73,'i32.shl':0x74,'i32.shr_s':0x75,'i32.shr_u':0x76,'i32.rotl':0x77,
 'i64.or':0x84,'i64.shl':0x86,'i64.shr_u':0x88,'f64.abs':0x99,'f64.neg':0x9a,'f64.add':0xa0,'f64.sub':0xa1,'f64.mul':0xa2,'f64.div':0xa3,
 'i32.wrap_i64':0xa7,'i32.trunc_f64_s':0xaa,'i64.extend_i32_u':0xad,'f32.demote_f64':0xb6,'f64.convert_i32_s':0xb7,'f64.promote_f32':0xbb,
 'i32.reinterpret_f32':0xbc,'i64.reinterpret_f64':0xbd,'f64.reinterpret_i64':0xbf};
const TYPES={i32:0x7f,i64:0x7e,f32:0x7d,f64:0x7c};
const uleb=x=>{const b=[];do{let v=x&127;x>>>=7;if(x)v|=128;b.push(v);}while(x);return b;};
const sleb=x=>{x=BigInt(x);const b=[];for(;;){const v=Number(x&127n);x>>=7n;if((x===0n&&!(v&64))||(x===-1n&&v&64)){b.push(v);return b;}b.push(v|128);}};
const vec=items=>[...uleb(items.length),...items.flat()];
const text=s=>[...uleb(s.length),...[...s].map(c=>c.charCodeAt(0))];
// One instruction per token run: `op [immediate...]`; ';' starts a comment to end of line.
function assemble(source,names){
 const t=source.replace(/;[^\n]*/g,'').trim().split(/\s+/),out=[];
 for(let i=0;i<t.length;){
  const op=t[i++];if(!(op in OPS))throw Error(`math kernel: unknown op ${op}`);out.push(OPS[op]);
  if(['block','loop','if'].includes(op))out.push(t[i] in TYPES?TYPES[t[i++]]:0x40);
  else if(/^local\.|^br/.test(op))out.push(...uleb(Number(t[i++])));
  else if(op==='call')out.push(...uleb(names[t[i++]]));
  else if(/load|store/.test(op))out.push(2,...uleb(Number(t[i++])));
  else if(op==='i32.const')out.push(...sleb(BigInt.asIntN(32,BigInt(t[i++]))));
  else if(op==='i64.const')out.push(...sleb(BigInt.asIntN(64,BigInt(t[i++]))));
  else if(op==='f64.bits'){let v=BigInt(t[i++]);for(let k=0;k<8;k++,v>>=8n)out.push(Number(v&255n));}
 }
 return [...out,0x0b];
}
// fdlibm expm1(x: f64) → f64. Locals: 0 x, 1 hx, 2 xsb, 3 k, 4 hi, 5 lo, 6 c, 7 t, 8 e, 9 hxs, 10 hfx, 11 r1, 12 y, 13 twopk.
const EXPM1=`
 local.get 0 i64.reinterpret_f64 i64.const 32 i64.shr_u i32.wrap_i64 local.tee 1
 i32.const 0x80000000 i32.and local.set 2
 local.get 1 i32.const 0x7fffffff i32.and local.set 1
 local.get 1 i32.const 0x4043687a i32.ge_u if                  ; |x| >= 56 ln2
  local.get 1 i32.const 0x40862e42 i32.ge_u if                 ; |x| >= 709.78
   local.get 1 i32.const 0x7ff00000 i32.ge_u if                ; inf or NaN
    local.get 1 i32.const 0xfffff i32.and local.get 0 i64.reinterpret_f64 i32.wrap_i64 i32.or if
     local.get 0 local.get 0 f64.add return end
    local.get 2 if f64.bits 0xbff0000000000000 return end local.get 0 return
   end
   local.get 0 f64.bits 0x40862e42fefa39ef f64.gt if            ; overflow: huge*huge
    f64.bits 0x7e37e43c8800759c f64.bits 0x7e37e43c8800759c f64.mul return end
  end
  local.get 2 if                                                ; x < -56 ln2: -1
   local.get 0 f64.bits 0x01a56e1fc2f8f359 f64.add f64.bits 0 f64.lt if
    f64.bits 0x01a56e1fc2f8f359 f64.bits 0x3ff0000000000000 f64.sub return end
  end
 end
 local.get 1 i32.const 0x3fd62e42 i32.gt_u if                   ; |x| > 0.5 ln2: reduce
  local.get 1 i32.const 0x3ff0a2b2 i32.lt_u if                  ; and |x| < 1.5 ln2
   local.get 2 i32.eqz if
    local.get 0 f64.bits 0x3fe62e42fee00000 f64.sub local.set 4 f64.bits 0x3dea39ef35793c76 local.set 5 i32.const 1 local.set 3
   else
    local.get 0 f64.bits 0x3fe62e42fee00000 f64.add local.set 4 f64.bits 0xbdea39ef35793c76 local.set 5 i32.const -1 local.set 3
   end
  else
   f64.bits 0x3ff71547652b82fe local.get 0 f64.mul f64.bits 0x3fe0000000000000 f64.bits 0xbfe0000000000000 local.get 2 i32.eqz select
   f64.add i32.trunc_f64_s local.tee 3 f64.convert_i32_s local.set 7
   local.get 0 local.get 7 f64.bits 0x3fe62e42fee00000 f64.mul f64.sub local.set 4
   local.get 7 f64.bits 0x3dea39ef35793c76 f64.mul local.set 5
  end
  local.get 4 local.get 5 f64.sub local.set 0
  local.get 4 local.get 0 f64.sub local.get 5 f64.sub local.set 6
 else
  local.get 1 i32.const 0x3c900000 i32.lt_u if                  ; |x| < 2^-54: x
   f64.bits 0x7e37e43c8800759c local.get 0 f64.add local.set 7
   local.get 0 local.get 7 f64.bits 0x7e37e43c8800759c local.get 0 f64.add f64.sub f64.sub return
  end
  i32.const 0 local.set 3
 end
 f64.bits 0x3fe0000000000000 local.get 0 f64.mul local.set 10
 local.get 0 local.get 10 f64.mul local.set 9
 f64.bits 0x3ff0000000000000
 local.get 9 f64.bits 0xbfa11111111110f4 local.get 9 f64.bits 0x3f5a01a019fe5585 local.get 9 f64.bits 0xbf14ce199eaadbb7
 local.get 9 f64.bits 0x3ed0cfca86e65239 local.get 9 f64.bits 0xbe8afdb76e09c32d
 f64.mul f64.add f64.mul f64.add f64.mul f64.add f64.mul f64.add f64.mul f64.add local.set 11
 f64.bits 0x4008000000000000 local.get 11 local.get 10 f64.mul f64.sub local.set 7
 local.get 9 local.get 11 local.get 7 f64.sub f64.bits 0x4018000000000000 local.get 0 local.get 7 f64.mul f64.sub f64.div f64.mul local.set 8
 local.get 3 i32.eqz if
  local.get 0 local.get 0 local.get 8 f64.mul local.get 9 f64.sub f64.sub return
 end
 local.get 3 i32.const 20 i32.shl i32.const 0x3ff00000 i32.add i64.extend_i32_u i64.const 32 i64.shl f64.reinterpret_i64 local.set 13
 local.get 0 local.get 8 local.get 6 f64.sub f64.mul local.get 6 f64.sub local.get 9 f64.sub local.set 8
 local.get 3 i32.const -1 i32.eq if
  f64.bits 0x3fe0000000000000 local.get 0 local.get 8 f64.sub f64.mul f64.bits 0x3fe0000000000000 f64.sub return
 end
 local.get 3 i32.const 1 i32.eq if
  local.get 0 f64.bits 0xbfd0000000000000 f64.lt if
   f64.bits 0xc000000000000000 local.get 8 local.get 0 f64.bits 0x3fe0000000000000 f64.add f64.sub f64.mul return
  end
  f64.bits 0x3ff0000000000000 f64.bits 0x4000000000000000 local.get 0 local.get 8 f64.sub f64.mul f64.add return
 end
 local.get 3 i32.const -2 i32.le_s local.get 3 i32.const 56 i32.gt_s i32.or if  ; exp(x)-1 suffices
  f64.bits 0x3ff0000000000000 local.get 8 local.get 0 f64.sub f64.sub local.set 12
  local.get 3 i32.const 1024 i32.eq if
   local.get 12 f64.bits 0x4000000000000000 f64.mul f64.bits 0x7fe0000000000000 f64.mul local.set 12
  else local.get 12 local.get 13 f64.mul local.set 12 end
  local.get 12 f64.bits 0x3ff0000000000000 f64.sub return
 end
 local.get 3 i32.const 20 i32.lt_s if
  i32.const 0x3ff00000 i32.const 0x200000 local.get 3 i32.shr_s i32.sub i64.extend_i32_u i64.const 32 i64.shl f64.reinterpret_i64 local.set 7
  local.get 7 local.get 8 local.get 0 f64.sub f64.sub local.get 13 f64.mul return
 end
 i32.const 0x3ff local.get 3 i32.sub i32.const 20 i32.shl i64.extend_i32_u i64.const 32 i64.shl f64.reinterpret_i64 local.set 7
 local.get 0 local.get 8 local.get 7 f64.add f64.sub f64.bits 0x3ff0000000000000 f64.add local.get 13 f64.mul`;
// fdlibm tanh on the promoted argument, rounded to float32 as Math.fround does.
// Locals: 0 x (f32), 1 d, 2 jx, 3 ix, 4 t, 5 z.
const TANH=`
 local.get 0 f64.promote_f32 local.tee 1 i64.reinterpret_f64 i64.const 32 i64.shr_u i32.wrap_i64 local.tee 2
 i32.const 0x7fffffff i32.and local.tee 3 i32.const 0x7ff00000 i32.ge_u if      ; inf or NaN
  local.get 2 i32.const 0 i32.ge_s if f64
   f64.bits 0x3ff0000000000000 local.get 1 f64.div f64.bits 0x3ff0000000000000 f64.add
  else
   f64.bits 0x3ff0000000000000 local.get 1 f64.div f64.bits 0x3ff0000000000000 f64.sub
  end f32.demote_f64 return
 end
 local.get 3 i32.const 0x40360000 i32.lt_u if                                   ; |x| < 22
  local.get 3 i32.const 0x3e300000 i32.lt_u if                                  ; |x| < 2^-28: x
   f64.bits 0x7e37e43c8800759c local.get 1 f64.add f64.bits 0x3ff0000000000000 f64.gt if local.get 0 return end
  end
  local.get 3 i32.const 0x3ff00000 i32.ge_u if
   f64.bits 0x4000000000000000 local.get 1 f64.abs f64.mul call expm1 local.set 4
   f64.bits 0x3ff0000000000000 f64.bits 0x4000000000000000 local.get 4 f64.bits 0x4000000000000000 f64.add f64.div f64.sub local.set 5
  else
   f64.bits 0xc000000000000000 local.get 1 f64.abs f64.mul call expm1 local.tee 4 f64.neg
   local.get 4 f64.bits 0x4000000000000000 f64.add f64.div local.set 5
  end
 else
  f64.bits 0x3ff0000000000000 f64.bits 0x01a56e1fc2f8f359 f64.sub local.set 5
 end
 local.get 5 local.get 5 f64.neg local.get 2 i32.const 0 i32.ge_s select f32.demote_f64`;
// Direct-mapped exact memo: 2^SLOTS slots of {key, value, valid} (12 of 16 bytes used); key = argument bits.
const SLOTS=12,memo1=(base,js)=>`
 local.get 0 i32.reinterpret_f32 local.tee 1 i32.const 0x9e3779b1 i32.mul i32.const ${32-SLOTS} i32.shr_u i32.const 4 i32.shl i32.const ${base} i32.add local.tee 2
 i32.load 8 if local.get 2 i32.load 0 local.get 1 i32.eq if local.get 2 f32.load 4 return end end
 local.get 2 local.get 1 i32.store 0 local.get 2 i32.const 1 i32.store 8
 local.get 2 local.get 0 call ${js} local.tee 3 f32.store 4 local.get 3`;
// Binary: {x, y, value, valid}; locals 0 x, 1 y, 2 xb, 3 yb, 4 slot, 5 value.
const memo2=(base,js)=>`
 local.get 0 i32.reinterpret_f32 local.tee 2 local.get 1 i32.reinterpret_f32 local.tee 3 i32.const 16 i32.rotl i32.xor i32.const 0x9e3779b1 i32.mul
 i32.const ${32-SLOTS} i32.shr_u i32.const 4 i32.shl i32.const ${base} i32.add local.tee 4
 i32.load 12 if local.get 4 i32.load 0 local.get 2 i32.eq local.get 4 i32.load 4 local.get 3 i32.eq i32.and if local.get 4 f32.load 8 return end end
 local.get 4 local.get 2 i32.store 0 local.get 4 local.get 3 i32.store 4 local.get 4 i32.const 1 i32.store 12
 local.get 4 local.get 0 local.get 1 call ${js} local.tee 5 f32.store 8 local.get 5`;
export const MEMOIZED=Object.freeze(['_sinf','_cosf','_tanf','_atanf','_expf','_logf','_log10f','_powf']);
export function mathKernelBytes(){
 const f32_f32=[0x60,1,0x7d,1,0x7d],f32f32_f32=[0x60,2,0x7d,0x7d,1,0x7d],f64_f64=[0x60,1,0x7c,1,0x7c];
 const types=[f32_f32,f32f32_f32,f64_f64],imports=MEMOIZED.map(name=>({name,type:name==='_powf'?1:0}));
 const names=Object.fromEntries(imports.map((x,i)=>[`js${x.name}`,i])),n=imports.length;names.expm1=n;
 const locals=spec=>vec(spec.map(([count,type])=>[...uleb(count),TYPES[type]]));
 const fns=[{type:2,locals:[[1,'i32'],[1,'i32'],[1,'i32'],[10,'f64']],body:EXPM1},{type:0,export:'_tanhf',locals:[[1,'f64'],[2,'i32'],[2,'f64']],body:TANH},
  ...imports.map((x,i)=>x.type?{type:1,export:x.name,locals:[[3,'i32'],[1,'f32']],body:memo2(i<<SLOTS+4,`js${x.name}`)}:{type:0,export:x.name,locals:[[2,'i32'],[1,'f32']],body:memo1(i<<SLOTS+4,`js${x.name}`)})];
 const section=(id,payload)=>[id,...uleb(payload.length),...payload];
 const bytes=[0,0x61,0x73,0x6d,1,0,0,0,
  ...section(1,vec(types)),
  ...section(2,vec(imports.map(x=>[...text('js'),...text(x.name),0,x.type]))),
  ...section(3,vec(fns.map(f=>[f.type]))),
  ...section(5,vec([[0,...uleb(n<<SLOTS+4>>16)]])),                // 16 bytes per slot, one table per function
  ...section(7,vec(fns.flatMap((f,i)=>f.export?[[...text(f.export),0,...uleb(n+i)]]:[]))),
  ...section(10,vec(fns.map(f=>{const body=[...locals(f.locals),...assemble(f.body,names)];return [...uleb(body.length),...body];})))];
 return new Uint8Array(bytes);
}
let module;
// → FAUST import functions backed by a fresh kernel instance around the given JS imports.
export function mathKernel(js){
 module??=new WebAssembly.Module(mathKernelBytes());
 const k=new WebAssembly.Instance(module,{js:Object.fromEntries(MEMOIZED.map(name=>[name,js[name]]))}).exports;
 return Object.fromEntries(['_tanhf',...MEMOIZED].map(name=>[name,k[name]]));
}
