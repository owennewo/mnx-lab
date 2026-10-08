// Build the headless synth library (D17) into dist/lib: the import closure of the
// library entry points, copied with web/'s relative layout (so worklet and asset
// URLs resolve unchanged), the compiled assets, type declarations and a manifest.
// No app code, no DOM code. Deterministic: same sources → same bytes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {beginBuild} from './build_output.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const destination=process.argv[2]||'dist/lib',web='web/',hash=b=>createHash('sha256').update(b).digest('hex');
const ENTRIES=['host/index.js','host/node.js','host/host-processor.js','contract/conformance/index.js'];
const EXTRA=['host/index.d.ts','host/node.d.ts','contract/index.d.ts','contract/mnx-sound-2.schema.json',
 ...fs.readdirSync(web+'contract/fixtures').filter(f=>f.endsWith('.json')).sort().map(f=>'contract/fixtures/'+f),
 ...['blocks/drive','blocks/vibrato','blocks/tremolo','blocks/echo','blocks/room','blocks/master','instrument-v2/guitar','basic/keys','basic/kit'].flatMap(a=>[`generated/${a}.wasm`,`generated/${a}.json`]),
 'data/instrument-v2/presets.json','data/instrument-v2/loudness.json'];
const NOTICES=['RELEASE-NOTES.md','THIRD_PARTY_NOTICES.md'];
// Static import/export specifiers and new URL('./x.js', import.meta.url) references.
const SPEC=/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]|new URL\(\s*['"](\.[^'"]+\.js)['"]\s*,\s*import\.meta\.url\)/g;
const closure=new Set(),queue=[...ENTRIES];
while(queue.length){
 const file=path.posix.normalize(queue.shift());if(closure.has(file))continue;closure.add(file);
 const src=fs.readFileSync(web+file,'utf8');
 for(const m of src.matchAll(SPEC)){const dep=path.posix.join(path.posix.dirname(file),m[1]??m[2]??m[3]);if(!dep.startsWith('..'))queue.push(dep);else throw Error(`${file} imports outside web/: ${dep}`);}
}
const forbidden=[...closure].filter(f=>f.startsWith('studio/')||f.startsWith('app/')||/document\.|window\./.test(fs.readFileSync(web+f,'utf8')));
if(forbidden.length)throw Error('Library closure includes UI code: '+forbidden.join(', '));
const transaction=beginBuild(destination,'lib-manifest.json'),out=transaction.out;
const files=[...closure,...EXTRA].sort(),manifest={};
for(const f of files){const bytes=fs.readFileSync(web+f);fs.mkdirSync(path.dirname(`${out}/${f}`),{recursive:true});fs.writeFileSync(`${out}/${f}`,bytes);manifest[f]=hash(bytes);}
for(const f of NOTICES){const bytes=fs.readFileSync(f);fs.writeFileSync(`${out}/${f}`,bytes);manifest[f]=hash(bytes);}
const root=JSON.parse(fs.readFileSync('package.json'));
const pkg={name:'@mnx-lab/synth',version:root.version,description:'Headless synth library: mnx-sound/2 contract, instrument host, plucked/keys/kit instruments, AudioWorklet processor and compiled DSP assets.',
 type:'module',sideEffects:false,private:true,license:root.license??'UNLICENSED',engines:{node:'>=22'},
 exports:{'.':{types:'./host/index.d.ts',default:'./host/index.js'},'./node':{types:'./host/node.d.ts',default:'./host/node.js'},
  './contract':{types:'./contract/index.d.ts',default:'./contract/index.js'},'./conformance':'./contract/conformance/index.js',
  './processor':'./host/host-processor.js','./schema':'./contract/mnx-sound-2.schema.json','./fixtures/*':'./contract/fixtures/*','./package.json':'./package.json'}};
fs.writeFileSync(`${out}/package.json`,JSON.stringify(pkg,null,2)+'\n');
manifest['package.json']=hash(fs.readFileSync(`${out}/package.json`));
const lib={name:pkg.name,version:pkg.version,contract:'mnx-sound/2',files:manifest};
fs.writeFileSync(`${out}/lib-manifest.json`,JSON.stringify(lib,null,2)+'\n');
const committed=transaction.commit();
console.log(`${pkg.name}@${pkg.version}: ${Object.keys(manifest).length} files (${closure.size} modules) → ${destination}; manifest ${hash(JSON.stringify(lib)).slice(0,12)}`);
if(committed.previous)console.log('Previous generated bundle retained:',committed.previous);
