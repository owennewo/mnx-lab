import { type Emission, type Listener, rational } from '../types.ts';
import { cost, featureStream, HOP_SECONDS, referenceFrames, type Frame } from './onlineTimeWarp1.ts';

/** Version 2 keeps version 1's features, reference and alignment unchanged and replaces
 * its support test. Version 1 averaged the matching cost of single frames, which a
 * different piece can satisfy with shared sustained notes. Version 2 asks whether the
 * recent stretch of the tempo-consistent path fits nearly as well as the best
 * frame-by-frame matches anywhere in the reference: a different piece can match single
 * frames, but not in order. Comparing the two costs also cancels a uniform rise in
 * cost, such as a timbre mismatch. */
export const OLTW_2 = 'online-time-warp@2';

/** Fixed before any run; a different value is a new version. */
export const SUPPORT_WINDOW_FRAMES = 50;  // 1 s of 20 ms frames
export const MINIMUM_FRAMES = 10;         // 0.2 s of evidence before any claim
export const MAXIMUM_GAP = 0.1;           // path cost may exceed the free cost by this
export const MAXIMUM_PATH_COST = 0.7;     // and must stay a plausible match at all

const DIAGONAL = 0, SKIP_LIVE = 1; // step 2 skips a reference frame

/** alwaysClaim is a diagnostic, not a candidate: it reports the aligned position on every
 * audible frame, ignoring the support test, so alignment accuracy can be measured apart
 * from the support decision. The default behaviour is the frozen candidate. */
export function onlineTimeWarp2(options: { alwaysClaim?: boolean } = {}): Listener {
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
      ({ frames: reference, quarters } = referenceFrames(score, bpm));
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
      if (!supported || !rows) return [{ id: `oltw2-${++id}`, kind: 'unsupported', refersTo: clock, reason: rows < MINIMUM_FRAMES ? 'gathering evidence' : 'path does not fit the recent audio, or silence' } satisfies Emission];
      const quarter = Math.min(quarters, (best + 1) * HOP_SECONDS * bpm / 60 + (clock - lastFrameClock) * bpm / 60);
      return [{ id: `oltw2-${++id}`, kind: 'position', refersTo: clock, confidence: Math.max(0, Math.min(1, 1 - pathCost)),
        candidates: [{ position: { quarters: rational(Math.round(quarter * 1e6), 1e6), route: 1 }, weight: 1 }] } satisfies Emission];
    },
    finish() { return []; },
  };
}
