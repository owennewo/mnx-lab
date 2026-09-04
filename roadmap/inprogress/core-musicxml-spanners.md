# Ties and slurs — the first features the oracle asked for

> **Status: BUILT 2026-09-04.** Item 2 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), chosen by the
> oracle rather than by intuition. **Takes the oracle from 7 match to 11 of 27**, both
> directions, round trip held.

## Why this item, and why it is not "add a missing feature"

`tied` appeared **zero times** in `converters/musicxml-mnx/src/` — import *and* export —
and `MnxNote`/`MnxEvent` had no `ties` or `slurs` field at all. They were not
unimplemented; they were **absent from the data model**.

Meanwhile the converter's 46 round-trip invariant tests passed, and had for as long as
they existed. They passed *because* both directions dropped the feature: a round trip
cannot see a symmetric omission, and none of the three guitar fixtures contains a single
tie, so nothing ever asked. That is the campaign's founding argument, and this is the
item where it stopped being an argument.

## The agreement block

1. **The oracle** — [core-musicxml-w3c-oracle.md](core-musicxml-w3c-oracle.md), on four
   scenarios it named: `ties`, `slurs`, `slurs-chords`,
   `slurs-targeting-specific-notes`. The structural claims layout cannot see —
   that a tie joins the same pitch, that a slur names a real event, that chord-member
   narrowing happens only when the source narrows — are asserted directly in
   `converters/musicxml-mnx/tests/spanners.test.ts`.
2. **The MNX verdict** — **standard objects, no extension.** `tie`, `slur` and
   `slur-side` are all published `$defs`. Nothing proposed, nothing under `_x.mnxLab`.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — none yet; this item's evidence is the oracle report until the
   matrix exists.
5. **The losslessness bar** — MNX → MusicXML → MNX deep-equal on all four scenarios,
   asserted per-scenario, plus the four oracle scenarios at `match`.

## The shape of the problem, both ways

MNX states a spanner **once**, on the element it starts from, pointing at where it ends.
MusicXML states **both ends**, and numbers its slurs so overlapping ones can be told
apart. So each direction is a conversion between a reference and a pair of markers.

**Import** records object references while parsing and resolves them to ids in a final
pass — the idiom `linkTechniqueTargets` already established, and for the same reason:
a spanner can cross a barline, and note ids are not minted until the part is assembled.
`collectSpanners` pairs the markers; `linkSpannerTargets` names them.

- **Ties** key on voice + pitch, because that is what a tie joins and MusicXML does not
  number them. A note that both stops and starts a tie is handled stop-first, so a chain
  links end-to-end instead of to itself.
- **Slurs** key on MusicXML's own `number`.
- **Event ids are minted only where a slur references them.** An id nothing points at is
  noise in the output.

**Export** inverts the references and allocates slur numbers by interval colouring —
the smallest number whose previous slur has already closed. Ties need no number. Both
`<tie>` (the sound) and `<tied>` (the notation) are written, as the spec's own examples
do, because readers differ on which they trust; `<tie>` goes immediately after
`<duration>`, which is where MusicXML's fixed child order puts it.

## The one real judgement call: when a slur means a chord, not a note

MusicXML always hangs a slur off a *note*. MNX states it event-to-event, and narrows to
`startNote`/`endNote` only when it must. Getting this wrong in either direction is a
silent fidelity loss, and the spec's own examples pin both cases:

| Fixture | Source | Correct MNX |
|---|---|---|
| `slurs-chords` | one `<slur>` on the **first** note of each chord | event-level, no narrowing |
| `slurs-targeting-specific-notes` | three `<slur>`s, numbers 1–3, on notes 1–3 of the chord | three slurs, each naming `startNote`/`endNote` |

So the rule is: **narrow when the event starts more than one slur, or when the slur hangs
off a note that is not the event's first.** Both mean "this chord member". Anything
simpler gets one of the two fixtures wrong — narrowing by "is a chord" fails
`slurs-chords`, and never narrowing fails the other.

## A trap avoided

Our own exporter writes a bare `<slur type="start">` with no matching stop, to mark a
legato (picked-once) slide — the only way MusicXML can distinguish it from a shift slide.
Reading that as a musical slur would have invented a slur running to the end of the part
in every guitar score.

It costs nothing to avoid, because an unmatched start is simply never resolved: the pair
is what creates the link. `spanners.test.ts` pins it against
`House-of-the-Rising-Sun.xml` so the guarantee is a test rather than a comment.

## Result

| | Before | After |
|---|---|---|
| Oracle `match` | 7 / 27 | **11 / 27** |
| `ties`, `slurs`, `slurs-chords`, `slurs-targeting-specific-notes` | `content`, `curve` primitives missing | **`match`** |
| Converter suite | 49 tests | 58 tests |

## What is next, by the oracle's own count

`<beam>` is now the largest single cause at 6 scenarios (`beams`, `beam-hooks`,
`beams-across-barlines`, `beams-inner-grace-notes`, `beams-secondary-beam-breaks`,
`parts`), and it is the same shape of problem one level up: MNX states beams as
measure-level groups of event ids, MusicXML as per-note `begin`/`continue`/`end` flags,
with secondary beams and hooks on top.
