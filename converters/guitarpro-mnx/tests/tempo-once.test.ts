import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { gpifToMnx, mnxToGpifXml, parseGpif } from '../src/gpif/index.js';
import { importGuitarProCleanRoom } from '../src/index.js';
import { MnxStructure } from '../src/common/types.js';

/**
 * The opening tempo is one mark. GP3-5 files state it in the header and Guitar
 * Pro writes it again as an automation, so a reader that takes both at their
 * word prints "♩ = 128" twice over the first bar — and a `.gp` saved from that
 * document carries both automations into every later read.
 */
describe('the opening tempo is read once', () => {
  it.each(['3.00', '4.00', '5.00', '5.10'])('GP%s', revision => {
    const bytes = readFileSync(path.resolve(__dirname, `fixtures/gp5/mix-${revision}.gp${revision[0]}`));
    expect(importGuitarProCleanRoom(bytes).global.measures[0].tempos).toHaveLength(1);
  });

  it('a GPIF file that states the same tempo twice in a bar', () => {
    const mnx: MnxStructure = JSON.parse(readFileSync(path.resolve(__dirname, '../../fixtures/Vestapol.mnx.json'), 'utf-8'));
    const xml = mnxToGpifXml(mnx);
    const automation = /<Automation><Type>Tempo<\/Type>[\s\S]*?<\/Automation>/.exec(xml)![0];
    const twice = xml.replace(automation, automation + automation);
    expect(gpifToMnx(parseGpif(twice)).global.measures[0].tempos).toEqual([{ bpm: 180, value: { base: 'quarter' } }]);
  });
});
