# Space in staff spaces — a clamped line per consumer, zero included

Status: proposed (2026-09-15).
Serves: implementation loop — shared engine, `elements/`, both shells.

The calibration decision that
[core-staff-space-clearance.md](../complete/core-staff-space-clearance.md) deferred
twice ("the 0–8 UI scale is a subsequent calibration decision"). That doc's Staff/Space
ownership table is the source of which whitespace Space owns and is not repeated here.
This doc changes what the Space number **is**, what each consumer does with it, and lets
it reach zero.

## Why

Space today is a multiplier `densityH`, default 1, clamped to 0.01–8. Three things are
wrong with it as a control, and one as a design:

- **Zero is unreachable.** The engine floor of 0.01 already makes rhythmic springs
  effectively zero (0.02sp after a quarter), but the horizontal margin bottoms out at
  1sp and the four prefix pads at 0.15sp. "As tight as possible" is blocked by those
  floors, not by the springs.
- **The number means nothing to a reader.** 100% is a ratio to a constant nobody sees.
- **The default sits at the bottom of the range** (1 in 0–8) and most of the top half is
  inert on a long score, which is why the ladder exists.
- **Consumers respond through unrelated curves** — springs linearly, pads by square
  root, margins by fourth root bounded 1–3 — chosen so that discretionary air responds
  more gently than time. That intent is right; the mechanism is three special cases.

## Contract

1. **The unit is staff spaces.** Space is `x`, in sp, from **0** to a ceiling fixed by
   calibration (§Calibration). `x` is defined as the air after a quarter note, so
   "Space 2.2" reads as *a quarter is followed by 2.2 spaces before the next column*.
   Every other consumer is a line in `x`.
2. **One shape for every consumer.** Each horizontal consumer of Space is a clamped
   line: `value(x) = max(0, m·x + c)`. Two numbers per consumer, read as *what remains
   at zero* (`c`, the tightest engraving) and *how fast this kind of air grows* (`m`).
   A consumer that should collapse before the springs do has `c < 0` and the clamp; one
   that keeps a floor has `c > 0`. The square-root and fourth-root curves and the 1–3sp
   margin bounds are deleted; the slope and intercept are the bounds.
3. **No identity with today's engraving.** This is a recalibration, not a refactor.
   Default engravings **will move**; the whole corpus is one verification batch,
   registered in [lab-verify.md](../inprogress/lab-verify.md) before this doc closes.
   The clearance doc's byte-identity was that item's choice, not a rule inherited here.
4. **Rigid columns stay rigid.** Notehead and fret columns, accidental slots, grace and
   tremolo advances, prefix glyph slots and repeat geometry are not consumers of Space
   and do not move (core-zoom-density-pad.md ruling 1). At `x = 0` columns abut; nothing
   overlaps, at any value — the existing collision assertion keeps holding.
