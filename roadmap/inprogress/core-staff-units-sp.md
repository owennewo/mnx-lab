# Staff in staff spaces — one affine ink line, fitted preserved

Status: in progress — implementation started 2026-09-16.
Serves: implementation loop — shared engine, `elements/`, both shells.

The Staff counterpart to
[core-space-units-sp.md](core-space-units-sp.md). Space became a directly
measured horizontal length with a line per kind of discretionary air. Staff is
simpler: the renderer deliberately has one vertical/ink currency, so its
consumers share one affine line rather than receiving independently calibrated
curves.

## Why

Staff is currently exposed as a percentage multiplier from 60% to 640%. The
number is accurate but indirect: the implementation immediately turns it into
pixels per staff space, while the rest of the engraving already speaks in staff
spaces. Space now prints its unit directly; Staff should do the same.

This is a unit change, not permission to split the engraving into unrelated
scales. Line spacing, glyphs, text, stems, vertical gaps and horizontal ink
widths must continue to grow together. A notehead stretched vertically or a
barline detached from the staff it crosses would be a regression.

## Contract

1. **The control value is Staff `x`, in canonical staff spaces.** `1sp` is the
   existing 100% request: one rendered line gap is ten CSS pixels before any
   final pane shrink. `2.2sp` is therefore the existing 220% request. The
   supported range is **0.4sp–8sp**.
2. **Fitted stays absence.** `null` still means the renderer derives a square
   scale from the viewport. It is not replaced by `1sp`; the pad reports the
   fitted value actually drawn.
3. **One affine Staff line.** The canonical consumer is
   `inkPxPerSp(x) = max(0, 10x + 0)`. Every ordinary consumer follows from it:
   a distance `d` sp draws as `10d·x`, a four-space staff as `40x`, and rigid
   ink is priced at `inkPxPerSp(x) / horizontalPxPerSp`.
4. **Proportions remain coupled.** Vertical coordinates, glyph/text sizes,
   stroke and dash dimensions, ink-width rectangles, horizontal ink offsets,
   rigid-column pricing, SVG height/crop and the document heading all read the
   same ink scale. This item does not introduce separate calibration lines for
   those categories.
5. **Existing non-linear guards remain guards.** Stroke width keeps its 1px
   legibility floor. The paper can still be scaled down by `max-width: 100%`;
   reporting converts the final on-screen pixel scale back through the Staff
   line rather than multiplying an assumed zero-intercept scale.
6. **The vertical paper padding remains fixed.** It is frame chrome, not an
   engraving measurement, and scaling 30px to 240px at `8sp` would waste the
   low-vision reader's viewport. Space continues to own only its horizontal
   factor.
7. **Public compatibility is numeric and named.** `<mnx-document-viewer
   zoom>` keeps its attribute. Renderer `staffScale`, event `staffScale`, and
   exported scale constants/functions remain deprecated aliases for one release;
   canonical code and event data use `staffSp`. Saved `staff-scale` preferences
   migrate one-for-one to `staff-sp` because the direct mapping preserves every
   stored value.
8. **Geometric stepping stays.** Staff is perceptual zoom across a 20× range;
   multiplying by 1.1 remains usable where additive sp steps would be coarse at
   the floor and invisible at the ceiling.

### Consumers

For Staff value `x`, horizontal pixel scale `kx`, primitive distance `d` and
glyph scale `a`:

| Consumer | Value | Gain `m` | Intercept `c` |
| --- | ---: | ---: | ---: |
| Vertical/ink scale | `10x` px/sp | `10` | `0` |
| Vertical distance `d` | `10d·x` px | `10d` | `0` |
| Five-line staff height | `40x` px | `40` | `0` |
| SMuFL glyph em | `40a·x` px | `40a` | `0` |
| Text size `d` | `10d·x` px | `10d` | `0` |
| Horizontal ink offset/width `d` | `10d·x` px | `10d` | `0` |
| Layout ink ratio | `(10/kx)·x` | `10/kx` | `0` |
| SVG height `d` | `10d·x` px | `10d` | `0` |
| 1.8sp document heading | `18x` px before pane shrink | `18` | `0` |

Stroke width is `max(10d·x, 1px)`, deliberately a clamped line. Tapered curves
derive a normal in drawn pixel space and the browser's final pane shrink depends
on page width; both consume the same affine ink scale but are not themselves
globally affine outputs.

## Implementation

1. Add `MIN_STAFF_SP`, `MAX_STAFF_SP`, `STAFF_LINES`, `staffLineAt`,
   `clampStaffSp`, `staffPxPerSp` and the inverse reporting helper in
   `engine/render/scale.ts`. Keep deprecated scale-name aliases.
2. Make notation, tab and both renderers accept canonical `staffSp`; retain
   `staffScale` as a lower-precedence compatibility input. Thread `staffSp`
   through the viewer, frame, pad, gesture protocol and shell state.
3. Print Staff with up to two decimals and `sp`, including MIN/MAX and gesture
   HUD. The hundredths are needed because geometric stepping from the 0.4sp
   floor first lands at 0.44sp. Keep the fitted annotation and
   asked-versus-drawn explanation.
4. Move Workbench and Studio preferences to `staff-sp`, migrating a finite
   stored `staff-scale` value one-for-one before clamping it to the new range.
   PDF export follows Studio's reader.
5. Extend the conformance suite for the affine line, inverse reporting,
   0.4/8 bounds, compatibility aliases, the 1px floor at 0.4, and collision
   safety at both ends.
6. Update the public viewer documentation. Regenerate primitives and require a
   clean scenario diff: the default/fitted rendering path is unchanged, so no
   verification batch is expected.

## Acceptance

- The pad, gesture HUD and persistence speak Staff in `sp`, range 0.4–8.
- `1sp` is byte-for-byte the old 100% request and `null` remains fitted.
- Notation, tab and both resolve Staff through the same `10x + 0` line.
- The drawn readout is obtained by inverting the affine line after pane shrink.
- No stroke drops below one pixel and compound barlines remain separated at
  `0.4sp`; rigid ink remains collision-safe at `8sp`.
- Old saved preferences and public scale-named inputs continue to work.
- `npm run update:primitives` leaves `scenarios/` clean; all landing gates pass.
