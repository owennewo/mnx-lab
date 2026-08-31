# Retire the clef popover — one-surface campaign item 3

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 3 — the first retirement that removes a *rung*, not just a key.

## The census (contract §1)

- **Grammar** — `parseClef` (`src/edit/setupGrammar.ts`): seven named clefs
  (`treble`, `bass`, `alto`, `tenor`, `treble8vb` — the guitar clef —
  `treble8va`, `bass8vb`) plus `inherit` / bare `-`. Fires
  `setClef {sign, staffPosition, octave?}` or `removeClef`; **both intents
  resolve part and staff from the cursor**, in the popover and the inspector
  alike — parity is exact.
- **Surfaces** — `Shift+C` binding + ShellAction arm; `POPOVER_ACTIONS`/
  `POPOVER_SPECS.clef` + submit branch + palette row; `KEY_DOCS` row;
  `SURFACE_INTENTS`/`opRows` credits; **one tile, two scopes** — `clef` at
  `partMeasure` and `measure` (the cross-listing convenience
  workbench-rung-inspector.md documented).
- **Traces** — none drive the popover.

## Coverage

The partMeasure rung has it all: one pill **per staff** (`clef: bass`, named
back through `clefText`), and the typed `clef` word with the full name list,
`inherit` → `removeClef` included. Evidence added: `clef inherit` and the
octave form `clef treble8vb` through `parseInspectorLine`, beside the existing
typed-add and pill-read assertions.

## What retirement changes, accepted with eyes open

- **The measure-rung convenience dies.** The inspector's `clef` word lives at
  partMeasure only, so a clef edit from the bar rung is one ↓ first. That is
  the rung discipline the campaign buys — a clef *is* a part-bar thing — and
  both group entries the tile sat in (`staff` at partMeasure, `signatures` at
  measure, already down to `['clef']` after items 1–2) are deleted with it.
- **A pre-existing multi-staff wart is recorded, not fixed**: on a grand-staff
  part the inspector shows a pill per staff, but set/remove act at the
  *cursor's* staff — Backspace on the other staff's pill edits the wrong clef.
  The popover had the identical cursor-staff limitation, so retirement loses
  nothing; logged in the campaign as ops residue beside the
  `setFullMeasureRest`/`setMeasureRepeat` `parts[0]` gap the inspector doc
  already tracks.

## The sweep

`clefPopover` in full across the six files; `parseClef` and `CLEF_NAME_LIST`
survive (the inspector consumes both); the keymap comment block that described
clef as key signature's surviving pair went with the binding.

## Learnings handed forward

- A two-scope tile retires as one tile plus **two** group entries — check
  every rung's group table, not just the home rung's.
- Items 1–3 have now emptied the measure rung's `signatures` group entirely;
  the bar rung's popover-tier content is down to `bar-attribute` (item 4).
