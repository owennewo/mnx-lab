import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational, type Emission, type Listener } from '../types.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from './onlineTimeWarp2.ts';
import { HOP_SECONDS } from './onlineTimeWarp1.ts';
import { onlineTimeWarpWith, type SupportTrace, V2_CONFIG } from './onlineTimeWarpConfigurable.ts';

export const OLTW_12 = 'online-time-warp@12';
export const TRAJECTORY_WINDOW_SECONDS = 2, SLOPE_SPAN_FRAMES = 25;
export const RANK_WINDOW_SECONDS = 2, RANK_LIMIT = .20;
export interface TrajectorySample { clock: number; quarter: number }
export interface RobustTrajectoryTrace { clock: number; path: SupportTrace; windowRank: number; supported: boolean; rawQuarter: number; fittedQuarter: number; speed: number }
const median = (values: number[]) => {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
};

/** Causal robust line through a recent raw trajectory. Half-second displacement
 * slopes estimate speed; median intercept suppresses brief endpoint excursions.
 * Absolute audio time and handed tempo do not supply the intercept. */
export function robustTrajectory(samples: readonly TrajectorySample[], nominalSpeed: number): { quarter: number; speed: number } {
  const last = samples.at(-1)!;
  if (samples.length <= SLOPE_SPAN_FRAMES) return { quarter: last.quarter, speed: nominalSpeed };
  const slopes: number[] = [];
  for (let i = SLOPE_SPAN_FRAMES; i < samples.length; i++) {
    const a = samples[i - SLOPE_SPAN_FRAMES]!, z = samples[i]!;
    slopes.push((z.quarter - a.quarter) / (z.clock - a.clock));
  }
  const speed = Math.max(.5 * nominalSpeed, Math.min(2 * nominalSpeed, median(slopes)));
  return { quarter: median(samples.map(p => p.quarter + speed * (last.clock - p.clock))), speed };
}

/** One change from v8: emitted position is a robust causal fit of raw endpoints.
 * The raw DP path and v8 support calibration are never fed the fitted position. */
export function onlineTimeWarp12(options: { alwaysClaim?: boolean; trace?: (frame: RobustTrajectoryTrace) => void } = {}): Listener {
  let latest: SupportTrace | null = null, recent: { clock: number; rank: number }[] = [], supported = false;
  let samples: TrajectorySample[] = [], nominalSpeed = 0, quarters = 0, fitted = { quarter: 0, speed: 0 }, fittedAt = 0;
  const path = onlineTimeWarpWith({ ...V2_CONFIG, label: 'oltw12', support: { kind: 'rank', limit: .1 }, alwaysClaim: true, trace: f => { latest = f; } });
  return {
    start(score, tempo, delivery) {
      latest = null; recent = []; samples = []; supported = false; nominalSpeed = tempo.bpm / 60; fitted = { quarter: 0, speed: nominalSpeed }; fittedAt = 0;
      const compiled = compilePerformance(score);
      if (!compiled.ok) throw new Error('Score must compile');
      quarters = compiled.performance.measures.slice(0, 4).reduce((sum, m) => sum + 4 * Number(m.metricDuration.num) / Number(m.metricDuration.den), 0);
      path.start(score, tempo, delivery);
    },
    feed(chunk, clock) {
      const emissions = path.feed(chunk, clock);
      if (latest?.clock === clock) {
        recent.push({ clock, rank: latest.meanRank! });
        while (recent[0]!.clock < clock - RANK_WINDOW_SECONDS + 1e-9) recent.shift();
        const windowRank = recent.reduce((s, r) => s + r.rank, 0) / recent.length;
        supported = latest.rows >= MINIMUM_FRAMES && windowRank <= RANK_LIMIT && latest.pathCost <= MAXIMUM_PATH_COST;
        const rawQuarter = Math.min(quarters, (latest.best + 1) * HOP_SECONDS * nominalSpeed);
        samples.push({ clock, quarter: rawQuarter });
        while (samples[0]!.clock < clock - TRAJECTORY_WINDOW_SECONDS + 1e-9) samples.shift();
        fitted = robustTrajectory(samples, nominalSpeed); fittedAt = clock;
        options.trace?.({ clock, path: latest, windowRank, supported, rawQuarter, fittedQuarter: fitted.quarter, speed: fitted.speed });
      }
      return emissions.map((e): Emission => {
        if (e.kind !== 'position') return e;
        if (!supported && !options.alwaysClaim) return { id: e.id, kind: 'unsupported', refersTo: e.refersTo,
          reason: 'the raw path rank or cost does not support following' };
        const quarter = Math.max(0, Math.min(quarters, fitted.quarter + (clock - fittedAt) * fitted.speed));
        return { ...e, candidates: e.candidates.map(c => ({ ...c, position: { ...c.position, quarters: rational(Math.round(quarter * 1e6), 1e6) } })) };
      });
    },
    finish() { path.finish(); return []; },
  };
}
