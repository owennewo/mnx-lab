import { performance } from 'node:perf_hooks';
import { hostname, cpus, platform, arch } from 'node:os';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { type Decision, type Emission, type Golden, type Listener, type Tempo, round } from '../types.ts';
import { validateDecisions } from '../validate.ts';
import type { Cost, RunReport } from '../report/index.ts';
export const RUNNER_VERSION = 'chunk-runner@1';
export const DELIVERY = { sampleRate: 48000, chunkSamples: 480 } as const;
export const machine = () => ({ hostname: hostname(), cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length, platform: platform(), arch: arch(), node: process.version });
/** The listener receives copies: neither its input buffer nor mutable emissions can
 * expose future audio or rewrite an earlier decision. Logical time is sample based. */
export function execute(factory: () => Listener, score: MnxStructure, tempo: Tempo, audio: Float32Array): { record: Decision[]; cost: Cost } {
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Intended score does not compile cleanly');
  if (!audio.length || !Number.isFinite(tempo.bpm) || tempo.bpm <= 0) throw new Error('Invalid runner input');
  const listener = factory(); const record: Decision[] = []; const timings: number[] = [];
  const initialization = performance.now(); listener.start(structuredClone(score), { ...tempo }, { ...DELIVERY });
  const initializationMs = performance.now() - initialization;
  let clock = 0, backlog = 0, maxBacklog = 0;
  const append = (emissions: Emission[]) => {
    for (const e of emissions) {
      const { id, kind, refersTo, madeAt: _untrustedClock, ...details } = structuredClone(e) as Decision;
      record.push({ id, kind, refersTo, madeAt: clock, ...details } as Decision);
    }
  };
  for (let from = 0; from < audio.length; from += DELIVERY.chunkSamples) {
    const until = Math.min(from + DELIVERY.chunkSamples, audio.length);
    clock = until / DELIVERY.sampleRate;
    const chunk = audio.slice(from, until); // subarray would expose the complete backing buffer
    const before = performance.now(); const emitted = listener.feed(chunk, clock); const ms = performance.now() - before;
    append(emitted); timings.push(ms);
    backlog = Math.max(0, backlog + ms - (until - from) / DELIVERY.sampleRate * 1000);
    maxBacklog = Math.max(maxBacklog, backlog);
  }
  const finishStart = performance.now(); const finished = listener.finish(); const finishMs = performance.now() - finishStart; append(finished);
  validateDecisions(record);
  const sorted = [...timings].sort((a, b) => a - b); const sum = timings.reduce((a, b) => a + b, 0);
  return { record, cost: { machine: machine(), ...DELIVERY, chunks: timings.length, audioSeconds: audio.length / DELIVERY.sampleRate,
    initializationMs: round(initializationMs), finishMs: round(finishMs),
    meanMs: round(sum / timings.length), p95Ms: round(sorted[Math.ceil(sorted.length * .95) - 1]!), p99Ms: round(sorted[Math.ceil(sorted.length * .99) - 1]!),
    sustainedRatio: round((sum + initializationMs + finishMs) / (audio.length / DELIVERY.sampleRate * 1000)), maxBacklogMs: round(maxBacklog), provisional: true } };
}
export interface Cut { seconds: number; kind: string }
export function prefixCuts(g: Golden): Cut[] {
  const notes = g.labels.notes;
  if (notes.length >= 2) return [
    { seconds: (notes[0]!.onset + notes[0]!.audibleEnd) / 2, kind: 'inside sounding note' },
    { seconds: notes[1]!.onset, kind: 'exact onset' },
    { seconds: (notes[0]!.audibleEnd + notes[1]!.onset) / 2, kind: 'inside silent gap' },
  ];
  // Silence has no sounding note or actual onset. Use counterfactual intended-beat
  // positions, labelled honestly; true-versus-silence futures are identical here.
  const beat = 60 / g.intended.tempo.bpm;
  return [{ seconds: beat / 4, kind: 'expected note (silence has no sounding note)' },
    { seconds: beat, kind: 'expected onset (silence has no onset)' },
    { seconds: beat * .75, kind: 'silent gap' }];
}
export function checkPrefix(factory: () => Listener, score: MnxStructure, tempo: Tempo, audio: Float32Array, cuts: Cut[]): NonNullable<RunReport['causality']>[number]['cuts'] {
  return cuts.map(cut => {
    const sample = Math.round(cut.seconds * DELIVERY.sampleRate);
    if (sample <= 0 || sample >= audio.length) throw new Error('Prefix cut must be internal');
    const changed = audio.slice(); changed.fill(0, sample);
    const trueRun = execute(factory, score, tempo, audio);
    const silenceRun = execute(factory, score, tempo, changed);
    const prefix = (r: Decision[]) => r.filter(d => d.madeAt <= sample / DELIVERY.sampleRate);
    return { seconds: sample / DELIVERY.sampleRate, kind: cut.kind, pass: JSON.stringify(prefix(trueRun.record)) === JSON.stringify(prefix(silenceRun.record)) };
  });
}
