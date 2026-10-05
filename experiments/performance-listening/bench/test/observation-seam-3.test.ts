import { describe, it, expect } from 'vitest';
import { readObservationOracle3, check3, inherited3, probes3, stateParity3, statePrefixes3 } from '../src/challenger/validateObservation3.ts';
import { SerialLane3, StreamingInput3 } from '../src/challenger/streaming3.ts';
describe('observation-seam3 implementation agreement, independent audit still required', () => {
  it('matches every new and inherited frozen answer', () => { for (const c of readObservationOracle3()) expect(check3(c).agrees, c.id).toBe(true); for (const c of inherited3()) expect(c.agrees, c.id).toBe(true); });
  it('detects all six distinguishing wrong-rule families', () => { for (const p of probes3(readObservationOracle3())) expect(p.detected, p.family).toBe(true); });
  it('preserves frozen tensors and frame selection with bounded input storage', () => { for (const p of stateParity3()) { expect(p.byteIdentical).toBe(true); expect(p.maxRetainedInput).toBeLessThanOrEqual(2); } }, 30000);
  it('preserves synthetic input-dependent prefixes under changed futures and wall service', () => { for (const c of statePrefixes3()) expect(c.pass).toBe(true); });
  it('refuses nonfinite measurements and malformed backend maps', () => { expect(() => new SerialLane3().call(.1, NaN)).toThrow(); expect(() => new StreamingInput3().frames(new Float32Array(88))).toThrow(); });
});
