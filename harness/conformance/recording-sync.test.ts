import { describe, expect, it } from 'vitest';
import { decodeRecordingSync, MAX_RECORDING_SYNCPOINTS } from '../../src/model/recordingSync.ts';
import { createRecordingSync, type RecordingSyncResult } from '../../src/audio/recordingSync.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { rational as q, ZERO, ONE, add, fromDecimal, subtract } from '../../src/audio/time.ts';
import type { MnxEvent, MnxGlobalMeasure, MnxSequenceItem, MnxStructure } from '../../src/model/mnx.ts';

const unwrap = <T>(result: RecordingSyncResult<T>): T => {
  if (!result.ok) throw new Error(`${result.diagnostic.code}: ${result.diagnostic.message}`);
  return result.value;
};
const note = (id: string, base: MnxEvent['duration']['base'] = 'quarter'): MnxEvent => ({
  duration: { base }, notes: [{ id, pitch: { step: 'C', octave: 4 } }],
});
function score(content: MnxSequenceItem[][] = [[note('a', 'whole')], [note('b', 'whole')]], globals?: MnxGlobalMeasure[]): MnxStructure {
  // No `mnx` header: nothing under test reads it.
  return {
    global: { measures: globals ?? content.map((_, i) => i === 0 ? { time: { count: 4, unit: 4 } } : {}) },
    parts: [{ measures: content.map(content => ({ sequences: [{ content }] })) }],
  } as MnxStructure;
}
function compiled(document = score()) {
  const passes = linearizePasses(document);
  const p = compilePerformance(document, passes);
  if (!p.ok) throw new Error(JSON.stringify(p.diagnostics));
  return { performance: p.performance, writtenBarDurations: p.writtenBarDurations, passes };
}
function bind(points: unknown, document = score()) {
  const { performance, writtenBarDurations, passes } = compiled(document);
  return unwrap(createRecordingSync(points, { performance, writtenBarDurations }, passes));
}
const pos = (ordinal: number, metricOffset = ZERO) => ({ ordinal, metricOffset });
const diagnostic = (result: RecordingSyncResult<unknown>) => result.ok ? 'ok' : result.diagnostic.code;

// Hand-stated external-format cases, not dependent on private recordings or exports.
describe('the shared Soundslice tuple decoder', () => {
  it('preserves arity, fractional offsets and explicit zero flags without mutating the source', () => {
    const source = [[0, 1], [0, 2.5, 106.66666666666666], [1, 4, 0, 0], [2, 8, 0, 1]];
    const decoded = unwrap(decodeRecordingSync(source));
    expect(decoded.raw).toEqual(source);
    expect(decoded.points[0]).toEqual({ bar: 0, seconds: 1, offset: 0, hidePlayhead: false });
    expect(decoded.points[3].hidePlayhead).toBe(true);
    source[0][1] = 99;
    expect(decoded.raw[0][1]).toBe(1);
    expect(Object.isFrozen(decoded.raw[0])).toBe(true);
    expect(Object.isFrozen(decoded.points[0])).toBe(true);
  });
  it('accepts an empty map and storable unsupported navigation without claiming it can play', () => {
    expect(decodeRecordingSync([]).ok).toBe(true);
    expect(decodeRecordingSync([[0, 0], [2, 4], [1, 8]]).ok).toBe(true);
  });
  it('rejects malformed fields, unsafe bars, NaN/infinity and present nulls or holes', () => {
    for (const input of [null, {}, '[]', [null], [[0]], [[0, 1, 0, 0, 7]], [[-1, 0]], [[0.5, 0]],
      [[Number.MAX_SAFE_INTEGER + 1, 0]], [['0', 0]], [[0, -1]], [[0, NaN]], [[0, Infinity]], [[0, '1']],
      [[0, 0, -1]], [[0, 0, 481]], [[0, 0, NaN]], [[0, 0, Infinity]], [[0, 0, null]], [[0, 0, undefined]],
      [[0, 0, 0, true]], [[0, 0, 0, 2]], [[0, 0, 0, null]], [[0, 0, 0, undefined]], Array(2)]) {
      expect(diagnostic(decodeRecordingSync(input)), String(input)).toBe('invalid-sync');
    }
  });
  it('bounds untrusted tuple counts before iterating or allocating normalized points', () => {
    expect(diagnostic(decodeRecordingSync(Array(MAX_RECORDING_SYNCPOINTS + 1)))).toBe('resource-limit');
  });
});

