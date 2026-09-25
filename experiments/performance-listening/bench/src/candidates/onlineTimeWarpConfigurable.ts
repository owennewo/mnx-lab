import { type Emission, type Listener, rational } from '../types.ts';
import { cost, featureStream, HOP_SECONDS, referenceFrames, type Frame } from './onlineTimeWarp1.ts';
import { MAXIMUM_GAP, MAXIMUM_PATH_COST, MINIMUM_FRAMES, SUPPORT_WINDOW_FRAMES } from './onlineTimeWarp2.ts';

/** Version 2's online time warping with its path and support choices made explicit, so
 * each later version changes exactly one of them. The default configuration reproduces
 * version 2 decision for decision (tested). */
export interface OltwConfig {
  /** Label used in decision ids. */
  label: string;
  /** How the current position is chosen among the path endpoints of the newest row.
   * normalised: lowest total cost divided by path length, over the whole history (v2).
   * recent: evidence fades with a time constant, so recent frames dominate. */
  endpoint: { kind: 'normalised' } | { kind: 'recent'; fadeSeconds: number };
  /** Allowed steps. p1: local tempo 1/2 to 2 times the handed tempo (v2). wide: 1/3 to 3. */
  steps: 'p1' | 'wide';
  /** gap: path cost within MAXIMUM_GAP of unconstrained matching (v2).
   * rank: the path's reference frames rank, on average, within the best `limit` fraction
   * of all reference frames for the same sound. Both also cap the path cost. */
  support: { kind: 'gap' } | { kind: 'rank'; limit: number };
  alwaysClaim?: boolean;
}
export const V2_CONFIG: OltwConfig = { label: 'oltw2', endpoint: { kind: 'normalised' }, steps: 'p1', support: { kind: 'gap' } };

/** A step: the predecessor offset and the local costs it adds, as (rows back, columns back,
 * weight); weights sum to the offset's length, so normalising by i + j stays consistent. */
interface Step { di: number; dj: number; cells: [number, number, number][] }
const P1: Step[] = [
  { di: 1, dj: 1, cells: [[0, 0, 2]] },
  { di: 2, dj: 1, cells: [[1, 0, 2], [0, 0, 1]] },
  { di: 1, dj: 2, cells: [[0, 1, 2], [0, 0, 1]] },
];
const WIDE: Step[] = [...P1,
  { di: 3, dj: 1, cells: [[2, 0, 2], [1, 0, 1], [0, 0, 1]] },
  { di: 1, dj: 3, cells: [[0, 2, 2], [0, 1, 1], [0, 0, 1]] },
];

interface Row { total: Float64Array; weight: Float64Array; local: Float64Array; step: Int8Array; free: number }

export function onlineTimeWarpWith(config: OltwConfig): Listener {
  const steps = config.steps === 'wide' ? WIDE : P1;
  const fade = config.endpoint.kind === 'recent' ? Math.exp(-HOP_SECONDS / config.endpoint.fadeSeconds) : 1;
  const keep = SUPPORT_WINDOW_FRAMES + 4;
  let reference: Frame[] = [], bpm = 0, quarters = 0, id = 0, next = featureStream();
  let history: Row[] = [], rows = 0, best = 0, lastFrameClock = 0, supported = false, pathCost = 1;
  const row = (k: number) => (k >= 0 && rows - k <= history.length) ? history[history.length - (rows - k)]! : null;
  return {
    start(score, tempo, delivery) {
      if (delivery.sampleRate !== 48000 || delivery.chunkSamples !== 480) throw new Error('Fixed delivery required');
      bpm = tempo.bpm;
      ({ frames: reference, quarters } = referenceFrames(score, bpm));
      next = featureStream(); history = []; rows = 0; best = 0; lastFrameClock = 0; supported = false; pathCost = 1; id = 0;
    },
    feed(chunk, clock) {
      const frame = next(chunk, clock);
      if (frame) {
        lastFrameClock = clock;
        if (frame.rms <= 1e-4) supported = false;
        else {
          const n = reference.length, local = new Float64Array(n), total = new Float64Array(n).fill(Infinity), weight = new Float64Array(n), step = new Int8Array(n);
          for (let j = 0; j < n; j++) local[j] = cost(frame.feature, reference[j]!.feature);
          const localAt = (back: number, j: number) => back === 0 ? local[j]! : row(rows - back)!.local[j]!;
          for (let j = 0; j < n; j++) {
            if (rows === 0) { if (j === 0) { total[0] = local[0]!; weight[0] = 1; } continue; }
            let bestValue = Infinity, bestStep = 0, bestWeight = 0;
            steps.forEach((s, index) => {
              const from = row(rows - s.di);
              if (!from || j < s.dj) return;
              let value = config.endpoint.kind === 'recent' ? fade ** s.di * from.total[j - s.dj]! : from.total[j - s.dj]!;
              let w = fade ** s.di * from.weight[j - s.dj]!;
              for (const [back, left, cw] of s.cells) { value += cw * localAt(back, j - left); w += cw; }
              if (value < bestValue) { bestValue = value; bestStep = index; bestWeight = w; }
            });
            total[j] = bestValue; step[j] = bestStep; weight[j] = bestWeight;
          }
          history.push({ total, weight, local, step, free: Math.min(...local) });
          if (history.length > keep) history.shift();
          let score = Infinity;
          for (let j = 0; j < n; j++) {
            const value = config.endpoint.kind === 'recent' ? total[j]! / weight[j]! : total[j]! / (rows + j + 2);
            if (value < score) { score = value; best = j; }
          }
          rows++;
          // Walk the chosen path back over the support window, one reference cell per live row.
          const window = Math.min(SUPPORT_WINDOW_FRAMES, rows);
          let k = rows - 1, j = best, pathSum = 0, freeSum = 0, rankSum = 0, counted = 0;
          const count = (r: Row, column: number) => {
            pathSum += r.local[column]!; freeSum += r.free; counted++;
            if (config.support.kind === 'rank') { let below = 0; for (const v of r.local) if (v < r.local[column]!) below++; rankSum += below / r.local.length; }
          };
          while (k >= rows - window && k >= 0 && j >= 0) {
            const r = row(k)!;
            count(r, j);
            const s = steps[r.step[j]!]!;
            if (k === 0) break;
            for (const [back, left] of s.cells) if (back > 0 && left === 0 && k - back >= rows - window) count(row(k - back)!, j);
            k -= s.di; j -= s.dj;
          }
          pathCost = pathSum / counted;
          const fits = config.support.kind === 'gap'
            ? pathCost - freeSum / counted <= MAXIMUM_GAP
            : rankSum / counted <= config.support.limit;
          supported = rows >= MINIMUM_FRAMES && (config.alwaysClaim === true || (fits && pathCost <= MAXIMUM_PATH_COST));
        }
      }
      if (!supported || !rows) return [{ id: `${config.label}-${++id}`, kind: 'unsupported', refersTo: clock, reason: rows < MINIMUM_FRAMES ? 'gathering evidence' : 'path does not fit the recent audio, or silence' } satisfies Emission];
      const quarter = Math.min(quarters, (best + 1) * HOP_SECONDS * bpm / 60 + (clock - lastFrameClock) * bpm / 60);
      return [{ id: `${config.label}-${++id}`, kind: 'position', refersTo: clock, confidence: Math.max(0, Math.min(1, 1 - pathCost)),
        candidates: [{ position: { quarters: rational(Math.round(quarter * 1e6), 1e6), route: 1 }, weight: 1 }] } satisfies Emission];
    },
    finish() { return []; },
  };
}
