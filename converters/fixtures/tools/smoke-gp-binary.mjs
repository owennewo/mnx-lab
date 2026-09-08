#!/usr/bin/env node
// Dev-time robustness sample; downloaded transcriptions must stay uncommitted.
// Build the converter first. Run with --fetch once, then offline without it.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { importGuitarProCleanRoom } from '../../guitarpro-mnx/dist/index.js';

const cache = new URL('../../../.gp-corpus/', import.meta.url);
const repo = 'otnemrasordep/gp-classical-guitar';
const revision = '1a54990e905b68bdf0676bd75a1b7c013e3d5490';
const paths = [
  ...Array.from({ length: 20 }, (_, i) => `brouwer/gp5/brouwer_estudio${i + 1}.gp5`),
  ...Array.from({ length: 12 }, (_, i) => `villa-lobos/gp5/villa-lobos_etude${i + 1}.gp5`)
];
await mkdir(cache, { recursive: true });
let failed = 0;
for (const path of paths) {
  const file = new URL(path.split('/').at(-1), cache);
  if (process.argv.includes('--fetch')) {
    const response = await fetch(`https://raw.githubusercontent.com/${repo}/${revision}/${path}`);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = await readFile(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const warnings = [];
  try {
    const doc = importGuitarProCleanRoom(bytes, { onWarning: message => warnings.push(message) });
    assert(doc.parts.length > 0);
    const ids = new Set();
    const targets = [];
    const walk = items => {
      for (const item of items ?? []) {
        if (item.content) walk(item.content);
        for (const note of item.notes ?? []) {
          assert(note.id && !ids.has(note.id), 'missing or duplicate note ID');
          ids.add(note.id);
          assert(note.pitch && Number.isFinite(note.pitch.octave), 'invalid pitch');
          for (const tie of note.ties ?? []) if (tie.target) targets.push(tie.target);
          const technique = note._x?.mnxLab?.tab?.technique;
          for (const target of [technique?.hammerPull?.target, technique?.slide?.target]) {
            if (target) targets.push(target);
          }
        }
      }
    };
    for (const part of doc.parts) {
      assert.equal(part.measures.length, doc.global.measures.length, 'unaligned measures');
      for (const measure of part.measures) for (const sequence of measure.sequences ?? []) walk(sequence.content);
    }
    for (const target of targets) assert(ids.has(target), `dangling target ${target}`);
    console.log(`PASS ${path} notes=${ids.size} warnings=${warnings.length} sha256=${hash}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${path}: ${error.message} sha256=${hash}`);
  }
}
console.log(`${paths.length - failed}/${paths.length} passed; cache ${fileURLToPath(cache)}`);
process.exitCode = failed ? 1 : 0;
