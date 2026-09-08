#!/usr/bin/env node
// Build the converter first. Install its packed public API with production
// dependencies only, outside the workspace's dependency-resolution tree.
import { mkdtemp, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = new URL('../../../', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'mnx-gp-package-'));
const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
  cwd: fileURLToPath(new URL('converters/guitarpro-mnx/', root)), encoding: 'utf8'
}));
execFileSync('npm', ['install', '--prefix', temporary, '--omit=dev', '--ignore-scripts',
  '--no-audit', '--no-fund', join(temporary, packed[0].filename)], { stdio: 'inherit' });
await assert.rejects(access(join(temporary, 'node_modules/@coderline/alphatab')), { code: 'ENOENT' });
const { importGuitarPro, exportGuitarPro } = await import(pathToFileURL(
  join(temporary, 'node_modules/@mnx-editor/guitarpro-mnx/dist/index.js')).href);
const fixtures = [
  ...['3.00.gp3', '4.00.gp4', '4.06.gp4', '5.00.gp5', '5.10.gp5']
    .map(revision => `converters/guitarpro-mnx/tests/fixtures/gp5/basic-${revision}`),
  'converters/fixtures/House-of-the-Rising-Sun.gpx',
  'converters/fixtures/Triplets-and-graces.gp'
];
for (const fixture of fixtures) {
  const document = importGuitarPro(new Uint8Array(await readFile(new URL(fixture, root))));
  assert(document.parts.length > 0, fixture);
  const roundtrip = importGuitarPro(exportGuitarPro(document));
  assert.equal(roundtrip.parts.length, document.parts.length, fixture);
  assert.equal(roundtrip.global.measures.length, document.global.measures.length, fixture);
}
console.log(`Production-only package imports and exports ${fixtures.length} fixtures without AlphaTab.`);
console.log(`Isolated install retained for inspection: ${temporary}`);
