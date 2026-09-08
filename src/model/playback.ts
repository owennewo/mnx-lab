// Playback/inspection identities only. No editor cursor, DOM, or audio clock.
import type { PassModel, PerformedEntry } from './passes.ts';

export function resolveIteration(model: PassModel, measureIndex: number, iteration: number): { performed: boolean; ordinals: number[] } {
  const ordinals = model.entries.filter(entry => entry.measureIndex === measureIndex && entry.iteration === iteration)
    .map(entry => entry.ordinal);
  return { performed: ordinals.length > 0, ordinals };
}
export function resolveOrdinal(model: PassModel, ordinal: number | null): PerformedEntry | null {
  return ordinal !== null && Number.isSafeInteger(ordinal) ? model.entries[ordinal] ?? null : null;
}
export function resolveOccurrence(model: PassModel, measureIndex: number, occurrence: number): PerformedEntry | null {
  return model.entries.find(entry => entry.measureIndex === measureIndex && entry.occurrence === occurrence) ?? null;
}
/** Retain the current candidate, then prefer the next. Only an explicit seek
 * may wrap. A repeated click sets cycle=true to advance beyond the current one. */
export function chooseOrdinal(ordinals: readonly number[], current: number | null,
  options: { explicitSeek?: boolean; cycle?: boolean } = {}): number | null {
  const candidates = [...new Set(ordinals)].sort((a, b) => a - b);
  if (current === null) return candidates[0] ?? null;
  if (!options.cycle && candidates.includes(current)) return current;
  return candidates.find(ordinal => ordinal > current) ?? (options.explicitSeek ? candidates[0] ?? null : null);
}
export interface PlaybackPositionState {
  ordinal: number | null;
  playbackIteration: number | null;
  inspectionIteration: number;
  followPlayback: boolean;
}
export function initialPlaybackPosition(): PlaybackPositionState {
  return { ordinal: null, playbackIteration: null, inspectionIteration: 1, followPlayback: true };
}
export function inspectIteration<T extends PlaybackPositionState>(state: T, iteration: number): T {
  if (!Number.isSafeInteger(iteration) || iteration < 1) throw new RangeError('Iteration must be a positive safe integer.');
  return { ...state, inspectionIteration: iteration, followPlayback: false };
}
export function followPlayback<T extends PlaybackPositionState>(state: T): T {
  return { ...state, followPlayback: true };
}
export function withPlaybackOrdinal<T extends PlaybackPositionState>(state: T, model: PassModel, ordinal: number | null): T {
  const entry = resolveOrdinal(model, ordinal);
  return { ...state, ordinal: entry?.ordinal ?? null, playbackIteration: entry?.iteration ?? null };
}
export function activeIteration(state: PlaybackPositionState): number {
  return state.followPlayback && state.ordinal !== null && state.playbackIteration !== null
    ? state.playbackIteration : state.inspectionIteration;
}
export function verseForIteration(orderedVerseIds: readonly string[], state: PlaybackPositionState): string | undefined {
  return orderedVerseIds[activeIteration(state) - 1];
}
/** Walking to another bar NEVER changes inspection state, even if this bar
 * skips that iteration or belongs to a different strain. Cycling is explicit. */
export function nextInspectionIteration(model: PassModel, measureIndex: number, current: number): number {
  const available = model.availableIterations[measureIndex] ?? [1];
  const at = available.indexOf(current);
  return available[(at + 1) % available.length] ?? 1;
}
