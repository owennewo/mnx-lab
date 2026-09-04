# Saying what the source states — `mnx.support`, and a lookup in the wrong parent

> **Status: BUILT 2026-09-04.** Item 5 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md). **Oracle 18 → 19 of
> 27.** Two bugs behind one scenario, and the second one is the interesting half.

## The first bug: `<accidental>` read in the wrong parent

The importer looked for `<accidental>` **inside** an `if (notationsEl)` guard. But
`<accidental>` is a child of `<note>`, not of `<notations>`, and most notes that print an
accidental carry no `<notations>` at all — so it was found only on notes that happened to
have some *other* notation as well.

This is the third time in this campaign that the answer was "that element hangs off a
different parent than the code assumed": `<beam>` was the same (item 3), and beamed
**rests** were the same shape of mistake one level up. Worth stating as a rule:
**before reading a MusicXML element, check what it is actually a child of** — the content
model is not intuitive, and a wrong guess fails silently on the subset of notes that lack
the parent you guessed.

Fixing it took `accidentals` from *missing a natural and printing a spurious flat* to
*printing one spurious flat*. Which exposed the real problem.

## The second bug: a document that does not say what it states gets second-guessed

`mnx.support` is how an MNX document declares what it states rather than leaves to be
inferred:

| flag | meaning |
|---|---|
| `useAccidentalDisplay` | `accidentalDisplay` on the notes is the whole answer — do not work out which accidentals to print |
| `useBeams` | `beams` is the whole answer — do not infer beam groups |

We were emitting neither. So the renderer inferred, and **overruled the source**:
`accidentals` reprints a flat on the second of two D♭s, which the reference document
explicitly declines to do (its own comment says "This note doesn't use
accidentalDisplay"). The two documents were otherwise byte-identical apart from ids — the
entire difference was one absent declaration.

**MusicXML always states both.** `<accidental>` *is* the statement that an accidental
prints; `<beam>` *is* the statement that a beam is drawn. A document converted from
MusicXML is therefore stating them too, and has to say so.

The rule is: **declare a flag when we actually read some.** A source that wrote no
`<accidental>` at all — plenty of exporters don't — is better served by inference than by
being told, falsely, that it has none. `hello-world` declares nothing and should.

## Why this was invisible until now

Every beam scenario in the spec declares `useBeams`, and ours did not — yet all six
matched anyway, because our imported beams happened to agree with what the engine infers.
The declaration only starts mattering where inference and the source **disagree**, which
is exactly the case the accidentals fixture was written to exercise.

That is worth remembering: **a missing declaration is invisible until the thing it
governs is unusual.** It was not the beams work that found this, even though the beams
work should have.

## The agreement block

1. **The oracle** — `accidentals`, plus three assertions in `spanners.test.ts` covering
   both flags and the declare-nothing case.
2. **The MNX verdict** — standard object (`support`), no extension.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — none yet.
5. **The losslessness bar** — converter suite green at 74; oracle at 19.

## Result

| | Before | After |
|---|---|---|
| Oracle `match` | 18 / 27 | **19 / 27** |
| Converter suite | 71 tests | 74 tests |

Remaining: 7 `content` and 1 `spacing` — three of them the deferred final-barline default
([core-musicxml-repeat-barlines.md](core-musicxml-repeat-barlines.md)), two jumps
(`segno` glyph and *D.S.* text), one ottava, one tuplet number (`tuplets` draws *3* where
the reference draws *6*), and `parts`, still the only genuine layout disagreement.
