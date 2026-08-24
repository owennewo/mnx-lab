# Layout authoring — the tree the element-ops campaign handed on

Serves the **implementation loop**. Owner of the `layout`, `score` and
`multimeasure-rest` element kinds, formally handed over by
[core-campaign-element-ops.md](../complete/core-campaign-element-ops.md) on
2026-08-15 (its second scoping decision).

## Why it is not element-ops work

The campaign's verbs all attach to a **place**: a note, an event, a bar, a part.
Its whole vocabulary — navigate to the thing, press the key, type the
declaration — assumes the target has coordinates in the music.

A layout has none. It is a **tree** of system → group → staff sources, describing
how parts are gathered onto staves for one presentation; a `score` is a named
selection of layouts plus page geometry; a multimeasure rest is a range inside
one. Nothing in the tree lives at an onset, so the selection ladder cannot reach
it and the popover grammar has nothing to attach to. Building them would have
meant inventing a second addressing scheme inside an item about the first —
which is exactly the kind of scope creep the campaign's contract exists to stop.

The removal half already exists (`removeLayout`, `removeScore`,
`removeMultimeasureRest`, from campaign item 13b): a tree node can be deleted by
index without any of this, because deletion needs only identity, not a place to
stand. **The asymmetry is the evidence** — where construction needs an
addressing scheme that removal does not, the thing being addressed is not the
music.

## What it blocks today

Six scenarios stay `blocked` in `harness/reports/construct-coverage.json`, each
naming this doc in `deferredTo`:

`lab/60-layout/group-barline-individual` · `spec/multiple-layouts` ·
`spec/orchestral-layout` · `spec/organ-layout` · `spec/system-layouts` ·
`spec/multimeasure-rests`

They render, they verify, and their ink is fully destructible. Only their
*construction* is owed.

## The question this item has to answer first

**What addresses a tree node?** Three candidates, none obviously right:

- **A second rung on the ladder** — layout as a level above score, navigated
  with the same Escape/Enter grammar. Coherent, but the ladder's rungs are all
  ranges of *music*, and a layout is not.
- **A structured text form** — the tree typed as text (`system: [guitar, bass]`),
  parsed like the other popover grammars. Cheapest by far, and honest about the
  tree being a shape rather than a place.
- **A panel** — direct manipulation in the side panel, with the ops fired as
  intents so traces still record them (the tray's ruling, part 2).

The trace machinery does not care which wins: a construct trace records intents,
and all three emit intents.

**Prerequisite (2026-08-24): the word.** Whichever wins, this item's sentences say
"score" meaning *one presentation*, while the ladder's top rung says `score`
meaning *the whole document* — and the destruct half (`no score 1`) already sits
in a popover typed from that rung. [core-document-rung.md](core-document-rung.md)
renames the rung to `document` first; it is cheap only until this item records
traces that stand on it.

## Not in scope

Page geometry beyond what the corpus documents carry, and any layout *rendering*
work — the engine already draws these scenarios.
