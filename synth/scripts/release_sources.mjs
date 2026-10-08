import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hash} from './build_output.mjs';
const sourcePaths=['web','dsp','scripts','tests','package.json','README.md','RELEASE.md','RELEASE-NOTES.md','THIRD_PARTY_NOTICES.md','LISTENING.md'];
export function sourceSnapshot(){
 for(const p of sourcePaths)assert.ok(fs.existsSync(p),`Missing release source: ${p}`);
 // Include reviewed tracked files and new, nonignored sources. Machine-local
 // caches and archived research audio must not change release identity.
 const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--',...sourcePaths],{encoding:'utf8'}).split('\0').filter(Boolean))].sort();
 return Object.fromEntries(files.map(p=>{assert.ok(fs.lstatSync(p).isFile(),`Source is not a regular file: ${p}`);return [p,hash(fs.readFileSync(p))];}));
}
