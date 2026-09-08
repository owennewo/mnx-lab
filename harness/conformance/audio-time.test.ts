import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { durationValue } from '../../src/model/durations.ts';
import type { MnxEvent, MnxGlobalMeasure } from '../../src/model/mnx.ts';
import { rational as q, add, subtract, multiply, divide, compare, ZERO, ONE, QUARTER,
  noteDuration, durationInTuplets, fromSafeFraction, toSafeFraction, fromDecimal,
  toRationalJSON, fromRationalJSON, TimingError, TIME_LIMITS, quarterBpm,
  createTempoMap, CLOCK_RESOLUTION, type TupletRatio } from '../../src/audio/time.ts';
import { createWrittenStateLane, performedTempoChanges, type TimedEntry } from '../../src/audio/writtenState.ts';

const eighth = { base: 'eighth' } as const;
const triplet: TupletRatio = { inner: { duration: eighth, multiple: 3 }, outer: { duration: eighth, multiple: 2 } };
const septuplet: TupletRatio = { inner: { duration: eighth, multiple: 7 }, outer: { duration: eighth, multiple: 4 } };
const expectCode = (run: () => unknown, code: string) => {
  try { run(); throw new Error('Expected a timing error'); }
  catch (error) { expect(error).toBeInstanceOf(TimingError); expect((error as TimingError).diagnostic.code).toBe(code); }
};

describe('exact whole-note arithmetic', () => {
  it('reduces signs and zero and performs exact arithmetic', () => {
    expect(q(4n, -6n)).toEqual(q(-2n, 3n)); expect(q(0n, -9n)).toEqual(ZERO);
    expect(add(q(1n, 3n), q(1n, 7n))).toEqual(q(10n, 21n));
    expect(subtract(q(1n, 3n), q(1n, 7n))).toEqual(q(4n, 21n));
    expect(multiply(q(7n, 3n), q(3n, 7n))).toEqual(ONE);
    expect(divide(q(1n, 3n), q(1n, 7n))).toEqual(q(7n, 3n));
    expect(compare(q(2n, 6n), q(1n, 3n))).toBe(0);
    expect(compare(q(1n, 7n), q(1n, 3n))).toBe(-1);
    expect(compare(q(1n, 3n), q(1n, 7n))).toBe(1);
    expectCode(() => q(1n, 0n), 'invalid-time'); expectCode(() => divide(ONE, ZERO), 'invalid-time');
  });
  it('serializes only canonical reduced decimal pairs', () => {
    expect(toRationalJSON(q(2n, 64n))).toEqual({ num: '1', den: '32' });
    expect(fromRationalJSON({ num: '-7', den: '3' })).toEqual(q(-7n, 3n));
    for (const value of [
      { num: '01', den: '2' }, { num: '-0', den: '1' }, { num: '2', den: '4' },
      { num: '0', den: '2' }, { num: '+1', den: '2' }, { num: '1', den: '-2' },
      { num: '1e2', den: '1' }, { num: '1', den: '0' }
    ]) expectCode(() => fromRationalJSON(value), 'invalid-time');
    expectCode(() => fromRationalJSON({ num: '9'.repeat(600), den: '1' }), 'resource-limit');
  });
  it('checks the number-based Onset boundary without losing deep-tuplet precision', () => {
    expect(fromSafeFraction({ num: 6, den: 8 })).toEqual(q(3n, 4n));
    expect(toSafeFraction(q(3n, 4n))).toEqual({ num: 3, den: 4 });
    expectCode(() => fromSafeFraction({ num: Number.MAX_SAFE_INTEGER + 1, den: 1 }), 'unsafe-number');
    expectCode(() => fromSafeFraction({ num: 0.5, den: 1 }), 'unsafe-number');
    expectCode(() => toSafeFraction(q(1n, 1n << 54n)), 'unsafe-number');
    expect(fromDecimal(72.5)).toEqual(q(145n, 2n));
    expect(fromDecimal(-0.125)).toEqual(q(-1n, 8n));
    expect(fromDecimal(1e-7)).toEqual(q(1n, 10000000n));
    expectCode(() => fromDecimal(Infinity), 'invalid-time');
  });
  // Hand-stated dyadic exponents cover the one model table, not a second
  // implementation table used by playback.
  const values: [MnxEvent['duration']['base'], number][] = [
    ['duplexMaxima',4], ['maxima',3], ['longa',2], ['breve',1], ['whole',0], ['half',-1],
    ['quarter',-2], ['eighth',-3], ['16th',-4], ['32nd',-5], ['64th',-6], ['128th',-7],
    ['256th',-8], ['512th',-9], ['1024th',-10], ['2048th',-11], ['4096th',-12]
  ];
  for (const [base, exponent] of values) it(`${base}: dots and nested tuplets stay exact`, () => {
    const plain = exponent >= 0 ? q(1n << BigInt(exponent)) : q(1n, 1n << BigInt(-exponent));
    for (const dots of [0, 1, 2, 3, 32]) {
      const value = { base, dots };
      const dotted = multiply(plain, q((1n << BigInt(dots + 1)) - 1n, 1n << BigInt(dots)));
      expect(noteDuration(value)).toEqual(dotted);
      expect(durationInTuplets(value, [triplet, septuplet, triplet])).toEqual(multiply(dotted, q(16n, 63n)));
      if (dots < 4) expect(Number(dotted.num) / Number(dotted.den)).toBe(durationValue(value));
    }
  });
  it('can represent thirty-two nested septuplets but stops at the resource boundary', () => {
    const nested = durationInTuplets({ base: '4096th' }, Array(32).fill(septuplet));
    expect(nested).toEqual(q(4n ** 32n, 4096n * 7n ** 32n));
    expectCode(() => durationInTuplets(eighth, Array(33).fill(triplet)), 'resource-limit');
    expectCode(() => noteDuration({ base: 'whole', dots: 33 }), 'resource-limit');
    expectCode(() => noteDuration({ base: 'whole', dots: -1 }), 'invalid-time');
    expectCode(() => q(1n << BigInt(TIME_LIMITS.bits)), 'resource-limit');
    expectCode(() => multiply(q(1n, (1n << 300n) - 1n), q(1n, (1n << 300n) + 1n)), 'resource-limit');
    expectCode(() => durationInTuplets(eighth, [{ ...triplet, inner: { ...triplet.inner, multiple: 0 } }]), 'invalid-time');
  });
});

