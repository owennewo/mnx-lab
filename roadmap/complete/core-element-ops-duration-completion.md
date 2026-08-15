# Duration completion — the dot, and the time signature's glyph

**Campaign:** [core-campaign-element-ops.md](core-campaign-element-ops.md), item 4.
Serves the **implementation loop**: our editor is the variable.

Built 2026-08-15.

## What the row actually contained

Item 4 was drafted as three things — dots, capo, `display: common|cut` — and one
of them had already been closed by another item. Checking before building is the
whole of this note:

- **Capo is writable.** Item 13's `setPartDeclaration` gave it a verb and
  `Shift+P → capo 3` a key. The row's "read but unwritable" was true when the
  row was written and stale by the time it was picked up.
- **Dots were half there.** `setDuration` accepted `dots?` from the beginning;
  nothing ever sent one, and the duration ladder actively *dropped* dots when
  it re-valued an event.
- **`display` was read but unreachable.** The layout has drawn 𝄴 and 𝄵 since
  the time-signature work (`spec/time-signature-glyphs`); the op had no field
  for it and the grammar no word.

So the item is two verbs, not three.

## The dot

`.` (and `NumpadDecimal`), sitting beside the `−`/`=` ladder it modifies —
the key every notation editor already uses. It **cycles 0 → 1 → 2 → none**, so
one key both adds and removes, and no second binding is spent on undotting.

**One key, two targets, mirroring the ladder exactly.** On an event with ink the
note is re-valued; over a rest or an entry ghost the **pending entry duration**
changes instead. That is not a special case, it is item 11b's founding rule
applied again — a rest is absence (§8.11), so there is nothing there to dot.

**Dots survive a re-value.** Stepping a dotted quarter now gives a dotted
eighth, not a plain one: the dot is a property of the value the player is
writing, and the ladder steps the value. The previous behaviour silently threw
the dot away.

**Dotted rests belong to the spelling verb.** `rest half.` — item 11b's
`setRestSpelling`, extended to read trailing dots exactly as they are written.
A rest gets no dot key for the same reason it gets no ladder key, and
`lab/10-durations/01-rest-gallery`'s dotted-half-plus-quarter bar is reachable
through the verb that owns rest durations rather than through a second route
that would have to agree with it.

### What it uncovered: entry could not lengthen

A dotted quarter is longer than the beat rest padding leaves, and
`insertPitchNote` took the shorter of the two — so the note came out a plain
quarter and the dot vanished. **Dots were unenterable, and the cause was not the
dot.**

Entry now eats the FOLLOWING rests to make room (`restsCovering`), leaving any
surplus as rest after the note, and **refuses when ink stands in the way** —
entry may lengthen silence, never overwrite music. Clamping to the rest's own
value would have been precisely the silent clamp this codebase refuses
everywhere else; it was silent here because nothing had ever asked for a
duration longer than a beat.

This is the third finding of the same shape in the campaign: a feature blocked
by a neighbouring assumption rather than by its own absence
(`space.duration`'s field shape, rest spelling's grid coupling, and now entry's
clamp).

## The glyph

`display` is the GLYPH, not the meter: common time is 4/4 *drawn as* 𝄴. The
grammar says both, and the bare words carry the meter every player means by
them:

```
common      → 4/4, display common
cut         → 2/2, display cut
4/4 common  → the same, spelled out
6/8         → a meter, no glyph — no glyph is not a glyph
```

## Evidence

`harness/conformance/duration-completion.test.ts`, in item 11b's shape: take the
corpus document that holds the thing, remove **just** that thing, rebuild it
through navigation plus the key or the typed text, and demand byte-identity.

- `spec/time-signature-glyphs` — strip both `display`s, retype `common` and
  `2/2 cut`.
- `spec/dotted-notes` — strip every dot, navigate to each site, press `.`.

Plus the unit-level rules: the cycle returns to where it started after three
presses, a dotted quarter steps to a dotted eighth, the pending duration takes
the dot when the cursor is over absence and entry then carries it, and
`rest half.` produces the engraver's bar.

Goldens byte-identical; the corpus reports do not move, because a dot is not an
element kind — item 4 buys **traceability**, not coverage.
