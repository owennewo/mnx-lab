/** Studio's coordinate and the performed coordinate the evaluator measures in. Both
 * directions are Studio's own functions; this module only names them for the seam. */
import { canonicalScorePosition, performancePositionAt, scorePositionAt } from '../../../src/audio/scorePosition.ts';
import type { Performance } from '../../../src/audio/performanceTypes.ts';
import { compare, type Rational } from '../../../src/audio/time.ts';
import type { ScorePosition } from './contract.ts';

/** A performed position, in whole notes from the start of the performance, as a ScorePosition. */
export const toScorePosition = (performance: Performance, performed: Rational) => scorePositionAt(performance, performed);
/** A ScorePosition as a performed position in whole notes. */
export const toPerformed = (performance: Performance, position: ScorePosition, edge?: 'before' | 'after') => performancePositionAt(performance, position, edge);
export const canonical = (performance: Performance, position: ScorePosition) => canonicalScorePosition(performance, position);
/** The top of the score: the first performed visit at its first written offset. */
export const topOfScore = (performance: Performance): ScorePosition => ({ ordinal: 0, metricOffset: performance.measures[0]!.from });
export function samePosition(a: ScorePosition, b: ScorePosition): boolean {
  return a.ordinal === b.ordinal && compare(a.metricOffset, b.metricOffset) === 0;
}
