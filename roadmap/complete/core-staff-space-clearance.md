# Staff and Space own score whitespace

Status: complete (2026-09-15).
Serves: implementation loop — shared engine and both shells.

## Contract

Staff controls symbol size and vertical proportions. Space controls horizontal
spread: rhythmic springs, horizontal margins, prefix air and bar-boundary pads.
Remove Clearance from the product controls. Retain measured ink bounds, collision
protection, lyric ownership and the different gaps for paired tab, independent
staves and systems. Vertical gaps stay at their existing default staff-space
values: the SVG already scales them with Staff, so multiplying again is wrong.

| Relationship | Owner |
| --- | --- |
| Paired notation/tab | Staff |
| Other staves in a system | Staff |
| Between systems | Staff |
| Top/bottom margins and crop | Staff |
| Lyrics to staff | Staff |
| Left/right margins | Space, restrained curve |
| Clef/key/time padding | Space; glyph widths remain Staff-owned |
| Start/end of bar padding | Space; repeat geometry remains Staff-owned |

## Implementation

1. Introduce a shared horizontal whitespace policy in the horizontal planner.
   Preserve density 1 arithmetic exactly. Use positive padding floors and a
   gentler response than rhythmic springs; keep margins bounded.
2. Carry enough serializable policy information in packing snapshots to re-price
   horizontal whitespace at another density. Packing, placement, density ladders
   and gesture workers must agree on whitespace. Preserve the existing approximation
   for cross-density governing-voice changes at non-square ink scaling; solving
   that rejected wider problem is outside this policy change.
3. Remove Clearance from ZoomPad and ScoreFrame and both shells' wiring. Ignore
   old saved clearance preferences in Studio, Workbench and PDF export. Retain
   explicit legacy engine/viewer clearance and densityPad inputs: explicit
   clearance (including 2) or densityPad keeps the historical independent policy;
   an omitted clearance uses the new horizontal Space policy.
4. Test padding response, fixed vertical proportions, prefix/repeat safety,
   packing snapshot agreement and migration. Visually inspect representative
   Notation/Tab/Both scores at narrow/wide widths and both spacing modes.
5. Regenerate default goldens and require a clean scenarios diff; run all landing
   gates after rebasing. Record any actual golden debt in lab-verify before closing.

The 0–8 UI scale is a subsequent calibration decision, not part of this change.
Existing numerical Staff/Space controls and Auto fitting remain. No MNX/schema
change. Compatibility controls are not used by the product shells.

## Acceptance

Default engravings are byte-identical. Space adjusts horizontal discretionary air
without directly changing vertical gap constants or symbol size. Staff scales
vertical gaps once. Hidden prefixes and bare repeats do not acquire phantom air.
Cached whitespace resolution matches fresh layouts at other densities; full
packing agreement is exact for square ink and at the current non-square density. Legacy
explicit clearance and explicit densityPad preserve their established behaviour.

## Outcome

Implemented in `af5a1b0`. Staff now owns vertical proportions and Space owns
horizontal discretionary air in the default policy. The product Clearance slider
and its event/property wiring are removed. A shared preference normalizer drops
saved Clearance from both shells and PDF export. Explicit viewer/engine host
overrides remain compatible, including an explicit Clearance 2.

Horizontal padding follows sqrt(Space), floored at 0.15sp; margins follow the
fourth root, bounded to 1–3sp. The existing prefix-tail anchors remain. Packing
snapshots carry serializable prefix-air descriptors and source density; signatures
include resolved air, so a justified layout can respond without changing bar count.

Validation:

- All 1,865 tests passed after rebase; corpus policing and production build passed.
- `update:primitives` passed all 191 checks with a clean `git diff -- scenarios/`.
  No golden moved, so there is no verification batch to register.
- Headless Chrome checked saved-preference migration and the two-button pad footer.
  All 36 rendering cases passed: Notation/Tab/Both × Natural/Fill × Space
  0.01/1/8 × 700/1280px. Captured tight/default/spacious engravings were visually
  inspected in all three views, including narrow panes.
- Engine regressions cover glyph/vertical geometry, repeat boundaries, positive
  horizontal padding, legacy overrides and cloned packing snapshots. Browser
  preference checks stay outside the harness's prohibited shell imports.

Learning: full cross-density packing comparison at non-square ink exposed the
already documented governing-voice approximation. It is preserved, not silently
claimed fixed: whitespace resolution is current, but a different governing voice
can change the predicted line breaks. Square-ink predictions and current-density
non-square predictions are tested against fresh layouts.

The implementation worktree was retired before this document moved to complete.
The 0–8 control scale remains a separate calibration decision, as agreed in the
implementation scope.
That decision is now filed as
[core-space-units-sp.md](../inprogress/core-space-units-sp.md) (2026-09-15): Space in
staff spaces with a clamped line per consumer, zero reachable, goldens recalibrated.
