# Timing and pitch contracts — the numbers, written down before the compiler

> **Status: complete 2026-09-08. Implementation landed and its worktree retired.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 3. Needs nothing;
> item 5 builds on it. Exists because the first draft got both time and pitch wrong
> on paper, and the cheap place to be wrong is a test file.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/time.ts`: rational arithmetic over
  exact whole-note fractions, a tempo map, `secondsAt(position)` at rate 1 and its
  inverse. Seconds and clock-derived positions are approximate at the clock boundary;
  the inverse rounds to a documented display/seek resolution, never rewriting exact
  event positions. The transport applies rate exactly once. Pure and Node-importable.
  Promote reusable rational arithmetic to `model/` if editor consumers adopt it;
  `edit/` cannot import `audio/`. Do not copy the editor's duration table.
- **Rational time (§2).** Exact for every note value in `model/durations.ts` down to
  `4096th`, dots and nested tuplets within a documented resource budget. Use reduced
  BigInt numerators/denominators internally; serialize `{ num: "1", den: "32" }`
  with canonical decimal strings, positive denominator, and zero as `0/1`.
  The existing number-based `Onset` is not exact at arbitrary depth: adapters check
  safe integer bounds. Depth/bit-length exhaustion gives a diagnostic and stops
  compilation of the affected performance; it never emits approximate rationals.
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
fret, never the pitch), and harmonics with and without `touchingPitch`.
Each asserts **nothing shifts**. Harmonic metadata describes technique; it does not
override sounded `pitch`. Item 8 adds consistency diagnostics and timbre conventions,
with hand-stated natural/artificial harmonic examples before any alternative pitch
interpretation could be proposed.

## The timing conventions

| Case | Convention | Why |
|---|---|---|
| No tempo mark | 120 quarter BPM | chosen campaign default |
| `tempos[].value` | normalised to quarter BPM; mid-bar `location` honoured | `lab/40-navigation/04` |
| Grace, `stealPrevious` / `stealFollowing` | group budget = min(1/32 whole note, half the neighbour's performed duration before holds); taken from its end / start, divided among grace events in proportion to their notated durations | bounded, leaves the neighbour positive time |
| Grace, `makeTime` | insert 1/32 whole note before the principal onset; simultaneous groups share one insertion and each fits within it | one score-wide insertion, not one per part |
| Fermata, `duration` `auto`/`normal` | × 1.5 on the event; `short`/`veryShort` × 1.25, `long` × 2, `veryLong` × 3, **`none` × 1** | the model already carries the hint |
| Fermata sync | event requests extra duration `(multiplier − 1) × event span` at its release; barline requests `(multiplier − 1) × 1/4` whole note at the boundary; simultaneous requests combine by **maximum**, not sum | duplicated marks do not multiply the hold |
| Tie | target extends the source's sounding event; the target keeps its **written occurrence** (the cursor still lands on it) | contract §3 / decision 2 |
| `lv` tie | rings for one whole note or until the string is re-struck | fretted-instrument convention |
| Tremolo | subdivided by `marks` within the container's performed value | model semantics |

## The golden's format

`expected.performance.json`: `written[]` (written occurrence: `noteKey`, `ordinal`,
`position`, `duration`, links to `sounding` ids) and `sounding[]` (voice event:
`voice`, `position`, `duration`, `midi`, `velocity`, `curve[]`, links back), both in
rational positions; `tempo[]`; `measures[]` from the pass model. Human-readable by
design: a reviewer reads a table, not a byte stream.

## Timing examples and state restoration

Keep written metric offsets, unrolled metric positions, and expanded performance
positions distinct. Emit a source-to-performance map, including insertion intervals,
so a hold never invents another written beat. `position` in the two event lists means
expanded performance position; written occurrences also carry their original metric
offset/span. A hold displays the source release/barline position; a make-time interval
displays its grace group. Tempo positions and measure boundaries undergo the same map.

Insertions precede ordinary attacks at the insertion point. Notes crossing an insertion
extend through it; for fermatas, notes releasing at the insertion also sustain through
it. For make-time, notes releasing exactly there remain released. Independent insertions
at one point use a stable order: fermata hold, then make-time grace, then principal
attacks. Grace notes do not themselves inherit a coincident hold.

Examples pinned before the compiler lands:

- A quarter-note neighbour lends `min(1/32, 1/8) = 1/32`; a 128th lends `1/256`.
  With no adjacent timed neighbour in the same performed voice, stealing grace is
  silent with a diagnostic; do not steal across an unrelated jump or rest-only gap.
- Normal fermatas on a quarter and a half ending together request `1/8` and `1/4`;
  insert `1/4` once. A normal barline fermata inserts `1/8`; `none` inserts zero.
- Two make-time groups at one onset share `1/32`. All later voices move by `1/32`;
  a note already sounding across that onset gains that duration.
- Resolve tempo, time signature and scoped dynamics from **written state at each
  traversal entry**, including marks before a mid-bar `from`. A jump back before a
  later tempo/dynamic change restores the earlier state; apply marks inside the slice
  in order. One-shot accents are not persistent state. This is a written-position
  lookup on every entry: a persistent mark in a skipped ending can therefore be in
  force at the following written bar. Pin that convention with a skipped-ending
  example; do not mix written-state lookup with a visited-marks-only accumulator.

Vibrato is deliberately **tempo-relative**: one cycle per 1/10 whole note, which is
5 Hz at 120 quarter BPM and rate 1. Slowing playback slows the vibrato. Its rational
period belongs in the golden; a fixed-Hz alternative would need a separate physical-time
modulation contract and is outside this campaign's current event representation.

## Done bar

Time tests exact for the whole duration table under nested tuplets; pitch tests over
all named pitch cases; the conventions table copied into the campaign log with the item's
date.


## Implementation — 2026-09-08

The executable contract is split into `audio/time.ts`, `timingConventions.ts`,
`writtenState.ts`, `pitch.ts` and `performanceTypes.ts`. The full API, numerical
budgets, insertion edges and JSON field meanings are documented in
[docs/player-time.md](../../docs/player-time.md). No performance compiler or
scenario performance golden is introduced; item 5 owns their implementation and
approval lifecycle.

Conformance tests cover every note value, dots and nested ratios; canonical JSON
and safe-number adapters; tempo integration/inverse rounding; corpus mid-bar tempo
and sounded-pitch cases; jump/skipped-ending state; grace budgets and placement;
shared fermata/make-time insertions, note releases and source lookup; and vibrato's
rational period. The only model change exposes a strict lookup of the existing
base-duration table; the forgiving renderer function is unchanged.


Landing validation: all 1,326 tests passed (including 44 timing/pitch
conformance tests), as did `check:scenarios` and `build` after rebase.
`update:primitives` left `scenarios/` byte-identical. No new scenario evidence
or approval debt. The implementation worktree was removed before this document
moved to `complete/`.
