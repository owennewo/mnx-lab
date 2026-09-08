import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarPro } from '../src/index.js';
import { importGuitarPro as importOracle } from '../src/import/gp.js';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { normalizeIds } from './helpers/normalize.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s combined measure header', revision => {
  it('reads marker, key, ending and time-change records in revision-specific order', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/combined-header-${revision}.gp${revision[0]}`));
    const header = parseGuitarProBinary(bytes).masterBars[1];
    // The public fixture writer places GP5's requested ending 1 before the
    // beam bytes; both independent consumers see the stored mask as 2.
    // Follow file semantics, not the writer's input model.
    expect(header).toMatchObject({ sectionText: 'Combined', alternateEndingsMask: revision.startsWith('5') ? 2 : 1 });
    expect(normalizeIds(importGuitarPro(bytes))).toEqual(normalizeIds(importOracle(bytes)));
  });
});
