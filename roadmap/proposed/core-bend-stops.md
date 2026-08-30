# Bends as a list of stops — one typed form, the curve itself, and honest arrowheads

> **Status: proposed 2026-08-30.** Written from an inspector design conversation (the
> thread that landed the fingerboard pills in
> [workbench-rung-inspector.md](../inprogress/workbench-rung-inspector.md)). Two halves,
> shippable separately: **(A)** the authoring side — a grammar that *is* the model's
> curve, the op widened to write it, the pill reading it back; **(B)** the engraving
> side — arrowheads that point where the curve goes, labels on every arrival. Neither
> touches the schema: `bend-point {position, alter}` already says everything below.

## What is settled, and the evidence

**Storage stays in semitones, positions stay 0..1.** Checked against the sources rather
than memory (2026-08-30): the pinned MNX schema has **no bend at all** (zero occurrences
in `spec/mnx-schema.json`), which is why bends live under
`_x.mnxLab.tab.technique.bend`. MNX's own `pitch.alter` is semitones (decimal), and the
extension schema chose the same unit on purpose (`bend-point.alter`: *"in SEMITONES —
the unit of MNX `pitch.alter`… a quarter-tone curl is 0.5"*). The formats we round-trip
with all store an **offset from the written pitch**, never a target note; they differ
only in scale:

| Format | Unit | Shape |
|---|---|---|
| MusicXML `<bend><bend-alter>` | semitones, decimal | *relative* to the current bent pitch per element; `<pre-bend/>`, `<release/>`; **no timing** — our importer accumulates and spreads points evenly |
| Guitar Pro (alphaTab) | quarter-tones, integer (2 = half step, 4 = full) | absolute curve, offset 0..60; our exporter does `round(alter × 2)`, positions `round(position × 60)` |
| MIDI pitch bend | 14-bit device value, ±range configurable | performance data |
| `_x.mnxLab` | semitones, decimal | absolute curve, position 0..1 of the note |

Guitar Pro's integer quarter-tones are an implementation convenience, not a musician's
unit; 0.5 semitones is exact in binary, so nothing is lost. **Relative segment lengths
are already supported**: each point carries its own `position`, so a slow release is
`[{0,0},{0.33,1},{1,0}]` today, and Guitar Pro's offsets survive the round trip. The
only lossy edge is MusicXML export, which has no timing at all — a limit of MusicXML,
not of the extension.

**The typed and printed unit is the whole-step fraction.** The vocabulary players of
every bending instrument share is the *step* — "half-step bend", "whole-step bend";
harmonica draw bends and pedal-steel changes are named the same way, and strings, voice
and winds mostly do not quantify bends at all. Printed tab writes that as a fraction of a
whole step: `1/4` = 0.5 semitones, `1/2` = 1, `full` = 2, `1 1/2` = 3, `2` = 4.
`bendLabel()` in `src/engine/layout/technique.ts` already spells semitones this way; the
grammar's value parser is its inverse. This ends the confusion that `bend 1` printed
`½` — the typed unit was semitones, the printed unit was steps.

## A. The grammar: every stop, explicitly

```
bend STOP>STOP[>STOP…]        STOP ∈ 0 · 1/4 · 1/2 · 3/4 · full · 1 1/4 · 1 1/2 · 2 …
```

The first stop is **where the string is when the note is struck**; each `>` is "then
move to". Nothing is implicit:

```
bend 0>full               strike, bend a whole step
bend 0>full>0             bend and release
bend 1/2>0                pre-bend a half step, release to the note
bend 1/2                  — refused: a bend needs two stops (a held pre-bend is 1/2>1/2)
bend 0>1/2>1/2>0          bend, HOLD, release        (equal neighbours = a hold)
bend 0>full>1/2           bend, partial release
bend 0>1/2>0>1/2>0        double bend
bend full>1/2>full        pre-bend full, dip to 1/2, back up
```

Why explicit rather than `[pre] stop>stop` or letter codes (`p1 2 r1`) — both were
argued through and lost:

- `bend full>1/2>full` under a "first stop is the start" rule *without* an explicit
  zero reads two ways (0→full→½→full, or a pre-bend). A lone `full` starting from 0
  while a list does not is the same trap. Writing the `0` costs two keystrokes and
  removes the rule entirely.
- A `pre` keyword works but is redundant: the schema *defines* a pre-bend as "a first
  point at position 0 with a non-zero alter", which is exactly what a non-zero first
  stop is. No keyword means nothing to keep in sync.
- `p`/`r` codes are a third vocabulary (semitones, fractions, letters) and spell back
  worse than they type. `r1` also smuggled in release-to-N, which is worth having and
  is plain `>1/2` here.

**Segment weights, later** (`>>`): a doubled arrow weights that segment 2 against 1, so
`0>1/2>>0` is a rise over a third of the note and a release over two thirds. Positions
are computed from the weights (today they are spread evenly, the same normalisation
the MusicXML importer applies). Weights are *relative*, so the spell-back needs a
rule: each segment's share rounded to the nearest integer ratio against the smallest,
capped at three or four arrows. **Foreign curves**: a Guitar Pro bend can put points at
any 0..60 offset; the pill spells the nearest approximation and marks it (`≈`) so an
amend is known to regularise. This is what any text form of a curve does; it is said
here so nobody is surprised.

### The op widens to the curve

`setTechnique`'s bend payload is `{semitones?, release?, pre?}` — a projection that
always writes evenly spaced points and cannot say a hold, a partial release, a second
peak, or a position. The widening: **`{kind: 'bend', alters: number[], weights?:
number[]}`**, the adapter writing `points` directly (alters in semitones, positions
from the cumulative weights). The reader (`readTechniques` → the pill's value) is its
inverse over the same fields, and the old three-field form retires from the intent —
`bend`, `bend 3`, `bend release`, `bend pre 1 2 release` stop parsing (the `B` key's
toggle keeps its own default, `0>full`). `techniqueText` spells the stop list in
fractions. `toggleTechnique` on a present bend still removes it.

Validation, all said in the error: at least two stops; a first stop may be non-zero
(pre-bend); values are fractions or `full` (semitone decimals are **not** accepted at
the keyboard — one unit at the keyboard); `0>0` is nothing.

## B. The engraving: heads that point where the curve goes

What is drawn today (`emitBend`, `technique.ts`) is right in structure — rise as a
curve, pre-bend as the vertical arrow it is, hold as a flat line, release as a curve
with a down head, label in steps at the peak — and wrong in one geometric detail that
makes every head look odd:

```ts
function bendSegment(from, to) {          // "leaves from flat and arrives at to steeply"
  return [from, {x: from.x + dx*0.55, y: from.y}, {x: to.x - dx*0.15, y: to.y}, to];
}
```

The second control point sits **at `to.y`**, so the curve arrives *horizontal* at its
peak — and a vertical `arrowheadBlackUp` is then glued to a flat arrival. The comment
describes the intended shape; the geometry draws an S. A release has the mirror
problem: it leaves the peak flat and lands flat, with a down head on a flat landing.
Soundslice's bends (the reference images in the thread: pre-bend ¼ → release; bend to
full; bend to 2 → release to 1) are not the prettiest but get this right: the rise
ends **vertical** under its label, the release ends **vertical** on the string, and the
heads sit on those verticals — which is also the printed convention (Hal Leonard, Mel
Bay: a quarter-circle-ish rise finishing straight up into the label).

The fix is the control points, not the heads: `{x: to.x, y: to.y + (from.y − to.y) ×
k}` for a rise (arrive vertical), and its mirror for a release (leave the peak flat,
land vertical — the bent string returning). Then:

1. **Every arrival gets a label, rising or falling, when it is not the written
   pitch** — `0>full>1/2` labels `full` at the up head and `1/2` at the down head. Today
   only rises are labelled, so a partial release is indistinguishable from a full one.
   (Soundslice omits the second label; that is the part not worth copying.)
2. **Label height**: Soundslice puts every label at a fixed height above the staff and
   lets the arrow reach it; ours scales the rise to the bend's own peak
   (`BEND_RISE_SP`, normalised). Keep ours — a `1/4` curl reading as tall as a `full`
   bend is the Soundslice weakness — but a curve with **two different non-zero
   arrivals** (`full>1/2>full`) needs the y of each to be legible: rise heights in
   proportion to alter, which `yOf` already does.
3. **A hold that returns to itself** (`0>1/2>1/2>0`) is a rise, a flat, a release — the
   flat carries no head, and the `1/2` label sits over the flat's start, not its end.
4. **Notation staff**: the same gesture in the lane above, unchanged in principle; the
   vertical arrivals make the lane read the same as the tab.
5. **Heads**: keep the SMuFL `arrowheadBlack*` glyphs. Rotating heads to the curve's
   tangent was considered and rejected — SMuFL has only up/down, and with vertical
   arrivals the fixed heads are honest.

Goldens move: `scenarios/lab/25-tab-techniques/01-bend-and-release` (both staves) and
anything else carrying `technique:bend` demote to `rendered`; register the batch in
[lab-verify.md](../inprogress/lab-verify.md) with "the head sits on a vertical arrival;
the label is over the peak; a release lands vertically on the string". New scenarios
for the shapes the grammar makes sayable: hold, partial release, double bend, pre-bend
that rises further, and one with weights.

## Agreements before code

1. **Schema untouched.** `bend-point {position, alter}` carries every case, weights
   included. If a proposal is ever made upstream, this grammar is its human form.
2. **One unit at the keyboard, one in storage.** Fractions/`full` typed and printed;
   semitones stored. The parser and `bendLabel` are inverses and a test says so for
   every quarter from `1/4` to `3`.
3. **The reader is the writer's inverse, and no more.** `readTechniques` spells stop
   lists the op could have written; a foreign curve's positions are approximated and
   marked. The test writes one of each shape and reads it back byte-equal.
4. **The old three-field grammar retires with the widening**, not before and not
   after — one change, one doc, `keymapDocs` updated so the cheatsheet says `0>full`.
5. **Geometry first, then labels.** The `bendSegment` fix is a one-function change that
   moves goldens; land it, verify, then the arrival labels — two batches in the ledger,
   so a reviewer approving heads is not also approving label placement.
6. **Goldens byte-identical everywhere a bend is not drawn.** The change is confined to
   `emitBend`/`bendSegment`; anything else moving is a bug.

## Related

- [workbench-rung-inspector.md](../inprogress/workbench-rung-inspector.md) — the pill
  and the slot this grammar is typed into; its agreement 4 ("bend's op widens first")
  is what part A delivers.
- [core-guitar-technique.md](../complete/core-guitar-technique.md) — the technique family
  and the corpus's bend scenario.
- [docs/mnx-extensions.md](../../docs/mnx-extensions.md) §bends — the schema's own
  account of the curve and the MusicXML normalisation.
- `converters/musicxml-mnx/src/import/aligner.ts` `accumulateBendPoints`,
  `converters/guitarpro-mnx/src/export/gp.ts` `classifyBend` — the two round trips
  whose units the table above records.
