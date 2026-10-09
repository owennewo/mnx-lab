// Is the synth keeping up? (src/audio/hostStrain.ts.) One slow report is not strain; two
// running, or an underrun, is; it clears after three quiet seconds.
import { it, expect } from 'vitest';
import { StrainMonitor, STRAIN } from '../../src/audio/hostStrain.ts';

const calm = { busy: 0.2, peakMs: 1 }, busy = { busy: 0.85, peakMs: 3 }, stall = { busy: 0.2, peakMs: 12 };
it('two hot reports running are strain; one is not', () => {
  const m = new StrainMonitor();
  expect(m.report(stall, 0)).toBe(false);
  expect(m.report(calm, 500)).toBe(false);
  expect(m.strained).toBe(false);
  m.report(busy, 1000);
  expect(m.report(stall, 1500)).toBe(true);
  expect(m.strained).toBe(true);
});
it('an underrun is strain at once', () => {
  const m = new StrainMonitor();
  expect(m.report({ ...calm, underruns: 1 }, 0)).toBe(true);
});
it('strain clears after three quiet seconds, not before', () => {
  const m = new StrainMonitor();
  m.report(busy, 0); m.report(busy, 500);
  for (let t = 1000; t < 500 + STRAIN.clearAfterMs; t += 500) { m.report(calm, t); expect(m.strained, `at ${t} ms`).toBe(true); }
  expect(m.report(calm, 500 + STRAIN.clearAfterMs)).toBe(true);
  expect(m.strained).toBe(false);
  m.report(busy, 4000); m.reset();
  expect(m.strained).toBe(false);
});
