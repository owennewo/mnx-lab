// Build the deployable synth app (D17) into dist/app: the HTML entry points, their
// script/style references, the JS import closure (including worklet and worker URLs)
// and the runtime data and assets the pages fetch. No research pages or data.
// Deterministic: same sources → same bytes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {beginBuild} from './build_output.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const destination=process.argv[2]||'dist/app',web='web/',hash=b=>createHash('sha256').update(b).digest('hex');
const PAGES=['index.html'];
const FETCHED=['data/instrument-v2/presets.json','data/instrument-v2/loudness.json',
 ...fs.readdirSync(web+'data/pieces').filter(f=>f.endsWith('.json')).sort().map(f=>'data/pieces/'+f),
 ...fs.readdirSync(web+'contract/fixtures').filter(f=>f.endsWith('.json')).sort().map(f=>'contract/fixtures/'+f),
 ...['blocks/drive','blocks/vibrato','blocks/tremolo','blocks/echo','blocks/room','blocks/master','instrument-v2/guitar','basic/keys','basic/kit'].flatMap(a=>[`generated/${a}.wasm`,`generated/${a}.json`])];
const SPEC=/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]|new URL\(\s*['"](\.[^'"]+\.js)['"]\s*,\s*import\.meta\.url\)/g;
const files=new Set(),visited=new Set(),queue=[];
for(const page of PAGES){files.add(page);const src=fs.readFileSync(web+page,'utf8');
 for(const m of src.matchAll(/(?:src|href)="\.\/([^"?#]+\.(?:js|css))"/g)){files.add(m[1]);if(m[1].endsWith('.js'))queue.push(m[1]);}}
while(queue.length){
 const file=path.posix.normalize(queue.shift());if(visited.has(file))continue;visited.add(file);files.add(file);
 for(const m of fs.readFileSync(web+file,'utf8').matchAll(SPEC)){const dep=path.posix.join(path.posix.dirname(file),m[1]??m[2]??m[3]);if(dep.startsWith('..'))throw Error(`${file} imports outside web/: ${dep}`);queue.push(dep);}
}
for(const f of FETCHED)files.add(f);
const list=[...files].sort();
const transaction=beginBuild(destination,'app-manifest.json'),out=transaction.out;
const manifest={};
for(const f of list){const bytes=fs.readFileSync(web+f);fs.mkdirSync(path.dirname(`${out}/${f}`),{recursive:true});fs.writeFileSync(`${out}/${f}`,bytes);manifest[f]=hash(bytes);}
for(const f of ['RELEASE-NOTES.md','THIRD_PARTY_NOTICES.md']){const bytes=fs.readFileSync(f);fs.writeFileSync(`${out}/${f}`,bytes);manifest[f]=hash(bytes);}
const root=JSON.parse(fs.readFileSync('package.json'));
fs.writeFileSync(`${out}/app-manifest.json`,JSON.stringify({name:'synth-app',version:root.version,files:manifest},null,2)+'\n');
const bytes=list.reduce((n,f)=>n+fs.statSync(`${out}/${f}`).size,0);
const committed=transaction.commit();console.log(`synth-app@${root.version}: ${Object.keys(manifest).length} files, ${(bytes/1024).toFixed(0)} KB runtime → ${destination}`);
if(committed.previous)console.log('Previous generated bundle retained:',committed.previous);
