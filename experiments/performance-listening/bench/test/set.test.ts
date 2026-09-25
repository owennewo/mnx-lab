import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import type { Golden } from '../src/types.ts';
import { validateGolden } from '../src/validate.ts';
const root = new URL('../../', import.meta.url);
const read = (relative: string) => JSON.parse(readFileSync(new URL(relative, root), 'utf8'));
const schema = new Ajv2020({ strict: false }).compile(read('../../spec/mnx-schema.json'));
const goldenSchema = new Ajv({ strict: true }).compile(read('contracts/golden.schema.json'));
const ids = ['p1', 'p2', 'c1-silence', 'c2-wrong-piece', 't1-tempo-90'];
it('keeps the pinned vendor score verbatim, validates it and compiles the exact quarter walk', () => {
  const origin = read('sources/origins.json').s2;
  const bytes = readFileSync(new URL('sources/' + origin.path, root));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(origin.sha256);
  expect(origin.pin).toBe('46fbe9393067221ee83ef08de209cb3c4edf0d8d');
  for (const id of ids) {
    const score = read(`sets/harness-v1/${id}/score.mnx.json`) as MnxStructure;
    expect(schema(score), JSON.stringify(schema.errors)).toBe(true);
    if (id !== 'p1') expect(readFileSync(new URL(`sets/harness-v1/${id}/score.mnx.json`, root))).toEqual(bytes);
    const compiled = compilePerformance(score);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) throw new Error('compile failed');
    expect(compiled.performance.diagnostics).toEqual([]);
    expect(compiled.performance.sounding.map(n => n.midi)).toEqual(id === 'p1' ? [60, 62, 64, 65] : [60, 62, 64, 65, 67, 69, 71, 72]);
    expect(compiled.performance.sounding.map(n => Number(n.position.num) * 4 / Number(n.position.den))).toEqual(Array.from({ length: id === 'p1' ? 4 : 8 }, (_, i) => i));
  }
});
it('validates every draft golden and its declared profile deviations and partitions', () => {
  for (const id of ids) {
    const g = read(`sets/harness-v1/${id}/golden.json`) as Golden;
    expect(goldenSchema(g), JSON.stringify(goldenSchema.errors)).toBe(true);
    validateGolden(g); expect(g.partition).toBe('development'); expect(g.noteAssessment).toBeNull();
    if (id === 't1-tempo-90') { expect(g.profile.tempo.level).toBe(2); expect(g.audio.recipe.parameters.bpm).toBe(90); expect(g.intended.tempo.bpm).toBe(60); }
    if (id !== 'p1' && id !== 'c1-silence') expect(g.profile.melodic.note).toContain('C5 exceeds');
    if (id === 'c2-wrong-piece') expect(g.labels.notes.every(n => n.scoreNoteId === null)).toBe(true);
  }
  expect(read('sets/partitions.json').sets['harness-v1'].claim).toContain('development only');
});
