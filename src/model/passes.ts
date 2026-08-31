// The pass model (one-surface item 6, phase 3:
// roadmap/inprogress/workbench-one-surface-lyrics.md, decision A).
//
// ONE shared linearization of the repeat structure, in the model layer so its
// three consumers cannot disagree at the edges: the future player (per-bar
// play index; "show only the current pass's line"), lyric tooling (verse ↔
// pass resolution), and diagnostics (the blue bound). Pure over the global
// measures — repeats and jumps are global attributes, so no part is consulted
// and no instrument is assumed.
//
// Conventions encoded (the ones every engraving reader shares):
//   · `repeatEnd.times` defaults to 2; an unmatched `:|` repeats from the
//     start of the piece (or the previous strain's end).
//   · A volta (`ending`) with `numbers` is taken only on those iterations of
//     its strain and skipped wholesale otherwise (its own `repeatEnd`
//     included — that is what makes second endings continue). An ending
//     without numbers is never skipped.
//   · A `jump` fires once, at the end of its bar: both kinds go to the segno
//     (the first bar carrying one, else the beginning). The return takes no
//     repeats, and only `dsalfine` stops at `fine`.
//   · The walk is capped; a malformed graph truncates rather than spins,
//     and says so.
//
// Deliberate simplification, recorded: on a D.S. return the walk re-enters
// numbered voltas as iteration 1 (convention would take the final ending).
// The corpus has no scenario exercising that corner; revisit with the player.

import type { MnxStructure } from './mnx.ts';

export interface PassModel {
  /** Measure indexes in performance order — the player's timeline. */
  order: number[];
  /** Per measure index: how many times the bar is sounded in total. */
  passCounts: number[];
  /** Per measure index: the strain iterations (1-based) on which the bar
   *  sounds, deduplicated — the pass numbers stacked verses map onto. A bar
   *  outside any repeat sounds on pass 1. */
  soundingPasses: number[][];
  /** True when the safety cap fired (a malformed repeat graph); the model
   *  holds whatever was walked up to that point. */
  truncated: boolean;
}

/** Does the document declare any repeat structure at all? When it does not,
 *  pass-based diagnostics stay silent: stacked verses over unrepeated music
 *  (the hymn convention) carry the repetition implicitly, and there is
 *  nothing written down for the lyrics to disagree with. */
export function hasRepeatStructure(doc: MnxStructure): boolean {
  return (doc.global?.measures ?? []).some(
    m => m.repeatStart !== undefined || m.repeatEnd !== undefined
      || m.ending !== undefined || m.jump !== undefined
  );
}

export function linearizePasses(doc: MnxStructure): PassModel {
  const globals = doc.global?.measures ?? [];
  const count = Math.max(
    globals.length,
    ...(doc.parts ?? []).map(part => part.measures?.length ?? 0),
    0
  );
  const order: number[] = [];
  const soundingPasses: number[][] = Array.from({ length: count }, () => []);
  let truncated = false;

  let i = 0;
  let repeatStartIndex = 0;
  let iteration = 1;      // 1-based iteration of the current strain
  let viaLoop = false;    // arrived by looping back (do not re-read repeatStart)
  let jumpTaken = false;  // a jump fires once; the return takes no repeats
  let jumpKind: 'segno' | 'dsalfine' | null = null;
  // The last bar of a numbered volta currently being played: walking past it
  // without looping means the strain resolved through its final ending, and
  // the music after it starts over at pass 1.
  let endingExit: number | null = null;
  const cap = count * 64 + 64;
  let steps = 0;

  const segnoIndex = () => {
    const at = globals.findIndex(m => m.segno !== undefined);
    return at >= 0 ? at : 0;
  };

  while (i < count) {
    if (++steps > cap) {
      truncated = true;
      break;
    }
    const measure = globals[i] ?? {};
    if (!viaLoop && measure.repeatStart !== undefined) {
      repeatStartIndex = i;
      iteration = 1;
    }
    viaLoop = false;
    // A numbered volta not for this iteration: step over its whole span,
    // repeat barlines and all.
    const numbers = measure.ending?.numbers;
    if (numbers && numbers.length > 0 && !numbers.includes(iteration)) {
      i += Math.max(1, measure.ending?.duration ?? 1);
      continue;
    }
    if (numbers && numbers.length > 0)
      endingExit = i + Math.max(1, measure.ending?.duration ?? 1) - 1;

    order.push(i);
    if (!soundingPasses[i]!.includes(iteration)) soundingPasses[i]!.push(iteration);

    if (jumpKind === 'dsalfine' && measure.fine !== undefined) break;
    if (measure.jump !== undefined && !jumpTaken) {
      jumpTaken = true;
      jumpKind = measure.jump.type;
      i = segnoIndex();
      iteration = 1;
      continue;
    }
    if (measure.repeatEnd !== undefined && !jumpTaken) {
      const times = measure.repeatEnd.times ?? 2;
      if (iteration < times) {
        i = repeatStartIndex;
        iteration += 1;
        viaLoop = true;
        continue;
      }
      // The strain is spent; music after it starts over at pass 1.
      iteration = 1;
      endingExit = null;
    }
    if (endingExit !== null && i >= endingExit) {
      iteration = 1;
      endingExit = null;
    }
    i += 1;
  }

  const passCounts = Array.from({ length: count }, () => 0);
  for (const index of order) passCounts[index]! += 1;
  return { order, passCounts, soundingPasses, truncated };
}
