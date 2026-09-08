# Practice mode — loop it, slow it, count it in

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 13. Needs items 7 and 8.
> **Studio's first player feature**, built in `elements/` so the workbench gets it
> too; the `studio-` prefix records who it serves.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Loop bounds, speed-trainer schedules and count-in are
  transport features with fake-clock tests.
- **Rational time (§2).** A loop is two rational positions on performed ordinals; a
  ramp is a list of rates per repetition.
- **Identities (§3) — the policy the first draft skipped.** The selection has
  **written** endpoints and no iteration. Mapping it to a loop needs a rule, stated
  here: the loop covers the performed span from the **first occurrence of the start
  bar on the context's current iteration** to the **last occurrence of the end bar
  on that iteration**; if the end bar is not performed on that iteration (a skipped
  ending), the element says so and offers the nearest iteration that performs both.
  The host does the mapping (`elements/` cannot see the selection); the element takes
  ordinals.
- **Proof (§4).** The loop wraps without a dropped or doubled onset (item 6's rule);
  the ramp advances per wrap; count-in emits one bar of clicks in the time signature
  at the loop start; the mapping policy has a test per case above.
- **Dependencies (§5).** None new.
- **Practice gain.** Loop a passage — the *second* time through an ending, which no
  written-order loop can say — start slow and ramp, hear a count-in, mute your part.

## Features

Loop the selection on its iteration; speed trainer (start rate, step, ceiling);
count-in and metronome as their own voice, never in the MIDI export; mute/solo per
part in the element's tray; localStorage preferences (rate, metronome, last loop per
document id) — UI preferences, which the no-backend rule permits.

## Out of scope

Recording, pitch detection, tab-along scoring — studio product decisions, none of
which enters `elements/` without a reviewed promotion.
