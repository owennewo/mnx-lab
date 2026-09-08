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
  - **Strict observable content**: aligned note pitches/attack order and timing in
    regions without interpretive shifts. Onset tolerance is 1/64 quarter after PPQ
    normalization. Bar order is asserted only when external provenance or unique
    musical content identifies it; repeated identical and silent bars are marked
    **unobservable**, never reconstructed using our own pass model as proof.
  - **Interpretive**: grace length, fermata holds, articulation shortening, velocity
    and supported techniques, reported as deltas. Split comparisons at those regions;
    re-anchor later strict timing using independently matched unambiguous attacks.
    If there is no such anchor, report timing unobservable rather than letting one
    different hold make every later onset a failure. Publish excluded spans and
    coverage counts so reduced observability cannot inflate the match score.
  A discrepancy is a finding requiring attribution: our compiler/export, the input
  conversion, the external tool, or an interpretation difference. It is not automatic
  proof of a bug in our code. Pin attribution with each baseline exception.
- **Baseline** `harness/reports/midi-oracle.json`, tool and version in the header;
  moving the strict section either way is a red test.
- **The early experiment**: three scenarios (a volta, a D.S. al Fine, a tuplet) run
  by hand through the chosen tool and read against item 3's conventions before item
  5 is complete. Cheap, and it is the moment a convention is still free to change.

## Done bar

Baseline committed; the log records the strict score and which interpretive deltas
prompted a convention change in item 3's table.
