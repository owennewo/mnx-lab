import { type Listener, type Tempo, rational } from '../types.ts';
export const CLOCK_VERSION = 'clock-follower@1';
/** Permanent floor: audio-ignoring, known start, no rejection or recovery logic. */
export function clockFollower(): Listener {
  let tempo: Tempo; let sampleRate: number; let id = 0;
  return {
    start(_score, handedTempo, delivery) { tempo = handedTempo; sampleRate = delivery.sampleRate; id = 0; },
    feed(_chunk, clock) {
      return [{ id: `clock-${++id}`, kind: 'position', refersTo: clock, confidence: 1,
        candidates: [{ position: { quarters: rational(Math.round(clock * sampleRate) * tempo.bpm, sampleRate * 60), route: 1 }, weight: 1 }] }];
    },
    finish() { return []; },
  };
}
