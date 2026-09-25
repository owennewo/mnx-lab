import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import * as oltw from '../candidates/onlineTimeWarp1.ts';
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

/** The same question for the online time-warping follower's own features: at the exact
 * position, is the matching cost lower than at every nearby wrong position? Acceptance
 * uses that follower's fixed support threshold on cost. */
export function recognitionOltw(audio: Float32Array, score: MnxStructure, otherScore: MnxStructure,
  positionAt: (seconds: number) => number, nominalBpm: number) {
  const live = oltw.frames(audio), own = oltw.referenceFrames(score, nominalBpm), other = oltw.referenceFrames(otherScore, nominalBpm);
  const quarterOf = (j: number) => (j + 1) * oltw.HOP_SECONDS * nominalBpm / 60;
  const accept = (c: number) => c < oltw.SUPPORT_THRESHOLD;
  const rows = live.filter(f => f.rms > 1e-4).map(f => {
    const q = positionAt(f.clock), expected = f.clock * nominalBpm / 60;
    const inCorridor = (x: number) => x >= Math.max(0, 0.8 * expected - 0.25) && x <= Math.min(own.quarters, 1.2 * expected + 0.25);
    const costs = own.frames.map(r => oltw.cost(f.feature, r.feature));
    const near = costs.filter((_, j) => Math.abs(quarterOf(j) - q) <= 0.25 + 1e-9);
    const far = costs.filter((_, j) => inCorridor(quarterOf(j)) && Math.abs(quarterOf(j) - q) > 0.25 + 1e-9);
    const otherCosts = other.frames.map(r => oltw.cost(f.feature, r.feature)).filter((_, j) => inCorridor(quarterOf(j)));
    const exact = costs[Math.max(0, Math.min(costs.length - 1, Math.round(q * 60 / nominalBpm / oltw.HOP_SECONDS) - 1))]!;
    return { clock: f.clock, quarter: q, exact, positive: near.length ? Math.min(...near) : Infinity, wrong: far.length ? Math.min(...far) : null, other: otherCosts.length ? Math.min(...otherCosts) : Infinity };
  });
  const eligible = rows.filter(r => r.wrong !== null), margins = eligible.map(r => r.wrong! - r.positive);
  return {
    version: 'oltw' as const, frames: rows.length,
    nearestAcceptance: rows.filter(r => accept(r.exact)).length / rows.length,
    localAcceptance: rows.filter(r => accept(r.positive)).length / rows.length,
    nearbyWrongAcceptance: eligible.filter(r => accept(r.wrong!)).length / eligible.length,
    otherScoreAcceptance: rows.filter(r => accept(r.other)).length / rows.length,
    margins: { count: eligible.length, wins: margins.filter(m => m > 1e-9).length, ties: margins.filter(m => Math.abs(m) <= 1e-9).length, losses: margins.filter(m => m < -1e-9).length, quantiles: quantiles(margins) },
    rows,
  };
}
