# The MIDI oracle — someone else's performance of the same score

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 9. Needs item 4.
> **Not startable until a dev-environment decision**: neither MuseScore nor Verovio is
> installed here, and the MusicXML campaign's rule stands — no silent install of a
> tool nobody chose.

## Agreement block (campaign contract)

- **Proof (§4) — this item *is* a proof.** The performance golden says what *we*
  think the score means; this says what an independent implementation thinks. The
  MusicXML campaign's founding correction applies unchanged: an oracle must not be us.
- **Dependencies (§5).** A **dev** dependency only. Two candidates, to be chosen on
  what the environment can have:
  - **MuseScore CLI** (`mscore -o out.mid in.musicxml`): the most widely trusted
    playback interpretation of repeats, jumps and ornaments; a system install.
  - **Verovio** (npm `verovio`, WASM, LGPL): `toolkit.renderToMIDI()` in-process, no
    system install, weaker on jumps. Easier to make hermetic.
- **Reviewer gain (§7).** A number: *n of 27 W3C comparisons* whose performed note
  table matches, alongside the primitives oracle's 24 of 27.

## Design

- **Inputs.** The 27 W3C MusicXML comparisons already mirrored as committed fixtures
  by [core-musicxml-w3c-oracle.md](../inprogress/core-musicxml-w3c-oracle.md), plus
  the three Guitar Pro-derived fixtures' `.xml` exports.
- **Comparison.** Both sides reduced to a **note table** — part, onset tick, duration
  ticks, sounding MIDI number, velocity — normalised to one PPQ; matched with a
  tolerance (onset ±1/64 quarter, duration ±10 %, velocity ignored unless item 8 has
  landed). Graded `match` / `timing` / `content` exactly like the primitives oracle,
  so the two reports read the same way.
- **Baseline.** `harness/reports/midi-oracle.json` committed; moving it either way is
  a red test. Tool and version pinned in the report header.
- **What it cannot see.** Techniques (bends, slides, harmonics) — MuseScore renders
  some, Verovio none — so item 8 is judged by the golden and the ear, and this item
  says so in its report rather than pretending.

## Done bar

The baseline committed with the tool named; the campaign log records the initial
score and which of the misses are conventions (grace length, fermata multiplier)
versus bugs — the split that decides what item 4 revisits.
