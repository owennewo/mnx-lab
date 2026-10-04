/** Hand-oracle adapter. Independent audit is deliberately not asserted here. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENT, sha256 } from '../io.ts';
import { resamplePrefix, localFrameTime } from './native.ts';
import { resampledLength, interpolation, batch, completedAt, reducePitch, offlineTrim, offlineFrame, decoderTime } from './observation2.ts';
export type HandCase = { id: string; op: string; input: Record<string, unknown>; expected: unknown; arithmetic: string };
export function readObservationOracle2(): HandCase[] {
  const bytes = readFileSync(join(EXPERIMENT, 'bench/oracle-events/observation-seam-2.json'));
  const freeze = JSON.parse(readFileSync(join(EXPERIMENT, 'bench/oracle-events/freeze-observation-seam-2.json'), 'utf8'));
  if (sha256(bytes) !== freeze.sha256) throw new Error('Frozen observation oracle changed');
  const oracle = JSON.parse(bytes.toString());
  if (oracle.cases.length !== freeze.cases || new Set(oracle.cases.map((c: HandCase) => c.id)).size !== freeze.cases) throw new Error('Invalid oracle cases');
  return oracle.cases;
}
export function handValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(handValue);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if ('numerator' in object && 'denominator' in object) return (object.numerator as number) / (object.denominator as number);
    return Object.fromEntries(Object.entries(object).map(([key, v]) => [key, handValue(v)]));
  }
  return value;
}
export function agrees(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') return Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-12;
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.length === expected.length && actual.every((x, i) => agrees(x, expected[i]));
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const a = actual as Record<string, unknown>, e = expected as Record<string, unknown>;
    return Object.keys(a).length === Object.keys(e).length && Object.keys(e).every(key => key in a && agrees(a[key], e[key]));
  }
  return actual === expected;
}
export function evaluateHandCase(c: HandCase): unknown {
  const v = c.input, n = (key: string) => v[key] as number;
  switch (c.op) {
    case 'resample': return resampledLength(n('samples'));
    case 'interpolate': return interpolation(n('samples'), n('j'));
    case 'batch': return batch(n('samples'), n('edge') as 0 | 15, v.last as number | null, n('previous'), n('costMs'));
    case 'cadence': return n('samples') >= n('nextSamples');
    case 'waiting': return n('nextDelivery') - n('onset');
    case 'clock': return completedAt(n('delivery'), n('previous'), n('costMs') / 1000);
    case 'pitch': {
      const note = Array<number>(88).fill(0);
      for (const [bin, value] of Object.entries(v.bins as Record<string, number>)) note[Number(bin)] = value;
      return reducePitch(note);
    }
    case 'trim': return offlineTrim(n('length'), n('windows'));
    case 'offline': return offlineFrame(n('index'));
    case 'eventTimes': return { onset: decoderTime(n('onsetIndex')), end: decoderTime(n('endIndex')) };
    default: throw new Error(`Unknown hand case operation: ${c.op}`);
  }
}
export function checkHandCase(c: HandCase) {
  const actual = evaluateHandCase(c), expected = handValue(c.expected);
  return { id: c.id, op: c.op, actual, expected, agrees: agrees(actual, expected), arithmetic: c.arithmetic };
}
export function legacyChecks(cases: readonly HandCase[]) {
  return cases.filter(c => ['resample', 'interpolate', 'batch'].includes(c.op)).map(c => {
    const samples = c.input.samples as number, audio = Array.from({ length: samples }, (_, i) => i);
    const resampled = resamplePrefix(audio, 0), expected = handValue(c.expected);
    let actual: unknown;
    if (c.op === 'resample') actual = resampled.length;
    else if (c.op === 'interpolate') {
      const j = c.input.j as number;
      actual = j < resampled.length ? { exists: true, left: Math.floor(j * 320 / 147), right: Math.floor(j * 320 / 147) + 1, value: resampled[j] } : { exists: false };
    } else {
      const e = expected as { indices: number[]; coordinates: number[] };
      // Legacy grid only: old runner's nominal availableAt is intentionally not reused.
      actual = e.indices.map(j => localFrameTime(resampled.length - 43844, j));
      return { id: c.id, agrees: agrees(actual, e.coordinates.map(q => q / 22050)), actual, expected: e.coordinates.map(q => q / 22050) };
    }
    return { id: c.id, agrees: agrees(actual, expected), actual, expected };
  });
}
export function faultProbes(cases: readonly HandCase[]) {
  const probe = (family: string, id: string, actual: unknown) => {
    const c = cases.find(c => c.id === id)!;
    return { family, id, actual, expected: handValue(c.expected), detected: !agrees(actual, handValue(c.expected)) };
  };
  const b = batch(9600, 0, 2137, .145, 45);
  const equalityIndices = Array.from({ length: 17 }, (_, i) => 155 + i);
  const f = offlineFrame(344);
  return [
    probe('index-as-count', 'R1', Math.ceil(321 * 147 / 320)),
    probe('equality-only-watermark', 'L2', { ...b, indices: equalityIndices, coordinates: equalityIndices.map(j => 4410 - 43844 + j * 256) }),
    probe('omitted-compute', 'C1', .1),
    probe('omitted-backlog', 'C3', .2 + .06),
    probe('last-bin-tie', 'P2', { midi: 62, confidence: .8, kind: 'pitched' }),
    probe('below-threshold-pitch', 'P5', { midi: 60, confidence: .299, kind: 'pitched' }),
    probe('exact-hop-trim', 'O1', { retained: Math.floor(1323000 / 256), available: 5254, discardedTail: 5254 - Math.floor(1323000 / 256) }),
    probe('missing-stitched-reset', 'O6', { ...f, decoderTime: 344 * 256 / 22050, difference: 376 / 22050 }),
  ];
}
