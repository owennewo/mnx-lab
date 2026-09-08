# Practice mode — loop it, slow it, count it in

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 12. Needs items 7 and 8.
> **Studio's first player feature**, built in `elements/` so the workbench gets it too;
> the `studio-` prefix records who it serves.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Loop bounds, speed-trainer schedules and count-in
  bars are transport features with fake-clock tests; the element only exposes them.
- **Ticks (§2).** A loop is two ordinals plus onsets; a speed ramp is a sequence of
  rate scalars per repetition. Nothing is stored in seconds.
- **Identity (§3).** A loop region is set from the **selection** — the selection
  ladder's range already names a start and end position, and a pass — so "loop this"
  is one gesture on what the user has already selected.
- **Proof (§4).** Transport tests: the loop wraps without a dropped onset; the ramp
  advances on each wrap; count-in emits metronome ticks for exactly one bar in the
  time signature in force at the loop start.
- **Dependencies (§5).** None new.
- **Practice gain.** The four things every practice tool has: loop a passage, start
  slow and ramp up, hear a count-in, and silence the part you are playing yourself.

## Features

- **Loop the selection**, with the pass honoured — loop the *second* time through an
  ending, which is precisely what a guitarist practising a volta needs and what no
  written-order loop can express.
- **Speed trainer**: start at a rate, add a step per repetition up to a ceiling.
- **Count-in**: one bar of metronome before the loop start; metronome optionally on
  throughout, as its own voice, never on the MIDI file.
- **Mute / solo** per track, in the element's tray.
- **Persisted preferences** in localStorage (rate, metronome, last loop per document
  id) — UI preferences, which the workbench's no-backend rule already permits.

## Out of scope

Recording, pitch detection, tab-along scoring — studio product decisions, and none of
them belongs in `elements/` without a reviewed promotion.
