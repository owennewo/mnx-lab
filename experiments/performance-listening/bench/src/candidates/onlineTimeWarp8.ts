import type { Emission, Listener } from '../types.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from './onlineTimeWarp2.ts';
import { onlineTimeWarpWith, type SupportTrace, V2_CONFIG } from './onlineTimeWarpConfigurable.ts';

export const OLTW_8 = 'online-time-warp@8';
/** Fixed before any run of this version; a different value is a new version. */
export const RANK_WINDOW_SECONDS = 2;
export const RANK_LIMIT = 0.2;
export interface WindowedRankTrace { clock: number; path: SupportTrace; windowRank: number; supported: boolean }

/** Version 6's alignment with one changed support rule. Version 6 required the path's
 * last-second mean rank to lie within the best 10% of the reference. Version 8 averages
 * that same last-second rank over every analysed frame of the last two seconds and
 * requires the average to lie within the best 20%. Experiments 014 and 015 traced the
 * wrong score's ranks in every active timbre; the limit and window were chosen from
 * those development traces (report 016). The warm-up, level rejection and absolute
 * path-cost cap are unchanged. */
export function onlineTimeWarp8(options: { trace?: (frame: WindowedRankTrace) => void } = {}): Listener {
  let latest: SupportTrace | null = null, recent: { clock: number; rank: number }[] = [], supported = false;
  const path = onlineTimeWarpWith({ ...V2_CONFIG, label: 'oltw8', support: { kind: 'rank', limit: 0.1 }, alwaysClaim: true, trace: f => { latest = f; } });
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
