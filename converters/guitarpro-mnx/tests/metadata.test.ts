import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProWithMetadata, importGuitarProCleanRoom } from '../src/cleanRoom.js';
import { writeGpContainer } from '../src/gpif/container.js';

it('retains binary title and artist without changing the MNX document', () => {
  const bytes = readFileSync(resolve(__dirname, 'fixtures/gp5/basic-5.10.gp5'));
  const result = importGuitarProWithMetadata(bytes);
  expect(result.title).toBe('Legacy café');
  expect(result.artist).toBe('MNX Lab');
  expect(result.document).toEqual(importGuitarProCleanRoom(bytes));
});

it('decodes and trims GPIF metadata for document headings', () => {
  const bytes = writeGpContainer('<GPIF><Score><Title> Café &amp; song </Title><Artist><![CDATA[ Artist ]]></Artist></Score></GPIF>');
  expect(importGuitarProWithMetadata(bytes)).toMatchObject({ title: 'Café & song', artist: 'Artist' });
});
