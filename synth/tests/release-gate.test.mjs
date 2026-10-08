import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {sourceSnapshot} from '../scripts/release_sources.mjs';
test('full release gate fails closed before any test/build when browser setup is missing',()=>{
 const env={...process.env};delete env.PLAYWRIGHT_MODULE;delete env.GOLDEN_SUBSET;
 const result=spawnSync(process.execPath,['scripts/release_check.mjs','does-not-exist'],{env,encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Release blocked: set PLAYWRIGHT_MODULE/);
 assert.ok(!result.stdout.includes('Automated gate passed'));
});
test('release provenance includes new source work but excludes ignored research audio and machine caches',()=>{
 const sources=sourceSnapshot();assert.ok(sources['scripts/release_prepare.mjs']);assert.ok(sources['web/generated/instrument-v2/guitar.wasm']);
 assert.ok(!Object.keys(sources).some(p=>/instrument-model\/|dry-comparison\/|__pycache__|\.pyc$/.test(p)));
});
