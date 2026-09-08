#!/usr/bin/env node
// Exercise the built browser-worker artifact, without importing the shell into
// the harness. No Node globals are supplied to the isolated worker context.
import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../../../', import.meta.url);
const assets = new URL('dist/client/assets/', root);
const name = (await readdir(assets)).find(name => /^guitarProImporter\.worker-.*\.js$/.test(name));
assert(name, 'run npm run build first');
const sourceMap = JSON.parse(await readFile(new URL(`${name}.map`, assets), 'utf8'));
assert(!sourceMap.sources.some(source => /alphatab|node:zlib/i.test(source)), 'worker still includes AlphaTab or zlib');
let reply;
const context = { TextEncoder, TextDecoder, ArrayBuffer, Uint8Array, console,
  postMessage: message => { reply = message; } };
runInNewContext(await readFile(new URL(name, assets), 'utf8'), context, { timeout: 10000 });
const files = [];
for (const directory of ['converters/guitarpro-mnx/tests/fixtures/gp5/', 'converters/fixtures/']) {
  for (const file of await readdir(new URL(directory, root))) {
    if (/\.(gp[345]?|gpx)$/.test(file)) files.push(new URL(directory + file, root));
  }
}
for (const file of files) {
  reply = undefined;
  const bytes = Uint8Array.from(await readFile(file));
  context.onmessage({ data: { cmd: 'mnxLab.importGuitarPro', buffer: bytes.buffer } });
  assert(reply?.ok, `${file.pathname}: ${reply?.error}`);
  assert(reply.document.parts.length > 0);
  if (file.pathname.endsWith('basic-5.10.gp5')) {
    assert.equal(reply.title, 'Legacy café');
    assert.equal(reply.artist, 'MNX Lab');
  }
}
console.log(`Built browser worker imports ${files.length} fixtures without Node globals or AlphaTab.`);
