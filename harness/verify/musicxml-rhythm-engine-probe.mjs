// Isolate layout capability from 03a/03f's original-file importer losses.
// Run after `npm run build:lib`; this is headless evidence, never an editor task.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ensureSmufl, layoutNotation } from '../../dist/lib/engine.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative)));
const copy = value => structuredClone(value);
ensureSmufl(read('public/smufl/glyphnames.json'), read('public/smufl/bravura_metadata.json'));

const base = read('harness/fixtures/musicxml-rhythm-evidence/workbench/03e-Rhythm-No-Divisions/document.mnx.json');
const noteValues = [];
for (const value of ['maxima', 'longa', 'breve', 'whole', '256th', '512th', '1024th']) {
  const document = copy(base);
  document.parts[0].measures[0].sequences[0].content[0].duration = { base: value };
  const layout = layoutNotation({ mnx: document, widthSp: 80 });
  noteValues.push({ value,
    noteheadGlyphs: layout.primitives.filter(p => p.className?.includes('notehead')).map(p => p.glyph),
    flagGlyphs: layout.primitives.filter(p => p.className?.includes('flag')).map(p => p.glyph) });
}
for (const row of noteValues.filter(row => ['maxima', 'longa', 'breve'].includes(row.value)))
  if (row.noteheadGlyphs.join() !== 'noteheadBlack') throw new Error('Long-value layout changed; re-review verdict');
for (const row of noteValues.filter(row => row.value.endsWith('th')))
  if (row.flagGlyphs.join() !== `flag${row.value}Up`) throw new Error('Short flag layout changed; re-review verdict');

const original = read('harness/fixtures/musicxml-rhythm-evidence/workbench/03f-Rhythm-Forward/document.mnx.json');
const spaced = copy(original);
const content = spaced.parts[0].measures[0].sequences[0].content;
for (const item of content) if (item.rest) {
  delete item.rest;
  item.type = 'space';
  item.duration = [1, 4]; // one quarter, expressed as a fraction of a whole
}
content.push({ type: 'space', duration: [3, 16] }); // final MusicXML forward
const originalLayout = layoutNotation({ mnx: original, widthSp: 80 });
const spacedLayout = layoutNotation({ mnx: spaced, widthSp: 80 });
const restGlyphs = layout => layout.primitives.filter(p => p.className?.includes('rest')).map(p => p.glyph);
const notes = layout => layout.primitives.filter(p => p.className?.includes('notehead')).length;
if (restGlyphs(originalLayout).length !== 2 || restGlyphs(spacedLayout).length !== 0
    || notes(originalLayout) !== notes(spacedLayout)
    || spacedLayout.diagnostics.some(d => d.measureIndex === 0))
  throw new Error('Space layout changed; re-review verdict');

const report = { kind: 'headless MNX layout isolation, separate from original-file browser verdicts',
  applicationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  noteValues,
  forwardSpaceProbe: {
    importedFirstBarRestGlyphs: restGlyphs(originalLayout),
    spacedFirstBarRestGlyphs: restGlyphs(spacedLayout),
    importedNoteheadCount: notes(originalLayout), spacedNoteheadCount: notes(spacedLayout),
    spacedDiagnostics: spacedLayout.diagnostics.map(d => d.message)
  } };
const output = path.join(root, 'harness/reports/musicxml-rhythm-engine-probe.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log('Engine isolation → ' + output);
