import { type Following, rational } from '../types.ts';

/** Rung 1: tempo. Each example's tempo is constant within each eighth note and changes
 * only at eighth-note boundaries, so every label stays an exact straight line. Tempi are
 * whole BPM within 80–120% of the handed tempo, the contract's modest-variation envelope. */
export type TempoFamily = 'constant' | 'ramp' | 'drift';
export const SEGMENT_QUARTERS = 0.5;

/** mulberry32: a small, well-known deterministic generator. The seed is the provenance. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One whole-BPM tempo per eighth-note segment. */
export function tempoCurve(family: TempoFamily, seed: number, handedBpm: number, segments: number): number[] {
  const next = random(seed), low = 0.8, high = 1.2, between = (a: number, b: number) => a + (b - a) * next();
  let factors: number[];
  if (family === 'constant') { const f = between(low, high); factors = Array(segments).fill(f); }
  else if (family === 'ramp') { const a = between(low, high), b = between(low, high); factors = Array.from({ length: segments }, (_, k) => a + (b - a) * k / Math.max(1, segments - 1)); }
  else {
    const centre = between(0.9, 1.1), depth = Math.min(centre - low, high - centre), phase1 = between(0, 2 * Math.PI), phase2 = between(0, 2 * Math.PI);
    factors = Array.from({ length: segments }, (_, k) => {
      const x = k / segments;
      return centre + depth * (0.6 * Math.sin(2 * Math.PI * 1 * x + phase1) + 0.4 * Math.sin(2 * Math.PI * 2.5 * x + phase2));
    });
  }
  const min = Math.ceil(handedBpm * low), max = Math.floor(handedBpm * high);
  return factors.map(f => Math.max(min, Math.min(max, Math.round(handedBpm * f))));
}

/** Score quarter to sample, through the piecewise-constant tempo. */
export function timeMap(bpms: readonly number[], fromQuarter: number, sampleRate: number) {
  const starts = [0];
  for (const bpm of bpms) starts.push(starts.at(-1)! + SEGMENT_QUARTERS * 60 / bpm);
  const seconds = (quarter: number) => {
    const offset = quarter - fromQuarter, k = Math.min(bpms.length - 1, Math.max(0, Math.floor(offset / SEGMENT_QUARTERS + 1e-12)));
    return starts[k]! + (offset - k * SEGMENT_QUARTERS) * 60 / bpms[k]!;
  };
  return { seconds, toSample: (quarter: number) => Math.round(seconds(quarter) * sampleRate), segmentStarts: starts };
}

/** Exact following labels: one supported interval per tempo segment, each a straight
 * line from the segment's first quarter at that segment's tempo. */
export function tempoFollowing(bpms: readonly number[], fromQuarter: number, sampleRate: number, duration: number, answerableFrom: number, provenance: string): Following[] {
  const map = timeMap(bpms, fromQuarter, sampleRate);
  const boundary = (k: number) => k === bpms.length ? duration : Math.round(map.segmentStarts[k]! * sampleRate) / sampleRate;
  return bpms.map((bpm, k) => {
    const truth = { atStart: rational(2 * fromQuarter + k, 2), quartersPerSecond: rational(bpm, 60), route: 1 };
    return {
      start: boundary(k), end: boundary(k + 1), state: 'supported' as const,
      answerableFrom: k === 0 ? answerableFrom : boundary(k), route: 1,
      truth, admissible: [structuredClone(truth)], precision: { kind: 'exact' as const }, provenance,
    };
  });
}
