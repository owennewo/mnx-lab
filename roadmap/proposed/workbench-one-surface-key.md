# Retire the key-signature popover — one-surface campaign item 1

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 1 — the first retirement, and deliberately the smallest: the item that
> proves the census → coverage → sweep recipe the other ten will follow.

## The census (contract §1)

One grammar, two ops, six registration points:

- **Grammar** — `parseKeySignature` (`src/edit/setupGrammar.ts`): a key name from
  the `KEY_NAMES` circle (`C`, `Bb`, `F#`…), a fifths count `-7…+7` (`-3`, `+2`),
  or the removal tokens `inherit` / bare `-`. Fires `setKeySignature {fifths}` or
  `removeKeySignature`. Single-rung (the global measure), no cross-listings.
- **Surfaces** — the `Shift+K` shell binding and `keySignaturePopover` ShellAction
  arm (`keymap.ts`); the popover overlay (`ScenarioPage`: `POPOVER_ACTIONS`,
  `POPOVER_SPECS.key`, the submit branch); the palette row
  (`SETUP_POPOVER_COMMANDS`); the tray's `key-signature` tile
  (`commandRegistry.ts`, tier `popover`, scope `measure`); the docs/credit rows
  (`KEY_DOCS`, `SURFACE_INTENTS`, `opRows.ts`).
- **Traces** — none drive the popover; nothing to regenerate.

## Coverage (already complete — why this is item 1)

The inspector's `key` pill (measure rung, rung-inspector stage 3) reads
declared-vs-inherited, removes by Backspace, and the slot word `key`
(hint `C · Bb · F# · -3`) hands its value to the same `parseKeySignature` —
`key inherit` included. Evidence **pre-existed** in
`harness/conformance/rung-inspector.test.ts`: typed add (`keyWord(3)` →
`setKeySignature`), `inherit` → `removeKeySignature`, pill read
(`key: Bb [inherited]` / `[annotation]`) and pill removal, and
`SURFACE_INTENTS.rungInspector` already credited both ops. No new coverage was
needed; the item is pure sweep.

## The ruling: freed, not accelerated (contract §5)

The user ruled 2026-08-31: **`Shift+K` is freed entirely** — no inspector
accelerator. A key edit is `Enter → ladder to the bar rung → key Bb ⏎`. The
ruling is expected to hold for the following items (**lyrics flagged as the
possible exception**), so items 2–5 inherit it as the default rather than
re-asking; the campaign log records it.

## The sweep (what was removed)

`keySignaturePopover` in full: the ShellAction arm and `Shift+K` binding; the
`POPOVER_ACTIONS` entry, `'key'` from `PopoverKind`, `POPOVER_SPECS.key`, the
submit branch and the `parseKeySignature` import in `ScenarioPage`; the palette
row; the tray tile and its `measure`-group listing; the `KEY_DOCS` row; the
`SURFACE_INTENTS` and `opRows` credit entries. **`parseKeySignature` survives**
— the inspector is its consumer (contract §4). The `'key-signature'`
`ElementKind` in `elementWalk`/`destructWalk` is the document-object census,
not the surface, and is untouched.

## Learnings handed forward

- The freed-not-accelerated ruling is now the campaign default; only lyrics may
  argue otherwise.
- The inspector's full-measure-rest refusal message points at `Shift+B` —
  item 4 must rewrite it when that popover goes.
- Coverage evidence for the stage-3/4 families largely pre-exists in
  `rung-inspector.test.ts`; items 2–5 should *check before writing* new smoke.
