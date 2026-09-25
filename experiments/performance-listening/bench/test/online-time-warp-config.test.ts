import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { onlineTimeWarp2 } from '../src/candidates/onlineTimeWarp2.ts';
import { onlineTimeWarpWith, V2_CONFIG } from '../src/candidates/onlineTimeWarpConfigurable.ts';
import { mixSines, windowNotes } from '../src/ladder/render.ts';
import { tempoCurve, timeMap } from '../src/ladder/tempo.ts';
import { execute } from '../src/run/runner.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../sources/${name}`, import.meta.url), 'utf8')) as MnxStructure;
const scale = read('s2-two-bar-scale.mnx.json'), oneBar = read('s1-one-bar-c4-f4.mnx.json');
const render = (bpms: number[]) => {
  const map = timeMap(bpms, 0, 48000), length = Math.ceil(map.toSample(8) / 3) * 3;
  return Float32Array.from(mixSines(windowNotes(scale, 0, 8, map.toSample, map.toSample(8), 480), length, -12, 480, 48000), x => x / 32768);
};

describe('the configurable online time warping', () => {
  it('reproduces version 2 decision for decision under the default configuration', () => {
    const tempo = { bpm: 60, unit: 'quarter' } as const;
    const cases: [MnxStructure, Float32Array][] = [
      [scale, render(Array(16).fill(60))], [scale, render(tempoCurve('drift', 5, 60, 16))], [oneBar, render(tempoCurve('ramp', 3, 60, 16))],
    ];
    for (const [score, audio] of cases) for (const alwaysClaim of [false, true]) {
      const v2 = execute(() => onlineTimeWarp2({ alwaysClaim }), score, tempo, audio).record;
      const same = execute(() => onlineTimeWarpWith({ ...V2_CONFIG, alwaysClaim }), score, tempo, audio).record;
      expect(same).toEqual(v2);
    }
  }, 120_000);

  it('runs every variation on the same audio without error', () => {
    const tempo = { bpm: 60, unit: 'quarter' } as const, audio = render(tempoCurve('ramp', 4, 60, 16));
    for (const config of [
      { ...V2_CONFIG, endpoint: { kind: 'recent' as const, fadeSeconds: 1 } },
      { ...V2_CONFIG, steps: 'wide' as const },
      { ...V2_CONFIG, support: { kind: 'rank' as const, limit: 0.1 } },
    ]) expect(execute(() => onlineTimeWarpWith(config), scale, tempo, audio).record.length).toBeGreaterThan(0);
  }, 60_000);
});
