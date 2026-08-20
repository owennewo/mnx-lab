# The keymap cheatsheet — the per-level navigation map as data

> **Status: in progress — stages 1–3 built 2026-08-11, same day as proposed.**
> Shipped: `src/edit/keymapDocs.ts` (the `KeyDoc` table over all bound
> strokes, seven display groups Navigation → Workbench, `cheatsheet()`
> filtering by level + tabPane + projection; `SHELL_BINDINGS` exported for
> the joins); the hud-tab cheatsheet section ("keys · at this level" —
> grouped, restyled rows under the selection rows, neutral `HudCheatGroup`
> contract); the actions tab's hand-written hint retired (now one pointer
> line); `harness/conformance/keymap-docs.test.ts` — both joins plus three
> guard mirrors (voice jump note-only, toggleNote notation-only, arrows
> inert at score) and level/context-dependence assertions on the rendered
> sheet. Open questions resolved in the build: meanings keyed per stroke-
> group row (aliases share a row: `Del/⌫`, `Alt+←/→ · −/=`); shell actions
> joined the table (`setup`/`workbench` groups); the score rung shows its
> honest near-empty truth. The 2026-08-16 horizontal pass added the
> Shift+←/→, Shift+End and Ctrl/Meta+A rows with per-rung meanings, covered by
> the same binding↔documentation joins. The later container/Delete pass added
> container navigation/range/closure meanings and the rung-first Delete
> contract through section, with guard mirrors for both arrow families.
> The 2026-08-20 clipboard pass (core-selection-clipboard.md stage 6) added
> the Ctrl/⌘+C/X/V rows: copy and paste level-independent, cut spelling its
> per-rung removal table with the score row absent — guard-mirrored against
> the cut planner's refusal.
> **Remaining: stage 4** — later ladder review decisions continue to land here
> as data.
>
> Original proposal below. The rendering surface builds on
> [core-score-hud.md](../complete/core-score-hud.md) (the hud panel tab);
> the data table is the documentation half of the
> [core-selection-ladder.md](../complete/core-selection-ladder.md)
> **per-level navigation map** — that effort decides what every key means at
> each rung; this one writes the decisions down as data and renders them.

## The problem

A selection-mode-dependent cheatsheet — "what can I do *right now*" — cannot
be built from the keymap alone, and the current substitute is drifting prose.

What is already right: **bindings are data by design.** `src/edit/keymap.ts`
declares three `KeymapLayer` tables (`navigation`, `edit`, `tab-digits`) of
`{code, modifiers, intent}` plus `SHELL_BINDINGS`, and nothing outside that
module may interpret a KeyboardEvent. Pane-dependence is structural too: the
mount picks active layers (`activeLayers()` — the digit layer only when a tab
pane is on screen), so "which keys are live in this view" is answerable today.

What is missing, in two layers:

1. **No display metadata.** A binding carries an intent, not a label or
   group. The actions tab's hint line is hand-written prose and already
   drifts from the tables — it says nothing of the Ctrl climb, Escape/Enter,
   or Shift+Alt octave transpose. `SHELL_BINDINGS` is not even exported.
2. **The level dimension is code, not data — and it is the dimension a
   cheatsheet is FOR.** The keymap is deliberately level-agnostic (one
   `ArrowRight → nextPosition` binding); the *meaning* is resolved inside
   `session.navigate`: bare arrows move by the rung's unit (positions at
   note/event, bars at the bar rungs, sections at section, nothing at
   score), `jumpUp`/`jumpDown` silently no-op except at note level,
   `toggleNote` requires the notation projection, `transpose` is polymorphic
   (re-pitch a note, nudge a rest). None of it is introspectable. A
   cheatsheet built from the keymap alone would say "→: next position" at
   every rung — precisely the wrong cheatsheet.

## The design: one meaning table, four consumers

Not per-binding `levels: []` annotations — a **meaning table**: for each
stroke, what it does at each rung, as data beside the bindings it documents.

