import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { renderSines, scoreNotes, type RungZeroRecipe } from '../ladder/render.ts';
import { type Emission, type Listener, rational } from '../types.ts';
import { magnitudeSpectrum } from './spectralFollower1.ts';

/** Online time warping after Dixon (2005) and the score-following variant that aligns
 * against a rendering of the score: the reference is fully known, so each live frame
 * adds one row of a slope-constrained cumulative cost matrix, and the position is the
 * reference frame with the lowest length-normalised path cost. Features are log
 * semitone-band energies plus their positive frame-to-frame change, so note onsets
 * separate positions that sustained energy alone cannot. */
export const OLTW_1 = 'online-time-warp@1';

const DOWNSAMPLE = 4, RATE = 12000, WINDOW = 2048, HOP_CHUNKS = 2, CHUNK = 480;
export const HOP_SECONDS = HOP_CHUNKS * CHUNK / 48000;
const LOW_MIDI = 36, HIGH_MIDI = 96, BANDS = HIGH_MIDI - LOW_MIDI + 1;
const ONSET_WEIGHT = 2, SILENCE_RMS = 1e-4;
/** Support is claimed while the recent matching cost stays below this. Fixed before
 * any run; a different value is a new version. */
export const SUPPORT_THRESHOLD = 0.5, SUPPORT_TIME_CONSTANT = 0.3;

const bandOf = new Int16Array(WINDOW / 2).map((_, bin) => {
  if (bin === 0) return -1;
  const band = Math.round(69 + 12 * Math.log2(bin * RATE / WINDOW / 440)) - LOW_MIDI;
  return band >= 0 && band < BANDS ? band : -1;
});

export interface Frame { clock: number; rms: number; feature: Float64Array }

/** A causal feature stream: each frame uses only the WINDOW most recent downsampled
 * samples, zero before the audio began. */
export function featureStream() {
  const ring = new Float64Array(WINDOW);
  let written = 0, accumulated = 0, count = 0, chunks = 0;
  let previous = new Float64Array(BANDS);
  return (chunk: Float32Array, clock: number): Frame | null => {
    for (const x of chunk) { accumulated += x; if (++count % DOWNSAMPLE === 0) { ring[written++ % WINDOW] = accumulated / DOWNSAMPLE; accumulated = 0; } }
    if (++chunks % HOP_CHUNKS) return null;
    const window = Float64Array.from({ length: WINDOW }, (_, i) => ring[(written + i) % WINDOW]!);
    const rms = Math.sqrt(window.reduce((s, x) => s + x * x, 0) / WINDOW);
    const spectrum = magnitudeSpectrum(window);
    const level = new Float64Array(BANDS);
    for (let bin = 1; bin < spectrum.length; bin++) if (bandOf[bin]! >= 0) level[bandOf[bin]!]! += spectrum[bin]!;
    for (let k = 0; k < BANDS; k++) level[k] = Math.log1p(level[k]!);
    const norm = Math.hypot(...level);
    const feature = new Float64Array(2 * BANDS);
    if (norm > 0 && rms > SILENCE_RMS) {
      for (let k = 0; k < BANDS; k++) {
        feature[k] = level[k]! / norm;
        feature[BANDS + k] = ONSET_WEIGHT * Math.max(0, level[k]! - previous[k]!) / norm;
      }
      const all = Math.hypot(...feature);
      for (let k = 0; k < feature.length; k++) feature[k]! /= all;
    }
    previous = level;
    return { clock, rms, feature };
  };
}

export function frames(audio: Float32Array): Frame[] {
  const next = featureStream(), out: Frame[] = [];
  for (let from = 0; from < audio.length; from += CHUNK) {
    const frame = next(audio.slice(from, Math.min(from + CHUNK, audio.length)), Math.min(from + CHUNK, audio.length) / 48000);
    if (frame) out.push(frame);
  }
  return out;
}

export const cost = (a: Float64Array, b: Float64Array): number => {
  let dot = 0; for (let k = 0; k < a.length; k++) dot += a[k]! * b[k]!;
  return 1 - Math.max(0, Math.min(1, dot));
};

