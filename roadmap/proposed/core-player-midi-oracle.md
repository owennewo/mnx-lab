# The MIDI oracle — someone else's performance of the same score

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 9. **A small experiment
> as soon as a tool is chosen** — before item 5 is finished, so the writer is not
> the only reader of its own bytes — and the full baseline after item 5.
> **Not startable until a dev-environment decision**: neither MuseScore nor Verovio is
> installed, and nothing is installed silently.

## Agreement block (campaign contract)

- **Proof (§4) — this item *is* a proof**, and the reason the MIDI writer's
  self-round-trip is not one: a writer and reader authored together share their
  mistakes. The MusicXML campaign's rule applies unchanged — an oracle must not be us.
- **Dependencies (§5).** A **dev** dependency only. **MuseScore CLI**
  (`mscore -o out.mid`): the most trusted interpretation of repeats and jumps; a
  system install. **Verovio** (npm, WASM, LGPL): `renderToMIDI()` in-process, hermetic,
  weaker on jumps. The choice is the human's.
- **Reviewer gain (§7).** A number beside the primitives oracle's 24 of 27.

## Design

- **Inputs.** The 27 W3C comparisons mirrored by
  [core-musicxml-w3c-oracle.md](../inprogress/core-musicxml-w3c-oracle.md) and the
  converter fixtures' `.xml` exports.
- **Two comparisons, reported separately.**
  - **Strict**: performed **bar order** and **pitch** — the two things every tool
    agrees on. Onset within 1/64 quarter after normalising PPQ. Graded `match` /
    `timing` / `content` like the primitives oracle; a miss here is a bug.
  - **Interpretive**: grace length, fermata multiplier, articulation shortening,
    velocity — where tools legitimately differ. Reported as deltas, never graded,
    so the campaign's conventions can be compared against a peer without pretending
    the peer is right.
- **Baseline** `harness/reports/midi-oracle.json`, tool and version in the header;
  moving the strict section either way is a red test.
- **The early experiment**: three scenarios (a volta, a D.S. al Fine, a tuplet) run
  by hand through the chosen tool and read against item 3's conventions before item
  5 is complete. Cheap, and it is the moment a convention is still free to change.

## Done bar

Baseline committed; the log records the strict score and which interpretive deltas
prompted a convention change in item 3's table.
