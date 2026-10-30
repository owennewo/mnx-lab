// What the recording-align commands decide before they write, as pure functions: align.ts talks to
// the library and the files; whether a write may go ahead is here, where a test can reach it.

/** Written bars whose contents do not fill their time signature (placeholder rests, a pickup a note over). */
export function misfitBars(written: Record<string, { duration: number; signature: number | null }>): string[] {
  return Object.entries(written).filter(([, w]) => w.signature !== null && Math.abs(w.duration - w.signature) > 1e-9).map(([bar]) => bar);
}

/** How far a stored sync reaches: the last performed bar line it places (the end of its last bar). */
export function syncReach(syncpoints: string | null | undefined): number {
  if (!syncpoints) return 0;
  const points = JSON.parse(syncpoints) as number[][];
  return points.length ? Math.max(...points.map(p => p[0]!)) : 0;
}

export interface SyncWrite {
  /** Bars that misfit their time signature: the sync would count the wrong beats, and go stale when they are put right (run 9). */
  misfits: readonly string[];
  /** Whether the player would play this sync with the recording (verifySync). */
  verified: boolean;
  /** Performed bars this sync reaches. */
  bars: number;
  /** The recording's sync as it stands: its stored tuples, or nothing. */
  stored: string | null | undefined;
  /** The score was saved since this run fetched it, so all of this was checked against other bars. */
  scoreMoved: boolean;
  allow: { misfit?: boolean; unverified?: boolean; replace?: boolean; shorter?: boolean };
}
/** Why a sync may not be written, or null. The first reason given is the one to fix first. */
export function syncRefusal(w: SyncWrite): string | null {
  if (w.scoreMoved) return 'the score was saved since this run fetched it, so this sync was checked against other bars: fetch, score and structure again';
  if (w.misfits.length && !w.allow.misfit) return `${w.misfits.length === 1 ? `bar ${w.misfits[0]} holds` : `bars ${w.misfits.join(' ')} hold`} more or less than ${w.misfits.length === 1 ? 'its' : 'their'} time signature, so the sync's beats would be wrong: fix ${w.misfits.length === 1 ? 'it' : 'them'} first, or --misfit when that is meant`;
  if (!w.verified && !w.allow.unverified) return 'the player would not play this sync with the recording (above): read the report, or --unverified when that is meant';
  if (w.stored && !w.allow.replace) return 'the recording already has a sync; pass --replace only when the owner has said to replace it';
  const reach = syncReach(w.stored);
  if (w.bars < reach && !w.allow.shorter) return `this sync reaches the end of performed bar ${w.bars}, the one it would replace bar ${reach}: read the report (a search that stopped early?); --shorter only when that is meant`;
  return null;
}

/** `1,2,5-8` → [1, 2, 5, 6, 7, 8]; null if it is not that. */
export function parseBars(text: string | undefined): number[] | null {
  if (!text) return null;
  const bars = new Set<number>();
  for (const piece of text.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(piece.trim());
    if (!m) return null;
    const from = Number(m[1]), to = Number(m[2] ?? m[1]);
    if (from < 1 || to < from) return null;
    for (let bar = from; bar <= to; bar++) bars.add(bar);
  }
  return [...bars].sort((a, b) => a - b);
}
