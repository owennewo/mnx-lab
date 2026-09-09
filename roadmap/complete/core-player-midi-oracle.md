# The MIDI oracle — someone else's performance of the same score

> **Status: complete 2026-09-09.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 9. **A small experiment
> as soon as a tool is chosen** — before item 5 is finished, so the writer is not
> the only reader of its own bytes — and the full baseline after item 5.
> **Dev-environment decision: the user selected MuseScore CLI on 2026-09-09.**
> Official MuseScore Studio 4.7.5 is installed user-locally; no runtime dependency.

## Agreement block (campaign contract)

- **Proof (§4) — this item *is* a proof**, and the reason the MIDI writer's
  self-round-trip is not one: a writer and reader authored together share their
  mistakes. The MusicXML campaign's rule applies unchanged — an oracle must not be us.
- **Dependencies (§5).** A **dev** dependency only. **MuseScore CLI**
  (`mscore -o out.mid`): the most trusted interpretation of repeats and jumps; a
  system install. **Verovio** (npm, WASM, LGPL): `renderToMIDI()` in-process, hermetic,
  weaker on jumps. The user chose MuseScore CLI; the pinned official Linux build is 4.7.5.
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

## Implementation and initial baseline

The [oracle contract and findings](../../docs/player-midi-oracle.md) record the
three-score experiment, capture/replay commands, alignment policy and limitations.
The baseline is **22/27 W3C observable strict matches; 0/4 converter fixture matches**.
All nine exceptions have explicit attribution; duplicated notation/TAB inputs and
external jump/grace behavior remain visible. No timing convention changed.

Raw external MIDI and version/input/hash provenance are committed separately from
our generated report. Ordinary tests replay independent evidence without installing
a desktop application; the live command verifies fresh MuseScore output byte-for-byte.
No scenario goldens or human approval records move.

Validation: **1,506 tests across 89 files**, corpus check and production build
passed after rebase. New harness modules also pass strict TypeScript checking.
All 31 MIDI files and five import receipts reproduce byte-for-byte in the live
MuseScore check. Scenario goldens regenerate unchanged. Implementation landed as
`52860d8`; its worktree was retired before this document moved to `complete/`.
