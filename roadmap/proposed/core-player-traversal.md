# Traversal — the performed order of a score, with pass numbers

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 1. The first item, because
> every other item consumes its output and it is the one piece of playback that can be
> verified by eye with no audio at all.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/model/traversal.ts`, one exported function over
  `MnxGlobalMeasure[]`. No engine, no audio, no DOM. The model is the floor, so this
  sits where `edit/`, `engine/` and `audio/` can all reach it.
- **Ticks (§2).** Not applicable — the traversal is in measures and fractions, never
  time. Item 4 turns it into ticks.
- **Identity (§3).** The output introduces the **pass**: the 1-based count of times a
  written measure has been performed so far. It is the reviewer-facing "repeat index"
  and the pass half of every pass-qualified key downstream.
- **Proof (§4).** Two layers. A conformance test states the performed order **by hand**
  for each of the 14 corpus scenarios that carry repeats, endings or jumps
  (`spec/repeats*`, `spec/jumps-*`, `spec/tie-targets`, `lab/40-navigation/*`,
  `lab/31-score-text/09`, `/10`, `lab/60-layout/02`) — a human wrote the expected order
  from reading the score, which is what makes it an oracle. Then a committed report,
  `harness/reports/traversal.json`, records the performed order for **every** corpus
  scenario; a change in either direction is a red test, the `musicxml-oracle.json`
  idiom. No golden file moves.
- **Dependencies (§5).** None.
- **Spec findings (§6).** Expected, listed below; each recorded in the campaign log
  when the item lands.
- **Reviewer gain (§7).** Indirect until items 2 and 3, but immediate in one place: the
  report makes every repeat scenario's performed order a diffable line, so a reviewer
  approving `repeats-alternate-endings-advanced` can read "1 2 3 2 4 5" next to the SVG.

## The output

```ts
interface PerformedMeasure {
  measureIndex: number;      // into global.measures — the written measure
  pass: number;              // 1-based: how many times this written measure has now been performed
  ordinal: number;           // 0-based position in the performed sequence
  from?: [number, number];   // metric fraction where performance of this measure starts (after a segno mid-bar)
  until?: [number, number];  // metric fraction where it stops (a Fine or D.S. mid-bar)
  via?: 'repeat' | 'ending' | 'jump' | 'fine';   // why the walk arrived here, when it was not the next bar
}
interface Traversal {
  measures: PerformedMeasure[];
  passesOf(measureIndex: number): number;          // how many times a written bar is performed
  diagnostics: TraversalDiagnostic[];              // cycle guard, unmatched ending, jump with no segno
}
```

`ordinal` is the seek unit for items 2, 6 and 7; `pass` is what the reviewer sees.

## The rules, and where MNX stops saying

The walk is a cursor over the written measures with a small stack:

- **Repeats.** `repeatStart` opens a section; `repeatEnd.times` (default 2) closes it.
  A `repeatEnd` with no preceding `repeatStart` repeats from the start of the score
  (`spec/repeats-implied-start-repeat`). Nested starts are not a thing MNX defines;
  a second `repeatStart` before a `repeatEnd` **replaces** the open one, with a
  diagnostic.
- **Endings.** An `ending` with `numbers` is performed only on the listed passes of
  the enclosing repeat and skipped otherwise; `open` endings have no closing hook but
  the same selection rule; an ending whose numbers exceed `times` extends `times`
  (the bracket is the stronger statement) — recorded as a finding.
- **Jumps.** `jump.type: 'segno'` returns to the `segno` measure (at its `location`
  fraction, hence `from`); `'dsalfine'` does the same and stops at the `fine` measure
  (at its fraction, hence `until`). A jump is taken **once**; on the second arrival the
  walk continues past it. After a jump, **repeats are not retaken** — the common
  performance convention, adopted and recorded under §6 because MNX does not say.
- **Cycle guard.** A hard cap on performed measures (16× the written count) turns a
  pathological document into a diagnostic and a truncated walk, never a hang — the
  forgiving-render rule applied to playback.

Findings the item will record: no coda / D.C. vocabulary (v17 knows `segno` and
`dsalfine` only); nothing says whether repeats are retaken after a D.S.; the
ending-numbers-versus-`times` conflict; whether a `segno` after its own D.S. is reachable.

## Done bar

- The 14 hand-stated orders pass, and the committed report covers every corpus document.
- `npm run update:primitives` leaves `git diff -- scenarios/` clean — nothing here
  touches a golden.
- The diagnostics surface through the existing per-measure badge path when item 3
  draws the unrolled view; until then they are in the report.

## Handed forward

Item 2 reads `passesOf`; item 3 lays out `measures`; item 4 assigns ticks to each
`PerformedMeasure` and slices partial measures by `from`/`until`.