describe('performed bar and recording time mapping', () => {
  it('uses anchors for each bar and preserves exact boundary positions in both directions', () => {
    const map = bind([[0, 2], [1, 6], [2, 12]]);
    expect(map.coverage).toBe('full');
    expect(unwrap(map.positionAt(2))).toEqual({ position: pos(0), hidePlayhead: false, atAnchor: true });
    expect(unwrap(map.positionAt(6)).position).toEqual(pos(1));
    expect(unwrap(map.positionAt(9)).position).toEqual(pos(1, q(1n, 2n)));
    expect(unwrap(map.secondsAt(pos(1, q(1n, 2n))))).toBe(9);
    expect(unwrap(map.secondsAt(pos(0, ONE)))).toBe(6); // canonical barline
    expect(unwrap(map.positionAt(12)).position).toEqual(pos(2));
    expect(unwrap(map.toPerformance(pos(2)))).toEqual(q(2n));
    expect(unwrap(map.fromPerformance(q(2n)))).toEqual(pos(2));
  });
  it('accepts a final offset-480 anchor as the final boundary', () => {
    const map = bind([[0, 2], [1, 12, 480]]);
    expect(map.coverage).toBe('full');
    expect(unwrap(map.positionAt(12)).position).toEqual(pos(2));
  });
  it('interpolates sparse bars equally in bar coordinates across a pickup and meter change', () => {
    const document = score([[note('pickup')], [note('three', 'half'), note('last')]],
      [{ time: { count: 4, unit: 4 } }, { time: { count: 3, unit: 4 } }]);
    const map = bind([[0, 1], [2, 9]], document);
    expect(unwrap(map.positionAt(3)).position).toEqual(pos(0, q(1n, 8n)));
    expect(unwrap(map.positionAt(5)).position).toEqual(pos(1));
    expect(unwrap(map.positionAt(7)).position).toEqual(pos(1, q(3n, 8n)));
    expect(unwrap(map.toPerformance(pos(1, q(3n, 8n))))).toEqual(q(5n, 8n));
  });
  it('uses the performed ordinal on repeat visits, never the written bar index', () => {
    const document = score(undefined, [{ time: { count: 4, unit: 4 }, repeatStart: {} }, { repeatEnd: {} }]);
    const { performance } = compiled(document);
    expect(performance.measures.map(m => m.measureIndex)).toEqual([0, 1, 0, 1]);
    const map = bind([[0, 0], [1, 2], [2, 4], [3, 7], [4, 11]], document);
    expect(unwrap(map.positionAt(5.5)).position).toEqual(pos(2, q(1n, 2n)));
    expect(unwrap(map.secondsAt(pos(2)))).toBe(4);
    expect(unwrap(map.toPerformance(pos(2)))).toEqual(q(2n));
    expect(unwrap(map.fromPerformance(q(5n, 2n)))).toEqual(pos(2, q(1n, 2n)));
  });
  it('maps a hand-stated final-bar slowdown using more than one timestamp per bar', () => {
    const map = bind([[0, 0], [1, 4], [1, 5, 240], [1, 7, 360], [2, 11]]);
    expect(map.coverage).toBe('full'); // five points for two bars is valid
    expect(unwrap(map.positionAt(5)).position).toEqual(pos(1, q(1n, 2n)));
    expect(unwrap(map.positionAt(6)).position).toEqual(pos(1, q(5n, 8n)));
    expect(unwrap(map.positionAt(9)).position).toEqual(pos(1, q(7n, 8n)));
    expect(unwrap(map.secondsAt(pos(1, q(7n, 8n))))).toBe(9);
  });
  it('preserves fractional inner-bar anchors, including a triplet-like decimal offset', () => {
    const map = bind([[0, 0], [0, 1.25, 106.66666666666666], [1, 4], [2, 8]]);
    const point = unwrap(map.positionAt(1.25));
    expect(point.atAnchor).toBe(true);
    expect(unwrap(map.secondsAt(point.position))).toBe(1.25);
    const f = point.position.metricOffset;
    expect(Number(f.num) / Number(f.den)).toBeCloseTo(2 / 9, 14);
  });
  it('never extrapolates an intro, unanchored final bar, or outro', () => {
    const map = bind([[0, 2], [1, 6]]);
    expect(map.coverage).toBe('partial');
    expect(map.bounds).toEqual({ startSeconds: 2, endSeconds: 6, end: pos(1) });
    for (const t of [0, 1.999, 6.001, 600]) expect(diagnostic(map.positionAt(t))).toBe('outside-coverage');
    expect(unwrap(map.positionAt(6)).position).toEqual(pos(1)); // isolated final anchor still usable
    expect(diagnostic(map.secondsAt(pos(1, q(1n, 4n))))).toBe('outside-coverage');
    expect(diagnostic(map.fromPerformance(q(3n, 2n)))).toBe('outside-coverage');
    expect(diagnostic(map.toPerformance(pos(2)))).toBe('outside-coverage');
    const full = bind([[0, 2], [2, 10]]);
    expect(diagnostic(full.positionAt(10.001))).toBe('outside-coverage');
  });
  it('switches hide-playhead state at anchors, including resetting an omitted flag', () => {
    const map = bind([[0, 0], [0, 1, 120, 1], [1, 4, 0, 0], [1, 6, 240, 1], [2, 8]]);
    for (const time of [1, 1.5, 3.999, 6, 7.99]) expect(unwrap(map.positionAt(time)).hidePlayhead).toBe(true);
    for (const time of [0, 0.99, 4, 5.99, 8]) expect(unwrap(map.positionAt(time)).hidePlayhead).toBe(false);
    expect(unwrap(map.positionAt(1.5)).atAnchor).toBe(false);
    expect(unwrap(map.secondsAt(pos(0, q(1n, 2n))))).toBe(2); // hidden does not delete timing
  });
  it('keeps media round trips within 1 nanosecond over varied segment slopes', () => {
    const map = bind([[0, 1.123], [0, 2.817, 106.66666666666666], [1, 9.02], [1, 13.923, 360], [2, 18.44]]);
    for (let i = 0; i <= 250; i++) {
      const seconds = 1.123 + (18.44 - 1.123) * i / 250;
      const position = unwrap(map.positionAt(seconds)).position;
      expect(Math.abs(unwrap(map.secondsAt(position)) - seconds)).toBeLessThan(1e-9);
    }
  });
  it('snapshots caller-owned arrays and does not modify compiled output', () => {
    const data = [[0, 1], [2, 9]];
    const { performance, writtenBarDurations, passes } = compiled();
    const original = structuredClone(performance);
    const map = unwrap(createRecordingSync(data, { performance, writtenBarDurations }, passes));
    expect(performance).toEqual(original);
    performance.measures[0].until = q(99n);
    performance.sourceMap.splice(0);
    passes.entries.splice(0);
    data[0][1] = 999;
    expect(unwrap(map.positionAt(3)).position).toEqual(pos(0, q(1n, 2n)));
    expect(unwrap(map.toPerformance(pos(0, q(1n, 2n))))).toEqual(q(1n, 2n));
  });
});

