// Reference renders (chain campaign C3): SHA-256 of the Float32 output of every contract
// fixture, the listening set and the multi-part reference session. tests/references.test.mjs
// fails on any difference, so sound never changes by accident. A deliberate sound change
// re-captures with --update and records before/after audio and the lead's sign-off.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {referenceCases,renderCase} from '../tests/references/cases.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const file='tests/references/references.json',update=process.argv.includes('--update');
if(fs.existsSync(file)&&!update)throw Error(`${file} exists; pass --update to re-capture after a deliberate, signed-off sound change`);
const cases={};for(const c of referenceCases()){cases[c.id]=renderCase(c);process.stdout.write('.');}
fs.writeFileSync(file,JSON.stringify({schema:'synth-references/1',version:JSON.parse(fs.readFileSync('package.json')).version,captured:new Date().toISOString().slice(0,10),
 note:'Float32 interleaved output hashes at 48 kHz. Re-capture only for a deliberate sound change (chain campaign C3).',cases},null,1)+'\n');
console.log(`\n${Object.keys(cases).length} references → ${file}`);