describe('quarter-BPM tempo map and clock boundary', () => {
  it('defaults to 120 quarter BPM and never applies a transport rate', () => {
    const map = createTempoMap();
    expect(map.secondsAt(ONE)).toBe(2); expect(map.positionAt(2)).toEqual(ONE);
    expect(quarterBpm(90, { base: 'half' })).toEqual(q(180n));
    expect(quarterBpm(80, { base: 'quarter', dots: 1 })).toEqual(q(120n));
  });
  it('integrates sorted changes exactly, with last mark winning at a shared position', () => {
    const input = [{ position: q(1n,2n), quarterBpm: q(90n) },
      { position: ZERO, quarterBpm: q(120n) }, { position: q(1n,2n), quarterBpm: q(60n) }];
    const map = createTempoMap(input);
    expect(input).toHaveLength(3); expect(map.changes).toHaveLength(2);
    expect(map.secondsAt(q(1n,2n))).toBe(1); expect(map.secondsAt(ONE)).toBe(3);
    expect(map.positionAt(1)).toEqual(q(1n,2n)); expect(map.positionAt(3)).toEqual(ONE);
    expectCode(() => createTempoMap([{ position: ZERO, quarterBpm: ZERO }]), 'invalid-time');
    expectCode(() => map.positionAt(-1), 'invalid-time');
    expectCode(() => map.secondsAt(q(-1n)), 'invalid-time');
  });
  it('bounds inverse rounding without snapping exact event positions', () => {
    const event = q(1n, 7n * 4096n);
    const map = createTempoMap([{ position: q(1n,3n), quarterBpm: q(145n,2n) }]);
    for (const position of [ZERO,event,q(1n,3n),q(3n,7n),ONE,q(100n)]) {
      const roundTrip = map.positionAt(map.secondsAt(position));
      const delta = subtract(roundTrip, position);
      expect(compare(q(delta.num < 0n ? -delta.num : delta.num, delta.den), divide(CLOCK_RESOLUTION,q(2n)))).toBeLessThanOrEqual(0);
    }
    expect(map.positionAt(map.secondsAt(divide(CLOCK_RESOLUTION,q(2n))))).toEqual(CLOCK_RESOLUTION);
    expect(event).toEqual(q(1n,28672n));
  });
  it('honours the corpus mid-bar marks, including a first mark after the bar start', () => {
    const doc = JSON.parse(fs.readFileSync(new URL('../../scenarios/lab/40-navigation/04-tempo-change-mid-bar/document.mnx.json', import.meta.url), 'utf8'));
    const entries: TimedEntry[] = [0,1].map(i => ({ ordinal:i, measureIndex:i, metricOffset:ZERO, until:ONE, position:q(BigInt(i)) }));
    const map = createTempoMap(performedTempoChanges(doc.global.measures, entries));
    expect(map.secondsAt(q(1n,2n))).toBe(1);
    expect(map.secondsAt(ONE)).toBe(3);
    expect(map.secondsAt(q(5n,4n))).toBe(4);
    expect(map.secondsAt(q(2n))).toBe(5);
  });
});

