import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { rational as exact } from '../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import type { Handoff } from '../../listen/contract.ts';
import { topOfScore } from '../../listen/positions.ts';
import { partIds } from '../../listen/validate.ts';
import { clockFollower } from '../src/candidates/clockFollower.ts';
import { onlineTimeWarp2 } from '../src/candidates/onlineTimeWarp2.ts';
import { spectralFollower1 } from '../src/candidates/spectralFollower1.ts';
import { mixSines, windowNotes } from '../src/ladder/render.ts';
import { execute } from '../src/run/runner.ts';
import { legacyListener } from '../src/seam/legacy.ts';
import { toV1Record } from '../src/seam/records.ts';
import { executeSeam } from '../src/seam/runner.ts';
import type { Listener } from '../src/types.ts';

const source = (name: string) => JSON.parse(readFileSync(new URL(`../../sources/${name}`, import.meta.url), 'utf8')) as MnxStructure;
const scenario = (path: string) => JSON.parse(readFileSync(new URL(`../../../../scenarios/${path}/document.mnx.json`, import.meta.url), 'utf8')) as MnxStructure;
const scale = source('s2-two-bar-scale.mnx.json');
const performanceOf = (score: MnxStructure) => { const c = compilePerformance(score); if (!c.ok) throw new Error('compile'); return c.performance; };
const handoffFor = (score: MnxStructure, bpm = 60): Handoff => ({ from: topOfScore(performanceOf(score)), parts: partIds(score), tempo: { quartersPerMinute: exact(BigInt(bpm)) }, rate: 1 });
const toSample = (q: number) => Math.round(q * 48000);
const audio = Float32Array.from(mixSines(windowNotes(scale, 0, 8, toSample, toSample(8), 480), toSample(8), -12, 480, 48000), x => x / 32768);
const DELIVERY = { sampleRate: 48000, chunkSamples: 480 };
const LEGACY: [string, () => Listener, number | null][] = [['clock', clockFollower, null], ['spectral@1', spectralFollower1, 4], ['oltw@2', () => onlineTimeWarp2(), 4]];

describe('a legacy candidate through the seam', () => {
  for (const [name, factory, windowMeasures] of LEGACY) it(`reproduces ${name}'s version-1 record exactly`, () => {
    const direct = execute(factory, scale, { bpm: 60, unit: 'quarter' }, audio).record;
    const stats = { clamped: 0, droppedNotes: 0 };
    const seam = executeSeam(legacyListener(factory, { windowMeasures }, stats), scale, handoffFor(scale), audio, DELIVERY);
    expect(seam.started).toEqual({ ok: true });
    expect(stats.clamped).toBe(0);
    expect(toV1Record(performanceOf(scale), seam.record)).toEqual(direct);
  }, 60_000);

  it('refuses, with a reason, every handoff field it cannot honour', () => {
    const wrap = legacyListener(() => onlineTimeWarp2(), { windowMeasures: 4 });
    const refused = (score: MnxStructure, handoff: Handoff, delivery = DELIVERY) => {
      const r = executeSeam(wrap, score, handoff, audio, delivery).started;
      return r.ok ? null : r.refused;
    };
    const top = handoffFor(scale), perf = performanceOf(scale);
    expect(refused(scale, { ...top, from: { ordinal: 1, metricOffset: perf.measures[1]!.from } })).toMatch(/top of the score/);
    expect(refused(scale, { ...top, parts: [] })).toMatch(/every part/);
    expect(refused(scale, { ...top, tempo: { quartersPerMinute: exact(121n, 2n) } })).toMatch(/whole-number tempo/);
    expect(refused(scale, top, { sampleRate: 44100, chunkSamples: 128 })).toMatch(/48 kHz/);
    const repeats = scenario('lab/40-navigation/02-repeats-and-marks-on-tab');
    expect(refused(repeats, handoffFor(repeats))).toMatch(/repeat/);
    const clock = executeSeam(legacyListener(clockFollower, { windowMeasures: null }), repeats, handoffFor(repeats), audio, DELIVERY);
    expect(clock.started).toEqual({ ok: true });
  }, 60_000);
});
