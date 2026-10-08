// Node-only: load the host's compiled WASM assets from web/generated. Browser code
// receives the same {module, meta} pairs from the page instead.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const load=path=>({module:new WebAssembly.Module(fs.readFileSync(ROOT+path+'.wasm')),meta:JSON.parse(fs.readFileSync(ROOT+path+'.json'))});
export const BLOCKS=Object.freeze(['drive','vibrato','tremolo','echo','room','master']);
let cached;
export function hostAssets(){
 cached??={blocks:Object.fromEntries(BLOCKS.map(b=>[b,load('generated/blocks/'+b)])),
  instruments:{plucked:{guitar:load('generated/instrument-v2/guitar'),factory:JSON.parse(fs.readFileSync(ROOT+'data/instrument-v2/presets.json')),loudness:JSON.parse(fs.readFileSync(ROOT+'data/instrument-v2/loudness.json'))},
   keys:{keys:load('generated/basic/keys')},kit:{kit:load('generated/basic/kit')}}};
 return cached;
}
