# The unrolled view — the traversal, engraved

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 3. Independent of item 2 and
> of the sound source; needs item 1. **Drafted as a toggle**, not a fourth view mode —
> see the campaign's open decisions.

## Agreement block (campaign contract)

- **Pure before audible (§1).** The layout engines take an optional `walk:
  PerformedMeasure[]`; with none they lay out document order and emit exactly what they
  emit today. The toggle is presentation state in the viewer, never persisted into a
  document.
- **Identity (§3).** A note key now appears once per pass. This item introduces the
  **pass-qualified key** in `model/noteKeys.ts` — `occurrenceKey(noteKey, pass)` — and
  the inverse. Primitives carry it in `sourceId` when laid out from a walk; the viewer's
  highlight set and the note↔JSON cross-highlight (`model/jsonView.ts`, kept in lockstep
  per [docs/rendering.md](../../docs/rendering.md)) map every occurrence back to the
  **written** note. Selecting a note selects the written note; all its occurrences light.
- **Proof (§4).** The toggle defaults off, so **no existing golden moves** — that is the
  point of a toggle. New goldens are **opt-in**, the way `expected.both.svg` is: the 14
  navigation scenarios gain `expected.unrolled.svg` (the notation view unrolled; tab-
  opting ones also `expected.unrolled.tab.svg`), hashed as their own `unrolledHash` in
  the verification record. The `/verify` review page shows them beside the written
  engraving. The batch is registered in [lab-verify.md](../inprogress/lab-verify.md).
- **Dependencies (§5).** None.
- **Reviewer gain (§7).** The performed order is on the page. A wrong volta rule is a
  bar drawn in the wrong place, which a reviewer sees in a second and a listener might
  not hear in ten.

## Design

- **What changes in the walk.** Repeat barlines draw as regular; ending brackets,
  segno, Fine and D.S. glyphs are omitted (their consequences are what is being drawn);
  a **pass label** sits above the first beat of any bar on pass ≥ 2 (`2×` small text,
  scoreText band); the displayed bar number stays the **written** number so the reader
  can find it. Partial measures (`from`/`until`) are drawn whole with a per-measure
  badge — the forgiving-render rule; slicing a bar's content is item 4's problem, not
  layout's.
- **Where.** `engine/layout/{notation,tab}.ts` and the `both` walk take the sequence
  from one place — a `measureWalk(doc, walk?)` helper — so the three views cannot
  disagree about order. Spacing is untouched: `spacing.ts` sees measures, not passes.
- **Surface.** One toggle in the viewer's view controls, deep-linked as
  `?view=both&unrolled=1` so a review page link is stable.
- **What it is not.** Not a new `ViewMode`; not a document transformation; not a
  spacing change. Multi-measure rests and system breaks from `layouts` follow written
  order and are ignored when unrolled — badge, not clamp.

## Done bar

- Toggle off: `update:primitives` clean. Toggle on: the 14 opt-in goldens generated,
  queued, and registered in the ledger with "look for: bar order matches the hand-
  stated order in `traversal.test.ts`; pass labels only on pass ≥ 2".
- `note-keys.test.ts` extended: every `sourceId` in an unrolled layout resolves to a
  written note, and the set of written notes reached equals the document's.
