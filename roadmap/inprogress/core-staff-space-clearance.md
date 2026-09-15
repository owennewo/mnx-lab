# Staff and Space own score whitespace

Status: in progress (2026-09-15).
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

Pending implementation and validation.
