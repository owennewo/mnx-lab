import type { Emission, Listener } from '../types.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from './onlineTimeWarp2.ts';
import { type SupportTrace, V2_CONFIG } from './onlineTimeWarpConfigurable.ts';
import { acousticAnchoredPath } from './onlineTimeWarpAcousticAnchorPath.ts';

export const OLTW_10 = 'online-time-warp@10';
export const CONTINUITY_WEIGHT = 0.02;
/** Fixed before any run of this version; a different value is a new version. */
export const RANK_WINDOW_SECONDS = 2;
export const RANK_LIMIT = 0.2;
export interface WindowedRankTrace { clock: number; path: SupportTrace; windowRank: number; supported: boolean }

/** Version 9 changed only in the prior predictor: causal regression of acoustic winners.
 * Version 8 support and the 0.02 regularization strength remain unchanged.
 * Weight 0.02 is fixed before private evaluation: a quarter-tolerance departure costs 0.02. */
export function onlineTimeWarp10(options: { trace?: (frame: WindowedRankTrace) => void } = {}): Listener {
  let latest: SupportTrace | null = null, recent: { clock: number; rank: number }[] = [], supported = false;
  const path = acousticAnchoredPath({ ...V2_CONFIG, label: 'oltw10', support: { kind: 'rank', limit: 0.1 }, alwaysClaim: true, trace: f => { latest = f; } }, CONTINUITY_WEIGHT);
  return {
    start(score, tempo, delivery) {
      latest = null; recent = []; supported = false;
      path.start(score, tempo, delivery);
    },
    feed(chunk, clock) {
      const emissions = path.feed(chunk, clock);
      if (latest?.clock === clock) {
        recent.push({ clock, rank: latest.meanRank! });
        while (recent[0]!.clock < clock - RANK_WINDOW_SECONDS + 1e-9) recent.shift();
        const windowRank = recent.reduce((s, r) => s + r.rank, 0) / recent.length;
        supported = latest.rows >= MINIMUM_FRAMES && windowRank <= RANK_LIMIT && latest.pathCost <= MAXIMUM_PATH_COST;
        options.trace?.({ clock, path: latest, windowRank, supported });
      }
      return emissions.map((e): Emission => e.kind !== 'position' || supported ? e : {
        id: e.id, kind: 'unsupported', refersTo: e.refersTo,
        reason: 'the path has not ranked within the best 20% of the reference over the last two seconds, or exceeds the cost cap',
      });
    },
    finish() { path.finish(); return []; },
  };
}
