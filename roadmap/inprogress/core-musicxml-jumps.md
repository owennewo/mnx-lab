# Jumps — segno, Fine and D.S., read from the sound rather than the words

> **Status: BUILT 2026-09-04.** Item 6 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md).
> **Oracle 19 → 21 of 27**, both directions, round trip held.

## Read the `<sound>`, not the caption

MusicXML states a jump **twice**: once as printed text and once as playback.

```xml
<direction>
  <direction-type><words>D.S. al Fine</words></direction-type>
  <sound dalsegno="m2"/>
</direction>
```

The words are free text — "D.S.", "D.S. al Fine", "Dal Segno", a dozen spellings, any
language — and say nothing a machine can rely on. `<sound dalsegno>` says it
unambiguously. So the classifier reads `<sound>` and treats the caption as decoration.
The exception is `<segno/>`, which is *also* a `<direction-type>` because it prints a
glyph.

## What MusicXML does not say, and the score does

MNX distinguishes `jump.type: "dsalfine"` from `"segno"` — stop at the Fine, or play to
the end. **MusicXML writes the same `<sound dalsegno>` for both.** The distinction is
recoverable, though, because it is a property of the score rather than of the mark: a
D.S. is *al Fine* exactly when there is a Fine to stop at. So the resolver looks for one
and types the jump accordingly, which reproduces both fixtures.

## Two traps

**A jump caption is not a section name.** The importer already reads a `<words>` before
the first note as a formal section label (`docs/mnx-extensions.md` §labels). "Fine" is a
`<words>`, and in `jumps-ds-al-fine` it sits early enough in its measure to qualify — so
the section pass now skips any direction the jump classifier claims.

**A D.S. is at the end of its measure.** Position matters: `jump.location` is
`[1,1]`, not `[0,1]`. On export these directions are written at the head of the measure,
so anything belonging later says so with `<offset>` — which the importer already reads
for `<harmony>`. Without it the round trip silently moved every jump to the downbeat.

## The agreement block

1. **The oracle** — `jumps-dal-segno`, `jumps-ds-al-fine`, plus five structural
   assertions in `spanners.test.ts`.
2. **The MNX verdict** — standard objects (`segno`, `fine`, `jump`); nothing proposed.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — none yet.
5. **The losslessness bar** — both scenarios `match`, both round trips deep-equal,
   converter suite green at 79.

## Result

| | Before | After |
|---|---|---|
| Oracle `match` | 19 / 27 | **21 / 27** |
| Converter suite | 74 tests | 79 tests |

Remaining: 5 — three the deferred final-barline default, `ottavas-8va`, `tuplets`
(draws *3* where the reference draws *6*), and `parts`, still the only `spacing`.
