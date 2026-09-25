import { clockFollower, CLOCK_VERSION } from '../candidates/clockFollower.ts';
import { onlineTimeWarp1, OLTW_1 } from '../candidates/onlineTimeWarp1.ts';
import { onlineTimeWarp2, OLTW_2 } from '../candidates/onlineTimeWarp2.ts';
import { onlineTimeWarp3, OLTW_3 } from '../candidates/onlineTimeWarp3.ts';
import { onlineTimeWarpWith, V2_CONFIG } from '../candidates/onlineTimeWarpConfigurable.ts';
import { spectralFollower1, SPECTRAL_1 } from '../candidates/spectralFollower1.ts';
import { spectralFollower2 } from '../candidates/spectralFollower2.ts';
import type { Listener } from '../types.ts';
import type { LegacyAbilities } from '../seam/legacy.ts';
/** Version-1 candidates model the whole score (the clock) or its first four measures. */
const WHOLE: LegacyAbilities = { windowMeasures: null }, FOUR: LegacyAbilities = { windowMeasures: 4 };

/** Version 4: the endpoint is chosen by evidence that fades with a 1 s time constant. */
export const V4 = { ...V2_CONFIG, label: 'oltw4', endpoint: { kind: 'recent' as const, fadeSeconds: 1 } };
/** Version 5: steps allow local tempo from a third to three times the handed tempo. */
export const V5 = { ...V2_CONFIG, label: 'oltw5', steps: 'wide' as const };
/** Version 6: support when the path's reference frames rank within the best 10% for the sound. */
export const V6 = { ...V2_CONFIG, label: 'oltw6', support: { kind: 'rank' as const, limit: 0.1 } };

/** Every candidate the scoreboard runs, with the module its fingerprint starts from.
 * Diagnostics are measured the same way but are never candidates. */
export const CANDIDATES: { id: string; module: string; factory: () => Listener; legacy: LegacyAbilities; recognition?: 1 | 2 | 'oltw' | 'oltw3'; diagnostic?: true }[] = [
  { id: CLOCK_VERSION, module: 'candidates/clockFollower.ts', legacy: WHOLE, factory: clockFollower },
  { id: SPECTRAL_1, module: 'candidates/spectralFollower1.ts', legacy: FOUR, factory: spectralFollower1, recognition: 1 },
  { id: 'spectral-follower@2', module: 'candidates/spectralFollower2.ts', legacy: FOUR, factory: spectralFollower2, recognition: 2 },
  { id: OLTW_1, module: 'candidates/onlineTimeWarp1.ts', legacy: FOUR, factory: onlineTimeWarp1, recognition: 'oltw' },
  { id: OLTW_2, module: 'candidates/onlineTimeWarp2.ts', legacy: FOUR, factory: () => onlineTimeWarp2(), recognition: 'oltw' },
  // Not a candidate: the incumbent's alignment with its support test switched off.
  { id: `${OLTW_2}/alignment-only`, module: 'candidates/onlineTimeWarp2.ts', legacy: FOUR, factory: () => onlineTimeWarp2({ alwaysClaim: true }), diagnostic: true },
  { id: OLTW_3, module: 'candidates/onlineTimeWarp3.ts', legacy: FOUR, factory: () => onlineTimeWarp3(), recognition: 'oltw3' },
  { id: `${OLTW_3}/alignment-only`, module: 'candidates/onlineTimeWarp3.ts', legacy: FOUR, factory: () => onlineTimeWarp3({ alwaysClaim: true }), diagnostic: true },
  // Experiment 011: one change each from version 2.
  { id: 'online-time-warp@4', module: 'candidates/onlineTimeWarpConfigurable.ts', legacy: FOUR, factory: () => onlineTimeWarpWith(V4) },
  { id: 'online-time-warp@4/alignment-only', module: 'candidates/onlineTimeWarpConfigurable.ts', legacy: FOUR, factory: () => onlineTimeWarpWith({ ...V4, alwaysClaim: true }), diagnostic: true },
  { id: 'online-time-warp@5', module: 'candidates/onlineTimeWarpConfigurable.ts', legacy: FOUR, factory: () => onlineTimeWarpWith(V5) },
  { id: 'online-time-warp@5/alignment-only', module: 'candidates/onlineTimeWarpConfigurable.ts', legacy: FOUR, factory: () => onlineTimeWarpWith({ ...V5, alwaysClaim: true }), diagnostic: true },
  { id: 'online-time-warp@6', module: 'candidates/onlineTimeWarpConfigurable.ts', legacy: FOUR, factory: () => onlineTimeWarpWith(V6) },
];
