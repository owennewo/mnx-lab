import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { it, expect } from 'vitest';
import { compilePerformance, serializePerformance } from '../../src/audio/performance.ts';
import { readMidi } from '../helpers/readMidi.ts';
import { exportMidi } from '../../src/audio/midiFile.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';
// @ts-expect-error plain mjs
import { invalidatePerformance } from '../verify/verify-scenarios.mjs';
const update = process.env.UPDATE_PRIMITIVES === '1';
for (const scenario of loadCorpus()) {
  const meta = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8'));
  if (!meta.performance) continue;
  it(`performance evidence ${scenario.id}`, () => {
    const result = compilePerformance(
      JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')),
    );
    expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const midi = exportMidi(result.performance);
    if (midi.ok) {
      const decoded = readMidi(midi.bytes);
      expect(decoded.format).toBe(1);
      expect(decoded.ppq).toBe(960);
      expect(decoded.tracks.flat().filter((e) => e.status >> 4 === 9)).toHaveLength(
        result.performance.sounding.filter((s) => s.midi >= 0 && s.midi <= 127 && s.velocity > 0)
          .length - midi.diagnostics.filter((d) => d.code === 'collapsed-note').length,
      );
    }
    const verdict = midi.ok
      ? {
          ok: true,
          sha256: crypto.createHash('sha256').update(midi.bytes).digest('hex'),
          allocation: midi.allocation,
          diagnostics: midi.diagnostics,
        }
      : { ok: false, diagnostics: midi.diagnostics };
    for (const [name, text] of [
      ['expected.performance.json', serializePerformance(result.performance)],
      ['expected.midi.json', JSON.stringify(verdict, null, 2) + '\n'],
    ]) {
      const file = path.join(scenario.dir, name);
      if (update) fs.writeFileSync(file, text);
      else expect(fs.readFileSync(file, 'utf8')).toBe(text);
    }
    if (update) invalidatePerformance(scenario);
  });
}
