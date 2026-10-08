// No accidental sound change (chain campaign C3): every reference case renders to its
// captured hash. A deliberate change re-captures (scripts/capture_references.mjs
// --update) with before/after audio and the lead's sign-off in the plan's evidence log.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {referenceCases} from './references/cases.mjs';
import {inWorkers} from './support/workers.mjs';
const captured=JSON.parse(fs.readFileSync('tests/references/references.json')).cases;
test('every reference case is captured, and nothing else',()=>assert.deepEqual(referenceCases().map(c=>c.id).sort(),Object.keys(captured).sort()));
test('every reference case renders to its captured hash',async()=>{
 const cases=referenceCases(),results=await inWorkers(new URL('./references/jobs.mjs',import.meta.url),'renderCase',cases);
 cases.forEach((c,i)=>assert.deepEqual(results[i],captured[c.id],`${c.id}: sound changed; re-capture only if deliberate and signed off`));
});
