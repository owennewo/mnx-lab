# Score clearance

Status: complete (2026-09-09).
Serves: implementation loop — shared engine and display surface.

## Requirement

Add a global **Clearance** display setting for the breathing room around musical
content. It trades visible bar density (bars per row and rows per screen) against
readability without changing symbol size or rhythmic spacing rules.

The range is **0–4 in 0.5 increments**, default **2**. These are nine levels, not
staff-space distances or percentages:

| Level | Intent |
| --- | --- |
| 0 | Tightest safe layout: deliberately, almost ridiculously cramped, with no overlap or obscured content |
| 1 | Compact |
| 2 | Default: reproduce today's layout exactly |
| 3 | Spacious |
| 4 | Deliberately too spacious for most readers |

Half steps provide intermediate adjustment and need no separate names. Zero means
minimum discretionary breathing room, not zero collision protection. The numeric
scale is conventional; the useful, visible response of its steps is the contract.

## Relationship to Staff and Space

- **Staff** controls the apparent size of notation and text.
- **Space** controls the horizontal room musical time receives (rhythmic springs).
- **Clearance** controls margins and padding around content and structural groups.

Clearance must not scale rhythmic springs again, resize glyphs, or alter the line
spacing within a staff. Its distances are resolved in staff spaces so they remain
proportional to the music at different Staff settings. It can change packing, but
must not rewrite the selected Staff or Space values or implicitly track Space.

Full-row justification may redistribute horizontal space saved by a smaller
clearance. Packing changes are discrete: a step need not fit another bar or system.
Monotonicity applies to requested local clearance, not every final coordinate after
reflow. Natural and justified layouts must both use the same clearance-aware widths
for packing and placement.

## Initial scope: seven locations

| Location | Adjustable whitespace |
| --- | --- |
| Paired notation and tab | Ink-to-ink clearance and minimum nearest-staff-line gap, coordinated |
| Other staves in a system | Gaps between instruments or grand-staff staves |
| Between systems | Clearance from the lowest content of one system to the highest of the next |
| Horizontal score margins | Left/right whitespace, accounting for staff labels and other content |
| Vertical score margins | Whitespace above the first system and below the last |
| Clefs and signatures | Padding between clef/key/time groups and before the first event |
| Bar boundaries | Fixed padding before the first and after the last event |

Apply consistently in Notation, Tab, and Both, including multi-part layouts. Shared
notation/tab columns must remain aligned. Hidden prefix groups must not acquire
empty padding. Margins mean score margins, not application chrome or panel padding.
Bar-boundary work covers discretionary padding, not repeat dots or barline geometry.

Lyrics, headings, annotations, part-name/bracket separation, and internal symbol
spacing are outside this first scope. Their ink must still be measured and protected
when adjusting the seven included locations. Later expansion needs a separate
scope decision; this proposal does not authorize a broader spacing redesign.

## Baseline and existing machinery

The paired-staff changes motivating this setting were:

| Commit | Ink clearance | Minimum staff-line gap |
| --- | --- | --- |
| Before `e2cd07e` | 3sp | 4sp |
| `e2cd07e` | 2.5sp | 3.5sp |
| `92fe27e` | 2sp | 3sp |

Level 2 preserves the final row, not the older defaults. Independent staff gaps and
inter-system ink clearance currently use their own defaults; keep those distinctions.

Relevant implementation seams are `src/engine/displayOptions.ts`,
`src/engine/layout/spacing.ts`, `src/engine/layout/verticalDensity.ts`,
`src/engine/layout/notation.ts`, the shared tab layout machinery, and
`src/elements/DocumentViewer.ts`.

The engine already has a `densityPad` input affecting several of these gaps. At the
time of discussion, DocumentViewer uses `this.densityPad ?? 1`; comments and the
`padDensityFor` helper still describe an older coupling to Space. Audit actual callers
before implementation. Evolve the existing padding mechanism instead of stacking a
second multiplier over the same gaps. Specify and test precedence/compatibility for
hosts explicitly supplying `densityPad`; do not silently break that public input.

## Calibration and safety

For each included relationship, identify:

1. A tight safe minimum at level 0.
2. Its exact existing value at level 2.
3. A deliberately generous value at level 4.

Use a shared level-to-clearance policy with relationship-specific anchors. Do not
assume one universal additive distance or a `level / 2` multiplier: those can erase
hierarchy or leave several settings stuck at a safety floor. Piecewise interpolation
through the three anchors is a starting candidate; choose the final response from
rendered evidence, preserving the exact default arithmetic/output.

