# The bar-attribute family — ten kinds, one popover

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 7 — the
> second op-family item, opening with the contract's full agreement block.
>
> **Why now**: with clef and key gone ([core-element-ops-clef-key.md](core-element-ops-clef-key.md)),
> the blocking histogram's next cluster is this one. Ten kinds, **56 elements**,
> and **18 scenarios blocked only by them** — more than double what any single
> remaining family unlocks (beam, the next single kind, blocks 10).

## The agreement block

### 1. The op pair — one pair for ten kinds

Every kind here is **a key on the global measure**: `barline`, `repeatStart`,
`repeatEnd`, `ending`, `segno`, `fine`, `jump`, `tempos`, `rehearsal`, `section`.
They share an owner, a rung, a surface and a removal class, so they share a verb:

```
setMeasureAttribute    {measureIndex, attribute}   // attribute is a typed union
removeMeasureAttribute {measureIndex, kind, index?} // index: the tempos array
```

Twenty ops would restate the same shape ten times and give the ops panel ten
near-identical rows. The union keeps each attribute's payload **typed** — this is
not a stringly-typed `{key, value}` bag — while the family stays one verb the
assist loop can learn once.

**Removal class: annotation** — strip the key, no tombstones, no residue: an
emptied `tempos` array goes with its last entry, exactly as item 5's `clefs` did.
One kind is deliberately different and worth naming: **`barline` is a modifier**.
Every measure draws a barline whether or not the document says so (the ink census
lists `barline` as structural), so removing the attribute does not remove ink — it
returns the bar to the default `regular` stroke. The class taxonomy already has
the vocabulary for this; the report just has to not claim ink disappeared.

### 2. The shortcut — `Shift+B`, and a second removal token

One popover for the family, at the setup tier beside `Shift+T` time, `Shift+U`
tuning, `Shift+P` part, `Shift+C` clef, `Shift+K` key. `Shift+B` is free
(`Ctrl+B` is the rail toggle; bare `B` is reserved for item 9's bend).

The grammar names the attribute first, then its value:

```
barline double · barline final · barline dashed        repeat start · repeat end · repeat end 3
ending 1 · ending 1,2 · ending 1 open                  segno · fine · jump segno · jump dsalfine
tempo 120 · tempo half=80                              rehearsal A · section Verse 1
```

Removal is **`no <attribute>`** — `no repeat`, `no section`, `no barline`. Item 5
established that the removal token should name the *class*: `inherit` says "revert
to the predecessor's governance", which is what an inherited attribute's removal
means. An annotation's removal means "it is not there", so the token is `no`. Two
classes, two words, and the grammar teaches the taxonomy rather than hiding it.

### 3. The rung — measure

All ten attach at the **measure rung**, on the global measure — the same owner as
item 5's key signature, so nothing new is needed in the ladder. `KeyDoc` rows land
in `src/edit/keymapDocs.ts` in this change, per the contract.

### 4. The evidence

- **Construct**: 18 scenarios are blocked *only* by this family, so reachable
  scenarios should go **24 → 42** — repeats and endings (5 scenarios), the
  jump/segno/fine navigation set (4), the score-text labels (5), and the plain
  double-barline documents (`hello-world`, `two-bar-c-major-scale`,
  `three-note-chord-and-half-rest`). At least one lands as a recorded trace.
- **Destruct**: 56 elements move from `no-op` to `removed` (section 11, barline 7,
  repeat-end 7, ending 7, rehearsal 7, segno 5, jump 4, repeat-start 3, fine 3,
  tempo 2), each judged by the six oracles.
- Goldens byte-identical throughout.

## What the build measured (2026-08-14)

- **Construct: reachable scenarios 24 → 42** (38 `ops-reachable` + 4 `traced`),
  exactly the predicted +18. `spec/hello-world` is the fourth recorded trace — 14
  intents from `{}`, and the first one to need a bar attribute (its `regular`
  barline) to match its goldens.
- **Destruct: 758 → 814 removable elements** — all 56 family elements, every one
  passing the six oracles. No `broken` verdicts anywhere in the corpus.
- **The prediction was exact this time**, unlike item 5's (which under-counted the
  two already-traced exemplars). Two items in, the histogram is behaving as a
  planning instrument rather than a curiosity.
- **One verb for ten kinds held up.** The union kept each payload typed while the
  ops panel gained a single row shape, the sweep a single address, and the popover
  a single grammar. The thing that made it work is that all ten are *the same
  thing* — a key on the global measure; a family that did not share an owner would
  not have collapsed this way.
- **The removal token now names the class.** `inherit` for inherited attributes
  (item 5), `no <attribute>` for annotations (here). A later item adding a third
  class should add a third word rather than overloading one of these.
- **The cursor's starting line differs by grid mode**, which cost a trace
  iteration: a fingerboard-less document starts a line higher than a tab-mode
  grid, so `hello-world` needed one fewer `lineDown` than `bare-melody`. Traces are
  written in intents, so this is a fact about the grid, not the keymap — worth
  knowing for every later item that records one.

## Scope boundary

Positioned attributes keep their default position: `segno`, `fine` and `jump`
carry a `location.fraction`, and this item writes the measure start. Placing one
mid-bar is the same onset-addressing work item 11 owns, and the same boundary item
5 drew for mid-measure clefs.

`ending.duration` (how many bars a volta spans) is settable but not *addressable*
as a range — the popover writes it, the ladder cannot yet select a measure span.
That is item 13's territory (the horizontal axis of the selection ladder).

## Open questions

- Should `section` and `rehearsal` share one word in the grammar? They are two
  separate `{label}` objects on purpose (a rehearsal mark indexes a bar, a section
  says what the music *is*), so no — the grammar keeps the distinction the model
  makes.
- Tempo's grammar accepts `tempo 120` (quarter implied) and `tempo half=80`. A
  dotted beat unit (`tempo dotted-quarter=90`) is deferred with item 4's dots.
