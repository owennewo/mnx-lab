# Heading marks lead the bar's opening ink, not its content anchor

> **Status: COMPLETE 2026-09-09** — built and landed the day it was reported, worktree
> retired. Eight goldens moved, all already `rendered`; the batch is registered in
> [lab-verify.md](../inprogress/lab-verify.md#heading-marks-lead-the-bars-opening-ink--2026-09-09).
>
> Reported from the tab view of `lab/tab-derivation/capo` with the clef and time
> signature hidden: *"capo starts too far to left"*.

## The complaint

Everything a bar prints above its own start — the metronome mark, the section and
rehearsal labels, the swing marking, the tab capo line — shares one anchor,
`measureHeadingX`. With a clef and a time signature on show the placement reads right.
Hide both, and `Capo 2` drifts left into blank staff, unattached to anything.

## Why: `contentStartX` is not the first ink

The rule was:

```ts
return m.showTimeSig ? m.timeSigCentreX - 1.25 : m.contentStartX - 1.5;
```

`contentStartX` is where the bar's **stretched leading spring** ends, not where its
first note is drawn. The two coincide only loosely: a column has its own left padding
and a notehead is centred on its slot, so the first ink lands a further 1.9sp right in
the reported case. And when the prefix is empty, `contentStartX` collapses back toward
the barline, so `− 1.5` walks past it.

Both symptoms are that one fact:

| bar | heading | first onset | reads as |
|---|---|---|---|
| clef + time signature | 6.10 | 13.25 | correct — the prefix sits under the mark |
| both hidden | 4.35 | 7.75 | floating in blank staff |
| mid-system, dense | 54.08 | 56.2 | **left of its own barline** (54.33) |

The third row is the same bug with a short spring, and it was live in the shipped
default view — not only under the display switches. It surfaced while
[core-swing-feel.md](core-swing-feel.md) was being built, when a swing marking on a
mid-system bar was attributed to the bar before it.

## The rule now

Lead the bar's **opening ink**, whatever that turns out to be:

- a forward repeat → the content anchor, which already clears the whole `|:` cluster;
- a time signature → its centre, less 1.25 (the numerals are the widest prefix glyph);
- a clef or key signature → the content, less 1.5 (just past them);
- **nothing at all** → the **first onset**, less 1.5.

And `m.x` is a floor, never a placement: a heading mark cannot precede its own barline
whatever the geometry. The floor should now be unreachable; it stays because a rule that
can only ever be wrong in one direction should say so.

## What building it taught

- **The bug was in the shipped view too.** The report was about the display switches,
  and the switches are what make it *visible* — but the invariant test fails on
  `spec/full-measure-rests` at default settings. A mid-piece bar has no prefix either;
  hiding the prefix just makes every bar look like a mid-piece bar.
- **The first onset was already in the plan.** `m.voices` carries the columns
  `emitHarmonies` uses to place chord symbols, so the fix needed no new geometry — only
  to ask the plan the right question.
- **The invariant is cheap and total.** `heading-marks.test.ts` checks the rule over
  every bar of the corpus under all four combinations of the two switches — about 1,900
  bars — at the plan level, without laying anything out. Reverting the rule fails it in
  both arms.

## Not done

- **The prefix arm still leads `contentStartX` rather than the clef's own right edge.**
  It is defensible (the mark should clear the prefix, and the content anchor does), and
  the user calls the result correct, so it was left alone — but it means a bar with a
  clef and no time signature places its mark by a different measurement than one with a
  time signature. If either ever looks wrong, that is the seam.
