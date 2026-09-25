import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { add, compare, divide, rational } from '../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { toPerformed, toScorePosition, topOfScore } from '../positions.ts';

const score = (path: string) => JSON.parse(readFileSync(new URL(`../../../../scenarios/${path}/document.mnx.json`, import.meta.url), 'utf8')) as MnxStructure;

describe('positions in Studio\'s coordinate', () => {
  for (const id of ['spec/repeats-alternate-endings-simple', 'spec/jumps-dal-segno', 'spec/jumps-ds-al-fine', 'lab/40-navigation/02-repeats-and-marks-on-tab', 'lab/40-navigation/05-ds-final-ending']) {
    it(`round-trips every performed boundary and midpoint of ${id}`, () => {
      const compiled = compilePerformance(score(id));
      if (!compiled.ok) throw new Error('compile');
      const { performance } = compiled;
      const repeated = new Set(performance.measures.map(m => m.measureIndex)).size < performance.measures.length;
      expect(repeated).toBe(true);
      let checked = 0;
      for (const m of performance.measures) {
        for (const performed of [m.position, add(m.position, divide(m.duration, rational(2n))), add(m.position, m.duration)]) {
          const at = toScorePosition(performance, performed);
          if (!at.ok) throw new Error(at.diagnostic.message);
          const back = toPerformed(performance, at.value);
          if (!back.ok) throw new Error(back.diagnostic.message);
          expect(compare(back.value, performed)).toBe(0);
          checked++;
        }
      }
      expect(checked).toBe(3 * performance.measures.length);
      expect(toScorePosition(performance, performance.measures[0]!.position)).toEqual({ ok: true, value: topOfScore(performance) });
    });
  }

  it('gives a repeated bar a different ordinal on each pass', () => {
    const compiled = compilePerformance(score('lab/40-navigation/02-repeats-and-marks-on-tab'));
    if (!compiled.ok) throw new Error('compile');
    const { measures } = compiled.performance;
    const first = measures.find(m => m.occurrence === 1 && measures.some(n => n.measureIndex === m.measureIndex && n.occurrence === 2))!;
    const second = measures.find(m => m.measureIndex === first.measureIndex && m.occurrence === 2)!;
    const a = toScorePosition(compiled.performance, first.position), b = toScorePosition(compiled.performance, second.position);
    if (!a.ok || !b.ok) throw new Error('position');
    expect(a.value.ordinal).not.toBe(b.value.ordinal);
    expect(compare(a.value.metricOffset, b.value.metricOffset)).toBe(0);
  });
});
