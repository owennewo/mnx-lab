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
//     without numbers is never skipped. A pass that skips the strain's last
//     ending still repeats while the strain has passes left: a lone "2." over
//     :|x3 plays A, A + ending, A (Soundslice's reading; decided 2026-10-27 on
//     Sun Did Glide).
//   · A `jump` fires once, at its metric location: both kinds go to the segno
//     (the first bar carrying one, else the beginning). Only `dsalfine` stops
//     at `fine`.
//   · A bar that both closes a repeat and carries a jump (or a Fine) finishes
//     its repeat first: the jump fires on the strain's last time through. A
//     jump inside a numbered ending fires on that ending's pass instead.
//   · The walk is capped; a malformed graph truncates rather than spins,
//     and says so.
//
// A return (D.C., D.S.) and a jump to the coda play the repeats they meet, and a
// strain they land in starts over at iteration 1, endings and all. Classical
// practice skips repeats on a return; pop practice usually plays them, and so
// does this lab (decided 2026-10-19 on One Of These Things First, whose
// "Verse 1, 2, 3" strain returns by D.S.). A lab convention, not an MNX rule.
//
// Which lyric row a visit sings is its `verse`, not its `iteration`: a pass
// sings the bar's NEXT row — one past the row its last visit sang — or its
// strain iteration when that is further on (a second ending, first reached on
// pass 2, sings row 2). So verses keep counting through a D.S. return, where
// the iteration starts over, and a verse with no written row sings nothing
// (decided 2026-10-18: the returns of One Of These Things First are unsung).

import type { MnxStructure } from './mnx.ts';
import { measureNavigation, navigationMarkById, type NavigationJump } from './navigation.ts';

export interface PerformedEntry {
  ordinal: number;
  measureIndex: number;
  occurrence: number;
  iteration: number;
  /** The lyric row this visit sings, from 1: one past the bar's previous visit's, or the iteration if that is
   *  further on. Unlike `iteration` it does not start over on a D.S. return; no row by this number → unsung. */
  verse: number;
  /** Half-open metric slice; omitted bounds mean the written bar's start/end. */
  from?: [number, number];
  until?: [number, number];
  /** Arrival by loop/jump/ending; fine takes precedence on a terminating entry. */
  via?: 'loop' | 'ending' | 'jump' | 'fine';
}