describe('unsupported or invalid maps produce reasons rather than fabricated positions', () => {
  it('rejects underspecified maps and missing first-bar anchors', () => {
    const { performance, writtenBarDurations, passes } = compiled();
    for (const points of [[], [[0, 0]]]) expect(diagnostic(createRecordingSync(points, { performance, writtenBarDurations }, passes))).toBe('no-sync');
    for (const points of [[[1, 0], [2, 4]], [[0, 0, 240], [2, 4]]])
      expect(diagnostic(createRecordingSync(points, { performance, writtenBarDurations }, passes))).toBe('invalid-sync');
  });
  it('diagnoses duplicate time/position, equivalent boundary tuples and backwards maps without repair', () => {
    const { performance, writtenBarDurations, passes } = compiled();
    for (const points of [[[0, 0], [0, 0], [2, 4]], [[0, 0], [1, 0]], [[0, 0], [0, 1]],
      [[0, 0], [0, 2, 480], [1, 3]], [[0, 0], [1, 2, 0, 1], [1, 3, 0, 0]]])
      expect(diagnostic(createRecordingSync(points, { performance, writtenBarDurations }, passes))).toBe('ambiguous-sync');
    for (const points of [[[0, 0], [1, 2], [0, 4]], [[0, 0], [1, 3], [2, 2]]])
      expect(diagnostic(createRecordingSync(points, { performance, writtenBarDurations }, passes))).toBe('nonsequential-sync');
  });
  it('requires at least two in-range points after dropping beyond-boundary anchors', () => {
    const { performance, writtenBarDurations, passes } = compiled();
    expect(diagnostic(createRecordingSync([[0, 0], [3, 4]], { performance, writtenBarDurations }, passes))).toBe('no-sync');
    expect(diagnostic(createRecordingSync([[0, 0], [2, 4, 1]], { performance, writtenBarDurations }, passes))).toBe('no-sync');
  });
  it('drops only anchors beyond the final performed boundary and preserves source evidence', () => {
    const c = compiled();
    const raw = [[0, 1], [1, 5], [2, 9], [2, 10, 1], [3, 12]];
    const before = JSON.stringify(raw);
    const result = createRecordingSync(raw, c, c.passes);
    const map = unwrap(result);
    expect(result.droppedPointIndices).toEqual([3, 4]);
    expect(map.coverage).toBe('full');
    expect(unwrap(map.secondsAt(pos(1, q(1n, 2n))))).toBe(7);
    expect(unwrap(map.positionAt(7)).position).toEqual(pos(1, q(1n, 2n)));
    expect(map.source.raw).toEqual(raw);
    expect(JSON.stringify(raw)).toBe(before);
    expect(diagnostic(map.positionAt(10))).toBe('outside-coverage');
  });
  it('keeps partial coverage and rejects invalid retained ordering after dropping', () => {
    const c = compiled();
    const partial = createRecordingSync([[0, 1], [1, 5], [3, 12]], c, c.passes);
    expect(unwrap(partial).coverage).toBe('partial');
    expect(partial.droppedPointIndices).toEqual([2]);
    const bad = createRecordingSync([[0, 1], [3, 12], [1, 0]], c, c.passes);
    expect(diagnostic(bad)).toBe('nonsequential-sync');
    if (!bad.ok) expect(bad.diagnostic.point).toBe(2);
    const empty = createRecordingSync([[3, 1], [4, 5]], c, c.passes);
    expect(diagnostic(empty)).toBe('no-sync');
    expect(empty.droppedPointIndices).toEqual([0, 1]);
    expect(bind([[0, 1], [1, 9, 480], [3, 12]]).coverage).toBe('full');
  });
  it('rejects unknown or truncated traversals and mismatched identity', () => {
    const { performance, writtenBarDurations, passes } = compiled();
    passes.entries[1].iteration++;
    expect(diagnostic(createRecordingSync([[0, 0], [2, 4]], { performance, writtenBarDurations }, passes))).toBe('invalid-traversal');
    const truncated = compiled();
    truncated.passes.diagnostics.push({ code: 'cap', measureIndex: 0, message: 'capped' });
    expect(diagnostic(createRecordingSync([[0, 0], [2, 4]], truncated, truncated.passes))).toBe('invalid-traversal');
  });
  it('diagnoses actual mid-bar D.S./Fine slices instead of stretching offsets over them', () => {
    const document = score(undefined, [
      { time: { count: 4, unit: 4 }, segno: { location: { fraction: [1, 4] } }, fine: { location: { fraction: [1, 2] } } },
      { jump: { type: 'dsalfine', location: { fraction: [1, 1] } } },
    ]);
    const { performance, writtenBarDurations, passes } = compiled(document);
    expect(passes.entries.some(e => e.from || e.until)).toBe(true);
    expect(diagnostic(createRecordingSync([[0, 0], [performance.measures.length, 12]], { performance, writtenBarDurations }, passes))).toBe('partial-bar');
  });
  it('supports D.S. al Fine when explicit navigation bounds are full-bar boundaries', () => {
    const document = score(undefined, [
      { time: { count: 4, unit: 4 }, segno: { location: { fraction: [0, 1] } }, fine: { location: { fraction: [1, 1] } } },
      { jump: { type: 'dsalfine', location: { fraction: [1, 1] } } },
    ]);
    const { performance } = compiled(document);
    expect(performance.measures.map(m => m.measureIndex)).toEqual([0, 1, 0]);
    const map = bind([[0, 1], [3, 13]], document);
    expect(unwrap(map.positionAt(9)).position).toEqual(pos(2));
    expect(unwrap(map.toPerformance(pos(2, q(1n, 2n))))).toEqual(q(5n, 2n));
  });
  it('rejects invalid query positions and bounds arithmetic resource use', () => {
    const map = bind([[0, 0], [2, 8]]);
    for (const t of [NaN, Infinity, -1]) expect(diagnostic(map.positionAt(t))).toBe('out-of-range');
    for (const p of [pos(-1), pos(0.5), pos(3), pos(0, q(-1n)), pos(0, q(2n)), pos(2, ONE)])
      expect(diagnostic(map.secondsAt(p))).toBe('out-of-range');
    const { performance, writtenBarDurations, passes } = compiled();
    expect(diagnostic(createRecordingSync([[0, 0], [1, 1, Number.MIN_VALUE], [2, 8]], { performance, writtenBarDurations }, passes))).toBe('resource-limit');
  });
});

