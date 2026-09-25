/** Records are stored as JSON; Studio's exact rationals are bigints in memory and strings on disk. */
import { fromRationalJSON, toRationalJSON, type RationalJSON } from '../../../src/audio/time.ts';
import type { Decision, NoteStatement, PositionStatement, ScorePosition } from './contract.ts';

export interface ScorePositionJSON { ordinal: number; metricOffset: RationalJSON }
export const positionToJSON = (p: ScorePosition): ScorePositionJSON => ({ ordinal: p.ordinal, metricOffset: toRationalJSON(p.metricOffset) });
export const positionFromJSON = (p: ScorePositionJSON): ScorePosition => ({ ordinal: p.ordinal, metricOffset: fromRationalJSON(p.metricOffset) });

type Json<T> = T extends PositionStatement ? Omit<T, 'candidates'> & { candidates: { at: ScorePositionJSON; weight: number }[] }
  : T extends NoteStatement ? Omit<T, 'at'> & { at: ScorePositionJSON } : T;
export type DecisionJSON = Json<Decision>;

export function decisionToJSON(d: Decision): DecisionJSON {
  if (d.kind === 'position') return { ...d, candidates: d.candidates.map(c => ({ weight: c.weight, at: positionToJSON(c.at) })) } as DecisionJSON;
  if (d.kind === 'note') return { ...d, at: positionToJSON(d.at) } as DecisionJSON;
  return { ...d } as DecisionJSON;
}
export function decisionFromJSON(d: DecisionJSON): Decision {
  if (d.kind === 'position') {
    const p = d as unknown as { candidates: { at: ScorePositionJSON; weight: number }[] };
    return { ...d, candidates: p.candidates.map(c => ({ weight: c.weight, at: positionFromJSON(c.at) })) } as unknown as Decision;
  }
  if (d.kind === 'note') return { ...d, at: positionFromJSON((d as unknown as { at: ScorePositionJSON }).at) } as unknown as Decision;
  return { ...d } as unknown as Decision;
}
