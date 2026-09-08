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
//     current repeat start (initially the start of the piece).
//   · A volta (`ending`) with `numbers` is taken only on those iterations of
//     its strain and skipped wholesale otherwise (its own `repeatEnd`
//     included — that is what makes second endings continue). An ending
//     without numbers is never skipped.
//   · A `jump` fires once, at its metric location: both kinds go to the segno
//     (the first bar carrying one, else the beginning). The return takes no
//     repeats, and only `dsalfine` stops at `fine`.
//   · The walk is capped; a malformed graph truncates rather than spins,
//     and says so.
//
// On a D.S. return, numbered endings use the final declared strain iteration.
// No repeats are retaken. This is a lab performance convention, not an MNX rule.

import type { MnxStructure } from './mnx.ts';

export interface PerformedEntry {
  ordinal: number;
  measureIndex: number;
  occurrence: number;
  iteration: number;
  /** Half-open metric slice; omitted bounds mean the written bar's start/end. */
  from?: [number, number];
  until?: [number, number];
  /** Arrival by loop/jump/ending; fine takes precedence on a terminating entry. */
  via?: 'loop' | 'ending' | 'jump' | 'fine';
}

export interface PassDiagnostic {
  code: 'cap' | 'unmatched-ending' | 'jump-without-segno' | 'replaced-repeat-start';
  measureIndex: number;
  message: string;
}

export interface PassModel {
  /** Measure indexes in performance order — the player's timeline. */
  order: number[];
  entries: PerformedEntry[];
  diagnostics: PassDiagnostic[];
  /** Available strain iterations, including those skipping this bar. Bounded by
   *  the walk's safety cap on malformed input, with a cap diagnostic. */
  availableIterations: number[][];
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
  const entries: PerformedEntry[] = [];
  const diagnostics: PassDiagnostic[] = [];
  const passCounts = Array.from({ length: count }, () => 0);
  const cap = count * 64 + 64;
  const availableIterations: number[][] = Array.from({ length: count }, () => [1]);
  const inStrain = Array.from({ length: count }, () => false);
  const endingAt: (number | undefined)[] = Array.from({ length: count });
  for (let at = 0; at < count; at++) {
    if (!globals[at]?.ending) continue;
    const end = Math.min(count, at + Math.max(1, globals[at]!.ending!.duration ?? 1));
    for (let k = at; k < end; k++) endingAt[k] = at;
  }
  const finalEndingIteration = Array.from({ length: count }, () => 1);
  const diagnose = (code: PassDiagnostic['code'], measureIndex: number, message: string) => {
    if (!diagnostics.some(d => d.code === code && d.measureIndex === measureIndex))
      diagnostics.push({ code, measureIndex, message });
  };

  // Read written strain structure independently of visits: skipped endings must
  // still offer the strain's iterations to an inspection cursor. Consecutive
  // ending spans belong to the same strain, including repeat ends inside them.
  let start = 0;
  let openStart: number | null = null;
  for (let at = 0; at < count; at++) {
    const m = globals[at];
    if (m?.repeatStart !== undefined) {
      if (openStart !== null)
        diagnose('replaced-repeat-start', at, `Repeat start replaces the open start at measure ${openStart}.`);
      start = at;
      openStart = at;
    }
    if (!m?.repeatEnd) continue;
    let end = at;
    let times = m.repeatEnd.times ?? 2;
    let hasEndings = false;
    for (let k = start; k <= end; k++) {
      const ending = globals[k]?.ending;
      if (ending) {
        hasEndings = true;
        end = Math.min(count - 1, Math.max(end, k + Math.max(1, ending.duration ?? 1) - 1));
      }
    }
    while (globals[end + 1]?.ending && globals[end + 1]?.repeatStart === undefined) {
      const next = end + 1;
      hasEndings = true;
      end = Math.min(count - 1, next + Math.max(1, globals[next]!.ending!.duration ?? 1) - 1);
    }
    for (let k = at + 1; k <= end; k++)
      if (globals[k]?.repeatEnd) times = Math.max(times, globals[k]!.repeatEnd!.times ?? 2);
    const offered = Array.from({ length: Math.min(cap, Math.max(1, times)) }, (_, n) => n + 1);
    if (times > cap) diagnose('cap', at, `Available iterations limited to ${cap}.`);
    for (let k = start; k <= end; k++) {
      availableIterations[k] = offered;
      inStrain[k] = true;
      if (hasEndings) finalEndingIteration[k] = times;
      if (globals[k]?.ending?.numbers?.some(n => n > times))
        diagnose('unmatched-ending', k, `Ending numbers exceed the strain's ${times} iterations.`);
    }
    openStart = null;
    at = end;
  }
  for (let at = 0; at < count; at++) {
    if (globals[at]?.ending && !inStrain[at])
      diagnose('unmatched-ending', at, 'Ending has no enclosing repeated strain.');
  }

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
  let steps = 0;

