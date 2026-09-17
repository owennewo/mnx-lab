// Implementation loop: the save check — export, read straight back, compare
// (roadmap/inprogress/studio-save-pipeline.md). The browser runs this in a
// worker; the work itself is pure, so it is proved and timed here.
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { applyOp } from '../../src/edit/ops.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../converters/fixtures', name), 'utf8')) as MnxStructure;

it('a blank piece saves with nothing lost: gains only, from Guitar Pro having no "unstated"', () => {
  const result = checkStorage(buildNewDocument({ title: 'Anji', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 8 }));
  expect(result.check.verdict).toBe('gains');
  expect(result.losses).toEqual([]);
  expect(result.options).toEqual({ collapseTabUnisons: false, compress: true });
  expect(importGuitarProCleanRoom(result.bytes).parts).toHaveLength(1);
});

it('names what will not persist, and the summary the service keeps stays small', () => {
  // Every header field Guitar Pro has, plus two it has not: `source`, and a role with no field.
  const document = applyOp(fixture('Triplets-and-graces.mnx.json'), { type: 'setWork', work: { title: 'T', subtitle: 'S', artist: 'A', album: 'Al', copyright: '© 2026', notes: 'N', source: 'a bootleg',
    creators: [{ role: 'composer', name: 'C' }, { role: 'lyricist', name: 'L' }, { role: 'transcriber', name: 'Tr' }, { role: 'arranger', name: 'Arr' }] } });
  const { check, losses } = checkStorage(document);
  expect(check.verdict).toBe('differs');
  const lost = losses.filter(l => l.path.startsWith('_x/mnxLab/work')).map(l => `${l.kind} ${l.path}`).sort();
  expect(lost).toEqual(['lost _x/mnxLab/work/creators/-1', 'lost _x/mnxLab/work/source']);
  expect(losses.find(l => l.path.endsWith('creators/-1'))?.was).toContain('arranger');
  expect(JSON.stringify(check).length).toBeLessThan(20_000);
});

it('is fast enough to run on every checkpoint: the largest committed score', () => {
  const document = fixture('Vestapol.mnx.json');
  checkStorage(document); // warm
  const started = performance.now();
  const result = checkStorage(document);
  const ms = performance.now() - started;
  if (process.env.STORAGE_CHECK_TIMING) fs.writeFileSync(process.env.STORAGE_CHECK_TIMING, `Vestapol: ${document.global.measures.length} bars, ${result.bytes.length} B .gp, ${ms.toFixed(0)} ms, verdict ${result.check.verdict}\n`);
  expect(ms).toBeLessThan(5_000);
  // Deflated: a twentieth of the stored container, and far under the route's 1 MiB.
  expect(result.bytes.length).toBeLessThan(100 * 1024);
});
