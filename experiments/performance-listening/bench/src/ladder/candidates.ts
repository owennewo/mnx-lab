import { clockFollower, CLOCK_VERSION } from '../candidates/clockFollower.ts';
import { onlineTimeWarp1, OLTW_1 } from '../candidates/onlineTimeWarp1.ts';
import { onlineTimeWarp2, OLTW_2 } from '../candidates/onlineTimeWarp2.ts';
import { onlineTimeWarp3, OLTW_3 } from '../candidates/onlineTimeWarp3.ts';
import { spectralFollower1, SPECTRAL_1 } from '../candidates/spectralFollower1.ts';
import { spectralFollower2 } from '../candidates/spectralFollower2.ts';
import type { Listener } from '../types.ts';

/** Every candidate the scoreboard runs, with the module its fingerprint starts from.
 * Diagnostics are measured the same way but are never candidates. */
export const CANDIDATES: { id: string; module: string; factory: () => Listener; recognition?: 1 | 2 | 'oltw' | 'oltw3'; diagnostic?: true }[] = [
  { id: CLOCK_VERSION, module: 'candidates/clockFollower.ts', factory: clockFollower },
  { id: SPECTRAL_1, module: 'candidates/spectralFollower1.ts', factory: spectralFollower1, recognition: 1 },
  { id: 'spectral-follower@2', module: 'candidates/spectralFollower2.ts', factory: spectralFollower2, recognition: 2 },
  { id: OLTW_1, module: 'candidates/onlineTimeWarp1.ts', factory: onlineTimeWarp1, recognition: 'oltw' },
  { id: OLTW_2, module: 'candidates/onlineTimeWarp2.ts', factory: () => onlineTimeWarp2(), recognition: 'oltw' },
  // Not a candidate: the incumbent's alignment with its support test switched off.
  { id: `${OLTW_2}/alignment-only`, module: 'candidates/onlineTimeWarp2.ts', factory: () => onlineTimeWarp2({ alwaysClaim: true }), diagnostic: true },
  { id: OLTW_3, module: 'candidates/onlineTimeWarp3.ts', factory: () => onlineTimeWarp3(), recognition: 'oltw3' },
  { id: `${OLTW_3}/alignment-only`, module: 'candidates/onlineTimeWarp3.ts', factory: () => onlineTimeWarp3({ alwaysClaim: true }), diagnostic: true },
];
