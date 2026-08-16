# The tail — emptying the `no-op` column

> **Status: built 2026-08-15.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md). Not an indexed
> item but the sweep of everything the board still called "no verb exists":
> 26 elements across seven kinds, taken in one pass.

## What landed

| kind | was | now | how |
|---|---|---|---|
| `space` | 2 no-op | removable | **`itemSpan` was reading it wrong** — see below |
| `beam` (in a grace) | 4 no-op | removable | the owner search looks inside containers |
| `ottava` | 1 no-op | removable | joins the positioned family (dynamics' verb) |
| `kit-note` | 4 no-op | removable | percussion enters the grid |
| `kit-component`, `sound` | 2 no-op | **refused** | guarded: removable once nothing plays them |
| `accidental-display` | 7 no-op | removable | set/remove; *spelling* stays undrafted |
| `clef` (mid-measure) | 1 no-op | removable | addressed by its onset |

**Corpus: 1,415 → 1,434 removed of 1,460, and the `no-op` column is down to
seven notes.**

## The `space` bug, third time lucky

A `space` had blocked three separate pieces of work — the container verb, the
time-signature removal, the rest-spelling attempt — and each time the diagnosis
stopped at "`itemSpan` counts it as zero". The actual cause: **`space.duration`
is a rhythmic fraction (`[1, 4]`), not the `{base, dots}` every other item
carries**, so reading it with `durationSpan` produced nothing. One mis-read
field, three blocked features, and the campaign's own notes had recorded the
symptom twice without anyone checking the shape.

Removing a space then exposed a second thing: `padMeasureRests` fills only the
**entry** sequence, so a space in voice 2 left that voice short. Containers now
pad the sequence they actually left.

## Percussion is ink, so it belongs in the grid

Kit notes were drawn and unreachable — the grid builds slots from `notes`, and a
kit part has `kitNotes`. They now get slots, keyed `@m0.v0.e0.k0` (a `k`, since
they are a different list on the event), with their line taken from the
component's declared staff position. Removing a *component* or a *sound* is
guarded the way containers are: removable once nothing references them, because
the alternative is orphaning ink.

## Three of the seven closed (2026-08-15)

Diagnosed rather than guessed, and they were three different bugs, not one:

- **`spec/ottavas-8va`** — the line clamp. `STAFF_POSITION_RANGE` was a hard
  ±16, and an 8va note sits at staff position **17**: ink the renderer had
  drawn and the cursor could not travel to. Now ±24.
- **`spec/multiple-voices` ×2** — ←→ at the note rung is **voice-sticky** by
  design, so a second voice's unshared onsets are unreachable by walking. The
  sweep now uses the **voice jump**, which is what a player does.
- The remaining four have one cause, and it is a ladder question rather than a
  sweep one — see below.

## The four that remain, named

`lab/edge-cases/bar-duration-mismatch` ×3 and `spec/tie-targets` ×1, all for the
same reason: **the ink walk re-anchors mid-walk**. `movePositionInk` takes its
anchor voice from whichever slot comes first on the cursor's line, so when two
voices share a line at one onset the walk can continue in the *other* voice and
skip the rest of the one being read. In the mis-summing bar that strands the
notes past the meter; in `tie-targets` it strands voice 1's note at 1/8.

That is the same coincidence problem the cursor's `slotIndex` fixed for
*addressing*, now showing up in *walking* — and the fix belongs to
[core-selection-ladder.md](../complete/core-selection-ladder.md)'s per-level pass, which
owns what ←→ means at the note rung. Recorded there.


All notes, all in edge cases where the cursor's onset walk cannot reach the
note's position:

- `lab/edge-cases/bar-duration-mismatch` ×3 — a bar that deliberately does not
  sum to its meter, so the grid's positions and the walk's expectations diverge.
- `spec/multiple-voices` ×2 and `spec/tie-targets` ×1 — a second voice whose
  onsets the entry voice does not share.
- `spec/ottavas-8va` ×1.