export interface PassDiagnostic {
  code: 'cap' | 'unmatched-ending' | 'jump-without-segno' | 'jump-without-target'
    | 'duplicate-target' | 'replaced-repeat-start';
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
      || (m._x?.mnxLab?.navigation?.jumps?.length ?? 0) > 0
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
  const lastVerse = Array.from({ length: count }, () => 0);
  const cap = count * 64 + 64;
  const availableIterations: number[][] = Array.from({ length: count }, () => [1]);
  const inStrain = Array.from({ length: count }, () => false);
  /** Per measure index: the last bar of the strain holding it, endings included. */
  const strainEnd: (number | undefined)[] = Array.from({ length: count });
  const endingAt: (number | undefined)[] = Array.from({ length: count });
  for (let at = 0; at < count; at++) {
    if (!globals[at]?.ending) continue;
    const end = Math.min(count, at + Math.max(1, globals[at]!.ending!.duration ?? 1));
    for (let k = at; k < end; k++) endingAt[k] = at;
  }
  /** Per measure index: the repeat start in force reading the score in written order. */
  const startAt = Array.from({ length: count }, () => 0);
  for (let at = 0, start = 0; at < count; at++)
    startAt[at] = start = globals[at]?.repeatStart !== undefined ? at : start;
  const diagnose = (code: PassDiagnostic['code'], measureIndex: number, message: string) => {
    if (!diagnostics.some(d => d.code === code && d.measureIndex === measureIndex))
      diagnostics.push({ code, measureIndex, message });
  };
  const markIds = new Map<string, number>();
  for (const [measureIndex, measure] of globals.entries()) {
    for (const mark of measureNavigation(measure).marks) {
      if (!mark.id) continue;
      if (markIds.has(mark.id))
        diagnose('duplicate-target', measureIndex, `Navigation target "${mark.id}" is duplicated; the first declaration wins.`);
      else markIds.set(mark.id, measureIndex);
    }
  }

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
    for (let k = start; k <= end; k++) {
      const ending = globals[k]?.ending;
      if (ending) {
        end = Math.min(count - 1, Math.max(end, k + Math.max(1, ending.duration ?? 1) - 1));
      }
    }
    while (globals[end + 1]?.ending && globals[end + 1]?.repeatStart === undefined) {
      const next = end + 1;
      end = Math.min(count - 1, next + Math.max(1, globals[next]!.ending!.duration ?? 1) - 1);
    }
    for (let k = at + 1; k <= end; k++)
      if (globals[k]?.repeatEnd) times = Math.max(times, globals[k]!.repeatEnd!.times ?? 2);
    const offered = Array.from({ length: Math.min(cap, Math.max(1, times)) }, (_, n) => n + 1);
    if (times > cap) diagnose('cap', at, `Available iterations limited to ${cap}.`);
    for (let k = start; k <= end; k++) {
      availableIterations[k] = offered;
      inStrain[k] = true;
      strainEnd[k] = end;
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
  let publishedJumpTaken = false; // published MNX defines one unqualified jump route
  const takenJumps = new Set<string>();
  let fineArmed = false;
  let armedCoda: string | undefined;
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
    // A numbered volta not for this iteration: step over its whole span,
    // repeat barlines and all.
    const endingStart = endingAt[i];
    const ending = endingStart === undefined ? undefined : globals[endingStart]?.ending;
    const endingEnd = endingStart === undefined ? i : endingStart + Math.max(1, ending?.duration ?? 1) - 1;
    const numbers = ending?.numbers;
    if (numbers && numbers.length > 0 && !numbers.includes(iteration)) {
      from = undefined;
      // Skipping the strain's last ending leaves the strain — unless that ending holds the repeat
      // sign closing it and passes remain, when the pass repeats anyway: |: A |2. B :|x3 is
      // A, A B, A (Soundslice reads it so; Sun Did Glide). An open "3." with no repeat sign of its
      // own (the spec's alternate-endings examples) still just leaves.
      if (strainEnd[i] !== undefined && endingEnd >= strainEnd[i]!) {
        let closing: { times?: number } | undefined;
        for (let k = endingEnd; k >= (endingStart ?? i) && !closing; k--) closing = globals[k]?.repeatEnd;
        if (closing && iteration < (closing.times ?? 2)) {
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
      i = endingEnd + 1;
      arrival = 'ending';
      continue;
    }
    // Only the volta that closes its strain resolves it. Guitar Pro chains
    // voltas through a strain (1.4. | 1.3.4. | 1.–4. :|x4), and resetting on
    // an inner one's exit would loop the strain forever.
    if (numbers && numbers.length > 0 && (strainEnd[i] === undefined || endingEnd >= strainEnd[i]!))
      endingExit = endingEnd;

    const entry: PerformedEntry = {
      ordinal: order.length, measureIndex: i, occurrence: ++passCounts[i]!, iteration,
      verse: lastVerse[i] = Math.max(iteration, lastVerse[i]! + 1),
      ...(from ? { from: [...from] as [number, number] } : {}),
      ...(arrival ? { via: arrival } : {})
    };
    entries.push(entry);
    order.push(i);
    arrival = undefined;
    if (!soundingPasses[i]!.includes(iteration)) soundingPasses[i]!.push(iteration);

    // A repeat closing here is finished before the bar's Fine or jump is
    // honoured — unless the bar sits in a numbered ending, whose own pass is
    // the one the jump belongs to.
    const loopsBack = measure.repeatEnd !== undefined && iteration < (measure.repeatEnd.times ?? 2);
    if (loopsBack && !(numbers && numbers.length > 0)) {
      i = repeatStartIndex;
      iteration += 1;
      viaLoop = true;
      arrival = 'loop';
      from = undefined;
      continue;
    }

    const navigation = measureNavigation(measure);
    const fine = navigation.marks.find(mark => mark.kind === 'fine'
      && (!from || atOrAfter(mark.location.fraction, from)));
    if (fineArmed && fine) {
      entry.until = [...fine.location.fraction];
      entry.via = 'fine';
      break;
    }
    from = undefined;
    const transfer = armedCoda
      ? navigation.jumps.find(jump => jump.type === 'toCoda' && jump.target === armedCoda)
      : undefined;
    if (transfer) {
      const destination = navigationMarkById(globals, armedCoda);
      entry.until = [...transfer.location.fraction];
      if (!destination) {
        diagnose('jump-without-target', i, `To Coda references missing target "${armedCoda}"; continuing in written order.`);
        armedCoda = undefined;
      } else {
        i = destination.measureIndex;
        from = [...destination.mark.location.fraction];
        armedCoda = undefined;
        arrival = 'jump';
        iteration = 1;
        repeatStartIndex = startAt[i]!;
        endingExit = null;
        continue;
      }
    }
    const returnJump = navigation.jumps
      .map((jump, index) => ({ jump, key: `${i}:${index}` }))
      .find(candidate => candidate.jump.type !== 'toCoda'
        && !(candidate.jump.source === 'published' && publishedJumpTaken)
        && !takenJumps.has(candidate.key));
    if (returnJump) {
      takenJumps.add(returnJump.key);
      if (returnJump.jump.source === 'published') publishedJumpTaken = true;
      const jump = returnJump.jump;
      entry.until = [...jump.location.fraction];
      fineArmed = jump.type === 'dsalfine' || jump.type === 'daCapoAlFine'
        || jump.type === 'dalSegnoAlFine';
      armedCoda = jump.type === 'daCapoAlCoda' || jump.type === 'dalSegnoAlCoda'
        ? jump.resumeAt : undefined;
      const destination = returnDestination(globals, jump, segno);
      if (!destination) {
        const needsSegno = jump.target === undefined
          && (jump.type === 'segno' || jump.type === 'dsalfine'
            || jump.type === 'dalSegno' || jump.type === 'dalSegnoAlFine'
            || jump.type === 'dalSegnoAlCoda');
        diagnose(needsSegno ? 'jump-without-segno' : 'jump-without-target', i,
          needsSegno ? 'Jump has no matching segno; returning to the beginning.'
            : 'Jump target is missing; returning to the beginning.');
      }
      i = destination?.measureIndex ?? 0;
      from = destination ? [...destination.location] : undefined;
      arrival = 'jump';
      iteration = 1;
      repeatStartIndex = startAt[i]!;
      endingExit = null;
      continue;
    }
    if (measure.repeatEnd !== undefined) {
      if (loopsBack) {
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

function returnDestination(
  measures: NonNullable<MnxStructure['global']>['measures'],
  jump: NavigationJump,
  firstSegno: number
): { measureIndex: number; location: [number, number] } | undefined {
  if (jump.type === 'daCapo' || jump.type === 'daCapoAlFine' || jump.type === 'daCapoAlCoda')
    return { measureIndex: 0, location: [0, 1] };
  const explicit = navigationMarkById(measures, jump.target);
  if (jump.target !== undefined)
    return explicit ? { measureIndex: explicit.measureIndex, location: explicit.mark.location.fraction } : undefined;
  if (firstSegno >= 0) {
    const mark = measureNavigation(measures[firstSegno]!).marks.find(candidate => candidate.kind === 'segno');
    return { measureIndex: firstSegno, location: mark?.location.fraction ?? [0, 1] };
  }
  return undefined;
}
