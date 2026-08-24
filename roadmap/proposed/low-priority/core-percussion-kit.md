# Percussion kit authoring — the other half the element-ops campaign handed on

Serves the **implementation loop**. Owner of the `kit-component`, `kit-note` and
`sound` element kinds, formally handed over by
[core-campaign-element-ops.md](../../complete/core-campaign-element-ops.md) on
2026-08-15 (its second scoping decision).

## Why it is not element-ops work

A kit part does not have pitches; it has **named components** (`snare`, `kick`)
that a note references, each mapping to a sound. So the campaign's two most
basic assumptions both fail at once:

- **Entry has no pitch axis.** The notation projection derives the note from a
  staff position through clef and key. On a kit staff the vertical axis is a
  *component name*, which the document itself declares — so there is nothing to
  derive from and no default to fall back on. It is the fingerboard problem
  again (the campaign already refuses to assume an instrument), one level more
  abstract: no kit is ever assumed either.
- **A component is referenced, not placed.** `removeKitComponent` already
  refuses while a note still points at it (campaign item 2's container rule,
  fourth application). Construction is the mirror: a component has to exist
  before a note can name it, so the verb order is fixed by the reference, not by
  where the cursor is.

`lab/70-percussion/minimal-kit` is the one scenario blocked by this, and its
four kit notes are already deletable — removal needs identity, construction
needs a model.

## The question this item has to answer first

**What does a kit staff's vertical axis mean to the cursor?** The grid is built
from staff positions; a kit maps positions to components through the part's own
declaration. Either the grid learns a third mode beside `staff` and `string`, or
kit entry is a text form (`snare`, `kick`) that never uses the vertical axis at
all. The tab projection's `TabSetup` override is the nearest precedent — the
strings are presentation supplied to the viewer, and the kit map may be the
same shape.

## Not in scope

Percussion *rendering* (the engine already draws the kit scenario) and the audio
mapping — `sound` is audio-only and never drawn, which is why it is the one kind
here with no ink at all.
