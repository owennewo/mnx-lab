import { describe, expect, it } from 'vitest';
import { carryPlace } from '../../src/audio/carryPlace.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { scorePositionAt } from '../../src/audio/scorePosition.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { ZERO, rational as q } from '../../src/audio/time.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const score = (bars: number, meter = 4) => ({
  global: { measures: Array.from({ length: bars }, (_, i) => (i === 0 ? { time: { count: meter, unit: 4 } } : {})) },
  parts: [{ measures: Array.from({ length: bars }, (_, i) => ({ sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ id: `n${i}`, pitch: { step: 'C', octave: 4 } }] }] }] })) }],
}) satisfies Omit<MnxStructure, 'mnx'> as MnxStructure;
const perf = (doc: MnxStructure) => { const c = compilePerformance(doc, linearizePasses(doc)); if (!c.ok) throw new Error('fixture'); return c.performance; };
const place = (p: ReturnType<typeof perf>, position: { num: bigint; den: bigint }) => { const r = scorePositionAt(p, position); return r.ok ? r.value : null; };

describe('carrying the place across an edit', () => {
  it('carries a paused or playing place by bar and offset, with its state', () => {
    const from = perf(score(3)), to = perf(score(4));
    const half = q(5n, 2n); // bar 3, halfway
    expect(carryPlace({ state: 'paused', position: half }, from, to)).toEqual({ position: half, state: 'paused' });
    expect(carryPlace({ state: 'playing', position: half }, from, to)?.state).toBe('playing');
  });
  it('lands on the same bar and offset when bars before it changed length', () => {
    const from = perf(score(3)), to = perf(score(3, 2));
    const carried = carryPlace({ state: 'paused', position: q(5n, 2n) }, from, to);
    expect(carried && place(to, carried.position)).toEqual({ ordinal: 2, metricOffset: q(1n, 2n) });
  });
  it('carries nothing when stopped, or when the bar is gone', () => {
    const from = perf(score(3)), to = perf(score(2));
    expect(carryPlace({ state: 'stopped', position: ZERO }, from, to)).toBeNull();
    expect(carryPlace({ state: 'paused', position: q(2n, 1n) }, from, to)).toBeNull();
    expect(carryPlace({ state: 'paused', position: q(1n, 1n) }, from, to)).toEqual({ position: q(1n, 1n), state: 'paused' });
  });
});
