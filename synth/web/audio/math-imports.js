// Fixed-arity float wrappers avoid rest/spread arrays at the WASM boundary.
// Keep exactly the same Math functions and float32 rounding as the old host.
import {mathKernel} from './math-kernel.js';
const f32=Math.fround;
export const JS_MATH_IMPORTS={
 _atanf:x=>f32(Math.atan(x)),_cosf:x=>f32(Math.cos(x)),
 _expf:x=>f32(Math.exp(x)),_powf:(x,y)=>f32(Math.pow(x,y)),
 _sinf:x=>f32(Math.sin(x)),_sqrtf:x=>f32(Math.sqrt(x)),
 _logf:x=>f32(Math.log(x)),_log10f:x=>f32(Math.log10(x)),
 _tanf:x=>f32(Math.tan(x)),_tanhf:x=>f32(Math.tanh(x)),
 _floorf:x=>f32(Math.floor(x)),_ceilf:x=>f32(Math.ceil(x)),
 _fmodf:(x,y)=>f32(x%y),
};
// Served from WASM (web/audio/math-kernel.js): tanh as an exact port of V8's
// Math.tanh (checked on all 2^32 inputs) and an exact argument-keyed memo in front of
// the others, so repeated coefficient calls no longer cross into JS.
export const FAUST_MATH_IMPORTS={env:{...JS_MATH_IMPORTS,...mathKernel(JS_MATH_IMPORTS)}};
