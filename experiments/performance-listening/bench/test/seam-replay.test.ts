import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import type { Decision as SeamDecision } from '../../listen/contract.ts';
import { validateRecord } from '../../listen/validate.ts';
import { evaluate } from '../src/evaluate/index.ts';
import { quartersToScorePosition } from '../src/seam/legacy.ts';
import { replayThroughSeam } from '../src/seam/replay.ts';
import type { Decision, Golden } from '../src/types.ts';

const experiment = new URL('../../', import.meta.url);
const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, experiment), 'utf8')) as T;

describe('g001\'s committed records replayed through the seam', () => {
  for (const id of ['p1', 'p2', 't1-tempo-90', 'c1-silence', 'c2-wrong-piece']) it(`draws exactly what the evaluator scored on ${id}`, async () => {
    const golden = read<Golden>(`sets/harness-v1/${id}/golden.json`), record = read<Decision[]>(`runs/g001-clock-harness-v1/${id}.decisions.json`);
    const score = read<MnxStructure>(`sets/harness-v1/${id}/score.mnx.json`), compiled = compilePerformance(score);
    if (!compiled.ok) throw new Error('compile');
    const stats = { clamped: 0, droppedNotes: 0 };
    const seam: SeamDecision[] = record.map(d => d.kind === 'position'
      ? { id: d.id, kind: 'position', refersTo: d.refersTo, madeAt: d.madeAt, confidence: d.confidence, candidates: d.candidates.map(c => ({ at: quartersToScorePosition(compiled.performance, c.position.quarters, stats), weight: c.weight })) }
      : { ...d } as SeamDecision);
    validateRecord(seam, compiled.performance);
    const points = evaluate(golden, record).asDecided.points.map(p => ({ time: p.time, decision: p.decision }));
    const result = await replayThroughSeam(compiled.performance, seam, points);
    expect(result.failures).toEqual([]);
    expect(result.checked).toBe(points.length);
  });
});
