# Retire the layout popover — one-surface campaign item 10

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 10 — the last popover, and the item that pays off the key the campaign
> was founded to free: **`Shift+S` is the shift slide now.**

## The census (contract §1)

- **Grammar** — `parseLayoutSentence`, four arms: `layout [slot] [«id»]:
  <body>` (the bracket/brace source tree), `score «name»: <body>`,
  `mmrest m3 x2 [in 2]`, and slot-addressed removals (`no layout 2` …). Six
  intents. **Upsert by id/name** is the grammar's model: naming an existing
  layout replaces it in place; only a new one needs a slot.
- **Surfaces** — the `Shift+S` binding + arm, the popover spec/branch, the
  credits — and just **two tiles, both never functional**
  (`system-break`/`multimeasure-rest`, `blockedBy: 'layout-authoring'`).
  No palette row, no traces.

## Coverage built (document rung, item 9's machinery)

- **Words** `layout` / `score` / `mmrest` / the `no …` removals — handed
  wholesale to `parseLayoutSentence`. The upsert-by-id resolution rides the
  parse **context** (`layoutIds`/`scoreNames`, supplied by the page from the
  session), so the parse layer stays pure and the popover's slot rule
  survives byte-for-byte.
- **Pills** — one summary per declared layout (`1 «L1» · bracket · 1
  sources`), score (`1 «Part A»`), and mmrest (`m3 ×2 [in N]`), removable by
  the slot-addressed removals. **Deliberately summaries, not round-trips**:
  amend is retyping the sentence — the popover's own model ("the user
  supplies the whole value"), so no tree-editing UI was invented.
- The residue ledger's `layout-authoring` row **closes**: the surface that
  "can see the document" turned out to be the inspector's document rung, not
  the tray.

## The coda — `Shift+S` becomes the shift slide

The Shift+E interim move (recorded in the campaign log) is superseded: the
popover retired directly, and the freed key closes the conversation that
started the campaign.

- `TechniqueChoice`'s slide widened with `slideType?: 'shift' | 'legato'`;
  the op writes `type: slideType ?? 'legato'` (the common-practice default).
- **Tab projection**: `Shift+S` toggles a shift slide; **same type toggles
  off, the other retypes in place** (an upsert — so `S` on a shift slide
  makes it legato, `Shift+S` on a legato makes it shift, and a second press
  of either removes). Plain `S`'s no-slide behaviour is unchanged.
- The typed forms land too: `slide shift` / `slide legato` at the note rung;
  the slide pill now shows its type. `slideIn`/`slideOut` stay JSON-authored
  (zero corpus coverage; readers show them as a bare `slide`) — recorded,
  not built.

## The sweep

`layoutPopover` in full; the two blocked tiles and their group; the
`KEY_DOCS` layout row traded for the shift-slide row; the six intents
credited to the inspector. `parseLayoutSentence` survives.

## Learnings handed forward

- A grammar whose model is *upsert-by-whole-value* migrates with no design
  work: pills summarize, sentences amend. The tree never needed a tree editor.
- The parse `context` is the right home for doc-derived resolution (slots,
  counts) — the third use of the pattern (tempo#n, harmony#n, now layout ids).