it('restores written tempo on jumps, applies prior mid-bar state, and includes skipped-ending state', () => {
  const globals: MnxGlobalMeasure[] = [
    { tempos: [{ bpm:120,value:{base:'quarter'} }, { bpm:60,value:{base:'quarter'},location:{fraction:[1,2]} }] },
    { tempos: [{ bpm:90,value:{base:'quarter'} }] }, // a skipped first ending
    {}, { tempos: [{ bpm:180,value:{base:'quarter'} }] }
  ];
  const entries: TimedEntry[] = [
    { ordinal:0,measureIndex:0,metricOffset:ZERO,until:ONE,position:ZERO },
    { ordinal:1,measureIndex:2,metricOffset:ZERO,until:ONE,position:ONE },
    { ordinal:2,measureIndex:3,metricOffset:ZERO,until:ONE,position:q(2n) },
    { ordinal:3,measureIndex:0,metricOffset:q(3n,4n),until:ONE,position:q(3n) }
  ];
  expect(performedTempoChanges(globals,entries)).toEqual([
    { position:ZERO,quarterBpm:q(120n) }, { position:q(1n,2n),quarterBpm:q(60n) },
    { position:ONE,quarterBpm:q(90n) }, { position:q(2n),quarterBpm:q(180n) },
    { position:q(3n),quarterBpm:q(60n) }
  ]);
});

it('time signatures and scoped persistent dynamics use independent written-state lanes', () => {
  const time = createWrittenStateLane([
    { measureIndex:0,metricOffset:ZERO,value:'3/4' }, { measureIndex:2,metricOffset:ZERO,value:'6/8' }
  ], '4/4');
  // Compiler resolves each scope before creating its lane. One-shot accents
  // are attacks, not lane changes; expression interpretation belongs to item 8.
  const upper = createWrittenStateLane([
    { measureIndex:0,metricOffset:ZERO,value:'p' }, { measureIndex:1,metricOffset:ZERO,value:'f' }
  ], 'mf');
  const lower = createWrittenStateLane([{ measureIndex:2,metricOffset:ZERO,value:'pp' }], 'mf');
  const target = { measureIndex:2,metricOffset:q(1n,4n) };
  expect(time.at(target)).toBe('6/8'); expect(upper.at(target)).toBe('f'); expect(lower.at(target)).toBe('pp');
  expect(time.at({ measureIndex:0,metricOffset:ZERO })).toBe('3/4');
  expect(upper.at({ measureIndex:0,metricOffset:ZERO })).toBe('p');
  expect(lower.at({ measureIndex:0,metricOffset:ZERO })).toBe('mf');
});

it('projects half-open pickup slices without replaying a mark at the slice end', () => {
  const lane = createWrittenStateLane([
    {measureIndex:0,metricOffset:ZERO,value:120},
    {measureIndex:0,metricOffset:QUARTER,value:60},
    {measureIndex:0,metricOffset:q(1n,2n),value:90}
  ],120);
  expect(lane.project([{ordinal:0,measureIndex:0,metricOffset:QUARTER,until:q(1n,2n),position:ZERO}]))
    .toEqual([{position:ZERO,value:60}]);
  expect(lane.project([{ordinal:1,measureIndex:0,metricOffset:QUARTER,until:QUARTER,position:ZERO}])).toEqual([]);
  expectCode(() => lane.project([{ordinal:0,measureIndex:0,metricOffset:ONE,until:ZERO,position:ZERO}]), 'invalid-time');
});