describe('synth handoff is separate from the recorded time axis', () => {
  it('bridges swing without swinging the recording interpolation a second time', () => {
    const document = score([[note('a', 'eighth'), note('b', 'eighth')]], [{
      time: { count: 1, unit: 4 }, _x: { mnxLab: { swing: { unit: { base: 'eighth' }, ratio: [2, 1] } } },
    }]);
    const map = bind([[0, 0], [1, 2]], document);
    // Half a played bar: written eighth, even though synth plays it at 1/6.
    const metric = unwrap(map.positionAt(1)).position;
    expect(metric).toEqual(pos(0, q(1n, 8n)));
    expect(unwrap(map.toPerformance(metric))).toEqual(q(1n, 6n));
    expect(unwrap(map.fromPerformance(q(1n, 6n)))).toEqual(metric);
    expect(unwrap(map.secondsAt(metric))).toBe(1);
  });
  it('does not stretch recording time by a fermata and diagnoses handoffs inside the synthetic hold', () => {
    const held = note('held'); held.fermata = { duration: 'long' };
    const document = score([[held, note('following')]]);
    const map = bind([[0, 2], [1, 10]], document);
    expect(unwrap(map.positionAt(6)).position).toEqual(pos(0, q(1n, 4n)));
    expect(diagnostic(map.toPerformance(pos(0, q(1n, 4n))))).toBe('ambiguous-insertion');
    expect(unwrap(map.toPerformance(pos(0, q(1n, 4n)), 'before'))).toEqual(q(1n, 4n));
    expect(unwrap(map.toPerformance(pos(0, q(1n, 4n)), 'after'))).toEqual(q(1n, 2n));
    expect(diagnostic(map.fromPerformance(q(3n, 8n)))).toBe('ambiguous-insertion');
    expect(unwrap(map.fromPerformance(q(1n, 2n)))).toEqual(pos(0, q(1n, 4n)));
    expect(unwrap(map.positionAt(8)).position).toEqual(pos(0, q(3n, 8n)));
  });
  it('bridges make-time grace and terminal barline holds with explicit edges', () => {
    const document = score([[{ type: 'grace', graceType: 'makeTime', content: [note('grace', 'eighth')] }, note('main')]],
      [{ time: { count: 1, unit: 4 }, fermata: { duration: 'long' } }]);
    const { performance } = compiled(document);
    const map = bind([[0, 1], [1, 5]], document);
    const grace = performance.sourceMap.find(s => s.kind === 'makeTime')!;
    expect(diagnostic(map.toPerformance(pos(0)))).toBe('ambiguous-insertion');
    expect(unwrap(map.toPerformance(pos(0), 'before'))).toEqual(ZERO);
    expect(unwrap(map.toPerformance(pos(0), 'after'))).toEqual(grace.duration);
    expect(diagnostic(map.fromPerformance(q(1n, 64n)))).toBe('ambiguous-insertion');
    expect(unwrap(map.fromPerformance(grace.duration))).toEqual(pos(0));
    const hold = performance.sourceMap.find(s => s.kind === 'fermata')!;
    expect(diagnostic(map.toPerformance(pos(1)))).toBe('ambiguous-insertion');
    expect(unwrap(map.toPerformance(pos(1), 'before'))).toEqual(hold.position);
    const end = add(hold.position, hold.duration);
    expect(unwrap(map.toPerformance(pos(1), 'after'))).toEqual(end);
    expect(unwrap(map.fromPerformance(end))).toEqual(pos(1));
    expect(unwrap(map.positionAt(3)).position).toEqual(pos(0, q(1n, 8n)));
  });
  it('round trips exact metric locations through the source map without clock quantization', () => {
    const map = bind([[0, 0], [2, 100]]);
    for (const position of [pos(0, q(1n, 7n)), pos(1, q(1n, 4096n)), pos(1, subtract(ONE, fromDecimal(0.00001)))])
      expect(unwrap(map.fromPerformance(unwrap(map.toPerformance(position))))).toEqual(position);
  });
});