```ts
// src/edit/keymapDocs.ts (DOM-free, importable by workbench and tests)
interface KeyDoc {
  stroke: KeyStroke;            // joins against the binding tables
  group: 'navigate' | 'select' | 'edit' | 'entry' | 'shell';
  meaning: Partial<Record<SelectionLevel | 'all', string>>;
  // absent level ⇒ inert at that rung; 'all' ⇒ level-independent
  requires?: 'tabPane' | 'notationProjection';
}
```

The joins keep it honest at both ends: a `KeyDoc` whose stroke matches no
binding is a stale doc; a binding with no `KeyDoc` is an undocumented key —
both are one `harness/conformance` assertion each.

The four consumers:

1. **The cheatsheet** — filter by `session.selectionLevel` + active layers +
   projection, format, render. Home: a section at the bottom of the **hud
   panel tab** — the HUD rows are the nouns at the cursor, the cheatsheet is
   the verbs at the current rung, one thesis twice. (A `?` overlay can come
   later; the panel section costs nothing extra.)
2. **The actions tab's hint line** — replaced by a render over the same
   table. The hand-written prose and its drift retire.
3. **The ladder's documentation** — the per-level navigation map the ladder
   effort is deciding rung by rung gets a canonical, diffable home. Each
   per-level review pass lands its verdicts here as data, not prose.
4. **The honesty test** — beyond the two join checks, assert the table
   agrees with session behavior where the behavior is a guard, e.g.
   `jumpUp` documented only at `note` ↔ the `if (this.level !== 'note')`
   guard, `toggleNote` documented `requires: 'notationProjection'` ↔ the
   projection check. The cheatsheet must not be able to lie.

## Boundaries and caveats

- **Layer placement**: the table is `edit/`-tier (DOM-free, beside the
  keymap), the rendering is `workbench/`-tier (the panel). Same split as the
  HUD's `hudRows.ts` mapping — and the same promotion posture: the rendered
  cheatsheet receives display rows, not editor types, if it ever moves.
- **Physical keys**: bindings match `KeyboardEvent.code` (decided — AZERTY
  fret entry must not need Shift), so printed labels (`Shift+M`) describe
  the physical QWERTY position. The formatter derives labels from `code`;
  when the emulation-preset work revisits layout detection, only the
  formatter changes.
- **Static meaning, not live enablement.** Some applicability is state-, not
  level-dependent (delete needs a note under the cursor, undo needs
  history). The cheatsheet shows the per-level meaning; at most it grays by
  cheap state (`canUndo`/`canRedo`). It is a map, not an enablement oracle —
  chasing per-key liveness would couple it to every session invariant.
- **Two-digit frets, digit runs**: the digit layer is ten bindings; the
  cheatsheet collapses them to one row (`0–9 · frets, digits combine`).
  The table wants a `collapse` key or the formatter special-cases the group.

## Open questions

- **Does `meaning` live per stroke or per intent?** Per stroke duplicates
  aliases (`-`/`=` vs Alt+←→ both step duration); per intent loses the
  ability to present the primary binding and the fluency alias differently.
  Leaning per-intent with the formatter picking display strokes, but the
  alias presentation needs a look at real content first.
- **Shell actions in the same table?** They are not intents (deliberately —
  traces record what popovers emit, not their opening), but the cheatsheet
  wants them (`Shift+T time…`, `Ctrl+K palette`). Probably `group: 'shell'`
  rows joining `SHELL_BINDINGS`, which then needs exporting.
- **The score rung**: almost everything is inert there. Show the near-empty
  truth (honest, teaches the ladder), or fall back to 'all' rows only?

## Staging

1. **The table + joins** — `keymapDocs.ts` covering today's bindings at
   today's decided rungs (note level is reviewed; upper rungs get their
   current level-scaled meanings), plus the two join assertions.
2. **The cheatsheet render** — the hud-tab section, level/layer/projection
   filtered; the actions hint line replaced.
3. **The behavior assertions** — the guard-mirroring tests (jump levels,
   projection requirements).
4. **Ride the ladder** — as each per-level review pass lands (event next),
   its key decisions land here as data in the same change.
