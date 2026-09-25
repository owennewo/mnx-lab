/** Wraps a version-1 candidate as a version-2 listener without changing it. The candidate
 * runs exactly as it always has; the adapter refuses at start whatever it cannot honour,
 * and converts each emitted position from performed quarters to Studio's ScorePosition. */
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { Performance } from '../../../../../src/audio/performanceTypes.ts';
import { add, compare, rational as exact } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Delivery, Emission, Handoff, Listener, ScorePosition, StartResult } from '../../../listen/contract.ts';
import { samePosition, toScorePosition, topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import type { Emission as V1Emission, Listener as V1Listener } from '../types.ts';

export interface LegacyAbilities {
  /** How many performed measures from the top the candidate models; null for the whole score. */
  windowMeasures: number | null;
}
export interface LegacyStats { clamped: number; droppedNotes: number }

const V1_DELIVERY = { sampleRate: 48000, chunkSamples: 480 } as const;

/** Performed quarters as a ScorePosition. A claim past the end of the performance, which
 * only the audio-ignoring clock makes, is held at the final boundary and counted. */
export function quartersToScorePosition(performance: Performance, quarters: { num: number; den: number }, stats?: LegacyStats): ScorePosition {
  const performed = exact(BigInt(quarters.num), 4n * BigInt(quarters.den));
  const at = toScorePosition(performance, performed);
  if (at.ok) return at.value;
  const last = performance.measures.at(-1)!, end = add(last.position, last.duration);
  if (compare(performed, end) > 0) { if (stats) stats.clamped++; return { ordinal: performance.measures.length, metricOffset: exact(0n) }; }
  // Inside a synthetic hold or grace, the position is held at the end of that insertion.
  const inside = performance.sourceMap.find(s => s.kind !== 'metric' && compare(performed, s.position) >= 0 && compare(performed, add(s.position, s.duration)) < 0);
  if (inside) { const after = toScorePosition(performance, add(inside.position, inside.duration)); if (after.ok) { if (stats) stats.clamped++; return after.value; } }
  throw new Error(`No Studio position for performed quarter ${quarters.num}/${quarters.den}: ${at.diagnostic.message}`);
}

export function legacyListener(factory: () => V1Listener, abilities: LegacyAbilities, stats: LegacyStats = { clamped: 0, droppedNotes: 0 }): () => Listener & { stats: LegacyStats } {
  return () => {
    let inner: V1Listener | null = null, performance: Performance | null = null;
    const convert = (emissions: V1Emission[]): Emission[] => emissions.flatMap((e): Emission[] => {
      if (e.kind === 'note') { stats.droppedNotes++; return []; }
      if (e.kind === 'unsupported') return [{ ...e }];
      return [{ id: e.id, kind: 'position', refersTo: e.refersTo, ...(e.supersedes ? { supersedes: e.supersedes } : {}), confidence: e.confidence,
        candidates: e.candidates.map(c => ({ at: quartersToScorePosition(performance!, c.position.quarters, stats), weight: c.weight })) }];
    });
    return {
      stats,
      start(score: MnxStructure, handoff: Handoff, delivery: Delivery): StartResult {
        const compiled = compilePerformance(score);
        if (!compiled.ok || compiled.performance.diagnostics.length) return { ok: false, refused: 'The score does not compile cleanly.' };
        performance = compiled.performance;
        if (!samePosition(handoff.from, topOfScore(performance))) return { ok: false, refused: 'This listener starts only at the top of the score.' };
        const all = partIds(score);
        if (handoff.parts.length !== all.length || all.some(p => !handoff.parts.includes(p))) return { ok: false, refused: 'This listener listens to every part of the score.' };
        const q = handoff.tempo.quartersPerMinute;
        if (q.den !== 1n || q.num <= 0n || q.num > BigInt(Number.MAX_SAFE_INTEGER)) return { ok: false, refused: 'This listener needs a whole-number tempo in quarters per minute.' };
        if (abilities.windowMeasures !== null && performance.measures.slice(0, abilities.windowMeasures).some(m => m.occurrence !== 1)) {
          return { ok: false, refused: `This listener models the first ${abilities.windowMeasures} performed measures and cannot follow a repeat inside them.` };
        }
        if (delivery.sampleRate !== V1_DELIVERY.sampleRate || delivery.chunkSamples !== V1_DELIVERY.chunkSamples) {
          return { ok: false, refused: 'This listener needs 48 kHz audio in 480-sample chunks.' };
        }
        inner = factory();
        try { inner.start(score, { bpm: Number(q.num), unit: 'quarter' }, { ...V1_DELIVERY }); }
        catch (error) { inner = null; return { ok: false, refused: error instanceof Error ? error.message : String(error) }; }
        return { ok: true };
      },
      feed(chunk: Float32Array, clock: number) { if (!inner) throw new Error('Listener not started'); return convert(inner.feed(chunk, clock)); },
      finish() { if (!inner) throw new Error('Listener not started'); return convert(inner.finish()); },
    };
  };
}
