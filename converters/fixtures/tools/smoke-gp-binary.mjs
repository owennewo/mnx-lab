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
// Ecosystem-authored feature files and demos, not our fixture writer's output.
// Only binary data is downloaded; no third-party reader implementation is read.
const ecosystemRepo = 'Perlence/PyGuitarPro';
const ecosystemRevision = 'b0a74102cf25a316f2c4ae3d03ffec3c03521358';
const ecosystemFiles = [
  '001_Funky_Guy.gp5', 'Accent-force.gp3', 'Accent-force.gp4',
  'Chord Old Format.gp3', 'Chords.gp3', 'Chords.gp4', 'Chords.gp5',
  'Clef.gp5', 'Demo v5.gp5', 'Directions.gp5', 'Duration.gp3',
  'Effects.gp3', 'Effects.gp4', 'Effects.gp5',
  'Harmonics.gp3', 'Harmonics.gp4', 'Harmonics.gp5', 'Key.gp4', 'Key.gp5',
  'Measure Header.gp3', 'Measure Header.gp4', 'Measure Header.gp5',
  'No Wah.gp5', 'RSE.gp5', 'Repeat.gp4', 'Repeat.gp5', 'Slides.gp4', 'Slides.gp5',
  'Strokes.gp4', 'Strokes.gp5', 'Tie.gp5', 'Unknown Chord Extension.gp5',
  'Unknown-m.gp5', 'Unknown.gp5', 'Vibrato.gp4', 'Voices.gp5',
  'Wah-m.gp5', 'Wah.gp5', 'chord_without_notes.gp5'
];
const samples = [
  ...paths.map(path => ({ repo, revision, path, cacheName: path.split('/').at(-1) })),
  ...ecosystemFiles.map(name => ({ repo: ecosystemRepo, revision: ecosystemRevision,
    path: `tests/${name}`, cacheName: `ecosystem-${name}` }))
];
await mkdir(cache, { recursive: true });
let failed = 0;
for (const { repo, revision, path, cacheName } of samples) {
  const file = new URL(encodeURIComponent(cacheName), cache);
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
    console.log(`PASS ${path} parts=${doc.parts.length} notes=${ids.size} warnings=${warnings.length} sha256=${hash}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${path}: ${error.message} sha256=${hash}`);
  }
}
console.log(`${samples.length - failed}/${samples.length} passed; cache ${fileURLToPath(cache)}`);
process.exitCode = failed ? 1 : 0;
