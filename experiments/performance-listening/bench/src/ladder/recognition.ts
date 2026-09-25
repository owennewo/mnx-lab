import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { frames, frontier, quantiles, similarity, STEP, templates, type Version } from '../diagnostic/features.ts';

/** The experiment 003 recognition measure, with the supplied position taken from exact
 * rendered labels instead of sync interpolation. Same features, templates, cutoff and
 * competitor definitions; nothing here is a listener. */
export function recognitionAtLabels(audio: Float32Array, score: MnxStructure, otherScore: MnxStructure, version: Version,
  positionAt: (seconds: number) => number, nominalBpm: number) {
  const heard = frames(audio, version), own = templates(score, version), other = templates(otherScore, version);
  const maxQ = (own.length - 1) * STEP;
  const rows = heard.map(f => {
    const scores = own.map(t => similarity(t, f.feature)), otherScores = other.map(t => similarity(t, f.feature));
    const q = positionAt(f.center), expected = f.center * nominalBpm / 60;
    const inCorridor = (i: number) => i * STEP >= Math.max(0, 0.8 * expected - 0.25) && i * STEP <= Math.min(maxQ, 1.2 * expected + 0.25);
    const near = scores.filter((_, i) => Math.abs(i * STEP - q) <= 0.25 + 1e-9);
    const localFar = scores.filter((_, i) => inCorridor(i) && Math.abs(i * STEP - q) > 0.25 + 1e-9);
    const otherLocal = otherScores.filter((_, i) => inCorridor(i));
    return {
      clock: f.clock, center: f.center, quarter: q,
      nearest: scores[Math.max(0, Math.min(scores.length - 1, Math.round(q / STEP)))]!,
      positive: Math.max(...near), wrong: localFar.length ? Math.max(...localFar) : null,
      dust: Math.max(...otherLocal), audible: f.rms > 1e-4,
    };
  });
  const eligible = rows.filter(r => r.wrong !== null), margins = eligible.map(r => r.positive - r.wrong!);
  return {
    version, frames: rows.length,
    nearestAcceptance: rows.filter(r => r.audible && r.nearest >= 0.65).length / rows.length,
    localAcceptance: rows.filter(r => r.audible && r.positive >= 0.65).length / rows.length,
    nearbyWrongAcceptance: eligible.filter(r => r.audible && r.wrong! >= 0.65).length / eligible.length,
    otherScoreAcceptance: rows.filter(r => r.audible && r.dust >= 0.65).length / rows.length,
    margins: { count: eligible.length, wins: margins.filter(m => m > 1e-9).length, ties: margins.filter(m => Math.abs(m) <= 1e-9).length, losses: margins.filter(m => m < -1e-9).length, quantiles: quantiles(margins) },
    similarity: { nearest: quantiles(rows.map(r => r.nearest)), positive: quantiles(rows.map(r => r.positive)) },
    cutoff: frontier(rows), rows,
  };
}
