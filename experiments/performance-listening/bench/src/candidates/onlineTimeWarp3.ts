import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { maxPolyphony, scoreNotes, type RungZeroRecipe } from '../ladder/render.ts';
import { type Emission, type Listener, rational } from '../types.ts';
import { cost, featureStream, frames, HOP_SECONDS, type Frame } from './onlineTimeWarp1.ts';
import { MAXIMUM_GAP, MAXIMUM_PATH_COST, MINIMUM_FRAMES, SUPPORT_WINDOW_FRAMES } from './onlineTimeWarp2.ts';

/** Version 3 changes one thing from version 2: the listener's reference. Version 2
 * rendered each note as a sine held at full level until its score end; a plucked string
 * decays, and experiment 008 found the alignment slipping exactly where sustained bass
 * notes decay. Here each reference note decays exponentially from its onset with one
 * fixed time constant. Features, alignment and support test are version 2's, unchanged. */
export const OLTW_3 = 'online-time-warp@3';

/** The median decay time constant of the samples Winner's notes use in the four
 * development guitar sets (tsx src/ladder/decay.ts), fixed before any run of version 3. */
export const DECAY_SECONDS = 0.58;

/** The first four measures, every note a sine decaying from its onset, at the handed tempo. */
export function renderPlucked(score: MnxStructure, bpm: number): { audio: Float32Array; quarters: number } {
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score must compile cleanly');
  const measures = compiled.performance.measures.slice(0, 4);
  if (!measures.length || measures.some(m => m.occurrence !== 1)) throw new Error('Initial four-measure route must be unambiguous');
  const quarters = measures.reduce((sum, m) => sum + 4 * Number(m.metricDuration.num) / Number(m.metricDuration.den), 0);
  const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm, fromQuarter: 0, toQuarter: quarters, sampleRate: 48000, peakDbfs: -12, rampSeconds: 0.01 };
  const notes = scoreNotes(score, recipe), length = Math.round(quarters * 60 / bpm * 48000);
  const mix = new Float64Array(length), level = 10 ** (-12 / 20) / maxPolyphony(notes), ramp = 480;
  for (const n of notes) for (let i = n.fromSample; i < n.toSample; i++) {
    const elapsed = i - n.fromSample;
    const envelope = Math.min(1, elapsed / ramp, (n.toSample - i) / ramp) * Math.exp(-elapsed / 48000 / DECAY_SECONDS);
    mix[i]! += level * envelope * Math.sin(2 * Math.PI * n.hz * elapsed / 48000);
  }
  return { audio: Float32Array.from(mix, x => Math.round(32767 * x) / 32768), quarters };
}

export function pluckedReferenceFrames(score: MnxStructure, bpm: number): { frames: Frame[]; quarters: number } {
  const { audio, quarters } = renderPlucked(score, bpm);
  return { frames: frames(audio), quarters };
}

const DIAGONAL = 0, SKIP_LIVE = 1; // step 2 skips a reference frame

/** alwaysClaim is a diagnostic, not a candidate: it reports the aligned position on every
 * audible frame, ignoring the support test. */
export function onlineTimeWarp3(options: { alwaysClaim?: boolean } = {}): Listener {
  let reference: Frame[] = [], bpm = 0, quarters = 0, id = 0;
  let next = featureStream();
  // Recent rows: cumulative cost, local cost, chosen step and the free (best) local cost.
  let history: { total: Float64Array; local: Float64Array; step: Int8Array; free: number }[] = [];
  let rows = 0, best = 0, lastFrameClock = 0, supported = false, pathCost = 1;
  const row = (k: number) => history[history.length - (rows - k)]!;
  return {
    start(score, tempo, delivery) {
      if (delivery.sampleRate !== 48000 || delivery.chunkSamples !== 480) throw new Error('Fixed delivery required');
      bpm = tempo.bpm;
      ({ frames: reference, quarters } = pluckedReferenceFrames(score, bpm));
      next = featureStream(); history = [];
      rows = 0; best = 0; lastFrameClock = 0; supported = false; pathCost = 1; id = 0;
    },
    feed(chunk, clock) {
      const frame = next(chunk, clock);
      if (frame) {
        lastFrameClock = clock;
        if (frame.rms <= 1e-4) supported = false;
        else {
          const n = reference.length, local = new Float64Array(n), total = new Float64Array(n).fill(Infinity), step = new Int8Array(n);
          for (let j = 0; j < n; j++) local[j] = cost(frame.feature, reference[j]!.feature);
          const previous = rows >= 1 ? row(rows - 1) : null, beforeThat = rows >= 2 ? row(rows - 2) : null;
          for (let j = 0; j < n; j++) {
            if (!previous) { if (j === 0) total[0] = local[0]!; continue; }
            const options = [
              j >= 1 ? previous.total[j - 1]! + 2 * local[j]! : Infinity,
              j >= 1 && beforeThat ? beforeThat.total[j - 1]! + 2 * previous.local[j]! + local[j]! : Infinity,
              j >= 2 ? previous.total[j - 2]! + 2 * local[j - 1]! + local[j]! : Infinity,
            ];
            const choice = options.indexOf(Math.min(...options));
            total[j] = options[choice]!; step[j] = choice;
          }
          history.push({ total, local, step, free: Math.min(...local) });
          if (history.length > SUPPORT_WINDOW_FRAMES + 2) history.shift();
          let score = Infinity;
          for (let j = 0; j < n; j++) { const normalised = total[j]! / (rows + j + 2); if (normalised < score) { score = normalised; best = j; } }
          rows++;
          // Walk the optimal path back over the support window, one reference cell per live row.
          const window = Math.min(SUPPORT_WINDOW_FRAMES, rows);
          let k = rows - 1, j = best, pathSum = 0, freeSum = 0, counted = 0;
          while (k >= rows - window && k >= 0 && j >= 0) {
            const r = row(k);
            pathSum += r.local[j]!; freeSum += r.free; counted++;
            const s = r.step[j]!;
            if (k === 0) break;
            if (s === DIAGONAL) { k -= 1; j -= 1; }
            else if (s === SKIP_LIVE) {
              if (k - 1 >= rows - window) { const between = row(k - 1); pathSum += between.local[j]!; freeSum += between.free; counted++; }
              k -= 2; j -= 1;
            } else { k -= 1; j -= 2; }
          }
          pathCost = pathSum / counted;
          const gap = pathCost - freeSum / counted;
          supported = rows >= MINIMUM_FRAMES && (options.alwaysClaim === true || (gap <= MAXIMUM_GAP && pathCost <= MAXIMUM_PATH_COST));
        }
      }
      if (!supported || !rows) return [{ id: `oltw3-${++id}`, kind: 'unsupported', refersTo: clock, reason: rows < MINIMUM_FRAMES ? 'gathering evidence' : 'path does not fit the recent audio, or silence' } satisfies Emission];
      const quarter = Math.min(quarters, (best + 1) * HOP_SECONDS * bpm / 60 + (clock - lastFrameClock) * bpm / 60);
      return [{ id: `oltw3-${++id}`, kind: 'position', refersTo: clock, confidence: Math.max(0, Math.min(1, 1 - pathCost)),
        candidates: [{ position: { quarters: rational(Math.round(quarter * 1e6), 1e6), route: 1 }, weight: 1 }] } satisfies Emission];
    },
    finish() { return []; },
  };
}