/** The listener's own reference: the intended score's first four measures, the scope
 * every candidate so far has used, rendered as sines at the handed tempo. */
export function referenceFrames(score: MnxStructure, bpm: number): { frames: Frame[]; quarters: number } {
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score must compile cleanly');
  const measures = compiled.performance.measures.slice(0, 4);
  if (!measures.length || measures.some(m => m.occurrence !== 1)) throw new Error('Initial four-measure route must be unambiguous');
  const quarters = measures.reduce((sum, m) => sum + 4 * Number(m.metricDuration.num) / Number(m.metricDuration.den), 0);
  const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm, fromQuarter: 0, toQuarter: quarters, sampleRate: 48000, peakDbfs: -12, rampSeconds: 0.01 };
  const audio = Float32Array.from(renderSines(scoreNotes(score, recipe), recipe), x => x / 32768);
  return { frames: frames(audio), quarters };
}

export function onlineTimeWarp1(): Listener {
  let reference: Frame[] = [], bpm = 0, quarters = 0, id = 0;
  let next = featureStream();
  let rowMinus2: Float64Array | null = null, rowMinus1: Float64Array | null = null, costMinus1: Float64Array | null = null;
  let rows = 0, best = 0, recent = 1, lastFrameClock = 0, supported = false;
  return {
    start(score, tempo, delivery) {
      if (delivery.sampleRate !== 48000 || delivery.chunkSamples !== CHUNK) throw new Error('Fixed delivery required');
      bpm = tempo.bpm;
      ({ frames: reference, quarters } = referenceFrames(score, bpm));
      next = featureStream(); rowMinus2 = rowMinus1 = costMinus1 = null;
      rows = 0; best = 0; recent = 1; lastFrameClock = 0; supported = false; id = 0;
    },
    feed(chunk, clock) {
      const frame = next(chunk, clock);
      if (frame) {
        lastFrameClock = clock;
        if (frame.rms <= SILENCE_RMS) supported = false;
        else {
          const n = reference.length, d = new Float64Array(n), row = new Float64Array(n).fill(Infinity);
          for (let j = 0; j < n; j++) d[j] = cost(frame.feature, reference[j]!.feature);
          for (let j = 0; j < n; j++) {
            if (rows === 0) { if (j === 0) row[0] = d[0]!; continue; }
            let value = Infinity;
            if (j >= 1) value = Math.min(value, rowMinus1![j - 1]! + 2 * d[j]!);
            if (j >= 1 && rowMinus2) value = Math.min(value, rowMinus2[j - 1]! + 2 * costMinus1![j]! + d[j]!);
            if (j >= 2) value = Math.min(value, rowMinus1![j - 2]! + 2 * d[j - 1]! + d[j]!);
            row[j] = value;
          }
          let score = Infinity;
          for (let j = 0; j < n; j++) { const normalised = row[j]! / (rows + j + 2); if (normalised < score) { score = normalised; best = j; } }
          const alpha = 1 - Math.exp(-HOP_SECONDS / SUPPORT_TIME_CONSTANT);
          recent = rows === 0 ? d[best]! : recent + alpha * (d[best]! - recent);
          supported = recent < SUPPORT_THRESHOLD;
          rowMinus2 = rowMinus1; rowMinus1 = row; costMinus1 = d; rows++;
        }
      }
      if (!supported || !rows) return [{ id: `oltw1-${++id}`, kind: 'unsupported', refersTo: clock, reason: rows ? 'weak score agreement or silence' : 'no audio yet' } satisfies Emission];
      const quarter = Math.min(quarters, (best + 1) * HOP_SECONDS * bpm / 60 + (clock - lastFrameClock) * bpm / 60);
      return [{ id: `oltw1-${++id}`, kind: 'position', refersTo: clock, confidence: Math.max(0, Math.min(1, 1 - recent)),
        candidates: [{ position: { quarters: rational(Math.round(quarter * 1e6), 1e6), route: 1 }, weight: 1 }] } satisfies Emission];
    },
    finish() { return []; },
  };
}
