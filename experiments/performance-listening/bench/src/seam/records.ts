/** Translates a version-2 record into version-1 positions, so the frozen evaluator judges it
 * unchanged. Exact wherever the legacy adapter did not hold a position at a boundary. */
import type { Performance } from '../../../../../src/audio/performanceTypes.ts';
import { multiply, rational as exact, toSafeFraction } from '../../../../../src/audio/time.ts';
import type { Decision } from '../../../listen/contract.ts';
import { toPerformed } from '../../../listen/positions.ts';
import { rational, type Decision as V1Decision } from '../types.ts';

export function toV1Record(performance: Performance, record: readonly Decision[]): V1Decision[] {
  return record.flatMap((d): V1Decision[] => {
    if (d.kind === 'note') return [];
    if (d.kind === 'unsupported') return [{ ...d }];
    return [{ id: d.id, kind: 'position', refersTo: d.refersTo, madeAt: d.madeAt, ...(d.supersedes ? { supersedes: d.supersedes } : {}), confidence: d.confidence,
      candidates: d.candidates.map(c => {
        const performed = toPerformed(performance, c.at);
        if (!performed.ok) throw new Error(performed.diagnostic.message);
        const q = toSafeFraction(multiply(performed.value, exact(4n)));
        return { position: { quarters: rational(q.num, q.den), route: 1 }, weight: c.weight };
      }) }];
  });
}
