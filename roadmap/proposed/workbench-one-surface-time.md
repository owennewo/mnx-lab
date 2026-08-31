# Retire the time-signature popover — one-surface campaign item 2

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 2. Item 1's recipe, with the first global-tab casualty.

## The census (contract §1)

- **Grammar** — `parseTimeSignature` (`src/edit/setupGrammar.ts`): `N/D`
  (count 1–32, unit a power of two ≤ 64); the glyph words `common` (4/4 drawn
  𝄴) and `cut` (2/2 drawn 𝄵); the qualified `N/D common|cut`; `inherit` /
  bare `-`. Fires `setTimeSignature {count, unit, display?}` or
  `removeTimeSignature`. Single rung.
- **Surfaces** — `Shift+T` binding + ShellAction arm; `POPOVER_ACTIONS`/
  `POPOVER_SPECS.time` + submit branch + palette row; `KEY_DOCS` row;
  `SURFACE_INTENTS`/`opRows` credits; and **two tray tiles** — `time-signature`
  (scope `measure`) and `doc-time` (scope `session`, the tray's global tab).
- **Traces** — none drive the popover.

## Coverage

Complete before the item started: the `time` pill is the mandatory/floor case
(`[floor]` when declared here, `[inherited]` otherwise — reverts, never
deletes), and the typed branch hands the whole grammar to `parseTimeSignature`,
`display` and `inherit` included. The item's only new evidence is two
assertions in `rung-inspector.test.ts` — `time common` →
`setTimeSignature {4, 4, display: 'common'}` and `time inherit` →
`removeTimeSignature` — closing the gap between "the code passes it through"
and "a test says so".

## The ruling applied

`Shift+T` is **freed** (the campaign default from item 1). Both tiles are
**deleted**, `doc-time` included — the first removal from the tray's global
tab. Accepted with eyes open: the global tab is item 11's condemned property,
and the inspector at the bar rung is the one path; keeping a tile that opens
nothing would have been the alternative.

## The sweep

`timeSignaturePopover` in full across `keymap.ts`, `keymapDocs.ts`,
`opRows.ts`, `commandRegistry.ts` (both tiles + the measure group listing),
`ScenarioPage.ts` (map, kind, spec, submit branch, palette row, import).
**`parseTimeSignature` survives** — the inspector consumes it.

## Learnings handed forward

- The `doc-*` session-scope tiles are ungrouped (the global tab renders them
  directly), so their removal is tile-only — items 7 (`doc-tuning`) and 9
  (`doc-add-part`) will meet the same shape.
- The submit chain in `ScenarioPage` is an `if/else if` ladder; each retirement
  shortens it, and the head branch moves — check the *next* branch's opener
  when removing the first.
