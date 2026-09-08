# Traversal — extend the pass model with ordinal, occurrence and bounds

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 1. First, because every
> other item consumes it and it can be verified with no audio.
> **This extends `src/model/passes.ts`; it does not write a second walker.**

## Agreement block (campaign contract)

- **Pure before audible (§1).** `model/passes.ts` stays the one linearisation. Its
  header already names three consumers — the player, lyric tooling, diagnostics — so
  they cannot disagree at the edges. `linearizePasses` keeps its signature and its
  `PassModel` fields; the extension adds to the result, and `edit/lyricText.ts` runs
  unchanged.
- **Identities (§3).** The output names all three: **ordinal** (position in `order`),
  **occurrence** (the nth sounding of this written bar, 1-based) and **iteration**
  (which time through the enclosing strain — what `soundingPasses` already records per
  bar, now stated per entry).
- **Proof (§4).** Three layers. `passes.test.ts` must pass **unchanged** (its
  `order`/`passCounts`/`soundingPasses` expectations are the compatibility contract).
  New tests state the performed entries **by hand** for the 14 corpus scenarios that
  carry repeats, endings or jumps (`spec/repeats*`, `spec/jumps-*`, `spec/tie-targets`,
  `lab/40-navigation/*`, `lab/31-score-text/09`, `/10`, `lab/60-layout/02`) — written
  from reading the score, which is what makes them an oracle. Then a committed report,
  `harness/reports/traversal.json`, records the entries for every corpus document; a
  change either way is a red test (the `musicxml-oracle.json` idiom). No golden moves.
- **Dependencies (§5).** None.
- **Spec findings (§6).** Listed below; each recorded in the campaign log on landing.
- **Reviewer gain (§7).** The report makes every repeat scenario's performed order a
  diffable line; item 7 puts the same table beside the engraving.

## The extension

```ts
interface PerformedEntry {
  ordinal: number;            // index into order
  measureIndex: number;       // the written bar
  occurrence: number;         // 1-based: nth sounding of this written bar
  iteration: number;          // 1-based: which time through the enclosing strain (1 outside any strain)
  from?: [number, number];    // metric fraction where this sounding starts (segno mid-bar)
  until?: [number, number];   // where it stops (Fine or D.S. mid-bar)
  via?: 'loop' | 'ending' | 'jump' | 'fine';
}
interface PassModel {
  order: number[]; passCounts: number[]; soundingPasses: number[][]; truncated: boolean;   // unchanged
  entries: PerformedEntry[];                   // new: one per element of order
  diagnostics: PassDiagnostic[];               // new: cap fired, unmatched ending, jump with no segno, replaced repeatStart
}
```

`entries[k].measureIndex === order[k]` always; the test says so for the whole corpus.
An iteration is local repeat context, not a unique visit: after D.S., the same bar
can sound again on iteration 1. `(measureIndex, iteration)` therefore resolves to
an ordered list of candidate ordinals; `(measureIndex, occurrence)` identifies one
entry. Item 2 owns candidate selection relative to the playback ordinal. Tests include
the existing plain D.S. case, where bar index 2 occurs twice on iteration 1.

For each written bar, also expose its strain's available iterations for the inspection
chip, including iterations that skip that bar. Derive this from the repeat structure,
not `passCounts` or the length of `soundingPasses`; a first ending can sound once in a
three-iteration strain. Bars outside a strain offer iteration 1. A D.S. visit does not
invent another verse number.

## What changes in the walk

- **Partial measures.** `segno`, `fine` and `jump` carry `location.fraction`; today
  the walk treats them as whole-bar. `from`/`until` carry the fraction; item 5 slices
  content by it, item 10 badges it.
- **The recorded simplification, resolved.** On a D.S. return the walk re-enters
  numbered voltas as iteration 1; convention takes the *final* ending. The item adds
  the corpus scenario that exercises it (the header says the corpus has none), decides
  from the engraving-reader convention, and records the choice under §6. The existing
  D.S. tests do not cover this corner, so they still pass.
- **Diagnostics instead of silence** for the cases the walk already survives: a second
  `repeatStart` inside an open strain, an ending whose numbers exceed `times`, a jump
  with no segno (today: to the beginning, silently).
- Unchanged and re-asserted: `times` defaults to 2; an unmatched `:|` repeats from the
  current repeat start (initially the start of the score); a jump fires once; the return takes no repeats;
  only `dsalfine` stops at `fine`; the cap truncates and says so.

Findings the item records: no coda / D.C. vocabulary; nothing in MNX says whether a
D.S. return takes the final ending or any repeat; ending numbers versus `times`.

## Done bar

- `passes.test.ts` green unchanged; the 14 hand-stated entry lists pass; the report
  covers every corpus document; `update:primitives` leaves `scenarios/` clean.
- `lyricText.ts` untouched and its tests green.
