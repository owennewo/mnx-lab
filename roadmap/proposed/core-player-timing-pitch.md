# Timing and pitch contracts — the numbers, written down before the compiler

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 3. Needs nothing;
> item 5 builds on it. Exists because the first draft got both time and pitch wrong
> on paper, and the cheap place to be wrong is a test file.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/time.ts`: rational arithmetic over
  `{ num, den }` whole-note fractions (the model's `Onset` idiom, promoted), a tempo
  map, `secondsAt(position, rate)` and its inverse. Pure, Node-only, no document.
- **Rational time (§2).** Exact for every note value in `model/durations.ts` down to
  `4096th`, every tuplet ratio nested to any depth, and dots. No float in a position.
- **Proof (§4).** Conformance tests, and the **format** of `expected.performance.json`
  fixed here so item 5 generates into a shape a reviewer has already agreed to read.
- **Spec findings (§6).** The conventions below are the campaign's most arguable
  numbers; this item records them with their reasons.
- **Reviewer gain (§7).** Indirect — but the pitch tests are the first place the
  corpus asserts what a transposing part *sounds* like.

## The pitch rule, as tests

**MNX `pitch` is the sounded pitch**, and the spec says ottavas and clef octaves affect
display only. So the rule is: `midi = midiOf(pitch)`, full stop. The item pins it with
one test per way it could go wrong: a transposing part (`part.transposition`), a guitar
part under its octave clef, an ottava span, a capo'd fretted part (capo moves the
fret, never the pitch), a harmonic (item 8 changes this one, deliberately, from the
touching pitch). Each asserts **nothing shifts**.

## The timing conventions

| Case | Convention | Why |
|---|---|---|
| No tempo mark | 120 quarter BPM | universal default |
| `tempos[].value` | normalised to quarter BPM; mid-bar `location` honoured | `lab/40-navigation/04` |
| Grace, `stealPrevious` / `stealFollowing` | a 32nd of the neighbour, taken from its end / start; a group shares it | fixed, audible, MuseScore-like |
| Grace, `makeTime` | a 32nd inserted; **all parts and voices** shift by the same amount at that position | the review's point: one voice cannot make time alone |
| Fermata, `duration` `auto`/`normal` | × 1.5 on the event; `short`/`veryShort` × 1.25, `long` × 2, `veryLong` × 3, **`none` × 1** | the model already carries the hint |
| Fermata sync | the hold applies to the **position across all parts**, and a barline fermata to the gap before the next bar | same reason as `makeTime` |
| Tie | target extends the source's sounding event; the target keeps its **written occurrence** (the cursor still lands on it) | contract §3 / decision 2 |
| `lv` tie | rings for one whole note or until the string is re-struck | fretted-instrument convention |
| Tremolo | subdivided by `marks` within the container's performed value | model semantics |

## The golden's format

`expected.performance.json`: `written[]` (written occurrence: `noteKey`, `ordinal`,
`position`, `duration`, links to `sounding` ids) and `sounding[]` (voice event:
`voice`, `position`, `duration`, `midi`, `velocity`, `curve[]`, links back), both in
rational positions; `tempo[]`; `measures[]` from the pass model. Human-readable by
design: a reviewer reads a table, not a byte stream.

## Done bar

Time tests exact for the whole duration table under nested tuplets; pitch tests over
the four scenarios; the conventions table copied into the campaign log with the item's
date.
