import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import Ajv from 'ajv';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../contracts/${name}`, import.meta.url), 'utf8'));
it('validates the handwritten golden and refuses malformed supported labels', () => {
  const validate = new Ajv({ strict: true }).compile(read('golden.schema.json'));
  const golden = read('handwritten.golden.json');
  expect(validate(golden), JSON.stringify(validate.errors)).toBe(true);
  delete golden.labels.following[0].truth;
  expect(validate(golden)).toBe(false);
});

it('validates the append-only decision wire shape', () => {
  const validate = new Ajv({ strict: true }).compile(read('decisions.schema.json'));
  expect(validate([{ id: 'a', kind: 'unsupported', refersTo: 0, madeAt: 0.01 }])).toBe(true);
  expect(validate([{ id: 'a', kind: 'position', refersTo: 0, madeAt: 0.01, confidence: 1, candidates: [] }])).toBe(false);
});