  const segno = globals.findIndex(m => m.segno !== undefined);
  let from: [number, number] | undefined;
  let arrival: PerformedEntry['via'];
  const atOrAfter = (a: [number, number], b: [number, number]) =>
    BigInt(a[0]) * BigInt(b[1]) >= BigInt(b[0]) * BigInt(a[1]);

  while (i < count) {
    if (++steps > cap) {
      truncated = true;
      diagnose('cap', i, `Traversal stopped after ${cap} steps.`);
      break;
    }
    const measure = globals[i] ?? {};
    if (!viaLoop && measure.repeatStart !== undefined) {
      repeatStartIndex = i;
      iteration = 1;
    }
    viaLoop = false;
    if (jumpTaken) iteration = finalEndingIteration[i]!;
    // A numbered volta not for this iteration: step over its whole span,
    // repeat barlines and all.
    const endingStart = endingAt[i];
    const ending = endingStart === undefined ? undefined : globals[endingStart]?.ending;
    const endingEnd = endingStart === undefined ? i : endingStart + Math.max(1, ending?.duration ?? 1) - 1;
    const numbers = ending?.numbers;
    if (numbers && numbers.length > 0 && !numbers.includes(iteration)) {
      i = endingEnd + 1;
      from = undefined;
      arrival = 'ending';
      continue;
    }
    if (numbers && numbers.length > 0)
      endingExit = endingEnd;

    const entry: PerformedEntry = {
      ordinal: order.length, measureIndex: i, occurrence: ++passCounts[i]!, iteration,
      ...(from ? { from: [...from] as [number, number] } : {}),
      ...(arrival ? { via: arrival } : {})
    };
    entries.push(entry);
    order.push(i);
    arrival = undefined;
    if (!soundingPasses[i]!.includes(iteration)) soundingPasses[i]!.push(iteration);

    if (jumpKind === 'dsalfine' && measure.fine !== undefined
        && (!from || atOrAfter(measure.fine.location.fraction, from))) {
      entry.until = [...measure.fine.location.fraction];
      entry.via = 'fine';
      break;
    }
    from = undefined;
    if (measure.jump !== undefined && !jumpTaken) {
      jumpTaken = true;
      jumpKind = measure.jump.type;
      entry.until = [...measure.jump.location.fraction];
      if (segno < 0) diagnose('jump-without-segno', i, 'Jump has no segno; returning to the beginning.');
      i = segno >= 0 ? segno : 0;
      from = globals[i]?.segno ? [...globals[i]!.segno!.location.fraction] : undefined;
      arrival = 'jump';
      iteration = 1;
      continue;
    }
    if (measure.repeatEnd !== undefined && !jumpTaken) {
      const times = measure.repeatEnd.times ?? 2;
      if (iteration < times) {
        i = repeatStartIndex;
        iteration += 1;
        viaLoop = true;
        arrival = 'loop';
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

  return { order, passCounts, soundingPasses, truncated, entries, diagnostics, availableIterations };
}
