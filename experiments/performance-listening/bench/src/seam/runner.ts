/** Delivers audio to a version-2 listener at any declared rate and block size, stamping
 * each decision with the clock at which the block that produced it ended. At 48 kHz in
 * 480-sample chunks it delivers exactly what the version-1 runner delivers. */
import { performance as timer } from 'node:perf_hooks';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Decision, Delivery, Handoff, Listener, StartResult } from '../../../listen/contract.ts';
import { validateRecord } from '../../../listen/validate.ts';
import { machine } from '../run/runner.ts';
import type { Cost } from '../report/index.ts';
import { round } from '../types.ts';

export type SeamRun = { started: StartResult; record: Decision[]; cost: Cost | null };

export function executeSeam(factory: () => Listener, score: MnxStructure, handoff: Handoff, audio: Float32Array, delivery: Delivery): SeamRun {
  const listener = factory(), record: Decision[] = [], timings: number[] = [];
  const initialization = timer.now();
  const started = listener.start(structuredClone(score), structuredClone(handoff), { ...delivery });
  const initializationMs = timer.now() - initialization;
  if (!started.ok) return { started, record, cost: null };
  let clock = 0, backlog = 0, maxBacklog = 0;
  const append = (emissions: ReturnType<Listener['feed']>) => {
    for (const e of emissions) { const { madeAt: _untrusted, ...rest } = structuredClone(e) as Decision; record.push({ ...rest, madeAt: clock } as Decision); }
  };
  for (let from = 0; from < audio.length; from += delivery.chunkSamples) {
    const until = Math.min(from + delivery.chunkSamples, audio.length);
    clock = until / delivery.sampleRate;
    const before = timer.now(); const emitted = listener.feed(audio.slice(from, until), clock); const ms = timer.now() - before;
    append(emitted); timings.push(ms);
    backlog = Math.max(0, backlog + ms - (until - from) / delivery.sampleRate * 1000); maxBacklog = Math.max(maxBacklog, backlog);
  }
  const finishStart = timer.now(); const finished = listener.finish(); const finishMs = timer.now() - finishStart; append(finished);
  validateRecord(record);
  const sorted = [...timings].sort((a, b) => a - b), sum = timings.reduce((a, b) => a + b, 0);
  return { started, record, cost: { machine: machine(), sampleRate: delivery.sampleRate, chunkSamples: delivery.chunkSamples, chunks: timings.length, audioSeconds: audio.length / delivery.sampleRate,
    initializationMs: round(initializationMs), finishMs: round(finishMs),
    meanMs: round(sum / timings.length), p95Ms: round(sorted[Math.ceil(sorted.length * .95) - 1]!), p99Ms: round(sorted[Math.ceil(sorted.length * .99) - 1]!),
    sustainedRatio: round((sum + initializationMs + finishMs) / (audio.length / delivery.sampleRate * 1000)), maxBacklogMs: round(maxBacklog), provisional: true } };
}

/** Prefix invariance through the seam: the same audio prefix with a different future must
 * yield the same decisions up to the prefix. */
export function seamCausality(factory: () => Listener, score: MnxStructure, handoff: Handoff, audio: Float32Array, delivery: Delivery, record: readonly Decision[]) {
  const checks = [];
  for (const fraction of [0.25, 0.5, 0.75]) for (const kind of ['silence', 'alternating'] as const) {
    const sample = Math.floor(audio.length * fraction), future = audio.slice();
    for (let i = sample; i < future.length; i++) future[i] = kind === 'silence' ? 0 : (i % 2 ? 0.125 : -0.125);
    const changed = executeSeam(factory, score, handoff, future, delivery).record;
    const prefix = (r: readonly Decision[]) => JSON.stringify(r.filter(d => d.madeAt <= sample / delivery.sampleRate), (_, v) => typeof v === 'bigint' ? v.toString() : v);
    checks.push({ fraction, kind, pass: prefix(record) === prefix(changed) });
  }
  return checks;
}
