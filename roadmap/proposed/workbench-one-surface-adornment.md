# Retire the adornment popover — one-surface campaign item 5

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 5 — the last of the census-and-sweep five, and the broadest grammar of
> them: the whole note-level typed surface behind one letter.

## The census (contract §1)

- **Grammar** — `parseAdornment`, eight result arms: markings (aliases like
  `marcato`→`strongAccent`, per-marking attributes, `no X` removal); fermata
  with its full attribute forms (`fermata angled short below`); dynamics (a
  bare word is a dynamic); cresc/dim; louder/softer; `text …` directions;
  `8va`/`8vb`; accidental display (`accidental parens/hidden/show`); fingering
  (`left 3`); shaped bends as stops (`bend 0>full>1/2>0`); string-annotation
  removal. **Thirteen intents** in its `SURFACE_INTENTS` credit — the biggest
  of any popover.
- **Surfaces** — the usual six files; **five popover-tier tiles** (`fingering`
  at note; `crescendo`, `diminuendo`, `direction`, `fermata` at event); and
  **nine `Shift+A` badges**, only five of which belonged to those tiles.
- **Traces** — none drive the popover.

## Coverage — parity automatic, item 4's mechanism

The note and event rungs both funnel through `parseAdornmentLine`, which wraps
`parseAdornment` wholesale — every arm maps to the identical intents, plus the
noun-stripping layer for pill amends (`dynamic mf`, `fingering left 3`).
Conformance already exercises the families typed (`staccato`, `breath comma`,
`dynamic mf`, `text below cantabile`, `8va 2`), the fermata attribute forms,
and the pills — no new assertions were needed; the purest sweep since item 1.

## The sweep

`adornmentPopover` in full; the five tiles with four group trims (dynamics
keeps `piano`/`mezzo-forte`/`forte`, lines-and-text keeps `ottava`/`lyric`,
the note text group keeps `lyric`, the event articulation group keeps
`breath`/`arpeggio` — nothing emptied); and — item 4's lesson applied *before*
the join billed for it — the four stray badges stripped from the `marking()`
and `dynamic()` helpers and the `accidental-display`/`ottava` intent tiles in
the same pass. `parseAdornment` survives (the inspector consumes it);
`ADORNMENT_HELP` left `ScenarioPage` with the branch.

## Learnings handed forward

- Pre-billing the joins works: no red gates this time. The badge census
  (`grep shortcut: 'Shift+<letter>'`) belongs in every remaining item's
  first step.
- Five census-and-sweep items in, the pattern held every time: where the
  inspector already reuses the popover's parser, coverage disputes never
  materialize — the risk lives entirely in registry metadata (badges, twins,
  groups).
