# Retire the tuning popover — one-surface campaign item 7

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 7 — the first item that had to *build* its coverage, and the first
> whose census found a bug the new surface refused to inherit.

## The census (contract §1)

- **Grammar** — `parseTuning`: eight presets (`standard`, `drop-d`, `dadgad`,
  `open-g`, `open-d`, `bass`, `ukulele`, `mandolin`) or an explicit pitch list
  low→high (3–12 strings). One intent: `setTuning`. No removal arm — stripping
  a fingerboard is the part popover's `no strings`.
- **Surfaces** — the usual six; two tiles (`tuning` at partMeasure,
  `doc-tuning` at session); the palette's `needsTab` guard, whose only user
  was tuning. No traces.

## The bug the census caught (contract §3: ops first)

`setTuning` wrote **`parts[0]` unconditionally** and the session passed no
part index — on a multi-part score, tuning the bass from its own part-bar
retuned part 0. The popover shared the bug (parity), but this item *builds*
the write surface, so it was fixed rather than logged: the op takes
`partIndex` (item-13b's widening), the session passes the cursor's part, and
the conformance test pins a two-part document tuning only the part being read.

## Coverage built

- **Typed word `tuning`** at the partMeasure rung → `setTuning` via
  `parseTuning` — offered on **any** part: the popover's `needsTab` guard was
  surface-only, and declaring a fingerboard is the user's call
  (no-instrument-assumed governs *derivation*, not declaration). The
  inspector ends strictly more capable than the popover it replaces.
- **The `strings` reading became a removable annotation pill** — value is the
  pitch list recited low string first (round-trips through `parseTuning`),
  Backspace → `removePartDeclaration {strings}`. The `reading` pill helper
  died with its last consumer.
- Evidence: `tuning drop-d` → six correctly numbered entries; pill
  read-back after the edit; the two-part cursor-write pin.

## The sweep

`tuningPopover` in full; both tiles (instrument group trimmed; `doc-tuning`
ungrouped, as item 2 predicted); the `needsTab` field, comment, palette
filter and `openPopover` guard all died with their only user; the
`session: 6stringTabClef` twin the deletion resolved was pruned pre-emptively.
**`parseTuning`/`TUNING_PRESET_NAMES` survive twice over** — the inspector
consumes the parser, and the *viewer's* instrument-override overlay (TabSetup,
presentation-only, out of campaign scope) still imports both from
`ScenarioPage`.

## Learnings handed forward

- A census can catch a bug parity would have carried: when an item **builds**
  a surface, contract §3 turns "record the wart" into "fix the op" — the
  cheap moment is before the surface exists.
- Grammar consumers are not all editing surfaces: the viewer's presentation
  overlay imports the same parser. Sweep by *reference*, not by module —
  items 9 and 10 (`parsePartDeclaration`, `parseLayoutSentence`) should grep
  before deleting imports.
