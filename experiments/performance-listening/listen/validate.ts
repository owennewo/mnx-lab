/** Semantic checks on a version-2 record, positions and note verdicts included. A record
 * that fails is a listener defect, whatever its score. */
import type { Performance } from '../../../src/audio/performanceTypes.ts';
import { compare, ZERO } from '../../../src/audio/time.ts';
import type { MnxStructure } from '../../../src/model/mnx.ts';
import type { Decision, NoteVerdict, ScorePosition } from './contract.ts';
import { canonical } from './positions.ts';

const VERDICTS: readonly NoteVerdict[] = ['match', 'missing', 'extra', 'substitution', 'timing', 'duration'];
const requireThat = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
const nullableFinite = (n: unknown) => n === null || finite(n);
const unit = (n: unknown) => finite(n) && (n as number) >= 0 && (n as number) <= 1;

export function validatePosition(position: ScorePosition, performance?: Performance): void {
  requireThat(Number.isSafeInteger(position.ordinal) && position.ordinal >= 0, 'Invalid ordinal');
  requireThat(compare(position.metricOffset, ZERO) >= 0, 'Invalid metric offset');
  if (performance) requireThat(canonical(performance, position).ok, 'Position is outside the performed score');
}

export function validateRecord(record: readonly Decision[], performance?: Performance): void {
  const ids = new Map<string, Decision>();
  let clock = 0;
  for (const d of record) {
    requireThat(typeof d.id === 'string' && d.id.length > 0 && !ids.has(d.id), 'Duplicate or missing decision id');
    requireThat(finite(d.refersTo) && finite(d.madeAt) && d.refersTo >= 0 && d.refersTo <= d.madeAt && d.madeAt >= clock, 'Invalid decision clock');
    if (d.supersedes) requireThat(ids.get(d.supersedes)?.refersTo === d.refersTo, 'A revision must refer to an earlier decision about the same time');
    if (d.kind === 'position') {
      requireThat(d.candidates.length > 0 && unit(d.confidence), 'Invalid confidence or candidates');
      for (const c of d.candidates) { validatePosition(c.at, performance); requireThat(finite(c.weight) && c.weight > 0 && c.weight <= 1, 'Invalid weight'); }
      requireThat(Math.abs(d.candidates.reduce((s, c) => s + c.weight, 0) - 1) < 1e-9, 'Weights must sum to one');
    } else if (d.kind === 'note') {
      requireThat(VERDICTS.includes(d.verdict), 'Invalid note verdict');
      validatePosition(d.at, performance);
      requireThat(d.noteKey === null || (typeof d.noteKey === 'string' && d.noteKey.length > 0), 'Invalid note key');
      requireThat((d.verdict === 'extra') === (d.noteKey === null), 'Only an extra note has no note key');
      if (d.observed !== null) requireThat(['onset', 'end', 'midi', 'string'].every(k => nullableFinite((d.observed as Record<string, unknown>)[k])), 'Invalid observation');
      requireThat(nullableFinite(d.timingErrorSeconds) && nullableFinite(d.durationErrorSeconds) && unit(d.confidence), 'Invalid note measures');
    } else requireThat(d.kind === 'unsupported', 'Invalid decision kind');
    ids.set(d.id, d); clock = d.madeAt;
  }
}

/** The handoff's part names: a part's id, or its position when the score gives none. */
export const partIds = (score: MnxStructure): string[] => score.parts.map((p, i) => p.id ?? `#${i}`);
