# Beams — the same shape of problem, one level up

> **Status: BUILT 2026-09-04.** Item 3 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), named by the oracle
> as the largest single remaining cause. **Takes the oracle from 11 match to 16 of 27**,
> both directions, round trip held.

## The two models

They are the same information at different addresses, which is why the conversion is one
recursive scan each way.

| | MNX | MusicXML |
|---|---|---|
| Where it lives | `measure.beams[]` on the part measure | `<beam>` on each note |
| Grouping | `{events: [ids]}` | `begin` / `continue` / `end` |
| Secondary beams | **nested**: `beams[].beams[]` | **numbered**: `<beam number="2">` |
| Hooks | a nested group of one event with `direction` | `forward hook` / `backward hook` |
| Across a barline | the group sits on the measure of its **first** event and names events in later ones | nothing special — the flags just continue |

So **beam number N is nesting depth N**, and `scanBeamLevel` recurses on exactly that.

## The agreement block

1. **The oracle** — six scenarios it named: `beams`, `beam-hooks`,
   `beams-across-barlines`, `beams-inner-grace-notes`, `beams-secondary-beam-breaks`,
   `parts`. Structural claims layout cannot see (a secondary covers a sub-run of its
   parent; a cross-barline group is filed on the right measure) are asserted in
   `converters/musicxml-mnx/tests/spanners.test.ts`.
2. **The MNX verdict** — **standard objects, no extension.** `beam` and `beam-list` are
   published `$defs`.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — none yet.
5. **The losslessness bar** — MNX → MusicXML → MNX deep-equal on all six, plus the six
   oracle scenarios at `match`.

## Three things the fixtures taught, each a bug first

The scan was written from the model above and was wrong three times. Every correction
came from a scenario, not from review.

**A beamed rest is inside the beam.** Measure 2 of `beams` is
`begin / continue / continue / continue / end` where the second event is a `<rest/>`.
Rests are built in a different branch of the importer, which never reached the beam
collector — so the group split in two around the rest. `<beam>` collection is now shared
by both branches. **A feature attached to "notes" has to ask whether a rest is one.**

**A grace note sits inside a beam without joining it.** `beams-inner-grace-notes` beams
ev1, ev3, ev4, ev5 — and the spec's own document carries a comment saying ev2 is
deliberately excluded. Walking events linearly put the grace in the middle and split the
run. The principal beam is now scanned over timed events only, with any grace run scanned
as its own; `walkSequenceEvents` already distinguishes them, since a grace event is the
un-timed one (`spanDivisions === 0`).

**A one-event group is a flag, not a beam.** The scan happily emitted single-event groups
where a run had been interrupted, which would draw a beam stub over a note that should
carry a flag. A group of one with nothing nested under it is now dropped — but a *hook*
is exactly a one-event group with a `direction`, so the guard has to spare it.

## Result

| | Before | After |
|---|---|---|
| Oracle `match` | 11 / 27 | **16 / 27** |
| `beams`, `beam-hooks`, `beams-across-barlines`, `beams-inner-grace-notes`, `beams-secondary-beam-breaks` | `content` | **`match`** |
| `parts` | `content` | `spacing` — glyphs now right, positions still differ |
| Converter suite | 58 tests | 69 tests |

## What the oracle says is left

Ten `content` and one `spacing`, in four groups:

- **the final-barline default — 5** (`hello-world`, `two-bar-c-major-scale`,
  `three-note-chord-and-half-rest`, `repeats-alternate-endings-simple`,
  `repeats-alternate-endings-advanced`). A defaults disagreement, described in
  [core-musicxml-w3c-oracle.md](core-musicxml-w3c-oracle.md); wants a decision about what
  an absent MNX barline means before it wants code.
- **jumps — 2** (`jumps-dal-segno`, `jumps-ds-al-fine`): `segno` glyph and *D.S.* text.
- **`parts` — 1**, now the only `spacing` verdict: the right glyphs in the wrong places,
  which makes it the first genuine *layout* disagreement rather than a missing feature.
- **one each**: `ottavas-8va` (bracket and `8va` text), `accidentals` (a natural read as
  a flat), `tuplets` (draws *3* where the reference draws *6*).