5. **Vertical is untouched.** Staff owns every vertical gap and the top/bottom margins
   (clearance doc's table). Nothing here reads `x` for a vertical number.
6. **Legacy host inputs stay as they are.** An explicit `clearance` or `densityPad` from
   host code keeps its multiplier policy through `clearanceSpacing`. The product shells
   do not use it. Retiring it is a separate decision.
7. **The LLM loop is unaffected.** Space is a layout preference, never document data.
   No MNX or `_x.mnxLab` change.

### Consumers and their two numbers

Provisional. `m` and `c` are chosen by eye in §Calibration; the *shape* of each row is
the contract. Today's values are given only so the reader knows the starting point.

| Consumer | Today | Shape under `x` |
| --- | --- | --- |
| Spring per duration | `max(0.8, 2.2·(1 + 0.5·log2(dur/¼))) × d` | `max(0, m(dur)·x + c(dur))` — both may depend on duration, so a small `c(dur)` can keep a whole note wider than an eighth even at zero |
| Leading spring (barline → first event) | half the first event's spring × d | its own line, or a fixed ratio of the first event's line — one of the two, decided in calibration |
| Content-left / start-barline / key-sig-right / content-right pads | 0.6 / 0.5 / 0.5 / 0.8, × √d, floor 0.15 | one line each, `c = 0` unless calibration says a glyph needs a floor |
| Prefix group extra | 0 at d=1, −0.15 at the floor, +1.2 at the ceiling (V-shaped) | one line, or deleted — a V is not a line and its job was to soften the root curves |
| Horizontal margin | `clamp(2·d^¼, 1, 3)` | one line with the clamp; expected `c < 0` so the margin reaches zero while notes keep a little air |
| Ink pricing, justification stretch/squeeze, `MAX_STRETCH` | multiply or cap the springs after Space | not consumers — unchanged in kind |

The intercept vector `c` **is** the zero engraving. Calibrating starts there.

## Implementation

Every touch point is one the clearance change already went through; the list is the
inventory from the 2026-09-15 trace, in `src/engine/layout/spacing.ts` unless said.

1. **Policy.** `horizontalWhitespace(x)` becomes the table of lines. The four pads, the
   group extra and the margin read from it. `packingAtSpace` re-prices a snapshot by
   evaluating the policy at two `x` values and differencing, so the ladder, the density
   worker and the layout worker follow without change in kind.
2. **Springs.** `springSp(duration)` takes `x`. The one-pass multiply over finished
   metrics becomes the one-pass evaluation of the line. The planner currently recovers
   unscaled springs for the packing snapshot by **dividing** by the multiplier — NaN at
   `x = 0`. Keep the unscaled copy instead of dividing.
3. **Range.** `MIN_DENSITY` becomes 0. `MAX_DENSITY` becomes the calibrated ceiling in
   sp. The ladder grid becomes a step in sp rather than 1% of a multiplier;
   `DENSITY_STEP`/`DENSITY_GRID` likewise. The `=== 1` shortcuts (the second plan for
   `naturalWidthSp` in notation, tab and both; the pad identity) become `=== DEFAULT`.
4. **Elements.** `DocumentViewer`'s three presets, `ZoomPad`'s readout and minimum step,
   and `gestures.ts`'s walker move to sp. The readout prints `x` with one decimal and a
   unit; percent parsing goes. The MIN/MAX band logic is unchanged.
5. **Shells.** Studio's `mnx-studio.density-h` and workbench's `mnx-lab.density-h` store
   a multiplier today. The preference normalizer built for the clearance removal drops or
   converts the old value (`x = old × 2.2` is the honest conversion; dropping is simpler
   and the value is a convenience). PDF export reads the same key and follows.
6. **Tests.** The floor, ladder-start and ladder-length assertions in
   `harness/conformance/zoom-density.test.ts` change. A new test pins the table: each
   consumer's `m`/`c`, the clamp at zero, no overlap at `x = 0`, and snapshot re-pricing
   agreeing with a fresh plan at `x = 0` and at the ceiling.
7. **Goldens.** `npm run update:primitives`; every demotion is expected. Register the
   batch in lab-verify (cause: Space recalibration; set: every scenario with a moved
   golden; look for: prefix air, first-note-after-barline gap, margins, and that rhythm
   proportion at the default still reads) with a two-way link to this doc.

## Calibration

Done by looking, not by preserving. The clearance work's 36-case grid is the instrument:
Notation / Tab / Both × Natural / Fill × three Space values × 700 / 1280px. The three
values here are **0**, the candidate default, and the candidate ceiling.

Order matters:

1. **Fix the zero engraving first** — the `c` vector. Margin 0 is a requirement. Zero
   note air is the experiment; if it reads badly, that is a `c(dur) > 0` finding, not a
   reason to raise the floor of `x`.
2. **Choose the default `x`**, then slopes that make the default read like today's
   default *or better* — today is a reference, not a target.
3. **Choose the ceiling** from the ladder on a short score: the value where a system
   holds one bar is the honest top (twelve-bar-blues reached that at 4× today, ≈ 8.8sp
   after a quarter). 4sp is the opening candidate; it is 1.8× today's default.

Out of scope: Staff (the other axis gets its own doc when its turn comes — "one
dimension at a time"), the legacy clearance path, any vertical number.

## Acceptance

- `x = 0` engraves with zero horizontal margin and no overlapping glyph columns, in all
  three views and both spacing modes.
- Every consumer is a clamped line; no root curve or hard-coded margin bound remains in
  the default policy.
- The pad reads and writes Space in sp; a stored multiplier from before this change does
  not produce a wrong engraving.
- Ladder, worker and fresh plans agree at 0, the default and the ceiling.
- The corpus batch is registered in lab-verify with this doc linked both ways; the
  worktree is retired before this doc moves to `complete/`.
