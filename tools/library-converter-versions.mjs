// The read Worker must select the same converter revision as the Node ingest tool.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const versions = Object.fromEntries(['guitarpro-mnx','musicxml-mnx'].map(name => [name,
  JSON.parse(readFileSync(new URL(`../converters/${name}/package.json`, import.meta.url))).version + '+git.' +
  execFileSync('git', ['log', '-1', '--format=%H', '--', `converters/${name}`], { cwd: root, encoding: 'utf8' }).trim()
]));
const file = new URL('../worker/library/converter-versions.json', import.meta.url);
const expected = JSON.stringify(versions, null, 2) + '\n';
if (process.argv.includes('--write')) writeFileSync(file, expected);
else if (readFileSync(file, 'utf8') !== expected) throw new Error('Converter versions changed: run node tools/library-converter-versions.mjs --write, then re-derive library MNX before expecting canonical reads.');
