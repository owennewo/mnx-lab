# Practice mode — loop it, slow it, count it in

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 13. Needs items 7 and 8.
> **Studio's first player feature**, built in `elements/` so the workbench gets it
> too; the `studio-` prefix records who it serves.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Loop bounds, speed-trainer schedules and count-in are
  transport features with fake-clock tests.
- **Rational time (§2).** A loop is two rational positions on performed ordinals; a
  ramp is a list of rates per repetition.
- **Identities (§3) — the policy the first draft skipped.** The selection has
  **written** endpoints and no iteration. Mapping it to a loop needs a rule, stated
  here: preserve the written endpoints' metric offsets and find their performed
  candidates, excluding points outside partial-entry bounds. Select the start candidate
  on the inspection iteration at/after the live ordinal (or the first if stopped).
  If none exists, require an explicit choice from available start occurrences; do not
  wrap silently. Select the earliest end candidate **after that concrete start**, not
  the last candidate with the same iteration number. The end may be on another
  iteration or strain: a range from first ending to second ending necessarily crosses
  a repeat. Preview the concrete start/end ordinals, iterations and intervening bar
  order before setting such a loop. A missing endpoint or no positive-duration span
  disables loop creation with a reason; never reverse or widen it silently.
  The host uses a shared pure resolver (`elements/` cannot see editor selection);
  the element accepts two performed positions `{ ordinal, metricOffset }`. Resolve
  them through the compiler's source map into half-open performance bounds.
- **Proof (§4).** The loop wraps without a dropped or doubled onset (item 6's rule);
  the ramp advances per wrap; count-in emits one bar of clicks in the time signature
  at the loop start; the mapping policy tests D.S. duplicate candidates, missing
  start/end, partial
  measures, within-bar offsets, endpoints on different iterations/strains, reversed
  performed endpoints and a first-ending-to-second-ending selection.
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

Persisted loops include a document revision fingerprint. On document change, discard
stale ordinal bounds and require re-resolution from written endpoints; never replay
old ordinals against edited content. The loop preview makes skipped written bars and
extra performed bars visible before the practice repetition starts.

## Start condition

The dependencies named above are technical prerequisites. Campaign clause 7 additionally
requires reviewer items 1–10 to be verified before this practice item starts.
