# Retire the bar-attribute popover — one-surface campaign item 4

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 4 — the largest census of the easy five, and the one that repaired the
> seam its predecessors flagged.

## The census (contract §1)

- **Grammar** — `parseBarAttribute` end to end: every measure-attribute kind
  (words derived from `MEASURE_ATTRIBUTE_FIELDS` — barline, repeats, ending,
  segno/fine/jump with `at N/D` and glyph forms, tempo, number, fermata,
  rehearsal, section, harmony), the `no <attribute>` removal token, **and the
  two rhythm riders** the popover carried as a surface — `full-measure rest
  [duration]`, `measure repeat N [counter]`, with removals. Six intents in its
  `SURFACE_INTENTS` credit.
- **Surfaces** — the usual six files, plus the campaign's biggest tile bill:
  **six popover-tier tiles** — `ending`, `rehearsal`, `tempo`,
  `measure-repeat`, `section` (measure) and `full-measure-rest` (voiceMeasure).
- **Traces** — none drive the popover.

## Coverage — complete, split across two rungs as the ladder wants

- **Measure**: the inspector hands the whole line to `parseBarAttribute` —
  every kind and every `no <attr>`, parity automatic — with a pill per declared
  attribute (`tempo#n` array included, already under test).
- **VoiceMeasure**: the riders, with exact intent parity (`visualDuration`,
  `number`, `counter`, removals) and pre-existing conformance coverage.

## The seam repair

The measure rung refused a typed rider with *"rhythm declarations stay with
Shift+B for now"* — a pointer to a surface this item deletes. It now reads
*"a voice-bar thing — tighten to the voice rung: full-measure rest · measure
repeat 2"*, and the conformance assertion pins the new signpost. The refusal
is part of the surface: where the popover was rung-blind (one prompt for bar
attributes *and* riders), the inspector says which rung owns what.

## The sweep

`barAttributePopover` in full; the six tiles and their group listings
(`repeats & barlines` loses `ending`/`measure-repeat`, `marks` loses
`rehearsal`/`tempo`/`section`, the voice rung's rhythm group loses
`full-measure-rest` — the intent-firing tiles `repeat-start`/`repeat-end`/
barline tiles stay, they never opened the popover). `parseBarAttribute`,
`BAR_WORDS` and both rider paths survive — the inspector consumes them at two
rungs. `BAR_ATTRIBUTE_HELP` and `parseBarAttribute` left `ScenarioPage` with
the branch.

## Learnings handed forward

- A popover that was a *surface for another rung's ops* (the riders) retires
  into a **signpost**: the refusal message is coverage too, and its test is
  the cheap way to keep it honest.
- Six tiles, three group trims, zero emptied groups — the intent-tier tiles
  keep every family visible in the tray until item 11.
- **The registry joins police the sweep** (found as two red tests): intent
  tiles built by the `barAttribute`/`barlineStyle` helpers wore the popover's
  `Shift+B` badge, and the freed key made every badge a lie — the join caught
  all six; and deleting tiles *resolved* two glyph clashes, which the
  `KNOWN_TWINS` ledger's staleness check demanded be pruned. Later items:
  expect the joins to bill you for badges and twins, not just tiles.
