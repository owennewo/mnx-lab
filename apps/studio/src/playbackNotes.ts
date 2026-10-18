// What a piece's compiled performance has to say about what plays, in the words the
// Mix panel keeps and the page's notice flashes once. A failure means nothing plays at
// all; a note means it plays, but not quite as written — a repeat capped, a jump with
// no target, a jump clipped to its bar. The sound-level diagnostics (a bend clipped, a
// note collapsed) are per note and stay out: they would bury the few that change the
// route through the piece.
import type { PerformanceResult } from '../../../src/audio/performanceTypes.ts';
import type { PassDiagnostic } from '../../../src/model/passes.ts';

const ROUTE_CODES: ReadonlySet<string> = new Set<PassDiagnostic['code'] | 'slice-clipped'>([
  'cap', 'unmatched-ending', 'jump-without-segno', 'jump-without-target',
  'duplicate-target', 'replaced-repeat-start', 'slice-clipped',
]);

export interface PlaybackNotes {
  /** Why nothing plays, or null when the piece compiled. */
  failure: string | null;
  /** How the piece plays other than as written; each message once. */
  notes: readonly string[];
}

export const NO_PLAYBACK_NOTES: PlaybackNotes = { failure: null, notes: [] };

export function playbackNotes(result: PerformanceResult | undefined): PlaybackNotes {
  if (!result) return NO_PLAYBACK_NOTES;
  if (!result.ok) return { failure: result.diagnostics.map(d => d.message).join(' ') || 'The score could not be compiled.', notes: [] };
  const notes = [...new Set(result.performance.diagnostics.filter(d => ROUTE_CODES.has(d.code)).map(d => d.message))];
  return notes.length ? { failure: null, notes } : NO_PLAYBACK_NOTES;
}

/** The one line the page's notice flashes, or '' when there is nothing to say. */
export function playbackNotice({ failure, notes }: PlaybackNotes): string {
  if (failure) return `This piece can't play: ${failure} Details in Mix.`;
  if (!notes.length) return '';
  return `${notes[0]}${notes.length > 1 ? ` (+${notes.length - 1} more)` : ''} Details in Mix.`;
}
