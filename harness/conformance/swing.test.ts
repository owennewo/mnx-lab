import { describe, expect, it } from 'vitest';
import { rational as q, ONE, ZERO } from '../../src/audio/time.ts';
import { createSwingMap, swingRuns } from '../../src/audio/swing.ts';
import { resolveSwing, resolveSwingTimeline } from '../../src/model/swing.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import type { MnxGlobalMeasure, MnxLabSwing, MnxStructure } from '../../src/model/mnx.ts';

const feel = (ratio: [number, number], base = 'eighth'): MnxLabSwing => ({ ratio, unit: { base } });
const resolved = (ratio: [number, number], base = 'eighth') => resolveSwing(feel(ratio, base))!;
const bar = (swing?: MnxLabSwing): MnxGlobalMeasure =>
  swing ? { _x: { mnxLab: { swing } } } : {};

describe('resolving a declaration', () => {
  it('reduces the ratio and prices the unit in whole notes', () => {
    expect(resolved([4, 2])).toMatchObject({ first: 2n, second: 1n, unit: [1n, 8n] });
    expect(resolved([3, 1], '16th').unit).toEqual([1n, 16n]);
    expect(resolveSwing({ ratio: [2, 1], unit: { base: 'quarter', dots: 1 } })!.unit).toEqual([3n, 8n]);
  });
  it('treats 1:1, a bad ratio and an unknown unit alike — nothing to warp', () => {
    for (const swing of [
      feel([1, 1]),
      feel([2, 2]),
      feel([0, 1]),
      feel([-2, 1]),
      { ratio: [2, 1], unit: { base: 'crotchet' } } as unknown as MnxLabSwing
    ])
      expect(resolveSwing(swing)).toBeNull();
  });
});

describe('a declaration persists until another changes it', () => {
  it('states the feel where it changes and prints it only there', () => {
    const timeline = resolveSwingTimeline([
      bar(feel([2, 1])),
      bar(),
      bar(feel([2, 1])), // restates what is already in force
      bar(feel([3, 1])),
      bar(feel([1, 1])) // cancels
    ]);
    expect(timeline.map(entry => entry.prints)).toEqual([true, false, false, true, true]);
    expect(timeline.map(entry => entry.swing?.first ?? null)).toEqual([2n, 2n, 2n, 3n, null]);
  });
});

describe('the warp', () => {
  it('redivides each pair and leaves the beat where it was', () => {
    const map = createSwingMap(resolved([2, 1]), ONE);
    expect(map.at(ZERO)).toEqual(ZERO);
    expect(map.at(q(1n, 8n))).toEqual(q(1n, 6n)); // 2/3 of the pair
    expect(map.at(q(1n, 4n))).toEqual(q(1n, 4n)); // the beat is a fixed point
    expect(map.at(ONE)).toEqual(ONE); // and so is the barline
  });
  it('matches Guitar Pro/alphaTab on all three named feels', () => {
    // Triplet8th = quarter-triplet + eighth-triplet; Dotted8th = dotted eighth
    // + sixteenth; Scottish8th is that pair the other way round.
    const halves = (ratio: [number, number]) => {
      const map = createSwingMap(resolved(ratio), ONE);
      return [map.at(q(1n, 8n)), map.at(q(1n, 4n))];
    };
    expect(halves([2, 1])).toEqual([q(1n, 6n), q(1n, 4n)]);
    expect(halves([3, 1])).toEqual([q(3n, 16n), q(1n, 4n)]);
    expect(halves([1, 3])).toEqual([q(1n, 16n), q(1n, 4n)]);
  });
  it('plays a bar’s leftover half-pair straight', () => {
    // 7/8: three swung pairs, then one eighth with no partner.
    const runs = swingRuns(resolved([2, 1]), q(7n, 8n));
    expect(runs).toHaveLength(7);
    expect(runs.at(-1)).toEqual({ from: q(3n, 4n), until: q(7n, 8n), scale: ONE });
    expect(createSwingMap(resolved([2, 1]), q(7n, 8n)).at(q(7n, 8n))).toEqual(q(7n, 8n));
  });
  it('is the identity when nothing swings', () => {
    const map = createSwingMap(null, ONE);
    expect(map.straight).toBe(true);
    expect(map.at(q(3n, 8n))).toEqual(q(3n, 8n));
  });
});

/** Eight eighth notes in one bar, optionally swung. */
function eighths(swing?: MnxLabSwing): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 }, ...bar(swing) }] },
    parts: [
      {
        measures: [
          {
            sequences: [
              {
                content: Array.from({ length: 8 }, () => ({
                  duration: { base: 'eighth' },
                  notes: [{ pitch: { step: 'C', octave: 4 } }]
                }))
              }
            ]
          }
        ]
      }
    ]
  } as unknown as MnxStructure;
}

describe('the compiler honours the feel', () => {
  const compile = (swing?: MnxLabSwing) => {
    const result = compilePerformance(eighths(swing));
    if (!result.ok) throw new Error('compilation failed');
    return result.performance;
  };

  it('moves the offbeats and keeps the bar exactly one whole note', () => {
    const straight = compile();
    const swung = compile(feel([2, 1]));
    expect(straight.written.map(w => w.position)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map(n => q(BigInt(n), 8n))
    );
    expect(swung.written.map(w => w.position)).toEqual([
      ZERO, q(1n, 6n), q(1n, 4n), q(5n, 12n), q(1n, 2n), q(2n, 3n), q(3n, 4n), q(11n, 12n)
    ]);
    expect(swung.written.map(w => w.duration)).toEqual(
      [1, 2, 1, 2, 1, 2, 1, 2].map(n => (n === 1 ? q(1n, 6n) : q(1n, 12n)))
    );
    // The written identities are untouched — a feel is how notes are PLAYED.
    expect(swung.written.map(w => w.metricOffset)).toEqual(
      straight.written.map(w => w.metricOffset)
    );
    expect(swung.written.map(w => w.metricDuration)).toEqual(
      straight.written.map(w => w.metricDuration)
    );
    expect(swung.measures[0].duration).toEqual(ONE);
  });

  it('splits the source map at every run edge and records the scale', () => {
    const swung = compile(feel([2, 1]));
    const segments = swung.sourceMap.filter(s => s.kind === 'metric');
    expect(segments).toHaveLength(8);
    expect(segments.map(s => (s.kind === 'metric' ? s.scale : null))).toEqual(
      [4, 2, 4, 2, 4, 2, 4, 2].map(n => (n === 4 ? q(4n, 3n) : q(2n, 3n)))
    );
    // Reading a played position back through the scale lands on the written
    // offset — the cursor's whole job.
    expect(segments.map(s => (s.kind === 'metric' ? s.metricOffset : null))).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map(n => q(BigInt(n), 8n))
    );
    expect(compile().sourceMap.filter(s => s.kind === 'metric')).toHaveLength(1);
  });

  it('leaves a straight document byte-identical to one that never mentions swing', () => {
    expect(compile(feel([1, 1]))).toEqual(compile());
  });
});