Increasing the level must never reduce the clearance requested at an included
location. Keep notation/tab visually grouped and systems visibly separate across
the range. Mandatory ink extents, lyrics, stems, accidentals, and markings retain
the space they require. Existing minimum constants are starting evidence, not proof
that every collision case is handled. A safety gap may remain even at zero.

## Implementation sequence

1. **Audit and inventory.** Trace the seven locations through all layout modes;
   record default values, existing scaling, floors, ownership, and callers. Resolve
   the public `densityPad` compatibility policy and remove stale coupling guidance.
2. **Engine setting and policy.** Add a normalized display option with default 2;
   define behavior for missing, invalid, out-of-range and off-step API values. Keep
   the UI on half steps. Centralize calibration and preserve existing engine layer
   boundaries and the shared horizontal planner/tab-staff emitter.
3. **Apply the seven locations.** Separate discretionary air from mandatory content
   extents. Feed resolved widths into both packing and placement, including any
   density-ladder/packing snapshots, so control predictions match rendering.
4. **Expose the control.** Add Clearance to the existing score display settings with
   the 0–4 range, half steps, visible value, and reset to 2. Follow existing preference
   persistence and public viewer/library conventions; keep it out of MNX documents.
   Provide concise help explaining breathing room and the tightest-safe endpoint.
5. **Calibrate and review.** Compare every level on representative scores, with
   focused side-by-side inspection of 0, 2, and 4. Tune per-location anchors until
   the endpoints and intermediate steps meet the intent.

## Evidence and acceptance

- Omitted clearance and explicit level 2 reproduce the existing default corpus
  byte-for-byte. Run `npm run update:primitives` and require a clean
  `git diff -- scenarios/`; a changed default is a regression, not an approval batch.
- Test the shared policy's defaults, normalization, anchors, and monotonicity; test
  meaningful layout geometry and packing consistency rather than mirroring formulas.
- Inspect sparse and dense music, low notes/downward stems, lyrics and markings,
  clef/key/time changes, hidden prefixes, repeats, multi-staff/multi-part scores,
  and multiple systems in Notation/Tab/Both. Include narrow and wide viewports,
  representative Staff and Space extremes, and Natural and justified spacing.
- At 0, no new unintended overlaps, clipping, or obscured content; pair/group
  identity remains readable. At 4, the added whitespace is conspicuously generous.
  Every half step should make a useful overall adjustment on representative scores,
  without requiring every score to change its bar count at every step.
- Staff and Space retain their values and responsibilities when Clearance changes.
  Reload/reset and host-supplied settings behave according to the documented policy.
- Nondefault visual evidence must not overwrite default goldens. Use the existing
  harness's supported evidence route; any new or changed goldens requiring human
  approval get a linked batch in `roadmap/inprogress/lab-verify.md`. Never hand-write
  verification records or statuses.
- Complete the normal landing gates: `npm test`, `npm run check:scenarios`, and
  `npm run build`. Update rendering and viewer-surface documentation with the final
  setting and compatibility contract.

## Outcome

Completed in `2074dbb`. A shared clearance policy now calibrates the seven agreed
relationships through tight, historical and spacious anchors. The workbench exposes
and persists the nine-level slider; the viewer and library surface accept the same
display option. Explicit `densityPad` retains its historical behavior and takes
precedence without compounding.

The collision pass required one implementation refinement: at aggressive levels,
moving rows can cause overhanging ink to cross the midpoint used for row ownership.
Nondefault clearance therefore re-measures until ownership stabilizes while keeping
the first pass's outer-margin target fixed. This gives level 0 a measured 1.5sp
inter-system request and at least 0.5sp observed ink separation in the stress corpus.

All nine levels were inspected in Notation, Tab and Both; 0 is deliberately cramped
and 4 deliberately generous. The new regression suite covers normalization,
monotonic response, stable row ownership, actual staff gaps, packing consistency,
lyrics/markings, hidden prefixes, Natural/Fill and Staff/Space extremes. The complete
suite passed (1,453 tests after the final rebase), as did corpus and build gates.
`update:primitives` produced no scenario diff: omitted Clearance and level 2 remain
byte-identical, so there is no verification debt to register.

Amended later on 2026-09-09: level 0's outer score margins were halved from
0.2sp to 0.1sp. Staff and system safety gaps, intermediate anchors, and the
byte-identical level 2 default are unchanged.
