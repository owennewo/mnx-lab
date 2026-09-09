import fs from 'node:fs';
import path from 'node:path';
import { it, expect } from 'vitest';
import { unrolledSvgs } from '../helpers/unrolledSvg.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';
// @ts-expect-error plain mjs
import { invalidateUnrolled } from '../verify/verify-scenarios.mjs';
for (const scenario of loadCorpus()) {
  const meta = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8'));
  if (!meta.unrolled) continue;
  it(`unrolled evidence ${scenario.id}`, () => {
    const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8'));
    for (const [name, text] of Object.entries(unrolledSvgs(doc))) {
      const file = path.join(scenario.dir, name);
      if (process.env.UPDATE_PRIMITIVES === '1') fs.writeFileSync(file, text);
      else expect(fs.readFileSync(file, 'utf8')).toBe(text);
    }
    if (process.env.UPDATE_PRIMITIVES === '1') invalidateUnrolled(scenario);
  });
}
