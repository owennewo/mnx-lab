# Retire the rhythm popover — one-surface campaign item 8

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 8 — the campaign's first new *verb*, the coincidence rule's promised
> settings offer finally built, and two derived readings asked for in the
> proposing conversation.

## The census (contract §1)

- **Grammar** — `parseRhythm`: tuplet ratios (`3:2`,
  `3 eighth in 1 quarter, no number`), `grace [n]` / `appoggiatura` /
  `acciaccatura`, `tremolo n [in 2 half]`, `space n/d`, `rest half`. Three
  intents: `wrapInContainer` (extent from the declaration via `wrapExtent`),
  `insertSpace`, `setRestSpelling`.
- **Surfaces** — the usual six; five popover tiles (`tuplet`/`grace`/`tremolo`
  at event, `rest-spelling`/`space` at voiceMeasure); and the
  `container-settings` tile that never worked (`blockedBy:
  'container-properties'`).
- **The correction**: the campaign row believed "container pills are
  read-only" — those pills died with the container *rung* (range-grain
  decision 2). There was no container-property surface at all, and no unwrap
  op exists **by design** (unwrapping re-times; a container is removable only
  when empty).

## The verb (contract §3 — ops first)

`setContainerProperties` — addressed like `wrapInContainer` (content index,
`partIndex`), writing **presentation fields only**: tuplet
`bracket`/`showNumber`, grace `slash`/`graceType`, tremolo `marks`, each field
also clearable. Timing (the ratio) is deliberately not amendable — re-timing
is a wrap request, the same ground on which unwrap is refused. The intent is
**address-free**: the session resolves *which* container from
`containerCoincidence` over the live selection (exactly one wholly-covered
container, else refused), so the typed line stays pure like every other.
This **closes the residue ledger's `container-properties` row**
(core-selection-tray-residue.md updated in the same change).

## Coverage built

- **Construction as declaration** (contract §2, argued): `3:2`, `grace`,
  `appoggiatura`, `tremolo 2` typed at the event rung fire `wrapInContainer` —
  the declaration carries its own extent, the rhythm popover's founding
  argument. `space 1/4` / `rest half` land at the voiceMeasure rung. Each rung
  signposts the other's words (item 4's pattern): a rider typed at event says
  *voice rung*, a ratio typed at voiceMeasure says *event rung*.
- **The coincidence pills**: an event range that IS a container shows a
  derived identity pill (`tuplet: 3:1 eighth`) plus annotation pills for its
  declared presentation fields — amend by word (`bracket yes`, `number both`,
  `slash no`, `marks 3`), clear by Backspace.
- **Two derived readings** (from the proposing conversation): the event rung's
  **`at: 0 → 1/4`** (where the event sits in its bar, whole-note fractions)
  and the voice-bar's **`fill: 1 of 4/4`** (the voice's clock against the
  meter — the adds-up check at a glance; `itemSpan` keeps container children
  from double-counting and grace content at zero).

## The sweep

`rhythmPopover` in full; six tiles (the blocked one included — its group and
the voice rung's emptied rests group went with them); the `tuplet3` twin the
deletion resolved, pruned; `wrapInContainer`/`insertSpace`/`setRestSpelling`/
`setContainerProperties` credited to the inspector. `parseRhythm` and
`RHYTHM_HELP` survive — the inspector consumes both.

## Not in scope

`graceType` has no typed amend word (its pill is derived; the wrap
declarations set it at construction) — recorded, tiny, revisit if wanted.
Duration keys (`-`/`=`/`.`) and the `duration` pill are the *other* rhythm
(one event's own value) and were never this item's concern.

## Learnings handed forward

- `session.apply` re-anchors the selection after an edit, so a range-addressed
  amend's test must rebuild its range before reading pills — and the re-anchor
  lands on the *last* touched child, so the range grows leftward.
- An address-free intent + session-side coincidence resolution keeps the
  parse layer pure and gives refusal-on-ambiguity for free; item 11's verb
  re-homing can reuse the shape.
