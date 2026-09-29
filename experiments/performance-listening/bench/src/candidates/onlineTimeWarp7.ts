import type { Emission, Listener } from '../types.ts';
import { MAXIMUM_PATH_COST, MINIMUM_FRAMES } from './onlineTimeWarp2.ts';
import { onlineTimeWarpWith, type SupportTrace, V2_CONFIG } from './onlineTimeWarpConfigurable.ts';

export const OLTW_7 = 'online-time-warp@7';
export interface DecoyTrace { clock: number; forward: SupportTrace; reverse: SupportTrace; fits: boolean; supported: boolean }

/** Version 6's forward alignment, with one changed support rule: the fitted forward
 * path must rank strictly better than the fitted reversed-reference path over their
 * last-second windows. Reversal preserves the exact feature multiset. This is a
 * relative comparator, not a calibrated probability or a guarantee of discrimination.
 * The warm-up, level rejection and absolute path-cost cap are unchanged. */
export function onlineTimeWarp7(options: { trace?: (frame: DecoyTrace) => void } = {}): Listener {
  let forwardTrace: SupportTrace | null = null, reverseTrace: SupportTrace | null = null, supported = false;
  const base = { ...V2_CONFIG, support: { kind: 'rank' as const, limit: 0.1 }, alwaysClaim: true };
  const forward = onlineTimeWarpWith({ ...base, label: 'oltw7', trace: f => { forwardTrace = f; } });
  const reverse = onlineTimeWarpWith({ ...base, label: 'oltw7-decoy', referenceOrder: 'reverse', trace: f => { reverseTrace = f; } });
  return {
    start(score, tempo, delivery) {
      forwardTrace = null; reverseTrace = null; supported = false;
      forward.start(score, tempo, delivery); reverse.start(score, tempo, delivery);
    },
    feed(chunk, clock) {
      const emissions = forward.feed(chunk, clock);
      reverse.feed(chunk, clock);
      if (forwardTrace?.clock === clock && reverseTrace?.clock === clock) {
        const fits = forwardTrace.meanRank! < reverseTrace.meanRank!;
        supported = forwardTrace.rows >= MINIMUM_FRAMES && fits && forwardTrace.pathCost <= MAXIMUM_PATH_COST;
        options.trace?.({ clock, forward: forwardTrace, reverse: reverseTrace, fits, supported });
      }
      return emissions.map((e): Emission => e.kind !== 'position' || supported ? e : {
        id: e.id, kind: 'unsupported', refersTo: e.refersTo,
        reason: 'forward path does not beat its reversed-reference decoy, or exceeds the cost cap',
      });
    },
    finish() { forward.finish(); reverse.finish(); return []; },
  };
}
